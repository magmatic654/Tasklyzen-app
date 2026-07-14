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
        
        // Sincronización inicial local -> nube si la nube está vacía o unimos, 
        // pero por simplicidad de la arquitectura actual, priorizamos la nube si tiene datos,
        // o subimos los locales si la nube está vacía.
        
        docRef.get().then(docSnap => {
            if (!docSnap.exists) {
                // Subir todo el estado local actual a la nube en la primera conexión
                const allLocalData = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    // Filtramos claves propias de tasklyzen (opcionalmente)
                    allLocalData[k] = localStorage.getItem(k);
                }
                docRef.set(allLocalData, { merge: true }).catch(console.error);
            }
        }).catch(console.error);

        // Escuchar cambios desde la nube
        unsubscribeSnapshot = docRef.onSnapshot(docSnap => {
            if (!docSnap.exists) return;
            
            // Si fuimos nosotros mismos los que hicimos el cambio localmente, Firestore nos avisa,
            // pero el flag hasPendingWrites indica que es un cambio local subiendo. Ignoramos para evitar loops.
            if (docSnap.metadata.hasPendingWrites) return;

            const cloudData = docSnap.data();
            let hasChanges = false;
            
            isApplyingRemoteChange = true;
            
            for (const [key, value] of Object.entries(cloudData)) {
                if (localStorage.getItem(key) !== value) {
                    localStorage.setItem(key, value);
                    hasChanges = true;
                    // Disparar evento para que main.js lo atrape
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
