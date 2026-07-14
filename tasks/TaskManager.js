/*
 * Modulo: TaskManager
 * Proposito: crear, completar, reactivar, eliminar y limpiar tareas.
 * Entradas: listas de tareas, cambios de usuario y APIs de fecha/tarea.
 * Salidas: tareas mutadas o nuevas listas con resultado de operacion.
 * Dependencias: TaskState, tasklyzen-tasks.js, tasklyzen-utils.js.
 */
import { TaskState } from './TaskState.js';

const runtimeGlobal = typeof window !== 'undefined' ? window : globalThis;

export class TaskManager {
    #taskApi;
    #utils;
    #taskState;

    constructor({
        taskApi = runtimeGlobal.TasklyzenTasks,
        utils = runtimeGlobal.TasklyzenUtils,
        taskState = null
    } = {}) {
        this.#taskApi = this.#requireTaskApi(taskApi);
        this.#utils = this.#requireUtils(utils);
        this.#taskState = taskState || new TaskState({ taskApi: this.#taskApi });
    }

    create(text, priority = 'normal', options = {}) {
        const cleanText = String(text || '').trim();

        if (!cleanText) {
            throw new Error('TaskManager.create necesita texto de tarea.');
        }

        const createOptions = { ...options };
        if (createOptions.type === 'composite') {
            const compositeApi = runtimeGlobal.TasklyzenCompositeTasks;
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
            todo.text = changes.text.trim();
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
