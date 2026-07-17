/*
 * Modulo: clases POO para navegador clasico
 * Proposito:
 * - Exponer TaskState, TaskManager, AnalyticsEngine y UIController en window.
 * Entradas:
 * - APIs globales TasklyzenTasks, TasklyzenUtils y TasklyzenDom.
 * Salidas:
 * - window.TasklyzenOOP con clases reutilizables por main.js.
 * Dependencias:
 * - tasklyzen-tasks.js, tasklyzen-utils.js, tasklyzen-dom.js.
 */
(function exposeTasklyzenOOP(global) {
    class TaskState {
        #taskApi;

        constructor({ taskApi = global.TasklyzenTasks } = {}) {
            this.#taskApi = this.#requireTaskApi(taskApi);
        }

        normalizeTimeLimit(value) {
            return this.#taskApi.normalizeTaskTimeLimit(value);
        }

        getTimeLimitDays(todo) {
            return this.#taskApi.getTaskTimeLimitDays(todo);
        }

        normalizeDueDate(value) {
            return this.#taskApi.normalizeTaskDueDate(value);
        }

        getDueDate(todo) {
            return this.#taskApi.getTaskDueDate(todo);
        }

        getAgeDays(todo) {
            return this.#taskApi.getTodoAgeDays(todo);
        }

        getOperationalAgeDays(todo) {
            return this.#taskApi.getTodoOperationalAgeDays(todo);
        }

        isExpired(todo) {
            return this.#taskApi.isTodoExpired(todo);
        }

        isCleanable(todo) {
            return this.#taskApi.isCompletedTodoCleanable(todo);
        }

        getDeadlineInfo(todo) {
            return this.#taskApi.getTodoDeadlineInfo(todo);
        }

        getDeadlineState(todo) {
            return this.#taskApi.getTodoDeadlineState(todo);
        }

        getUrgencyState(todo) {
            return this.#taskApi.getTodoUrgencyState(todo);
        }

        isSnoozedForToday(todo) {
            return this.#taskApi.isTodoSnoozedForToday(todo);
        }

        isLate(todo) {
            return this.#taskApi.isTodoDeadlineLate(todo);
        }

        isAvailableToday(todo) {
            return this.#taskApi.isTodoAvailableToday(todo);
        }

        #requireTaskApi(taskApi) {
            const requiredMethods = [
                'normalizeTaskTimeLimit',
                'normalizeTaskDueDate',
                'getTaskTimeLimitDays',
                'getTaskDueDate',
                'getTodoAgeDays',
                'getTodoOperationalAgeDays',
                'isTodoExpired',
                'isCompletedTodoCleanable',
                'getTodoDeadlineInfo',
                'getTodoDeadlineState',
                'getTodoUrgencyState',
                'isTodoSnoozedForToday',
                'isTodoDeadlineLate',
                'isTodoAvailableToday'
            ];

            if (!taskApi || requiredMethods.some(method => typeof taskApi[method] !== 'function')) {
                throw new Error('TaskState necesita una API TasklyzenTasks valida.');
            }

            return taskApi;
        }
    }

    class TaskManager {
        #taskApi;
        #utils;
        #taskState;
        #taskTitleMaxLength;

        constructor({
            taskApi = global.TasklyzenTasks,
            utils = global.TasklyzenUtils,
            taskState = null,
            taskTitleMaxLength = global.TasklyzenConfig && global.TasklyzenConfig.defaults
                ? global.TasklyzenConfig.defaults.taskTitleMaxLength
                : 96
        } = {}) {
            this.#taskApi = this.#requireTaskApi(taskApi);
            this.#utils = this.#requireUtils(utils);
            this.#taskState = taskState || new TaskState({ taskApi: this.#taskApi });
            this.#taskTitleMaxLength = Math.max(Math.round(Number(taskTitleMaxLength) || 96), 1);
        }

        create(text, priority = 'normal', options = {}) {
            const cleanText = this.#normalizeTitle(text, 'TaskManager.create necesita texto de tarea.');

            const createOptions = { ...options };
            if (createOptions.type === 'composite') {
                const compositeApi = global.TasklyzenCompositeTasks;
                const validation = compositeApi && compositeApi.validateCompositeDraft(cleanText, createOptions.subtasks);
                if (!validation || !validation.valid) {
                    throw new Error(validation ? validation.message : 'No se pudo validar la tarea compuesta.');
                }
                createOptions.subtasks = validation.subtasks;
            }

            return this.#taskApi.createTodo(cleanText, priority || 'normal', createOptions);
        }

        update(todo, changes = {}) {
            this.#assertTodo(todo);

            if (typeof changes.text === 'string') {
                todo.text = this.#normalizeTitle(changes.text, 'El título de la tarea no puede quedar vacío.');
            }

            if (typeof changes.priority === 'string') {
                todo.priority = changes.priority;
            }

            if (Object.prototype.hasOwnProperty.call(changes, 'timeLimitDays')) {
                todo.timeLimitDays = this.#taskApi.normalizeTaskTimeLimit(changes.timeLimitDays);
            }

            if (Object.prototype.hasOwnProperty.call(changes, 'dueDate')) {
                todo.dueDate = this.#taskApi.normalizeTaskDueDate(changes.dueDate);
            }

            todo.updatedAt = changes.updatedAt || this.#utils.getNowTimestamp();
            return todo;
        }

        #normalizeTitle(value, emptyMessage) {
            const cleanTitle = String(value || '').trim();

            if (!cleanTitle) {
                throw new Error(emptyMessage);
            }

            if (cleanTitle.length > this.#taskTitleMaxLength) {
                throw new Error('El título de la tarea puede tener hasta ' + this.#taskTitleMaxLength + ' caracteres.');
            }

            return cleanTitle;
        }

        complete(todo, options = {}) {
            this.#assertTodo(todo);
            if (todo.type === 'composite') {
                throw new Error('Una tarea compuesta se completa mediante sus subtareas obligatorias.');
            }
            const completedAt = options.completedAt || this.#utils.getNowTimestamp();
            const completedOn = options.completedOn || this.#utils.getDateKeyFromTimestamp(completedAt);

            todo.completed = true;
            todo.completedOn = completedOn;
            todo.completedAt = completedAt;
            todo.snoozedUntil = null;
            todo.updatedAt = completedAt;

            return { todo, completedAt, completedOn };
        }

        reactivate(todo, options = {}) {
            this.#assertTodo(todo);
            if (todo.type === 'composite') {
                throw new Error('Una tarea compuesta se reactiva mediante sus subtareas obligatorias.');
            }
            const reactivatedAt = options.reactivatedAt || this.#utils.getNowTimestamp();

            todo.completed = false;
            todo.completedOn = null;
            todo.completedAt = null;
            todo.deadlineStartedAt = reactivatedAt;
            todo.updatedAt = reactivatedAt;
            todo.snoozedUntil = null;

            return { todo, reactivatedAt };
        }

        removeById(todoItems, id) {
            const source = this.#ensureList(todoItems);
            const removedTodo = source.find(todo => todo.id === id) || null;

            return {
                todos: source.filter(todo => todo.id !== id),
                removedTodo
            };
        }

        getExpired(todoItems) {
            return this.#ensureList(todoItems).filter(todo => this.#taskState.isExpired(todo));
        }

        getCleanableCompleted(todoItems) {
            return this.#ensureList(todoItems).filter(todo => this.#taskState.isCleanable(todo));
        }

        clearCompleted(todoItems) {
            const source = this.#ensureList(todoItems);
            const cleanableTodos = this.getCleanableCompleted(source);
            const cleanableIds = new Set(cleanableTodos.map(todo => todo.id));

            return {
                todos: source.filter(todo => !cleanableIds.has(todo.id)),
                removedTodos: cleanableTodos
            };
        }

        #assertTodo(todo) {
            if (!todo || typeof todo !== 'object') {
                throw new Error('TaskManager necesita una tarea valida.');
            }
        }

        #ensureList(todoItems) {
            return Array.isArray(todoItems) ? todoItems : [];
        }

        #requireTaskApi(taskApi) {
            if (!taskApi || typeof taskApi.createTodo !== 'function' || typeof taskApi.normalizeTaskTimeLimit !== 'function' || typeof taskApi.normalizeTaskDueDate !== 'function') {
                throw new Error('TaskManager necesita una API TasklyzenTasks valida.');
            }

            return taskApi;
        }

        #requireUtils(utils) {
            const requiredMethods = ['getNowTimestamp', 'getDateKeyFromTimestamp'];

            if (!utils || requiredMethods.some(method => typeof utils[method] !== 'function')) {
                throw new Error('TaskManager necesita una API TasklyzenUtils valida.');
            }

            return utils;
        }
    }

    class AnalyticsEngine {
        #utils;

        constructor({ utils = global.TasklyzenUtils } = {}) {
            this.#utils = utils || null;
        }

        getCompletionRate(completed, total) {
            if (!Number.isFinite(total) || total <= 0) {
                return 0;
            }

            return this.#clampPercent(Math.round((Number(completed) / total) * 100));
        }

        getAverageDaily(total, days) {
            if (!Number.isFinite(days) || days <= 0) {
                return 0;
            }

            return Number(total || 0) / days;
        }

        getBestEntry(entries, metric = 'completed') {
            return this.#ensureEntries(entries).reduce((bestEntry, entry) => {
                return Number(entry[metric] || 0) > Number(bestEntry[metric] || 0) ? entry : bestEntry;
            }, { dateKey: null, [metric]: 0 });
        }

        buildSeries(entries, metric = 'completed') {
            return this.#ensureEntries(entries).map(entry => ({
                dateKey: entry.dateKey || null,
                label: this.#formatEntryLabel(entry),
                value: Number(entry[metric] || 0),
                source: entry
            }));
        }

        summarizeFlow({ entries = [], lifecycle = {} } = {}) {
            const completed = Number(lifecycle.completed || 0);
            const eligible = Number(lifecycle.eligible || 0);

            return {
                eligible,
                completed,
                completionRate: this.getCompletionRate(completed, eligible),
                averageDaily: this.getAverageDaily(completed, entries.length),
                bestDay: this.getBestEntry(entries, 'completed'),
                hasFlow: eligible > 0 || completed > 0 || Number(lifecycle.reactivated || 0) > 0
            };
        }

        #ensureEntries(entries) {
            return Array.isArray(entries) ? entries : [];
        }

        #formatEntryLabel(entry) {
            if (entry && entry.date instanceof Date && this.#utils && typeof this.#utils.formatDateKey === 'function') {
                return this.#utils.formatDateKey(entry.date);
            }

            return entry && entry.dateKey ? entry.dateKey : '';
        }

        #clampPercent(value) {
            if (!Number.isFinite(value)) {
                return 0;
            }

            return Math.min(Math.max(value, 0), 100);
        }
    }

    class UIController {
        #documentRef;
        #dom;

        constructor({
            documentRef = global.document,
            dom = global.TasklyzenDom
        } = {}) {
            this.#documentRef = documentRef || null;
            this.#dom = dom || {};
        }

        get dom() {
            return this.#dom;
        }

        createElement(tagName, { className = '', text = '', attributes = {} } = {}) {
            if (!this.#documentRef) {
                throw new Error('UIController necesita document para crear elementos.');
            }

            const element = this.#documentRef.createElement(tagName);

            if (className) {
                element.className = className;
            }

            if (text !== '') {
                element.textContent = text;
            }

            Object.entries(attributes).forEach(([name, value]) => {
                element.setAttribute(name, value);
            });

            return element;
        }

        clear(element) {
            if (this.#isElement(element)) {
                element.innerHTML = '';
            }
        }

        setText(element, value) {
            if (this.#isElement(element)) {
                element.textContent = String(value);
            }
        }

        setHidden(element, hidden) {
            if (this.#isElement(element)) {
                element.hidden = Boolean(hidden);
            }
        }

        toggleClass(element, className, enabled) {
            if (this.#isElement(element) && className) {
                element.classList.toggle(className, Boolean(enabled));
            }
        }

        setButtonDisabled(button, disabled) {
            if (this.#isElement(button)) {
                button.disabled = Boolean(disabled);
            }
        }

        #isElement(element) {
            return Boolean(element && typeof element === 'object');
        }
    }

    global.TasklyzenOOP = {
        TaskState,
        TaskManager,
        AnalyticsEngine,
        UIController
    };
})(window);
