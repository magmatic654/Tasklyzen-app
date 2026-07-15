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
    const MIN_CONFIRMED_FOCUS_MS = 15 * 60 * 1000;
    const MAX_SESSIONS_PER_DAY = 24;
    const PROGRESS_MODES = ['tasks', 'focus', 'balanced'];

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
        const backgroundMs = safeMs(source.backgroundMs);
        const uncertainMs = safeMs(source.uncertainMs);
        const confirmedAwayMs = safeMs(source.confirmedAwayMs);
        const selectedCount = safeCount(source.selectedCount);
        const closed = source.closed !== false && !['abandoned', 'exited'].includes(source.result);
        const hasConcreteProgress = completedCount > 0 || completedSubtaskCount > 0;
        const allowedOutcomes = ['completed', 'advanced', 'blocked', 'not-worked', 'unconfirmed'];
        const outcome = hasConcreteProgress
            ? 'completed'
            : (allowedOutcomes.includes(source.outcome) ? source.outcome : 'unconfirmed');
        const mostlyAway = confirmedAwayMs > focusMs / 2 && !hasConcreteProgress;
        const integrityValid = !integrityFlags.some(flag => ['clock-skew', 'overlap', 'unresolved-away'].includes(flag));
        const confirmedFocusMs = ['not-worked', 'unconfirmed'].includes(outcome) ? 0 : focusMs;
        const meaningful = integrityValid && !mostlyAway && (
            hasConcreteProgress
            || (outcome === 'advanced' && selectedCount > 0 && focusMs >= MIN_CONFIRMED_FOCUS_MS)
        );
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
            confirmedFocusMs,
            breakMs,
            pausedMs,
            awayMs,
            backgroundMs,
            uncertainMs,
            confirmedAwayMs,
            completedBreaks: safeCount(source.completedBreaks),
            longBreaks: safeCount(source.longBreaks),
            pomodoroEnabled: Boolean(source.pomodoroEnabled),
            targetReached: Boolean(source.targetReached),
            integrityFlags,
            integrityValid,
            closed,
            outcome,
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
        const sessionTaskIds = uniqueStrings(sessions.flatMap(session => session.completedTodoIds));
        const sessionSubtaskKeys = uniqueStrings(sessions.flatMap(session => session.completedSubtaskKeys));
        const meaningfulActions = uniqueStrings(taskIds.concat(sessionTaskIds)).length
            + uniqueStrings(requiredSubtaskKeys.concat(sessionSubtaskKeys)).length;

        return {
            dateKey,
            progressMode: PROGRESS_MODES.includes(source.progressMode) ? source.progressMode : null,
            focusGoalMinutes: Math.min(Math.max(Math.round(Number(source.focusGoalMinutes) || 50), 15), 240),
            taskIds,
            requiredSubtaskKeys,
            sessions,
            progressAuthoritative: Boolean(source.progressAuthoritative),
            recordedFocusMs: sessions.reduce((total, session) => total + session.focusMs, 0),
            focusMs: sessions.reduce((total, session) => total + session.confirmedFocusMs, 0),
            rewardedFocusMs: meaningfulSessions.reduce((total, session) => total + session.confirmedFocusMs, 0),
            breakMs: sessions.reduce((total, session) => total + session.breakMs, 0),
            pausedMs: sessions.reduce((total, session) => total + session.pausedMs, 0),
            awayMs: sessions.reduce((total, session) => total + session.awayMs, 0),
            backgroundMs: sessions.reduce((total, session) => total + session.backgroundMs, 0),
            uncertainMs: sessions.reduce((total, session) => total + session.uncertainMs, 0),
            completedBreaks: sessions.reduce((total, session) => total + session.completedBreaks, 0),
            closedSessions: closedSessions.length,
            intentionalSessions: intentionalSessions.length,
            sustainableSessions: sustainableSessions.length,
            meaningfulSessions: meaningfulSessions.length,
            meaningfulActions,
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
        const getProgressMode = typeof config.getProgressMode === 'function'
            ? config.getProgressMode
            : () => 'tasks';
        const getDailyFocusGoalMinutes = typeof config.getDailyFocusGoalMinutes === 'function'
            ? config.getDailyFocusGoalMinutes
            : () => 50;
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
            const configuredMode = PROGRESS_MODES.includes(getProgressMode()) ? getProgressMode() : 'tasks';
            const isToday = safeDateKey === getTodayKey();
            const progressMode = isToday ? configuredMode : (day.progressMode || 'tasks');
            const configuredFocusGoal = Math.min(Math.max(Math.round(Number(getDailyFocusGoalMinutes()) || 50), 15), 240);
            const focusGoalMinutes = isToday ? configuredFocusGoal : day.focusGoalMinutes;
            const focusGoalMs = focusGoalMinutes * 60 * 1000;
            const taskPercent = Math.min(Math.round((day.meaningfulActions / dailyGoal) * 100), 100);
            const focusPercent = Math.min(Math.round((day.rewardedFocusMs / focusGoalMs) * 100), 100);
            const taskGoalReached = day.meaningfulActions >= dailyGoal;
            const focusGoalReached = day.rewardedFocusMs >= focusGoalMs;
            const creditActive = progressMode === 'focus'
                ? day.rewardedFocusMs >= MIN_CONFIRMED_FOCUS_MS
                : progressMode === 'balanced'
                    ? day.meaningfulActions > 0 || day.rewardedFocusMs >= MIN_CONFIRMED_FOCUS_MS
                    : day.meaningfulActions > 0;
            const goalReached = progressMode === 'focus'
                ? focusGoalReached
                : progressMode === 'balanced'
                    ? taskGoalReached && focusGoalReached
                    : taskGoalReached;
            const goalPercent = progressMode === 'focus'
                ? focusPercent
                : progressMode === 'balanced'
                    ? Math.round((taskPercent + focusPercent) / 2)
                    : taskPercent;

            return {
                ...day,
                recordedActive: day.active,
                active: creditActive,
                recorded: Boolean(stored),
                dailyGoal,
                progressMode,
                focusGoalMinutes,
                focusGoalMs,
                taskPercent,
                focusPercent,
                goalPercent,
                taskGoalReached,
                focusGoalReached,
                goalReached,
                perfect: creditActive && goalReached,
                legendary: creditActive && taskGoalReached && focusGoalReached && day.sustainableSessions > 0
            };
        }

        function updateDay(dateKey, updater) {
            const safeDateKey = isDateKey(dateKey) ? dateKey : getTodayKey();
            const current = normalizeDay(getStoredDay(safeDateKey), safeDateKey);
            const next = typeof updater === 'function' ? updater(current) : current;

            state.days[safeDateKey] = normalizeDay({
                ...next,
                progressMode: PROGRESS_MODES.includes(getProgressMode()) ? getProgressMode() : 'tasks',
                focusGoalMinutes: Math.min(Math.max(Math.round(Number(getDailyFocusGoalMinutes()) || 50), 15), 240),
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
                recordedFocusMs: days.reduce((total, day) => total + day.recordedFocusMs, 0),
                rewardedFocusMs: days.reduce((total, day) => total + day.rewardedFocusMs, 0),
                breakMs: days.reduce((total, day) => total + day.breakMs, 0),
                awayMs: days.reduce((total, day) => total + day.awayMs, 0),
                backgroundMs: days.reduce((total, day) => total + day.backgroundMs, 0),
                sessions: days.reduce((total, day) => total + day.sessions.length, 0),
                meaningfulSessions: days.reduce((total, day) => total + day.meaningfulSessions, 0),
                sustainableSessions: days.reduce((total, day) => total + day.sustainableSessions, 0),
                meaningfulActions: days.reduce((total, day) => total + day.meaningfulActions, 0)
            };
        }

        function getMissionSnapshot(dateKey) {
            const day = getDaySnapshot(dateKey);
            const missionIndex = Math.abs(Math.floor(Date.parse(day.dateKey + 'T00:00:00Z') / 86400000));

            if (day.progressMode === 'focus') {
                const focusTargets = [
                    Math.min(day.focusGoalMinutes, 15),
                    Math.min(day.focusGoalMinutes, 25),
                    day.focusGoalMinutes
                ];
                const targetMinutes = focusTargets[missionIndex % focusTargets.length];
                const currentMinutes = Math.min(Math.floor(day.rewardedFocusMs / 60000), targetMinutes);

                return {
                    id: 'intentional-focus',
                    title: targetMinutes === day.focusGoalMinutes
                        ? 'Completa tu meta de enfoque'
                        : 'Suma ' + targetMinutes + ' min de enfoque',
                    message: 'Confirma ' + targetMinutes + ' min al cerrar Modo Carrera.',
                    target: targetMinutes,
                    current: currentMinutes,
                    statusText: currentMinutes + '/' + targetMinutes + ' min',
                    complete: currentMinutes >= targetMinutes,
                    dateKey: day.dateKey
                };
            }

            if (day.progressMode === 'balanced') {
                const variants = [
                    { taskTarget: 1, focusTarget: 15 },
                    {
                        taskTarget: Math.max(1, Math.ceil(day.dailyGoal / 2)),
                        focusTarget: Math.max(15, Math.ceil(day.focusGoalMinutes / 2 / 5) * 5)
                    },
                    { taskTarget: day.dailyGoal, focusTarget: day.focusGoalMinutes }
                ];
                const variant = variants[missionIndex % variants.length];
                const currentTasks = Math.min(day.meaningfulActions, variant.taskTarget);
                const currentMinutes = Math.min(Math.floor(day.rewardedFocusMs / 60000), variant.focusTarget);
                const taskPart = currentTasks >= variant.taskTarget ? 1 : 0;
                const focusPart = currentMinutes >= variant.focusTarget ? 1 : 0;

                return {
                    id: 'balanced-progress',
                    title: variant.taskTarget === day.dailyGoal && variant.focusTarget === day.focusGoalMinutes
                        ? 'Completa tu meta equilibrada'
                        : variant.taskTarget + ' avance' + (variant.taskTarget === 1 ? '' : 's') + ' + ' + variant.focusTarget + ' min',
                    message: 'Combina avances terminados con tiempo confirmado en Modo Carrera.',
                    target: 2,
                    current: taskPart + focusPart,
                    statusText: currentTasks + '/' + variant.taskTarget + ' avances · '
                        + currentMinutes + '/' + variant.focusTarget + ' min',
                    complete: taskPart + focusPart >= 2,
                    dateKey: day.dateKey
                };
            }

            const halfGoal = Math.max(1, Math.ceil(day.dailyGoal / 2));
            const shortGoal = Math.min(Math.max(day.dailyGoal, 1), 2);
            const missions = [
                {
                    id: 'meaningful-progress',
                    title: 'Completa 1 avance',
                    message: 'Termina una tarea o una subtarea obligatoria.',
                    target: 1
                },
                {
                    id: 'half-task-goal',
                    title: 'Llega a ' + halfGoal + ' avance' + (halfGoal === 1 ? '' : 's'),
                    message: 'Completa la mitad de tu meta de tareas de hoy.',
                    target: halfGoal
                },
                {
                    id: 'task-goal',
                    title: 'Completa tu meta de tareas',
                    message: 'Cierra los ' + day.dailyGoal + ' avances que elegiste para hoy.',
                    target: day.dailyGoal
                },
                {
                    id: 'short-task-run',
                    title: 'Cierra ' + shortGoal + ' avance' + (shortGoal === 1 ? '' : 's'),
                    message: 'Termina ' + shortGoal + ' tarea' + (shortGoal === 1 ? '' : 's') + ' o subtarea' + (shortGoal === 1 ? '' : 's') + '.',
                    target: shortGoal
                }
            ];
            const mission = missions[missionIndex % missions.length];
            const current = Math.min(day.meaningfulActions, mission.target);

            return {
                ...mission,
                current,
                statusText: current + '/' + mission.target + ' avance' + (mission.target === 1 ? '' : 's'),
                complete: current >= mission.target,
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
