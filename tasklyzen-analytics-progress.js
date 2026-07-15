/*
 * Modulo: analitica y progreso
 * Proposito:
 * - Separar metricas, perfiles, graficos simples y vistas de progreso del runtime principal.
 * Entradas:
 * - Estado de tareas/progreso, utilidades, DOM de analitica y callbacks del runtime.
 * Salidas:
 * - window.TasklyzenAnalyticsProgress con createAnalyticsProgressController.
 * Dependencias:
 * - TasklyzenUiComponents por inyeccion o global; el resto llega por callbacks.
 */
(function exposeTasklyzenAnalyticsProgress(global) {
    const FLOW_PERIODS = ['weekly', 'monthly', 'quarterly'];
    const PROGRESS_VIEWS = ['today', 'analytics', 'streak'];
    const PROGRESS_VIEW_HEADINGS = {
        today: { kicker: 'Enfoque diario', title: 'Progreso de hoy' },
        analytics: { kicker: 'Lectura útil', title: 'Rendimiento' },
        streak: { kicker: 'Constancia', title: 'Tu racha' }
    };

    function normalizeFlowPeriod(value) {
        return FLOW_PERIODS.includes(value) ? value : 'weekly';
    }

    function normalizeProgressView(value) {
        return PROGRESS_VIEWS.includes(value) ? value : 'today';
    }

    function createAnalyticsProgressController(options) {
        const config = options || {};
        const dom = config.dom || {};
        const documentRef = config.documentRef || global.document;
        const components = config.components || global.TasklyzenUiComponents;
        const analyticsEngine = config.analyticsEngine || createFallbackEngine();
        const utils = config.utils || {};
        const defaults = config.defaults || {};
        const storage = config.storage || {};
        const keys = config.storageKeys || {};
        const getTodos = fn(config.getTodos, () => []);
        const getDailyStats = fn(config.getDailyStats, () => ({}));
        const getDailyGoal = fn(config.getDailyGoal, () => defaults.dailyGoal || 3);
        const setDailyGoal = fn(config.setDailyGoal, () => {});
        const getCompletionHistory = fn(config.getCompletionHistory, () => ({}));
        const getAnalyticsEvents = fn(config.getAnalyticsEvents, () => []);
        const setAnalyticsEvents = fn(config.setAnalyticsEvents, () => {});
        const getActiveProgressView = fn(config.getActiveProgressView, () => 'today');
        const setActiveProgressView = fn(config.setActiveProgressView, () => {});
        const getActiveFlowPeriod = fn(config.getActiveFlowPeriod, () => 'weekly');
        const setActiveFlowPeriod = fn(config.setActiveFlowPeriod, () => {});
        const getHistoryCount = fn(config.getHistoryCount, dateKey => Number(getCompletionHistory()[dateKey] || 0));
        const getTaskStats = fn(config.getTaskStats, () => ({ available: 0 }));
        const getTopPriorityTodo = fn(config.getTopPriorityTodo, () => null);
        const getNextActionReason = fn(config.getNextActionReason, () => '');
        const getPriorityLabel = fn(config.getPriorityLabel, () => 'Normal');
        const getPriorityRank = fn(config.getPriorityRank, () => 1);
        const getLifecycleAnalyticsForRange = fn(config.getLifecycleAnalyticsForRange, () => emptyLifecycle());
        const getRescueState = fn(config.getRescueState, () => ({}));
        const getCurrentStreak = fn(config.getCurrentStreak, () => 0);
        const getStreakBeforeToday = fn(config.getStreakBeforeToday, () => 0);
        const getTotalCompletedTasks = fn(config.getTotalCompletedTasks, () => 0);
        const getCompletedPriorityCount = fn(config.getCompletedPriorityCount, () => 0);
        const getTodayCompletedPriorityCount = fn(config.getTodayCompletedPriorityCount, () => 0);
        const getTodayCompletedHabitCount = fn(config.getTodayCompletedHabitCount, () => 0);
        const getSustainableMissionSnapshot = fn(config.getSustainableMissionSnapshot, () => null);
        const getSustainableDaySnapshot = fn(config.getSustainableDaySnapshot, () => null);
        const getSustainableRangeSummary = fn(config.getSustainableRangeSummary, () => ({ days: [] }));
        const getProgressMode = fn(config.getProgressMode, () => 'tasks');
        const getDailyFocusGoalMinutes = fn(config.getDailyFocusGoalMinutes, () => 50);
        const setDailyFocusGoalMinutes = fn(config.setDailyFocusGoalMinutes, () => {});
        const getTodoDeadlineState = fn(config.getTodoDeadlineState, () => null);
        const isTodoAvailableToday = fn(config.isTodoAvailableToday, todo => Boolean(todo && !todo.completed));
        const isProtectedDate = fn(config.isProtectedDate, () => false);
        const getContributionLevel = fn(config.getContributionLevel, count => Math.min(Math.max(Number(count) || 0, 0), 4));
        const renderStreakStats = fn(config.renderStreakStats, () => {});
        const renderStreakPrestigeRoad = fn(config.renderStreakPrestigeRoad, () => {});
        const renderStreakSafety = fn(config.renderStreakSafety, () => {});
        const renderNextReward = fn(config.renderNextReward, () => {});
        const showToast = fn(config.showToast, () => {});
        const saveDailyGoal = fn(config.saveDailyGoal, () => {});
        const logAnalyticsEvent = fn(config.logAnalyticsEvent, () => {});
        const scheduleContributionGridRender = fn(config.scheduleContributionGridRender, () => {});
        const updateDailyGoalCallback = fn(config.updateDailyGoal, value => updateDailyGoal(value, true));
        const getTodayKey = fn(utils.getTodayKey, () => new Date().toISOString().slice(0, 10));
        const getTomorrowKey = fn(utils.getTomorrowKey, () => getDateKeyByOffset(getTodayKey(), 1));
        const getStartOfDay = fn(utils.getStartOfDay, value => {
            const date = value ? new Date(value) : new Date();
            date.setHours(0, 0, 0, 0);
            return date;
        });
        const addDays = fn(utils.addDays, (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return next;
        });
        const formatDateKey = fn(utils.formatDateKey, date => new Date(date).toISOString().slice(0, 10));
        const isDateKey = fn(utils.isDateKey, value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')));
        const createTimestampFromDateKey = fn(utils.createTimestampFromDateKey, dateKey => dateKey + 'T12:00:00.000');
        const getDateKeyFromTimestamp = fn(utils.getDateKeyFromTimestamp, timestamp => String(timestamp || '').slice(0, 10));
        const getDateKeyByOffset = fn(utils.getDateKeyByOffset, (dateKey, offset) => formatDateKey(addDays(new Date(dateKey + 'T00:00:00'), offset)));
        const getHourFromTimestamp = fn(utils.getHourFromTimestamp, timestamp => new Date(timestamp).getHours());
        const getHoursBetween = fn(utils.getHoursBetween, (start, end) => (new Date(end) - new Date(start)) / 3600000);
        const getDaysSince = fn(utils.getDaysSince, timestamp => Math.floor((getStartOfDay(new Date()) - getStartOfDay(new Date(timestamp))) / 86400000));
        const formatMetricNumber = fn(utils.formatMetricNumber, value => String(Math.round((Number(value) || 0) * 10) / 10));
        const formatDurationHours = fn(utils.formatDurationHours, value => formatMetricNumber(value) + ' h');

        function readText(key, fallback) {
            return typeof storage.readText === 'function' ? storage.readText(key, fallback) : fallback;
        }

        function writeText(key, value) {
            if (typeof storage.writeText === 'function') {
                storage.writeText(key, value);
            }
        }

        function loadProgressView() {
            return normalizeProgressView(readText(keys.progressView, null));
        }

        function saveProgressView() {
            writeText(keys.progressView, getActiveProgressView());
        }

        function loadFlowPeriod() {
            return normalizeFlowPeriod(readText(keys.analyticsFlowPeriod, null));
        }

        function saveFlowPeriod() {
            writeText(keys.analyticsFlowPeriod, getActiveFlowPeriod());
        }

        function getDateLabel(dateKey, options) {
            const date = new Date(dateKey + 'T00:00:00');
            const formatterOptions = options || { weekday: 'short', day: 'numeric' };
            const label = date.toLocaleDateString('es-MX', formatterOptions).replace('.', '');

            return label.charAt(0).toUpperCase() + label.slice(1);
        }

        function getPeriodEntries(days, offsetDays) {
            const entries = [];
            const endDate = addDays(getStartOfDay(new Date()), -Math.max(Number(offsetDays) || 0, 0));

            for (let index = days - 1; index >= 0; index -= 1) {
                const date = addDays(endDate, -index);
                const dateKey = formatDateKey(date);

                entries.push({
                    date,
                    dateKey,
                    count: getHistoryCount(dateKey)
                });
            }

            return entries;
        }

        function getStatsFromEntries(entries) {
            const total = entries.reduce((sum, entry) => sum + entry.count, 0);
            const activeDays = entries.filter(entry => entry.count > 0).length;
            const goalDays = entries.filter(entry => entry.count >= getDailyGoal()).length;
            const averageDaily = entries.length > 0 ? total / entries.length : 0;
            const averageActive = activeDays > 0 ? total / activeDays : 0;
            const bestDay = entries.reduce((bestEntry, entry) => {
                return entry.count > bestEntry.count ? entry : bestEntry;
            }, { dateKey: null, count: 0 });

            return {
                entries,
                total,
                activeDays,
                goalDays,
                averageDaily,
                averageActive,
                bestDay
            };
        }

        function getPeriodStats(days, offsetDays) {
            return getStatsFromEntries(getPeriodEntries(days, offsetDays));
        }

        function getCurrentMonthStats(monthOffset) {
            const today = getStartOfDay(new Date());
            const offset = Math.max(Number(monthOffset) || 0, 0);
            const monthStart = new Date(today.getFullYear(), today.getMonth() - offset, 1);
            const monthEnd = offset === 0
                ? today
                : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const entries = [];
            let cursor = monthStart;

            while (cursor <= monthEnd) {
                const dateKey = formatDateKey(cursor);

                entries.push({
                    date: cursor,
                    dateKey,
                    count: getHistoryCount(dateKey)
                });
                cursor = addDays(cursor, 1);
            }

            return getStatsFromEntries(entries);
        }

        function getMonthLabel(date) {
            const label = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

            return label.charAt(0).toUpperCase() + label.slice(1);
        }

        function getMonthRange(monthOffset) {
            const today = getStartOfDay(new Date());
            const offset = Math.max(Number(monthOffset) || 0, 0);
            const start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
            const end = offset === 0
                ? today
                : new Date(start.getFullYear(), start.getMonth() + 1, 0);

            return {
                start,
                end,
                startKey: formatDateKey(start),
                endKey: formatDateKey(end),
                label: getMonthLabel(start)
            };
        }

        function getCurrentWeekRange() {
            const today = getStartOfDay(new Date());
            const mondayOffset = (today.getDay() + 6) % 7;
            const start = addDays(today, -mondayOffset);
            const end = addDays(start, 6);

            return {
                start,
                end,
                startKey: formatDateKey(start),
                endKey: formatDateKey(end)
            };
        }

        function getCurrentWeekToDateRange() {
            const today = getStartOfDay(new Date());
            const mondayOffset = (today.getDay() + 6) % 7;
            const start = addDays(today, -mondayOffset);

            return {
                start,
                end: today,
                startKey: formatDateKey(start),
                endKey: formatDateKey(today)
            };
        }

        function getCurrentQuarterRange() {
            const today = getStartOfDay(new Date());
            const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
            const start = new Date(today.getFullYear(), quarterStartMonth, 1);

            return {
                start,
                end: today,
                startKey: formatDateKey(start),
                endKey: formatDateKey(today)
            };
        }

        function getAnalyticsPeriodRange(period) {
            const normalizedPeriod = normalizeFlowPeriod(period);

            if (normalizedPeriod === 'monthly') {
                return {
                    ...getMonthRange(0),
                    period: normalizedPeriod,
                    label: 'Mensual',
                    captionSuffix: 'este mes'
                };
            }

            if (normalizedPeriod === 'quarterly') {
                return {
                    ...getCurrentQuarterRange(),
                    period: normalizedPeriod,
                    label: 'Trimestral',
                    captionSuffix: 'este trimestre'
                };
            }

            return {
                ...getCurrentWeekToDateRange(),
                period: 'weekly',
                label: 'Semanal',
                captionSuffix: 'esta semana'
            };
        }

        function getDailyStat(dateKey) {
            return getDailyStats()[dateKey] || createEmptyDailyStat(dateKey);
        }

        function getDailyStatsForRange(start, end) {
            const entries = [];
            let cursor = new Date(start);

            while (cursor <= end) {
                const dateKey = formatDateKey(cursor);

                entries.push({
                    date: new Date(cursor),
                    dateKey,
                    ...getDailyStat(dateKey)
                });
                cursor = addDays(cursor, 1);
            }

            return entries;
        }

        function getFlowAnalyticsForRange(range) {
            const entries = getDailyStatsForRange(range.start, range.end);
            const lifecycle = getLifecycleAnalyticsForRange(range.startKey, range.endKey);
            const completed = lifecycle.completed;
            const flowSummary = analyticsEngine.summarizeFlow({ entries, lifecycle });
            const records = Array.isArray(lifecycle.records) ? lifecycle.records : [];
            const completedRecords = Array.isArray(lifecycle.completedRecords) ? lifecycle.completedRecords : [];
            const habitRecords = records.filter(record => record && record.habit);
            const completedHabitRecords = completedRecords.filter(record => record && record.habit);

            return {
                ...range,
                entries,
                eligible: lifecycle.eligible,
                created: lifecycle.created,
                completed,
                deleted: lifecycle.deleted,
                reactivated: lifecycle.reactivated,
                notCompleted: lifecycle.notCompleted,
                completionRate: lifecycle.completionRate,
                averageDaily: flowSummary.averageDaily,
                bestDay: flowSummary.bestDay,
                hasFlow: flowSummary.hasFlow,
                activeDays: entries.filter(entry => (Number(entry.completed) || 0) > 0).length,
                habitEligible: habitRecords.length,
                habitCompleted: completedHabitRecords.length,
                habitCompletionRate: getPercent(completedHabitRecords.length, habitRecords.length)
            };
        }

        function getFlowPeriodAnalytics(period) {
            return getFlowAnalyticsForRange(getAnalyticsPeriodRange(period));
        }

        function formatFocusDuration(milliseconds) {
            const minutes = Math.max(Math.round((Number(milliseconds) || 0) / 60000), 0);

            if (minutes < 60) {
                return minutes + ' min';
            }

            const hours = Math.floor(minutes / 60);
            const remainder = minutes % 60;

            return hours + ' h' + (remainder ? ' ' + remainder + ' min' : '');
        }

        function getFocusPeriodAnalytics(period) {
            const range = getAnalyticsPeriodRange(period);
            const summary = getSustainableRangeSummary(range.startKey, range.endKey) || {};
            const days = Array.isArray(summary.days) ? summary.days : [];
            const dayMap = new Map(days.map(day => [day.dateKey, day]));
            const dailyEntries = getDailyStatsForRange(range.start, range.end).map(entry => {
                const day = dayMap.get(entry.dateKey) || {};

                return {
                    date: entry.date,
                    dateKey: entry.dateKey,
                    focusMs: Math.max(Number(day.focusMs) || 0, 0),
                    rewardedFocusMs: Math.max(Number(day.rewardedFocusMs) || 0, 0),
                    focusGoalMinutes: Math.max(Number(day.focusGoalMinutes) || Number(getDailyFocusGoalMinutes()) || 50, 15)
                };
            });
            const buckets = [];

            dailyEntries.forEach((entry, index) => {
                const key = range.period === 'quarterly'
                    ? entry.dateKey.slice(0, 7)
                    : range.period === 'monthly'
                        ? 'week-' + Math.floor(index / 7)
                        : entry.dateKey;
                let bucket = buckets.find(item => item.key === key);

                if (!bucket) {
                    bucket = { key, entries: [], focusMs: 0, rewardedFocusMs: 0, goalMinutes: 0 };
                    buckets.push(bucket);
                }

                bucket.entries.push(entry);
                bucket.focusMs += entry.focusMs;
                bucket.rewardedFocusMs += entry.rewardedFocusMs;
                bucket.goalMinutes += entry.focusGoalMinutes;
            });

            const chartEntries = buckets.map((bucket, index) => {
                const first = bucket.entries[0];
                const minutes = Math.round(bucket.focusMs / 60000);
                const rewardedMinutes = Math.round(bucket.rewardedFocusMs / 60000);
                const label = range.period === 'quarterly'
                    ? first.date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase()
                    : range.period === 'monthly'
                        ? 'S' + (index + 1)
                        : first.date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase();

                return {
                    dateKey: first.dateKey,
                    label,
                    minutes,
                    goalHit: rewardedMinutes >= bucket.goalMinutes
                };
            });
            const focusMs = Math.max(Number(summary.focusMs) || 0, 0);
            const rewardedFocusMs = Math.max(Number(summary.rewardedFocusMs) || 0, 0);
            const activeDays = dailyEntries.filter(entry => entry.focusMs > 0).length;
            const goalMinutes = dailyEntries.reduce((total, entry) => total + entry.focusGoalMinutes, 0);
            const goalPercent = goalMinutes > 0
                ? Math.min(Math.round((rewardedFocusMs / 60000 / goalMinutes) * 100), 100)
                : 0;

            return {
                ...range,
                days,
                chartEntries,
                focusMs,
                rewardedFocusMs,
                activeDays,
                averageFocusMs: activeDays ? Math.round(focusMs / activeDays) : 0,
                sustainableSessions: Math.max(Number(summary.sustainableSessions) || 0, 0),
                goalMinutes,
                goalPercent
            };
        }

        function getPreviousAnalyticsPeriodRange(period) {
            const current = getAnalyticsPeriodRange(period);
            const normalizedPeriod = current.period;
            const elapsedDays = Math.max(Math.round((current.end - current.start) / 86400000), 0);
            let start;
            let maximumEnd;

            if (normalizedPeriod === 'monthly') {
                start = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);
                maximumEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            } else if (normalizedPeriod === 'quarterly') {
                start = new Date(current.start.getFullYear(), current.start.getMonth() - 3, 1);
                maximumEnd = new Date(start.getFullYear(), start.getMonth() + 3, 0);
            } else {
                start = addDays(current.start, -7);
                maximumEnd = addDays(current.end, -7);
            }

            const comparableEnd = addDays(start, elapsedDays);
            const end = comparableEnd > maximumEnd ? maximumEnd : comparableEnd;

            return {
                start,
                end,
                startKey: formatDateKey(start),
                endKey: formatDateKey(end),
                period: normalizedPeriod,
                label: current.label,
                captionSuffix: 'en el periodo anterior'
            };
        }

        function getPreviousFlowPeriodAnalytics(period) {
            return getFlowAnalyticsForRange(getPreviousAnalyticsPeriodRange(period));
        }

        function isDateKeyInRange(dateKey, startKey, endKey) {
            return isDateKey(dateKey) && dateKey >= startKey && dateKey <= endKey;
        }

        function getTodoScheduleDateKey(todo) {
            if (todo.completed && isDateKey(todo.completedOn)) {
                return todo.completedOn;
            }

            if (isDateKey(todo.snoozedUntil)) {
                return todo.snoozedUntil;
            }

            if (isDateKey(todo.dueDate)) {
                return todo.dueDate;
            }

            return isDateKey(todo.createdOn) ? todo.createdOn : getTodayKey();
        }

        function getTodosRelevantForRange(startKey, endKey) {
            return getTodos().filter(todo => {
                return isDateKeyInRange(todo.createdOn, startKey, endKey)
                    || isDateKeyInRange(todo.completedOn, startKey, endKey)
                    || isDateKeyInRange(todo.snoozedUntil, startKey, endKey)
                    || isDateKeyInRange(todo.dueDate, startKey, endKey);
            });
        }

        function getPercent(part, total) {
            if (!total) {
                return 0;
            }

            return Math.min(Math.max(Math.round((part / total) * 100), 0), 100);
        }

        function getPluralLabel(count, singular, plural) {
            return count === 1 ? singular : plural;
        }

        function getMonthlyActionMessage(metrics) {
            if (!metrics.totalActivities) {
                return 'Crea una tarea pequeña hoy para empezar a detectar tu ritmo mensual.';
            }

            if (metrics.notCompletedActivities > metrics.completedActivities) {
                return 'Revisa tus pendientes y elige una prioridad clara antes de crear más tareas.';
            }

            if (metrics.habitCompletionBase > 0 && metrics.habitsPercent < 50) {
                return 'Tus hábitos necesitan una meta más ligera; reduce el tamaño y protege la constancia.';
            }

            if (metrics.completedPercent >= 80) {
                return 'Vas muy bien; mantén el mismo ritmo y reserva espacio para una tarea importante.';
            }

            return 'Cierra una actividad pendiente hoy para mejorar el cierre del mes.';
        }

        function getMonthlyAnalytics(monthOffset) {
            const range = getMonthRange(monthOffset);
            const monthStats = getCurrentMonthStats(monthOffset);
            const lifecycle = getLifecycleAnalyticsForRange(range.startKey, range.endKey);
            const dailyEntries = getDailyStatsForRange(range.start, range.end);
            const monthRecords = lifecycle.records;
            const habitRecords = monthRecords.filter(record => record.habit);
            const completedHabitRecords = lifecycle.completedRecords.filter(record => record.habit);
            const taskRecords = monthRecords.filter(record => !record.habit);
            const completedTaskRecords = lifecycle.completedRecords.filter(record => !record.habit);
            const activitiesRegistered = Math.max(lifecycle.eligible, monthStats.total);
            const completedActivities = lifecycle.completed;
            const notCompletedActivities = Math.max(activitiesRegistered - completedActivities, 0);
            const habitsCompletedTotal = sumDailyStats(dailyEntries, 'habitsCompleted');
            const habitCompletedDays = dailyEntries.filter(entry => (Number(entry.habitsCompleted) || 0) > 0).length;
            const habitCompletionBase = habitRecords.length > 0 ? habitRecords.length : dailyEntries.length;
            const habitCompletionCount = habitRecords.length > 0 ? completedHabitRecords.length : habitCompletedDays;
            const habitsPercent = getPercent(habitCompletionCount, habitCompletionBase);
            const completedPercent = getPercent(completedActivities, activitiesRegistered);
            const notCompletedPercent = activitiesRegistered > 0 ? 100 - completedPercent : 0;
            const tasksCreated = lifecycle.createdRecords.filter(record => !record.habit).length;
            const habitsCreated = lifecycle.createdRecords.filter(record => record.habit).length;
            const summaryTone = completedPercent >= 80 ? 'excelente' : completedPercent >= 55 ? 'estable' : 'mejorable';
            const actionMessage = getMonthlyActionMessage({
                totalActivities: activitiesRegistered,
                completedActivities,
                notCompletedActivities,
                completedPercent,
                habitsPercent,
                habitCompletionBase
            });
            const summary = activitiesRegistered === 0
                ? 'Durante ' + range.label + ' todavía no hay actividades registradas para detectar un patrón mensual.'
                : 'Durante ' + range.label + ' creaste ' + tasksCreated + ' ' + getPluralLabel(tasksCreated, 'tarea', 'tareas') + ' y registraste ' + activitiesRegistered + ' ' + getPluralLabel(activitiesRegistered, 'actividad', 'actividades') + '. Completaste el ' + habitsPercent + '% de tus hábitos día a día y el ' + completedPercent + '% de tus actividades; el ' + notCompletedPercent + '% quedó pendiente. Tu desempeño mensual se ve ' + summaryTone + '. ' + actionMessage;

            return {
                ...range,
                tasksCreated,
                habitsCreated,
                totalActivities: activitiesRegistered,
                completedActivities,
                notCompletedActivities,
                habitsPercent,
                completedPercent,
                notCompletedPercent,
                habitsCompletedTotal,
                habitCompletedDays,
                habitCompletionBase,
                habitDayEntries: dailyEntries.map(entry => ({
                    dateKey: entry.dateKey,
                    completed: Number(entry.habitsCompleted) || 0
                })),
                taskCount: taskRecords.length,
                habitCount: habitRecords.length,
                completedTaskCount: completedTaskRecords.length,
                completedHabitCount: completedHabitRecords.length,
                activeDays: monthStats.activeDays,
                bestDay: monthStats.bestDay,
                goalDays: monthStats.goalDays,
                summaryTone,
                actionMessage,
                summary,
                motivation: 'No dejes de hacer tus actividades; cada pequeño avance te acerca a ser mejor cada día.'
            };
        }

        function getMonthlyAnalyticsHistory(months) {
            const totalMonths = Math.max(Math.round(Number(months) || 3), 1);
            const history = [];

            for (let index = 0; index < totalMonths; index += 1) {
                history.push(getMonthlyAnalytics(index));
            }

            return history;
        }

        function getDailyStatEntries(days, offsetDays) {
            const entries = [];
            const endDate = addDays(getStartOfDay(new Date()), -Math.max(Number(offsetDays) || 0, 0));

            for (let index = days - 1; index >= 0; index -= 1) {
                const date = addDays(endDate, -index);
                const dateKey = formatDateKey(date);

                entries.push({
                    date,
                    dateKey,
                    ...getDailyStat(dateKey)
                });
            }

            return entries;
        }

        function sumDailyStats(entries, key) {
            return entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);
        }

        function getCompletionHoursForTodos(todoItems) {
            return todoItems
                .filter(todo => todo.completed && todo.createdAt && todo.completedAt)
                .map(todo => getHoursBetween(todo.createdAt, todo.completedAt))
                .filter(hours => hours > 0);
        }

        function formatHourLabel(hour) {
            const safeHour = Math.min(Math.max(Math.round(Number(hour) || 0), 0), 23);
            return String(safeHour).padStart(2, '0') + ':00';
        }

        function getBestCompletionWindow(days) {
            const startKey = formatDateKey(addDays(getStartOfDay(new Date()), -(Math.max(Number(days) || 30, 1) - 1)));
            const hourCounts = {};

            getTodos().forEach(todo => {
                if (!todo.completed || !todo.completedAt || getDateKeyFromTimestamp(todo.completedAt) < startKey) {
                    return;
                }

                const hour = getHourFromTimestamp(todo.completedAt);
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            });

            const bestHour = Object.keys(hourCounts).sort((first, second) => {
                return hourCounts[second] - hourCounts[first];
            })[0];

            if (typeof bestHour === 'undefined') {
                return {
                    label: 'Sin patrón',
                    count: 0,
                    detail: 'Completa más tareas para detectar tu hora fuerte.'
                };
            }

            return {
                label: formatHourLabel(bestHour),
                count: hourCounts[bestHour],
                detail: hourCounts[bestHour] + ' completada' + (hourCounts[bestHour] === 1 ? '' : 's') + ' en esa franja.'
            };
        }

        function getWeekdayName(dateKey) {
            const date = new Date(dateKey + 'T00:00:00');
            const label = date.toLocaleDateString('es-MX', { weekday: 'long' });

            return label.charAt(0).toUpperCase() + label.slice(1);
        }

        function getBestRhythmInsight(weekStats, clarity) {
            if (weekStats.bestDay.count > 0) {
                return {
                    label: getWeekdayName(weekStats.bestDay.dateKey),
                    message: 'Completas más tareas los ' + getWeekdayName(weekStats.bestDay.dateKey).toLowerCase() + '. Aprovecha ese ritmo para tu tarea importante.',
                    metric: weekStats.bestDay.count + ' completada' + (weekStats.bestDay.count === 1 ? '' : 's')
                };
            }

            if (clarity.bestWindow.count > 0) {
                return {
                    label: clarity.bestWindow.label,
                    message: 'Tu mejor hora es ' + clarity.bestWindow.label + '. Reserva ese bloque para una tarea clave.',
                    metric: clarity.bestWindow.count + ' completada' + (clarity.bestWindow.count === 1 ? '' : 's')
                };
            }

            return {
                label: 'Ritmo inicial',
                message: 'Completa tareas en distintos días para descubrir cuándo avanzas mejor.',
                metric: 'Tu ritmo de avance'
            };
        }

        function getFlowRhythmInsight(flow, fallbackRhythm) {
            if (flow.bestDay && flow.bestDay.completed > 0) {
                const isWeekly = flow.period === 'weekly';
                const label = isWeekly
                    ? getWeekdayName(flow.bestDay.dateKey)
                    : getDateLabel(flow.bestDay.dateKey, { day: 'numeric', month: 'short' });

                return {
                    label,
                    message: 'Tu mejor punto del periodo fue ' + label.toLowerCase() + '. Úsalo como referencia para repetir el patrón.',
                    metric: flow.bestDay.completed + ' completada' + (flow.bestDay.completed === 1 ? '' : 's')
                };
            }

            return fallbackRhythm;
        }

        function getMinimalAnalyticsAdvice(clarity, weekStats) {
            const rhythm = getBestRhythmInsight(weekStats, clarity);

            if (!clarity.weekly.hasFlow) {
                return {
                    title: 'Genera la primera señal',
                    message: 'Completa una tarea hoy. Con pocos días activos la analítica empieza a ser útil.',
                    metric: 'Primer dato: 1 tarea'
                };
            }

            if (clarity.weekly.created > clarity.weekly.completed && clarity.weekly.completionRate < 60) {
                return {
                    title: 'Cierra antes de crear',
                    message: 'Esta semana entraron más tareas de las que cerraste. Termina una pendiente antes de agregar otra.',
                    metric: clarity.weekly.completionRate + '% finalización'
                };
            }

            if (weekStats.bestDay.count > 0 || clarity.bestWindow.count > 0) {
                return {
                    title: 'Aprovecha tu mejor ritmo',
                    message: rhythm.message,
                    metric: rhythm.metric
                };
            }

            return {
                title: 'Mantén una señal simple',
                message: 'Un avance pequeño diario vale más que una lista llena de métricas.',
                metric: formatMetricNumber(weekStats.averageDaily) + ' por día'
            };
        }

        function getPeriodComparison(current, previous) {
            if (!current || current.eligible === 0) {
                return {
                    delta: 0,
                    tone: 'neutral',
                    label: 'Aún no hay tareas comparables'
                };
            }

            if (!previous || previous.eligible === 0) {
                return {
                    delta: 0,
                    tone: 'neutral',
                    label: 'Sin periodo anterior comparable'
                };
            }

            const delta = current.completionRate - previous.completionRate;

            if (delta === 0) {
                return {
                    delta,
                    tone: 'neutral',
                    label: 'Sin cambios frente al periodo anterior'
                };
            }

            return {
                delta,
                tone: delta > 0 ? 'positive' : 'negative',
                label: (delta > 0 ? '+' : '') + delta + ' puntos frente al periodo anterior'
            };
        }

        function getReliableRhythm(flow) {
            const hasEnoughData = flow && flow.completed >= 3 && flow.activeDays >= 2 && flow.bestDay && flow.bestDay.completed > 0;

            if (!hasEnoughData) {
                return {
                    available: false,
                    label: 'Sin patrón',
                    detail: 'Se necesitan al menos 3 tareas en 2 días'
                };
            }

            const label = flow.period === 'weekly'
                ? getWeekdayName(flow.bestDay.dateKey)
                : getDateLabel(flow.bestDay.dateKey, { day: 'numeric', month: 'short' });

            return {
                available: true,
                label,
                detail: flow.bestDay.completed + ' completada' + (flow.bestDay.completed === 1 ? '' : 's') + ' ese día'
            };
        }

        function getPerformanceAdvice(flow, previous) {
            const comparison = getPeriodComparison(flow, previous);
            const rhythm = getReliableRhythm(flow);
            const backlog = getBacklogAnalytics();

            if (!flow || flow.eligible === 0) {
                return {
                    title: 'Genera la primera señal',
                    message: 'Completa una tarea para empezar a reconocer tu ritmo real.'
                };
            }

            if (backlog.oldPending > 0 && flow.completionRate < 70) {
                return {
                    title: 'Recupera una tarea antigua',
                    message: backlog.oldPending === 1
                        ? 'Tienes una pendiente de 7 días o más. Resolverla reducirá la carga acumulada.'
                        : 'Tienes ' + backlog.oldPending + ' pendientes de 7 días o más. Empieza por la más pequeña.'
                };
            }

            if (flow.created > flow.completed && flow.completionRate < 60) {
                return {
                    title: 'Cierra antes de crear',
                    message: 'Entraron ' + flow.created + ' tareas y cerraste ' + flow.completed + '. Termina una pendiente antes de ampliar la lista.'
                };
            }

            if (comparison.tone === 'negative' && comparison.delta <= -10) {
                return {
                    title: 'Recupera el ritmo con una tarea',
                    message: 'Tu finalización bajó ' + Math.abs(comparison.delta) + ' puntos. Una tarea corta hoy puede cambiar la tendencia.'
                };
            }

            if (rhythm.available) {
                return {
                    title: 'Repite tu mejor ritmo',
                    message: rhythm.label + ' fue tu mejor momento del periodo. Reserva ahí la tarea más importante.'
                };
            }

            if (flow.completionRate >= 80) {
                return {
                    title: 'Protege este ritmo',
                    message: 'Estás cerrando la mayor parte de lo que planeas. Mantén una carga parecida en el siguiente periodo.'
                };
            }

            return {
                title: 'Suma una tarea más',
                message: 'Un cierre adicional mejorará el balance sin aumentar la carga de tu lista.'
            };
        }

        function getBacklogAnalytics() {
            const pendingTodos = getTodos().filter(todo => !todo.completed);
            const oldPendingTodos = pendingTodos.filter(todo => getDaysSince(todo.createdAt) >= 7);
            const urgentPendingTodos = pendingTodos.filter(todo => todo.priority === 'urgent');
            const averageAge = pendingTodos.length > 0
                ? pendingTodos.reduce((total, todo) => total + getDaysSince(todo.createdAt), 0) / pendingTodos.length
                : 0;
            let level = 'steady';
            let label = 'Estable';
            let title = 'Pendientes controladas';
            let message = 'Tu lista no muestra señales fuertes de acumulación.';

            if (pendingTodos.length === 0) {
                level = 'clear';
                label = 'Limpio';
                title = 'Sin pendientes abiertas';
                message = 'Excelente: puedes planear el siguiente avance sin arrastre.';
            } else if (oldPendingTodos.length >= 3 || urgentPendingTodos.length >= 2) {
                level = 'risk';
                label = 'Atención';
                title = 'Backlog envejecido';
                message = oldPendingTodos.length + ' pendiente' + (oldPendingTodos.length === 1 ? '' : 's') + ' lleva' + (oldPendingTodos.length === 1 ? '' : 'n') + ' 7 días o más.';
            } else if (pendingTodos.length >= 8 || averageAge >= 4) {
                level = 'watch';
                label = 'Vigilar';
                title = 'Carga creciendo';
                message = 'La edad promedio de pendientes es ' + formatMetricNumber(averageAge) + ' días.';
            }

            return {
                level,
                label,
                title,
                message,
                pending: pendingTodos.length,
                oldPending: oldPendingTodos.length,
                urgentPending: urgentPendingTodos.length,
                averageAge
            };
        }

        function getWeeklyLifecycleAnalytics() {
            const range = getCurrentWeekRange();
            const entries = [];
            let cursor = range.start;

            while (cursor <= range.end) {
                const dateKey = formatDateKey(cursor);
                entries.push({
                    date: cursor,
                    dateKey,
                    ...getDailyStat(dateKey)
                });
                cursor = addDays(cursor, 1);
            }

            const lifecycle = getLifecycleAnalyticsForRange(range.startKey, range.endKey);
            const created = lifecycle.created;
            const completed = lifecycle.completed;
            const deleted = lifecycle.deleted;
            const reactivated = lifecycle.reactivated;
            const completionRate = lifecycle.completionRate;
            const balance = completed - created;
            const hasFlow = lifecycle.eligible > 0 || completed > 0 || reactivated > 0;
            const status = !hasFlow ? 'empty' : balance >= 0 ? 'healthy' : balance >= -2 ? 'steady' : 'overload';

            return {
                range,
                entries,
                eligible: lifecycle.eligible,
                notCompleted: lifecycle.notCompleted,
                created,
                completed,
                deleted,
                reactivated,
                hasFlow,
                completionRate,
                balance,
                status
            };
        }

        function getMonthlyFunnelAnalytics(monthAnalytics) {
            const entries = getDailyStatEntries(31, 0).filter(entry => {
                return isDateKeyInRange(entry.dateKey, monthAnalytics.startKey, monthAnalytics.endKey);
            });
            const created = sumDailyStats(entries, 'created');
            const completed = monthAnalytics.completedActivities;
            const reactivated = sumDailyStats(entries, 'reactivated');
            const deleted = sumDailyStats(entries, 'deleted');
            const activePending = getTodos().filter(todo => {
                return !todo.completed && isDateKeyInRange(getDateKeyFromTimestamp(todo.createdAt), monthAnalytics.startKey, monthAnalytics.endKey);
            }).length;

            return {
                created,
                activePending,
                completed,
                reactivated,
                deleted,
                steps: [
                    { label: 'Creadas', value: created, tone: 'created' },
                    { label: 'Pendientes', value: activePending, tone: 'pending' },
                    { label: 'Completadas', value: completed, tone: 'completed' },
                    { label: 'Reactivadas', value: reactivated, tone: 'reactivated' },
                    { label: 'Eliminadas', value: deleted, tone: 'deleted' }
                ]
            };
        }

        function getClarityAnalytics() {
            const weekly = getWeeklyLifecycleAnalytics();
            const backlog = getBacklogAnalytics();
            const weekStats = getPeriodStats(7, 0);
            const completionHours = getCompletionHoursForTodos(getTodos());
            const averageCompletionHours = completionHours.length > 0
                ? completionHours.reduce((total, hours) => total + hours, 0) / completionHours.length
                : 0;
            const bestWindow = getBestCompletionWindow(30);
            if (!weekly.hasFlow && backlog.pending === 0) {
                return {
                    score: 0,
                    tone: 'empty',
                    title: 'Sin lectura todavía',
                    weekly,
                    backlog,
                    averageCompletionHours,
                    averageCompletionLabel: formatDurationHours(averageCompletionHours),
                    bestWindow
                };
            }

            const rawScore = 72
                + (weekly.completionRate >= 70 ? 10 : weekly.completionRate >= 45 ? 2 : -10)
                + Math.min(weekStats.goalDays * 2, 10)
                - Math.min(backlog.oldPending * 8, 24)
                - Math.min(Math.max(-weekly.balance, 0) * 4, 18)
                - Math.min(weekly.reactivated * 3, 12);
            const score = Math.min(Math.max(Math.round(rawScore), 0), 100);
            const tone = score >= 80 ? 'strong' : score >= 60 ? 'steady' : score >= 40 ? 'watch' : 'risk';
            const title = score >= 80
                ? 'Sistema claro'
                : score >= 60
                    ? 'Sistema estable'
                    : score >= 40
                        ? 'Sistema cargado'
                        : 'Sistema en riesgo';

            return {
                score,
                tone,
                title,
                weekly,
                backlog,
                averageCompletionHours,
                averageCompletionLabel: formatDurationHours(averageCompletionHours),
                bestWindow
            };
        }

        function getConsistencyAnalytics(days) {
            const entries = getDailyStatEntries(days, 0);
            const activeDays = entries.filter(entry => entry.completed > 0).length;
            const goalDays = entries.filter(entry => entry.completed >= getDailyGoal()).length;

            return {
                entries,
                activeDays,
                goalDays,
                activePercent: getPercent(activeDays, entries.length),
                goalPercent: getPercent(goalDays, entries.length)
            };
        }

        function getWeeklyActivities() {
            const range = getCurrentWeekRange();
            const todayKey = getTodayKey();
            const tomorrowKey = getTomorrowKey();

            return getTodos()
                .map(todo => {
                    const scheduleDate = getTodoScheduleDateKey(todo);
                    const deadlineState = getTodoDeadlineState(todo);
                    let status = 'pending';
                    let statusLabel = deadlineState ? deadlineState.label : 'Pendiente';

                    if (todo.completed) {
                        status = 'completed';
                        statusLabel = 'Completada';
                    } else if (deadlineState && deadlineState.level === 'late') {
                        status = 'overdue';
                        statusLabel = 'Vencida';
                    } else if (deadlineState && deadlineState.level === 'soon') {
                        status = 'due-soon';
                        statusLabel = 'Por vencer';
                    } else if (scheduleDate < todayKey) {
                        status = 'overdue';
                        statusLabel = 'Vencida';
                    } else if (scheduleDate > todayKey) {
                        status = scheduleDate <= tomorrowKey ? 'due-soon' : 'upcoming';
                        statusLabel = scheduleDate <= tomorrowKey ? 'Por vencer' : 'Programada';
                    }

                    return {
                        id: todo.id,
                        text: todo.text,
                        priority: todo.priority,
                        priorityLabel: getPriorityLabel(todo.priority),
                        habit: todo.habit,
                        scheduleDate,
                        status,
                        statusLabel
                    };
                })
                .filter(activity => {
                    return isDateKeyInRange(activity.scheduleDate, range.startKey, range.endKey)
                        || activity.status === 'overdue';
                })
                .sort((first, second) => {
                    const statusRank = { overdue: 0, pending: 1, 'due-soon': 2, upcoming: 3, completed: 4 };
                    const statusDifference = statusRank[first.status] - statusRank[second.status];

                    if (statusDifference !== 0) {
                        return statusDifference;
                    }

                    if (first.scheduleDate !== second.scheduleDate) {
                        return first.scheduleDate.localeCompare(second.scheduleDate);
                    }

                    return getPriorityRank(second.priority) - getPriorityRank(first.priority);
                });
        }

        function getRecentHistoryCounts(days) {
            const counts = [];
            const today = getStartOfDay(new Date());

            for (let index = days - 1; index >= 0; index -= 1) {
                counts.push(getHistoryCount(formatDateKey(addDays(today, -index))));
            }

            return counts;
        }

        function getAdaptiveGoalRecommendation() {
            const recentStats = getPeriodStats(7, 0);
            const previousStats = getPeriodStats(7, 7);
            const recentCounts = getRecentHistoryCounts(14);
            const activeCounts = recentCounts.filter(count => count > 0).sort((first, second) => first - second);
            const currentGoal = Math.min(Math.max(Math.round(Number(getDailyGoal()) || defaults.dailyGoal || 3), 1), 20);

            if (activeCounts.length === 0) {
                return {
                    goal: 1,
                    tone: 'start',
                    message: 'Meta sugerida: 1 para empezar sin fricción'
                };
            }

            const average = activeCounts.reduce((total, count) => total + count, 0) / activeCounts.length;
            const median = activeCounts[Math.floor((activeCounts.length - 1) / 2)];
            let goal = Math.min(Math.max(Math.round(median || average), 1), 20);
            let tone = 'steady';
            let message = 'Tu meta actual se ve bien';

            if (recentStats.goalDays >= 5 && average >= currentGoal + 0.7 && currentGoal < 20) {
                goal = currentGoal + 1;
                tone = 'challenge';
                message = 'Meta sugerida: ' + goal + ' porque esta semana vienes fuerte';
            } else if (recentStats.goalDays <= 2 && currentGoal > 1 && average < currentGoal) {
                goal = Math.max(1, Math.min(currentGoal - 1, Math.round(Math.max(average, 1))));
                tone = 'protect';
                message = 'Meta sugerida: ' + goal + ' para proteger constancia';
            } else if (previousStats.total > 0 && recentStats.total >= previousStats.total + currentGoal && currentGoal < 20) {
                goal = currentGoal + 1;
                tone = 'challenge';
                message = 'Meta sugerida: ' + goal + ' por mejora semanal clara';
            } else if (goal !== currentGoal) {
                tone = goal > currentGoal ? 'challenge' : 'protect';
                message = 'Meta sugerida: ' + goal + ' según tu ritmo reciente';
            }

            return {
                goal: Math.min(Math.max(goal, 1), 20),
                tone,
                message
            };
        }

        function getRecommendedDailyGoal() {
            return getAdaptiveGoalRecommendation().goal;
        }

        function getAdaptiveFocusGoalRecommendation() {
            const currentGoal = Math.min(Math.max(Math.round(Number(getDailyFocusGoalMinutes()) || 50), 15), 240);
            const today = getStartOfDay(new Date());
            const range = getSustainableRangeSummary(
                formatDateKey(addDays(today, -13)),
                formatDateKey(today)
            );
            const activeMinutes = (Array.isArray(range.days) ? range.days : [])
                .map(day => Math.floor((Number(day.rewardedFocusMs) || 0) / 60000))
                .filter(minutes => minutes >= 15)
                .sort((first, second) => first - second);

            if (!activeMinutes.length) {
                return {
                    goal: 25,
                    tone: 'start',
                    message: 'Sugerencia: 25 min para crear tu primer bloque'
                };
            }

            const median = activeMinutes[Math.floor((activeMinutes.length - 1) / 2)];
            const goal = Math.min(Math.max(Math.round(median / 5) * 5, 15), 240);

            return {
                goal,
                tone: goal > currentGoal ? 'challenge' : goal < currentGoal ? 'protect' : 'steady',
                message: goal === currentGoal
                    ? 'Tu meta de ' + goal + ' min se ajusta a tu ritmo'
                    : 'Sugerencia: ' + goal + ' min según tus días activos'
            };
        }

        function getProgressGoalRecommendation() {
            const mode = getProgressMode();
            const taskRecommendation = getAdaptiveGoalRecommendation();
            const focusRecommendation = getAdaptiveFocusGoalRecommendation();

            if (mode === 'focus') {
                return {
                    mode,
                    taskGoal: getDailyGoal(),
                    focusGoal: focusRecommendation.goal,
                    message: focusRecommendation.message
                };
            }

            if (mode === 'balanced') {
                return {
                    mode,
                    taskGoal: taskRecommendation.goal,
                    focusGoal: focusRecommendation.goal,
                    message: 'Sugerencia: ' + taskRecommendation.goal + ' tareas + ' + focusRecommendation.goal + ' min'
                };
            }

            return {
                mode: 'tasks',
                taskGoal: taskRecommendation.goal,
                focusGoal: getDailyFocusGoalMinutes(),
                message: taskRecommendation.message.replace('Meta sugerida:', 'Sugerencia:')
            };
        }

        function getProductivityProfile() {
            const weekStats = getPeriodStats(7, 0);
            const rescueState = getRescueState();
            const currentStreak = getCurrentStreak();
            const totalCompleted = getTotalCompletedTasks();

            if (totalCompleted === 0) {
                return {
                    label: 'Explorador',
                    className: 'profile-explorer',
                    message: 'Aún estás creando tu primera señal de datos.'
                };
            }

            if (currentStreak >= 7) {
                return {
                    label: 'Rachero',
                    className: 'profile-streak',
                    message: 'Tu mayor ventaja es volver todos los días.'
                };
            }

            if (weekStats.goalDays >= 5) {
                return {
                    label: 'Constante',
                    className: 'profile-steady',
                    message: 'Estás convirtiendo la meta diaria en rutina.'
                };
            }

            if (weekStats.bestDay.count >= Math.max(getDailyGoal() + 2, 4) && weekStats.activeDays <= 3) {
                return {
                    label: 'Explosivo',
                    className: 'profile-burst',
                    message: 'Tienes picos fuertes; ahora conviene repartir energía.'
                };
            }

            if (weekStats.averageActive > getDailyGoal()) {
                return {
                    label: 'Ambicioso',
                    className: 'profile-ambitious',
                    message: 'Cuando entras en ritmo, sueles superar la meta.'
                };
            }

            if (rescueState.waitingForToday || rescueState.eligible) {
                return {
                    label: 'Reconstructor',
                    className: 'profile-rebuilder',
                    message: 'Tu sistema está listo para ayudarte a volver.'
                };
            }

            return {
                label: 'Ritmo en marcha',
                className: 'profile-building',
                message: 'Ya hay señales suficientes para empezar a afinar tu avance.'
            };
        }

        function getStreakRiskInsight() {
            const todayCount = getHistoryCount(getTodayKey());
            const remainingGoal = Math.max(getDailyGoal() - todayCount, 0);
            const previousStreak = getStreakBeforeToday();
            const rescueState = getRescueState();
            const availableTasks = getTodos().filter(isTodoAvailableToday).length;
            const currentHour = new Date().getHours();

            if (todayCount >= getDailyGoal()) {
                return {
                    level: 'done',
                    label: 'Racha blindada',
                    title: 'Meta diaria segura',
                    message: 'Hoy ya cumpliste. Si haces una extra, alimentas el modo legendario.'
                };
            }

            if (rescueState.eligible) {
                return {
                    level: 'medium',
                    label: 'Rescate disponible',
                    title: 'Puedes salvar la racha',
                    message: 'Hoy volviste. Usa un escudo si quieres unir el hueco de ayer.'
                };
            }

            if (todayCount > 0) {
                return {
                    level: remainingGoal <= 1 ? 'low' : 'medium',
                    label: remainingGoal <= 1 ? 'Casi lista' : 'En progreso',
                    title: 'La racha ya cuenta hoy',
                    message: remainingGoal <= 1
                        ? 'Falta 1 tarea para cerrar la meta diaria.'
                        : 'Faltan ' + remainingGoal + ' tareas para completar la meta.'
                };
            }

            if (previousStreak === 0) {
                return {
                    level: currentHour >= 20 ? 'medium' : 'low',
                    label: 'Inicio abierto',
                    title: 'Hoy puede empezar una racha',
                    message: 'Completa una tarea pequeña y crea la primera señal del día.'
                };
            }

            if (availableTasks === 0) {
                return {
                    level: 'high',
                    label: 'Sin tarea lista',
                    title: 'Racha en riesgo',
                    message: 'Crea una microtarea o prepara una pendiente para no perder el regreso de hoy.'
                };
            }

            if (currentHour >= 20) {
                return {
                    level: 'high',
                    label: 'Riesgo alto',
                    title: 'Última llamada para la racha',
                    message: 'Te falta completar una tarea hoy. Elige la más pequeña y protégela.'
                };
            }

            if (currentHour >= 16) {
                return {
                    level: 'medium',
                    label: 'Riesgo medio',
                    title: 'Conviene activar el día',
                    message: 'Tu racha anterior espera una tarea. Todavía estás a tiempo de protegerla.'
                };
            }

            return {
                level: 'low',
                label: 'Riesgo bajo',
                title: 'Buen momento para avanzar',
                message: 'Completa una tarea temprano y el resto del día se siente más ligero.'
            };
        }

        function getDominantCompletedPriority() {
            const counts = {
                urgent: getCompletedPriorityCount('urgent'),
                important: getCompletedPriorityCount('important'),
                normal: getCompletedPriorityCount('normal')
            };
            const dominant = Object.keys(counts).sort((first, second) => counts[second] - counts[first])[0];

            return counts[dominant] > 0 ? {
                priority: dominant,
                count: counts[dominant],
                label: getPriorityLabel(dominant)
            } : null;
        }

        function getAnalyticsNextAction() {
            const topTodo = getTopPriorityTodo();
            const todayCount = getHistoryCount(getTodayKey());
            const remainingGoal = Math.max(getDailyGoal() - todayCount, 0);
            const risk = getStreakRiskInsight();

            if (topTodo) {
                const taskPreview = topTodo.text.length > 48 ? topTodo.text.slice(0, 45) + '...' : topTodo.text;

                return {
                    title: risk.level === 'high' ? 'Salva la racha con esta tarea' : 'Siguiente avance recomendado',
                    message: taskPreview + ' · ' + getNextActionReason(topTodo),
                    metric: todayCount + '/' + getDailyGoal() + ' hoy · ' + getPriorityLabel(topTodo.priority)
                };
            }

            if (todayCount >= getDailyGoal()) {
                return {
                    title: 'Cierra con claridad',
                    message: 'Tu meta está completa. Mantén la lista simple y conserva solo lo que aporta.',
                    metric: 'Meta cumplida'
                };
            }

            return {
                title: 'Crea una microtarea',
                message: 'No hay pendientes listas. Una acción pequeña basta para generar datos y sostener la racha.',
                metric: remainingGoal + ' por completar'
            };
        }

        function getAnalyticsInsights() {
            const weekStats = getPeriodStats(7, 0);
            const previousStats = getPeriodStats(7, 7);
            const goalRecommendation = getAdaptiveGoalRecommendation();
            const profile = getProductivityProfile();
            const dominantPriority = getDominantCompletedPriority();
            const insights = [];

            if (weekStats.total === 0) {
                return [
                    {
                        title: 'Primera señal',
                        message: 'Completa una tarea hoy para que la app empiece a detectar tu ritmo.',
                        className: 'insight-start'
                    },
                    {
                        title: 'Meta ligera',
                        message: 'Una meta inicial baja ayuda a crear racha antes de subir dificultad.',
                        className: 'insight-goal'
                    },
                    {
                        title: 'Dato clave',
                        message: 'La constancia se mide mejor por días activos que por grandes picos aislados.',
                        className: 'insight-data'
                    }
                ];
            }

            if (previousStats.total > 0) {
                const delta = weekStats.total - previousStats.total;

                insights.push({
                    title: delta >= 0 ? 'Tendencia positiva' : 'Ajuste de ritmo',
                    message: delta >= 0
                        ? 'Esta semana llevas +' + delta + ' tareas frente a los 7 días anteriores.'
                        : 'Esta semana vas ' + Math.abs(delta) + ' tareas abajo; una meta realista puede recuperar continuidad.',
                    className: delta >= 0 ? 'insight-up' : 'insight-protect'
                });
            }

            if (weekStats.bestDay.count > 0) {
                insights.push({
                    title: 'Mejor día reciente',
                    message: getDateLabel(weekStats.bestDay.dateKey) + ' fue tu pico con ' + weekStats.bestDay.count + ' completada' + (weekStats.bestDay.count === 1 ? '' : 's') + '.',
                    className: 'insight-best'
                });
            }

            insights.push({
                title: profile.label,
                message: profile.message,
                className: 'insight-profile'
            });

            if (goalRecommendation.goal !== getDailyGoal()) {
                insights.push({
                    title: 'Meta adaptativa',
                    message: goalRecommendation.message + '.',
                    className: goalRecommendation.tone === 'challenge' ? 'insight-challenge' : 'insight-goal'
                });
            }

            if (dominantPriority) {
                insights.push({
                    title: 'Patrón de tareas',
                    message: 'Tu prioridad más completada es ' + dominantPriority.label.toLowerCase() + ' con ' + dominantPriority.count + ' registros.',
                    className: 'insight-data'
                });
            }

            return insights.slice(0, 4);
        }

        function getMonthlyRecap() {
            const monthStats = getCurrentMonthStats(0);
            const previousMonthStats = getCurrentMonthStats(1);
            const delta = monthStats.total - previousMonthStats.total;
            const monthName = new Date().toLocaleDateString('es-MX', { month: 'long' });

            if (monthStats.total === 0) {
                return {
                    title: 'Mes con poca señal',
                    summary: 'Aún no hay tareas completadas este mes. Una victoria hoy abre el recap.',
                    stats: [
                        { label: 'Completadas', value: '0' },
                        { label: 'Días activos', value: '0' },
                        { label: 'Meta cumplida', value: '0' }
                    ]
                };
            }

            return {
                title: monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' con ' + monthStats.total + ' completada' + (monthStats.total === 1 ? '' : 's'),
                summary: delta >= 0
                    ? 'Vas +' + delta + ' frente al mes anterior. Tu mejor día fue ' + getDateLabel(monthStats.bestDay.dateKey) + '.'
                    : 'Vas ' + Math.abs(delta) + ' por debajo del mes anterior; todavía puedes cerrar con una racha fuerte.',
                stats: [
                    { label: 'Días activos', value: String(monthStats.activeDays) },
                    { label: 'Metas cumplidas', value: String(monthStats.goalDays) },
                    { label: 'Mejor día', value: String(monthStats.bestDay.count) }
                ]
            };
        }

        function getAnalyticsSnapshot() {
            const monthAnalytics = getMonthlyAnalytics(0);
            const clarity = getClarityAnalytics();

            return {
                semana: getPeriodStats(7, 0),
                semanaAnterior: getPeriodStats(7, 7),
                actividadesSemana: getWeeklyActivities(),
                analisisMensual: monthAnalytics,
                historialMensual: getMonthlyAnalyticsHistory(4),
                claridad: clarity,
                flujoSemanal: clarity.weekly,
                saludPendientes: clarity.backlog,
                embudo: getMonthlyFunnelAnalytics(monthAnalytics),
                consistencia: getConsistencyAnalytics(30),
                enfoque: {
                    modo: getProgressMode(),
                    semanal: getFocusPeriodAnalytics('weekly'),
                    mensual: getFocusPeriodAnalytics('monthly'),
                    trimestral: getFocusPeriodAnalytics('quarterly')
                },
                metaSugerida: getProgressGoalRecommendation(),
                riesgoRacha: getStreakRiskInsight(),
                perfil: getProductivityProfile(),
                accion: getAnalyticsNextAction(),
                insights: getAnalyticsInsights(),
                recapMensual: getMonthlyRecap()
            };
        }

        function updateDailyGoal(value, shouldNotify) {
            const parsedGoal = Number(value);

            if (!Number.isFinite(parsedGoal) || value === '') {
                return;
            }

            const nextGoal = Math.min(Math.max(Math.round(parsedGoal), 1), 20);
            const previousGoal = getDailyGoal();

            setDailyGoal(nextGoal);
            if (dom.dailyGoalInput && documentRef.activeElement !== dom.dailyGoalInput) {
                dom.dailyGoalInput.value = nextGoal;
            }
            saveDailyGoal();
            if (previousGoal !== nextGoal) {
                logAnalyticsEvent('goal_changed', {
                    previousGoal,
                    nextGoal
                });
            }
            if (shouldNotify) {
                showToast('Meta diaria actualizada a ' + nextGoal + '.', 'info');
            }

            if (dom.todoForm) {
                renderProgressDashboard();
            }
        }

        function updateFocusGoal(value, shouldNotify) {
            const parsedGoal = Number(value);

            if (!Number.isFinite(parsedGoal) || value === '') {
                return;
            }

            const nextGoal = Math.min(Math.max(Math.round(parsedGoal / 5) * 5, 15), 240);
            const previousGoal = Math.min(Math.max(Math.round(Number(getDailyFocusGoalMinutes()) || 50), 15), 240);

            setDailyFocusGoalMinutes(nextGoal);
            if (dom.dailyFocusGoalInput && documentRef.activeElement !== dom.dailyFocusGoalInput) {
                dom.dailyFocusGoalInput.value = nextGoal;
            }
            if (previousGoal !== nextGoal) {
                logAnalyticsEvent('focus_goal_changed', {
                    previousGoal,
                    nextGoal
                });
            }
            if (shouldNotify) {
                showToast('Meta de enfoque actualizada a ' + nextGoal + ' min.', 'info');
            }

            if (dom.todoForm) {
                renderProgressDashboard();
            }
        }

        function renderRecommendedGoal() {
            if (!dom.recommendedGoalText || !dom.applyRecommendedGoalButton) {
                return;
            }

            const recommendation = getProgressGoalRecommendation();
            const taskMatches = recommendation.taskGoal === getDailyGoal();
            const focusMatches = recommendation.focusGoal === getDailyFocusGoalMinutes();

            dom.recommendedGoalText.textContent = recommendation.message;
            dom.applyRecommendedGoalButton.disabled = recommendation.mode === 'tasks'
                ? taskMatches
                : recommendation.mode === 'focus'
                    ? focusMatches
                    : taskMatches && focusMatches;
            dom.applyRecommendedGoalButton.dataset.mode = recommendation.mode;
            dom.applyRecommendedGoalButton.dataset.taskGoal = recommendation.taskGoal;
            dom.applyRecommendedGoalButton.dataset.focusGoal = recommendation.focusGoal;
        }

        function createInfoTooltip(text) {
            const wrapper = documentRef.createElement('span');

            wrapper.className = 'info-tooltip';
            wrapper.tabIndex = 0;
            wrapper.dataset.tooltip = text;
            wrapper.setAttribute('aria-label', 'Información: ' + text);
            wrapper.textContent = '?';

            return wrapper;
        }

        function appendInfoTooltip(element, text) {
            if (!element || element.querySelector('.info-tooltip')) {
                return;
            }

            element.classList.add('has-info-tooltip');
            element.appendChild(createInfoTooltip(text));
        }

        function getMonthlyPerformanceFocus(monthAnalytics) {
            if (monthAnalytics.totalActivities === 0) {
                return {
                    tone: 'empty',
                    title: 'Aún no hay lectura suficiente',
                    message: 'Completa algunas tareas para que la app detecte tu ritmo real y pueda comparar avances.',
                    action: 'Primer objetivo: cierra una actividad pequeña hoy.'
                };
            }

            if (monthAnalytics.completedPercent >= 80) {
                return {
                    tone: 'strong',
                    title: 'Rendimiento fuerte',
                    message: 'La mayoría de tus actividades ya está cerrada. Mantén este ritmo y evita agregar más carga innecesaria.',
                    action: 'Siguiente paso: protege tu racha con una tarea clave.'
                };
            }

            if (monthAnalytics.notCompletedPercent >= 45) {
                return {
                    tone: 'alert',
                    title: 'Demasiado pendiente',
                    message: 'El porcentaje pendiente está alto. Conviene reagendar, eliminar lo que no aporta o atacar primero lo urgente.',
                    action: 'Siguiente paso: reduce la lista a 1 prioridad real.'
                };
            }

            if (monthAnalytics.habitCount > 0 && monthAnalytics.habitsPercent < 50) {
                return {
                    tone: 'habit',
                    title: 'Hábitos débiles',
                    message: 'Tus hábitos necesitan más consistencia. Baja el tamaño del hábito o ponlo al inicio del día.',
                    action: 'Siguiente paso: completa un hábito antes de crear tareas nuevas.'
                };
            }

            return {
                tone: 'steady',
                title: 'Ritmo estable',
                message: 'Tu mes tiene avance, pero todavía hay margen para cerrar pendientes sin subir la carga.',
                action: 'Siguiente paso: termina una actividad pendiente antes de iniciar otra.'
            };
        }

        function renderPerformanceSummary(element, monthAnalytics, compact) {
            if (!element) {
                return;
            }

            components.renderPerformanceSummary(element, {
                documentRef,
                focus: getMonthlyPerformanceFocus(monthAnalytics),
                compact
            });
        }

        function renderMonthlyCompletionDonut(container, monthAnalytics, compact) {
            if (!container) {
                return;
            }

            components.renderMonthlyCompletionDonut(container, {
                documentRef,
                monthAnalytics,
                compact
            });
        }
        function renderAnalyticsTooltips() {
            return;
        }

        function renderMonthlyMetricCards(monthAnalytics) {
            if (!dom.monthlyMetrics) {
                return;
            }

            const analytics = monthAnalytics || getMonthlyAnalytics(0);
            const cards = [
                {
                    value: analytics.tasksCreated,
                    label: 'Tareas creadas',
                    detail: analytics.habitsCreated + ' ' + getPluralLabel(analytics.habitsCreated, 'hábito creado', 'hábitos creados')
                },
                {
                    value: analytics.totalActivities,
                    label: 'Actividades registradas',
                    detail: analytics.completedActivities + ' completada' + (analytics.completedActivities === 1 ? '' : 's')
                },
                {
                    value: analytics.habitsPercent + '%',
                    label: 'Hábitos día a día',
                    detail: analytics.habitsCompletedTotal + ' completado' + (analytics.habitsCompletedTotal === 1 ? '' : 's') + ' en ' + analytics.habitCompletedDays + ' día' + (analytics.habitCompletedDays === 1 ? '' : 's')
                },
                {
                    value: analytics.completedPercent + '%',
                    label: 'Actividades completadas',
                    detail: analytics.notCompletedPercent + '% sin completar'
                }
            ];

            dom.monthlyMetrics.innerHTML = '';
            cards.forEach(card => {
                dom.monthlyMetrics.appendChild(components.createMonthlyMetricCard({
                    documentRef,
                    value: card.value,
                    label: card.label,
                    detail: card.detail
                }));
            });
        }

        function renderMonthlyRecap(monthAnalytics) {
            if (!dom.monthlyRecapTitle || !dom.monthlyRecapSummary || !dom.monthlyRecapStats) {
                return;
            }

            const analytics = monthAnalytics || getMonthlyAnalytics(0);
            const hasData = analytics.totalActivities > 0;
            const stats = hasData
                ? [
                    { value: analytics.completedPercent + '%', label: 'completado' },
                    { value: analytics.habitsPercent + '%', label: 'hábitos' },
                    { value: analytics.notCompletedPercent + '%', label: 'pendiente' }
                ]
                : [
                    { value: 0, label: 'actividades' },
                    { value: 0, label: 'hábitos' },
                    { value: 0, label: 'pendiente' }
                ];

            dom.monthlyRecapTitle.textContent = hasData ? 'Resumen de ' + analytics.label : 'Crea tu primera tarea';
            dom.monthlyRecapSummary.textContent = hasData
                ? analytics.label + ': ' + analytics.tasksCreated + ' ' + getPluralLabel(analytics.tasksCreated, 'tarea creada', 'tareas creadas') + ', ' + analytics.totalActivities + ' ' + getPluralLabel(analytics.totalActivities, 'actividad registrada', 'actividades registradas') + '. ' + analytics.actionMessage + ' Cada tarea completada te acerca a ser mejor cada día.'
                : 'Crea tu primera tarea para ver un análisis mensual claro y útil.';
            dom.monthlyRecapStats.innerHTML = '';
            stats.forEach(stat => {
                dom.monthlyRecapStats.appendChild(components.createMonthlyRecapStat({
                    documentRef,
                    value: stat.value,
                    label: stat.label
                }));
            });
        }

        function renderMonthlyAnalytics() {
            const monthAnalytics = getMonthlyAnalytics(0);

            renderMonthlyMetricCards(monthAnalytics);

            if (dom.monthlyComparison) {
                renderMonthlyCompletionDonut(dom.monthlyComparison, monthAnalytics, false);
            }

            if (dom.monthlyPerformanceSummary) {
                renderPerformanceSummary(dom.monthlyPerformanceSummary, monthAnalytics, false);
            }

            renderMonthlyRecap(monthAnalytics);

            if (dom.monthlyHistoryList) {
                dom.monthlyHistoryList.innerHTML = '';
            }
        }

        function shouldShowFlowAxisLabel(entry, index, total, period) {
            const date = new Date(entry.dateKey + 'T00:00:00');

            if (total <= 10 || index === 0 || index === total - 1) {
                return true;
            }

            if (period === 'monthly') {
                return date.getDate() % 5 === 0;
            }

            if (period === 'quarterly') {
                return date.getDate() === 1;
            }

            return index % 2 === 0;
        }

        function getFlowAxisLabel(entry, period) {
            const date = new Date(entry.dateKey + 'T00:00:00');

            if (period === 'monthly') {
                return String(date.getDate());
            }

            if (period === 'quarterly') {
                return getDateLabel(entry.dateKey, { month: 'short' }).toLocaleUpperCase('es-MX');
            }

            return getDateLabel(entry.dateKey, { weekday: 'short' }).toLocaleUpperCase('es-MX');
        }

        function renderWeeklyFlowChart(flowData, targetElement) {
            const chartElement = targetElement || dom.weeklyFlowChart;
            const flow = flowData || getFlowPeriodAnalytics('weekly');

            if (!chartElement) {
                return;
            }

            const entries = flow.entries && flow.entries.length > 0 ? flow.entries : [];
            const maxValue = Math.max(...entries.map(entry => entry.completed), getDailyGoal(), 1);
            const width = 360;
            const height = 120;
            const leftPadding = 20;
            const rightPadding = 20;
            const topPadding = 16;
            const bottomPadding = 26;
            const usableWidth = width - leftPadding - rightPadding;
            const usableHeight = height - topPadding - bottomPadding;
            const compactDots = entries.length > 45;
            const points = entries.map((entry, index) => {
                const x = leftPadding + (usableWidth / Math.max(entries.length - 1, 1)) * index;
                const y = topPadding + usableHeight - (entry.completed / maxValue) * usableHeight;

                return {
                    x,
                    y,
                    entry,
                    goalHit: entry.completed >= getDailyGoal(),
                    radius: compactDots ? (entry.completed > 0 ? 2.8 : 2.1) : (entry.completed > 0 ? 4.6 : 3.4)
                };
            });
            const axisLabels = points
                .map((point, index) => shouldShowFlowAxisLabel(point.entry, index, entries.length, flow.period)
                    ? { x: point.x, y: height - 7, label: getFlowAxisLabel(point.entry, flow.period) }
                    : null)
                .filter(Boolean);
            const goalY = topPadding + usableHeight - (Math.min(getDailyGoal(), maxValue) / maxValue) * usableHeight;
            const chart = components.createWeeklyFlowChart({
                documentRef,
                flow,
                entries,
                points,
                axisLabels,
                width,
                height,
                leftPadding,
                rightPadding,
                goalY,
                ariaLabel: 'Línea de tareas completadas en periodo ' + flow.label.toLowerCase()
            });

            chartElement.innerHTML = '';
            chartElement.className = chart.className;
            Array.from(chart.children || []).forEach(child => chartElement.appendChild(child));
        }
        function renderDataAnalyticsSurfaces(clarity, monthAnalytics, flowAnalytics) {
            renderWeeklyFlowChart(flowAnalytics || getFlowPeriodAnalytics('weekly'));
        }

        function renderFocusAnalytics(focusAnalytics) {
            if (!focusAnalytics) {
                return;
            }

            if (dom.analyticsFocusTotal) {
                dom.analyticsFocusTotal.textContent = formatFocusDuration(focusAnalytics.focusMs);
            }

            if (dom.analyticsFocusSessions) {
                dom.analyticsFocusSessions.textContent = String(focusAnalytics.sustainableSessions);
            }

            if (dom.analyticsFocusAverage) {
                dom.analyticsFocusAverage.textContent = formatFocusDuration(focusAnalytics.averageFocusMs);
            }

            if (dom.focusFlowChart && components && typeof components.createFocusFlowChart === 'function') {
                const chart = components.createFocusFlowChart({
                    documentRef,
                    entries: focusAnalytics.chartEntries,
                    goalMinutes: Math.max(Number(getDailyFocusGoalMinutes()) || 50, 15),
                    ariaLabel: 'Tiempo de enfoque confirmado en el periodo'
                });

                dom.focusFlowChart.innerHTML = '';
                dom.focusFlowChart.className = chart.className;
                Array.from(chart.children || []).forEach(child => dom.focusFlowChart.appendChild(child));
                if (chart.dataset && chart.dataset.empty) {
                    dom.focusFlowChart.dataset.empty = chart.dataset.empty;
                } else {
                    delete dom.focusFlowChart.dataset.empty;
                }
            }
        }

        function renderAnalyticsPanel() {
            if (!dom.analyticsCompletionRate || !dom.weeklyFlowChart) {
                return;
            }

            const flowAnalytics = getFlowPeriodAnalytics(getActiveFlowPeriod());
            const previousFlow = getPreviousFlowPeriodAnalytics(getActiveFlowPeriod());
            const comparison = getPeriodComparison(flowAnalytics, previousFlow);
            const rhythm = getReliableRhythm(flowAnalytics);
            let action = getPerformanceAdvice(flowAnalytics, previousFlow);
            const focusAnalytics = getFocusPeriodAnalytics(getActiveFlowPeriod());
            const progressMode = getProgressMode();
            const taskPercent = flowAnalytics.eligible > 0 ? flowAnalytics.completionRate : 0;
            const completedPercent = progressMode === 'focus'
                ? focusAnalytics.goalPercent
                : progressMode === 'balanced'
                    ? Math.round((taskPercent + focusAnalytics.goalPercent) / 2)
                    : taskPercent;
            const pendingPercent = flowAnalytics.eligible > 0 ? 100 - completedPercent : 0;

            if (progressMode === 'focus') {
                const bestFocusEntry = focusAnalytics.chartEntries.reduce((best, entry) => (
                    !best || entry.minutes > best.minutes ? entry : best
                ), null);

                action = focusAnalytics.focusMs === 0
                    ? {
                        title: 'Empieza con 15 minutos reales',
                        message: 'Abre Modo Carrera, trabaja a tu ritmo y confirma el resultado al terminar.'
                    }
                    : {
                        title: 'Protege tu ritmo de enfoque',
                        message: 'Promedias ' + formatFocusDuration(focusAnalytics.averageFocusMs)
                            + ' por día activo' + (bestFocusEntry && bestFocusEntry.minutes > 0 ? '. Tu mejor tramo fue ' + bestFocusEntry.label + '.' : '.')
                    };
            } else if (progressMode === 'balanced') {
                action = taskPercent > focusAnalytics.goalPercent + 15
                    ? {
                        title: 'Dale espacio a tus tareas',
                        message: 'Cierras avances con facilidad; reserva ahora un bloque de enfoque sin interrupciones.'
                    }
                    : focusAnalytics.goalPercent > taskPercent + 15
                        ? {
                            title: 'Convierte enfoque en un cierre',
                            message: 'El tiempo ya está. Elige una tarea concreta para terminar dentro de tu próxima Carrera.'
                        }
                        : {
                            title: 'Mantén este equilibrio',
                            message: 'Tu tiempo y tus avances crecen a un ritmo parecido. Repite una sesión sostenible.'
                        };
            }

            if (dom.analyticsPeriodButtons && typeof dom.analyticsPeriodButtons.forEach === 'function') {
                dom.analyticsPeriodButtons.forEach(button => {
                    const isActive = button.dataset.analyticsPeriod === getActiveFlowPeriod();

                    button.classList.toggle('active', isActive);
                    button.setAttribute('aria-pressed', isActive.toString());
                });
            }

            dom.analyticsCompletionRate.textContent = completedPercent + '%';

            if (dom.analyticsPrimaryLabel) {
                dom.analyticsPrimaryLabel.textContent = progressMode === 'focus'
                    ? 'Meta de enfoque'
                    : progressMode === 'balanced'
                        ? 'Progreso equilibrado'
                        : 'Tareas completadas';
            }

            if (dom.analyticsCompletionDetail) {
                dom.analyticsCompletionDetail.textContent = progressMode === 'focus'
                    ? formatFocusDuration(focusAnalytics.rewardedFocusMs) + ' de enfoque válido'
                    : progressMode === 'balanced'
                        ? taskPercent + '% en tareas · ' + focusAnalytics.goalPercent + '% en enfoque'
                        : flowAnalytics.completed + ' de ' + flowAnalytics.eligible + ' tarea' + (flowAnalytics.eligible === 1 ? '' : 's') + ' del periodo';
            }

            if (dom.analyticsPeriodComparison) {
                dom.analyticsPeriodComparison.textContent = comparison.label;
                dom.analyticsPeriodComparison.className = 'comparison-' + comparison.tone;
            }

            if (dom.analyticsCompletionBar) {
                dom.analyticsCompletionBar.style.width = completedPercent + '%';
            }

            if (dom.analyticsProgressBar) {
                dom.analyticsProgressBar.setAttribute('aria-valuenow', String(completedPercent));
                dom.analyticsProgressBar.setAttribute('aria-valuetext', completedPercent + '% completado');
            }

            if (dom.analyticsBalanceCompleted) {
                dom.analyticsBalanceCompleted.style.width = completedPercent + '%';
            }

            if (dom.analyticsBalancePending) {
                dom.analyticsBalancePending.style.width = pendingPercent + '%';
            }

            if (dom.analyticsBalanceLabel) {
                dom.analyticsBalanceLabel.textContent = flowAnalytics.eligible > 0
                    ? flowAnalytics.completed + ' completadas · ' + flowAnalytics.notCompleted + ' sin completar'
                    : 'Sin actividad';
            }

            if (dom.analyticsBalanceTrack) {
                dom.analyticsBalanceTrack.setAttribute('aria-label', flowAnalytics.eligible > 0
                    ? flowAnalytics.completed + ' tareas completadas y ' + flowAnalytics.notCompleted + ' sin completar'
                    : 'Sin tareas registradas en el periodo');
            }

            if (dom.analyticsActionTitle) {
                dom.analyticsActionTitle.textContent = action.title;
            }

            if (dom.analyticsActionMessage) {
                dom.analyticsActionMessage.textContent = action.message;
            }

            if (dom.analyticsActiveDays) {
                dom.analyticsActiveDays.textContent = String(flowAnalytics.activeDays);
            }

            if (dom.analyticsBestRhythm) {
                dom.analyticsBestRhythm.textContent = rhythm.label;
            }

            if (dom.analyticsBestRhythmDetail) {
                dom.analyticsBestRhythmDetail.textContent = rhythm.detail;
            }

            if (dom.analyticsHabitDetail) {
                dom.analyticsHabitDetail.hidden = flowAnalytics.habitEligible === 0;
            }

            if (dom.analyticsHabitRate) {
                dom.analyticsHabitRate.textContent = flowAnalytics.habitCompletionRate + '%';
            }

            if (dom.analyticsHabitCount) {
                dom.analyticsHabitCount.textContent = flowAnalytics.habitCompleted + ' de ' + flowAnalytics.habitEligible + ' hábito' + (flowAnalytics.habitEligible === 1 ? '' : 's');
            }

            renderDataAnalyticsSurfaces(null, null, flowAnalytics);
            renderFocusAnalytics(focusAnalytics);
        }

        function getDayOfYear() {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 0);

            return Math.floor((getStartOfDay(now) - start) / 86400000);
        }

        function getDailyMission() {
            const sustainableMission = getSustainableMissionSnapshot(getTodayKey());

            if (sustainableMission && sustainableMission.id) {
                return {
                    id: sustainableMission.id,
                    title: sustainableMission.title,
                    message: sustainableMission.message,
                    current: () => sustainableMission.current,
                    target: () => sustainableMission.target,
                    statusText: () => sustainableMission.statusText
                };
            }

            const missions = [
                {
                    id: 'start',
                    title: 'Enciende el día',
                    message: 'Completa cualquier tarea para activar tu racha.',
                    current: () => getHistoryCount(getTodayKey()),
                    target: () => 1,
                    unit: 'tarea'
                },
                {
                    id: 'important',
                    title: 'Avance importante',
                    message: 'Completa una tarea importante antes de cerrar el día.',
                    current: () => getTodayCompletedPriorityCount('important'),
                    target: () => 1,
                    unit: 'importante'
                },
                {
                    id: 'urgent',
                    title: 'Quita presión',
                    message: 'Completa una tarea urgente y libera espacio mental.',
                    current: () => getTodayCompletedPriorityCount('urgent'),
                    target: () => 1,
                    unit: 'urgente'
                },
                {
                    id: 'habit',
                    title: 'Ritual pequeño',
                    message: 'Completa un hábito para fortalecer tu continuidad.',
                    current: () => getTodayCompletedHabitCount(),
                    target: () => 1,
                    unit: 'hábito'
                },
                {
                    id: 'goal',
                    title: 'Meta del día',
                    message: 'Cumple tu meta diaria y activa el cierre.',
                    current: () => getHistoryCount(getTodayKey()),
                    target: () => getDailyGoal(),
                    unit: 'tareas'
                },
                {
                    id: 'clean',
                    title: 'Mesa limpia',
                    message: 'Deja sin pendientes disponibles el tablero de hoy.',
                    current: () => {
                        const stats = getTaskStats();
                        return stats.available === 0 && getHistoryCount(getTodayKey()) > 0 ? 1 : 0;
                    },
                    target: () => 1,
                    unit: 'tablero'
                }
            ];

            return missions[getDayOfYear() % missions.length];
        }

        function getDailyMissionSnapshot() {
            const mission = getDailyMission();
            const current = Math.max(Number(mission.current()) || 0, 0);
            const target = Math.max(Number(mission.target()) || 1, 1);
            const statusText = typeof mission.statusText === 'function'
                ? mission.statusText()
                : Math.min(current, target) + '/' + target + ' ' + (mission.unit || 'avance');

            return {
                id: mission.id,
                title: mission.title,
                message: mission.message,
                current,
                target,
                statusText,
                complete: current >= target
            };
        }

        function renderDailyMission() {
            if (!dom.dailyMissionCard || !dom.dailyMissionTitle || !dom.dailyMissionMessage || !dom.dailyMissionStatus) {
                return;
            }

            const mission = getDailyMissionSnapshot();

            dom.dailyMissionTitle.textContent = mission.title;
            dom.dailyMissionMessage.textContent = mission.complete ? 'Misión cumplida. Ese pequeño extra hace que volver sea más fácil.' : mission.message;
            dom.dailyMissionStatus.textContent = mission.complete ? 'Cumplida' : mission.statusText;
            dom.dailyMissionCard.classList.toggle('complete', mission.complete);
        }

        function renderDailyClose() {
            if (!dom.dailyCloseCard || !dom.dailyCloseSummary) {
                return;
            }

            const day = getSustainableDaySnapshot(getTodayKey());
            const todayCount = day ? day.meaningfulActions : getHistoryCount(getTodayKey());
            const reachedGoal = day ? day.goalReached : todayCount >= getDailyGoal();

            dom.dailyCloseCard.hidden = !reachedGoal;

            if (!reachedGoal) {
                return;
            }

            if (dom.dailyCloseTitle) {
                dom.dailyCloseTitle.textContent = day && day.legendary
                    ? 'Cierre legendario'
                    : 'Meta cumplida';
            }

            dom.dailyCloseSummary.textContent = day && day.progressMode === 'focus'
                ? 'Confirmaste ' + Math.floor(day.rewardedFocusMs / 60000) + ' minutos de enfoque. Tu constancia queda protegida sin premiar tiempo vacío.'
                : day && day.progressMode === 'balanced'
                    ? 'Combinaste ' + todayCount + ' avances con ' + Math.floor(day.rewardedFocusMs / 60000) + ' minutos de enfoque real.'
                    : 'Hoy completaste ' + todayCount + ' de ' + getDailyGoal() + ' avances. Tu racha queda protegida para volver con menos fricción.';
        }

        function renderMotivationPanel() {
            if (!dom.dailyGoalInput || !dom.dailyGoalCount || !dom.dailyGoalBar || !dom.motivationTitle || !dom.motivationMessage) {
                return;
            }

            const sustainableDay = getSustainableDaySnapshot(getTodayKey());
            const progressMode = sustainableDay && sustainableDay.progressMode ? sustainableDay.progressMode : getProgressMode();
            const todayCount = sustainableDay ? sustainableDay.meaningfulActions : getHistoryCount(getTodayKey());
            const previousStreak = getStreakBeforeToday();
            const remainingTasks = Math.max(getDailyGoal() - todayCount, 0);
            const focusMinutes = sustainableDay ? Math.floor(sustainableDay.rewardedFocusMs / 60000) : 0;
            const focusGoalMinutes = sustainableDay ? sustainableDay.focusGoalMinutes : Math.max(Number(getDailyFocusGoalMinutes()) || 50, 15);
            const goalProgress = sustainableDay ? sustainableDay.goalPercent : Math.min((todayCount / getDailyGoal()) * 100, 100);
            const rescueState = getRescueState();

            if (documentRef.activeElement !== dom.dailyGoalInput) {
                dom.dailyGoalInput.value = getDailyGoal();
            }
            if (dom.dailyFocusGoalInput && documentRef.activeElement !== dom.dailyFocusGoalInput) {
                dom.dailyFocusGoalInput.value = focusGoalMinutes;
            }
            dom.dailyGoalCount.textContent = progressMode === 'focus'
                ? focusMinutes + '/' + focusGoalMinutes + ' min'
                : progressMode === 'balanced'
                    ? goalProgress + '%'
                    : todayCount + '/' + getDailyGoal();
            dom.dailyGoalBar.style.width = goalProgress + '%';

            if (dom.dailyGoalLabel) {
                dom.dailyGoalLabel.textContent = progressMode === 'focus'
                    ? 'enfoque diario'
                    : progressMode === 'balanced'
                        ? 'meta equilibrada'
                        : 'meta diaria';
            }

            if (dom.dailyTaskGoalSetting) {
                dom.dailyTaskGoalSetting.hidden = progressMode === 'focus';
            }

            if (dom.dailyFocusGoalSetting) {
                dom.dailyFocusGoalSetting.hidden = progressMode === 'tasks';
            }

            const goalSettings = dom.dailyGoalInput && dom.dailyGoalInput.closest
                ? dom.dailyGoalInput.closest('.daily-goal-settings')
                : null;
            if (goalSettings) {
                goalSettings.dataset.mode = progressMode;
            }

            if (progressMode === 'focus') {
                dom.motivationTitle.textContent = sustainableDay && sustainableDay.goalReached
                    ? 'Enfoque completo'
                    : focusMinutes > 0 ? 'Tu concentración ya cuenta' : 'Reserva un bloque para ti';
                dom.motivationMessage.textContent = sustainableDay && sustainableDay.goalReached
                    ? 'Cumpliste tu meta con tiempo confirmado, no solo con el reloj abierto.'
                    : focusMinutes > 0
                        ? 'Llevas ' + focusMinutes + ' min. Faltan ' + Math.max(focusGoalMinutes - focusMinutes, 0) + ' min de enfoque válido.'
                        : 'Inicia una Carrera y confirma el avance al terminar.';
                return;
            }

            if (progressMode === 'balanced') {
                const taskReady = sustainableDay && sustainableDay.taskGoalReached;
                const focusReady = sustainableDay && sustainableDay.focusGoalReached;

                dom.motivationTitle.textContent = taskReady && focusReady ? 'Día equilibrado' : 'Une intención y avance';
                dom.motivationMessage.textContent = taskReady && focusReady
                    ? 'Completaste tareas y protegiste tiempo real para hacerlas.'
                    : !taskReady && !focusReady
                        ? 'Avanza en tus tareas y suma enfoque confirmado para cerrar el día.'
                        : taskReady
                            ? 'Las tareas van bien. Ahora protege un bloque de enfoque.'
                            : 'El enfoque ya está. Cierra ' + remainingTasks + ' avance' + (remainingTasks === 1 ? '' : 's') + ' más.';
                return;
            }

            if (rescueState.eligible) {
                dom.motivationTitle.textContent = 'Racha lista para rescate';
                dom.motivationMessage.textContent = 'Usa un escudo para cubrir ayer y seguir contando tu constancia.';
                return;
            }

            if (todayCount === 0 && previousStreak > 0) {
                dom.motivationTitle.textContent = 'Racha dormida';
                dom.motivationMessage.textContent = 'Completa una tarea para despertar tu impulso de ' + previousStreak + ' días.';
                return;
            }

            if (todayCount === 0) {
                dom.motivationTitle.textContent = 'Empieza suave';
                dom.motivationMessage.textContent = 'Una tarea basta para pintar el cuadro de hoy y arrancar la racha.';
                return;
            }

            if (remainingTasks > 0) {
                dom.motivationTitle.textContent = 'Racha protegida';
                dom.motivationMessage.textContent = 'Faltan ' + remainingTasks + ' para completar tu meta diaria.';
                return;
            }

            dom.motivationTitle.textContent = 'Meta diaria completa';
            dom.motivationMessage.textContent = 'Hoy ya cumpliste. Cualquier extra sube la intensidad del cuadro.';
        }

        function renderProgressSections() {
            if (!dom.progressTabs || !dom.progressSections || dom.progressSections.length === 0) {
                return;
            }

            const activeView = getActiveProgressView();
            const heading = PROGRESS_VIEW_HEADINGS[activeView] || PROGRESS_VIEW_HEADINGS.today;

            if (dom.progressHeadingKicker) {
                dom.progressHeadingKicker.textContent = heading.kicker;
            }

            if (dom.progressHeadingTitle) {
                dom.progressHeadingTitle.textContent = heading.title;
            }

            dom.progressTabButtons.forEach(button => {
                const isActive = button.dataset.progressView === activeView;

                button.classList.toggle('active', isActive);
                button.setAttribute('aria-selected', isActive.toString());
                button.tabIndex = isActive ? 0 : -1;
            });

            dom.progressSections.forEach(section => {
                const isActive = section.dataset.progressSection === activeView;

                section.classList.toggle('progress-section-hidden', !isActive);
                section.setAttribute('aria-hidden', (!isActive).toString());
            });
        }

        function setProgressView(view, shouldSave) {
            const nextView = normalizeProgressView(view);

            setActiveProgressView(nextView);

            if (shouldSave) {
                saveProgressView();
            }

            renderProgressSections();

            if (nextView === 'streak') {
                scheduleContributionGridRender();
            }
        }

        function handleProgressTabClick(event) {
            const button = event.target.closest('[data-progress-view]');

            if (!button) {
                return;
            }

            setProgressView(button.dataset.progressView, true);
        }

        function handleFlowPeriodChange(event) {
            const target = event && event.target && typeof event.target.closest === 'function'
                ? event.target.closest('[data-analytics-period]')
                : event && event.target;
            const period = target && target.dataset && target.dataset.analyticsPeriod
                ? target.dataset.analyticsPeriod
                : target && target.value;

            if (!period) {
                return;
            }

            setActiveFlowPeriod(normalizeFlowPeriod(period));
            saveFlowPeriod();
            renderAnalyticsPanel();
        }

        function renderProgressDashboard() {
            renderStreakStats();
            renderStreakPrestigeRoad();
            renderStreakSafety();
            renderRecommendedGoal();
            renderMotivationPanel();
            renderAnalyticsPanel();
            renderDailyMission();
            renderDailyClose();
            renderNextReward();
            renderProgressSections();

            if (getActiveProgressView() === 'streak') {
                scheduleContributionGridRender();
            }
        }

        return {
            normalizeFlowPeriod,
            normalizeProgressView,
            getProgressViewKeys: () => PROGRESS_VIEWS.slice(),
            loadProgressView,
            saveProgressView,
            loadFlowPeriod,
            saveFlowPeriod,
            getDateLabel,
            getPeriodEntries,
            getStatsFromEntries,
            getPeriodStats,
            getCurrentMonthStats,
            getMonthLabel,
            getMonthRange,
            getCurrentWeekRange,
            getCurrentWeekToDateRange,
            getCurrentQuarterRange,
            getAnalyticsPeriodRange,
            getDailyStat,
            getDailyStatsForRange,
            getFlowPeriodAnalytics,
            getFocusPeriodAnalytics,
            getPreviousAnalyticsPeriodRange,
            getPreviousFlowPeriodAnalytics,
            isDateKeyInRange,
            getTodoScheduleDateKey,
            getTodosRelevantForRange,
            getPercent,
            getMonthlyAnalytics,
            getMonthlyAnalyticsHistory,
            getDailyStatEntries,
            sumDailyStats,
            getCompletionHoursForTodos,
            formatHourLabel,
            getBestCompletionWindow,
            getWeekdayName,
            getBestRhythmInsight,
            getFlowRhythmInsight,
            getMinimalAnalyticsAdvice,
            getPeriodComparison,
            getReliableRhythm,
            getPerformanceAdvice,
            getBacklogAnalytics,
            getWeeklyLifecycleAnalytics,
            getMonthlyFunnelAnalytics,
            getClarityAnalytics,
            getConsistencyAnalytics,
            getRecentHistoryCounts,
            getWeeklyActivities,
            getAdaptiveGoalRecommendation,
            getAdaptiveFocusGoalRecommendation,
            getProgressGoalRecommendation,
            getRecommendedDailyGoal,
            getProductivityProfile,
            getStreakRiskInsight,
            getDominantCompletedPriority,
            getAnalyticsNextAction,
            getAnalyticsInsights,
            getMonthlyRecap,
            getAnalyticsSnapshot,
            updateDailyGoal,
            updateFocusGoal,
            renderRecommendedGoal,
            renderPerformanceSummary,
            renderMonthlyCompletionDonut,
            renderAnalyticsTooltips,
            renderMonthlyAnalytics,
            renderWeeklyFlowChart,
            renderDataAnalyticsSurfaces,
            renderAnalyticsPanel,
            getDailyMission,
            getDailyMissionSnapshot,
            renderDailyMission,
            renderDailyClose,
            renderMotivationPanel,
            renderProgressSections,
            setProgressView,
            handleProgressTabClick,
            handleFlowPeriodChange,
            renderProgressDashboard
        };
    }

    function fn(candidate, fallback) {
        return typeof candidate === 'function' ? candidate : fallback;
    }

    function createEmptyDailyStat(dateKey) {
        return {
            dateKey,
            created: 0,
            completed: 0,
            habitsCompleted: 0,
            tasksCompleted: 0,
            urgentCompleted: 0,
            importantCompleted: 0,
            normalCompleted: 0,
            deleted: 0,
            reactivated: 0,
            edited: 0,
            snoozed: 0,
            goalChanges: 0,
            usageEvents: 0,
            completionValue: 0
        };
    }

    function emptyLifecycle() {
        return {
            records: [],
            createdRecords: [],
            completedRecords: [],
            deletedUnfinishedRecords: [],
            reactivatedRecords: [],
            eligible: 0,
            created: 0,
            completed: 0,
            deleted: 0,
            reactivated: 0,
            completionRate: 0,
            notCompleted: 0
        };
    }

    function createFallbackEngine() {
        return {
            summarizeFlow({ entries = [], lifecycle = {} } = {}) {
                const completed = Number(lifecycle.completed || 0);
                const eligible = Number(lifecycle.eligible || 0);
                const completionRate = eligible > 0 ? Math.min(Math.max(Math.round((completed / eligible) * 100), 0), 100) : 0;
                const bestDay = entries.reduce((bestEntry, entry) => {
                    return Number(entry.completed || 0) > Number(bestEntry.completed || 0) ? entry : bestEntry;
                }, { dateKey: null, completed: 0 });

                return {
                    eligible,
                    completed,
                    completionRate,
                    averageDaily: entries.length > 0 ? completed / entries.length : 0,
                    bestDay,
                    hasFlow: eligible > 0 || completed > 0 || Number(lifecycle.reactivated || 0) > 0
                };
            }
        };
    }

    global.TasklyzenAnalyticsProgress = {
        normalizeFlowPeriod,
        normalizeProgressView,
        getProgressViewKeys: () => PROGRESS_VIEWS.slice(),
        createAnalyticsProgressController
    };
})(window);
