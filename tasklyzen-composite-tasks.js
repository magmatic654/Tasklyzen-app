/*
 * Modulo: dominio de tareas compuestas
 * Proposito: normalizar subtareas y derivar progreso/estado de la tarea principal.
 * Entradas: tareas y cambios de subtareas.
 * Salidas: window.TasklyzenCompositeTasks.
 * Dependencias: TasklyzenUtils.
 */
(function exposeTasklyzenCompositeTasks(global) {
    const utils = global.TasklyzenUtils;

    function createId() {
        return global.crypto && typeof global.crypto.randomUUID === 'function'
            ? global.crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function cleanTitle(value) {
        return String(value || '').trim();
    }

    function createSubtask(title, options) {
        const config = options || {};
        const createdAt = config.createdAt || utils.getNowTimestamp();

        return {
            id: config.id || createId(),
            title: cleanTitle(title),
            completed: Boolean(config.completed),
            optional: Boolean(config.optional),
            order: Number.isFinite(Number(config.order)) ? Number(config.order) : 0,
            createdAt,
            updatedAt: config.updatedAt || createdAt,
            completedAt: config.completed ? (config.completedAt || createdAt) : null
        };
    }

    function normalizeSubtasks(subtasks) {
        return (Array.isArray(subtasks) ? subtasks : [])
            .map((subtask, index) => createSubtask(subtask && subtask.title, {
                ...subtask,
                order: index
            }))
            .filter(subtask => subtask.title)
            .map((subtask, index) => ({ ...subtask, order: index }));
    }

    function getStableSubtasks(subtasks) {
        return (Array.isArray(subtasks) ? subtasks : [])
            .filter(subtask => subtask && subtask.id)
            .map((subtask, index) => ({
                ...subtask,
                order: Number.isFinite(Number(subtask.order)) ? Number(subtask.order) : index
            }));
    }

    function getDisplaySubtasks(subtasks, options) {
        const config = options || {};
        const orderIds = Array.isArray(config.orderIds) ? config.orderIds : [];
        const completedFor = typeof config.isCompleted === 'function'
            ? config.isCompleted
            : subtask => Boolean(subtask.completed);

        return getStableSubtasks(subtasks)
            .map((subtask, index) => {
                const customOrder = orderIds.indexOf(subtask.id);

                return {
                    ...subtask,
                    displayOrder: customOrder >= 0 ? customOrder : subtask.order,
                    displayIndex: index,
                    displayCompleted: Boolean(completedFor(subtask))
                };
            })
            .sort((first, second) => Number(first.displayCompleted) - Number(second.displayCompleted)
                || first.displayOrder - second.displayOrder
                || first.displayIndex - second.displayIndex)
            .map(({ displayOrder, displayIndex, displayCompleted, ...subtask }) => subtask);
    }

    function moveSubtask(subtasks, subtaskId, direction, options) {
        const config = options || {};
        const offset = Number(direction);
        const canonical = getStableSubtasks(subtasks).sort((first, second) => first.order - second.order);
        const visible = getDisplaySubtasks(canonical);
        const visibleIndex = visible.findIndex(subtask => subtask.id === subtaskId);
        const target = visible[visibleIndex + offset];

        if (!Number.isInteger(offset) || Math.abs(offset) !== 1 || visibleIndex < 0 || !target) {
            return null;
        }

        const current = visible[visibleIndex];
        if (Boolean(current.completed) !== Boolean(target.completed)) {
            return null;
        }

        const currentIndex = canonical.findIndex(subtask => subtask.id === current.id);
        const targetIndex = canonical.findIndex(subtask => subtask.id === target.id);
        if (currentIndex < 0 || targetIndex < 0) {
            return null;
        }

        [canonical[currentIndex], canonical[targetIndex]] = [canonical[targetIndex], canonical[currentIndex]];
        const updatedAt = config.updatedAt || utils.getNowTimestamp();

        return canonical.map((subtask, order) => ({ ...subtask, order, updatedAt }));
    }

    function isCompositeTask(task) {
        return Boolean(task && task.type === 'composite' && Array.isArray(task.subtasks));
    }

    function getCompositeTaskProgress(task) {
        const subtasks = normalizeSubtasks(task && task.subtasks);
        const required = subtasks.filter(subtask => !subtask.optional);
        const optional = subtasks.filter(subtask => subtask.optional);

        return {
            requiredCompleted: required.filter(subtask => subtask.completed).length,
            requiredTotal: required.length,
            optionalCompleted: optional.filter(subtask => subtask.completed).length,
            optionalTotal: optional.length,
            totalCompleted: subtasks.filter(subtask => subtask.completed).length,
            total: subtasks.length
        };
    }

    function getCompositeTaskStatus(task) {
        const progress = getCompositeTaskProgress(task);

        if (progress.requiredTotal === 0 || progress.requiredCompleted < progress.requiredTotal) {
            return 'in-progress';
        }

        if (progress.optionalCompleted < progress.optionalTotal) {
            return 'completed-with-optional-pending';
        }

        return 'fully-completed';
    }

    function isCompositeTaskCompleted(task) {
        return getCompositeTaskStatus(task) !== 'in-progress';
    }

    function getCompositeProgressLabel(task) {
        const progress = getCompositeTaskProgress(task);
        const required = progress.requiredCompleted + '/' + progress.requiredTotal + ' obligatorias';
        const optionalPending = progress.optionalTotal - progress.optionalCompleted;

        if (getCompositeTaskStatus(task) === 'fully-completed') {
            return progress.total + '/' + progress.total + ' completadas';
        }

        return optionalPending > 0 && progress.requiredCompleted === progress.requiredTotal
            ? required + ' · ' + optionalPending + ' opcional' + (optionalPending === 1 ? '' : 'es') + ' pendiente' + (optionalPending === 1 ? '' : 's')
            : required;
    }

    function validateCompositeDraft(title, subtasks) {
        const normalized = normalizeSubtasks(subtasks);
        const duplicateTitles = new Set();
        const seen = new Set();

        normalized.forEach(subtask => {
            const key = subtask.title.toLocaleLowerCase('es');
            if (seen.has(key)) duplicateTitles.add(key);
            seen.add(key);
        });

        if (!cleanTitle(title)) return { valid: false, message: 'Escribe el título de la tarea principal.' };
        if (normalized.length === 0) return { valid: false, message: 'Añade al menos una subtarea.' };
        if (!normalized.some(subtask => !subtask.optional)) return { valid: false, message: 'Añade al menos una subtarea obligatoria.' };
        if (duplicateTitles.size > 0) return { valid: false, message: 'No repitas subtareas con el mismo título.' };

        return { valid: true, subtasks: normalized };
    }

    function synchronizeCompositeTask(task, options) {
        if (!isCompositeTask(task)) return { changed: false, completedNow: false, reactivatedNow: false, status: null };
        const config = options || {};
        const wasCompleted = Boolean(task.completed);
        const status = getCompositeTaskStatus(task);
        const completed = status !== 'in-progress';
        const timestamp = config.timestamp || utils.getNowTimestamp();

        task.completed = completed;
        task.compositeStatus = status;
        task.updatedAt = timestamp;

        if (completed && !wasCompleted) {
            task.completedAt = timestamp;
            task.completedOn = config.dateKey || utils.getDateKeyFromTimestamp(timestamp);
            task.snoozedUntil = null;
        } else if (!completed && wasCompleted) {
            task.completedAt = null;
            task.completedOn = null;
            task.deadlineStartedAt = timestamp;
        }

        return {
            changed: wasCompleted !== completed,
            completedNow: !wasCompleted && completed,
            reactivatedNow: wasCompleted && !completed,
            status
        };
    }

    function normalizeTask(task) {
        if (!task || typeof task !== 'object') return task;
        if (task.type !== 'composite' && !Array.isArray(task.subtasks)) {
            task.type = 'normal';
            delete task.subtasks;
            delete task.compositeStatus;
            return task;
        }

        task.type = 'composite';
        task.subtasks = normalizeSubtasks(task.subtasks);
        task.compositeStatus = getCompositeTaskStatus(task);
        task.completed = task.compositeStatus !== 'in-progress';
        if (!task.completed) {
            task.completedAt = null;
            task.completedOn = null;
        }
        return task;
    }

    global.TasklyzenCompositeTasks = {
        createSubtask,
        normalizeSubtasks,
        getDisplaySubtasks,
        moveSubtask,
        normalizeTask,
        isCompositeTask,
        getCompositeTaskProgress,
        getCompositeTaskStatus,
        getCompositeProgressLabel,
        isCompositeTaskCompleted,
        validateCompositeDraft,
        synchronizeCompositeTask
    };
})(window);
