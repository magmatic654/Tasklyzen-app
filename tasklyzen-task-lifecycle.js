/*
 * Modulo: reglas de ciclo de vida de tareas.
 * Proposito: decidir que huella analitica conserva una tarea al eliminarse.
 * Entradas: tarea, motivo de eliminacion y TasklyzenTasks inyectado.
 * Salidas: window.TasklyzenTaskLifecycle.
 * Dependencias: TasklyzenTasks para leer la fecha limite.
 */
(function exposeTasklyzenTaskLifecycle(global) {
    const RETAINED_REMOVAL_TYPES = new Set([
        'task_expired',
        'task_auto_deleted'
    ]);

    function isExpiredAtRemoval(todo, taskApi) {
        if (!todo || !taskApi || typeof taskApi.getTodoDeadlineInfo !== 'function') {
            return false;
        }

        const deadline = taskApi.getTodoDeadlineInfo(todo);

        return Boolean(
            deadline
            && deadline.hasDeadline
            && Number.isFinite(deadline.remainingHours)
            && deadline.remainingHours <= 0
        );
    }

    function getRemovalAnalyticsState(todo, type, options) {
        const config = options || {};
        const eventType = typeof type === 'string' && type ? type : 'task_deleted';
        const taskApi = config.taskApi || global.TasklyzenTasks;
        const expiredAtRemoval = isExpiredAtRemoval(todo, taskApi);
        const retainedByType = RETAINED_REMOVAL_TYPES.has(eventType);

        return {
            analyticsRetained: retainedByType || expiredAtRemoval,
            expiredAtRemoval,
            retentionReason: retainedByType
                ? 'retention-flow'
                : expiredAtRemoval
                    ? 'expired-at-removal'
                    : 'discarded-before-expiration'
        };
    }

    global.TasklyzenTaskLifecycle = {
        retainedRemovalTypes: () => Array.from(RETAINED_REMOVAL_TYPES),
        isExpiredAtRemoval,
        getRemovalAnalyticsState
    };
})(window);
