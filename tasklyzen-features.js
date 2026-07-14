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
                selectedTodoId: null,
                status: 'idle',
                startedAt: null,
                pausedAt: null,
                accumulatedMs: 0,
                focusSubtaskDraft: null,
                mode: 'free',
                targetMs: 0,
                sessionCreatedAt: null,
                sessionStartedAt: null,
                sessionAccumulatedMs: 0,
                sessionCompletedTodoIds: [],
                taskElapsedMsById: {},
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
        const analyticsDom = config.analyticsDom || {};
        let shell = null;
        let setupShell = null;
        let summaryShell = null;
        let timer = null;
        let lastTimeAlert = '';

        const MAX_SESSION_HISTORY = 80;
        const COUNTDOWN_PRESETS = [10, 25, 45];

        function isEnabled() {
            return alwaysEnabled || Boolean(registry && registry.isEnabled(featureId));
        }

        function getState() {
            return registry && typeof registry.getFeatureState === 'function'
                ? registry.getFeatureState(featureId)
                : {};
        }

        function updateState(patch, updateOptions) {
            return registry && typeof registry.updateFeatureState === 'function'
                ? registry.updateFeatureState(featureId, patch, updateOptions || { notify: false })
                : {};
        }

        function getNowMs() {
            const parsed = Date.parse(getNowTimestamp());

            return Number.isFinite(parsed) ? parsed : Date.now();
        }

        function parseMs(timestamp) {
            const parsed = Date.parse(timestamp || '');

            return Number.isFinite(parsed) ? parsed : null;
        }

        function getActiveTodos() {
            return getTodos().filter(todo => todo && !todo.completed);
        }

        function getSelectedTodo(state) {
            const todos = getActiveTodos();
            const selected = todos.find(todo => todo && todo.id === state.selectedTodoId);
            const topPriorityTodo = getTopPriorityTodo();

            return selected || (topPriorityTodo && !topPriorityTodo.completed ? topPriorityTodo : null) || todos[0] || null;
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

        function getTaskElapsedMap(state) {
            return isPlainObject(state && state.taskElapsedMsById)
                ? { ...state.taskElapsedMsById }
                : {};
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
                : (Math.floor(taskElapsedMs / 1000) % 60) / 60;

            return {
                mode,
                targetMs,
                taskElapsedMs,
                sessionElapsedMs,
                remainingMs,
                progress,
                primaryLabel: targetMs ? 'Tiempo restante' : 'Tiempo en tarea',
                primaryValue: formatElapsed(targetMs ? remainingMs : taskElapsedMs)
            };
        }

        function stopTimer() {
            if (timer) {
                windowRef.clearInterval(timer);
                timer = null;
            }
        }

        function updateTimeAlert(presentation) {
            if (!shell || !presentation.targetMs) {
                return;
            }

            const alertNode = shell.querySelector('[data-focus-beta-alert]');
            if (!alertNode) {
                return;
            }

            const ratio = presentation.targetMs ? presentation.sessionElapsedMs / presentation.targetMs : 0;
            let nextAlert = '';
            let tone = '';

            if (presentation.remainingMs <= 0) {
                nextAlert = 'Tiempo cumplido. Puedes continuar sin presión.';
                tone = 'finished';
            } else if (ratio >= 0.8) {
                nextAlert = 'Último tramo. Decide el siguiente paso con calma.';
                tone = 'final-stretch';
            } else if (ratio >= 0.5) {
                nextAlert = 'Vas a mitad del tiempo. Mantén el ritmo.';
                tone = 'halfway';
            }

            if (!nextAlert) {
                alertNode.hidden = true;
                alertNode.textContent = '';
                shell.dataset.focusAlert = '';
                return;
            }

            if (lastTimeAlert !== tone) {
                lastTimeAlert = tone;
                alertNode.textContent = nextAlert;
            }

            alertNode.hidden = false;
            shell.dataset.focusAlert = tone;
        }

        function updateTimerText() {
            if (!shell || !shell.querySelector) {
                return;
            }

            const presentation = getTimerPresentation(getState());
            const timerNode = shell.querySelector('[data-focus-beta-timer]');
            const timerLabelNode = shell.querySelector('[data-focus-beta-timer-label]');
            const taskTimeNode = shell.querySelector('[data-focus-beta-task-time]');
            const sessionTimeNode = shell.querySelector('[data-focus-beta-session-time]');

            if (timerNode) {
                timerNode.textContent = presentation.primaryValue;
            }

            if (timerLabelNode) {
                timerLabelNode.textContent = presentation.primaryLabel;
            }

            if (taskTimeNode) {
                taskTimeNode.textContent = formatElapsed(presentation.taskElapsedMs);
            }

            if (sessionTimeNode) {
                sessionTimeNode.textContent = formatElapsed(presentation.sessionElapsedMs);
            }

            if (shell.style && typeof shell.style.setProperty === 'function') {
                const progressDegrees = Math.round(presentation.progress * 360);

                shell.style.setProperty('--focus-progress', progressDegrees + 'deg');
            }

            updateTimeAlert(presentation);
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
                '<p class="section-kicker">Modo Carrera</p>',
                '<h2 data-focus-beta-title>Tarea actual</h2>',
                '<p data-focus-beta-status>Temporizador listo</p>',
                '<span data-focus-beta-count class="beta-focus-count">0 de 0</span>',
                '<div class="beta-focus-time-summary" aria-label="Tiempo de enfoque">',
                '<span><small>Esta tarea</small><strong data-focus-beta-task-time>00:00</strong></span>',
                '<span><small>Sesión</small><strong data-focus-beta-session-time>00:00</strong></span>',
                '</div>',
                '<p class="beta-focus-alert" data-focus-beta-alert aria-live="polite" hidden></p>',
                '<div data-focus-beta-subtasks class="beta-focus-subtasks" hidden></div>',
                '<div class="beta-focus-actions">',
                '<button type="button" data-focus-beta-action="complete-next">Completar y seguir</button>',
                '<button type="button" data-focus-beta-action="pause">Pausar</button>',
                '<button type="button" data-focus-beta-action="skip">Siguiente</button>',
                '<button type="button" data-focus-beta-action="exit">Salir</button>',
                '</div>',
                '</section>'
            ].join('');
            shell.addEventListener('click', event => {
                if (event.target === shell) {
                    exit();
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
                } else if (button.dataset.focusBetaAction === 'exit') {
                    exit();
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

        function removeSummaryShell() {
            if (summaryShell && summaryShell.remove) {
                summaryShell.remove();
            } else if (summaryShell && summaryShell.parentNode) {
                summaryShell.parentNode.removeChild(summaryShell);
            }

            summaryShell = null;
        }

        function getSetupTodo(todoId) {
            const todos = getActiveTodos();
            const topPriorityTodo = getTopPriorityTodo();

            return todos.find(todo => todo && todo.id === todoId)
                || (topPriorityTodo && !topPriorityTodo.completed ? topPriorityTodo : null)
                || todos[0]
                || null;
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
            if (countdownOptions) {
                const shouldShowCountdown = mode === 'countdown';

                countdownOptions.hidden = !shouldShowCountdown;
                countdownOptions.setAttribute('aria-hidden', (!shouldShowCountdown).toString());

                if (shouldShowCountdown && !countdownOptions.querySelector('.is-selected')) {
                    const suggestedOption = countdownOptions.querySelector('[data-focus-setup-duration="25"]');
                    if (suggestedOption) {
                        selectSetupDuration(suggestedOption);
                    }
                }
            }
        }

        function getSetupTargetMs() {
            if (!setupShell || setupShell.dataset.focusSetupMode !== 'countdown') {
                return 0;
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

        function startRaceFromSetup() {
            if (!setupShell) {
                return;
            }

            const selectedTodoId = setupShell.dataset.focusSetupTodoId;
            const mode = normalizeRaceMode(setupShell.dataset.focusSetupMode);
            const targetMs = getSetupTargetMs();

            if (mode === 'countdown' && !targetMs) {
                const customInput = setupShell.querySelector('[data-focus-setup-custom]');
                if (customInput && typeof customInput.focus === 'function') {
                    customInput.focus();
                }
                return;
            }

            removeSetupShell();
            start(selectedTodoId, { mode, targetMs });
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
            setupShell.tabIndex = -1;
            setupShell.setAttribute('role', 'dialog');
            setupShell.setAttribute('aria-modal', 'true');
            setupShell.setAttribute('aria-label', 'Preparar Modo Carrera');
            setupShell.innerHTML = [
                '<section class="beta-focus-setup-card">',
                '<p class="section-kicker">Modo Carrera</p>',
                '<h2>Elige tu ritmo</h2>',
                '<p class="beta-focus-setup-task"></p>',
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
                '<div class="beta-focus-setup-actions">',
                '<button type="button" data-focus-setup-action="start">Empezar carrera</button>',
                '<button type="button" data-focus-setup-action="cancel">Ahora no</button>',
                '</div>',
                '</section>'
            ].join('');

            const taskLabel = setupShell.querySelector('.beta-focus-setup-task');
            if (taskLabel) {
                taskLabel.textContent = todo.text || 'Tarea sin título';
            }

            setSetupMode('free');

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
            setupShell.querySelectorAll('[data-focus-setup-duration]').forEach(button => {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectSetupDuration(button);
                });
            });
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
                if (!event.target.matches('[data-focus-setup-custom]')) {
                    return;
                }

                setupShell.querySelectorAll('[data-focus-setup-duration]').forEach(option => {
                    option.classList.remove('is-selected');
                    option.setAttribute('aria-pressed', 'false');
                });
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
            getSubtasks(todo)
                .map((subtask, index) => {
                    const originalIndex = originalOrder.indexOf(subtask.id);

                    return {
                        subtask,
                        index: originalIndex >= 0 ? originalIndex : index,
                        completed: isSubtaskCompleteInFocus(todo, subtask, state)
                    };
                })
                .sort((left, right) => Number(left.completed) - Number(right.completed) || left.index - right.index)
                .forEach(({ subtask, completed }) => {
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

            return {
                id: 'race-' + getNowMs().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
                startedAt: state.sessionCreatedAt || state.sessionStartedAt || getNowTimestamp(),
                completedAt: getNowTimestamp(),
                mode: targetMs ? 'countdown' : 'free',
                targetMs,
                elapsedMs: sessionElapsedMs,
                completedCount: completedTodoIds.length,
                completedTodoIds,
                result: result || 'exited',
                targetReached: Boolean(targetMs && sessionElapsedMs >= targetMs)
            };
        }

        function getIdleState(state, history) {
            return {
                active: false,
                selectedTodoId: null,
                status: 'idle',
                startedAt: null,
                pausedAt: null,
                accumulatedMs: 0,
                focusSubtaskDraft: null,
                mode: 'free',
                targetMs: 0,
                sessionCreatedAt: null,
                sessionStartedAt: null,
                sessionAccumulatedMs: 0,
                sessionCompletedTodoIds: [],
                taskElapsedMsById: {},
                history: Array.isArray(history) ? history.slice(0, MAX_SESSION_HISTORY) : getSessionHistory(state)
            };
        }

        function getWeeklySummary() {
            const state = getState();
            const sevenDaysAgo = getNowMs() - (7 * 24 * 60 * 60 * 1000);
            const sessions = getSessionHistory(state).filter(session => {
                const completedAt = parseMs(session.completedAt);

                return completedAt !== null && completedAt >= sevenDaysAgo;
            });
            const targetSessions = sessions.filter(session => normalizeTargetMs(session.targetMs) > 0);
            const successfulTargets = targetSessions.filter(session => !session.targetReached).length;

            return {
                sessions: sessions.length,
                elapsedMs: sessions.reduce((total, session) => total + Math.max(Number(session.elapsedMs) || 0, 0), 0),
                completedCount: sessions.reduce((total, session) => total + Math.max(Number(session.completedCount) || 0, 0), 0),
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
                analyticsDom.minutes.textContent = formatDuration(summary.elapsedMs);
            }

            if (analyticsDom.sessions) {
                analyticsDom.sessions.textContent = summary.sessions + (summary.sessions === 1 ? ' sesión' : ' sesiones');
            }

            if (analyticsDom.targets) {
                analyticsDom.targets.textContent = summary.targetSessions
                    ? summary.successfulTargets + '/' + summary.targetSessions + ' metas respetadas'
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

            const targetMessage = record.targetMs
                ? (record.targetReached
                    ? 'La meta de tiempo terminó; seguiste avanzando.'
                    : 'Cerraste antes de que terminara tu meta de tiempo.')
                : 'Tuviste una sesión de enfoque a tu ritmo.';
            summaryShell.innerHTML = [
                '<section class="beta-focus-summary-card">',
                '<p class="section-kicker">Carrera cerrada</p>',
                '<h2>Buen tramo de enfoque</h2>',
                '<p>' + targetMessage + '</p>',
                '<div class="beta-focus-summary-metrics">',
                '<span><strong>' + formatDuration(record.elapsedMs) + '</strong><small>enfocado</small></span>',
                '<span><strong>' + record.completedCount + '</strong><small>tareas cerradas</small></span>',
                record.targetMs ? '<span><strong>' + formatDuration(record.targetMs) + '</strong><small>meta elegida</small></span>' : '',
                '</div>',
                '<button type="button" data-focus-summary-action="close">Volver a tareas</button>',
                '</section>'
            ].join('');
            summaryShell.addEventListener('click', event => {
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

            const closeButton = summaryShell.querySelector('[data-focus-summary-action="close"]');
            if (closeButton && typeof closeButton.focus === 'function') {
                closeButton.focus({ preventScroll: true });
            }
        }

        function endSession(result, showSummary) {
            const state = getState();
            const record = buildSessionRecord(state, result);
            const history = [record].concat(getSessionHistory(state)).slice(0, MAX_SESSION_HISTORY);

            stopTimer();
            lastTimeAlert = '';
            const nextState = updateState(getIdleState(state, history), { notify: false });
            removeShell();
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
            lastTimeAlert = '';

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
            const state = getState();

            renderAnalyticsSummary();

            if (!isEnabled() || !state.active) {
                removeShell();
                return;
            }

            const todo = getSelectedTodo(state);

            if (!todo) {
                updateState({
                    active: false,
                    selectedTodoId: null,
                    status: 'idle',
                    startedAt: null,
                    pausedAt: null,
                    accumulatedMs: 0,
                    focusSubtaskDraft: null
                }, { notify: false });
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

            updateTimerText();
            startTimerIfNeeded(state);
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

            const selectedTodo = getSetupTodo(todoId);

            if (!selectedTodo || selectedTodo.completed) {
                return {
                    status: 'empty',
                    message: 'No hay una tarea disponible para iniciar Modo Carrera.'
                };
            }

            removeSetupShell();
            removeSummaryShell();
            lastTimeAlert = '';
            const raceMode = normalizeRaceMode(mode.mode);
            const targetMs = raceMode === 'countdown' ? normalizeTargetMs(mode.targetMs) : 0;
            const taskElapsedMs = Math.max(Number(mode.accumulatedMs) || 0, 0);
            const startedAt = getNowTimestamp();
            const nextState = updateState({
                active: true,
                selectedTodoId: selectedTodo.id,
                status: 'running',
                startedAt,
                pausedAt: null,
                accumulatedMs: taskElapsedMs,
                focusSubtaskDraft: null,
                mode: targetMs ? 'countdown' : 'free',
                targetMs,
                sessionCreatedAt: startedAt,
                sessionStartedAt: startedAt,
                sessionAccumulatedMs: 0,
                sessionCompletedTodoIds: [],
                taskElapsedMsById: {
                    [selectedTodo.id]: taskElapsedMs
                }
            }, { notify: false });

            render();
            return nextState;
        }

        function selectNextTodo() {
            const nextTodo = getSelectedTodo({ selectedTodoId: null });

            if (!nextTodo) {
                return endSession('completed', true);
            }

            lastTimeAlert = '';
            const state = getState();
            const taskElapsedMsById = getTaskElapsedMap(state);
            const nextTaskElapsedMs = Math.max(Number(taskElapsedMsById[nextTodo.id]) || 0, 0);
            const nextState = updateState({
                active: true,
                selectedTodoId: nextTodo.id,
                status: 'running',
                startedAt: getNowTimestamp(),
                pausedAt: null,
                accumulatedMs: nextTaskElapsedMs,
                focusSubtaskDraft: null,
                taskElapsedMsById
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

            const completed = onCompleteTodo(todo.id, {
                elapsedMs: getElapsedMs(state),
                todo
            });

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

            changedSubtasks.forEach(subtask => {
                const liveTodo = getTodos().find(item => item && item.id === todo.id);
                const liveSubtask = liveTodo && Array.isArray(liveTodo.subtasks)
                    ? liveTodo.subtasks.find(item => item.id === subtask.id)
                    : null;

                if (liveSubtask && Boolean(liveSubtask.completed) !== Boolean(completedMap[subtask.id])) {
                    onToggleSubtask(todo.id, subtask.id, {
                        elapsedMs: getElapsedMs(state),
                        todo
                    });
                }
            });

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
            const state = getState();
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

            lastTimeAlert = '';
            const taskElapsedMsById = getTaskElapsedMap(state);
            taskElapsedMsById[todo.id] = getElapsedMs(state);
            const nextTodo = activeTodos[nextIndex];
            const nextState = updateState({
                selectedTodoId: nextTodo.id,
                startedAt: state.status === 'running' ? getNowTimestamp() : null,
                pausedAt: state.status === 'paused' ? getNowTimestamp() : null,
                accumulatedMs: Math.max(Number(taskElapsedMsById[nextTodo.id]) || 0, 0),
                focusSubtaskDraft: null,
                taskElapsedMsById
            });

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
                sessionStartedAt: null,
                taskElapsedMsById
            }, { notify: false });

            render();
            return nextState;
        }

        function resume() {
            const state = getState();

            if (!isEnabled() || !state.active || state.status !== 'paused') {
                return state;
            }

            const nextState = updateState({
                ...state,
                status: 'running',
                startedAt: getNowTimestamp(),
                pausedAt: null,
                sessionStartedAt: getNowTimestamp()
            }, { notify: false });

            render();
            return nextState;
        }

        function exit() {
            const state = getState();
            const hasMeaningfulSession = getSessionElapsedMs(state) >= 1000 || getCompletedTodoIds(state).length > 0;

            if (hasMeaningfulSession) {
                return endSession('exited', false);
            }

            stopTimer();
            updateState(getIdleState(state), { notify: false });
            removeShell();
            renderAnalyticsSummary();
            return getState();
        }

        return {
            featureId,
            enable,
            disable,
            isEnabled,
            openSetup,
            start,
            pause,
            resume,
            completeAndContinue,
            toggleSubtaskInFocus,
            skipToNext,
            exit,
            render,
            getState,
            getWeeklySummary
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
