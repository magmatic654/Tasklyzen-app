/*
 * Modulo: revision segura de tareas vencidas
 * Proposito: calcular vencimientos, persistir revisiones y coordinar su dialogo.
 * Entradas: tareas, fecha actual, almacenamiento, DOM y callbacks del runtime.
 * Salidas: funciones puras y createOverdueReviewController.
 * Dependencias: TasklyzenTasks y TasklyzenUiComponents.
 */
(function exposeTasklyzenOverdueReview(global) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const DECISIONS = ['keep', 'delete'];

    function asDate(value) {
        const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getDueAt(task, taskApi) {
        const dueDate = taskApi && typeof taskApi.getTaskDueDate === 'function'
            ? taskApi.getTaskDueDate(task)
            : task && typeof task.dueDate === 'string' ? task.dueDate : null;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ''))) {
            return null;
        }

        return asDate(dueDate + 'T23:59:59.999');
    }

    function isOverdueTask(task, now, options) {
        const config = options || {};
        const current = asDate(now || new Date());
        const dueAt = getDueAt(task, config.taskApi || global.TasklyzenTasks);

        if (!task || !current || !dueAt || task.completed || task.deletedAt) {
            return false;
        }

        if (task.archived || task.protected || task.pinned || (typeof config.isProtectedTask === 'function' && config.isProtectedTask(task))) {
            return false;
        }

        return dueAt.getTime() < current.getTime();
    }

    function getOverdueDays(task, now, options) {
        const config = options || {};
        const current = asDate(now || new Date());
        const dueAt = getDueAt(task, config.taskApi || global.TasklyzenTasks);

        if (!current || !dueAt || current <= dueAt) {
            return 0;
        }

        return Math.floor((current.getTime() - dueAt.getTime()) / DAY_MS);
    }

    function shouldAutoDeleteTask(task, now, options) {
        const config = options || {};
        const autoDeleteDays = Math.max(Math.round(Number(config.autoDeleteDays) || 30), 1);

        return isOverdueTask(task, now, config) && getOverdueDays(task, now, config) >= autoDeleteDays;
    }

    function getOverdueTasks(tasks, now, options) {
        return (Array.isArray(tasks) ? tasks : []).filter(task => isOverdueTask(task, now, options));
    }

    function getAutoDeleteTasks(tasks, now, options) {
        return (Array.isArray(tasks) ? tasks : []).filter(task => shouldAutoDeleteTask(task, now, options));
    }

    function normalizeReviewState(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const taskIds = Array.isArray(source.taskIds)
            ? [...new Set(source.taskIds.filter(id => typeof id === 'string' && id))]
            : [];
        const createdDate = asDate(source.createdAt);
        const lastDecisionDate = asDate(source.lastDecisionAt);
        const createdAt = createdDate ? createdDate.toISOString() : null;
        const lastDecisionAt = lastDecisionDate ? lastDecisionDate.toISOString() : null;
        const lastDecision = DECISIONS.includes(source.lastDecision) ? source.lastDecision : null;

        return {
            pending: Boolean(source.pending && createdAt && taskIds.length),
            createdAt: createdAt && taskIds.length ? createdAt : null,
            taskIds,
            lastDecisionAt,
            lastDecision
        };
    }

    function isReviewDue(state, now, intervalDays) {
        const normalized = normalizeReviewState(state);
        const current = asDate(now || new Date());
        const reference = asDate(normalized.lastDecisionAt);
        const days = Math.max(Math.round(Number(intervalDays) || 7), 1);

        if (!current || normalized.pending) {
            return false;
        }

        return !reference || current.getTime() - reference.getTime() >= days * DAY_MS;
    }

    function createPendingReview(state, tasks, now) {
        const current = asDate(now || new Date()) || new Date();
        const normalized = normalizeReviewState(state);

        return {
            ...normalized,
            pending: true,
            createdAt: current.toISOString(),
            taskIds: (Array.isArray(tasks) ? tasks : []).map(task => task.id).filter(Boolean)
        };
    }

    function resolveReview(state, decision, now) {
        const current = asDate(now || new Date()) || new Date();
        const normalized = normalizeReviewState(state);

        return {
            ...normalized,
            pending: false,
            createdAt: null,
            taskIds: [],
            lastDecisionAt: current.toISOString(),
            lastDecision: DECISIONS.includes(decision) ? decision : null
        };
    }

    function getReviewTasks(state, tasks, now, options) {
        const normalized = normalizeReviewState(state);
        const ids = new Set(normalized.taskIds);

        return (Array.isArray(tasks) ? tasks : []).filter(task => ids.has(task.id) && isOverdueTask(task, now, options));
    }

    function createOverdueReviewController(options) {
        const config = options || {};
        const storage = config.storage;
        const storageKey = config.storageKey;
        const dom = config.dom || {};
        const components = config.components || global.TasklyzenUiComponents;
        const taskOptions = {
            taskApi: config.taskApi || global.TasklyzenTasks,
            autoDeleteDays: config.autoDeleteDays || 30,
            isProtectedTask: config.isProtectedTask
        };
        const intervalDays = config.intervalDays || 7;
        let state = normalizeReviewState(storage && storage.readJson(storageKey, null));
        let initialized = false;

        function getNow() {
            return asDate(typeof config.getNow === 'function' ? config.getNow() : new Date()) || new Date();
        }

        function getTodos() {
            return typeof config.getTodos === 'function' ? config.getTodos() : [];
        }

        function persist(nextState) {
            if (!storage || !storageKey) {
                return false;
            }

            try {
                storage.writeJson(storageKey, nextState);
                state = normalizeReviewState(nextState);
                return true;
            } catch (error) {
                if (typeof config.onError === 'function') {
                    config.onError('No se pudo guardar la revisi\u00f3n de tareas vencidas.');
                }
                return false;
            }
        }

        function closeDialog() {
            if (!dom.overdueReviewDialog) return;
            if (typeof dom.overdueReviewDialog.close === 'function') {
                dom.overdueReviewDialog.close();
            } else {
                dom.overdueReviewDialog.removeAttribute('open');
            }
            setConfirmationVisible(false);
        }

        function openDialog() {
            if (!dom.overdueReviewDialog || dom.overdueReviewDialog.open) return;
            if (typeof dom.overdueReviewDialog.showModal === 'function') {
                dom.overdueReviewDialog.showModal();
            } else {
                dom.overdueReviewDialog.setAttribute('open', '');
            }
            if (dom.keepOverdueTasksButton) {
                dom.keepOverdueTasksButton.focus({ preventScroll: true });
            }
        }

        function setConfirmationVisible(visible, count) {
            if (dom.overdueReviewConfirmation) {
                dom.overdueReviewConfirmation.hidden = !visible;
            }
            if (dom.overdueReviewActions) {
                dom.overdueReviewActions.hidden = Boolean(visible);
            }
            if (dom.overdueReviewConfirmText && visible) {
                dom.overdueReviewConfirmText.textContent = count === 1
                    ? 'Se eliminar\u00e1 1 tarea vencida. Esta acci\u00f3n no se puede deshacer.'
                    : 'Se eliminar\u00e1n ' + count + ' tareas vencidas. Esta acci\u00f3n no se puede deshacer.';
            }
            if (visible && dom.confirmDeleteOverdueButton) {
                dom.confirmDeleteOverdueButton.focus({ preventScroll: true });
            }
        }

        function renderTasks(tasks, now) {
            if (!dom.overdueReviewList || !components) return;
            dom.overdueReviewList.replaceChildren();

            tasks.forEach(task => {
                dom.overdueReviewList.appendChild(components.createOverdueReviewItem({
                    documentRef: global.document,
                    task,
                    overdueDays: getOverdueDays(task, now, taskOptions),
                    dueDate: taskOptions.taskApi.getTaskDueDate(task)
                }));
            });
        }

        function render(tasks, now) {
            const count = tasks.length;
            if (dom.overdueReviewTitle) {
                dom.overdueReviewTitle.textContent = count === 1 ? 'Tienes 1 tarea vencida' : 'Tienes ' + count + ' tareas vencidas';
            }
            if (dom.overdueReviewCount) {
                dom.overdueReviewCount.textContent = String(count);
            }
            renderTasks(tasks, now);
            setConfirmationVisible(false);
            openDialog();
        }

        function clearStalePendingReview(now) {
            const cleared = resolveReview(state, null, now);
            cleared.lastDecisionAt = now.toISOString();
            return persist(cleared);
        }

        function refresh() {
            const now = getNow();
            let reviewTasks = getReviewTasks(state, getTodos(), now, taskOptions);

            if (state.pending && reviewTasks.length === 0) {
                clearStalePendingReview(now);
                closeDialog();
                return [];
            }

            if (!state.pending && isReviewDue(state, now, intervalDays)) {
                const overdueTasks = getOverdueTasks(getTodos(), now, taskOptions);
                if (overdueTasks.length > 0 && persist(createPendingReview(state, overdueTasks, now))) {
                    reviewTasks = overdueTasks;
                }
            }

            if (state.pending && reviewTasks.length > 0) {
                render(reviewTasks, now);
            } else {
                closeDialog();
            }

            return reviewTasks;
        }

        function forceReview(taskItems) {
            const now = getNow();
            const sourceTasks = Array.isArray(taskItems) ? taskItems : getTodos();
            const overdueTasks = getOverdueTasks(sourceTasks, now, taskOptions);

            if (overdueTasks.length === 0) {
                closeDialog();
                return [];
            }

            if (!persist(createPendingReview(state, overdueTasks, now))) {
                return [];
            }

            render(overdueTasks, now);
            return overdueTasks;
        }

        function keepTasks() {
            const currentTasks = getReviewTasks(state, getTodos(), getNow(), taskOptions);
            if (!persist(resolveReview(state, 'keep', getNow()))) return;
            closeDialog();
            if (typeof config.onKeep === 'function') config.onKeep(currentTasks);
        }

        function requestDelete() {
            const tasks = getReviewTasks(state, getTodos(), getNow(), taskOptions);
            if (tasks.length === 0) {
                refresh();
                return;
            }
            setConfirmationVisible(true, tasks.length);
        }

        function confirmDelete() {
            const now = getNow();
            const tasks = getReviewTasks(state, getTodos(), now, taskOptions);
            if (tasks.length === 0) {
                refresh();
                return;
            }

            const deleted = typeof config.onDelete === 'function' ? config.onDelete(tasks) : false;
            if (!deleted) return;
            if (!persist(resolveReview(state, 'delete', now))) return;
            closeDialog();
            if (typeof config.onAfterDelete === 'function') config.onAfterDelete(tasks);
        }

        function handleClick(event) {
            const button = event.target.closest('[data-overdue-review-action]');
            if (!button) return;
            const action = button.dataset.overdueReviewAction;
            if (action === 'keep') keepTasks();
            if (action === 'request-delete') requestDelete();
            if (action === 'cancel-delete') setConfirmationVisible(false);
            if (action === 'confirm-delete') confirmDelete();
        }

        function init() {
            if (initialized || !dom.overdueReviewDialog) return;
            initialized = true;
            dom.overdueReviewDialog.addEventListener('click', handleClick);
            dom.overdueReviewDialog.addEventListener('cancel', event => event.preventDefault());
        }

        function reload(options) {
            state = normalizeReviewState(storage && storage.readJson(storageKey, null));
            return options && options.refresh === false ? [] : refresh();
        }

        return {
            init,
            reload,
            refresh,
            forceReview,
            closeDialog,
            keepTasks,
            requestDelete,
            confirmDelete,
            getState: () => ({ ...state, taskIds: state.taskIds.slice() }),
            getPendingTasks: () => getReviewTasks(state, getTodos(), getNow(), taskOptions),
            getAutoDeleteTasks: () => getAutoDeleteTasks(getTodos(), getNow(), taskOptions)
        };
    }

    global.TasklyzenOverdueReview = {
        DAY_MS,
        isOverdueTask,
        getOverdueDays,
        shouldAutoDeleteTask,
        getOverdueTasks,
        getAutoDeleteTasks,
        normalizeReviewState,
        isReviewDue,
        createPendingReview,
        resolveReview,
        getReviewTasks,
        createOverdueReviewController
    };
})(window);
