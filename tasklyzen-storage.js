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
        }
        
        const docRef = db.collection('users').doc(currentUser.uid);
        
        docRef.get().then(docSnap => {
            const hasCloudData = docSnap.exists && Object.keys(docSnap.data()).length > 0;
            const todos = localStorage.getItem('tasklyzen-todos');
            const hasLocalData = todos && todos !== '[]' && todos !== 'null';

            if (hasLocalData && hasCloudData) {
                pendingCloudData = docSnap.data();
                const conflictDialog = document.getElementById('data-conflict-dialog');
                if (conflictDialog && typeof conflictDialog.showModal === 'function') {
                    conflictDialog.showModal();
                    
                    const keepCloudBtn = document.getElementById('conflict-keep-cloud');
                    const keepLocalBtn = document.getElementById('conflict-keep-local');
                    
                    const cleanup = () => {
                        conflictDialog.close();
                        if (keepCloudBtn) keepCloudBtn.replaceWith(keepCloudBtn.cloneNode(true));
                        if (keepLocalBtn) keepLocalBtn.replaceWith(keepLocalBtn.cloneNode(true));
                    };

                    document.getElementById('conflict-keep-cloud').addEventListener('click', () => {
                        resolveConflict('cloud');
                        cleanup();
                    });
                    
                    document.getElementById('conflict-keep-local').addEventListener('click', () => {
                        resolveConflict('local');
                        cleanup();
                    });
                } else {
                    // Fallback if dialog not supported, default to cloud
                    resolveConflict('cloud');
                }
            } else if (!hasCloudData && hasLocalData) {
                uploadLocalToCloud(docRef);
                startListener(docRef);
            } else {
                startListener(docRef);
            }
        }).catch(console.error);
    }

    function uploadLocalToCloud(docRef) {
        const allLocalData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            allLocalData[k] = localStorage.getItem(k);
        }
        docRef.set(allLocalData, { merge: true }).catch(console.error);
    }

    function resolveConflict(choice) {
        const docRef = db.collection('users').doc(currentUser.uid);
        if (choice === 'cloud' && pendingCloudData) {
            isApplyingRemoteChange = true;
            for (const [key, value] of Object.entries(pendingCloudData)) {
                if (localStorage.getItem(key) !== value) {
                    localStorage.setItem(key, value);
                    const event = new StorageEvent('storage', { key: key, newValue: value });
                    global.dispatchEvent(event);
                }
            }
            isApplyingRemoteChange = false;
        } else if (choice === 'local') {
            uploadLocalToCloud(docRef);
        }
        pendingCloudData = null;
        startListener(docRef);
    }

    function startListener(docRef) {
        unsubscribeSnapshot = docRef.onSnapshot(docSnap => {
            if (!docSnap.exists) return;
            if (docSnap.metadata.hasPendingWrites) return;

            const cloudData = docSnap.data();
            
            isApplyingRemoteChange = true;
            for (const [key, value] of Object.entries(cloudData)) {
                if (localStorage.getItem(key) !== value) {
                    localStorage.setItem(key, value);
                    const event = new StorageEvent('storage', { key: key, newValue: value });
                    global.dispatchEvent(event);
                }
            }
            isApplyingRemoteChange = false;
        }, error => {
            console.error("Error escuchando Firestore:", error);
        });
    }

    function stopSync() {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
    }

    function pushToCloud(key, value) {
        if (currentUser && db && !isApplyingRemoteChange) {
            const docRef = db.collection('users').doc(currentUser.uid);
            docRef.set({ [key]: value }, { merge: true }).catch(err => {
                console.error("Error sincronizando a la nube:", err);
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
            // Usando FieldValue.delete() si estuviéramos en ES Modules, pero aquí pasamos string vacío o null
            // Ya que Firestore no soporta undefined, usamos un marcador o lo borramos con firebase.firestore.FieldValue.delete()
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
