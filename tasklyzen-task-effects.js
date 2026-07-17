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

        function handleRemoval(todo, type) {
            const eventType = type || 'task_deleted';
            const analyticsState = getRemovalAnalyticsState(todo, eventType);

            if (!analyticsState.analyticsRetained) {
                revokeCreditTargets(getCompletedCreditTargets(todo));
                discardAnalyticsEvents(todo.id);
                return analyticsState;
            }

            logAnalyticsEvent(eventType, createTaskPayload(todo, {
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
            const todayKey = meta.dateKey || getTodayKey();
            const completedOn = meta.completedOn || null;

            if (completedOn === todayKey && typeof sustainableProgress.revokeTaskCompletion === 'function') {
                sustainableProgress.revokeTaskCompletion(todo.id, completedOn);
            }

            const eventDetails = {
                habit: Object.prototype.hasOwnProperty.call(meta, 'habit') ? Boolean(meta.habit) : Boolean(todo.habit),
                reactivatedOn: todayKey,
                reactivatedAt: meta.reactivatedAt || todo.updatedAt
            };

            if (meta.composite) {
                eventDetails.composite = true;
            }

            logAnalyticsEvent('task_reactivated', createTaskPayload(todo, eventDetails));
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
                    completedOn: todayKey,
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

            if (!todo || !subtask || subtask.optional) {
                return;
            }

            if (!meta.wasCompleted && subtask.completed && typeof sustainableProgress.recordSubtaskCompletion === 'function') {
                sustainableProgress.recordSubtaskCompletion(todo.id, subtask.id, {
                    dateKey: todayKey,
                    completedAt: subtask.completedAt,
                    source: meta.source || 'tasks',
                    sessionId: meta.sessionId || null
                });
            } else if (meta.wasCompleted && !subtask.completed && getDateKeyFromTimestamp(meta.previousCompletedAt) === todayKey
                && typeof sustainableProgress.revokeSubtaskCompletion === 'function') {
                sustainableProgress.revokeSubtaskCompletion(todo.id, subtask.id, todayKey);
            }
        }

        function handleSubtaskRemoval(todo, subtask, dateKey) {
            if (!todo || !subtask || subtask.optional || !subtask.completed) {
                return;
            }

            const completedOn = getDateKeyFromTimestamp(subtask.completedAt);

            if (completedOn === dateKey && typeof sustainableProgress.revokeSubtaskCompletion === 'function') {
                sustainableProgress.revokeSubtaskCompletion(todo.id, subtask.id, dateKey);
            }
        }

        function handleSubtaskPromotion(todo, subtask, dateKey) {
            if (!todo || !subtask || !subtask.completed || getDateKeyFromTimestamp(subtask.completedAt) !== dateKey
                || typeof sustainableProgress.recordSubtaskCompletion !== 'function') {
                return;
            }

            sustainableProgress.recordSubtaskCompletion(todo.id, subtask.id, {
                dateKey,
                completedAt: subtask.completedAt,
                source: 'tasks'
            });
        }

        return {
            createTaskPayload,
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
