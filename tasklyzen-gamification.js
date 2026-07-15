/*
 * Módulo: motor de rachas
 * Propósito: calcular rachas, escudos y niveles de constancia.
 * Entradas: historial de completadas, meta diaria y estado persistido.
 * Salidas: window.TasklyzenGamification con el controlador de rachas.
 * Dependencias: utilidades y persistencia recibidas por inyección.
 */
(function exposeTasklyzenGamification(global) {
    function normalizeGamificationState(value) {
        const source = value && typeof value === 'object' ? value : {};
        const migration = global.TasklyzenDataMigration;
        const sanitized = migration && typeof migration.stripRetiredGamificationFields === 'function'
            ? migration.stripRetiredGamificationFields(source)
            : { value: source };
        const normalizedState = { ...sanitized.value };

        normalizedState.usedShields = Math.max(Math.round(Number(source.usedShields) || 0), 0);
        normalizedState.protectedDates = Array.isArray(source.protectedDates)
            ? [...new Set(source.protectedDates.filter(dateKey => /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))))]
            : [];
        normalizedState.lastStreakCelebrationDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.lastStreakCelebrationDate || ''))
            ? source.lastStreakCelebrationDate
            : null;

        return normalizedState;
    }

    function loadGamification(storage, key) {
        if (!storage || typeof storage.readJson !== 'function') {
            return normalizeGamificationState(null);
        }

        return normalizeGamificationState(storage.readJson(key, null));
    }

    function createGamificationController(options) {
        const config = options || {};
        const prestigeLevels = Array.isArray(config.prestigeLevels) ? config.prestigeLevels : [];
        const utils = config.utils || {};
        const getGamification = fn(config.getGamification, () => normalizeGamificationState(null));
        const setGamification = fn(config.setGamification, () => {});
        const saveGamification = fn(config.saveGamification, () => {});
        const getCompletionHistory = fn(config.getCompletionHistory, () => ({}));
        const getDailyGoal = fn(config.getDailyGoal, () => 1);
        const renderCurrentPage = fn(config.renderCurrentPage, () => {});
        const getStartOfDay = fn(utils.getStartOfDay, value => {
            const date = value ? new Date(value) : new Date();
            date.setHours(0, 0, 0, 0);
            return date;
        });
        const formatDateKey = fn(utils.formatDateKey, date => new Date(date).toISOString().slice(0, 10));
        const addDays = fn(utils.addDays, (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return next;
        });

        function getState() {
            return getGamification();
        }

        function normalizeGamification() {
            const normalizedState = normalizeGamificationState(getState());
            const earnedShields = Math.floor(Object.keys(getCompletionHistory()).length / 5);
            const protectedDates = [...new Set(normalizedState.protectedDates)].sort();

            normalizedState.usedShields = Math.max(Math.min(normalizedState.usedShields, earnedShields, protectedDates.length), 0);
            normalizedState.protectedDates = protectedDates.slice(-normalizedState.usedShields);
            setGamification(normalizedState);
            saveGamification();

            return normalizedState;
        }

        function getHistoryCount(dateKey) {
            return Number(getCompletionHistory()[dateKey] || 0);
        }

        function isProtectedDate(dateKey) {
            return getState().protectedDates.includes(dateKey);
        }

        function hasActiveCredit(dateKey) {
            return getHistoryCount(dateKey) > 0 || isProtectedDate(dateKey);
        }

        function getStreakByRule(rule) {
            let streak = 0;
            let date = getStartOfDay(new Date());

            while (rule(formatDateKey(date))) {
                streak += 1;
                date = addDays(date, -1);
            }

            return streak;
        }

        function getActiveStreakEndingAt(date) {
            let streak = 0;
            let cursor = getStartOfDay(date);

            while (hasActiveCredit(formatDateKey(cursor))) {
                streak += 1;
                cursor = addDays(cursor, -1);
            }

            return streak;
        }

        function getDateRangeStart() {
            const state = getState();
            const dateKeys = Object.keys(getCompletionHistory()).concat(state.protectedDates);

            if (dateKeys.length === 0) {
                return getStartOfDay(new Date());
            }

            return dateKeys.reduce((oldestDate, dateKey) => {
                const date = getStartOfDay(new Date(dateKey + 'T00:00:00'));
                return date < oldestDate ? date : oldestDate;
            }, getStartOfDay(new Date()));
        }

        function getLongestStreakByRule(rule) {
            const today = getStartOfDay(new Date());
            let date = getDateRangeStart();
            let currentStreak = 0;
            let longestStreak = 0;

            while (date <= today) {
                if (rule(formatDateKey(date))) {
                    currentStreak += 1;
                    longestStreak = Math.max(longestStreak, currentStreak);
                } else {
                    currentStreak = 0;
                }

                date = addDays(date, 1);
            }

            return longestStreak;
        }

        function getCurrentStreak() {
            const today = getStartOfDay(new Date());
            const todayKey = formatDateKey(today);

            return hasActiveCredit(todayKey)
                ? getStreakByRule(hasActiveCredit)
                : getActiveStreakEndingAt(addDays(today, -1));
        }

        function getStreakBeforeToday() {
            return getActiveStreakEndingAt(addDays(getStartOfDay(new Date()), -1));
        }

        function hasCelebratedStreakDate(dateKey) {
            return getState().lastStreakCelebrationDate === dateKey;
        }

        function markStreakDateCelebrated(dateKey) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) {
                return false;
            }

            getState().lastStreakCelebrationDate = dateKey;
            saveGamification();
            return true;
        }

        function getPerfectStreak() {
            return getStreakByRule(dateKey => getHistoryCount(dateKey) >= getDailyGoal());
        }

        function getLegendaryStreak() {
            return getStreakByRule(dateKey => getHistoryCount(dateKey) > getDailyGoal());
        }

        function getLongestActiveStreak() {
            return getLongestStreakByRule(hasActiveCredit);
        }

        function getActiveDaysTotal() {
            return Object.keys(getCompletionHistory()).length;
        }

        function getTotalCompletedTasks() {
            return Object.keys(getCompletionHistory()).reduce((total, dateKey) => total + getHistoryCount(dateKey), 0);
        }

        function getBestDayTotal() {
            return Object.keys(getCompletionHistory()).reduce((bestCount, dateKey) => Math.max(bestCount, getHistoryCount(dateKey)), 0);
        }

        function getEarnedShields() {
            return Math.floor(getActiveDaysTotal() / 5);
        }

        function getAvailableShields() {
            return Math.max(getEarnedShields() - getState().usedShields, 0);
        }

        function getRescueState() {
            const today = getStartOfDay(new Date());
            const todayKey = formatDateKey(today);
            const yesterday = addDays(today, -1);
            const yesterdayKey = formatDateKey(yesterday);
            const previousStreak = getActiveStreakEndingAt(addDays(today, -2));
            const missedYesterday = !hasActiveCredit(yesterdayKey);
            const hasReturnedToday = hasActiveCredit(todayKey);
            const availableShields = getAvailableShields();

            return {
                yesterdayKey,
                availableShields,
                eligible: missedYesterday && hasReturnedToday && previousStreak > 0 && availableShields > 0,
                waitingForToday: missedYesterday && !hasReturnedToday && previousStreak > 0 && availableShields > 0,
                hasPastStreak: previousStreak > 0
            };
        }

        function rescueYesterday() {
            const rescueState = getRescueState();
            const state = getState();

            if (!rescueState.eligible) {
                return false;
            }

            state.usedShields += 1;
            state.protectedDates = [...new Set(state.protectedDates.concat(rescueState.yesterdayKey))];
            saveGamification();
            renderCurrentPage();
            return true;
        }

        function getStreakPrestigeLevel(streak) {
            return prestigeLevels.reduce((currentLevel, level) => streak >= level.min ? level : currentLevel, prestigeLevels[0] || {
                min: 0,
                label: 'Sin racha',
                className: 'streak-empty'
            });
        }

        function getStreakPrestigeClassNames() {
            return prestigeLevels.map(level => level.className);
        }

        function getNextStreakReward(streak) {
            const nextReward = prestigeLevels.find(reward => reward.min > 0 && streak < reward.min);

            if (nextReward) {
                return {
                    target: nextReward.min,
                    title: nextReward.rewardTitle,
                    message: nextReward.rewardMessage,
                    className: nextReward.className
                };
            }

            return {
                target: Math.ceil((streak + 1) / 100) * 100,
                title: 'Racha maestra',
                message: 'Cada bloque de 100 días vuelve más fuerte tu constancia.',
                className: getStreakPrestigeLevel(streak).className
            };
        }

        function getContributionLevel(count) {
            if (count >= 5) return 4;
            if (count >= 3) return 3;
            if (count >= 2) return 2;
            if (count >= 1) return 1;
            return 0;
        }

        return {
            normalizeGamification,
            getHistoryCount,
            isProtectedDate,
            hasActiveCredit,
            getStreakByRule,
            getActiveStreakEndingAt,
            getDateRangeStart,
            getLongestStreakByRule,
            getCurrentStreak,
            getStreakBeforeToday,
            hasCelebratedStreakDate,
            markStreakDateCelebrated,
            getPerfectStreak,
            getLegendaryStreak,
            getLongestActiveStreak,
            getActiveDaysTotal,
            getTotalCompletedTasks,
            getBestDayTotal,
            getEarnedShields,
            getAvailableShields,
            getRescueState,
            rescueYesterday,
            getStreakPrestigeLevel,
            getStreakPrestigeClassNames,
            getNextStreakReward,
            getContributionLevel
        };
    }

    function fn(candidate, fallback) {
        return typeof candidate === 'function' ? candidate : fallback;
    }

    global.TasklyzenGamification = {
        normalizeGamificationState,
        loadGamification,
        createGamificationController
    };
})(window);
