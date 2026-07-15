/*
 * Modulo: progreso sostenible
 * Proposito: registrar avance significativo, sesiones coherentes y ritmo saludable.
 * Entradas: tareas, subtareas y resumenes cerrados de Modo Carrera.
 * Salidas: ledger diario, misiones y metricas de constancia.
 * Dependencias: almacenamiento y reloj inyectados por el runtime.
 */
(function exposeTasklyzenSustainableProgress(global) {
    const STORAGE_VERSION = 1;
    const LONG_FOCUS_MS = 50 * 60 * 1000;
    const MIN_HEALTHY_BREAK_MS = 5 * 60 * 1000;
    const MAX_SESSIONS_PER_DAY = 24;

    function isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function uniqueStrings(values) {
        return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String)));
    }

    function safeMs(value) {
        return Math.max(Math.round(Number(value) || 0), 0);
    }

    function safeCount(value) {
        return Math.max(Math.round(Number(value) || 0), 0);
    }

    function isDateKey(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
    }

    function getDateKey(timestamp, fallback) {
        const candidate = String(timestamp || '').slice(0, 10);

        return isDateKey(candidate) ? candidate : fallback;
    }

    function parseTimestamp(value) {
        const parsed = Date.parse(value || '');

        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeSessionSummary(value) {
        const source = isObject(value) ? value : {};
        const integrityFlags = uniqueStrings(source.integrityFlags);
        const completedTodoIds = uniqueStrings(source.completedTodoIds);
        const completedSubtaskKeys = uniqueStrings(source.completedSubtaskKeys);
        const completedCount = Math.max(safeCount(source.completedCount), completedTodoIds.length);
        const completedSubtaskCount = Math.max(safeCount(source.completedSubtaskCount), completedSubtaskKeys.length);
        const focusMs = safeMs(source.focusMs);
        const breakMs = safeMs(source.breakMs);
        const pausedMs = safeMs(source.pausedMs);
        const awayMs = safeMs(source.awayMs);
        const confirmedAwayMs = safeMs(source.confirmedAwayMs);
        const selectedCount = safeCount(source.selectedCount);
        const closed = source.closed !== false && !['abandoned', 'exited'].includes(source.result);
        const hasConcreteProgress = completedCount > 0 || completedSubtaskCount > 0;
        const mostlyAway = confirmedAwayMs > focusMs / 2 && !hasConcreteProgress;
        const integrityValid = !integrityFlags.some(flag => ['clock-skew', 'overlap', 'unresolved-away'].includes(flag));
        const meaningful = integrityValid && !mostlyAway && hasConcreteProgress;
        const breakCompliant = Boolean(source.breakCompliant)
            || focusMs < LONG_FOCUS_MS
            || breakMs >= MIN_HEALTHY_BREAK_MS
            || pausedMs >= MIN_HEALTHY_BREAK_MS;

        return {
            id: String(source.id || ''),
            startedAt: typeof source.startedAt === 'string' ? source.startedAt : null,
            completedAt: typeof source.completedAt === 'string' ? source.completedAt : null,
            mode: source.mode === 'countdown' ? 'countdown' : 'free',
            result: String(source.result || 'manual'),
            selectedCount,
            completedCount,
            completedSubtaskCount,
            completedTodoIds,
            completedSubtaskKeys,
            focusMs,
            breakMs,
            pausedMs,
            awayMs,
            confirmedAwayMs,
            completedBreaks: safeCount(source.completedBreaks),
            longBreaks: safeCount(source.longBreaks),
            pomodoroEnabled: Boolean(source.pomodoroEnabled),
            targetReached: Boolean(source.targetReached),
            integrityFlags,
            integrityValid,
            closed,
            meaningful,
            intentional: meaningful && closed && selectedCount > 0,
            breakCompliant,
            sustainable: meaningful && closed && breakCompliant
        };
    }

    function normalizeDay(value, dateKey) {
        const source = isObject(value) ? value : {};
        const sessionsById = new Map();

        (Array.isArray(source.sessions) ? source.sessions : []).forEach(session => {
            const normalized = normalizeSessionSummary(session);

            if (normalized.id) {
                sessionsById.set(normalized.id, normalized);
            }
        });

        const sessions = Array.from(sessionsById.values()).slice(-MAX_SESSIONS_PER_DAY);
        const taskIds = uniqueStrings(source.taskIds);
        const requiredSubtaskKeys = uniqueStrings(source.requiredSubtaskKeys);
        const meaningfulSessions = sessions.filter(session => session.meaningful);
        const intentionalSessions = sessions.filter(session => session.intentional);
        const sustainableSessions = sessions.filter(session => session.sustainable);
        const closedSessions = sessions.filter(session => session.closed);

        return {
            dateKey,
            taskIds,
            requiredSubtaskKeys,
            sessions,
            progressAuthoritative: Boolean(source.progressAuthoritative),
            focusMs: sessions.reduce((total, session) => total + session.focusMs, 0),
            breakMs: sessions.reduce((total, session) => total + session.breakMs, 0),
            pausedMs: sessions.reduce((total, session) => total + session.pausedMs, 0),
            awayMs: sessions.reduce((total, session) => total + session.awayMs, 0),
            completedBreaks: sessions.reduce((total, session) => total + session.completedBreaks, 0),
            closedSessions: closedSessions.length,
            intentionalSessions: intentionalSessions.length,
            sustainableSessions: sustainableSessions.length,
            meaningfulSessions: meaningfulSessions.length,
            meaningfulActions: taskIds.length + requiredSubtaskKeys.length,
            active: taskIds.length > 0 || requiredSubtaskKeys.length > 0 || meaningfulSessions.length > 0,
            updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : null
        };
    }

    function normalizeProgressState(value) {
        const source = isObject(value) ? value : {};
        const sourceDays = isObject(source.days) ? source.days : {};
        const days = {};

        Object.entries(sourceDays).forEach(([dateKey, day]) => {
            if (isDateKey(dateKey)) {
                days[dateKey] = normalizeDay(day, dateKey);
            }
        });

        return {
            version: STORAGE_VERSION,
            days
        };
    }

    function evaluateSession(record) {
        return normalizeSessionSummary(record);
    }

    function createSustainableProgressController(options) {
        const config = options || {};
        const storage = config.storage || {};
        const storageKey = config.storageKey || 'tasklyzen-sustainable-progress';
        const getNowTimestamp = typeof config.getNowTimestamp === 'function'
            ? config.getNowTimestamp
            : () => new Date().toISOString();
        const getTodayKey = typeof config.getTodayKey === 'function'
            ? config.getTodayKey
            : () => new Date().toISOString().slice(0, 10);
        const getDateKeyFromTimestamp = typeof config.getDateKeyFromTimestamp === 'function'
            ? config.getDateKeyFromTimestamp
            : timestamp => getDateKey(timestamp, getTodayKey());
        const getDailyGoal = typeof config.getDailyGoal === 'function'
            ? config.getDailyGoal
            : () => 3;
        let state = normalizeProgressState(read());

        function read() {
            return typeof storage.readJson === 'function' ? storage.readJson(storageKey, null) : null;
        }

        function save() {
            if (typeof storage.writeJson === 'function') {
                storage.writeJson(storageKey, state);
            }
        }

        function reload() {
            state = normalizeProgressState(read());
            return getSnapshot();
        }

        function getSnapshot() {
            return JSON.parse(JSON.stringify(state));
        }

        function getStoredDay(dateKey) {
            return state.days[dateKey] || null;
        }

        function resolveDateKey(timestamp, fallback) {
            const resolved = getDateKeyFromTimestamp(timestamp);

            return isDateKey(resolved) ? resolved : (fallback || getTodayKey());
        }

        function getDaySnapshot(dateKey) {
            const safeDateKey = isDateKey(dateKey) ? dateKey : getTodayKey();
            const stored = getStoredDay(safeDateKey);
            const day = normalizeDay(stored, safeDateKey);
            const dailyGoal = Math.max(Math.round(Number(getDailyGoal()) || 1), 1);

            return {
                ...day,
                recorded: Boolean(stored),
                dailyGoal,
                perfect: day.active && (day.intentionalSessions > 0 || day.meaningfulActions >= dailyGoal),
                legendary: day.active && day.sustainableSessions > 0 && day.meaningfulActions >= dailyGoal
            };
        }

        function updateDay(dateKey, updater) {
            const safeDateKey = isDateKey(dateKey) ? dateKey : getTodayKey();
            const current = normalizeDay(getStoredDay(safeDateKey), safeDateKey);
            const next = typeof updater === 'function' ? updater(current) : current;

            state.days[safeDateKey] = normalizeDay({
                ...next,
                updatedAt: getNowTimestamp()
            }, safeDateKey);
            save();
            return getDaySnapshot(safeDateKey);
        }

        function recordTaskCompletion(todo, metadata) {
            const meta = metadata || {};
            const todoId = todo && todo.id ? String(todo.id) : String(meta.todoId || '');
            const dateKey = isDateKey(meta.dateKey)
                ? meta.dateKey
                : resolveDateKey(meta.completedAt || (todo && todo.completedAt), getTodayKey());

            if (!todoId) {
                return getDaySnapshot(dateKey);
            }

            return updateDay(dateKey, day => ({
                ...day,
                progressAuthoritative: true,
                taskIds: uniqueStrings(day.taskIds.concat(todoId))
            }));
        }

        function revokeTaskCompletion(todoId, dateKey) {
            const safeDateKey = isDateKey(dateKey) ? dateKey : getTodayKey();

            return updateDay(safeDateKey, day => ({
                ...day,
                progressAuthoritative: true,
                taskIds: day.taskIds.filter(id => id !== String(todoId || '')),
                sessions: day.sessions.map(session => {
                    const completedTodoIds = session.completedTodoIds.filter(id => id !== String(todoId || ''));

                    if (completedTodoIds.length === session.completedTodoIds.length) {
                        return session;
                    }

                    return normalizeSessionSummary({
                        ...session,
                        completedTodoIds,
                        completedCount: Math.max(session.completedCount - 1, completedTodoIds.length)
                    });
                })
            }));
        }

        function recordSubtaskCompletion(todoId, subtaskId, metadata) {
            const meta = metadata || {};
            const key = String(todoId || '') + ':' + String(subtaskId || '');
            const dateKey = isDateKey(meta.dateKey) ? meta.dateKey : resolveDateKey(meta.completedAt, getTodayKey());

            if (!todoId || !subtaskId) {
                return getDaySnapshot(dateKey);
            }

            return updateDay(dateKey, day => ({
                ...day,
                progressAuthoritative: true,
                requiredSubtaskKeys: uniqueStrings(day.requiredSubtaskKeys.concat(key))
            }));
        }

        function revokeSubtaskCompletion(todoId, subtaskId, dateKey) {
            const safeDateKey = isDateKey(dateKey) ? dateKey : getTodayKey();
            const key = String(todoId || '') + ':' + String(subtaskId || '');

            return updateDay(safeDateKey, day => ({
                ...day,
                progressAuthoritative: true,
                requiredSubtaskKeys: day.requiredSubtaskKeys.filter(item => item !== key),
                sessions: day.sessions.map(session => {
                    const completedSubtaskKeys = session.completedSubtaskKeys.filter(item => item !== key);

                    if (completedSubtaskKeys.length === session.completedSubtaskKeys.length) {
                        return session;
                    }

                    return normalizeSessionSummary({
                        ...session,
                        completedSubtaskKeys,
                        completedSubtaskCount: Math.max(session.completedSubtaskCount - 1, completedSubtaskKeys.length)
                    });
                })
            }));
        }

        function overlapsExistingSession(session) {
            const startedAt = parseTimestamp(session.startedAt);
            const completedAt = parseTimestamp(session.completedAt);

            if (startedAt === null || completedAt === null || completedAt < startedAt) {
                return completedAt !== null && startedAt !== null && completedAt < startedAt;
            }

            return Object.values(state.days).some(day => day.sessions.some(existing => {
                if (existing.id === session.id) {
                    return false;
                }

                const existingStart = parseTimestamp(existing.startedAt);
                const existingEnd = parseTimestamp(existing.completedAt);

                return existingStart !== null && existingEnd !== null
                    && startedAt < existingEnd && completedAt > existingStart;
            }));
        }

        function recordSession(record) {
            const source = isObject(record) ? { ...record } : {};
            const flags = uniqueStrings(source.integrityFlags);
            const startedAt = parseTimestamp(source.startedAt);
            const completedAt = parseTimestamp(source.completedAt);

            if (startedAt !== null && completedAt !== null && completedAt < startedAt) {
                flags.push('clock-skew');
            }
            if (overlapsExistingSession(source)) {
                flags.push('overlap');
            }
            if (source.awayUnresolved) {
                flags.push('unresolved-away');
            }

            const session = normalizeSessionSummary({ ...source, integrityFlags: uniqueStrings(flags) });
            const dateKey = resolveDateKey(session.completedAt, getTodayKey());

            return updateDay(dateKey, day => ({
                ...day,
                sessions: day.sessions.filter(item => item.id !== session.id).concat(session)
            }));
        }

        function getDateKeys() {
            return Object.keys(state.days).sort();
        }

        function getRangeSummary(startKey, endKey) {
            const days = getDateKeys()
                .filter(dateKey => (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey))
                .map(getDaySnapshot);

            return {
                days,
                activeDays: days.filter(day => day.active).length,
                focusMs: days.reduce((total, day) => total + day.focusMs, 0),
                breakMs: days.reduce((total, day) => total + day.breakMs, 0),
                awayMs: days.reduce((total, day) => total + day.awayMs, 0),
                sessions: days.reduce((total, day) => total + day.sessions.length, 0),
                meaningfulSessions: days.reduce((total, day) => total + day.meaningfulSessions, 0),
                sustainableSessions: days.reduce((total, day) => total + day.sustainableSessions, 0),
                meaningfulActions: days.reduce((total, day) => total + day.meaningfulActions, 0)
            };
        }

        function getMissionSnapshot(dateKey) {
            const day = getDaySnapshot(dateKey);
            const missionIndex = Math.abs(Math.floor(Date.parse(day.dateKey + 'T00:00:00Z') / 86400000)) % 4;
            const missions = [
                {
                    id: 'meaningful-progress',
                    title: 'Da un paso real',
                    message: 'Completa una tarea o un paso clave con intención.',
                    current: day.active ? 1 : 0
                },
                {
                    id: 'intentional-session',
                    title: 'Sesión con intención',
                    message: 'Cierra una carrera con avance en las tareas elegidas.',
                    current: day.intentionalSessions
                },
                {
                    id: 'sustainable-rhythm',
                    title: 'Cuida tu ritmo',
                    message: 'Avanza en una sesión breve o respeta una pausa si es larga.',
                    current: day.sustainableSessions
                },
                {
                    id: 'conscious-close',
                    title: 'Cierra con intención',
                    message: 'Finaliza una sesión con avance real desde Modo Carrera.',
                    current: day.meaningfulSessions
                }
            ];
            const mission = missions[missionIndex];

            return {
                ...mission,
                target: 1,
                current: Math.min(mission.current, 1),
                complete: mission.current >= 1,
                dateKey: day.dateKey
            };
        }

        function clear() {
            state = normalizeProgressState(null);
            save();
            return getSnapshot();
        }

        function replace(nextState) {
            state = normalizeProgressState(nextState);
            save();
            return getSnapshot();
        }

        return {
            reload,
            save,
            clear,
            replace,
            getSnapshot,
            getDaySnapshot,
            getDateKeys,
            getRangeSummary,
            getMissionSnapshot,
            evaluateSession,
            recordSession,
            recordTaskCompletion,
            revokeTaskCompletion,
            recordSubtaskCompletion,
            revokeSubtaskCompletion
        };
    }

    global.TasklyzenSustainableProgress = {
        constants: {
            storageVersion: STORAGE_VERSION,
            longFocusMs: LONG_FOCUS_MS,
            minimumHealthyBreakMs: MIN_HEALTHY_BREAK_MS
        },
        normalizeSessionSummary,
        normalizeProgressState,
        evaluateSession,
        createSustainableProgressController
    };
})(window);
