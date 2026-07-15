/*
 * Módulo: migración de datos retirados
 * Propósito: limpiar datos heredados sin alterar tareas, historial ni rachas.
 * Entradas: pares de clave/valor serializados del almacenamiento.
 * Salidas: valores saneados y claves retiradas para persistencia local o nube.
 * Dependencias: TasklyzenConfig opcional.
 */
(function exposeTasklyzenDataMigration(global) {
    const retiredStandaloneKeys = new Set([
        'achievements',
        'todo-achievements',
        'todo-achievement-state',
        'tasklyzen-achievements',
        'tasklyzen-achievement-state',
        'tasklyzen-achievement-collection'
    ]);
    const retiredGamificationFields = new Set([
        'achievementStates',
        'featuredAchievements',
        'unseenAchievementIds',
        'unlockedAchievements',
        'achievementHistory',
        'achievementQueue',
        'achievementCelebrations'
    ]);

    function isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function isRetiredField(key) {
        const fieldName = String(key || '');

        return retiredGamificationFields.has(fieldName)
            || /achievement|logro/i.test(fieldName);
    }

    function parseJsonText(rawValue) {
        if (typeof rawValue !== 'string') {
            return { value: null, valid: false };
        }

        try {
            return { value: JSON.parse(rawValue), valid: true };
        } catch (_error) {
            return { value: null, valid: false };
        }
    }

    function stripRetiredFields(value) {
        if (Array.isArray(value)) {
            let changed = false;
            const nextValue = value.map(item => {
                const sanitized = stripRetiredFields(item);
                changed = changed || sanitized.changed;
                return sanitized.value;
            });

            return { value: changed ? nextValue : value, changed };
        }

        if (!isObject(value)) {
            return { value, changed: false };
        }

        let changed = false;
        const nextValue = {};

        Object.entries(value).forEach(([key, item]) => {
            if (isRetiredField(key)) {
                changed = true;
                return;
            }

            const sanitized = stripRetiredFields(item);
            nextValue[key] = sanitized.value;
            changed = changed || sanitized.changed;
        });

        return { value: changed ? nextValue : value, changed };
    }

    function stripRetiredGamificationFields(value) {
        return stripRetiredFields(value);
    }

    function sanitizeGamificationText(rawValue) {
        const parsed = parseJsonText(rawValue);

        if (!parsed.valid) {
            return { value: rawValue, changed: false };
        }

        const sanitized = stripRetiredGamificationFields(parsed.value);

        return {
            value: sanitized.changed ? JSON.stringify(sanitized.value) : rawValue,
            changed: sanitized.changed
        };
    }

    function sanitizeAnalyticsEventsText(rawValue) {
        const parsed = parseJsonText(rawValue);

        if (!parsed.valid || !Array.isArray(parsed.value)) {
            return { value: rawValue, changed: false };
        }

        let changed = false;
        const nextEvents = parsed.value.reduce((events, event) => {
            const type = event && typeof event.type === 'string' ? event.type : '';

            if (/achievement|logro/i.test(type)) {
                changed = true;
                return events;
            }

            const sanitized = stripRetiredFields(event);
            changed = changed || sanitized.changed;
            events.push(sanitized.value);
            return events;
        }, []);

        return {
            value: changed ? JSON.stringify(nextEvents) : rawValue,
            changed
        };
    }

    function sanitizeDailyStatsText(rawValue) {
        const parsed = parseJsonText(rawValue);

        if (!parsed.valid || !isObject(parsed.value)) {
            return { value: rawValue, changed: false };
        }

        const sanitized = stripRetiredFields(parsed.value);

        return {
            value: sanitized.changed ? JSON.stringify(sanitized.value) : rawValue,
            changed: sanitized.changed
        };
    }

    function sanitizeDeveloperSnapshotText(rawValue) {
        const parsed = parseJsonText(rawValue);

        if (!parsed.valid || !isObject(parsed.value)) {
            return { value: rawValue, changed: false };
        }

        const sanitized = stripRetiredFields(parsed.value);

        if (!sanitized.changed) {
            return { value: rawValue, changed: false };
        }

        return { value: JSON.stringify(sanitized.value), changed: true };
    }

    function sanitizeProgressViewText(rawValue) {
        return /achievement|logro/i.test(String(rawValue || ''))
            ? { value: 'today', changed: true }
            : { value: rawValue, changed: false };
    }

    function getStorageKeys() {
        return global.TasklyzenConfig && global.TasklyzenConfig.storageKeys
            ? global.TasklyzenConfig.storageKeys
            : {};
    }

    function sanitizeStorageEntry(key, rawValue) {
        const keys = getStorageKeys();

        if (retiredStandaloneKeys.has(String(key || '').toLowerCase())) {
            return { value: null, changed: true, remove: true };
        }

        if (key === keys.gamification) {
            return { ...sanitizeGamificationText(rawValue), remove: false };
        }

        if (key === keys.analyticsEvents) {
            return { ...sanitizeAnalyticsEventsText(rawValue), remove: false };
        }

        if (key === keys.dailyStats) {
            return { ...sanitizeDailyStatsText(rawValue), remove: false };
        }

        if (key === keys.developerSnapshot) {
            return { ...sanitizeDeveloperSnapshotText(rawValue), remove: false };
        }

        if (key === keys.progressView) {
            return { ...sanitizeProgressViewText(rawValue), remove: false };
        }

        return { value: rawValue, changed: false, remove: false };
    }

    global.TasklyzenDataMigration = {
        retiredStandaloneKeys: () => Array.from(retiredStandaloneKeys),
        sanitizeStorageEntry,
        stripRetiredFields,
        stripRetiredGamificationFields
    };
})(window);
