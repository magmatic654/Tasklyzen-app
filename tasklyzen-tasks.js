/*
 * Módulo: gestión de tareas
 * Propósito:
 * - Crear tareas y calcular estados operativos: disponible, a tiempo, por vencer, vencida.
 * Entradas:
 * - Datos de tarea, TasklyzenConfig y TasklyzenUtils.
 * Salidas:
 * - window.TasklyzenTasks con fábrica y predicados de tareas.
 * Dependencias:
 * - tasklyzen-config.js, tasklyzen-utils.js.
 */
(function exposeTasklyzenTasks(global) {
    const config = global.TasklyzenConfig.defaults;
    const utils = global.TasklyzenUtils;

    function normalizeTaskTimeLimit(value) {
        const parsedValue = Math.round(Number(value));

        if (!Number.isFinite(parsedValue)) {
            return config.taskTimeLimitDefaultDays;
        }

        return Math.min(Math.max(parsedValue, config.taskTimeLimitDefaultDays), config.taskTimeLimitMaxDays);
    }

    function normalizeTaskDueDate(value) {
        return utils.isDateKey(value) ? value : null;
    }

    function getLegacyDueDate(deadlineStartedAt, timeLimitDays) {
        const safeLimit = normalizeTaskTimeLimit(timeLimitDays);
        const startedDateKey = utils.getDateKeyFromTimestamp(deadlineStartedAt);
        const startedDate = utils.getStartOfDay(new Date(startedDateKey + 'T00:00:00'));

        if (Number.isNaN(startedDate.getTime())) {
            return null;
        }

        return utils.formatDateKey(utils.addDays(startedDate, safeLimit));
    }

    function getTaskTimeLimitDays(todo) {
        return normalizeTaskTimeLimit(todo && todo.timeLimitDays);
    }

    function getTaskDueDate(todo) {
        return normalizeTaskDueDate(todo && todo.dueDate);
    }

    function getDueDateEndOfDay(dateKey) {
        const date = new Date(dateKey + 'T23:59:59.999');

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function createTodo(text, priority, options) {
        const taskConfig = options || {};
        const createdOn = taskConfig.createdOn || utils.getTodayKey();
        const createdAt = taskConfig.createdAt || (taskConfig.createdOn ? utils.createTimestampFromDateKey(createdOn) : utils.getNowTimestamp());
        const deadlineStartedAt = utils.normalizeTimestamp(taskConfig.deadlineStartedAt || createdAt, createdOn);
        const hasExplicitDueDate = Object.prototype.hasOwnProperty.call(taskConfig, 'dueDate');
        const hasLegacyTimeLimit = Object.prototype.hasOwnProperty.call(taskConfig, 'timeLimitDays');
        const dueDate = hasExplicitDueDate
            ? normalizeTaskDueDate(taskConfig.dueDate)
            : hasLegacyTimeLimit ? getLegacyDueDate(deadlineStartedAt, taskConfig.timeLimitDays) : null;

        const todo = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            text,
            type: taskConfig.type === 'composite' ? 'composite' : 'normal',
            priority,
            completed: false,
            completedOn: null,
            completedAt: null,
            createdOn,
            createdAt,
            deadlineStartedAt,
            dueDate,
            deletedAt: null,
            updatedAt: createdAt,
            completionValue: Math.max(Math.round(Number(taskConfig.completionValue) || 1), 1),
            timeLimitDays: normalizeTaskTimeLimit(taskConfig.timeLimitDays),
            habit: Boolean(taskConfig.habit),
            recurrence: taskConfig.recurrence || (taskConfig.habit ? 'daily' : 'none'),
            snoozedUntil: taskConfig.snoozedUntil || null,
            sourceHabitId: taskConfig.sourceHabitId || null
        };

        if (todo.type === 'composite') {
            const compositeApi = global.TasklyzenCompositeTasks;
            todo.subtasks = compositeApi
                ? compositeApi.normalizeSubtasks(taskConfig.subtasks)
                : (Array.isArray(taskConfig.subtasks) ? taskConfig.subtasks : []);
        }

        return todo;
    }

    function getTodoAgeDays(todo) {
        return utils.getDaysSince(todo.createdAt || utils.createTimestampFromDateKey(todo.createdOn));
    }

    function getTodoOperationalAgeDays(todo) {
        return utils.getDaysSince(todo.deadlineStartedAt || todo.createdAt || utils.createTimestampFromDateKey(todo.createdOn));
    }

    function isTodoExpired(todo) {
        return isTodoDeadlineLate(todo);
    }

    function isCompletedTodoCleanable(todo) {
        return Boolean(todo.completed) && getTodoAgeDays(todo) >= 1;
    }

    function getTodoDeadlineInfo(todo) {
        const dueDate = getTaskDueDate(todo);
        const startedAt = new Date(todo && (todo.deadlineStartedAt || todo.createdAt || utils.createTimestampFromDateKey(todo.createdOn)));
        const safeStartedAt = Number.isNaN(startedAt.getTime())
            ? new Date(utils.createTimestampFromDateKey(utils.getTodayKey()))
            : startedAt;

        if (!dueDate) {
            return {
                hasDeadline: false,
                dueDate: null,
                limitDays: null,
                createdAt: safeStartedAt,
                startedAt: safeStartedAt,
                deadlineAt: null,
                remainingHours: Infinity,
                totalHours: null
            };
        }

        const deadlineAt = getDueDateEndOfDay(dueDate);

        if (!deadlineAt) {
            return {
                hasDeadline: false,
                dueDate: null,
                limitDays: null,
                createdAt: safeStartedAt,
                startedAt: safeStartedAt,
                deadlineAt: null,
                remainingHours: Infinity,
                totalHours: null
            };
        }

        const totalHours = Math.max(Math.round(((deadlineAt - safeStartedAt) / 3600000) * 10) / 10, 0);
        const remainingHours = Math.round(((deadlineAt - new Date()) / 3600000) * 10) / 10;

        return {
            hasDeadline: true,
            dueDate,
            limitDays: Math.max(Math.ceil(totalHours / 24), 1),
            createdAt: safeStartedAt,
            startedAt: safeStartedAt,
            deadlineAt,
            remainingHours,
            totalHours
        };
    }

    function getTodoDeadlineState(todo) {
        if (!todo || todo.completed) {
            return null;
        }

        const deadline = getTodoDeadlineInfo(todo);
        if (!deadline.hasDeadline || !deadline.deadlineAt) {
            return null;
        }

        const deadlineLabel = 'fecha límite ' + deadline.dueDate;

        if (deadline.remainingHours <= 0) {
            return {
                level: 'late',
                label: 'Vencida',
                message: 'La ' + deadlineLabel + ' ya venció. Decide si cerrarla, editarla o eliminarla.'
            };
        }

        if (deadline.remainingHours <= config.taskDeadlineSoonHours) {
            return {
                level: 'soon',
                label: 'Por vencer',
                message: 'Quedan ' + utils.formatDurationHours(deadline.remainingHours) + ' para su fecha límite.'
            };
        }

        return {
            level: 'on-time',
            label: 'A tiempo',
            message: 'Sigue a tiempo para su fecha límite.'
        };
    }

    function getTodoUrgencyState(todo) {
        if (todo.completed) {
            return null;
        }

        return getTodoDeadlineState(todo);
    }

    function isTodoSnoozedForToday(todo) {
        return !todo.completed && utils.isDateKey(todo.snoozedUntil) && todo.snoozedUntil > utils.getTodayKey();
    }

    function isTodoDeadlineLate(todo) {
        const deadlineState = getTodoDeadlineState(todo);

        return Boolean(deadlineState && deadlineState.level === 'late');
    }

    function isTodoAvailableToday(todo) {
        return !todo.completed
            && !isTodoDeadlineLate(todo)
            && (!utils.isDateKey(todo.snoozedUntil) || todo.snoozedUntil <= utils.getTodayKey());
    }

    global.TasklyzenTasks = {
        normalizeTaskTimeLimit,
        normalizeTaskDueDate,
        getLegacyDueDate,
        getTaskTimeLimitDays,
        getTaskDueDate,
        createTodo,
        getTodoAgeDays,
        getTodoOperationalAgeDays,
        isTodoExpired,
        isCompletedTodoCleanable,
        getTodoDeadlineInfo,
        getTodoDeadlineState,
        getTodoUrgencyState,
        isTodoSnoozedForToday,
        isTodoDeadlineLate,
        isTodoAvailableToday
    };
})(window);
