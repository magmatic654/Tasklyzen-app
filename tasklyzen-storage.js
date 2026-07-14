/*
 * Módulo: persistencia local y sincronización en la nube (Local-First)
 * Propósito:
 * - Encapsular localStorage.
 * - Sincronizar cambios en segundo plano con Firebase Firestore.
 * - Escuchar cambios de Firestore y rehidratar la app localmente.
 */
(function exposeTasklyzenStorage(global) {
    let currentUser = null;
    let db = null;
    let unsubscribeSnapshot = null;
    let isApplyingRemoteChange = false;
    let pendingCloudData = null;
    // Bloquea el listener durante la ventana de resolución de conflicto
    let conflictPending = false;

    // Se invoca desde tasklyzen-auth.js cuando el estado cambia
    function onAuthChange(user, firestoreDb) {
        currentUser = user;
        db = firestoreDb;

        if (user && db) {
            startSync();
        } else {
            stopSync();
        }
    }

    function startSync() {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }

        const docRef = db.collection('users').doc(currentUser.uid);

        docRef.get().then(docSnap => {
            const cloudData = docSnap.exists ? docSnap.data() : {};

            // ── Detectar si cada lado tiene tareas reales ──────────────────
            // La clave real de tareas según tasklyzen-config.js es 'todos'
            const TODOS_KEY = (global.TasklyzenConfig && global.TasklyzenConfig.storageKeys)
                ? global.TasklyzenConfig.storageKeys.todos
                : 'todos';

            const localTodosStr = localStorage.getItem(TODOS_KEY);
            const hasLocalTodos = Boolean(
                localTodosStr && localTodosStr !== '[]' && localTodosStr !== 'null'
            );

            const cloudTodosStr = cloudData[TODOS_KEY];
            const hasCloudTodos = Boolean(
                cloudTodosStr && cloudTodosStr !== '[]' && cloudTodosStr !== 'null'
            );

            // ── Comparar contenido real (no solo string equality) ──────────
            let todosAreDifferent = false;
            if (hasLocalTodos && hasCloudTodos) {
                try {
                    const parsedLocal = JSON.parse(localTodosStr);
                    const parsedCloud = JSON.parse(cloudTodosStr);
                    todosAreDifferent = JSON.stringify(parsedLocal) !== JSON.stringify(parsedCloud);
                } catch (_e) {
                    todosAreDifferent = localTodosStr !== cloudTodosStr;
                }
            } else if (hasLocalTodos !== hasCloudTodos) {
                // Uno tiene tareas y el otro no → siempre diferente
                todosAreDifferent = true;
            }

            // ── Decisión de flujo ──────────────────────────────────────────
            if (hasLocalTodos && hasCloudTodos && todosAreDifferent) {
                // CONFLICTO REAL: ambos lados tienen tareas distintas → preguntar
                conflictPending = true;
                pendingCloudData = cloudData;
                showConflictDialog(localTodosStr, cloudTodosStr, cloudData, docRef);

            } else if (hasLocalTodos && !hasCloudTodos) {
                // Solo local tiene datos → subir a la nube sin preguntar
                uploadLocalToCloud(docRef).then(() => {
                    startListener(docRef);
                });

            } else if (!hasLocalTodos && hasCloudTodos) {
                // Solo la nube tiene datos → aplicar localmente sin preguntar
                applyCloudToLocal(cloudData);
                startListener(docRef);

            } else {
                // Sin datos en ningún lado, o datos idénticos → solo escuchar
                startListener(docRef);
            }

        }).catch(err => {
            console.error('Error al iniciar sincronización:', err);
            startListener(db.collection('users').doc(currentUser.uid));
        });
    }

    // ── Muestra el diálogo y espera la decisión del usuario ────────────────
    function showConflictDialog(localTodosStr, cloudTodosStr, cloudData, docRef) {
        const conflictDialog = document.getElementById('data-conflict-dialog');
        if (!conflictDialog || typeof conflictDialog.showModal !== 'function') {
            // Fallback: preferir local (datos más frescos en este dispositivo)
            conflictPending = false;
            uploadLocalToCloud(docRef).then(() => startListener(docRef));
            return;
        }

        // Poblar estadísticas locales
        try {
            const localTodos = JSON.parse(localTodosStr) || [];
            const localDone  = localTodos.filter(t => t.completed || t.done).length;
            const elLT = document.getElementById('conflict-local-tasks');
            const elLD = document.getElementById('conflict-local-done');
            if (elLT) elLT.textContent = localTodos.length + (localTodos.length === 1 ? ' tarea' : ' tareas');
            if (elLD) elLD.textContent = localDone + (localDone === 1 ? ' completada' : ' completadas');
        } catch (_e) { /* ignore */ }

        // Poblar estadísticas de la nube
        try {
            const cloudTodos = JSON.parse(cloudTodosStr) || [];
            const cloudDone  = cloudTodos.filter(t => t.completed || t.done).length;
            const elCT = document.getElementById('conflict-cloud-tasks');
            const elCD = document.getElementById('conflict-cloud-done');
            if (elCT) elCT.textContent = cloudTodos.length + (cloudTodos.length === 1 ? ' tarea' : ' tareas');
            if (elCD) elCD.textContent = cloudDone + (cloudDone === 1 ? ' completada' : ' completadas');
        } catch (_e) { /* ignore */ }

        conflictDialog.showModal();

        // Clonar botones para limpiar listeners anteriores
        const rawKeepCloud = document.getElementById('conflict-keep-cloud');
        const rawKeepLocal = document.getElementById('conflict-keep-local');
        const keepCloud = rawKeepCloud.cloneNode(true);
        const keepLocal = rawKeepLocal.cloneNode(true);
        rawKeepCloud.replaceWith(keepCloud);
        rawKeepLocal.replaceWith(keepLocal);

        const finish = (choice) => {
            conflictDialog.close();
            conflictPending = false;
            pendingCloudData = null;
            if (choice === 'cloud') {
                applyCloudToLocal(cloudData);
                startListener(docRef);
            } else {
                // Subir local a la nube y ESPERAR antes de arrancar el listener
                // para evitar que el snapshot inmediato sobreescriba local con datos viejos
                uploadLocalToCloud(docRef).then(() => startListener(docRef));
            }
        };

        keepCloud.addEventListener('click', () => finish('cloud'));
        keepLocal.addEventListener('click', () => finish('local'));
    }

    // ── Aplica todos los campos de la nube a localStorage ─────────────────
    function applyCloudToLocal(cloudData) {
        isApplyingRemoteChange = true;
        for (const [key, value] of Object.entries(cloudData)) {
            if (localStorage.getItem(key) !== value) {
                localStorage.setItem(key, value);
                global.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
            }
        }
        isApplyingRemoteChange = false;
    }

    // ── Sube todos los datos locales a Firestore (retorna Promise) ─────────
    function uploadLocalToCloud(docRef) {
        const allLocalData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            allLocalData[k] = localStorage.getItem(k);
        }
        return docRef.set(allLocalData, { merge: true }).catch(console.error);
    }

    // ── Listener en tiempo real ────────────────────────────────────────────
    function startListener(docRef) {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }
        unsubscribeSnapshot = docRef.onSnapshot(docSnap => {
            // No aplicar mientras hay un conflicto pendiente de resolver
            if (conflictPending) return;
            if (!docSnap.exists) return;
            if (docSnap.metadata.hasPendingWrites) return;

            applyCloudToLocal(docSnap.data());
        }, error => {
            console.error('Error escuchando Firestore:', error);
        });
    }

    function stopSync() {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
        conflictPending = false;
    }

    function pushToCloud(key, value) {
        if (currentUser && db && !isApplyingRemoteChange) {
            const docRef = db.collection('users').doc(currentUser.uid);
            docRef.set({ [key]: value }, { merge: true }).catch(err => {
                console.error('Error sincronizando a la nube:', err);
            });
        }
    }

    function readJson(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        const stringValue = JSON.stringify(value);
        localStorage.setItem(key, stringValue);
        pushToCloud(key, stringValue);
    }

    function readText(key, fallback) {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    }

    function writeText(key, value) {
        const stringValue = String(value);
        localStorage.setItem(key, stringValue);
        pushToCloud(key, stringValue);
    }

    function remove(key) {
        localStorage.removeItem(key);
        if (currentUser && db && !isApplyingRemoteChange) {
            const docRef = db.collection('users').doc(currentUser.uid);
            if (global.firebase) {
                docRef.update({ [key]: global.firebase.firestore.FieldValue.delete() }).catch(console.error);
            }
        }
    }

    function subscribe(keys, callback) {
        const watchedKeys = new Set(keys || []);
        window.addEventListener('storage', event => {
            if (watchedKeys.size === 0 || watchedKeys.has(event.key)) {
                callback(event);
            }
        });
    }

    global.TasklyzenStorage = {
        readJson,
        writeJson,
        readText,
        writeText,
        remove,
        subscribe,
        onAuthChange
    };
})(window);
