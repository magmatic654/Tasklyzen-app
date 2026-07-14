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
                focusSubtaskDraft: null
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
        let shell = null;
        let timer = null;

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

        function formatElapsed(ms) {
            const totalSeconds = Math.floor(Math.max(Number(ms) || 0, 0) / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
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

            const elapsedMs = getElapsedMs(getState());
            const timerNode = shell.querySelector('[data-focus-beta-timer]');

            if (timerNode) {
                timerNode.textContent = formatElapsed(elapsedMs);
            }

            if (shell.style && typeof shell.style.setProperty === 'function') {
                const progressDegrees = Math.floor(Math.max(elapsedMs, 0) / 1000) % 60 * 6;

                shell.style.setProperty('--focus-progress', progressDegrees + 'deg');
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
                '<p class="section-kicker">Modo Carrera</p>',
                '<h2 data-focus-beta-title>Tarea actual</h2>',
                '<p data-focus-beta-status>Temporizador listo</p>',
                '<span data-focus-beta-count class="beta-focus-count">0 de 0</span>',
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
            const state = getState();

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
                        : 'Cronometra esta tarea; al terminar pasas a la siguiente.';
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

            const todos = getActiveTodos();
            const topPriorityTodo = getTopPriorityTodo();
            const selectedTodo = todos.find(todo => todo && todo.id === todoId)
                || (topPriorityTodo && !topPriorityTodo.completed ? topPriorityTodo : null)
                || todos.find(todo => todo && !todo.completed)
                || null;

            if (!selectedTodo || selectedTodo.completed) {
                return {
                    status: 'empty',
                    message: 'No hay una tarea disponible para iniciar Modo Carrera.'
                };
            }

            const nextState = updateState({
                active: true,
                selectedTodoId: selectedTodo.id,
                status: 'running',
                startedAt: getNowTimestamp(),
                pausedAt: null,
                accumulatedMs: Math.max(Number(mode.accumulatedMs) || 0, 0),
                focusSubtaskDraft: null
            }, { notify: false });

            render();
            return nextState;
        }

        function selectNextTodo(resetOptions) {
            const mode = resetOptions || {};
            const nextTodo = getSelectedTodo({ selectedTodoId: null });

            if (!nextTodo) {
                const nextState = updateState({
                    active: false,
                    selectedTodoId: null,
                    status: 'complete',
                    startedAt: null,
                    pausedAt: null,
                    accumulatedMs: 0,
                    focusSubtaskDraft: null
                }, { notify: false });

                removeShell();
                onSessionComplete(nextState);
                return nextState;
            }

            const nextState = updateState({
                active: true,
                selectedTodoId: nextTodo.id,
                status: 'running',
                startedAt: getNowTimestamp(),
                pausedAt: null,
                accumulatedMs: Math.max(Number(mode.accumulatedMs) || 0, 0),
                focusSubtaskDraft: null
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
                return start(activeTodos[0].id, {
                    accumulatedMs: 0
                });
            }

            const currentIndex = activeTodos.findIndex(item => item.id === todo.id);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % activeTodos.length : 0;

            return start(activeTodos[nextIndex].id, {
                accumulatedMs: 0
            });
        }

        function pause() {
            const state = getState();

            if (!isEnabled() || !state.active || state.status !== 'running') {
                return state;
            }

            const nextState = updateState({
                ...state,
                status: 'paused',
                pausedAt: getNowTimestamp(),
                accumulatedMs: getElapsedMs(state),
                startedAt: null
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
                pausedAt: null
            }, { notify: false });

            render();
            return nextState;
        }

        function exit() {
            const nextState = updateState({
                active: false,
                selectedTodoId: null,
                status: 'idle',
                startedAt: null,
                pausedAt: null,
                accumulatedMs: 0,
                focusSubtaskDraft: null
            }, { notify: false });

            removeShell();
            return nextState;
        }

        return {
            featureId,
            enable,
            disable,
            isEnabled,
            start,
            pause,
            resume,
            completeAndContinue,
            toggleSubtaskInFocus,
            skipToNext,
            exit,
            render,
            getState
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
