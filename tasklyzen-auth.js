/*
 * Módulo: autenticación y conexión a Firebase
 * Propósito:
 * - Inicializar Firebase App, Auth y Firestore.
 * - Manejar inicio y cierre de sesión con Google.
 * - Proveer el estado del usuario a los demás módulos (especialmente Storage).
 */
(function exposeTasklyzenAuth(global) {
    // IMPORTANTE: Reemplaza estos valores con la configuración real de tu proyecto en Firebase
    const firebaseConfig = {
        apiKey: "REPLACE_WITH_YOUR_API_KEY",
        authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
        storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
        appId: "REPLACE_WITH_YOUR_APP_ID"
    };

    let auth = null;
    let provider = null;
    let db = null;
    let currentUser = null;
    let authStateListeners = [];
    
    // Solo intentar inicializar si el SDK de Firebase fue cargado
    if (global.firebase) {
        if (!global.firebase.apps.length) {
            global.firebase.initializeApp(firebaseConfig);
        }
        auth = global.firebase.auth();
        provider = new global.firebase.auth.GoogleAuthProvider();
        db = global.firebase.firestore();

        auth.onAuthStateChanged(user => {
            currentUser = user;
            authStateListeners.forEach(listener => listener(user));
            
            // Notificamos a Storage que el estado de autenticación cambió
            if (global.TasklyzenStorage && global.TasklyzenStorage.onAuthChange) {
                global.TasklyzenStorage.onAuthChange(user, db);
            }
        });
    } else {
        console.warn("SDK de Firebase no encontrado. Asegúrate de cargarlo en el HTML.");
    }

    function signIn() {
        if (!auth) return Promise.reject(new Error("Firebase no inicializado"));
        return auth.signInWithPopup(provider).catch(error => {
            console.error("Error al iniciar sesión con Google:", error);
            if (global.TasklyzenRuntime && global.TasklyzenRuntime.developerController) {
                global.TasklyzenRuntime.developerController.showToast("Error al iniciar sesión", "error");
            }
        });
    }

    function signOut() {
        if (!auth) return Promise.reject(new Error("Firebase no inicializado"));
        return auth.signOut().catch(error => {
            console.error("Error al cerrar sesión:", error);
        });
    }

    function onAuthStateChanged(listener) {
        authStateListeners.push(listener);
        if (currentUser !== undefined) {
            listener(currentUser);
        }
    }

    global.TasklyzenAuth = {
        signIn,
        signOut,
        onAuthStateChanged,
        get currentUser() { return currentUser; },
        get db() { return db; }
    };

    // UI Logic
    document.addEventListener('DOMContentLoaded', () => {
        const authButton = document.getElementById('auth-button');
        if (authButton) {
            onAuthStateChanged(user => {
                if (user) {
                    authButton.textContent = "Cerrar Sesión (" + user.displayName + ")";
                } else {
                    authButton.textContent = "Iniciar Sesión (Google)";
                }
            });

            authButton.addEventListener('click', () => {
                if (currentUser) {
                    signOut();
                } else {
                    signIn();
                }
            });
        }
    });
})(window);
