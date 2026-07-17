/*
 * Modulo: features locales
 * Proposito:
 * - Registrar funcionalidades futuras sin mezclar su ciclo de vida en main.js.
 * Entradas:
 * - Storage local, definiciones explicitas y contexto inyectado por el runtime.
 * Salidas:
 * - window.TasklyzenFeatures con catalogo local y createFeatureRegistry.
 * Dependencias:
 * - Ninguna directa; no usa servicios externos.
 */
(function exposeTasklyzenFeatures(global) {
    const FEATURE_STORAGE_VERSION = 1;

    const plannedLocalFeatures = [
        {
            id: 'focus-mode',
            label: 'Modo Carrera',
            description: 'Muestra un acceso en la app para cronometrar tus tareas una por una. Los hitos se completan al cerrar sus pasos obligatorios.',
            defaultEnabled: true,
            defaultState: {
                active: false,
                suspended: false,
                selectedTodoId: null,
                status: 'idle',
                startedAt: null,
                pausedAt: null,
                accumulatedMs: 0,
                focusSubtaskDraft: null,
                mode: 'free',
                targetMs: 0,
                sessionCreatedAt: null,
                sessionId: null,
                sessionStartedAt: null,
                sessionAccumulatedMs: 0,
                sessionPausedMs: 0,
                sessionAwayMs: 0,
                sessionConfirmedAwayMs: 0,
                sessionAwayStartedAt: null,
                sessionAwayWasRunning: false,
                sessionBackgroundMs: 0,
                sessionBackgroundStartedAt: null,
                sessionCompletedTodoIds: [],
                sessionCompletedSubtaskKeys: [],
                sessionTodoSnapshot: [],
                sessionVisitedTodoIds: [],
                sessionTodoIds: [],
                taskElapsedMsById: {},
                pomodoroEnabled: false,
                pomodoroWorkMs: 25 * 60 * 1000,
                pomodoroBreakMs: 5 * 60 * 1000,
                pomodoroPhase: 'work',
                pomodoroPhaseStartedAt: null,
                pomodoroPhaseAccumulatedMs: 0,
                pomodoroPhaseTargetMs: 25 * 60 * 1000,
                pomodoroCompletedCycles: 0,
                pomodoroTargetCycles: 0,
                sessionCompletionCuePlayed: false,
                history: []
            }
        }
    ];

    function noop() {}

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function cloneData(value) {
        if (!isPlainObject(value) && !Array.isArray(value)) {
            return value;
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return Array.isArray(value) ? value.slice() : { ...value };
        }
    }

    function fn(value, fallback) {
        return typeof value === 'function' ? value : fallback;
    }

    function getSafeNowTimestamp() {
        return new Date().toISOString();
    }

    function createFocusBetaController(options) {
        const config = options || {};
        const registry = config.registry;
        const documentRef = config.documentRef || global.document;
        const windowRef = config.windowRef || global;
        const featureId = config.focusFeatureId || 'focus-mode';
        const alwaysEnabled = Boolean(config.alwaysEnabled);
        const getTodos = fn(config.getTodos, () => []);
        const getTopPriorityTodo = fn(config.getTopPriorityTodo, () => null);
        const getNowTimestamp = fn(config.getNowTimestamp, getSafeNowTimestamp);
        const onCompleteTodo = fn(config.onCompleteTodo, () => false);
        const onToggleSubtask = fn(config.onToggleSubtask, () => false);
        const onSessionComplete = fn(config.onSessionComplete, noop);
        const evaluateSession = fn(config.evaluateSession, record => record);
        const onStateChange = fn(config.onStateChange, noop);
        const onTimerCue = fn(config.onTimerCue, noop);
        const onResumePromptClosed = fn(config.onResumePromptClosed, noop);
        const unlockAudio = fn(config.unlockAudio, noop);
        const shouldRunInBackground = fn(config.shouldRunInBackground, () => true);
        const analyticsDom = config.analyticsDom || {};
        let shell = null;
        let setupShell = null;
        let resumeShell = null;
        let summaryShell = null;
        let timer = null;
        const liveSessionIds = new Set();

        const MAX_SESSION_HISTORY = 80;
        const COUNTDOWN_PRESETS = [10, 25, 45];
        const POMODORO_PRESETS = [
            { work: 25, rest: 5 },
            { work: 50, rest: 10 }
        ];
        const POMODORO_LONG_BREAK_MS = 20 * 60 * 1000;
        const POMODORO_SHORT_SESSION_MAX_CYCLES = 8;
        const POMODORO_LONG_SESSION_MAX_CYCLES = 4;
        let sessionEnding = false;
        let taskMutationInProgress = false;

        function isEnabled() {
            return alwaysEnabled || Boolean(registry && registry.isEnabled(featureId));
        }

        function getState() {
            return registry && typeof registry.getFeatureState === 'function'
                ? registry.getFeatureState(featureId)
                : {};
        }

        function updateState(patch, updateOptions) {
            const nextState = registry && typeof registry.updateFeatureState === 'function'
                ? registry.updateFeatureState(featureId, patch, updateOptions || { notify: false })
                : {};

            onStateChange(nextState);
            return nextState;
        }

        function runTaskMutation(callback) {
            taskMutationInProgress = true;

            try {
                return callback();
            } finally {
                taskMutationInProgress = false;
            }
        }

        function getNowMs() {
            const parsed = Date.parse(getNowTimestamp());

            return Number.isFinite(parsed) ? parsed : Date.now();
        }

        function parseMs(timestamp) {
            const parsed = Date.parse(timestamp || '');

            return Number.isFinite(parsed) ? parsed : null;
        }

        function getCurrentPauseMs(state) {
            const stored = Math.max(Number(state && state.sessionPausedMs) || 0, 0);
            const pausedAt = parseMs(state && state.pausedAt);

            if (!state || state.status !== 'paused' || state.sessionAwayStartedAt || pausedAt === null) {
                return stored;
            }

            return stored + Math.max(getNowMs() - pausedAt, 0);
        }

        function getCurrentAwayMs(state) {
            const stored = Math.max(Number(state && state.sessionAwayMs) || 0, 0);
            const awayStartedAt = parseMs(state && state.sessionAwayStartedAt);

            return awayStartedAt === null ? stored : stored + Math.max(getNowMs() - awayStartedAt, 0);
        }

        function getCurrentBackgroundMs(state) {
            const stored = Math.max(Number(state && state.sessionBackgroundMs) || 0, 0);
            const backgroundStartedAt = parseMs(state && state.sessionBackgroundStartedAt);

            return backgroundStartedAt === null
                ? stored
                : stored + Math.max(getNowMs() - backgroundStartedAt, 0);
        }

        function getPendingTodos() {
            return getTodos().filter(todo => todo && !todo.completed);
        }

        function getSessionTodoIds(state) {
            return Array.isArray(state && state.sessionTodoIds)
                ? Array.from(new Set(state.sessionTodoIds.filter(Boolean)))
                : [];
        }

        function getActiveTodos() {
            const pendingTodos = getPendingTodos();
            const state = getState();
            const sessionTodoIds = state && state.active ? getSessionTodoIds(state) : [];

            return sessionTodoIds.length
                ? pendingTodos.filter(todo => sessionTodoIds.includes(todo.id))
                : pendingTodos;
        }

        function getSelectedTodo(state) {
            const todos = getActiveTodos();
            const selected = todos.find(todo => todo && todo.id === state.selectedTodoId);
            const topPriorityTodo = getTopPriorityTodo();
            const priorityTodo = topPriorityTodo
                ? todos.find(todo => todo.id === topPriorityTodo.id)
                : null;

            return selected || priorityTodo || todos[0] || null;
        }

        function getTodoPosition(todo) {
            const todos = getActiveTodos();
            const index = todo ? todos.findIndex(item => item.id === todo.id) : -1;

            return {
                current: index >= 0 ? index + 1 : 0,
                total: todos.length
            };
        }

        function getSubtasks(todo) {
            return Array.isArray(todo && todo.subtasks) ? todo.subtasks : [];
        }

        function isCompositeTodo(todo) {
            return Boolean(todo && todo.type === 'composite' && getSubtasks(todo).length > 0);
        }

        function getRequiredSubtasks(todo) {
            return getSubtasks(todo).filter(subtask => !subtask.optional);
        }

        function getFocusSubtaskDraft(state, todo) {
            const draft = state && state.focusSubtaskDraft;

            return draft && todo && draft.todoId === todo.id && isPlainObject(draft.completions)
                ? draft.completions
                : null;
        }

        function getFocusSubtaskOrder(todo, state) {
            const draft = state && state.focusSubtaskDraft;
            const currentIds = getSubtasks(todo).map(subtask => subtask.id);

            if (!draft || !todo || draft.todoId !== todo.id || !Array.isArray(draft.order)) {
                return currentIds;
            }

            const savedIds = draft.order.filter(id => currentIds.includes(id));
            const newIds = currentIds.filter(id => !savedIds.includes(id));

            return savedIds.concat(newIds);
        }

        function getFocusSubtaskMap(todo, state) {
            const map = {};
            const draft = getFocusSubtaskDraft(state, todo);

            getSubtasks(todo).forEach(subtask => {
                map[subtask.id] = typeof draft?.[subtask.id] === 'boolean'
                    ? draft[subtask.id]
                    : Boolean(subtask.completed);
            });

            return map;
        }

        function isSubtaskCompleteInFocus(todo, subtask, state) {
            return Boolean(getFocusSubtaskMap(todo, state)[subtask.id]);
        }

        function getIncompleteRequiredSubtasks(todo, state) {
            return getRequiredSubtasks(todo).filter(subtask => !isSubtaskCompleteInFocus(todo, subtask, state));
        }

        function getRequiredProgress(todo, state) {
            const required = getRequiredSubtasks(todo);

            return {
                completed: required.filter(subtask => isSubtaskCompleteInFocus(todo, subtask, state)).length,
                total: required.length
            };
        }

        function getChangedSubtasks(todo, state) {
            const map = getFocusSubtaskMap(todo, state);

            return getSubtasks(todo).filter(subtask => Boolean(subtask.completed) !== Boolean(map[subtask.id]));
        }

        function hasSubtaskDraftChanges(todo, state) {
            return getChangedSubtasks(todo, state).length > 0;
        }

        function getElapsedMs(state) {
            const accumulated = Math.max(Number(state.accumulatedMs) || 0, 0);
            const startedMs = parseMs(state.startedAt);

            if (state.status !== 'running' || !startedMs) {
                return accumulated;
            }

            return accumulated + Math.max(getNowMs() - startedMs, 0);
        }

        function getSessionElapsedMs(state) {
            const accumulated = Math.max(Number(state.sessionAccumulatedMs) || 0, 0);
            const startedMs = parseMs(state.sessionStartedAt);

            if (state.status !== 'running' || !startedMs) {
                return accumulated;
            }

            return accumulated + Math.max(getNowMs() - startedMs, 0);
        }

        function normalizeRaceMode(value) {
            return value === 'countdown' ? 'countdown' : 'free';
        }

        function normalizeTargetMs(value) {
            const parsed = Math.round(Number(value) || 0);

            return Math.min(Math.max(parsed, 0), 8 * 60 * 60 * 1000);
        }

        function normalizePomodoroMs(value, fallback, minimumMinutes, maximumMinutes) {
            const fallbackMs = Math.max(Number(fallback) || 0, 0);
            const parsed = Math.round(Number(value) || fallbackMs);
            const minimum = Math.max(Number(minimumMinutes) || 1, 1) * 60 * 1000;
            const maximum = Math.max(Number(maximumMinutes) || 120, minimumMinutes || 1) * 60 * 1000;

            return Math.min(Math.max(parsed, minimum), maximum);
        }

        function getPomodoroConfig(state) {
            return {
                enabled: Boolean(state && state.pomodoroEnabled),
                workMs: normalizePomodoroMs(state && state.pomodoroWorkMs, 25 * 60 * 1000, 5, 120),
                breakMs: normalizePomodoroMs(state && state.pomodoroBreakMs, 5 * 60 * 1000, 1, 30)
            };
        }

        function normalizePomodoroPhaseTargetMs(value, fallback) {
            const parsed = Math.round(Number(value) || Number(fallback) || 0);

            return Math.min(Math.max(parsed, 1000), 120 * 60 * 1000);
        }

        function getPomodoroPhaseElapsedMs(state) {
            const accumulated = Math.max(Number(state && state.pomodoroPhaseAccumulatedMs) || 0, 0);
            const startedMs = parseMs(state && state.pomodoroPhaseStartedAt);

            if (!state || state.status !== 'running' || state.suspended || !startedMs) {
                return accumulated;
            }

            return accumulated + Math.max(getNowMs() - startedMs, 0);
        }

        function getPomodoroPhaseTargetMs(state) {
            const pomodoro = getPomodoroConfig(state);
            const fallback = state && state.pomodoroPhase === 'break'
                ? getPomodoroBreakTargetMs(pomodoro.workMs, pomodoro.breakMs, state.pomodoroCompletedCycles)
                : pomodoro.workMs;

            return normalizePomodoroPhaseTargetMs(state && state.pomodoroPhaseTargetMs, fallback);
        }

        function getInitialPomodoroTargetMs(mode, targetMs, workMs) {
            return mode === 'countdown' && targetMs
                ? Math.min(workMs, targetMs)
                : workMs;
        }

        function getPomodoroPresentation(state) {
            const pomodoro = getPomodoroConfig(state);

            if (!pomodoro.enabled) {
                return { enabled: false };
            }

            const timerPresentation = getTimerPresentation(state);
            const phase = state && state.pomodoroPhase === 'break' ? 'break' : 'work';
            const targetMs = getPomodoroPhaseTargetMs(state);
            const elapsedMs = getPomodoroPhaseElapsedMs(state);
            const longBreak = phase === 'break' && targetMs > pomodoro.breakMs;
            const completedCycles = Math.max(Number(state && state.pomodoroCompletedCycles) || 0, 0);
            const countdownFinished = timerPresentation.mode === 'countdown'
                && timerPresentation.targetMs > 0
                && timerPresentation.remainingMs <= 0;

            return {
                enabled: true,
                phase,
                longBreak,
                label: countdownFinished
                    ? 'Carrera cumplida'
                    : (phase === 'break' ? (longBreak ? 'Descanso largo' : 'Descanso') : 'Enfoque'),
                remainingMs: countdownFinished ? 0 : Math.max(targetMs - elapsedMs, 0),
                targetMs,
                progress: targetMs ? Math.min(Math.max(elapsedMs / targetMs, 0), 1) : 0,
                cycle: phase === 'break' ? Math.max(completedCycles, 1) : completedCycles + 1,
                finished: countdownFinished
            };
        }

        function syncPomodoroPhase() {
            let state = getState();
            const pomodoro = getPomodoroConfig(state);

            if (!pomodoro.enabled || state.status !== 'running' || state.suspended) {
                return state;
            }

            const timerPresentation = getTimerPresentation(state);

            if (timerPresentation.mode === 'countdown' && timerPresentation.remainingMs <= 0) {
                return state;
            }

            let phase = state.pomodoroPhase === 'break' ? 'break' : 'work';
            let phaseElapsedMs = getPomodoroPhaseElapsedMs(state);
            let phaseTargetMs = getPomodoroPhaseTargetMs(state);
            let completedCycles = Math.max(Number(state.pomodoroCompletedCycles) || 0, 0);
            let transitions = 0;

            while (phaseTargetMs > 0 && phaseElapsedMs >= phaseTargetMs && transitions < 200) {
                phaseElapsedMs -= phaseTargetMs;

                if (phase === 'work') {
                    completedCycles += 1;
                    phase = 'break';
                } else {
                    phase = 'work';
                }
                transitions += 1;

                const remainingAtTransition = timerPresentation.mode === 'countdown'
                    ? Math.max(timerPresentation.targetMs - (timerPresentation.sessionElapsedMs - phaseElapsedMs), 0)
                    : Number.POSITIVE_INFINITY;

                if (remainingAtTransition <= 0) {
                    break;
                }

                const preferredTarget = phase === 'break'
                    ? getPomodoroBreakTargetMs(pomodoro.workMs, pomodoro.breakMs, completedCycles)
                    : pomodoro.workMs;
                phaseTargetMs = timerPresentation.mode === 'countdown'
                    ? Math.min(preferredTarget, remainingAtTransition)
                    : preferredTarget;
            }

            if (transitions === 0) {
                return state;
            }

            state = updateState({
                pomodoroPhase: phase,
                pomodoroPhaseStartedAt: new Date(getNowMs() - phaseElapsedMs).toISOString(),
                pomodoroPhaseAccumulatedMs: 0,
                pomodoroPhaseTargetMs: phaseTargetMs,
                pomodoroCompletedCycles: completedCycles
            }, { notify: false });

            onTimerCue(phase === 'break' ? 'break-start' : 'focus-start', {
                phase,
                completedCycles
            });

            return state;
        }

        function getSessionHistory(state) {
            return Array.isArray(state && state.history)
                ? state.history.filter(entry => isPlainObject(entry)).slice(0, MAX_SESSION_HISTORY)
                : [];
        }

        function getCompletedTodoIds(state) {
            return Array.isArray(state && state.sessionCompletedTodoIds)
                ? Array.from(new Set(state.sessionCompletedTodoIds.filter(Boolean)))
                : [];
        }

        function getCompletedSubtaskKeys(state) {
            return Array.isArray(state && state.sessionCompletedSubtaskKeys)
                ? Array.from(new Set(state.sessionCompletedSubtaskKeys.filter(Boolean)))
                : [];
        }

        function getTaskElapsedMap(state) {
            return isPlainObject(state && state.taskElapsedMsById)
                ? { ...state.taskElapsedMsById }
                : {};
        }

        function getVisitedTodoIds(state) {
            return Array.isArray(state && state.sessionVisitedTodoIds)
                ? Array.from(new Set(state.sessionVisitedTodoIds.filter(Boolean)))
                : [];
        }

        function captureRunningClocks(state) {
            const now = getNowTimestamp();
            const running = state.status === 'running' && !state.suspended;
            const taskElapsedMs = getElapsedMs(state);
            const taskElapsedMsById = getTaskElapsedMap(state);

            if (state.selectedTodoId) {
                taskElapsedMsById[state.selectedTodoId] = taskElapsedMs;
            }

            return {
                now,
                running,
                taskElapsedMs,
                taskElapsedMsById,
                sessionElapsedMs: getSessionElapsedMs(state),
                pomodoroPhaseElapsedMs: getPomodoroPhaseElapsedMs(state)
            };
        }

        function getSessionTodoSnapshot(state) {
            return Array.isArray(state && state.sessionTodoSnapshot)
                ? state.sessionTodoSnapshot.filter(item => isPlainObject(item) && item.id)
                : [];
        }

        function createSessionTodoSnapshot(todoIds) {
            const requestedIds = Array.isArray(todoIds) ? todoIds : [];

            return getTodos().filter(todo => todo && (!requestedIds.length || requestedIds.includes(todo.id))).map(todo => ({
                id: todo.id,
                title: String(todo.text || 'Tarea sin título'),
                type: todo.type === 'composite' ? 'hito' : 'tarea'
            }));
        }

        function getPomodoroCyclePolicy(workMs) {
            const longFormat = Math.max(Number(workMs) || 0, 0) >= 45 * 60 * 1000;

            return {
                maxCycles: longFormat ? POMODORO_LONG_SESSION_MAX_CYCLES : POMODORO_SHORT_SESSION_MAX_CYCLES,
                longBreakEvery: longFormat ? 2 : 4,
                longBreakMs: POMODORO_LONG_BREAK_MS
            };
        }

        function normalizePomodoroCycles(value, workMs) {
            const policy = getPomodoroCyclePolicy(workMs);

            return Math.min(
                Math.max(Math.round(Number(value) || 1), 1),
                policy.maxCycles
            );
        }

        function getPomodoroBreakTargetMs(workMs, breakMs, completedCycles) {
            const policy = getPomodoroCyclePolicy(workMs);
            const completed = Math.max(Math.round(Number(completedCycles) || 0), 0);

            return completed > 0 && completed % policy.longBreakEvery === 0
                ? policy.longBreakMs
                : Math.max(Number(breakMs) || 0, 0);
        }

        function getPomodoroSchedule(workMs, breakMs, cycles) {
            const safeWorkMs = Math.max(Number(workMs) || 0, 0);
            const safeBreakMs = Math.max(Number(breakMs) || 0, 0);
            const safeCycles = normalizePomodoroCycles(cycles, safeWorkMs);
            const policy = getPomodoroCyclePolicy(safeWorkMs);
            let shortBreaks = 0;
            let longBreaks = 0;

            for (let completedCycle = 1; completedCycle < safeCycles; completedCycle += 1) {
                if (completedCycle % policy.longBreakEvery === 0) {
                    longBreaks += 1;
                } else {
                    shortBreaks += 1;
                }
            }

            const focusMs = safeCycles * safeWorkMs;
            const breakTotalMs = (shortBreaks * safeBreakMs) + (longBreaks * policy.longBreakMs);

            return {
                cycles: safeCycles,
                maxCycles: policy.maxCycles,
                longBreakEvery: policy.longBreakEvery,
                shortBreaks,
                longBreaks,
                focusMs,
                breakTotalMs,
                totalMs: focusMs + breakTotalMs
            };
        }

        function getPomodoroSessionTargetMs(workMs, breakMs, cycles) {
            return getPomodoroSchedule(workMs, breakMs, cycles).totalMs;
        }

        function getSessionTimeBreakdown(state, sessionElapsedMs) {
            const totalMs = Math.max(Number(sessionElapsedMs) || 0, 0);
            const pomodoro = getPomodoroConfig(state);

            if (!pomodoro.enabled) {
                return {
                    focusMs: totalMs,
                    breakMs: 0,
                    completedBreaks: 0,
                    longBreaks: 0
                };
            }

            const completedCycles = Math.max(Math.round(Number(state.pomodoroCompletedCycles) || 0), 0);
            const phase = state.pomodoroPhase === 'break' ? 'break' : 'work';
            const phaseElapsedMs = Math.min(getPomodoroPhaseElapsedMs(state), totalMs);
            const completedFocusMs = completedCycles * pomodoro.workMs;
            const focusMs = Math.min(
                phase === 'work' ? completedFocusMs + phaseElapsedMs : completedFocusMs,
                totalMs
            );
            const completedBreaks = Math.max(phase === 'work' ? completedCycles : completedCycles - 1, 0);
            const policy = getPomodoroCyclePolicy(pomodoro.workMs);

            return {
                focusMs,
                breakMs: Math.max(totalMs - focusMs, 0),
                completedBreaks,
                longBreaks: Math.floor(completedBreaks / policy.longBreakEvery)
            };
        }

        function formatElapsed(ms) {
            const totalSeconds = Math.floor(Math.max(Number(ms) || 0, 0) / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            return (hours > 0 ? String(hours).padStart(2, '0') + ':' : '')
                + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }

        function formatDuration(ms) {
            const totalMinutes = Math.max(Math.round((Number(ms) || 0) / 60000), 0);

            if (totalMinutes < 60) {
                return totalMinutes + ' min';
            }

            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            return hours + ' h' + (minutes ? ' ' + minutes + ' min' : '');
        }

        function getTimerPresentation(state) {
            const taskElapsedMs = getElapsedMs(state);
            const sessionElapsedMs = getSessionElapsedMs(state);
            const mode = normalizeRaceMode(state.mode);
            const targetMs = mode === 'countdown' ? normalizeTargetMs(state.targetMs) : 0;
            const remainingMs = targetMs ? Math.max(targetMs - sessionElapsedMs, 0) : 0;
            const progress = targetMs
                ? Math.min(Math.max(sessionElapsedMs / targetMs, 0), 1)
                : (Math.floor(sessionElapsedMs / 1000) % 60) / 60;

            return {
                mode,
                targetMs,
                taskElapsedMs,
                sessionElapsedMs,
                remainingMs,
                progress,
                primaryLabel: targetMs ? 'Tiempo restante de sesión' : 'Tiempo de sesión',
                primaryValue: formatElapsed(targetMs ? remainingMs : sessionElapsedMs)
            };
        }

        function stopTimer() {
            if (timer) {
                windowRef.clearInterval(timer);
                timer = null;
            }
        }

        function updateTimerText() {
            if (!shell || !shell.querySelector) {
                return;
            }

            let state = syncPomodoroPhase();
            const presentation = getTimerPresentation(state);
            const pomodoro = getPomodoroPresentation(state);
            const timerNode = shell.querySelector('[data-focus-beta-timer]');
            const timerLabelNode = shell.querySelector('[data-focus-beta-timer-label]');
            const totalNode = shell.querySelector('[data-focus-beta-total]');

            if (presentation.mode === 'countdown'
                && presentation.remainingMs <= 0
                && !state.sessionCompletionCuePlayed) {
                onTimerCue('session-complete', { mode: presentation.mode });
                state = updateState({ sessionCompletionCuePlayed: true }, { notify: false });
            }

            if (timerNode) {
                timerNode.textContent = pomodoro.enabled
                    ? formatElapsed(pomodoro.remainingMs)
                    : presentation.primaryValue;
            }

            if (timerLabelNode) {
                timerLabelNode.textContent = pomodoro.enabled
                    ? (pomodoro.finished ? 'Carrera cumplida' : pomodoro.label + ' · Ciclo ' + pomodoro.cycle)
                    : presentation.primaryLabel;
            }

            if (totalNode) {
                totalNode.textContent = (presentation.targetMs
                    ? 'Sesión ' + formatElapsed(presentation.sessionElapsedMs) + ' de ' + formatElapsed(presentation.targetMs)
                    : 'Tarea actual ' + formatElapsed(presentation.taskElapsedMs))
                    + (presentation.targetMs ? ' · Tarea ' + formatElapsed(presentation.taskElapsedMs) : '');
            }

            shell.dataset.pomodoroEnabled = pomodoro.enabled ? 'true' : 'false';
            shell.dataset.pomodoroPhase = pomodoro.enabled
                ? (pomodoro.finished ? 'finished' : pomodoro.phase)
                : '';

            if (shell.style && typeof shell.style.setProperty === 'function') {
                const progressDegrees = Math.round((pomodoro.enabled ? pomodoro.progress : presentation.progress) * 360);

                shell.style.setProperty('--focus-progress', progressDegrees + 'deg');
            }

            if (presentation.mode === 'countdown'
                && presentation.remainingMs <= 0
                && state.active
                && !state.suspended
                && !sessionEnding) {
                sessionEnding = true;
                endSession('timer-complete', true);
            }

        }

        function startTimerIfNeeded(state) {
            stopTimer();

            if (state.status === 'running') {
                timer = windowRef.setInterval(updateTimerText, 1000);
            }
        }

        function createShell() {
            if (shell || !documentRef || !documentRef.createElement || !documentRef.body) {
                return shell;
            }

            shell = documentRef.createElement('aside');
            shell.className = 'beta-focus-shell';
            shell.setAttribute('role', 'dialog');
            shell.setAttribute('aria-modal', 'true');
            shell.setAttribute('aria-label', 'Modo Carrera');
            shell.innerHTML = [
                '<section class="beta-focus-card">',
                '<div class="beta-focus-timer-orbit" aria-label="Cronometro de carrera">',
                '<strong data-focus-beta-timer>00:00</strong>',
                '</div>',
                '<span class="beta-focus-timer-label" data-focus-beta-timer-label>Tiempo en tarea</span>',
                '<span class="beta-focus-total" data-focus-beta-total>Total 00:00</span>',
                '<p class="section-kicker">Modo Carrera</p>',
                '<h2 data-focus-beta-title>Tarea actual</h2>',
                '<p data-focus-beta-status>Temporizador listo</p>',
                '<span data-focus-beta-count class="beta-focus-count">0 de 0</span>',
                '<div data-focus-beta-subtasks class="beta-focus-subtasks" hidden></div>',
                '<div class="beta-focus-actions">',
                '<button type="button" data-focus-beta-action="complete-next">Completar y seguir</button>',
                '<button type="button" data-focus-beta-action="pause">Pausar</button>',
                '<button type="button" data-focus-beta-action="skip">Siguiente</button>',
                '<button type="button" data-focus-beta-action="finish-session">Terminar sesión</button>',
                '<button type="button" data-focus-beta-action="exit">Volver a tareas</button>',
                '</div>',
                '</section>'
            ].join('');
            shell.addEventListener('click', event => {
                if (event.target === shell) {
                    leave();
                    return;
                }

                const subtaskButton = event.target.closest ? event.target.closest('[data-focus-beta-subtask-id]') : null;
                const button = event.target.closest ? event.target.closest('[data-focus-beta-action]') : null;

                if (subtaskButton) {
                    toggleSubtaskInFocus(subtaskButton.dataset.focusBetaSubtaskId);
                    return;
                }

                if (!button) {
                    return;
                }

                if (button.dataset.focusBetaAction === 'pause') {
                    const state = getState();

                    if (state.status === 'paused') {
                        resume();
                    } else {
                        pause();
                    }
                } else if (button.dataset.focusBetaAction === 'complete-next') {
                    completeAndContinue();
                } else if (button.dataset.focusBetaAction === 'skip') {
                    skipToNext();
                } else if (button.dataset.focusBetaAction === 'finish-session') {
                    endSession('manual', true);
                } else if (button.dataset.focusBetaAction === 'exit') {
                    leave();
                }
            });
            documentRef.body.appendChild(shell);

            return shell;
        }

        function removeSetupShell() {
            if (setupShell && setupShell.remove) {
                setupShell.remove();
            } else if (setupShell && setupShell.parentNode) {
                setupShell.parentNode.removeChild(setupShell);
            }

            if (documentRef && documentRef.body && documentRef.body.classList) {
                documentRef.body.classList.remove('focus-setup-active');
            }

            setupShell = null;
        }

        function removeResumeShell(reason) {
            const hadShell = Boolean(resumeShell);
            if (resumeShell && resumeShell.remove) {
                resumeShell.remove();
            } else if (resumeShell && resumeShell.parentNode) {
                resumeShell.parentNode.removeChild(resumeShell);
            }

            if (documentRef && documentRef.body && documentRef.body.classList) {
                documentRef.body.classList.remove('focus-setup-active');
            }

            resumeShell = null;
            if (hadShell && reason) {
                onResumePromptClosed(reason);
            }
        }

        function removeSummaryShell() {
            if (summaryShell && summaryShell.remove) {
                summaryShell.remove();
            } else if (summaryShell && summaryShell.parentNode) {
                summaryShell.parentNode.removeChild(summaryShell);
            }

            if (documentRef && documentRef.body && documentRef.body.classList) {
                documentRef.body.classList.remove('focus-summary-active');
            }

            summaryShell = null;
        }

        function getSetupTodo(todoId) {
            const todos = getPendingTodos();
            const topPriorityTodo = getTopPriorityTodo();
            const priorityTodo = topPriorityTodo
                ? todos.find(todo => todo.id === topPriorityTodo.id)
                : null;

            return todos.find(todo => todo && todo.id === todoId)
                || priorityTodo
                || todos[0]
                || null;
        }

        function getStoredSelectedTodo(state) {
            return getActiveTodos().find(todo => todo && todo.id === (state && state.selectedTodoId)) || null;
        }

        function getLaunchState() {
            const state = getState();
            const todo = getStoredSelectedTodo(state);
            const resumable = Boolean(state.active && state.suspended && todo);
            const mode = normalizeRaceMode(state.mode);

            return {
                resumable,
                todoId: todo ? todo.id : null,
                todoTitle: todo ? (todo.text || 'Tarea sin título') : '',
                mode,
                modeLabel: mode === 'countdown' ? 'contra reloj' : 'ritmo libre',
                buttonLabel: resumable
                    ? (mode === 'countdown' ? 'Continuar contra reloj' : 'Continuar ritmo libre')
                    : 'Modo Carrera',
                sessionElapsedMs: resumable ? getSessionElapsedMs(state) : 0,
                pomodoroEnabled: resumable && getPomodoroConfig(state).enabled
            };
        }

        function prepareForEntry() {
            const state = getState();
            const todo = getStoredSelectedTodo(state);

            if (!state.active || !todo || state.suspended) {
                return getLaunchState();
            }

            const taskElapsedMsById = getTaskElapsedMap(state);
            const activeInThisRuntime = Boolean(state.sessionId && liveSessionIds.has(state.sessionId));
            const taskElapsedMs = activeInThisRuntime ? getElapsedMs(state) : Math.max(Number(state.accumulatedMs) || 0, 0);
            const sessionElapsedMs = activeInThisRuntime ? getSessionElapsedMs(state) : Math.max(Number(state.sessionAccumulatedMs) || 0, 0);
            const pomodoroElapsedMs = activeInThisRuntime ? getPomodoroPhaseElapsedMs(state) : Math.max(Number(state.pomodoroPhaseAccumulatedMs) || 0, 0);

            if (state.selectedTodoId) {
                taskElapsedMsById[state.selectedTodoId] = taskElapsedMs;
            }

            updateState({
                ...state,
                active: true,
                suspended: true,
                status: 'paused',
                startedAt: null,
                pausedAt: getNowTimestamp(),
                accumulatedMs: taskElapsedMs,
                sessionStartedAt: null,
                sessionAccumulatedMs: sessionElapsedMs,
                sessionPausedMs: getCurrentPauseMs(state),
                taskElapsedMsById,
                sessionAwayStartedAt: getNowTimestamp(),
                sessionAwayWasRunning: state.status === 'running',
                pomodoroPhaseStartedAt: null,
                pomodoroPhaseAccumulatedMs: pomodoroElapsedMs
            }, { notify: false });

            return getLaunchState();
        }

        function resumeSession() {
            const state = getState();
            const todo = getStoredSelectedTodo(state);

            if (!state.active || !state.suspended || !todo) {
                removeResumeShell('new');
                return openSetup();
            }

            const startedAt = getNowTimestamp();
            const pomodoro = getPomodoroConfig(state);
            const sessionAwayMs = getCurrentAwayMs(state);

            unlockAudio();
            if (state.sessionId) {
                liveSessionIds.add(state.sessionId);
            }
            const nextState = updateState({
                suspended: false,
                status: 'running',
                startedAt,
                pausedAt: null,
                sessionStartedAt: startedAt,
                sessionAwayMs,
                sessionAwayStartedAt: null,
                sessionAwayWasRunning: false,
                pomodoroPhaseStartedAt: pomodoro.enabled ? startedAt : null
            }, { notify: false });

            removeResumeShell('continue');
            render();
            return nextState;
        }

        function startNewSession() {
            const state = getState();
            const todoId = state.selectedTodoId;

            stopTimer();
            updateState(getIdleState(state), { notify: false });
            removeResumeShell('new');
            removeShell();
            return openSetup(todoId);
        }

        function openResumePrompt() {
            const launchState = getLaunchState();

            if (!launchState.resumable) {
                return openSetup();
            }

            if (resumeShell) {
                const continueButton = resumeShell.querySelector('[data-focus-resume-action="continue"]');

                if (continueButton && typeof continueButton.focus === 'function') {
                    continueButton.focus({ preventScroll: true });
                }

                return { status: 'resume-open', todoId: launchState.todoId };
            }

            if (!documentRef || !documentRef.createElement || !documentRef.body) {
                return { status: 'unavailable' };
            }

            resumeShell = documentRef.createElement('aside');
            resumeShell.className = 'beta-focus-resume-shell';
            resumeShell.tabIndex = -1;
            resumeShell.setAttribute('role', 'dialog');
            resumeShell.setAttribute('aria-modal', 'true');
            resumeShell.setAttribute('aria-label', 'Continuar Modo Carrera');
            resumeShell.innerHTML = [
                '<section class="beta-focus-resume-card">',
                '<p class="section-kicker">Carrera pausada</p>',
                '<h2>Tu tiempo sigue guardado</h2>',
                '<p class="beta-focus-resume-task"></p>',
                '<div class="beta-focus-resume-facts">',
                '<span><small>Ritmo</small><strong>' + (launchState.mode === 'countdown' ? 'Contra reloj' : 'Libre') + '</strong></span>',
                '<span><small>Tiempo acumulado</small><strong>' + formatElapsed(launchState.sessionElapsedMs) + '</strong></span>',
                launchState.pomodoroEnabled ? '<span><small>Método</small><strong>Pomodoro</strong></span>' : '',
                '</div>',
                '<div class="beta-focus-resume-actions">',
                '<button type="button" data-focus-resume-action="continue">Continuar donde estaba</button>',
                '<button type="button" data-focus-resume-action="new">Empezar una carrera nueva</button>',
                '<button type="button" data-focus-resume-action="cancel">Dejar para después</button>',
                '</div>',
                '</section>'
            ].join('');

            const taskNode = resumeShell.querySelector('.beta-focus-resume-task');
            if (taskNode) {
                taskNode.textContent = launchState.todoTitle;
            }

            resumeShell.addEventListener('click', event => {
                if (event.target === resumeShell) {
                    removeResumeShell('defer');
                    return;
                }

                const action = event.target.closest ? event.target.closest('[data-focus-resume-action]') : null;

                if (!action) {
                    return;
                }

                if (action.dataset.focusResumeAction === 'continue') {
                    resumeSession();
                } else if (action.dataset.focusResumeAction === 'new') {
                    startNewSession();
                } else {
                    removeResumeShell('defer');
                }
            });
            resumeShell.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    removeResumeShell('defer');
                }
            });
            documentRef.body.appendChild(resumeShell);
            documentRef.body.classList.add('focus-setup-active');

            const continueButton = resumeShell.querySelector('[data-focus-resume-action="continue"]');
            if (continueButton && typeof continueButton.focus === 'function') {
                continueButton.focus({ preventScroll: true });
            }

            return { status: 'resume-open', todoId: launchState.todoId };
        }

        function openLauncher(todoId) {
            const launchState = getLaunchState();

            if (launchState.resumable) {
                return openResumePrompt();
            }

            return openSetup(todoId);
        }

        function setSetupMode(nextMode) {
            if (!setupShell) {
                return;
            }

            const mode = normalizeRaceMode(nextMode);
            setupShell.dataset.focusSetupMode = mode;
            setupShell.querySelectorAll('[data-focus-setup-mode]').forEach(button => {
                const selected = button.dataset.focusSetupMode === mode;

                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-pressed', selected.toString());
            });

            const countdownOptions = setupShell.querySelector('[data-focus-setup-countdown]');
            if (countdownOptions && mode === 'countdown' && !countdownOptions.querySelector('.is-selected')) {
                    const suggestedOption = countdownOptions.querySelector('[data-focus-setup-duration="25"]');
                    if (suggestedOption) {
                        selectSetupDuration(suggestedOption);
                    }
            }

            syncSetupTimingControls();
        }

        function getSetupTargetMs() {
            if (!setupShell || setupShell.dataset.focusSetupMode !== 'countdown') {
                return 0;
            }

            const pomodoro = getSetupPomodoroOptions();
            if (pomodoro.enabled) {
                return getPomodoroSessionTargetMs(pomodoro.workMs, pomodoro.breakMs, pomodoro.targetCycles);
            }

            const selectedPreset = setupShell.querySelector('[data-focus-setup-duration].is-selected');
            const customInput = setupShell.querySelector('[data-focus-setup-custom]');
            const presetMinutes = Number(selectedPreset && selectedPreset.dataset.focusSetupDuration);
            const customMinutes = Number(customInput && customInput.value);
            const minutes = Number.isFinite(customMinutes) && customMinutes > 0
                ? customMinutes
                : presetMinutes;

            return normalizeTargetMs(minutes * 60 * 1000);
        }

        function selectSetupDuration(button) {
            if (!setupShell || !button) {
                return;
            }

            setupShell.querySelectorAll('[data-focus-setup-duration]').forEach(option => {
                const selected = option === button;

                option.classList.toggle('is-selected', selected);
                option.setAttribute('aria-pressed', selected.toString());
            });

            const customInput = setupShell.querySelector('[data-focus-setup-custom]');
            if (customInput) {
                customInput.value = '';
            }
        }

        function setSetupPomodoroEnabled(enabled) {
            if (!setupShell) {
                return;
            }

            const toggle = setupShell.querySelector('[data-focus-setup-pomodoro]');
            const options = setupShell.querySelector('[data-focus-setup-pomodoro-options]');
            const isEnabled = Boolean(enabled);

            if (toggle) {
                toggle.checked = isEnabled;
            }

            if (options) {
                options.hidden = !isEnabled;
                options.setAttribute('aria-hidden', (!isEnabled).toString());
            }

            setupShell.dataset.pomodoroEnabled = isEnabled ? 'true' : 'false';
            syncSetupTimingControls();
            updatePomodoroCycleSummary();
        }

        function selectSetupPomodoroPreset(button) {
            if (!setupShell || !button) {
                return;
            }

            setupShell.querySelectorAll('[data-focus-pomodoro-preset]').forEach(option => {
                const selected = option === button;

                option.classList.toggle('is-selected', selected);
                option.setAttribute('aria-pressed', selected.toString());
            });

            syncSetupPomodoroCycleControl();
            updatePomodoroCycleSummary();
        }

        function selectSetupPomodoroCycles(button) {
            if (!setupShell || !button) {
                return;
            }

            setupShell.dataset.focusPomodoroCustomCycles = 'false';
            setupShell.querySelectorAll('[data-focus-pomodoro-cycle-preset]').forEach(option => {
                const selected = option === button;

                option.classList.toggle('is-selected', selected);
                option.setAttribute('aria-pressed', selected.toString());
            });
            syncSetupPomodoroCycleControl();
            updatePomodoroCycleSummary();
        }

        function selectSetupCustomPomodoroCycles(refresh) {
            if (!setupShell) {
                return;
            }

            setupShell.dataset.focusPomodoroCustomCycles = 'true';
            setupShell.querySelectorAll('[data-focus-pomodoro-cycle-preset]').forEach(option => {
                option.classList.remove('is-selected');
                option.setAttribute('aria-pressed', 'false');
            });

            if (refresh !== false) {
                syncSetupPomodoroCycleControl();
                updatePomodoroCycleSummary();
            }
        }

        function syncSetupPomodoroCycleControl() {
            if (!setupShell) {
                return;
            }

            const selectedPreset = setupShell.querySelector('[data-focus-pomodoro-preset].is-selected')
                || setupShell.querySelector('[data-focus-pomodoro-preset]');
            const workMs = (Number(selectedPreset && selectedPreset.dataset.focusPomodoroWork) || 25) * 60 * 1000;
            const policy = getPomodoroCyclePolicy(workMs);
            let custom = setupShell.dataset.focusPomodoroCustomCycles === 'true';
            const customField = setupShell.querySelector('[data-focus-pomodoro-custom-field]');
            const cycleInput = setupShell.querySelector('[data-focus-pomodoro-cycles]');
            const maxLabel = setupShell.querySelector('[data-focus-pomodoro-cycle-limit]');
            const fourthCycleButton = setupShell.querySelector('[data-focus-pomodoro-cycle-preset="4"]');
            const fixedFourCycles = policy.maxCycles === 4;

            if (fixedFourCycles && custom) {
                custom = false;
                setupShell.dataset.focusPomodoroCustomCycles = 'false';
                setupShell.querySelectorAll('[data-focus-pomodoro-cycle-preset]').forEach(option => {
                    const selected = option === fourthCycleButton;
                    option.classList.toggle('is-selected', selected);
                    option.setAttribute('aria-pressed', selected.toString());
                });
            } else if (!fixedFourCycles && fourthCycleButton && fourthCycleButton.classList.contains('is-selected')) {
                custom = true;
                setupShell.dataset.focusPomodoroCustomCycles = 'true';
                setupShell.querySelectorAll('[data-focus-pomodoro-cycle-preset]').forEach(option => {
                    option.classList.remove('is-selected');
                    option.setAttribute('aria-pressed', 'false');
                });
            }

            if (cycleInput) {
                cycleInput.max = String(policy.maxCycles);
                cycleInput.setAttribute('aria-label', custom
                    ? 'Ciclos personalizados, seleccionado'
                    : 'Usar ciclos personalizados');
                if (custom) {
                    cycleInput.value = String(Math.max(
                        normalizePomodoroCycles(cycleInput.value, workMs),
                        Math.min(4, policy.maxCycles)
                    ));
                }
            }

            if (maxLabel) {
                maxLabel.textContent = '4–' + policy.maxCycles;
            }

            if (fourthCycleButton) {
                fourthCycleButton.hidden = !fixedFourCycles;
            }

            if (customField) {
                customField.hidden = fixedFourCycles;
                customField.classList.toggle('is-selected', custom);
            }
        }

        function syncSetupTimingControls() {
            if (!setupShell) {
                return;
            }

            const countdown = setupShell.dataset.focusSetupMode === 'countdown';
            const pomodoroEnabled = setupShell.dataset.pomodoroEnabled === 'true';
            const countdownOptions = setupShell.querySelector('[data-focus-setup-countdown]');
            const cycleOptions = setupShell.querySelector('[data-focus-pomodoro-cycle-options]');
            const freePomodoroNote = setupShell.querySelector('[data-focus-pomodoro-free-note]');

            if (countdownOptions) {
                countdownOptions.hidden = !countdown || pomodoroEnabled;
                countdownOptions.setAttribute('aria-hidden', countdownOptions.hidden.toString());
            }

            if (cycleOptions) {
                cycleOptions.hidden = !countdown || !pomodoroEnabled;
                cycleOptions.setAttribute('aria-hidden', cycleOptions.hidden.toString());
            }

            if (freePomodoroNote) {
                freePomodoroNote.hidden = countdown;
            }
        }

        function updatePomodoroCycleSummary() {
            if (!setupShell) {
                return;
            }

            const summary = setupShell.querySelector('[data-focus-pomodoro-total]');
            if (!summary) {
                return;
            }

            const pomodoro = getSetupPomodoroOptions();
            const schedule = getPomodoroSchedule(pomodoro.workMs, pomodoro.breakMs, pomodoro.targetCycles);
            const longBreakNote = setupShell.querySelector('[data-focus-pomodoro-long-break]');

            summary.textContent = formatDuration(schedule.totalMs) + ' en total · '
                + formatDuration(schedule.focusMs) + ' de enfoque'
                + (schedule.breakTotalMs ? ' · ' + formatDuration(schedule.breakTotalMs) + ' de pausa' : '');

            if (longBreakNote) {
                longBreakNote.hidden = schedule.longBreaks === 0;
                longBreakNote.textContent = schedule.longBreaks
                    ? 'Descanso largo tras el ciclo ' + schedule.longBreakEvery
                    : '';
            }
        }

        function getSetupPomodoroOptions() {
            if (!setupShell) {
                return {
                    enabled: false,
                    workMs: 25 * 60 * 1000,
                    breakMs: 5 * 60 * 1000,
                    targetCycles: 2
                };
            }

            const enabled = setupShell.dataset.pomodoroEnabled === 'true';
            const selectedPreset = setupShell.querySelector('[data-focus-pomodoro-preset].is-selected')
                || setupShell.querySelector('[data-focus-pomodoro-preset]');
            const workMinutes = Number(selectedPreset && selectedPreset.dataset.focusPomodoroWork) || 25;
            const breakMinutes = Number(selectedPreset && selectedPreset.dataset.focusPomodoroBreak) || 5;
            const cycleInput = setupShell.querySelector('[data-focus-pomodoro-cycles]');
            const selectedCyclePreset = setupShell.querySelector('[data-focus-pomodoro-cycle-preset].is-selected')
                || setupShell.querySelector('[data-focus-pomodoro-cycle-preset]');
            const useCustomCycles = setupShell.dataset.focusPomodoroCustomCycles === 'true';
            const cycleValue = useCustomCycles
                ? cycleInput && cycleInput.value
                : selectedCyclePreset && selectedCyclePreset.dataset.focusPomodoroCyclePreset;

            return {
                enabled,
                workMs: workMinutes * 60 * 1000,
                breakMs: breakMinutes * 60 * 1000,
                targetCycles: normalizePomodoroCycles(cycleValue, workMinutes * 60 * 1000)
            };
        }

        function getSetupSelectedTodoIds() {
            if (!setupShell) {
                return [];
            }

            const allTodoIds = getPendingTodos().map(todo => todo.id);

            if (setupShell.dataset.focusSetupSelection !== 'custom') {
                return allTodoIds;
            }

            return Array.from(setupShell.querySelectorAll('[data-focus-setup-task-option][aria-pressed="true"]'))
                .map(button => button.dataset.focusSetupTaskOption)
                .filter(todoId => allTodoIds.includes(todoId));
        }

        function syncSetupTaskSelection() {
            if (!setupShell) {
                return;
            }

            const custom = setupShell.dataset.focusSetupSelection === 'custom';
            const selectedIds = getSetupSelectedTodoIds();
            const total = getPendingTodos().length;
            const list = setupShell.querySelector('[data-focus-setup-task-list]');
            const count = setupShell.querySelector('[data-focus-setup-task-count]');
            const hint = setupShell.querySelector('[data-focus-setup-task-hint]');
            const startButton = setupShell.querySelector('[data-focus-setup-action="start"]');

            setupShell.querySelectorAll('[data-focus-setup-selection]').forEach(button => {
                const selected = button.dataset.focusSetupSelection === (custom ? 'custom' : 'all');

                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-pressed', selected.toString());
            });

            if (list) {
                list.hidden = !custom;
                list.setAttribute('aria-hidden', (!custom).toString());
            }

            if (count) {
                count.textContent = custom
                    ? selectedIds.length + ' de ' + total + ' elegidas'
                    : total + (total === 1 ? ' tarea incluida' : ' tareas incluidas');
            }

            if (hint) {
                hint.textContent = custom && selectedIds.length === 0
                    ? 'Elige al menos una tarea para comenzar.'
                    : custom
                        ? 'La carrera avanzará solo por estas tareas.'
                        : 'La carrera recorrerá todas tus tareas pendientes.';
                hint.classList.toggle('is-warning', custom && selectedIds.length === 0);
            }

            if (startButton) {
                startButton.disabled = selectedIds.length === 0;
            }
        }

        function setSetupTaskSelectionMode(mode) {
            if (!setupShell) {
                return;
            }

            setupShell.dataset.focusSetupSelection = mode === 'custom' ? 'custom' : 'all';
            syncSetupTaskSelection();
        }

        function toggleSetupTask(button) {
            if (!button) {
                return;
            }

            const selected = button.getAttribute('aria-pressed') !== 'true';

            button.setAttribute('aria-pressed', selected.toString());
            button.classList.toggle('is-selected', selected);
            syncSetupTaskSelection();
        }

        function startRaceFromSetup() {
            if (!setupShell) {
                return;
            }

            const selectedTodoId = setupShell.dataset.focusSetupTodoId;
            const mode = normalizeRaceMode(setupShell.dataset.focusSetupMode);
            const targetMs = getSetupTargetMs();
            const pomodoro = getSetupPomodoroOptions();
            const todoIds = getSetupSelectedTodoIds();

            if (todoIds.length === 0) {
                const firstTask = setupShell.querySelector('[data-focus-setup-task-option]');
                if (firstTask && typeof firstTask.focus === 'function') {
                    firstTask.focus();
                }
                return;
            }

            if (mode === 'countdown' && !targetMs) {
                const customInput = setupShell.querySelector('[data-focus-setup-custom]');
                if (customInput && typeof customInput.focus === 'function') {
                    customInput.focus();
                }
                return;
            }

            removeSetupShell();
            start(selectedTodoId, {
                mode,
                targetMs,
                pomodoroEnabled: pomodoro.enabled,
                pomodoroWorkMs: pomodoro.workMs,
                pomodoroBreakMs: pomodoro.breakMs,
                pomodoroTargetCycles: mode === 'countdown' && pomodoro.enabled ? pomodoro.targetCycles : 0,
                todoIds
            });
        }

        function openSetup(todoId) {
            const todo = getSetupTodo(todoId);

            if (!todo) {
                return {
                    status: 'empty',
                    message: 'No hay una tarea disponible para iniciar Modo Carrera.'
                };
            }

            if (setupShell) {
                const startButton = setupShell.querySelector('[data-focus-setup-action="start"]');
                if (startButton && typeof startButton.focus === 'function') {
                    startButton.focus({ preventScroll: true });
                }

                return { status: 'open', todoId: todo.id };
            }

            if (!documentRef || !documentRef.createElement || !documentRef.body) {
                return { status: 'unavailable' };
            }

            setupShell = documentRef.createElement('aside');
            setupShell.className = 'beta-focus-setup-shell';
            setupShell.dataset.focusSetupMode = 'free';
            setupShell.dataset.focusSetupTodoId = todo.id;
            setupShell.dataset.focusSetupSelection = 'all';
            setupShell.dataset.focusPomodoroCustomCycles = 'false';
            setupShell.tabIndex = -1;
            setupShell.setAttribute('role', 'dialog');
            setupShell.setAttribute('aria-modal', 'true');
            setupShell.setAttribute('aria-label', 'Preparar Modo Carrera');
            setupShell.innerHTML = [
                '<section class="beta-focus-setup-card">',
                '<p class="section-kicker">Modo Carrera</p>',
                '<h2>Prepara tu carrera</h2>',
                '<p class="beta-focus-setup-task">Elige qué quieres avanzar y después marca tu ritmo.</p>',
                '<section class="beta-focus-task-picker" aria-labelledby="focus-task-picker-title">',
                '<div class="beta-focus-task-picker-heading">',
                '<strong id="focus-task-picker-title">Tareas de la sesión</strong>',
                '<span data-focus-setup-task-count></span>',
                '</div>',
                '<div class="beta-focus-task-selection" role="group" aria-label="Tareas incluidas en la carrera">',
                '<button type="button" class="is-selected" data-focus-setup-selection="all" aria-pressed="true">Todas</button>',
                '<button type="button" data-focus-setup-selection="custom" aria-pressed="false">Elegir tareas</button>',
                '</div>',
                '<div class="beta-focus-task-options" data-focus-setup-task-list hidden aria-hidden="true"></div>',
                '<p data-focus-setup-task-hint></p>',
                '</section>',
                '<h3 class="beta-focus-setup-subtitle">Ritmo de la sesión</h3>',
                '<div class="beta-focus-mode-options" role="group" aria-label="Tipo de carrera">',
                '<button type="button" class="is-selected" data-focus-setup-mode="free" aria-pressed="true">',
                '<strong>Ritmo libre</strong><span>Avanza sin reloj en contra.</span>',
                '</button>',
                '<button type="button" data-focus-setup-mode="countdown" aria-pressed="false">',
                '<strong>Contra reloj</strong><span>Elige un límite que te ayude a enfocarte.</span>',
                '</button>',
                '</div>',
                '<div class="beta-focus-countdown-options" data-focus-setup-countdown hidden>',
                '<span>Tiempo para esta carrera</span>',
                '<div role="group" aria-label="Duración">',
                COUNTDOWN_PRESETS.map(minutes => '<button type="button" data-focus-setup-duration="' + minutes + '" aria-pressed="false">' + minutes + ' min</button>').join(''),
                '</div>',
                '<label>Otro tiempo <input type="number" min="1" max="480" inputmode="numeric" placeholder="min" data-focus-setup-custom></label>',
                '</div>',
                '<div class="beta-focus-pomodoro-setup">',
                '<label class="beta-focus-pomodoro-toggle">',
                '<input type="checkbox" data-focus-setup-pomodoro>',
                '<span class="beta-focus-pomodoro-toggle-icon" aria-hidden="true"></span>',
                '<span><strong>Usar Pomodoro</strong><small>Alterna enfoque y descanso automáticamente.</small></span>',
                '</label>',
                '<div class="beta-focus-pomodoro-options" data-focus-setup-pomodoro-options hidden>',
                '<div class="beta-focus-pomodoro-presets" role="group" aria-label="Duración del Pomodoro">',
                POMODORO_PRESETS.map((preset, index) => '<button type="button" class="' + (index === 0 ? 'is-selected' : '') + '" data-focus-pomodoro-preset data-focus-pomodoro-work="' + preset.work + '" data-focus-pomodoro-break="' + preset.rest + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '"><strong>' + preset.work + ' min</strong><span>' + preset.rest + ' min de descanso</span></button>').join(''),
                '</div>',
                '<div class="beta-focus-pomodoro-cycles" data-focus-pomodoro-cycle-options hidden>',
                '<strong>Ciclos de esta carrera</strong>',
                '<div role="group" aria-label="Cantidad de ciclos Pomodoro">',
                [1, 2, 3].map(cycles => '<button type="button" class="' + (cycles === 2 ? 'is-selected' : '') + '" data-focus-pomodoro-cycle-preset="' + cycles + '" aria-pressed="' + (cycles === 2 ? 'true' : 'false') + '">' + cycles + '</button>').join(''),
                '<button type="button" data-focus-pomodoro-cycle-preset="4" aria-pressed="false" hidden>4</button>',
                '<label class="beta-focus-pomodoro-custom-cycles" data-focus-pomodoro-custom-field for="focus-pomodoro-cycle-count">',
                '<span data-focus-pomodoro-cycle-limit>4–8</span>',
                '<input id="focus-pomodoro-cycle-count" type="number" min="4" max="8" step="1" value="4" inputmode="numeric" data-focus-pomodoro-cycles aria-label="Usar cantidad personalizada de ciclos Pomodoro">',
                '</label>',
                '</div>',
                '<p data-focus-pomodoro-total aria-live="polite"></p>',
                '<small class="beta-focus-pomodoro-long-break" data-focus-pomodoro-long-break aria-live="polite"></small>',
                '</div>',
                '<p data-focus-pomodoro-free-note>En ritmo libre, los ciclos continúan hasta que termines la sesión.</p>',
                '</div>',
                '</div>',
                '<div class="beta-focus-setup-actions">',
                '<button type="button" data-focus-setup-action="start">Empezar carrera</button>',
                '<button type="button" data-focus-setup-action="cancel">Ahora no</button>',
                '</div>',
                '</section>'
            ].join('');

            const taskList = setupShell.querySelector('[data-focus-setup-task-list]');
            if (taskList) {
                getPendingTodos().forEach(pendingTodo => {
                    const button = documentRef.createElement('button');
                    const check = documentRef.createElement('span');
                    const title = documentRef.createElement('strong');
                    const type = documentRef.createElement('small');

                    button.type = 'button';
                    button.className = 'beta-focus-task-option is-selected';
                    button.dataset.focusSetupTaskOption = pendingTodo.id;
                    button.setAttribute('aria-pressed', 'true');
                    button.setAttribute('aria-label', 'Incluir ' + (pendingTodo.text || 'tarea') + ' en la carrera');
                    check.className = 'beta-focus-task-option-check';
                    check.setAttribute('aria-hidden', 'true');
                    title.textContent = pendingTodo.text || 'Tarea sin título';
                    type.textContent = pendingTodo.type === 'composite' ? 'Hito' : 'Tarea';
                    button.append(check, title, type);
                    taskList.appendChild(button);
                });
            }

            setSetupMode('free');
            setSetupPomodoroEnabled(false);
            setSetupTaskSelectionMode('all');

            setupShell.addEventListener('click', event => {
                if (event.target === setupShell) {
                    removeSetupShell();
                }
            });
            setupShell.querySelectorAll('[data-focus-setup-mode]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSetupMode(button.dataset.focusSetupMode);
                });
            });
            setupShell.querySelectorAll('[data-focus-setup-selection]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSetupTaskSelectionMode(button.dataset.focusSetupSelection);
                });
            });
            setupShell.querySelectorAll('[data-focus-setup-task-option]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleSetupTask(button);
                });
            });
            setupShell.querySelectorAll('[data-focus-setup-duration]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectSetupDuration(button);
                });
            });
            const pomodoroToggle = setupShell.querySelector('[data-focus-setup-pomodoro]');

            if (pomodoroToggle) {
                pomodoroToggle.addEventListener('change', event => {
                    setSetupPomodoroEnabled(event.target.checked);
                });
            }

            setupShell.querySelectorAll('[data-focus-pomodoro-preset]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSetupPomodoroEnabled(true);
                    selectSetupPomodoroPreset(button);
                });
            });
            setupShell.querySelectorAll('[data-focus-pomodoro-cycle-preset]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectSetupPomodoroCycles(button);
                });
            });
            const pomodoroCycleInput = setupShell.querySelector('[data-focus-pomodoro-cycles]');
            if (pomodoroCycleInput) {
                pomodoroCycleInput.addEventListener('focus', selectSetupCustomPomodoroCycles);
                pomodoroCycleInput.addEventListener('input', () => {
                    const cycles = Number(pomodoroCycleInput.value);
                    const selectedPreset = setupShell.querySelector('[data-focus-pomodoro-preset].is-selected')
                        || setupShell.querySelector('[data-focus-pomodoro-preset]');
                    const workMs = (Number(selectedPreset && selectedPreset.dataset.focusPomodoroWork) || 25) * 60 * 1000;
                    const policy = getPomodoroCyclePolicy(workMs);

                    selectSetupCustomPomodoroCycles(false);

                    if (pomodoroCycleInput.value !== ''
                        && Number.isFinite(cycles)
                        && (cycles < 4 || cycles > policy.maxCycles)) {
                        pomodoroCycleInput.value = String(Math.max(
                            normalizePomodoroCycles(cycles, workMs),
                            Math.min(4, policy.maxCycles)
                        ));
                    }

                    syncSetupPomodoroCycleControl();
                    updatePomodoroCycleSummary();
                });
                pomodoroCycleInput.addEventListener('change', () => {
                    const pomodoro = getSetupPomodoroOptions();
                    pomodoroCycleInput.value = String(Math.max(
                        normalizePomodoroCycles(pomodoroCycleInput.value, pomodoro.workMs),
                        Math.min(4, getPomodoroCyclePolicy(pomodoro.workMs).maxCycles)
                    ));
                    syncSetupPomodoroCycleControl();
                    updatePomodoroCycleSummary();
                });
            }
            syncSetupPomodoroCycleControl();
            const startButton = setupShell.querySelector('[data-focus-setup-action="start"]');
            const cancelButton = setupShell.querySelector('[data-focus-setup-action="cancel"]');

            if (startButton) {
                startButton.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    startRaceFromSetup();
                });
            }

            if (cancelButton) {
                cancelButton.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeSetupShell();
                });
            }
            setupShell.addEventListener('input', event => {
                if (event.target.matches('[data-focus-setup-custom]')) {
                    setupShell.querySelectorAll('[data-focus-setup-duration]').forEach(option => {
                        option.classList.remove('is-selected');
                        option.setAttribute('aria-pressed', 'false');
                    });
                }

            });
            setupShell.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    removeSetupShell();
                }
            });
            documentRef.body.appendChild(setupShell);

            if (documentRef.body.classList) {
                documentRef.body.classList.add('focus-setup-active');
            }

            if (startButton && typeof startButton.focus === 'function') {
                startButton.focus({ preventScroll: true });
            }

            return { status: 'open', todoId: todo.id };
        }

        function renderFocusSubtasks(container, todo, state) {
            if (!container) {
                return;
            }

            container.innerHTML = '';

            if (!isCompositeTodo(todo)) {
                container.hidden = true;
                return;
            }

            container.hidden = false;
            const originalOrder = getFocusSubtaskOrder(todo, state);
            const compositeTasks = global.TasklyzenCompositeTasks;
            const displaySubtasks = compositeTasks && typeof compositeTasks.getDisplaySubtasks === 'function'
                ? compositeTasks.getDisplaySubtasks(getSubtasks(todo), {
                    orderIds: originalOrder,
                    isCompleted: subtask => isSubtaskCompleteInFocus(todo, subtask, state)
                })
                : getSubtasks(todo).slice();

            displaySubtasks.forEach(subtask => {
                    const completed = isSubtaskCompleteInFocus(todo, subtask, state);
                    const button = documentRef.createElement('button');
                    const check = documentRef.createElement('span');
                    const title = documentRef.createElement('span');
                    const tag = documentRef.createElement('small');

                    button.type = 'button';
                    button.className = [
                        'beta-focus-subtask',
                        completed ? 'is-complete' : '',
                        subtask.optional ? 'is-optional' : ''
                    ].filter(Boolean).join(' ');
                    button.dataset.focusBetaSubtaskId = subtask.id;
                    button.setAttribute('aria-pressed', completed ? 'true' : 'false');
                    button.setAttribute('aria-label', (completed ? 'Quitar ' : 'Marcar ') + (subtask.title || 'subtarea'));
                    check.className = 'beta-focus-subtask-check';
                    check.setAttribute('aria-hidden', 'true');
                    title.textContent = subtask.title || 'Subtarea';
                    tag.textContent = subtask.optional ? 'Opcional' : 'Paso clave';
                    button.append(check, title, tag);
                    container.appendChild(button);
            });
        }

        function buildSessionRecord(state, result) {
            const sessionElapsedMs = getSessionElapsedMs(state);
            const targetMs = normalizeRaceMode(state.mode) === 'countdown'
                ? normalizeTargetMs(state.targetMs)
                : 0;
            const completedTodoIds = getCompletedTodoIds(state);
            const completedSubtaskKeys = getCompletedSubtaskKeys(state);
            const pomodoro = getPomodoroConfig(state);
            const snapshot = getSessionTodoSnapshot(state);
            const liveTodos = getTodos();
            const taskElapsedMsById = getTaskElapsedMap(state);

            if (state.selectedTodoId) {
                taskElapsedMsById[state.selectedTodoId] = getElapsedMs(state);
            }

            const completedTodos = completedTodoIds.map(todoId => {
                const saved = snapshot.find(item => item.id === todoId);
                const live = liveTodos.find(item => item && item.id === todoId);

                return saved || (live ? {
                    id: live.id,
                    title: String(live.text || 'Tarea sin título'),
                    type: live.type === 'composite' ? 'hito' : 'tarea'
                } : {
                    id: todoId,
                    title: 'Tarea completada',
                    type: 'tarea'
                });
            });
            const taskIds = Array.from(new Set(
                getVisitedTodoIds(state)
                    .concat(Object.keys(taskElapsedMsById))
                    .concat(state.selectedTodoId ? [state.selectedTodoId] : [])
            ));
            const taskBreakdown = taskIds.map(todoId => {
                const saved = snapshot.find(item => item.id === todoId);
                const live = liveTodos.find(item => item && item.id === todoId);
                const todo = saved || (live ? {
                    id: live.id,
                    title: String(live.text || 'Tarea sin título'),
                    type: live.type === 'composite' ? 'hito' : 'tarea'
                } : {
                    id: todoId,
                    title: 'Tarea de la sesión',
                    type: 'tarea'
                });

                return {
                    ...todo,
                    elapsedMs: Math.max(Number(taskElapsedMsById[todoId]) || 0, 0),
                    completed: completedTodoIds.includes(todoId) || Boolean(live && live.completed)
                };
            });
            const targetCycles = pomodoro.enabled
                ? Math.max(Number(state.pomodoroTargetCycles) || 0, 0)
                : 0;
            const completedCycles = pomodoro.enabled && targetCycles && targetMs && sessionElapsedMs >= targetMs
                ? targetCycles
                : Math.max(Number(state.pomodoroCompletedCycles) || 0, 0);
            const timeBreakdown = getSessionTimeBreakdown(state, sessionElapsedMs);
            const record = {
                id: state.sessionId || ('race-' + getNowMs().toString(36) + '-' + Math.random().toString(36).slice(2, 8)),
                startedAt: state.sessionCreatedAt || state.sessionStartedAt || getNowTimestamp(),
                completedAt: getNowTimestamp(),
                mode: targetMs ? 'countdown' : 'free',
                targetMs,
                elapsedMs: sessionElapsedMs,
                focusMs: timeBreakdown.focusMs,
                breakMs: timeBreakdown.breakMs,
                pausedMs: getCurrentPauseMs(state),
                awayMs: getCurrentAwayMs(state),
                backgroundMs: getCurrentBackgroundMs(state),
                confirmedAwayMs: Math.max(Number(state.sessionConfirmedAwayMs) || 0, 0),
                completedBreaks: timeBreakdown.completedBreaks,
                longBreaks: timeBreakdown.longBreaks,
                completedCount: completedTodoIds.length,
                completedSubtaskCount: completedSubtaskKeys.length,
                completedTodoIds,
                completedSubtaskKeys,
                completedTodos,
                taskBreakdown,
                taskElapsedMsById,
                sessionTodoIds: getSessionTodoIds(state),
                selectedCount: getSessionTodoIds(state).length,
                result: result || 'exited',
                outcome: completedTodoIds.length || completedSubtaskKeys.length ? 'completed' : 'unconfirmed',
                targetReached: Boolean(targetMs && sessionElapsedMs >= targetMs),
                pomodoroEnabled: pomodoro.enabled,
                pomodoroWorkMs: pomodoro.enabled ? pomodoro.workMs : 0,
                pomodoroBreakMs: pomodoro.enabled ? pomodoro.breakMs : 0,
                pomodoroCompletedCycles: completedCycles,
                pomodoroTargetCycles: targetCycles,
                integrityFlags: []
            };
            const evaluation = evaluateSession(record) || {};

            return { ...record, ...evaluation };
        }

        function getIdleState(state, history) {
            return {
                active: false,
                suspended: false,
                selectedTodoId: null,
                status: 'idle',
                startedAt: null,
                pausedAt: null,
                accumulatedMs: 0,
                focusSubtaskDraft: null,
                mode: 'free',
                targetMs: 0,
                sessionCreatedAt: null,
                sessionId: null,
                sessionStartedAt: null,
                sessionAccumulatedMs: 0,
                sessionPausedMs: 0,
                sessionAwayMs: 0,
                sessionConfirmedAwayMs: 0,
                sessionAwayStartedAt: null,
                sessionAwayWasRunning: false,
                sessionBackgroundMs: 0,
                sessionBackgroundStartedAt: null,
                sessionCompletedTodoIds: [],
                sessionCompletedSubtaskKeys: [],
                sessionTodoSnapshot: [],
                sessionVisitedTodoIds: [],
                sessionTodoIds: [],
                taskElapsedMsById: {},
                pomodoroEnabled: false,
                pomodoroWorkMs: 25 * 60 * 1000,
                pomodoroBreakMs: 5 * 60 * 1000,
                pomodoroPhase: 'work',
                pomodoroPhaseStartedAt: null,
                pomodoroPhaseAccumulatedMs: 0,
                pomodoroPhaseTargetMs: 25 * 60 * 1000,
                pomodoroCompletedCycles: 0,
                pomodoroTargetCycles: 0,
                sessionCompletionCuePlayed: false,
                history: Array.isArray(history) ? history.slice(0, MAX_SESSION_HISTORY) : getSessionHistory(state)
            };
        }

        function getWeeklySummary() {
            const state = getState();
            const sevenDaysAgo = getNowMs() - (7 * 24 * 60 * 60 * 1000);
            const sessions = getSessionHistory(state).filter(session => {
                const completedAt = parseMs(session.completedAt);

                return completedAt !== null && completedAt >= sevenDaysAgo;
            }).map(session => ({
                ...session,
                ...evaluateSession({
                    ...session,
                    focusMs: Number.isFinite(Number(session.focusMs)) ? session.focusMs : session.elapsedMs
                })
            }));
            const targetSessions = sessions.filter(session => normalizeTargetMs(session.targetMs) > 0);
            const successfulTargets = targetSessions.filter(session => !session.targetReached).length;

            return {
                sessions: sessions.length,
                elapsedMs: sessions.reduce((total, session) => total + Math.max(Number(session.elapsedMs) || 0, 0), 0),
                focusMs: sessions.reduce((total, session) => total + Math.max(Number(session.confirmedFocusMs) || 0, 0), 0),
                completedCount: sessions.reduce((total, session) => total + Math.max(Number(session.completedCount) || 0, 0), 0),
                meaningfulSessions: sessions.filter(session => session.meaningful).length,
                sustainableSessions: sessions.filter(session => session.sustainable).length,
                targetSessions: targetSessions.length,
                successfulTargets
            };
        }

        function renderAnalyticsSummary() {
            const card = analyticsDom.card;

            if (!card) {
                return;
            }

            const summary = getWeeklySummary();
            card.hidden = summary.sessions === 0;

            if (card.hidden) {
                return;
            }

            if (analyticsDom.minutes) {
                analyticsDom.minutes.textContent = formatDuration(summary.focusMs);
            }

            if (analyticsDom.sessions) {
                analyticsDom.sessions.textContent = summary.meaningfulSessions
                    + (summary.meaningfulSessions === 1 ? ' sesión con avance' : ' sesiones con avance');
            }

            if (analyticsDom.targets) {
                analyticsDom.targets.textContent = summary.sustainableSessions
                    ? summary.sustainableSessions + (summary.sustainableSessions === 1 ? ' ritmo sostenible' : ' ritmos sostenibles')
                    : summary.completedCount + ' tareas cerradas';
            }
        }

        function rememberCompletedTodo(state, todoId) {
            if (!todoId) {
                return state;
            }

            return updateState({
                sessionCompletedTodoIds: getCompletedTodoIds(state).concat(todoId)
            }, { notify: false });
        }

        function showSessionSummary(record) {
            removeSummaryShell();

            if (!documentRef || !documentRef.createElement || !documentRef.body || !record) {
                return;
            }

            summaryShell = documentRef.createElement('aside');
            summaryShell.className = 'beta-focus-summary-shell';
            summaryShell.tabIndex = -1;
            summaryShell.setAttribute('role', 'dialog');
            summaryShell.setAttribute('aria-modal', 'true');
            summaryShell.setAttribute('aria-label', 'Resumen de Carrera');

            const completedTodos = Array.isArray(record.completedTodos) ? record.completedTodos : [];
            const taskBreakdown = Array.isArray(record.taskBreakdown) && record.taskBreakdown.length
                ? record.taskBreakdown
                : completedTodos.map(todo => ({ ...todo, elapsedMs: 0, completed: true }));
            const performance = getSessionPerformanceCopy(record);
            const displayedFocusMs = record.outcome === 'unconfirmed'
                ? record.focusMs
                : record.confirmedFocusMs;
            const focusMetricLabel = record.outcome === 'unconfirmed'
                ? 'tiempo registrado'
                : 'tiempo confirmado';
            summaryShell.innerHTML = [
                '<section class="beta-focus-summary-card">',
                '<p class="section-kicker">Carrera cerrada</p>',
                '<h2>' + performance.title + '</h2>',
                '<p>' + performance.message + '</p>',
                '<div class="beta-focus-summary-metrics">',
                '<span><strong>' + formatElapsed(displayedFocusMs) + '</strong><small>' + focusMetricLabel + '</small></span>',
                '<span><strong>' + record.completedCount + '</strong><small>tareas cerradas</small></span>',
                '<span><strong>' + (record.sustainable ? 'Sostenible' : record.meaningful ? 'Avance real' : 'Por confirmar') + '</strong><small>lectura de la sesión</small></span>',
                '</div>',
                '<div class="beta-focus-summary-tasks">',
                '<h3>' + (taskBreakdown.length ? 'Tiempo por tarea' : 'Tu siguiente oportunidad') + '</h3>',
                '<ul data-focus-summary-tasks></ul>',
                '</div>',
                '<div class="beta-focus-outcome" data-focus-summary-outcome' + (record.outcome === 'unconfirmed' ? '' : ' hidden') + '>',
                '<h3>¿Cómo terminó esta carrera?</h3>',
                '<p>Tu respuesta nos ayuda a mostrar un resumen más fiel de la sesión.</p>',
                '<div class="beta-focus-outcome-actions">',
                '<button type="button" data-focus-summary-outcome-value="advanced">Avancé</button>',
                '<button type="button" data-focus-summary-outcome-value="blocked">Quedé bloqueado</button>',
                '<button type="button" data-focus-summary-outcome-value="not-worked">No trabajé</button>',
                '</div>',
                '</div>',
                '<p class="beta-focus-summary-closing">' + performance.closing + '</p>',
                '<button type="button" data-focus-summary-action="close">Volver a tareas</button>',
                '</section>'
            ].join('');

            const taskList = summaryShell.querySelector('[data-focus-summary-tasks]');
            if (taskList) {
                if (taskBreakdown.length) {
                    taskBreakdown.forEach(todo => {
                        const item = documentRef.createElement('li');
                        const marker = documentRef.createElement('span');
                        const title = documentRef.createElement('strong');
                        const type = documentRef.createElement('small');

                        item.className = todo.completed ? 'is-complete' : 'is-pending';
                        marker.className = 'beta-focus-summary-check' + (todo.completed ? '' : ' is-pending');
                        marker.setAttribute('aria-hidden', 'true');
                        title.textContent = todo.title || 'Tarea de la sesión';
                        type.textContent = formatElapsed(todo.elapsedMs) + ' · ' + (todo.completed ? 'Completada' : 'Pendiente');
                        item.append(marker, title, type);
                        taskList.appendChild(item);
                    });
                } else {
                    const item = documentRef.createElement('li');
                    item.className = 'is-empty';
                    item.textContent = 'No cerraste tareas en esta sesión. Indica abajo si avanzaste, te bloqueaste o no llegaste a empezar.';
                    taskList.appendChild(item);
                }
            }
            summaryShell.addEventListener('click', event => {
                const outcomeButton = event.target.closest
                    ? event.target.closest('[data-focus-summary-outcome-value]')
                    : null;

                if (outcomeButton) {
                    confirmSessionOutcome(record, outcomeButton.dataset.focusSummaryOutcomeValue);
                    return;
                }

                if (event.target === summaryShell || (event.target.closest && event.target.closest('[data-focus-summary-action="close"]'))) {
                    removeSummaryShell();
                }
            });
            summaryShell.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    removeSummaryShell();
                }
            });
            documentRef.body.appendChild(summaryShell);
            if (documentRef.body.classList) {
                documentRef.body.classList.add('focus-summary-active');
            }

            const closeButton = summaryShell.querySelector('[data-focus-summary-action="close"]');
            if (closeButton && typeof closeButton.focus === 'function') {
                closeButton.focus({ preventScroll: true });
            }
        }

        function getSessionPerformanceCopy(record) {
            const completed = Math.max(Number(record && record.completedCount) || 0, 0);
            const completedSteps = Math.max(Number(record && record.completedSubtaskCount) || 0, 0);

            if (record && record.outcome === 'blocked') {
                return {
                    title: 'Encontraste un bloqueo',
                    message: 'Anotamos esta sesión para que puedas reconocer dónde hizo falta ajustar el plan.',
                    closing: 'Divide la tarea, cambia el enfoque o pide ayuda antes de retomarla.'
                };
            }

            if (record && record.outcome === 'not-worked') {
                return {
                    title: 'Sesión cerrada',
                    message: 'La Carrera terminó antes de que pudieras empezar a trabajar.',
                    closing: 'Cuando estés listo, puedes iniciar una sesión nueva.'
                };
            }

            if (!record || !record.meaningful) {
                return {
                    title: 'Carrera terminada',
                    message: 'No cerraste tareas durante esta sesión. Cuéntanos abajo cómo te fue.',
                    closing: 'Puedes retomar con una tarea más pequeña o continuar desde donde estabas.'
                };
            }

            if (record.sustainable) {
                return {
                    title: 'Ritmo sostenible',
                    message: 'Avanzaste con intención y respetaste el espacio necesario para recuperar energía.',
                    closing: 'Este es el ritmo que Tasklyzen ayuda a repetir, no la velocidad por sí sola.'
                };
            }

            if (record.intentional) {
                return {
                    title: 'Avance con intención',
                    message: 'La sesión produjo ' + (completed + completedSteps) + ' avances concretos en las tareas que elegiste.',
                    closing: 'Buen progreso. Si la siguiente carrera es larga, reserva también una pausa real.'
                };
            }

            return {
                title: 'Un paso real',
                message: 'Tu tiempo quedó ligado a un avance concreto, sin premiar prisas ni minutos vacíos.',
                closing: 'La constancia crece con cierres honestos, incluso cuando el paso es pequeño.'
            };
        }

        function confirmSessionOutcome(record, outcome) {
            const allowed = ['advanced', 'blocked', 'not-worked'];

            if (!record || !record.id || !allowed.includes(outcome)) {
                return record;
            }

            const updatedRecord = {
                ...record,
                ...evaluateSession({ ...record, outcome })
            };
            const state = getState();
            const history = getSessionHistory(state).map(session => (
                session.id === updatedRecord.id ? updatedRecord : session
            ));

            updateState({ history }, { notify: false });
            renderAnalyticsSummary();
            onSessionComplete(updatedRecord);
            showSessionSummary(updatedRecord);
            return updatedRecord;
        }

        function endSession(result, showSummary) {
            const state = getState();
            const record = buildSessionRecord(state, result);
            const history = [record].concat(getSessionHistory(state)).slice(0, MAX_SESSION_HISTORY);

            if (!state.sessionCompletionCuePlayed) {
                onTimerCue('session-complete', { mode: normalizeRaceMode(state.mode) });
            }

            stopTimer();
            const nextState = updateState(getIdleState(state, history), { notify: false });
            removeShell();
            sessionEnding = false;
            renderAnalyticsSummary();

            if (showSummary) {
                showSessionSummary(record);
            }

            onSessionComplete(record);
            return {
                ...nextState,
                lastSession: record
            };
        }

        function removeShell() {
            stopTimer();

            if (documentRef && documentRef.body && documentRef.body.classList) {
                documentRef.body.classList.remove('focus-beta-active');
            }

            if (shell && shell.remove) {
                shell.remove();
            } else if (shell && shell.parentNode) {
                shell.parentNode.removeChild(shell);
            }

            shell = null;
        }

        function render() {
            if (taskMutationInProgress) {
                return;
            }

            const state = getState();

            renderAnalyticsSummary();

            if (!isEnabled() || !state.active || state.suspended) {
                removeShell();
                return;
            }

            const todo = getStoredSelectedTodo(state);

            if (!todo) {
                updateState(getIdleState(state), { notify: false });
                removeShell();
                return;
            }

            const currentShell = createShell();

            if (!currentShell) {
                return;
            }

            if (documentRef.body && documentRef.body.classList) {
                documentRef.body.classList.add('focus-beta-active');
            }

            const titleNode = currentShell.querySelector('[data-focus-beta-title]');
            const statusNode = currentShell.querySelector('[data-focus-beta-status]');
            const countNode = currentShell.querySelector('[data-focus-beta-count]');
            const subtasksNode = currentShell.querySelector('[data-focus-beta-subtasks]');
            const pauseButton = currentShell.querySelector('[data-focus-beta-action="pause"]');
            const completeButton = currentShell.querySelector('[data-focus-beta-action="complete-next"]');
            const finishButton = currentShell.querySelector('[data-focus-beta-action="finish-session"]');
            const modeLabel = currentShell.querySelector('[data-focus-beta-timer-label]');
            const position = getTodoPosition(todo);
            const compositeTodo = isCompositeTodo(todo);
            const incompleteRequired = getIncompleteRequiredSubtasks(todo, state);
            const requiredProgress = getRequiredProgress(todo, state);
            const readyToFinishHito = compositeTodo && requiredProgress.total > 0 && requiredProgress.completed >= requiredProgress.total;
            const hasDraftChanges = compositeTodo && hasSubtaskDraftChanges(todo, state);

            if (titleNode) {
                titleNode.textContent = todo.text || 'Tarea sin titulo';
            }

            if (statusNode) {
                statusNode.textContent = state.status === 'paused'
                    ? 'Pausado. Tu tarea sigue intacta.'
                    : compositeTodo
                        ? (readyToFinishHito
                            ? 'Hito listo. Confirma para cerrarlo.'
                            : hasDraftChanges
                                ? 'Cambios listos. Guarda cuando quieras conservarlos.'
                                : 'Marca pasos sin cerrar el hito hasta confirmar.')
                        : (normalizeRaceMode(state.mode) === 'countdown'
                            ? 'Trabaja con calma: el reloj acompaña, no te castiga.'
                            : 'Tu ritmo, una tarea a la vez. Al cerrar sigues con la siguiente.');
            }

            if (modeLabel) {
                modeLabel.textContent = normalizeRaceMode(state.mode) === 'countdown'
                    ? 'Tiempo restante'
                    : 'Tiempo en tarea';
            }

            if (countNode) {
                countNode.textContent = compositeTodo
                    ? requiredProgress.completed + ' de ' + requiredProgress.total + ' pasos clave'
                    : position.current + ' de ' + position.total + ' pendientes';
            }

            renderFocusSubtasks(subtasksNode, todo, state);

            if (pauseButton) {
                pauseButton.textContent = state.status === 'paused' ? 'Continuar' : 'Pausar';
            }

            if (completeButton) {
                completeButton.hidden = false;
                completeButton.disabled = compositeTodo ? (!readyToFinishHito && !hasDraftChanges) : false;
                completeButton.textContent = compositeTodo
                    ? (readyToFinishHito ? 'Terminar hito' : 'Guardar')
                    : 'Completar y seguir';
            }

            if (finishButton) {
                finishButton.hidden = false;
            }

            updateTimerText();
            startTimerIfNeeded(getState());
        }

        function enable(updateOptions) {
            if (alwaysEnabled) {
                return true;
            }

            return registry && typeof registry.setEnabled === 'function'
                ? registry.setEnabled(featureId, true, updateOptions || { render: false })
                : false;
        }

        function disable(updateOptions) {
            if (alwaysEnabled) {
                removeShell();
                return true;
            }

            const disabled = registry && typeof registry.setEnabled === 'function'
                ? registry.setEnabled(featureId, false, updateOptions || { render: false })
                : false;

            removeShell();
            return disabled;
        }

        function start(todoId, startOptions) {
            const mode = startOptions || {};

            if (!isEnabled()) {
                return {
                    status: 'disabled',
                    message: 'Modo Carrera esta apagado.'
                };
            }

            const pendingTodos = getPendingTodos();
            const requestedTodoIds = Array.isArray(mode.todoIds)
                ? Array.from(new Set(mode.todoIds.filter(Boolean)))
                : pendingTodos.map(todo => todo.id);
            const sessionTodos = pendingTodos.filter(todo => requestedTodoIds.includes(todo.id));
            const sessionTodoIds = sessionTodos.map(todo => todo.id);
            const selectedTodo = sessionTodos.find(todo => todo.id === todoId) || sessionTodos[0] || null;

            if (!selectedTodo || selectedTodo.completed) {
                return {
                    status: 'empty',
                    message: 'No hay una tarea disponible para iniciar Modo Carrera.'
                };
            }

            removeSetupShell();
            removeSummaryShell();
            const raceMode = normalizeRaceMode(mode.mode);
            const taskElapsedMs = Math.max(Number(mode.accumulatedMs) || 0, 0);
            const pomodoroEnabled = Boolean(mode.pomodoroEnabled);
            const pomodoroWorkMs = normalizePomodoroMs(mode.pomodoroWorkMs, 25 * 60 * 1000, 5, 120);
            const pomodoroBreakMs = normalizePomodoroMs(mode.pomodoroBreakMs, 5 * 60 * 1000, 1, 30);
            const requestedPomodoroCycles = Math.round(Number(mode.pomodoroTargetCycles) || 0);
            const pomodoroTargetCycles = raceMode === 'countdown' && pomodoroEnabled && requestedPomodoroCycles > 0
                ? normalizePomodoroCycles(requestedPomodoroCycles, pomodoroWorkMs)
                : 0;
            const targetMs = raceMode === 'countdown'
                ? normalizeTargetMs(pomodoroEnabled && pomodoroTargetCycles
                    ? getPomodoroSessionTargetMs(pomodoroWorkMs, pomodoroBreakMs, pomodoroTargetCycles)
                    : mode.targetMs)
                : 0;
            const startedAt = getNowTimestamp();
            const sessionId = 'race-' + getNowMs().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

            sessionEnding = false;
            liveSessionIds.add(sessionId);
            unlockAudio();
            const nextState = updateState({
                active: true,
                suspended: false,
                selectedTodoId: selectedTodo.id,
                status: 'running',
                startedAt,
                pausedAt: null,
                accumulatedMs: taskElapsedMs,
                focusSubtaskDraft: null,
                mode: targetMs ? 'countdown' : 'free',
                targetMs,
                sessionCreatedAt: startedAt,
                sessionId,
                sessionStartedAt: startedAt,
                sessionAccumulatedMs: 0,
                sessionPausedMs: 0,
                sessionAwayMs: 0,
                sessionConfirmedAwayMs: 0,
                sessionAwayStartedAt: null,
                sessionAwayWasRunning: false,
                sessionBackgroundMs: 0,
                sessionBackgroundStartedAt: null,
                sessionCompletedTodoIds: [],
                sessionCompletedSubtaskKeys: [],
                sessionTodoSnapshot: createSessionTodoSnapshot(sessionTodoIds),
                sessionVisitedTodoIds: [selectedTodo.id],
                sessionTodoIds,
                taskElapsedMsById: {
                    [selectedTodo.id]: taskElapsedMs
                },
                pomodoroEnabled,
                pomodoroWorkMs,
                pomodoroBreakMs,
                pomodoroPhase: 'work',
                pomodoroPhaseStartedAt: pomodoroEnabled ? startedAt : null,
                pomodoroPhaseAccumulatedMs: 0,
                pomodoroPhaseTargetMs: getInitialPomodoroTargetMs(raceMode, targetMs, pomodoroWorkMs),
                pomodoroCompletedCycles: 0,
                pomodoroTargetCycles,
                sessionCompletionCuePlayed: false
            }, { notify: false });

            render();
            return nextState;
        }

        function selectNextTodo() {
            const state = syncPomodoroPhase();
            const nextTodo = getSelectedTodo({ selectedTodoId: null });

            if (!nextTodo) {
                return endSession('completed', true);
            }

            const clocks = captureRunningClocks(state);
            const nextTaskElapsedMs = Math.max(Number(clocks.taskElapsedMsById[nextTodo.id]) || 0, 0);
            const nextState = updateState({
                active: true,
                selectedTodoId: nextTodo.id,
                status: clocks.running ? 'running' : state.status,
                startedAt: clocks.running ? clocks.now : null,
                pausedAt: clocks.running ? null : state.pausedAt,
                accumulatedMs: nextTaskElapsedMs,
                focusSubtaskDraft: null,
                sessionAccumulatedMs: clocks.sessionElapsedMs,
                sessionStartedAt: clocks.running ? clocks.now : null,
                taskElapsedMsById: clocks.taskElapsedMsById,
                sessionVisitedTodoIds: Array.from(new Set(getVisitedTodoIds(state).concat(nextTodo.id))),
                pomodoroPhaseAccumulatedMs: clocks.pomodoroPhaseElapsedMs,
                pomodoroPhaseStartedAt: clocks.running && getPomodoroConfig(state).enabled ? clocks.now : null
            }, { notify: false });

            render();
            return nextState;
        }

        function completeAndContinue() {
            const state = getState();
            const todo = getSelectedTodo(state);

            if (!isEnabled() || !state.active || !todo) {
                return state;
            }

            if (isCompositeTodo(todo)) {
                return commitCompositeDraft(todo, state);
            }

            const completed = runTaskMutation(() => onCompleteTodo(todo.id, {
                elapsedMs: getElapsedMs(state),
                todo,
                source: 'race',
                sessionId: state.sessionId
            }));

            if (!completed) {
                render();
                return getState();
            }

            rememberCompletedTodo(state, todo.id);
            return selectNextTodo();
        }

        function commitCompositeDraft(todo, state) {
            const completedMap = getFocusSubtaskMap(todo, state);
            const changedSubtasks = getChangedSubtasks(todo, state);
            const readyToFinishHito = getIncompleteRequiredSubtasks(todo, state).length === 0;

            if (!readyToFinishHito && changedSubtasks.length === 0) {
                render();
                return getState();
            }

            runTaskMutation(() => {
                changedSubtasks.forEach(subtask => {
                    const liveTodo = getTodos().find(item => item && item.id === todo.id);
                    const liveSubtask = liveTodo && Array.isArray(liveTodo.subtasks)
                        ? liveTodo.subtasks.find(item => item.id === subtask.id)
                        : null;

                    if (liveSubtask && Boolean(liveSubtask.completed) !== Boolean(completedMap[subtask.id])) {
                        onToggleSubtask(todo.id, subtask.id, {
                            elapsedMs: getElapsedMs(state),
                            todo,
                            source: 'race',
                            sessionId: state.sessionId
                        });
                    }
                });
            });

            const completedSubtaskKeys = getCompletedSubtaskKeys(state);
            changedSubtasks.filter(subtask => !subtask.optional).forEach(subtask => {
                const key = todo.id + ':' + subtask.id;
                const index = completedSubtaskKeys.indexOf(key);

                if (completedMap[subtask.id] && index < 0) {
                    completedSubtaskKeys.push(key);
                } else if (!completedMap[subtask.id] && index >= 0) {
                    completedSubtaskKeys.splice(index, 1);
                }
            });
            updateState({ sessionCompletedSubtaskKeys: completedSubtaskKeys }, { notify: false });

            const updatedTodo = getTodos().find(item => item && item.id === todo.id);

            if (readyToFinishHito && updatedTodo && updatedTodo.completed) {
                rememberCompletedTodo(state, todo.id);
                return selectNextTodo();
            }

            const nextState = updateState({
                focusSubtaskDraft: null
            }, { notify: false });

            render();
            return nextState;
        }

        function toggleSubtaskInFocus(subtaskId) {
            const state = getState();
            const todo = getSelectedTodo(state);

            if (!isEnabled() || !state.active || !todo || !subtaskId || !isCompositeTodo(todo)) {
                return false;
            }

            const currentMap = getFocusSubtaskMap(todo, state);
            const originalOrder = getFocusSubtaskOrder(todo, state);

            currentMap[subtaskId] = !Boolean(currentMap[subtaskId]);
            updateState({
                focusSubtaskDraft: {
                    todoId: todo.id,
                    completions: currentMap,
                    order: originalOrder
                }
            }, { notify: false });

            render();
            return true;
        }

        function skipToNext() {
            const state = syncPomodoroPhase();
            const todo = getSelectedTodo(state);
            const activeTodos = getActiveTodos();

            if (!isEnabled() || !state.active || activeTodos.length === 0) {
                return state;
            }

            if (activeTodos.length === 1 || !todo) {
                return state;
            }

            const currentIndex = activeTodos.findIndex(item => item.id === todo.id);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % activeTodos.length : 0;

            const clocks = captureRunningClocks(state);
            const nextTodo = activeTodos[nextIndex];
            const nextState = updateState({
                selectedTodoId: nextTodo.id,
                startedAt: clocks.running ? clocks.now : null,
                pausedAt: clocks.running ? null : state.pausedAt,
                accumulatedMs: Math.max(Number(clocks.taskElapsedMsById[nextTodo.id]) || 0, 0),
                focusSubtaskDraft: null,
                sessionAccumulatedMs: clocks.sessionElapsedMs,
                sessionStartedAt: clocks.running ? clocks.now : null,
                taskElapsedMsById: clocks.taskElapsedMsById,
                sessionVisitedTodoIds: Array.from(new Set(getVisitedTodoIds(state).concat(nextTodo.id))),
                pomodoroPhaseAccumulatedMs: clocks.pomodoroPhaseElapsedMs,
                pomodoroPhaseStartedAt: clocks.running && getPomodoroConfig(state).enabled ? clocks.now : null
            }, { notify: false });

            render();
            return nextState;
        }

        function pause() {
            const state = getState();

            if (!isEnabled() || !state.active || state.status !== 'running') {
                return state;
            }

            const taskElapsedMsById = getTaskElapsedMap(state);
            taskElapsedMsById[state.selectedTodoId] = getElapsedMs(state);
            const nextState = updateState({
                ...state,
                status: 'paused',
                pausedAt: getNowTimestamp(),
                accumulatedMs: getElapsedMs(state),
                startedAt: null,
                sessionAccumulatedMs: getSessionElapsedMs(state),
                sessionPausedMs: Math.max(Number(state.sessionPausedMs) || 0, 0),
                sessionStartedAt: null,
                taskElapsedMsById,
                pomodoroPhaseAccumulatedMs: getPomodoroPhaseElapsedMs(state),
                pomodoroPhaseStartedAt: null
            }, { notify: false });

            render();
            return nextState;
        }

        function resume() {
            const state = getState();

            if (!isEnabled() || !state.active || state.status !== 'paused') {
                return state;
            }

            unlockAudio();
            const resumedAt = getNowTimestamp();
            const nextState = updateState({
                ...state,
                suspended: false,
                status: 'running',
                startedAt: resumedAt,
                pausedAt: null,
                sessionStartedAt: resumedAt,
                sessionPausedMs: getCurrentPauseMs(state),
                pomodoroPhaseStartedAt: getPomodoroConfig(state).enabled ? resumedAt : null
            }, { notify: false });

            render();
            return nextState;
        }

        function leave() {
            const state = getState();

            if (!state.active) {
                removeShell();
                return state;
            }

            stopTimer();
            const taskElapsedMsById = getTaskElapsedMap(state);
            const taskElapsedMs = getElapsedMs(state);
            const sessionElapsedMs = getSessionElapsedMs(state);
            const pomodoroElapsedMs = getPomodoroPhaseElapsedMs(state);
            const leftAt = state.sessionAwayStartedAt || getNowTimestamp();

            if (state.selectedTodoId) {
                taskElapsedMsById[state.selectedTodoId] = taskElapsedMs;
            }

            const nextState = updateState({
                ...state,
                active: true,
                suspended: true,
                status: 'paused',
                startedAt: null,
                pausedAt: leftAt,
                accumulatedMs: taskElapsedMs,
                sessionStartedAt: null,
                sessionAccumulatedMs: sessionElapsedMs,
                sessionPausedMs: getCurrentPauseMs(state),
                taskElapsedMsById,
                sessionAwayStartedAt: leftAt,
                sessionAwayWasRunning: Boolean(state.sessionAwayWasRunning || state.status === 'running'),
                pomodoroPhaseStartedAt: null,
                pomodoroPhaseAccumulatedMs: pomodoroElapsedMs
            }, { notify: false });

            removeShell();
            renderAnalyticsSummary();
            return nextState;
        }

        function handleVisibilityChange(hidden) {
            const state = getState();

            if (!state.active || state.suspended) {
                return state;
            }

            if (shouldRunInBackground()) {
                if (hidden) {
                    if (state.status !== 'running' || state.sessionBackgroundStartedAt) {
                        return state;
                    }

                    return updateState({
                        sessionBackgroundStartedAt: getNowTimestamp()
                    }, { notify: false });
                }

                if (!state.sessionBackgroundStartedAt) {
                    return state;
                }

                const nextState = updateState({
                    sessionBackgroundMs: getCurrentBackgroundMs(state),
                    sessionBackgroundStartedAt: null
                }, { notify: false });

                syncPomodoroPhase();
                render();
                return nextState;
            }

            if (hidden) {
                if (state.status !== 'running' || state.sessionAwayStartedAt) {
                    return state;
                }

                const clocks = captureRunningClocks(state);
                const hiddenAt = clocks.now;
                const nextState = updateState({
                    status: 'paused',
                    pausedAt: hiddenAt,
                    startedAt: null,
                    accumulatedMs: clocks.taskElapsedMs,
                    sessionStartedAt: null,
                    sessionAccumulatedMs: clocks.sessionElapsedMs,
                    taskElapsedMsById: clocks.taskElapsedMsById,
                    sessionAwayStartedAt: hiddenAt,
                    sessionAwayWasRunning: true,
                    pomodoroPhaseStartedAt: null,
                    pomodoroPhaseAccumulatedMs: clocks.pomodoroPhaseElapsedMs
                }, { notify: false });

                stopTimer();
                return nextState;
            }

            if (!state.sessionAwayStartedAt) {
                return state;
            }

            const returnedAt = getNowTimestamp();
            const shouldResume = Boolean(state.sessionAwayWasRunning);
            const nextState = updateState({
                status: shouldResume ? 'running' : 'paused',
                pausedAt: shouldResume ? null : returnedAt,
                startedAt: shouldResume ? returnedAt : null,
                sessionStartedAt: shouldResume ? returnedAt : null,
                sessionAwayMs: getCurrentAwayMs(state),
                sessionAwayStartedAt: null,
                sessionAwayWasRunning: false,
                pomodoroPhaseStartedAt: shouldResume && getPomodoroConfig(state).enabled ? returnedAt : null
            }, { notify: false });

            render();
            return nextState;
        }

        function finishSession() {
            const state = getState();

            if (!state.active) {
                return state;
            }

            return endSession('manual', true);
        }

        function previewForDeveloper(previewType) {
            const type = String(previewType || 'focus').toLowerCase();

            if (type === 'summary') {
                const previewRecord = {
                    id: 'race-preview-summary',
                    startedAt: new Date(getNowMs() - (62 * 60 * 1000)).toISOString(),
                    completedAt: getNowTimestamp(),
                    elapsedMs: 52 * 60 * 1000,
                    focusMs: 50 * 60 * 1000,
                    breakMs: 10 * 60 * 1000,
                    pausedMs: 2 * 60 * 1000,
                    awayMs: 0,
                    selectedCount: 3,
                    completedCount: 3,
                    completedSubtaskCount: 2,
                    completedTodoIds: ['dev-race-1', 'dev-race-2', 'dev-race-3'],
                    completedTodos: [
                        { id: 'dev-race-1', title: 'Repasar el tema principal', type: 'tarea' },
                        { id: 'dev-race-2', title: 'Resolver ejercicios clave', type: 'hito' },
                        { id: 'dev-race-3', title: 'Preparar apuntes finales', type: 'tarea' }
                    ],
                    mode: 'countdown',
                    targetMs: 55 * 60 * 1000,
                    targetReached: false,
                    pomodoroEnabled: true,
                    pomodoroCompletedCycles: 2,
                    pomodoroTargetCycles: 2,
                    completedBreaks: 1,
                    result: 'manual'
                };
                showSessionSummary({ ...previewRecord, ...evaluateSession(previewRecord) });
                return { status: 'summary-preview' };
            }

            const todo = getSetupTodo();
            if (!todo) {
                return { status: 'empty' };
            }

            const countdown = type !== 'free';
            const nextState = start(todo.id, {
                mode: countdown ? 'countdown' : 'free',
                pomodoroEnabled: type === 'focus' || type === 'break' || type === 'paused',
                pomodoroWorkMs: 25 * 60 * 1000,
                pomodoroBreakMs: 5 * 60 * 1000,
                pomodoroTargetCycles: 2,
                targetMs: 55 * 60 * 1000
            });

            if (type === 'break') {
                updateState({
                    pomodoroPhase: 'break',
                    pomodoroPhaseStartedAt: getNowTimestamp(),
                    pomodoroPhaseAccumulatedMs: 0,
                    pomodoroPhaseTargetMs: 5 * 60 * 1000,
                    pomodoroCompletedCycles: 1
                }, { notify: false });
                render();
            } else if (type === 'paused') {
                pause();
            }

            return nextState;
        }

        function getTimerSnapshot() {
            const state = syncPomodoroPhase();

            return {
                timer: getTimerPresentation(state),
                pomodoro: getPomodoroPresentation(state)
            };
        }

        return {
            featureId,
            enable,
            disable,
            isEnabled,
            openSetup,
            openLauncher,
            openResumePrompt,
            start,
            pause,
            resume,
            resumeSession,
            startNewSession,
            completeAndContinue,
            finishSession,
            toggleSubtaskInFocus,
            skipToNext,
            leave,
            exit: leave,
            handleVisibilityChange,
            render,
            getState,
            getLaunchState,
            prepareForEntry,
            getTimerSnapshot,
            getWeeklySummary,
            previewForDeveloper
        };
    }

    function createBetaFeatureControllers(options) {
        const config = options || {};
        const focus = createFocusBetaController(config);

        return {
            focus,
            enable(featureId, updateOptions) {
                if (featureId === focus.featureId) {
                    return focus.enable(updateOptions);
                }

                return config.registry && typeof config.registry.setEnabled === 'function'
                    ? config.registry.setEnabled(featureId, true, updateOptions || { render: false })
                    : false;
            },
            disable(featureId, updateOptions) {
                if (featureId === focus.featureId) {
                    return focus.disable(updateOptions);
                }

                return config.registry && typeof config.registry.setEnabled === 'function'
                    ? config.registry.setEnabled(featureId, false, updateOptions || { render: false })
                    : false;
            },
            render() {
                focus.render();
            }
        };
    }

    function normalizeFeatureDefinition(definition) {
        if (!definition || typeof definition.id !== 'string' || !definition.id.trim()) {
            throw new Error('Feature definition requires an id.');
        }

        return {
            id: definition.id.trim(),
            label: typeof definition.label === 'string' ? definition.label : definition.id.trim(),
            description: typeof definition.description === 'string' ? definition.description : '',
            defaultEnabled: Boolean(definition.defaultEnabled),
            defaultState: isPlainObject(definition.defaultState) ? cloneData(definition.defaultState) : {},
            init: typeof definition.init === 'function' ? definition.init : noop,
            render: typeof definition.render === 'function' ? definition.render : noop,
            destroy: typeof definition.destroy === 'function' ? definition.destroy : noop
        };
    }

    function mergeFeatureState(defaultState, savedState) {
        return {
            ...(isPlainObject(defaultState) ? cloneData(defaultState) : {}),
            ...(isPlainObject(savedState) ? cloneData(savedState) : {})
        };
    }

    function normalizeFeatureStorage(rawStorage, definitions) {
        const definitionList = Array.isArray(definitions) ? definitions.map(normalizeFeatureDefinition) : [];
        const raw = isPlainObject(rawStorage) ? rawStorage : {};
        const rawFeatures = isPlainObject(raw.features) ? raw.features : raw;
        const features = {};

        definitionList.forEach(definition => {
            const savedRecord = isPlainObject(rawFeatures[definition.id]) ? rawFeatures[definition.id] : {};

            features[definition.id] = {
                enabled: typeof savedRecord.enabled === 'boolean' ? savedRecord.enabled : definition.defaultEnabled,
                state: mergeFeatureState(definition.defaultState, savedRecord.state)
            };
        });

        return {
            version: FEATURE_STORAGE_VERSION,
            features
        };
    }

    function createFeatureRegistry(options) {
        const config = options || {};
        const storage = config.storage || null;
        const storageKey = config.storageKey || 'tasklyzen-local-features';
        const getContext = typeof config.getContext === 'function' ? config.getContext : () => ({});
        const onChange = typeof config.onChange === 'function' ? config.onChange : noop;
        const definitions = new Map();
        const initializedFeatures = new Set();
        let featureStorage = { version: FEATURE_STORAGE_VERSION, features: {} };

        function readStorage() {
            return storage && typeof storage.readJson === 'function' ? storage.readJson(storageKey, {}) : {};
        }

        function writeStorage() {
            if (storage && typeof storage.writeJson === 'function') {
                storage.writeJson(storageKey, featureStorage);
            }
        }

        function getDefinitionList() {
            return Array.from(definitions.values());
        }

        function ensureFeatureRecord(featureId) {
            const definition = definitions.get(featureId);

            if (!definition) {
                return null;
            }

            if (!featureStorage.features[featureId]) {
                featureStorage.features[featureId] = {
                    enabled: definition.defaultEnabled,
                    state: cloneData(definition.defaultState)
                };
            }

            return featureStorage.features[featureId];
        }

        function getPublicDefinition(definition) {
            return {
                id: definition.id,
                label: definition.label,
                description: definition.description,
                defaultEnabled: definition.defaultEnabled,
                defaultState: cloneData(definition.defaultState)
            };
        }

        function getSnapshot() {
            return cloneData(featureStorage);
        }

        function getFeatureState(featureId) {
            const record = ensureFeatureRecord(featureId);

            return record ? cloneData(record.state) : {};
        }

        function isEnabled(featureId) {
            const record = ensureFeatureRecord(featureId);

            return Boolean(record && record.enabled);
        }

        function setFeatureState(featureId, nextState, updateOptions) {
            const record = ensureFeatureRecord(featureId);

            if (!record) {
                return {};
            }

            record.state = isPlainObject(nextState) ? cloneData(nextState) : {};
            writeStorage();

            if (!updateOptions || updateOptions.notify !== false) {
                onChange(getSnapshot());
            }

            return getFeatureState(featureId);
        }

        function updateFeatureState(featureId, patch, updateOptions) {
            return setFeatureState(featureId, {
                ...getFeatureState(featureId),
                ...(isPlainObject(patch) ? patch : {})
            }, updateOptions);
        }

        function createFeatureScope(featureId) {
            return {
                id: featureId,
                isEnabled: () => isEnabled(featureId),
                getState: () => getFeatureState(featureId),
                setState: (nextState, updateOptions) => setFeatureState(featureId, nextState, updateOptions),
                updateState: (patch, updateOptions) => updateFeatureState(featureId, patch, updateOptions)
            };
        }

        function callFeature(definition, methodName) {
            const method = definition[methodName];

            if (typeof method !== 'function') {
                return;
            }

            method(getContext(), createFeatureScope(definition.id));
        }

        function initFeature(definition) {
            const record = ensureFeatureRecord(definition.id);

            if (!record || !record.enabled || initializedFeatures.has(definition.id)) {
                return;
            }

            callFeature(definition, 'init');
            initializedFeatures.add(definition.id);
        }

        function destroyFeature(definition) {
            if (!initializedFeatures.has(definition.id)) {
                return;
            }

            callFeature(definition, 'destroy');
            initializedFeatures.delete(definition.id);
        }

        function register(definition) {
            const normalizedDefinition = normalizeFeatureDefinition(definition);

            definitions.set(normalizedDefinition.id, normalizedDefinition);
            featureStorage = normalizeFeatureStorage(featureStorage, getDefinitionList());

            return getPublicDefinition(normalizedDefinition);
        }

        function load() {
            featureStorage = normalizeFeatureStorage(readStorage(), getDefinitionList());

            return getSnapshot();
        }

        function reload() {
            const previousEnabled = new Map(getDefinitionList().map(definition => [definition.id, isEnabled(definition.id)]));

            load();
            getDefinitionList().forEach(definition => {
                const wasEnabled = previousEnabled.get(definition.id);
                const nextEnabled = isEnabled(definition.id);

                if (wasEnabled && !nextEnabled) {
                    destroyFeature(definition);
                } else if (!wasEnabled && nextEnabled) {
                    initFeature(definition);
                }
            });

            return getSnapshot();
        }

        function init() {
            getDefinitionList().forEach(initFeature);
        }

        function render() {
            getDefinitionList().forEach(definition => {
                if (!isEnabled(definition.id)) {
                    return;
                }

                initFeature(definition);
                callFeature(definition, 'render');
            });
        }

        function destroy(featureId) {
            if (featureId) {
                const definition = definitions.get(featureId);

                if (definition) {
                    destroyFeature(definition);
                }

                return;
            }

            getDefinitionList().forEach(destroyFeature);
        }

        function setEnabled(featureId, enabled, updateOptions) {
            const definition = definitions.get(featureId);
            const record = ensureFeatureRecord(featureId);

            if (!definition || !record) {
                return false;
            }

            record.enabled = Boolean(enabled);
            writeStorage();

            if (record.enabled) {
                initFeature(definition);

                if (!updateOptions || updateOptions.render !== false) {
                    callFeature(definition, 'render');
                }
            } else {
                destroyFeature(definition);
            }

            if (!updateOptions || updateOptions.notify !== false) {
                onChange(getSnapshot());
            }

            return record.enabled;
        }

        (Array.isArray(config.definitions) ? config.definitions : plannedLocalFeatures).forEach(register);
        load();

        return {
            register,
            load,
            reload,
            init,
            render,
            destroy,
            isEnabled,
            setEnabled,
            getFeatureState,
            setFeatureState,
            updateFeatureState,
            getDefinitions: () => getDefinitionList().map(getPublicDefinition),
            getSnapshot
        };
    }

    global.TasklyzenFeatures = {
        plannedLocalFeatures,
        normalizeFeatureDefinition,
        normalizeFeatureStorage,
        createFocusBetaController,
        createBetaFeatureControllers,
        createFeatureRegistry
    };
})(window);
