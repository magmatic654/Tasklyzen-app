/*
 * Modulo: modo desarrollador
 * Proposito:
 * - Agrupar comandos, panel visual y utilidades de pruebas fuera del runtime principal.
 * Entradas:
 * - API interna del runtime, DOM/documento, storage y callbacks de tareas/gamificacion.
 * Salidas:
 * - window.TasklyzenDeveloper con createDeveloperModeController.
 * Dependencias:
 * - Ninguna directa; recibe todo por inyeccion.
 */
(function exposeTasklyzenDeveloper(global) {
    function isStatePreviewTodo(todo) {
        return Boolean(todo && todo.devPreviewType === 'task-state');
    }

    function createDeveloperModeController(options) {
        const config = options || {};
        const documentRef = config.documentRef || global.document;
        const windowRef = config.windowRef || global;
        const storage = config.storage || {};
        const snapshotKey = config.snapshotKey || 'todo-developer-snapshot';
        const defaults = config.defaults || {};
        const taskDefaults = config.taskDefaults || {};
        const getTodos = fn(config.getTodos, () => []);
        const setTodos = fn(config.setTodos, () => {});
        const getCompletionHistory = fn(config.getCompletionHistory, () => ({}));
        const setCompletionHistory = fn(config.setCompletionHistory, () => {});
        const getDailyGoal = fn(config.getDailyGoal, () => defaults.dailyGoal || 3);
        const setDailyGoal = fn(config.setDailyGoal, () => {});
        const getGamification = fn(config.getGamification, () => ({}));
        const setGamification = fn(config.setGamification, () => {});
        const getAnalyticsSnapshot = fn(config.getAnalyticsSnapshot, () => ({}));
        const getAllAchievements = fn(config.getAllAchievements, () => []);
        const getDailyMission = fn(config.getDailyMission, () => ({ id: '', title: '', current: () => 0, target: () => 1 }));
        const getCurrentStreak = fn(config.getCurrentStreak, () => 0);
        const getPerfectStreak = fn(config.getPerfectStreak, () => 0);
        const getLegendaryStreak = fn(config.getLegendaryStreak, () => 0);
        const getHistoryCount = fn(config.getHistoryCount, () => 0);
        const getPriorityLabel = fn(config.getPriorityLabel, () => 'Normal');
        const isTodoSnoozedForToday = fn(config.isTodoSnoozedForToday, () => false);
        const createTodo = fn(config.createTodo, text => ({ id: String(Date.now()), text }));
        const addTodoItem = fn(config.addTodoItem, () => {});
        const removeTodoItem = fn(config.removeTodoItem, () => {});
        const reactivateTodoForToday = fn(config.reactivateTodoForToday, () => {});
        const createNextHabitOccurrence = fn(config.createNextHabitOccurrence, () => {});
        const removeNextHabitOccurrence = fn(config.removeNextHabitOccurrence, () => {});
        const updateDailyGoal = fn(config.updateDailyGoal, () => {});
        const queueAchievementShowcase = fn(config.queueAchievementShowcase, () => {});
        const showCompletionAnimation = fn(config.showCompletionAnimation, () => {});
        const showStreakDayCelebration = fn(config.showStreakDayCelebration, () => {});
        const showToast = fn(config.showToast, () => {});
        const saveTodoList = fn(config.saveTodoList, () => {});
        const saveCompletionHistory = fn(config.saveCompletionHistory, () => {});
        const saveDailyGoal = fn(config.saveDailyGoal, () => {});
        const saveGamification = fn(config.saveGamification, () => {});
        const syncCompletionHistory = fn(config.syncCompletionHistory, () => {});
        const syncAchievementCollection = fn(config.syncAchievementCollection, () => {});
        const renderCurrentPage = fn(config.renderCurrentPage, () => {});
        const taskUiController = config.taskUiController || {};
        const gamificationController = config.gamificationController || {};
        const grantAchievement = fn(config.grantAchievement, () => null);
        const removeAchievement = fn(config.removeAchievement, () => {});
        const resetAchievements = fn(config.resetAchievements, () => {});
        const unlockAllAchievements = fn(config.unlockAllAchievements, () => {});
        const forceFinalizePendingAchievements = fn(config.forceFinalizePendingAchievements, () => {});
        const normalizeStoredTodoText = fn(config.normalizeStoredTodoText, text => text || '');
        const normalizeTaskTimeLimit = fn(config.normalizeTaskTimeLimit, value => Number(value) || 1);
        const normalizeTaskDueDate = fn(config.normalizeTaskDueDate, value => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null));
        const normalizeTimestamp = fn(config.normalizeTimestamp, (timestamp, dateKey) => timestamp || dateKey + 'T12:00:00.000');
        const getStartOfDay = fn(config.getStartOfDay, value => {
            const date = value ? new Date(value) : new Date();
            date.setHours(0, 0, 0, 0);
            return date;
        });
        const addDays = fn(config.addDays, (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return next;
        });
        const formatDateKey = fn(config.formatDateKey, date => new Date(date).toISOString().slice(0, 10));
        const getTodayKey = fn(config.getTodayKey, () => new Date().toISOString().slice(0, 10));
        const getNowTimestamp = fn(config.getNowTimestamp, () => new Date().toISOString());
        const createTimestampFromDateKey = fn(config.createTimestampFromDateKey, dateKey => dateKey + 'T12:00:00.000');
        const getDateKeyFromTimestamp = fn(config.getDateKeyFromTimestamp, timestamp => String(timestamp || '').slice(0, 10));
        const developerStreakPrefix = defaults.developerStreakPrefix || 'Racha dev';
        const developerStreakMaxDays = Number(defaults.developerStreakMaxDays) || 5000;
        const defaultDailyGoal = Number(defaults.dailyGoal) || 3;
        const taskExpirationDays = Number(taskDefaults.expirationDays) || 7;
        const taskDefaultDays = Number(taskDefaults.defaultDays) || 1;
        const taskMaxDays = Number(taskDefaults.maxDays) || 3;
        const taskSoonHours = Number(taskDefaults.soonHours) || 12;
        const taskApi = config.taskApi || global.TasklyzenTasks || {};
        const overdueReviewApi = config.overdueReviewApi || global.TasklyzenOverdueReview || {};
        const overdueReviewController = config.overdueReviewController || null;
        const processOverdueRetention = fn(config.processOverdueRetention, () => 0);
        const overdueReviewIntervalDays = Math.max(Number(defaults.overdueReviewIntervalDays) || 7, 1);
        const overdueAutoDeleteDays = Math.max(Number(defaults.overdueAutoDeleteDays) || 30, 1);
        const developerOverduePrefix = defaults.developerOverduePrefix || 'Revision dev';
        let developerModeEnabled = false;
        let developerPanel = null;
        let developerToggleButton = null;
        let lastOverdueSimulation = 'Sin simulacion';

        function cloneForConsole(value) {
            return JSON.parse(JSON.stringify(value));
        }

        function isDeveloperStreakTodo(todo) {
            return Boolean(todo && typeof todo.text === 'string' && todo.text.startsWith(developerStreakPrefix));
        }

        function removeDeveloperStreakTodos() {
            const previousTodos = getTodos();
            const nextTodos = previousTodos.filter(todo => !isDeveloperStreakTodo(todo));

            setTodos(nextTodos);

            return previousTodos.length - nextTodos.length;
        }

        function getCompletedCountFromTodos(todoItems, dateKey) {
            return todoItems
                .filter(todo => todo.completed && todo.completedOn === dateKey)
                .reduce((total, todo) => total + Math.max(Math.round(Number(todo.completionValue) || 1), 1), 0);
        }

        function getDeveloperStreakTargetCount(mode) {
            if (mode === 'legendary') {
                return getDailyGoal() + 1;
            }

            if (mode === 'perfect') {
                return getDailyGoal();
            }

            return 1;
        }

        function getDeveloperStreakModeLabel(mode) {
            if (mode === 'legendary') {
                return 'legendaria';
            }

            if (mode === 'perfect') {
                return 'perfecta';
            }

            return 'activa';
        }

        function createDeveloperStreakTodo(dateKey, mode, completionValue) {
            const todo = createTodo(developerStreakPrefix + ' ' + getDeveloperStreakModeLabel(mode) + ' ' + dateKey + ' x' + completionValue, 'normal', {
                createdOn: dateKey,
                completionValue
            });

            todo.completed = true;
            todo.completedOn = dateKey;
            todo.completedAt = createTimestampFromDateKey(dateKey);

            return todo;
        }

        function replayStreakPillAnimationForDev() {
            const streakPill = config.getStreakPill ? config.getStreakPill() : null;

            if (!streakPill) {
                return;
            }

            streakPill.classList.remove('streak-dev-preview');
            void streakPill.offsetWidth;
            streakPill.classList.add('streak-dev-preview');

            windowRef.setTimeout(() => {
                streakPill.classList.remove('streak-dev-preview');
            }, 1200);
        }

        function setDeveloperStreakForDev(days, mode, shouldNotify) {
            const safeDays = Math.min(Math.max(Math.round(Number(days) || 0), 0), developerStreakMaxDays);
            const safeMode = ['active', 'perfect', 'legendary'].includes(mode) ? mode : 'active';
            const targetCount = getDeveloperStreakTargetCount(safeMode);
            const today = getStartOfDay(new Date());
            let nextTodos = getTodos().filter(todo => !isDeveloperStreakTodo(todo));

            for (let dayIndex = 0; dayIndex < safeDays; dayIndex += 1) {
                const dateKey = formatDateKey(addDays(today, -dayIndex));
                const missingTasks = Math.max(targetCount - getCompletedCountFromTodos(nextTodos, dateKey), 0);

                if (missingTasks > 0) {
                    nextTodos.push(createDeveloperStreakTodo(dateKey, safeMode, missingTasks));
                }
            }

            setTodos(nextTodos);
            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(true);
            renderCurrentPage();
            replayStreakPillAnimationForDev();

            if (shouldNotify) {
                showToast('Racha dev ' + getDeveloperStreakModeLabel(safeMode) + ' ajustada a ' + safeDays + ' días.', 'success');
            }

            return {
                days: safeDays,
                mode: safeMode,
                currentStreak: getCurrentStreak(),
                perfectStreak: getPerfectStreak(),
                legendaryStreak: getLegendaryStreak()
            };
        }

        function addDeveloperStreakDaysForDev(days, mode) {
            const safeDaysToAdd = Math.min(Math.max(Math.round(Number(days) || 1), 1), developerStreakMaxDays);

            return setDeveloperStreakForDev(getCurrentStreak() + safeDaysToAdd, mode, true);
        }

        function clearDeveloperStreakForDev() {
            const removedCount = removeDeveloperStreakTodos();

            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(false);
            renderCurrentPage();
            replayStreakPillAnimationForDev();
            showToast('Racha dev limpiada sin tocar tareas reales.', 'info');

            return removedCount;
        }

        function isDeveloperStatePreviewTodo(todo) {
            return isStatePreviewTodo(todo);
        }

        function isDeveloperOverdueTodo(todo) {
            return Boolean(todo && (todo.devPreviewType === 'overdue-review'
                || (typeof todo.text === 'string' && todo.text.startsWith(developerOverduePrefix))));
        }

        function getDateKeyDaysAgo(days) {
            const safeDays = Math.max(Math.round(Number(days) || 0), 0);

            return formatDateKey(addDays(getStartOfDay(new Date()), -safeDays));
        }

        function createDeveloperOverdueTodo(daysOverdue, text) {
            const safeDays = Math.max(Math.round(Number(daysOverdue) || overdueReviewIntervalDays + 1), 1);
            const dueDate = getDateKeyDaysAgo(safeDays + 1);
            const createdOn = getDateKeyDaysAgo(safeDays + 3);
            const createdAt = createTimestampFromDateKey(createdOn);
            const todo = createTodo((text || developerOverduePrefix + ' vencida ' + safeDays + 'd').trim(), 'urgent', {
                createdOn,
                createdAt,
                deadlineStartedAt: createdAt,
                dueDate
            });

            todo.devPreviewType = 'overdue-review';
            todo.updatedAt = createdAt;

            return todo;
        }

        function addDeveloperOverdueTodo(daysOverdue, text, options) {
            const todo = createDeveloperOverdueTodo(daysOverdue, text);
            const nextTodos = getTodos().slice();
            const settings = options || {};

            nextTodos.push(todo);
            setTodos(nextTodos);
            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(false);
            renderCurrentPage();
            if (!settings.silent) {
                showToast('Caso de revision vencida creado para el panel dev.', 'success');
            }

            return todo;
        }

        function clearDeveloperOverdueTodos() {
            const previousTodos = getTodos();
            const nextTodos = previousTodos.filter(todo => !isDeveloperOverdueTodo(todo));
            const removedCount = previousTodos.length - nextTodos.length;

            if (removedCount === 0) {
                showToast('No hay casos dev de revision vencida para limpiar.', 'info');
                return 0;
            }

            setTodos(nextTodos);
            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(false);
            if (overdueReviewController && typeof overdueReviewController.reload === 'function') {
                overdueReviewController.reload({ refresh: false });
            }
            renderCurrentPage();
            lastOverdueSimulation = 'Simulacion limpia';
            showToast('Casos dev de revision vencida limpiados.', 'info');

            return removedCount;
        }

        function getOverdueReviewDebugState() {
            const now = new Date();
            const todos = getTodos();
            const reviewState = overdueReviewController && typeof overdueReviewController.getState === 'function'
                ? overdueReviewController.getState()
                : null;
            const pendingTasks = overdueReviewController && typeof overdueReviewController.getPendingTasks === 'function'
                ? overdueReviewController.getPendingTasks()
                : [];
            const overdueTasks = overdueReviewApi && typeof overdueReviewApi.getOverdueTasks === 'function'
                ? overdueReviewApi.getOverdueTasks(todos, now, { taskApi })
                : [];
            const autoDeleteTasks = overdueReviewController && typeof overdueReviewController.getAutoDeleteTasks === 'function'
                ? overdueReviewController.getAutoDeleteTasks()
                : overdueReviewApi && typeof overdueReviewApi.getAutoDeleteTasks === 'function'
                    ? overdueReviewApi.getAutoDeleteTasks(todos, now, { taskApi, autoDeleteDays: overdueAutoDeleteDays })
                    : [];

            return {
                overdueCount: overdueTasks.length,
                pendingReviewCount: pendingTasks.length,
                autoDeleteCount: autoDeleteTasks.length,
                reviewPending: Boolean(reviewState && reviewState.pending),
                lastDecision: reviewState && reviewState.lastDecision ? reviewState.lastDecision : 'sin decision',
                lastDecisionAt: reviewState && reviewState.lastDecisionAt ? reviewState.lastDecisionAt : 'sin fecha',
                lastSimulation: lastOverdueSimulation,
                intervalDays: overdueReviewIntervalDays,
                autoDeleteDays: overdueAutoDeleteDays
            };
        }

        function getOverdueSimulationText(suffix) {
            const textField = getField('overdue-text');
            const baseText = textField && textField.value && textField.value.trim()
                ? textField.value.trim()
                : developerOverduePrefix;

            return baseText + ' ' + suffix;
        }

        function openOverdueReviewForDev(taskItems) {
            if (!overdueReviewController || typeof overdueReviewController.forceReview !== 'function') {
                showToast('El controlador de eliminacion segura no esta disponible.', 'error', {
                    critical: true,
                    key: 'dev-overdue-controller-missing'
                });
                return [];
            }

            const reviewTasks = overdueReviewController.forceReview(taskItems);

            if (reviewTasks.length === 0) {
                showToast('No hay tareas vencidas disponibles para revisar.', 'info');
            }

            return reviewTasks;
        }

        function getCurrentOverdueTasksForDev() {
            return overdueReviewApi && typeof overdueReviewApi.getOverdueTasks === 'function'
                ? overdueReviewApi.getOverdueTasks(getTodos(), new Date(), { taskApi })
                : [];
        }

        function simulateOverdueReviewFlowForDev() {
            const currentOverdueTasks = getCurrentOverdueTasksForDev();

            if (currentOverdueTasks.length === 0) {
                const days = Math.max(getNumberField('overdue-days', overdueReviewIntervalDays + 1), overdueReviewIntervalDays + 1);
                addDeveloperOverdueTodo(days, getOverdueSimulationText('7d'), { silent: true });
            }

            const reviewTasks = openOverdueReviewForDev();

            if (reviewTasks.length > 0) {
                lastOverdueSimulation = 'Aviso 7d: ' + reviewTasks.length + ' detectada' + (reviewTasks.length === 1 ? '' : 's');
                showToast('Simulacion de 7 dias abierta con ' + reviewTasks.length + ' tarea' + (reviewTasks.length === 1 ? '' : 's') + ' vencida' + (reviewTasks.length === 1 ? '' : 's') + '.', 'success');
            }
            refreshPanel();

            return reviewTasks;
        }

        function simulateOverdueAutoDeleteFlowForDev() {
            const todo = addDeveloperOverdueTodo(overdueAutoDeleteDays + 1, getOverdueSimulationText('30d'), { silent: true });
            const removedCount = processOverdueRetention(true, { taskIds: [todo.id], refresh: false });

            if (removedCount === 0) {
                lastOverdueSimulation = '30d sin tareas eliminadas';
                showToast('Se preparo un caso de 30 dias, pero no hubo limpieza automatica disponible.', 'info');
            } else {
                lastOverdueSimulation = 'Resumen 30d: ' + removedCount + ' eliminada' + (removedCount === 1 ? '' : 's');
            }
            renderCurrentPage();
            refreshPanel();

            return removedCount;
        }

        function showOverdueInterfacesForDev() {
            const autoDeleteTask = addDeveloperOverdueTodo(overdueAutoDeleteDays + 1, getOverdueSimulationText('resumen 30d'), { silent: true });
            const removedCount = processOverdueRetention(true, { taskIds: [autoDeleteTask.id], refresh: false });

            if (getCurrentOverdueTasksForDev().length === 0) {
                addDeveloperOverdueTodo(overdueReviewIntervalDays + 1, getOverdueSimulationText('interfaces'), { silent: true });
            }

            const reviewTasks = openOverdueReviewForDev();

            if (reviewTasks.length > 0 && overdueReviewController && typeof overdueReviewController.requestDelete === 'function') {
                overdueReviewController.requestDelete();
            }

            lastOverdueSimulation = 'Interfaces: ' + reviewTasks.length + ' en aviso, ' + removedCount + ' en 30d';
            refreshPanel();

            return {
                reviewCount: reviewTasks.length,
                autoDeleteCount: removedCount
            };
        }

        function removeDeveloperStatePreviewTodos() {
            const previousTodos = getTodos();
            const nextTodos = previousTodos.filter(todo => !isDeveloperStatePreviewTodo(todo));

            setTodos(nextTodos);

            return previousTodos.length - nextTodos.length;
        }

        function formatDeveloperTimestamp(date) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return formatDateKey(date) + 'T' + hours + ':' + minutes + ':00.000';
        }

        function getDeveloperTimestampHoursAgo(hours) {
            const date = new Date();
            date.setTime(date.getTime() - (Math.max(Number(hours) || 0, 0) * 3600000));
            return formatDeveloperTimestamp(date);
        }

        function createDeveloperStatePreviewTodo(configData) {
            const startedAt = configData.startedAt || getDeveloperTimestampHoursAgo(configData.ageHours);
            const todo = createTodo('Vista dev - ' + configData.label, configData.priority, {
                createdOn: getDateKeyFromTimestamp(startedAt),
                createdAt: startedAt,
                deadlineStartedAt: startedAt,
                timeLimitDays: configData.timeLimitDays
            });

            todo.devPreviewType = 'task-state';
            todo.updatedAt = startedAt;

            return todo;
        }

        function addDeveloperStatePreviewTodos() {
            const expiredStartDate = addDays(getStartOfDay(new Date()), -taskExpirationDays);
            const remainingSoonHours = Math.max(taskSoonHours / 2, 1);
            const baseTodos = getTodos().filter(todo => !isDeveloperStatePreviewTodo(todo));
            const previewTodos = [
                createDeveloperStatePreviewTodo({
                    label: 'A tiempo',
                    priority: 'normal',
                    timeLimitDays: taskMaxDays,
                    ageHours: 2
                }),
                createDeveloperStatePreviewTodo({
                    label: 'Por vencer',
                    priority: 'important',
                    timeLimitDays: taskDefaultDays,
                    ageHours: 24 - remainingSoonHours
                }),
                createDeveloperStatePreviewTodo({
                    label: 'Vencida',
                    priority: 'urgent',
                    timeLimitDays: taskDefaultDays,
                    ageHours: 27
                }),
                createDeveloperStatePreviewTodo({
                    label: 'Caducada',
                    priority: 'urgent',
                    timeLimitDays: taskDefaultDays,
                    startedAt: formatDeveloperTimestamp(setHours(expiredStartDate, 8))
                })
            ];

            setTodos(baseTodos.concat(previewTodos));
            if (taskUiController.setFilter) {
                taskUiController.setFilter('all', false);
            }
            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(false);
            renderCurrentPage();
            showToast('Estados visuales dev creados en Todas.', 'success');

            return previewTodos;
        }

        function addCompletedTasksForDate(dateKey, count, priority) {
            const safeDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')) ? dateKey : getTodayKey();
            const safeCount = Math.max(Number(count) || 1, 1);
            const safePriority = ['normal', 'important', 'urgent'].includes(priority) ? priority : 'normal';
            const nextTodos = getTodos().slice();

            for (let index = 0; index < safeCount; index += 1) {
                const todo = createTodo('Tarea dev ' + safeDateKey + ' #' + (index + 1), safePriority, {
                    createdOn: safeDateKey,
                    timeLimitDays: taskDefaultDays
                });
                todo.completed = true;
                todo.completedOn = safeDateKey;
                todo.completedAt = createTimestampFromDateKey(safeDateKey);
                nextTodos.push(todo);
            }

            setTodos(nextTodos);
            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(false);
            renderCurrentPage();
        }

        function resetAllForDev() {
            setTodos([]);
            setCompletionHistory({});
            setDailyGoal(defaultDailyGoal);
            setGamification({
                usedShields: 0,
                protectedDates: [],
                achievementStates: {},
                featuredAchievements: []
            });
            if (taskUiController.clearEditingTodo) {
                taskUiController.clearEditingTodo(false);
            }
            if (taskUiController.setFilter) {
                taskUiController.setFilter('today', false);
            }
            saveTodoList();
            saveCompletionHistory();
            saveDailyGoal();
            saveGamification();
            renderCurrentPage();
        }

        function getDeveloperSnapshot() {
            return storage.readJson ? storage.readJson(snapshotKey, null) : null;
        }

        function captureDeveloperSnapshot(label) {
            const snapshot = {
                label,
                createdAt: new Date().toISOString(),
                todos: getTodos(),
                completionHistory: getCompletionHistory(),
                dailyGoal: getDailyGoal(),
                gamification: getGamification()
            };

            if (storage.writeJson) {
                storage.writeJson(snapshotKey, snapshot);
            }

            return snapshot;
        }

        function restoreDeveloperSnapshotForDev() {
            const snapshot = getDeveloperSnapshot();

            if (!snapshot) {
                showToast('No hay snapshot dev para restaurar.', 'error');
                return null;
            }

            setTodos(Array.isArray(snapshot.todos) ? snapshot.todos.map(todo => ({
                ...todo,
                text: normalizeStoredTodoText(todo.text),
                completionValue: Math.max(Math.round(Number(todo.completionValue) || 1), 1),
                timeLimitDays: normalizeTaskTimeLimit(todo.timeLimitDays),
                dueDate: normalizeTaskDueDate(todo.dueDate),
                deadlineStartedAt: normalizeTimestamp(todo.deadlineStartedAt || todo.createdAt, todo.createdOn)
            })) : []);
            setCompletionHistory(snapshot.completionHistory && typeof snapshot.completionHistory === 'object'
                ? snapshot.completionHistory
                : {});
            setDailyGoal(Math.min(Math.max(Math.round(Number(snapshot.dailyGoal) || defaultDailyGoal), 1), 20));
            setGamification(snapshot.gamification && typeof snapshot.gamification === 'object'
                ? snapshot.gamification
                : {
                    usedShields: 0,
                    protectedDates: [],
                    achievementStates: {},
                    featuredAchievements: []
                });

            if (config.normalizeGamification) {
                config.normalizeGamification();
            }
            syncCompletionHistory();
            saveTodoList();
            saveDailyGoal();
            saveGamification();
            renderCurrentPage();
            showToast('Snapshot dev restaurado.', 'success');

            return snapshot;
        }

        function clearDeveloperSnapshotForDev() {
            if (storage.remove) {
                storage.remove(snapshotKey);
            }
            refreshPanel();
            showToast('Snapshot dev eliminado.', 'info');
        }

        function getDeveloperSnapshotLabel() {
            const snapshot = getDeveloperSnapshot();

            if (!snapshot) {
                return 'Sin snapshot guardado';
            }

            return snapshot.label + ' · ' + new Date(snapshot.createdAt).toLocaleString();
        }

        function createNode(tagName, className, text) {
            const node = documentRef.createElement(tagName);

            if (className) {
                node.className = className;
            }

            if (text) {
                node.textContent = text;
            }

            return node;
        }

        function createButton(label, action, variant) {
            const button = createNode('button', 'developer-action' + (variant ? ' ' + variant : ''), label);

            button.type = 'button';
            button.dataset.devAction = action;

            return button;
        }

        function createField(labelText, control) {
            const label = createNode('label', 'developer-field');
            const labelCopy = createNode('span', '', labelText);

            label.append(labelCopy, control);

            return label;
        }

        function createInput(type, name, value) {
            const input = documentRef.createElement('input');

            input.type = type;
            input.dataset.devField = name;

            if (value !== undefined) {
                input.value = value;
            }

            return input;
        }

        function createSelect(name, options) {
            const select = documentRef.createElement('select');

            select.dataset.devField = name;
            options.forEach(optionData => {
                const option = documentRef.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                select.appendChild(option);
            });

            return select;
        }

        function createSection(title, description) {
            const section = createNode('section', 'developer-section');
            const heading = createNode('div', 'developer-section-heading');
            const headingTitle = createNode('h3', '', title);
            const headingDescription = createNode('p', '', description);

            heading.append(headingTitle, headingDescription);
            section.appendChild(heading);

            return section;
        }

        function getPriorityOptions() {
            return [
                { value: 'normal', label: 'Normal' },
                { value: 'important', label: 'Importante' },
                { value: 'urgent', label: 'Urgente' }
            ];
        }

        function getCompletionOptions() {
            return [
                { value: 'regular', label: 'Tarea completada' },
                { value: 'goal', label: 'Meta diaria' },
                { value: 'legendary', label: 'Extra legendario' }
            ];
        }

        function getStreakOptions() {
            return [
                { value: 'active', label: 'Racha activa' },
                { value: 'perfect', label: 'Racha perfecta' },
                { value: 'legendary', label: 'Racha legendaria' }
            ];
        }

        function getTaskLabel(todo, index) {
            const status = todo.completed ? 'Completada' : isTodoSnoozedForToday(todo) ? 'Programada' : 'Pendiente';
            const type = todo.habit ? 'Hábito' : 'Tarea';

            return (index + 1) + '. ' + todo.text + ' · ' + type + ' · ' + getPriorityLabel(todo.priority) + ' · ' + status;
        }

        function getCompactLabel(value, maxLength) {
            const text = String(value || '');

            if (text.length <= maxLength) {
                return text;
            }

            return text.slice(0, Math.max(0, maxLength - 3)) + '...';
        }

        function getAchievementLabel(achievement) {
            const status = achievement.collected ? 'Listo' : achievement.current + '/' + achievement.target;

            return achievement.mark + ' ' + getCompactLabel(achievement.title, 14) + ' ' + status;
        }

        function setSelectOptions(select, options, preferredValue) {
            const currentValue = preferredValue || select.value;

            select.innerHTML = '';

            if (options.length === 0) {
                const option = documentRef.createElement('option');
                option.value = '';
                option.textContent = 'Sin elementos disponibles';
                select.appendChild(option);
                select.disabled = true;
                return;
            }

            select.disabled = false;
            options.forEach(optionData => {
                const option = documentRef.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                select.appendChild(option);
            });

            if (options.some(optionData => optionData.value === currentValue)) {
                select.value = currentValue;
            }
        }

        function getField(name) {
            return developerPanel ? developerPanel.querySelector('[data-dev-field="' + name + '"]') : null;
        }

        function getSelectedTask() {
            const select = getField('task-select');

            if (!select) {
                return null;
            }

            return getTodos().find(todo => todo.id === select.value) || null;
        }

        function getSelectedAchievement() {
            const select = getField('achievement-select');

            if (!select) {
                return null;
            }

            return getAllAchievements().find(achievement => achievement.id === select.value) || null;
        }

        function normalizeSearchValue(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        }

        function getAchievementSearchText() {
            const field = getField('achievement-filter');

            return normalizeSearchValue(field && field.value ? field.value.trim() : '');
        }

        function matchesSearchValue(value, searchText) {
            const normalizedValue = normalizeSearchValue(value);

            if (!searchText || normalizedValue.includes(searchText)) {
                return true;
            }

            if (searchText.endsWith('as') && normalizedValue.includes(searchText.slice(0, -2) + 'os')) {
                return true;
            }

            if (searchText.endsWith('os') && normalizedValue.includes(searchText.slice(0, -2) + 'as')) {
                return true;
            }

            if (searchText.endsWith('a') && normalizedValue.includes(searchText.slice(0, -1) + 'o')) {
                return true;
            }

            if (searchText.endsWith('o') && normalizedValue.includes(searchText.slice(0, -1) + 'a')) {
                return true;
            }

            return false;
        }

        function getFilteredAchievements(achievements) {
            const searchText = getAchievementSearchText();

            if (!searchText) {
                return achievements;
            }

            return achievements.filter(achievement => {
                return [
                    achievement.id,
                    achievement.title,
                    achievement.rarityLabel,
                    achievement.categoryLabel,
                    achievement.statusLabel,
                    achievement.mark
                ].some(value => matchesSearchValue(value, searchText));
            });
        }

        function createPanel() {
            const panel = createNode('aside', 'developer-panel');
            const header = createNode('div', 'developer-panel-header');
            const headerCopy = createNode('div');
            const eyebrow = createNode('p', 'section-kicker', 'Modo desarrollador');
            const title = createNode('h2', '', 'Panel de control');
            const closeButton = createButton('Cerrar', 'close-panel', 'ghost');
            const summary = createNode('div', 'developer-summary');
            const taskSection = createSection('Tareas y hábitos', 'Crea, completa, reactiva, pospone o elimina sin buscar IDs.');
            const progressSection = createSection('Progreso', 'Ajusta meta diaria, historial y rachas.');
            const overdueSection = createSection('Simulación de eliminación de tareas', 'Prueba avisos de 7 días, confirmaciones y limpieza de 30 días sin esperar al tiempo real.');
            const animationSection = createSection('Animaciones', 'Reproduce celebraciones y showcases para revisar la experiencia.');
            const achievementSection = createSection('Logros', 'Concede, quita, destaca o reinicia logros desde una lista legible.');
            const dangerSection = createSection('Zona de reinicio', 'Acciones fuertes para pruebas completas.');
            const stateSection = createSection('Estado rápido', 'Vista resumida para confirmar que todo cambió correctamente.');
            const taskCreateGrid = createNode('div', 'developer-grid');
            const taskSelectGrid = createNode('div', 'developer-grid');
            const taskActions = createNode('div', 'developer-actions');
            const progressGrid = createNode('div', 'developer-grid');
            const progressActions = createNode('div', 'developer-actions');
            const overdueGrid = createNode('div', 'developer-grid');
            const overdueActions = createNode('div', 'developer-actions');
            const overdueStatus = createNode('div', 'developer-overdue-status');
            const animationGrid = createNode('div', 'developer-grid');
            const animationActions = createNode('div', 'developer-actions');
            const achievementGrid = createNode('div', 'developer-grid');
            const achievementActions = createNode('div', 'developer-actions');
            const dangerActions = createNode('div', 'developer-actions danger-actions');
            const stateBox = createNode('pre', 'developer-state');
            const taskText = createInput('text', 'task-text', 'Nueva tarea de prueba');
            const taskPriority = createSelect('task-priority', getPriorityOptions());
            const taskHabit = createInput('checkbox', 'task-habit');
            const taskSelect = createSelect('task-select', []);
            const taskRename = createInput('text', 'task-rename', '');
            const taskNewPriority = createSelect('task-new-priority', getPriorityOptions());
            const goalInput = createInput('number', 'goal-input', getDailyGoal());
            const historyDate = createInput('date', 'history-date', getTodayKey());
            const historyCount = createInput('number', 'history-count', getDailyGoal());
            const historyPriority = createSelect('history-priority', getPriorityOptions());
            const streakDays = createInput('number', 'streak-days', getCurrentStreak());
            const streakMode = createSelect('streak-mode', getStreakOptions());
            const overdueText = createInput('text', 'overdue-text', 'Caso dev vencido');
            const overdueDays = createInput('number', 'overdue-days', overdueReviewIntervalDays + 1);
            const completionSelect = createSelect('completion-animation', getCompletionOptions());
            const achievementFilter = createInput('search', 'achievement-filter', '');
            const achievementSelect = createSelect('achievement-select', []);

            panel.setAttribute('aria-live', 'polite');
            closeButton.setAttribute('aria-label', 'Cerrar panel desarrollador');
            taskHabit.value = '1';
            taskText.placeholder = 'Texto de tarea';
            taskRename.placeholder = 'Nuevo nombre opcional';
            achievementFilter.placeholder = 'Buscar por título, rareza o categoría';
            goalInput.min = '1';
            goalInput.max = '20';
            historyCount.min = '1';
            streakDays.min = '0';
            streakDays.max = String(developerStreakMaxDays);
            overdueText.placeholder = 'Texto del caso vencido';
            overdueDays.min = '1';
            overdueDays.max = '365';
            overdueStatus.dataset.devOverdueStatus = 'true';
            headerCopy.append(eyebrow, title);
            header.append(headerCopy, closeButton);
            taskCreateGrid.append(
                createField('Texto', taskText),
                createField('Prioridad', taskPriority),
                createField('Crear como hábito', taskHabit)
            );
            taskSection.append(taskCreateGrid, createNode('div', 'developer-actions'));
            taskSection.querySelector('.developer-actions').append(
                createButton('Crear tarea', 'create-task'),
                createButton('Crear hábito', 'create-habit', 'secondary'),
                createButton('Crear estados visuales', 'create-state-preview', 'secondary')
            );
            taskSelectGrid.append(createField('Elegir tarea', taskSelect), createField('Nuevo texto', taskRename), createField('Nueva prioridad', taskNewPriority));
            taskActions.append(
                createButton('Completar', 'complete-task'),
                createButton('Reactivar', 'reactivate-task', 'secondary'),
                createButton('Actualizar texto/prioridad', 'rename-task', 'secondary'),
                createButton('Eliminar', 'delete-task', 'danger'),
                createButton('Completar todas', 'complete-all'),
                createButton('Reactivar todas', 'reactivate-all', 'secondary'),
                createButton('Borrar tareas', 'clear-tasks', 'danger')
            );
            taskSection.append(taskSelectGrid, taskActions);
            progressGrid.append(
                createField('Meta diaria', goalInput),
                createField('Fecha historial', historyDate),
                createField('Tareas a agregar', historyCount),
                createField('Prioridad historial', historyPriority),
                createField('Días de racha', streakDays),
                createField('Tipo de racha', streakMode)
            );
            progressActions.append(
                createButton('Aplicar meta', 'set-goal'),
                createButton('Agregar historial', 'add-history', 'secondary'),
                createButton('Aplicar racha', 'set-streak'),
                createButton('+1 día racha', 'add-streak-day', 'secondary'),
                createButton('+7 días racha', 'add-streak-week', 'secondary'),
                createButton('Limpiar racha dev', 'clear-dev-streak', 'danger'),
                createButton('Animar racha', 'preview-streak', 'secondary'),
                createButton('Finalizar pendientes', 'finalize-pending', 'secondary')
            );
            progressSection.append(progressGrid, progressActions, createNode('p', 'developer-note'));
            overdueGrid.append(
                createField('Texto del caso', overdueText),
                createField('Días vencida', overdueDays)
            );
            overdueActions.append(
                createButton('Simular 7 días', 'simulate-overdue-review'),
                createButton('Simular 30 días', 'simulate-overdue-auto', 'secondary'),
                createButton('Mostrar interfaces', 'show-overdue-interfaces', 'secondary'),
                createButton('Conservar revisión', 'keep-overdue-review', 'ghost'),
                createButton('Mostrar confirmación', 'request-overdue-delete', 'danger'),
                createButton('Confirmar eliminación', 'confirm-overdue-delete', 'danger'),
                createButton('Limpiar simulación', 'clear-overdue-dev', 'ghost')
            );
            overdueSection.append(overdueGrid, overdueStatus, overdueActions);
            animationGrid.append(createField('Celebración', completionSelect));
            animationActions.append(
                createButton('Reproducir celebración', 'play-completion'),
                createButton('Celebrar racha', 'play-streak-day', 'secondary'),
                createButton('Exhibir logro', 'play-achievement', 'secondary'),
                createButton('Demo completa', 'run-demo', 'secondary')
            );
            animationSection.append(animationGrid, animationActions);
            achievementGrid.append(createField('Buscar logro', achievementFilter), createField('Logro', achievementSelect));
            achievementActions.append(
                createButton('Conceder logro', 'grant-achievement'),
                createButton('Quitar logro', 'lock-achievement', 'danger'),
                createButton('Poner en vitrina', 'feature-achievement', 'secondary'),
                createButton('Quitar de vitrina', 'unfeature-achievement', 'secondary'),
                createButton('Desbloquear todo', 'unlock-all'),
                createButton('Reiniciar logros', 'reset-achievements', 'danger')
            );
            achievementSection.append(achievementGrid, achievementActions);
            dangerActions.append(
                createButton('Reiniciar toda la app', 'reset-all', 'danger'),
                createButton('Restaurar snapshot', 'restore-snapshot', 'secondary'),
                createButton('Borrar snapshot', 'clear-snapshot', 'ghost'),
                createButton('Actualizar panel', 'refresh-panel', 'secondary')
            );
            dangerSection.append(dangerActions);
            stateSection.appendChild(stateBox);
            panel.append(header, summary, taskSection, progressSection, overdueSection, animationSection, achievementSection, dangerSection, stateSection);
            panel.addEventListener('click', handlePanelClick);
            panel.addEventListener('change', handlePanelChange);
            panel.addEventListener('input', handlePanelInput);

            return panel;
        }

        function createToggleButton() {
            const button = createNode('button', 'developer-toggle', 'Dev');

            button.type = 'button';
            button.addEventListener('click', () => {
                if (developerPanel) {
                    developerPanel.classList.toggle('collapsed');
                }
            });

            return button;
        }

        function ensurePanel() {
            if (!developerToggleButton) {
                developerToggleButton = createToggleButton();
                documentRef.body.appendChild(developerToggleButton);
            }

            if (!developerPanel) {
                developerPanel = createPanel();
                documentRef.body.appendChild(developerPanel);
            }

            developerPanel.classList.remove('collapsed');
            refreshPanel();
        }

        function refreshPanel() {
            if (!developerModeEnabled || !developerPanel) {
                return;
            }

            const selectedTask = getSelectedTask();
            const selectedAchievement = getSelectedAchievement();
            const taskSelect = getField('task-select');
            const taskRename = getField('task-rename');
            const taskNewPriority = getField('task-new-priority');
            const goalInput = getField('goal-input');
            const historyDate = getField('history-date');
            const streakDays = getField('streak-days');
            const streakMode = getField('streak-mode');
            const achievementSelect = getField('achievement-select');
            const summary = developerPanel.querySelector('.developer-summary');
            const note = developerPanel.querySelector('.developer-note');
            const stateBox = developerPanel.querySelector('.developer-state');
            const overdueStatus = developerPanel.querySelector('[data-dev-overdue-status]');
            const restoreSnapshotButton = developerPanel.querySelector('[data-dev-action="restore-snapshot"]');
            const clearSnapshotButton = developerPanel.querySelector('[data-dev-action="clear-snapshot"]');
            const taskActionButtons = ['complete-task', 'reactivate-task', 'rename-task', 'delete-task']
                .map(action => developerPanel.querySelector('[data-dev-action="' + action + '"]'))
                .filter(Boolean);
            const overdueActionButtons = ['simulate-overdue-review', 'simulate-overdue-auto', 'show-overdue-interfaces', 'keep-overdue-review', 'request-overdue-delete', 'confirm-overdue-delete']
                .map(action => developerPanel.querySelector('[data-dev-action="' + action + '"]'))
                .filter(Boolean);
            const achievementActionButtons = ['play-achievement', 'grant-achievement', 'lock-achievement', 'feature-achievement', 'unfeature-achievement']
                .map(action => developerPanel.querySelector('[data-dev-action="' + action + '"]'))
                .filter(Boolean);
            const achievements = getAllAchievements();
            const filteredAchievements = getFilteredAchievements(achievements);
            const developerSnapshot = getDeveloperSnapshot();
            const collectedCount = achievements.filter(achievement => achievement.collected).length;
            const pendingCount = achievements.filter(achievement => achievement.pending).length;
            const overdueDebug = getOverdueReviewDebugState();

            if (taskSelect) {
                setSelectOptions(taskSelect, getTodos().map((todo, index) => ({
                    value: todo.id,
                    label: getTaskLabel(todo, index)
                })), selectedTask ? selectedTask.id : null);
            }

            const refreshedTask = getSelectedTask();
            if (taskRename && refreshedTask && documentRef.activeElement !== taskRename) {
                taskRename.value = refreshedTask.text;
            }
            if (taskNewPriority && refreshedTask) {
                taskNewPriority.value = refreshedTask.priority;
            }
            taskActionButtons.forEach(button => {
                button.disabled = !refreshedTask;
            });
            overdueActionButtons.forEach(button => {
                button.disabled = !overdueReviewController;
            });

            if (goalInput && documentRef.activeElement !== goalInput) {
                goalInput.value = getDailyGoal();
            }
            if (historyDate && !historyDate.value) {
                historyDate.value = getTodayKey();
            }
            if (streakDays && documentRef.activeElement !== streakDays) {
                streakDays.value = getCurrentStreak();
            }
            if (streakMode && !['active', 'perfect', 'legendary'].includes(streakMode.value)) {
                streakMode.value = 'active';
            }
            if (achievementSelect) {
                setSelectOptions(achievementSelect, filteredAchievements.map(achievement => ({
                    value: achievement.id,
                    label: getAchievementLabel(achievement)
                })), selectedAchievement ? selectedAchievement.id : null);
            }

            const refreshedAchievement = getSelectedAchievement();
            achievementActionButtons.forEach(button => {
                button.disabled = !refreshedAchievement;
            });
            if (restoreSnapshotButton) {
                restoreSnapshotButton.disabled = !developerSnapshot;
            }
            if (clearSnapshotButton) {
                clearSnapshotButton.disabled = !developerSnapshot;
            }

            if (summary) {
                summary.innerHTML = '';
                [
                    { label: 'Tareas', value: getTodos().length },
                    { label: 'Completadas hoy', value: getHistoryCount(getTodayKey()) },
                    { label: 'Racha', value: getCurrentStreak() },
                    { label: 'Logros', value: collectedCount + '/' + achievements.length },
                    { label: 'Logros en revisión', value: pendingCount },
                    { label: 'Tareas vencidas', value: overdueDebug.overdueCount }
                ].forEach(item => {
                    const card = createNode('article');
                    const value = createNode('strong', '', String(item.value));
                    const label = createNode('span', '', item.label);
                    card.append(value, label);
                    summary.appendChild(card);
                });
            }

            if (overdueStatus) {
                overdueStatus.innerHTML = '';
                [
                    { label: 'Tareas vencidas', value: overdueDebug.overdueCount },
                    { label: 'Aviso 7d', value: overdueDebug.pendingReviewCount },
                    { label: 'Limpieza 30d', value: overdueDebug.autoDeleteCount },
                    { label: 'Última simulación', value: overdueDebug.lastSimulation }
                ].forEach(item => {
                    const card = createNode('article');
                    const value = createNode('strong', '', String(item.value));
                    const label = createNode('span', '', item.label);
                    card.append(value, label);
                    overdueStatus.appendChild(card);
                });
            }

            if (note) {
                const mission = getDailyMission();
                const missionCurrent = mission.current();
                const missionTarget = mission.target();
                note.textContent = 'Misión actual: ' + mission.title + ' (' + Math.min(missionCurrent, missionTarget) + '/' + missionTarget + '). Racha: ' + getCurrentStreak() + ' activa, ' + getPerfectStreak() + ' perfecta, ' + getLegendaryStreak() + ' legendaria.';
            }

            if (stateBox) {
                const analyticsSnapshot = getAnalyticsSnapshot();
                stateBox.textContent = JSON.stringify({
                    fecha: getTodayKey(),
                    tareas: getTodos().length,
                    meta: getDailyGoal(),
                    rachaActual: getCurrentStreak(),
                    rachaPerfecta: getPerfectStreak(),
                    rachaLegendaria: getLegendaryStreak(),
                    perfil: analyticsSnapshot.perfil && analyticsSnapshot.perfil.label,
                    riesgoRacha: analyticsSnapshot.riesgoRacha && analyticsSnapshot.riesgoRacha.label,
                    logrosColeccionados: collectedCount,
                    logrosRevision: pendingCount,
                    revisionVencidas: overdueDebug,
                    vitrina: (getGamification().featuredAchievements || []).length,
                    snapshot: getDeveloperSnapshotLabel()
                }, null, 2);
            }
        }

        function handlePanelChange(event) {
            const field = event.target.closest('[data-dev-field]');

            if (!field || !['task-select', 'achievement-filter'].includes(field.dataset.devField)) {
                return;
            }

            refreshPanel();
        }

        function handlePanelInput(event) {
            const field = event.target.closest('[data-dev-field]');

            if (!field || field.dataset.devField !== 'achievement-filter') {
                return;
            }

            refreshPanel();
        }

        function getNumberField(name, fallback) {
            const field = getField(name);
            const value = Number(field && field.value);

            return Number.isFinite(value) ? value : fallback;
        }

        function handlePanelClick(event) {
            const button = event.target.closest('[data-dev-action]');

            if (!button) {
                return;
            }

            const action = button.dataset.devAction;
            const task = getSelectedTask();
            const achievement = getSelectedAchievement();

            if (action === 'close-panel') {
                developerPanel.classList.add('collapsed');
                return;
            }

            if (action === 'create-task' || action === 'create-habit') {
                const textField = getField('task-text');
                const priorityField = getField('task-priority');
                const habitField = getField('task-habit');
                const text = textField && textField.value ? textField.value : 'Tarea creada desde modo dev';
                const priority = priorityField ? priorityField.value : 'normal';
                const isHabit = action === 'create-habit' || Boolean(habitField && habitField.checked);
                addTodoItem(text, priority, { habit: isHabit });
            }

            if (action === 'create-state-preview') {
                addDeveloperStatePreviewTodos();
            }

            if (action === 'simulate-overdue-review') {
                simulateOverdueReviewFlowForDev();
            }

            if (action === 'simulate-overdue-auto') {
                simulateOverdueAutoDeleteFlowForDev();
            }

            if (action === 'show-overdue-interfaces') {
                showOverdueInterfacesForDev();
            }

            if (action === 'create-overdue-review') {
                const textField = getField('overdue-text');
                addDeveloperOverdueTodo(getNumberField('overdue-days', overdueReviewIntervalDays + 1), textField && textField.value ? textField.value : 'Caso dev vencido');
            }

            if (action === 'create-overdue-auto') {
                const textField = getField('overdue-text');
                addDeveloperOverdueTodo(overdueAutoDeleteDays + 1, textField && textField.value ? textField.value + ' auto 30d' : 'Caso dev auto 30d');
            }

            if (action === 'force-overdue-review') {
                const reviewTasks = overdueReviewController && typeof overdueReviewController.forceReview === 'function'
                    ? overdueReviewController.forceReview()
                    : overdueReviewController && typeof overdueReviewController.refresh === 'function' ? overdueReviewController.refresh() : [];
                showToast(reviewTasks.length > 0
                    ? 'Revision vencida abierta desde el panel dev.'
                    : 'No hay tareas vencidas disponibles para revisar.', reviewTasks.length > 0 ? 'success' : 'info');
            }

            if (action === 'keep-overdue-review' && overdueReviewController && typeof overdueReviewController.keepTasks === 'function') {
                overdueReviewController.keepTasks();
            }

            if (action === 'request-overdue-delete' && overdueReviewController && typeof overdueReviewController.requestDelete === 'function') {
                overdueReviewController.requestDelete();
            }

            if (action === 'confirm-overdue-delete' && overdueReviewController && typeof overdueReviewController.confirmDelete === 'function') {
                overdueReviewController.confirmDelete();
            }

            if (action === 'run-overdue-retention') {
                const targetIds = overdueReviewController && typeof overdueReviewController.getAutoDeleteTasks === 'function'
                    ? overdueReviewController.getAutoDeleteTasks().filter(isDeveloperOverdueTodo).map(todo => todo.id)
                    : [];
                const removedCount = targetIds.length > 0
                    ? processOverdueRetention(true, { taskIds: targetIds, refresh: false })
                    : 0;
                renderCurrentPage();
                showToast(removedCount > 0
                    ? 'Limpieza automatica dev ejecutada.'
                    : 'No hay casos dev con 30 dias vencidos para eliminar.', removedCount > 0 ? 'success' : 'info');
            }

            if (action === 'clear-overdue-dev') {
                clearDeveloperOverdueTodos();
            }

            if (action === 'complete-task' && task) {
                const completedAt = getNowTimestamp();
                task.completed = true;
                task.completedOn = getTodayKey();
                task.completedAt = completedAt;
                task.updatedAt = completedAt;
                task.snoozedUntil = null;
                createNextHabitOccurrence(task);
                saveTodoList();
                syncCompletionHistory();
                syncAchievementCollection(true);
                showCompletionAnimation(getHistoryCount(getTodayKey()) > getDailyGoal() ? 'legendary' : 'regular');
                renderCurrentPage();
            }

            if (action === 'reactivate-task' && task) {
                reactivateTodoForToday(task);
                removeNextHabitOccurrence(task);
                saveTodoList();
                syncCompletionHistory();
                syncAchievementCollection(false);
                renderCurrentPage();
            }

            if (action === 'rename-task' && task) {
                const renameField = getField('task-rename');
                const priorityField = getField('task-new-priority');
                const cleanText = renameField && renameField.value.trim() ? renameField.value.trim() : task.text;
                task.text = cleanText;
                task.priority = priorityField ? priorityField.value : task.priority;
                saveTodoList();
                syncCompletionHistory();
                syncAchievementCollection(false);
                renderCurrentPage();
                showToast('Tarea actualizada desde el panel dev.', 'success');
            }

            if (action === 'delete-task' && task) {
                captureDeveloperSnapshot('Antes de eliminar tarea');
                removeTodoItem(task.id);
            }

            if (action === 'complete-all') {
                completeAllTodosForDev();
            }

            if (action === 'reactivate-all') {
                getTodos().forEach(todo => {
                    removeNextHabitOccurrence(todo);
                    reactivateTodoForToday(todo);
                });
                saveTodoList();
                syncCompletionHistory();
                syncAchievementCollection(false);
                renderCurrentPage();
            }

            if (action === 'clear-tasks') {
                captureDeveloperSnapshot('Antes de borrar tareas');
                setTodos([]);
                saveTodoList();
                syncCompletionHistory();
                syncAchievementCollection(false);
                renderCurrentPage();
                showToast('Tareas borradas desde el panel dev.', 'info');
            }

            if (action === 'set-goal') {
                updateDailyGoal(getNumberField('goal-input', getDailyGoal()), true);
            }

            if (action === 'add-history') {
                const dateField = getField('history-date');
                const priorityField = getField('history-priority');
                addCompletedTasksForDate(dateField && dateField.value ? dateField.value : getTodayKey(), getNumberField('history-count', getDailyGoal()), priorityField ? priorityField.value : 'normal');
                showToast('Historial agregado desde el panel dev.', 'success');
            }

            if (action === 'set-streak') {
                const modeField = getField('streak-mode');
                setDeveloperStreakForDev(getNumberField('streak-days', getCurrentStreak()), modeField ? modeField.value : 'active', true);
            }

            if (action === 'add-streak-day') {
                const modeField = getField('streak-mode');
                addDeveloperStreakDaysForDev(1, modeField ? modeField.value : 'active');
            }

            if (action === 'add-streak-week') {
                const modeField = getField('streak-mode');
                addDeveloperStreakDaysForDev(7, modeField ? modeField.value : 'active');
            }

            if (action === 'clear-dev-streak') {
                clearDeveloperStreakForDev();
            }

            if (action === 'preview-streak') {
                replayStreakPillAnimationForDev();
            }

            if (action === 'finalize-pending') {
                forceFinalizePendingAchievements();
                showToast('Logros en revisión finalizados.', 'success');
            }

            if (action === 'play-completion') {
                const field = getField('completion-animation');
                showCompletionAnimation(field ? field.value : 'regular');
            }

            if (action === 'play-streak-day') {
                showStreakDayCelebration(Math.max(getCurrentStreak(), 1), { isRecord: true });
            }

            if (action === 'play-achievement' && achievement) {
                queueAchievementShowcase([achievement]);
            }

            if (action === 'run-demo') {
                runAnimationDemo();
            }

            if (action === 'grant-achievement' && achievement) {
                grantAchievement(achievement.id, true);
            }

            if (action === 'lock-achievement' && achievement) {
                captureDeveloperSnapshot('Antes de quitar logro');
                removeAchievement(achievement.id);
            }

            if (action === 'feature-achievement' && achievement) {
                grantAchievement(achievement.id, false);
                if (gamificationController.featureAchievement) {
                    gamificationController.featureAchievement(achievement.id);
                }
                renderCurrentPage();
            }

            if (action === 'unfeature-achievement' && achievement) {
                if (gamificationController.unfeatureAchievement) {
                    gamificationController.unfeatureAchievement(achievement.id);
                }
                renderCurrentPage();
            }

            if (action === 'unlock-all') {
                captureDeveloperSnapshot('Antes de desbloquear todo');
                unlockAllAchievements({ animate: true });
            }

            if (action === 'reset-achievements') {
                captureDeveloperSnapshot('Antes de reiniciar logros');
                resetAchievements();
                showToast('Logros reiniciados desde el panel dev.', 'info');
            }

            if (action === 'reset-all') {
                captureDeveloperSnapshot('Antes de reiniciar toda la app');
                resetAllForDev();
                showToast('App reiniciada desde el panel dev.', 'info');
            }

            if (action === 'restore-snapshot') {
                restoreDeveloperSnapshotForDev();
            }

            if (action === 'clear-snapshot') {
                clearDeveloperSnapshotForDev();
            }

            if (action === 'refresh-panel') {
                refreshPanel();
            }

            refreshPanel();
        }

        function completeAllTodosForDev() {
            if (getTodos().length === 0) {
                addTodoItem('Primera tarea dev', 'normal');
                addTodoItem('Tarea importante dev', 'important');
                addTodoItem('Tarea urgente dev', 'urgent');
            }

            const completedAt = getNowTimestamp();
            getTodos().forEach(todo => {
                if (!todo.completed) {
                    todo.completed = true;
                    todo.completedOn = getTodayKey();
                    todo.completedAt = completedAt;
                    todo.updatedAt = completedAt;
                    todo.snoozedUntil = null;
                    createNextHabitOccurrence(todo);
                }
            });
            saveTodoList();
            syncCompletionHistory();
            syncAchievementCollection(true);
            showCompletionAnimation(getHistoryCount(getTodayKey()) > getDailyGoal() ? 'legendary' : 'goal');
            renderCurrentPage();
        }

        function runAnimationDemo() {
            showCompletionAnimation('regular');
            windowRef.setTimeout(() => showCompletionAnimation('goal'), 1800);
            windowRef.setTimeout(() => showCompletionAnimation('legendary'), 4000);
            windowRef.setTimeout(() => showStreakDayCelebration(Math.max(getCurrentStreak(), 7), { isRecord: true }), 6300);
            windowRef.setTimeout(() => queueAchievementShowcase(getAllAchievements().slice(0, 8)), 9500);
        }

        function getDeveloperHelp() {
            return {
                panel: 'todoDev.panel() abre el panel visual integrado.',
                analytics: 'todoDev.analytics() devuelve resumen semanal, riesgo, meta sugerida, perfil e insights.',
                streakAnimation: 'todoDev.playStreak(30) reproduce la celebración del nivel indicado.',
                state: 'todoDev.state() devuelve tareas, historial, meta, logros y gamificación.',
                playCompletion: "todoDev.playCompletion('regular' | 'goal' | 'legendary') reproduce una animación de tarea.",
                playAchievement: "todoDev.playAchievement('id-del-logro' | 'legendary') exhibe un logro por id o por rareza.",
                unlockAll: 'todoDev.unlockAll({ animate: true }) desbloquea todo y reproduce los logros en orden.',
                grant: "todoDev.grant('first-spark') concede un logro puntual.",
                lock: "todoDev.lock('first-spark') elimina un logro puntual.",
                resetAchievements: 'todoDev.resetAchievements() borra solo la colección de logros.',
                resetAll: 'todoDev.resetAll() reinicia tareas, historial, meta y logros.',
                addTask: "todoDev.addTask('Texto', 'urgent') crea una tarea.",
                addHabit: "todoDev.addHabit('Leer 10 minutos', 'important') crea un hábito diario.",
                previewTaskStates: 'todoDev.previewTaskStates() crea tareas dev para A tiempo, Por vencer, Vencida y Caducada.',
                simulateDeletion7: 'todoDev.simulateDeletion7() abre el aviso real de revision por 7 dias.',
                simulateDeletion30: 'todoDev.simulateDeletion30() ejecuta la limpieza real de tareas vencidas por 30 dias.',
                showDeletionInterfaces: 'todoDev.showDeletionInterfaces() muestra aviso, confirmacion y resumen de eliminacion.',
                complete: "todoDev.complete('id') completa una tarea concreta.",
                reactivate: "todoDev.reactivate('id') quita la marca de completada.",
                mission: 'todoDev.mission() devuelve la misión diaria actual.',
                deleteTask: "todoDev.deleteTask('id') elimina una tarea concreta.",
                clearTasks: 'todoDev.clearTasks() borra todas las tareas.',
                completeAll: 'todoDev.completeAll() completa todas las tareas actuales para hoy.',
                reactivateAll: 'todoDev.reactivateAll() reactiva todas las tareas completas.',
                addHistory: "todoDev.addHistory('2026-06-30', 5, 'important') agrega tareas completadas en una fecha.",
                setGoal: 'todoDev.setGoal(4) cambia la meta diaria.',
                setStreak: "todoDev.setStreak(7, 'active' | 'perfect' | 'legendary') simula una racha desde el panel de progreso.",
                addStreak: "todoDev.addStreak(1, 'active') suma días a la racha simulada.",
                clearDevStreak: 'todoDev.clearDevStreak() limpia solo las tareas marcadas como racha dev.',
                snapshot: "todoDev.snapshot('Etiqueta') guarda un punto de restauración.",
                restoreSnapshot: 'todoDev.restoreSnapshot() restaura el último snapshot dev.',
                clearSnapshot: 'todoDev.clearSnapshot() elimina el snapshot dev guardado.',
                feature: "todoDev.feature('first-spark') manda un logro a la vitrina.",
                unfeature: "todoDev.unfeature('first-spark') lo quita de la vitrina.",
                finalizePending: 'todoDev.finalizePending() convierte logros en revisión en permanentes.'
            };
        }

        function createConsoleApi() {
            const api = {
                help: getDeveloperHelp,
                panel: () => {
                    developerModeEnabled = true;
                    ensurePanel();
                    return 'Panel desarrollador abierto';
                },
                state: () => cloneForConsole({
                    todos: getTodos(),
                    completionHistory: getCompletionHistory(),
                    dailyGoal: getDailyGoal(),
                    gamification: getGamification(),
                    achievements: getAllAchievements(),
                    analytics: getAnalyticsSnapshot(),
                    developerSnapshot: getDeveloperSnapshot()
                }),
                analytics: () => cloneForConsole(getAnalyticsSnapshot()),
                playCompletion: type => {
                    showCompletionAnimation(type || 'regular');
                    return type || 'regular';
                },
                playStreak: days => {
                    const streakDays = Math.max(Math.round(Number(days) || getCurrentStreak() || 1), 1);

                    showStreakDayCelebration(streakDays, { isRecord: true });
                    return streakDays;
                },
                playAchievement: achievementIdOrRarity => {
                    const achievements = getAllAchievements();
                    const achievement = achievements.find(item => item.id === achievementIdOrRarity)
                        || achievements.find(item => item.rarity === achievementIdOrRarity)
                        || achievements[0];
                    queueAchievementShowcase([achievement]);
                    return cloneForConsole(achievement);
                },
                runAnimationDemo: () => {
                    runAnimationDemo();
                    return 'Demo en marcha';
                },
                unlockAll: options => {
                    captureDeveloperSnapshot('Antes de todoDev.unlockAll');
                    unlockAllAchievements(options || { animate: true });
                    return api.state();
                },
                grant: (achievementId, options) => cloneForConsole(grantAchievement(achievementId, !options || options.animate !== false)),
                lock: achievementId => {
                    captureDeveloperSnapshot('Antes de todoDev.lock');
                    removeAchievement(achievementId);
                    return api.state();
                },
                resetAchievements: () => {
                    captureDeveloperSnapshot('Antes de todoDev.resetAchievements');
                    resetAchievements();
                    return api.state();
                },
                resetAll: () => {
                    captureDeveloperSnapshot('Antes de todoDev.resetAll');
                    resetAllForDev();
                    return api.state();
                },
                addTask: (text, priority) => {
                    addTodoItem(text || 'Tarea creada desde modo dev', priority || 'normal');
                    return cloneForConsole(getTodos()[getTodos().length - 1]);
                },
                addHabit: (text, priority) => {
                    addTodoItem(text || 'Hábito creado desde modo dev', priority || 'normal', { habit: true });
                    return cloneForConsole(getTodos()[getTodos().length - 1]);
                },
                previewTaskStates: () => cloneForConsole(addDeveloperStatePreviewTodos()),
                simulateDeletion7: () => cloneForConsole(simulateOverdueReviewFlowForDev()),
                simulateDeletion30: () => simulateOverdueAutoDeleteFlowForDev(),
                showDeletionInterfaces: () => cloneForConsole(showOverdueInterfacesForDev()),
                complete: todoId => {
                    const todo = getTodos().find(item => item.id === todoId);
                    if (todo) {
                        const completedAt = getNowTimestamp();
                        todo.completed = true;
                        todo.completedOn = getTodayKey();
                        todo.completedAt = completedAt;
                        todo.updatedAt = completedAt;
                        todo.snoozedUntil = null;
                        createNextHabitOccurrence(todo);
                        saveTodoList();
                        syncCompletionHistory();
                        syncAchievementCollection(true);
                        showCompletionAnimation(getHistoryCount(getTodayKey()) > getDailyGoal() ? 'legendary' : 'regular');
                        renderCurrentPage();
                    }
                    return cloneForConsole(todo || null);
                },
                reactivate: todoId => {
                    const todo = getTodos().find(item => item.id === todoId);
                    if (todo) {
                        reactivateTodoForToday(todo);
                        removeNextHabitOccurrence(todo);
                        saveTodoList();
                        syncCompletionHistory();
                        syncAchievementCollection(false);
                        renderCurrentPage();
                    }
                    return cloneForConsole(todo || null);
                },
                mission: () => {
                    const mission = getDailyMission();
                    return cloneForConsole({
                        id: mission.id,
                        title: mission.title,
                        current: mission.current(),
                        target: mission.target()
                    });
                },
                deleteTask: todoId => {
                    const todo = getTodos().find(item => item.id === todoId);
                    captureDeveloperSnapshot('Antes de todoDev.deleteTask');
                    if (todo) {
                        removeNextHabitOccurrence(todo);
                    }
                    setTodos(getTodos().filter(item => item.id !== todoId));
                    saveTodoList();
                    syncCompletionHistory();
                    syncAchievementCollection(false);
                    renderCurrentPage();
                    return api.state();
                },
                clearTasks: () => {
                    captureDeveloperSnapshot('Antes de todoDev.clearTasks');
                    setTodos([]);
                    saveTodoList();
                    syncCompletionHistory();
                    syncAchievementCollection(false);
                    renderCurrentPage();
                    return api.state();
                },
                completeAll: () => {
                    completeAllTodosForDev();
                    return api.state();
                },
                reactivateAll: () => {
                    getTodos().forEach(todo => {
                        removeNextHabitOccurrence(todo);
                        reactivateTodoForToday(todo);
                    });
                    saveTodoList();
                    syncCompletionHistory();
                    syncAchievementCollection(false);
                    renderCurrentPage();
                    return api.state();
                },
                addHistory: (dateKey, count, priority) => {
                    addCompletedTasksForDate(dateKey || getTodayKey(), count || getDailyGoal(), priority || 'normal');
                    return api.state();
                },
                setGoal: value => {
                    updateDailyGoal(value, true);
                    return getDailyGoal();
                },
                setStreak: (days, mode) => cloneForConsole(setDeveloperStreakForDev(days, mode || 'active', true)),
                addStreak: (days, mode) => cloneForConsole(addDeveloperStreakDaysForDev(days || 1, mode || 'active')),
                clearDevStreak: () => clearDeveloperStreakForDev(),
                snapshot: label => cloneForConsole(captureDeveloperSnapshot(label || 'Snapshot manual dev')),
                restoreSnapshot: () => cloneForConsole(restoreDeveloperSnapshotForDev()),
                clearSnapshot: () => {
                    clearDeveloperSnapshotForDev();
                    return null;
                },
                feature: achievementId => {
                    const featuredAchievements = gamificationController.featureAchievement
                        ? gamificationController.featureAchievement(achievementId)
                        : [];
                    renderCurrentPage();
                    return cloneForConsole(featuredAchievements);
                },
                unfeature: achievementId => {
                    const featuredAchievements = gamificationController.unfeatureAchievement
                        ? gamificationController.unfeatureAchievement(achievementId)
                        : [];
                    renderCurrentPage();
                    return cloneForConsole(featuredAchievements);
                },
                finalizePending: () => {
                    forceFinalizePendingAchievements();
                    return api.state();
                }
            };

            return api;
        }

        function activateDeveloperMode() {
            const api = createConsoleApi();

            windowRef.todoDev = api;
            developerModeEnabled = true;
            ensurePanel();
            if (windowRef.console && windowRef.console.info) {
                windowRef.console.info('Modo desarrollador activo. Usa el panel visual integrado o todoDev.help() para comandos avanzados.');
            }

            return api;
        }

        function install() {
            if (!windowRef) {
                return;
            }

            windowRef.activarModoDesarrollador = activateDeveloperMode;
            windowRef.enableTodoDevMode = activateDeveloperMode;
            windowRef.abrirPanelDesarrollador = () => {
                const api = windowRef.todoDev || activateDeveloperMode();
                developerModeEnabled = true;
                ensurePanel();
                return api;
            };

            if (windowRef.location && (windowRef.location.search.includes('dev=1') || windowRef.location.hash.toLowerCase() === '#dev')) {
                activateDeveloperMode();
            }
        }

        function setHours(date, hours) {
            const next = new Date(date);
            next.setHours(hours, 0, 0, 0);
            return next;
        }

        return {
            install,
            activate: activateDeveloperMode,
            refreshPanel,
            ensurePanel,
            isStatePreviewTodo: isDeveloperStatePreviewTodo,
            getSnapshot: getDeveloperSnapshot,
            captureSnapshot: captureDeveloperSnapshot,
            restoreSnapshot: restoreDeveloperSnapshotForDev,
            clearSnapshot: clearDeveloperSnapshotForDev,
            addStatePreviewTodos: addDeveloperStatePreviewTodos,
            setStreak: setDeveloperStreakForDev,
            addStreak: addDeveloperStreakDaysForDev,
            clearDevStreak: clearDeveloperStreakForDev,
            getHelp: getDeveloperHelp
        };
    }

    function fn(candidate, fallback) {
        return typeof candidate === 'function' ? candidate : fallback;
    }

    global.TasklyzenDeveloper = {
        createDeveloperModeController,
        isStatePreviewTodo
    };
})(window);
