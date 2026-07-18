/*
 * Modulo: efectos derivados de mutaciones de tareas.
 * Proposito: aplicar eventos analiticos y creditos sostenibles de forma consistente.
 * Entradas: tarea ya mutada, contexto de accion y dependencias inyectadas.
 * Salidas: window.TasklyzenTaskEffects.
 * Dependencias: TasklyzenTaskLifecycle y servicios inyectados por el runtime.
 */
(function exposeTasklyzenTaskEffects(global) {
    function noop() {}

    function createTaskEffectsController(options) {
        const config = options || {};
        const taskApi = config.taskApi || global.TasklyzenTasks || {};
        const lifecycle = config.lifecycle || global.TasklyzenTaskLifecycle || {};
        const sustainableProgress = config.sustainableProgress || {};
        const getTodayKey = typeof config.getTodayKey === 'function' ? config.getTodayKey : () => '';
        const getDateKeyFromTimestamp = typeof config.getDateKeyFromTimestamp === 'function'
            ? config.getDateKeyFromTimestamp
            : () => null;
        const getHoursBetween = typeof config.getHoursBetween === 'function' ? config.getHoursBetween : () => 0;
        const getTodoAgeDays = typeof config.getTodoAgeDays === 'function' ? config.getTodoAgeDays : () => 0;
        const getDailyGoal = typeof config.getDailyGoal === 'function' ? config.getDailyGoal : () => 1;
        const getHistoryCount = typeof config.getHistoryCount === 'function' ? config.getHistoryCount : () => 0;
        const getLongestActiveStreak = typeof config.getLongestActiveStreak === 'function'
            ? config.getLongestActiveStreak
            : () => 0;
        const hasCelebratedStreakDate = typeof config.hasCelebratedStreakDate === 'function'
            ? config.hasCelebratedStreakDate
            : () => false;
        const createMutationId = typeof config.createMutationId === 'function'
            ? config.createMutationId
            : () => 'mutation-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        const logAnalyticsEvent = typeof config.logAnalyticsEvent === 'function' ? config.logAnalyticsEvent : noop;
        const discardAnalyticsEvents = typeof config.discardAnalyticsEvents === 'function'
            ? config.discardAnalyticsEvents
            : noop;

        function getCompletionDateKey(todo) {
            return todo && (todo.completedOn || getDateKeyFromTimestamp(todo.completedAt));
        }

        function createTaskPayload(todo, details) {
            const source = todo || {};

            return {
                todoId: source.id,
                text: source.text,
                priority: source.priority,
                habit: Boolean(source.habit),
                timeLimitDays: source.timeLimitDays,
                dueDate: source.dueDate,
                createdOn: source.createdOn,
                createdAt: source.createdAt,
                deadlineStartedAt: source.deadlineStartedAt,
                ...(details || {})
            };
        }

        function createSubtaskPayload(todo, subtask, details) {
            const step = subtask || {};

            return createTaskPayload(todo, {
                subtaskId: step.id || null,
                subtaskTitle: step.title || '',
                subtaskOptional: Boolean(step.optional),
                subtaskRequired: !step.optional,
                ...(details || {})
            });
        }

        function resolveMutationId(metadata) {
            const meta = metadata || {};

            return typeof meta.mutationId === 'string' && meta.mutationId
                ? meta.mutationId
                : createMutationId();
        }

        function getCompletedCreditTargets(todo, dateKey) {
            const targets = [];
            const targetDate = dateKey || null;
            const taskDate = getCompletionDateKey(todo);

            if (todo && todo.completed && taskDate && (!targetDate || taskDate === targetDate)) {
                targets.push({ kind: 'task', todoId: todo.id, dateKey: taskDate });
            }

            (Array.isArray(todo && todo.subtasks) ? todo.subtasks : []).forEach(subtask => {
                const subtaskDate = subtask && !subtask.optional && subtask.completed
                    ? getDateKeyFromTimestamp(subtask.completedAt)
                    : null;

                if (subtaskDate && (!targetDate || subtaskDate === targetDate)) {
                    targets.push({
                        kind: 'subtask',
                        todoId: todo.id,
                        subtaskId: subtask.id,
                        dateKey: subtaskDate
                    });
                }
            });

            return targets;
        }

        function revokeCreditTargets(targets) {
            (Array.isArray(targets) ? targets : []).forEach(target => {
                if (target.kind === 'task' && typeof sustainableProgress.revokeTaskCompletion === 'function') {
                    sustainableProgress.revokeTaskCompletion(target.todoId, target.dateKey);
                }

                if (target.kind === 'subtask' && typeof sustainableProgress.revokeSubtaskCompletion === 'function') {
                    sustainableProgress.revokeSubtaskCompletion(target.todoId, target.subtaskId, target.dateKey);
                }
            });
        }

        function getRemovalAnalyticsState(todo, type) {
            if (typeof lifecycle.getRemovalAnalyticsState !== 'function') {
                return { analyticsRetained: false, expiredAtRemoval: false };
            }

            return lifecycle.getRemovalAnalyticsState(todo, type, { taskApi });
        }

        function handleRemoval(todo, type, metadata) {
            const eventType = type || 'task_deleted';
            const meta = metadata || {};
            const analyticsState = getRemovalAnalyticsState(todo, eventType);

            if (!analyticsState.analyticsRetained) {
                revokeCreditTargets(getCompletedCreditTargets(todo));
                discardAnalyticsEvents(todo.id);
                return analyticsState;
            }

            logAnalyticsEvent(eventType, createTaskPayload(todo, {
                mutationId: resolveMutationId(meta),
                source: meta.source || 'tasks',
                outcome: 'applied',
                completedOn: todo.completedOn,
                completedAt: todo.completedAt,
                wasCompleted: Boolean(todo.completed),
                analyticsRetained: true,
                expiredAtRemoval: analyticsState.expiredAtRemoval,
                ageDays: getTodoAgeDays(todo)
            }));

            return analyticsState;
        }

        function handleTaskCompletion(todo, metadata) {
            const meta = metadata || {};
            const mutationId = resolveMutationId(meta);
            const todayKey = meta.dateKey || getTodayKey();
            const completedAt = meta.completedAt || todo.completedAt;
            const previousTodayCount = getHistoryCount(todayKey);
            const previousRecord = getLongestActiveStreak();
            const nextTodayCount = previousTodayCount + 1;

            if (typeof sustainableProgress.recordTaskCompletion === 'function') {
                sustainableProgress.recordTaskCompletion(todo, {
                    dateKey: todayKey,
                    completedAt,
                    source: meta.source || 'tasks',
                    sessionId: meta.sessionId || null
                });
            }

            const eventDetails = {
                mutationId,
                source: meta.source || 'tasks',
                outcome: 'applied',
                habit: Object.prototype.hasOwnProperty.call(meta, 'habit') ? Boolean(meta.habit) : Boolean(todo.habit),
                completedOn: todo.completedOn,
                completedAt: todo.completedAt,
                completionValue: todo.completionValue,
                hoursToComplete: getHoursBetween(todo.createdAt, completedAt)
            };

            if (meta.composite) {
                eventDetails.composite = true;
            }

            logAnalyticsEvent('task_completed', createTaskPayload(todo, eventDetails));

            return {
                todayKey,
                mutationId,
                previousRecord,
                shouldCelebrateStreak: previousTodayCount === 0 && !hasCelebratedStreakDate(todayKey),
                celebrationType: nextTodayCount > getDailyGoal()
                    ? 'legendary'
                    : nextTodayCount === getDailyGoal()
                        ? 'goal'
                        : 'regular'
            };
        }

        function handleTaskReactivation(todo, metadata) {
            const meta = metadata || {};
            const mutationId = resolveMutationId(meta);
            const todayKey = meta.dateKey || getTodayKey();
            const completedOn = meta.completedOn || null;

            if (completedOn === todayKey && typeof sustainableProgress.revokeTaskCompletion === 'function') {
                sustainableProgress.revokeTaskCompletion(todo.id, completedOn);
            }

            const eventDetails = {
                mutationId,
                source: meta.source || 'tasks',
                outcome: 'applied',
                habit: Object.prototype.hasOwnProperty.call(meta, 'habit') ? Boolean(meta.habit) : Boolean(todo.habit),
                reactivatedOn: todayKey,
                reactivatedAt: meta.reactivatedAt || todo.updatedAt
            };

            if (meta.composite) {
                eventDetails.composite = true;
            }

            logAnalyticsEvent('task_reactivated', createTaskPayload(todo, eventDetails));

            return { mutationId, todayKey };
        }

        function handleCompositeTransition(todo, transition, metadata) {
            if (!transition || !transition.changed) {
                return null;
            }

            const meta = metadata || {};
            const todayKey = meta.dateKey || getTodayKey();

            if (transition.completedNow) {
                const completion = handleTaskCompletion(todo, {
                    ...meta,
                    dateKey: todayKey,
                    completedAt: todo.completedAt,
                    habit: false,
                    composite: true
                });

                return {
                    completedNow: true,
                    ...completion,
                    feedbackType: completion.celebrationType === 'regular' ? 'regular' : 'goal'
                };
            }

            if (transition.reactivatedNow) {
                handleTaskReactivation(todo, {
                    ...meta,
                    dateKey: todayKey,
                    completedOn: meta.previousCompletedOn || todayKey,
                    reactivatedAt: todo.updatedAt,
                    habit: false,
                    composite: true
                });
                return { reactivatedNow: true, todayKey };
            }

            return null;
        }

        function handleSubtaskTransition(todo, subtask, metadata) {
            const meta = metadata || {};
            const todayKey = meta.dateKey || getTodayKey();
            const mutationId = resolveMutationId(meta);

            if (!todo || !subtask) {
                return null;
            }

            if (!meta.wasCompleted && subtask.completed) {
                const shouldCredit = !subtask.optional && !meta.skipProgressCredit;

                if (shouldCredit && typeof sustainableProgress.recordSubtaskCompletion === 'function') {
                    sustainableProgress.recordSubtaskCompletion(todo.id, subtask.id, {
                        dateKey: todayKey,
                        completedAt: subtask.completedAt,
                        source: meta.source || 'tasks',
                        sessionId: meta.sessionId || null
                    });
                }

                logAnalyticsEvent('subtask_completed', createSubtaskPayload(todo, subtask, {
                    mutationId,
                    source: meta.source || 'tasks',
                    outcome: 'applied',
                    completedAt: subtask.completedAt,
                    completedOn: getDateKeyFromTimestamp(subtask.completedAt),
                    progressCredit: shouldCredit
                }));

                return { mutationId, action: 'subtask_completed', credited: shouldCredit };
            }

            if (meta.wasCompleted && !subtask.completed) {
                const completedOn = getDateKeyFromTimestamp(meta.previousCompletedAt);

                if (!subtask.optional && completedOn === todayKey
                    && typeof sustainableProgress.revokeSubtaskCompletion === 'function') {
                    sustainableProgress.revokeSubtaskCompletion(todo.id, subtask.id, todayKey);
                }

                logAnalyticsEvent('subtask_reactivated', createSubtaskPayload(todo, subtask, {
                    mutationId,
                    source: meta.source || 'tasks',
                    outcome: 'applied',
                    previousCompletedAt: meta.previousCompletedAt || null,
                    previousCompletedOn: completedOn || null
                }));

                return { mutationId, action: 'subtask_reactivated', revoked: !subtask.optional && completedOn === todayKey };
            }

            return null;
        }

        function handleSubtaskRemoval(todo, subtask, metadata) {
            const meta = typeof metadata === 'string' ? { dateKey: metadata } : (metadata || {});
            const dateKey = meta.dateKey || getTodayKey();
            const mutationId = resolveMutationId(meta);

            if (!todo || !subtask) {
                return null;
            }

            const completedOn = getDateKeyFromTimestamp(subtask.completedAt);

            if (!subtask.optional && subtask.completed && completedOn === dateKey
                && typeof sustainableProgress.revokeSubtaskCompletion === 'function') {
                sustainableProgress.revokeSubtaskCompletion(todo.id, subtask.id, dateKey);
            }

            logAnalyticsEvent('subtask_deleted', createSubtaskPayload(todo, subtask, {
                mutationId,
                source: meta.source || 'tasks',
                outcome: 'applied',
                wasCompleted: Boolean(subtask.completed),
                completedOn: completedOn || null
            }));

            return { mutationId, action: 'subtask_deleted', revoked: !subtask.optional && completedOn === dateKey };
        }

        function handleSubtaskPromotion(todo, subtask, metadata) {
            const meta = typeof metadata === 'string' ? { dateKey: metadata } : (metadata || {});
            const dateKey = meta.dateKey || getTodayKey();
            const mutationId = resolveMutationId(meta);
            const completedOn = subtask && getDateKeyFromTimestamp(subtask.completedAt);
            const shouldCredit = Boolean(todo && subtask && subtask.completed && completedOn === dateKey
                && typeof sustainableProgress.recordSubtaskCompletion === 'function');

            if (!todo || !subtask) {
                return null;
            }

            if (shouldCredit) {
                sustainableProgress.recordSubtaskCompletion(todo.id, subtask.id, {
                    dateKey,
                    completedAt: subtask.completedAt,
                    source: meta.source || 'tasks'
                });
            }

            logAnalyticsEvent('subtask_promoted', createSubtaskPayload(todo, subtask, {
                mutationId,
                source: meta.source || 'tasks',
                outcome: 'applied',
                completedOn: completedOn || null
            }));

            return { mutationId, action: 'subtask_promoted', credited: shouldCredit };
        }

        return {
            createTaskPayload,
            createSubtaskPayload,
            getCompletedCreditTargets,
            getRemovalAnalyticsState,
            handleRemoval,
            handleTaskCompletion,
            handleTaskReactivation,
            handleCompositeTransition,
            handleSubtaskTransition,
            handleSubtaskRemoval,
            handleSubtaskPromotion,
            revokeCreditTargets,
            revokeDiscardedTodo: todo => revokeCreditTargets(getCompletedCreditTargets(todo)),
            revokeTodayCredits: todo => revokeCreditTargets(getCompletedCreditTargets(todo, getTodayKey()))
        };
    }

    global.TasklyzenTaskEffects = {
        createTaskEffectsController
    };
})(window);
