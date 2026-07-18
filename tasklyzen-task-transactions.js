/*
 * Module: task transactions.
 * Purpose: apply task and milestone mutations with their effects once.
 * Inputs: injected state, TaskManager, effects and persistence callbacks.
 * Outputs: window.TasklyzenTaskTransactions.
 * Dependencies: TaskManager, TasklyzenTaskEffects and runtime callbacks.
 */
(function exposeTasklyzenTaskTransactions(global) {
    function createMutationId() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }

        return 'mutation-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function createTaskTransactionController(options) {
        const config = options || {};
        const taskManager = config.taskManager;
        const taskEffects = config.taskEffects || {};
        const compositeTasks = config.compositeTasks || {};
        const getTodos = typeof config.getTodos === 'function' ? config.getTodos : () => [];
        const setTodos = typeof config.setTodos === 'function' ? config.setTodos : () => {};
        const getTodayKey = typeof config.getTodayKey === 'function' ? config.getTodayKey : () => '';
        const getNowTimestamp = typeof config.getNowTimestamp === 'function'
            ? config.getNowTimestamp
            : () => new Date().toISOString();
        const getDateKeyFromTimestamp = typeof config.getDateKeyFromTimestamp === 'function'
            ? config.getDateKeyFromTimestamp
            : () => null;
        const isCompositeTask = typeof config.isCompositeTask === 'function' ? config.isCompositeTask : () => false;
        const createNextHabitOccurrence = typeof config.createNextHabitOccurrence === 'function'
            ? config.createNextHabitOccurrence
            : () => {};
        const removeNextHabitOccurrenceFromList = typeof config.removeNextHabitOccurrenceFromList === 'function'
            ? config.removeNextHabitOccurrenceFromList
            : (todo, todoItems) => todoItems;
        const persist = typeof config.persist === 'function' ? config.persist : () => {};
        const syncDerivedState = typeof config.syncDerivedState === 'function' ? config.syncDerivedState : () => {};

        if (!taskManager
            || typeof taskManager.complete !== 'function'
            || typeof taskManager.reactivate !== 'function'
            || typeof taskManager.removeById !== 'function') {
            throw new Error('TasklyzenTaskTransactions necesita un TaskManager valido.');
        }

        function getTodo(id) {
            const source = Array.isArray(getTodos()) ? getTodos() : [];

            return source.find(item => item && item.id === id) || null;
        }

        function getSimpleTodo(id) {
            const todo = getTodo(id);

            if (!todo || isCompositeTask(todo)) {
                return null;
            }

            return todo;
        }

        function getCompositeTodo(id) {
            const todo = getTodo(id);

            return todo && isCompositeTask(todo) ? todo : null;
        }

        function getCompletionState(todo) {
            return {
                completed: Boolean(todo && todo.completed),
                completedOn: todo && todo.completedOn ? todo.completedOn : getDateKeyFromTimestamp(todo && todo.completedAt),
                completedAt: todo && todo.completedAt ? todo.completedAt : null
            };
        }

        function createResult(action, metadata) {
            const data = metadata || {};
            const changed = Boolean(data.changed);

            return {
                mutationId: data.mutationId || createMutationId(),
                action,
                source: data.source || 'tasks',
                occurredAt: data.occurredAt || getNowTimestamp(),
                dateKey: data.dateKey || getTodayKey(),
                target: {
                    todoId: data.todo && data.todo.id ? data.todo.id : data.todoId || null,
                    subtaskId: data.subtask && data.subtask.id ? data.subtask.id : data.subtaskId || null
                },
                changed,
                reason: data.reason || null,
                before: data.before || null,
                after: data.after || null,
                todo: data.todo || null,
                removal: data.removal || null,
                completionEffect: data.completionEffect || null,
                subtaskEffect: data.subtaskEffect || null,
                transition: data.transition || null,
                transitionEffect: data.transitionEffect || null,
                conversion: Boolean(data.conversion),
                events: Array.isArray(data.events) ? data.events : (changed ? [{ type: action }] : []),
                credits: data.credits || [],
                feedback: data.feedback || null
            };
        }

        function persistTransaction() {
            persist();
            syncDerivedState();
        }

        function applyCompositeTransition(todo, previousState, metadata) {
            const meta = metadata || {};
            const previous = previousState || getCompletionState(todo);
            const dateKey = meta.dateKey || getTodayKey();
            const timestamp = meta.occurredAt || getNowTimestamp();

            if (!todo || typeof compositeTasks.synchronizeCompositeTask !== 'function') {
                return { transition: null, transitionEffect: null };
            }

            todo.completed = Boolean(previous.completed);
            if (previous.completed) {
                todo.completedOn = previous.completedOn || null;
                todo.completedAt = previous.completedAt || null;
            }

            const transition = compositeTasks.synchronizeCompositeTask(todo, { dateKey, timestamp });
            const transitionEffect = typeof taskEffects.handleCompositeTransition === 'function'
                ? taskEffects.handleCompositeTransition(todo, transition, {
                    dateKey,
                    source: meta.source || 'tasks',
                    sessionId: meta.sessionId || null,
                    mutationId: meta.mutationId,
                    previousCompletedOn: previous.completedOn || null
                })
                : null;

            return { transition, transitionEffect };
        }

        function syncComposite(todoId, previousState, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getCompositeTodo(todoId);

            if (!todo) {
                return createResult('composite_synced', {
                    todoId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found-or-not-composite'
                });
            }

            const compositeState = applyCompositeTransition(todo, previousState, {
                ...meta,
                mutationId
            });
            persistTransaction();

            return createResult('composite_synced', {
                todo,
                source: meta.source,
                mutationId,
                dateKey: meta.dateKey || getTodayKey(),
                changed: true,
                before: previousState || null,
                after: getCompletionState(todo),
                transition: compositeState.transition,
                transitionEffect: compositeState.transitionEffect
            });
        }

        function complete(todoId, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getSimpleTodo(todoId);

            if (!todo) {
                return createResult('task_completed', {
                    todoId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found-or-composite'
                });
            }

            if (todo.completed) {
                return createResult('task_completed', {
                    todo,
                    source: meta.source,
                    mutationId,
                    before: { completed: true },
                    after: { completed: true },
                    reason: 'already-completed'
                });
            }

            const completedAt = meta.completedAt || getNowTimestamp();
            const dateKey = meta.dateKey || getTodayKey() || getDateKeyFromTimestamp(completedAt);
            const completion = taskManager.complete(todo, {
                completedAt,
                completedOn: dateKey
            });

            createNextHabitOccurrence(todo);
            const completionEffect = typeof taskEffects.handleTaskCompletion === 'function'
                ? taskEffects.handleTaskCompletion(todo, {
                    dateKey,
                    completedAt: completion.completedAt,
                    source: meta.source || 'tasks',
                    sessionId: meta.sessionId || null,
                    mutationId
                })
                : null;

            persistTransaction();

            return createResult('task_completed', {
                todo,
                source: meta.source,
                mutationId,
                occurredAt: completedAt,
                dateKey,
                changed: true,
                before: { completed: false },
                after: { completed: true },
                completionEffect,
                credits: [{ kind: 'task', todoId: todo.id, dateKey }],
                feedback: completionEffect
                    ? { sound: completionEffect.celebrationType || null, animation: completionEffect.celebrationType || null }
                    : null
            });
        }

        function reactivate(todoId, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getSimpleTodo(todoId);

            if (!todo) {
                return createResult('task_reactivated', {
                    todoId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found-or-composite'
                });
            }

            if (!todo.completed) {
                return createResult('task_reactivated', {
                    todo,
                    source: meta.source,
                    mutationId,
                    before: { completed: false },
                    after: { completed: false },
                    reason: 'already-active'
                });
            }

            const completedOn = todo.completedOn || getDateKeyFromTimestamp(todo.completedAt);
            const reactivatedAt = meta.reactivatedAt || getNowTimestamp();
            taskManager.reactivate(todo, { reactivatedAt });
            setTodos(removeNextHabitOccurrenceFromList(todo, getTodos()));

            if (typeof taskEffects.handleTaskReactivation === 'function') {
                taskEffects.handleTaskReactivation(todo, {
                    dateKey: meta.dateKey || getTodayKey(),
                    completedOn,
                    reactivatedAt,
                    source: meta.source || 'tasks',
                    sessionId: meta.sessionId || null,
                    mutationId
                });
            }

            persistTransaction();

            return createResult('task_reactivated', {
                todo,
                source: meta.source,
                mutationId,
                occurredAt: reactivatedAt,
                dateKey: meta.dateKey || getTodayKey(),
                changed: true,
                before: { completed: true, completedOn },
                after: { completed: false },
                credits: completedOn ? [{ kind: 'task', todoId: todo.id, dateKey: completedOn, action: 'revoke' }] : []
            });
        }

        function remove(todoId, removalType, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getTodo(todoId);

            if (!todo) {
                return createResult(removalType || 'task_deleted', {
                    todoId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found'
                });
            }

            const removal = taskManager.removeById(getTodos(), todoId);
            const nextTodos = removeNextHabitOccurrenceFromList(todo, removal.todos);
            const removalState = typeof taskEffects.handleRemoval === 'function'
                ? taskEffects.handleRemoval(todo, removalType || 'task_deleted', {
                    source: meta.source || 'tasks',
                    mutationId
                })
                : null;

            setTodos(nextTodos);
            persistTransaction();

            return createResult(removalType || 'task_deleted', {
                todo,
                source: meta.source,
                mutationId,
                changed: true,
                before: { completed: Boolean(todo.completed) },
                removal: removalState,
                credits: removalState && !removalState.analyticsRetained
                    ? [{ kind: 'task', todoId: todo.id, action: 'revoke-if-earned' }]
                    : [],
                after: null
            });
        }

        function setSubtaskCompletion(todoId, subtaskId, completed, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getCompositeTodo(todoId);
            const subtask = todo && Array.isArray(todo.subtasks)
                ? todo.subtasks.find(item => item && item.id === subtaskId) || null
                : null;

            if (!todo || !subtask) {
                return createResult('subtask_' + (completed ? 'completed' : 'reactivated'), {
                    todoId,
                    subtaskId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found'
                });
            }

            const nextCompleted = Boolean(completed);

            if (Boolean(subtask.completed) === nextCompleted) {
                return createResult('subtask_' + (nextCompleted ? 'completed' : 'reactivated'), {
                    todo,
                    subtask,
                    source: meta.source,
                    mutationId,
                    before: { completed: Boolean(subtask.completed) },
                    after: { completed: Boolean(subtask.completed) },
                    reason: nextCompleted ? 'already-completed' : 'already-active'
                });
            }

            const previousTaskState = getCompletionState(todo);
            const wasCompleted = Boolean(subtask.completed);
            const previousCompletedAt = subtask.completedAt || null;
            const occurredAt = meta.occurredAt || getNowTimestamp();
            const dateKey = meta.dateKey || getTodayKey() || getDateKeyFromTimestamp(occurredAt);

            subtask.completed = nextCompleted;
            subtask.completedAt = nextCompleted ? occurredAt : null;
            subtask.updatedAt = occurredAt;

            const compositeState = applyCompositeTransition(todo, previousTaskState, {
                ...meta,
                mutationId,
                occurredAt,
                dateKey
            });
            const subtaskEffect = typeof taskEffects.handleSubtaskTransition === 'function'
                ? taskEffects.handleSubtaskTransition(todo, subtask, {
                    wasCompleted,
                    previousCompletedAt,
                    dateKey,
                    source: meta.source || 'tasks',
                    sessionId: meta.sessionId || null,
                    mutationId,
                    skipProgressCredit: Boolean(compositeState.transition && compositeState.transition.completedNow)
                })
                : null;

            persistTransaction();

            return createResult('subtask_' + (nextCompleted ? 'completed' : 'reactivated'), {
                todo,
                subtask,
                source: meta.source,
                mutationId,
                occurredAt,
                dateKey,
                changed: true,
                before: { completed: wasCompleted, taskCompleted: previousTaskState.completed },
                after: { completed: nextCompleted, taskCompleted: Boolean(todo.completed) },
                subtaskEffect,
                transition: compositeState.transition,
                transitionEffect: compositeState.transitionEffect,
                credits: subtaskEffect && subtaskEffect.credited
                    ? [{ kind: 'subtask', todoId: todo.id, subtaskId: subtask.id, dateKey }]
                    : compositeState.transition && compositeState.transition.completedNow
                        ? [{ kind: 'task', todoId: todo.id, dateKey }]
                        : []
            });
        }

        function removeSubtask(todoId, subtaskId, strategy, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getCompositeTodo(todoId);
            const subtask = todo && Array.isArray(todo.subtasks)
                ? todo.subtasks.find(item => item && item.id === subtaskId) || null
                : null;
            const removalStrategy = strategy || 'remove';

            if (!todo || !subtask) {
                return createResult('subtask_deleted', {
                    todoId,
                    subtaskId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found'
                });
            }

            const replacement = removalStrategy === 'promote-optional'
                ? todo.subtasks.find(item => item.id !== subtaskId && item.optional) || null
                : null;

            if (removalStrategy === 'promote-optional' && !replacement) {
                return createResult('subtask_deleted', {
                    todo,
                    subtask,
                    source: meta.source,
                    mutationId,
                    reason: 'missing-optional-replacement'
                });
            }

            const dateKey = meta.dateKey || getTodayKey();
            const occurredAt = meta.occurredAt || getNowTimestamp();
            const previousTaskState = getCompletionState(todo);
            const removal = typeof taskEffects.handleSubtaskRemoval === 'function'
                ? taskEffects.handleSubtaskRemoval(todo, subtask, {
                    dateKey,
                    source: meta.source || 'tasks',
                    mutationId
                })
                : null;

            if (removalStrategy === 'convert-normal') {
                if (typeof taskEffects.revokeTodayCredits === 'function') {
                    taskEffects.revokeTodayCredits(todo);
                }

                todo.type = 'normal';
                delete todo.subtasks;
                delete todo.compositeStatus;
                todo.completed = false;
                todo.completedOn = null;
                todo.completedAt = null;
                todo.deadlineStartedAt = occurredAt;
                todo.updatedAt = occurredAt;
                persistTransaction();

                return createResult('subtask_deleted', {
                    todo,
                    subtask,
                    source: meta.source,
                    mutationId,
                    occurredAt,
                    dateKey,
                    changed: true,
                    before: previousTaskState,
                    after: { completed: false },
                    removal,
                    conversion: true
                });
            }

            if (replacement) {
                replacement.optional = false;
                replacement.updatedAt = occurredAt;
            }

            todo.subtasks = todo.subtasks
                .filter(item => item.id !== subtaskId)
                .map((item, index) => ({ ...item, order: index }));
            const compositeState = applyCompositeTransition(todo, previousTaskState, {
                ...meta,
                mutationId,
                occurredAt,
                dateKey
            });
            const promotion = replacement && typeof taskEffects.handleSubtaskPromotion === 'function'
                ? taskEffects.handleSubtaskPromotion(todo, replacement, {
                    dateKey,
                    source: meta.source || 'tasks',
                    mutationId
                })
                : null;

            persistTransaction();

            return createResult('subtask_deleted', {
                todo,
                subtask,
                source: meta.source,
                mutationId,
                occurredAt,
                dateKey,
                changed: true,
                before: previousTaskState,
                after: getCompletionState(todo),
                removal,
                transition: compositeState.transition,
                transitionEffect: compositeState.transitionEffect,
                events: [{ type: 'subtask_deleted' }].concat(promotion ? [{ type: 'subtask_promoted' }] : [])
            });
        }

        function convertCompositeToNormal(todoId, metadata) {
            const meta = metadata || {};
            const mutationId = meta.mutationId || createMutationId();
            const todo = getCompositeTodo(todoId);

            if (!todo) {
                return createResult('composite_converted', {
                    todoId,
                    source: meta.source,
                    mutationId,
                    reason: 'not-found-or-not-composite'
                });
            }

            const before = getCompletionState(todo);
            const occurredAt = meta.occurredAt || getNowTimestamp();

            if (typeof taskEffects.revokeTodayCredits === 'function') {
                taskEffects.revokeTodayCredits(todo);
            }

            todo.type = 'normal';
            delete todo.subtasks;
            delete todo.compositeStatus;
            todo.completed = false;
            todo.completedOn = null;
            todo.completedAt = null;
            todo.deadlineStartedAt = occurredAt;
            todo.updatedAt = occurredAt;
            persistTransaction();

            return createResult('composite_converted', {
                todo,
                source: meta.source,
                mutationId,
                occurredAt,
                changed: true,
                before,
                after: { completed: false },
                conversion: true
            });
        }

        return {
            complete,
            reactivate,
            remove,
            syncComposite,
            setSubtaskCompletion,
            removeSubtask,
            convertCompositeToNormal
        };
    }

    global.TasklyzenTaskTransactions = { createTaskTransactionController };
})(window);
