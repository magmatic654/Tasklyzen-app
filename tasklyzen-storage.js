/*
 * Módulo: persistencia local
 * Propósito:
 * - Encapsular localStorage y sincronización externa.
 * Entradas:
 * - Claves de almacenamiento y valores serializables.
 * Salidas:
 * - window.TasklyzenStorage con lectura, escritura y suscripción.
 * Dependencias:
 * - Ninguna.
 */
(function exposeTasklyzenStorage(global) {
    function readJson(key, fallback) {
        try {
            const value = localStorage.getItem(key);

            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function readText(key, fallback) {
        const value = localStorage.getItem(key);

        return value === null ? fallback : value;
    }

    function writeText(key, value) {
        localStorage.setItem(key, String(value));
    }

    function remove(key) {
        localStorage.removeItem(key);
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
        subscribe
    };
})(window);
