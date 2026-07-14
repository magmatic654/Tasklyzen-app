/*
 * Modulo: TaskState
 * Proposito: calcular estados inteligentes de una tarea.
 * Entradas: objeto tarea y API TasklyzenTasks.
 * Salidas: estados, plazos y predicados de vencimiento.
 * Dependencias: tasklyzen-tasks.js.
 */
const runtimeGlobal = typeof window !== 'undefined' ? window : globalThis;

export class TaskState {
    #taskApi;

    constructor({ taskApi = runtimeGlobal.TasklyzenTasks } = {}) {
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
