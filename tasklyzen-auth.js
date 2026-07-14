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
        apiKey: "AIzaSyC5NF5Z_lxbhTfKyHnSzfaqvEKsFG489OI",
        authDomain: "tasklyzen-app.firebaseapp.com",
        projectId: "tasklyzen-app",
        storageBucket: "tasklyzen-app.firebasestorage.app",
        messagingSenderId: "918293539965",
        appId: "1:918293539965:web:ff13d058cb5c9f9bf55514",
        measurementId: "G-W5CHSH82BK"
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
        const onboardingLoginBtn = document.getElementById('onboarding-login-btn');
        const settingsAuthBtn = document.getElementById('settings-auth-button');
        
        onAuthStateChanged(user => {
            if (settingsAuthBtn) {
                if (user) {
                    settingsAuthBtn.innerHTML = `Cerrar Sesión (${user.displayName.split(' ')[0]})`;
                    settingsAuthBtn.style.color = 'var(--text-primary)';
                } else {
                    settingsAuthBtn.innerHTML = `
                    <svg class="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                    Iniciar Sesión`;
                    settingsAuthBtn.style.color = '#3c4043';
                }
            }
        });

        const handleAuthClick = () => {
            if (currentUser) {
                signOut();
            } else {
                signIn().then(() => {
                    const overlay = document.getElementById('onboarding-overlay');
                    if (overlay && !overlay.hidden) {
                        localStorage.setItem('tasklyzen-login-strategy', 'google');
                        overlay.style.opacity = '0';
                        setTimeout(() => {
                            overlay.hidden = true;
                            if (window.__TLZ_startApp) window.__TLZ_startApp();
                        }, 300);
                    }
                });
            }
        };

        if (onboardingLoginBtn) {
            onboardingLoginBtn.addEventListener('click', handleAuthClick);
        }
        
        if (settingsAuthBtn) {
            settingsAuthBtn.addEventListener('click', handleAuthClick);
        }
    });
})(window);
