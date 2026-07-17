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
    let authConnectionInitialized = false;
    let connectedUserId = null;
    let dataReady = false;
    let dataReadyDetail = null;
    let resolveDataReady = null;
    let dataReadyPromise = null;
    const dataMigration = global.TasklyzenDataMigration || null;

    function getCloudStorageKeys() {
        const config = global.TasklyzenConfig || {};
        const configuredKeys = Array.isArray(config.cloudStorageKeys)
            ? config.cloudStorageKeys
            : Object.values(config.storageKeys || {});

        return Array.from(new Set(configuredKeys.filter(key => typeof key === 'string' && key)));
    }

    function isCloudStorageKey(key) {
        return getCloudStorageKeys().includes(String(key || ''));
    }

    function resetDataReady() {
        dataReady = false;
        dataReadyDetail = null;
        dataReadyPromise = new Promise(resolve => {
            resolveDataReady = resolve;
        });
    }

    function markDataReady(source) {
        if (dataReady) {
            return dataReadyDetail;
        }

        dataReady = true;
        dataReadyDetail = {
            source: source || 'local',
            authenticated: Boolean(currentUser)
        };
        if (resolveDataReady) {
            resolveDataReady(dataReadyDetail);
        }
        if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
            global.dispatchEvent(new CustomEvent('tasklyzen:data-ready', {
                detail: dataReadyDetail
            }));
        }
        return dataReadyDetail;
    }

    function whenReady() {
        return dataReady ? Promise.resolve(dataReadyDetail) : dataReadyPromise;
    }

    resetDataReady();

    function sanitizeStorageEntry(key, value) {
        if (!dataMigration || typeof dataMigration.sanitizeStorageEntry !== 'function') {
            return { value, changed: false, remove: false };
        }

        return dataMigration.sanitizeStorageEntry(key, value);
    }

    function migrateLegacyData() {
        if (!global.localStorage) {
            return false;
        }

        const keys = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);

            if (key) {
                keys.push(key);
            }
        }

        let changed = false;

        keys.forEach(key => {
            const currentValue = localStorage.getItem(key);
            const sanitized = sanitizeStorageEntry(key, currentValue);

            if (sanitized.remove) {
                localStorage.removeItem(key);
                changed = true;
                return;
            }

            if (sanitized.changed && sanitized.value !== currentValue) {
                localStorage.setItem(key, sanitized.value);
                changed = true;
            }
        });

        return changed;
    }

    function sanitizeCloudData(cloudData) {
        const data = {};
        const updates = {};
        const removedKeys = [];
        let changed = false;

        Object.entries(cloudData || {}).forEach(([key, value]) => {
            const sanitized = sanitizeStorageEntry(key, value);

            if (sanitized.remove) {
                removedKeys.push(key);
                changed = true;
                return;
            }

            if (!isCloudStorageKey(key)) {
                return;
            }

            data[key] = sanitized.value;

            if (sanitized.changed) {
                updates[key] = sanitized.value;
                changed = true;
            }
        });

        return { data, updates, removedKeys, changed };
    }

    function persistCloudMigration(docRef, migration) {
        if (!docRef || !migration || !migration.changed) {
            return;
        }

        const updates = { ...migration.updates };
        const canDeleteFields = Boolean(global.firebase
            && global.firebase.firestore
            && global.firebase.firestore.FieldValue
            && typeof global.firebase.firestore.FieldValue.delete === 'function');

        if (canDeleteFields) {
            migration.removedKeys.forEach(key => {
                updates[key] = global.firebase.firestore.FieldValue.delete();
            });
        }

        if (Object.keys(updates).length === 0) {
            return;
        }

        docRef.set(updates, { merge: true }).catch(error => {
            console.error('Error al migrar datos retirados en la nube:', error);
        });
    }

    function canDeleteCloudKey(key) {
        return isCloudStorageKey(key) || sanitizeStorageEntry(key, null).remove;
    }

    // Se invoca desde tasklyzen-auth.js cuando el estado cambia
    function onAuthChange(user, firestoreDb) {
        const nextUserId = user && user.uid ? String(user.uid) : null;

        if (authConnectionInitialized && connectedUserId === nextUserId && db === firestoreDb) {
            return whenReady();
        }

        authConnectionInitialized = true;
        connectedUserId = nextUserId;
        currentUser = user;
        db = firestoreDb;
        resetDataReady();
        migrateLegacyData();

        if (user && db) {
            return startSync();
        } else {
            stopSync();
            markDataReady('local');
            return whenReady();
        }
    }

    function startSync() {
        migrateLegacyData();

        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }

        const docRef = db.collection('users').doc(currentUser.uid);

        return docRef.get().then(docSnap => {
            const cloudMigration = sanitizeCloudData(docSnap.exists ? docSnap.data() : {});
            const cloudData = cloudMigration.data;

            persistCloudMigration(docRef, cloudMigration);

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
                return uploadLocalToCloud(docRef).then(() => {
                    startListener(docRef);
                    markDataReady('local-uploaded');
                });

            } else if (!hasLocalTodos && hasCloudTodos) {
                // Solo la nube tiene datos → aplicar localmente sin preguntar
                applyCloudToLocal(cloudData, docRef);
                startListener(docRef);
                markDataReady('cloud-restored');

            } else {
                // Sin datos en ningún lado, o datos idénticos → solo escuchar
                reconcileExperienceState(cloudData, docRef);
                startListener(docRef);
                markDataReady('synced');
            }

        }).catch(err => {
            console.error('Error al iniciar sincronización:', err);
            startListener(db.collection('users').doc(currentUser.uid));
            markDataReady('sync-error');
        });
    }

    function getExperienceStateScore(serializedValue) {
        try {
            const value = JSON.parse(serializedValue);
            const statusScore = value.status === 'completed' ? 3 : value.status === 'deferred' ? 2 : 1;
            const versionScore = (Number(value.profileVersion) || 0) + (Number(value.walkthroughVersion) || 0);
            const timestamp = Date.parse(value.completedAt || value.deferredAt || '') || 0;
            return [versionScore, statusScore, timestamp];
        } catch (_error) {
            return [0, 0, 0];
        }
    }

    function compareExperienceState(left, right) {
        const leftScore = getExperienceStateScore(left);
        const rightScore = getExperienceStateScore(right);

        for (let index = 0; index < leftScore.length; index += 1) {
            if (leftScore[index] !== rightScore[index]) {
                return leftScore[index] - rightScore[index];
            }
        }
        return 0;
    }

    function reconcileExperienceState(cloudData, docRef) {
        const storageKeys = global.TasklyzenConfig && global.TasklyzenConfig.storageKeys;
        const experienceKey = storageKeys && storageKeys.experience;
        if (!experienceKey) {
            return;
        }

        const localValue = localStorage.getItem(experienceKey);
        const cloudValue = cloudData[experienceKey];
        if (!localValue && !cloudValue) {
            return;
        }

        if (cloudValue && (!localValue || compareExperienceState(cloudValue, localValue) > 0)) {
            localStorage.setItem(experienceKey, cloudValue);
            global.dispatchEvent(new StorageEvent('storage', { key: experienceKey, newValue: cloudValue }));
            return;
        }

        if (localValue && localValue !== cloudValue) {
            docRef.set({ [experienceKey]: localValue }, { merge: true }).catch(error => {
                console.error('Error sincronizando la experiencia inicial:', error);
            });
        }
    }

    // ── Muestra el diálogo y espera la decisión del usuario ────────────────
    function showConflictDialog(localTodosStr, cloudTodosStr, cloudData, docRef) {
        const conflictDialog = document.getElementById('data-conflict-dialog');
        if (!conflictDialog || typeof conflictDialog.showModal !== 'function') {
            // Fallback: preferir local (datos más frescos en este dispositivo)
            conflictPending = false;
            uploadLocalToCloud(docRef).then(() => {
                startListener(docRef);
                markDataReady('local-conflict-fallback');
            });
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
                applyCloudToLocal(cloudData, docRef);
                startListener(docRef);
                markDataReady('cloud-selected');
            } else {
                // Subir local a la nube y ESPERAR antes de arrancar el listener
                // para evitar que el snapshot inmediato sobreescriba local con datos viejos
                uploadLocalToCloud(docRef).then(() => {
                    startListener(docRef);
                    markDataReady('local-selected');
                });
            }
        };

        keepCloud.addEventListener('click', () => finish('cloud'));
        keepLocal.addEventListener('click', () => finish('local'));
    }

    // ── Aplica todos los campos de la nube a localStorage ─────────────────
    function applyCloudToLocal(cloudData, docRef) {
        const cloudMigration = sanitizeCloudData(cloudData);

        isApplyingRemoteChange = true;
        for (const [key, value] of Object.entries(cloudMigration.data)) {
            if (localStorage.getItem(key) !== value) {
                localStorage.setItem(key, value);
                global.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
            }
        }
        isApplyingRemoteChange = false;
        persistCloudMigration(docRef, cloudMigration);
    }

    // ── Sube todos los datos locales a Firestore (retorna Promise) ─────────
    function uploadLocalToCloud(docRef) {
        migrateLegacyData();
        const allLocalData = {};

        getCloudStorageKeys().forEach(key => {
            const localValue = localStorage.getItem(key);

            if (localValue === null) {
                return;
            }

            const sanitized = sanitizeStorageEntry(key, localValue);

            if (sanitized.remove) {
                localStorage.removeItem(key);
                return;
            }

            if (sanitized.changed && sanitized.value !== localValue) {
                localStorage.setItem(key, sanitized.value);
            }

            allLocalData[key] = sanitized.value;
        });

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

            applyCloudToLocal(docSnap.data(), docRef);
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
        const sanitized = sanitizeStorageEntry(key, value);

        if (sanitized.remove) {
            remove(key);
            return;
        }

        if (!isCloudStorageKey(key)) {
            return;
        }

        if (currentUser && db && !isApplyingRemoteChange) {
            const docRef = db.collection('users').doc(currentUser.uid);
            docRef.set({ [key]: sanitized.value }, { merge: true }).catch(err => {
                console.error('Error sincronizando a la nube:', err);
            });
        }
    }

    function readJson(key, fallback) {
        try {
            const value = readText(key, null);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        writeText(key, JSON.stringify(value));
    }

    function readText(key, fallback) {
        const value = localStorage.getItem(key);

        if (value === null) {
            return fallback;
        }

        const sanitized = sanitizeStorageEntry(key, value);

        if (sanitized.remove) {
            localStorage.removeItem(key);
            return fallback;
        }

        if (sanitized.changed && sanitized.value !== value) {
            localStorage.setItem(key, sanitized.value);
            pushToCloud(key, sanitized.value);
        }

        return sanitized.value;
    }

    function writeText(key, value) {
        const stringValue = String(value);
        const sanitized = sanitizeStorageEntry(key, stringValue);

        if (sanitized.remove) {
            remove(key);
            return;
        }

        localStorage.setItem(key, sanitized.value);
        pushToCloud(key, sanitized.value);
    }

    function remove(key) {
        localStorage.removeItem(key);
        if (currentUser && db && !isApplyingRemoteChange && canDeleteCloudKey(key)) {
            const docRef = db.collection('users').doc(currentUser.uid);
            if (global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue) {
                docRef.update({ [key]: global.firebase.firestore.FieldValue.delete() }).catch(console.error);
            }
        }
    }

    function removeMany(keys) {
        const uniqueKeys = Array.from(new Set((keys || []).filter(Boolean)));
        const cloudKeys = uniqueKeys.filter(canDeleteCloudKey);

        if (!currentUser || !db || isApplyingRemoteChange || !global.firebase) {
            uniqueKeys.forEach(key => localStorage.removeItem(key));
            return Promise.resolve();
        }

        const deleteField = global.firebase.firestore.FieldValue.delete();
        const updates = {};
        cloudKeys.forEach(key => {
            updates[key] = deleteField;
        });

        if (!Object.keys(updates).length) {
            uniqueKeys.forEach(key => localStorage.removeItem(key));
            return Promise.resolve();
        }

        return db.collection('users').doc(currentUser.uid).set(updates, { merge: true })
            .then(() => {
                uniqueKeys.forEach(key => localStorage.removeItem(key));
            })
            .catch(error => {
                console.error('Error eliminando datos sincronizados:', error);
                throw error;
            });
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
        removeMany,
        subscribe,
        onAuthChange,
        whenReady,
        getDataReadyState: () => ({
            ready: dataReady,
            detail: dataReadyDetail
        }),
        getCloudSyncKeys: getCloudStorageKeys,
        migrateLegacyData
    };

    migrateLegacyData();
    if (global.TasklyzenAuth && typeof global.TasklyzenAuth.whenReady === 'function') {
        global.TasklyzenAuth.whenReady().then(entryState => {
            onAuthChange(entryState.user, global.TasklyzenAuth.db);
        });
    } else {
        markDataReady('local');
    }
})(window);
