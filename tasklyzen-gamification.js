/*
 * Modulo: motor de gamificacion
 * Proposito:
 * - Gestionar estado, rachas, escudos, rarezas y resolucion de logros.
 * Entradas:
 * - Estado persistido, definiciones de logros, historial y callbacks del runtime.
 * Salidas:
 * - window.TasklyzenGamification con helpers y createGamificationController.
 * Dependencias:
 * - Ninguna directa; recibe storage, utilidades y callbacks por inyeccion.
 */
(function exposeTasklyzenGamification(global) {
    function createAchievementState() {
        return {
            pendingDate: null,
            permanent: false,
            unlockedAt: null,
            repeatCount: 0,
            pendingRepeatDate: null,
            pendingRepeatCount: 0,
            lastRepeatOn: null
        };
    }

    function normalizeAchievementState(state) {
        const source = state && typeof state === 'object' ? state : {};
        const repeatCount = Number(source.repeatCount);
        const pendingRepeatCount = Number(source.pendingRepeatCount);
        const normalizedState = {
            permanent: Boolean(source.permanent),
            unlockedAt: typeof source.unlockedAt === 'string' ? source.unlockedAt : null,
            pendingDate: typeof source.pendingDate === 'string' ? source.pendingDate : null,
            repeatCount: Number.isFinite(repeatCount) && repeatCount > 0 ? Math.floor(repeatCount) : 0,
            pendingRepeatDate: typeof source.pendingRepeatDate === 'string' ? source.pendingRepeatDate : null,
            pendingRepeatCount: Number.isFinite(pendingRepeatCount) && pendingRepeatCount > 0 ? Math.floor(pendingRepeatCount) : 0,
            lastRepeatOn: typeof source.lastRepeatOn === 'string' ? source.lastRepeatOn : null
        };

        if (normalizedState.repeatCount > 0 || normalizedState.pendingRepeatDate) {
            normalizedState.permanent = true;
            normalizedState.unlockedAt = normalizedState.unlockedAt
                || normalizedState.lastRepeatOn
                || normalizedState.pendingRepeatDate
                || normalizedState.pendingDate
                || new Date().toISOString().slice(0, 10);
            normalizedState.pendingDate = null;
            normalizedState.repeatCount = 0;
            normalizedState.pendingRepeatDate = null;
            normalizedState.pendingRepeatCount = 0;
            normalizedState.lastRepeatOn = null;
        }

        return normalizedState;
    }

    function normalizeGamificationState(value) {
        const source = value && typeof value === 'object' ? value : {};
        const normalizedState = {
            usedShields: Math.max(Math.round(Number(source.usedShields) || 0), 0),
            protectedDates: Array.isArray(source.protectedDates)
                ? source.protectedDates.filter(dateKey => /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')))
                : [],
            achievementStates: {},
            featuredAchievements: Array.isArray(source.featuredAchievements)
                ? source.featuredAchievements.filter(achievementId => typeof achievementId === 'string')
                : [],
            unseenAchievementIds: Array.isArray(source.unseenAchievementIds)
                ? source.unseenAchievementIds.filter(achievementId => typeof achievementId === 'string')
                : [],
            lastStreakCelebrationDate: /^\d{4}-\d{2}-\d{2}$/.test(String(source.lastStreakCelebrationDate || ''))
                ? source.lastStreakCelebrationDate
                : null
        };

        Object.keys(source.achievementStates || {}).forEach(achievementId => {
            normalizedState.achievementStates[achievementId] = normalizeAchievementState(source.achievementStates[achievementId]);
        });

        normalizedState.protectedDates = [...new Set(normalizedState.protectedDates)];
        normalizedState.featuredAchievements = [...new Set(normalizedState.featuredAchievements)];
        normalizedState.unseenAchievementIds = [...new Set(normalizedState.unseenAchievementIds)];

        return normalizedState;
    }

    function loadGamification(storage, key) {
        if (!storage || typeof storage.readJson !== 'function') {
            return normalizeGamificationState(null);
        }

        const savedState = storage.readJson(key, null);
        const normalizedState = normalizeGamificationState(savedState);
        const legacyUnlockedAchievements = savedState && Array.isArray(savedState.unlockedAchievements)
            ? savedState.unlockedAchievements
            : [];

        legacyUnlockedAchievements.forEach(achievementId => {
            if (typeof achievementId !== 'string') {
                return;
            }

            normalizedState.achievementStates[achievementId] = {
                ...createAchievementState(),
                ...normalizedState.achievementStates[achievementId],
                permanent: true,
                unlockedAt: normalizedState.achievementStates[achievementId] && normalizedState.achievementStates[achievementId].unlockedAt
                    ? normalizedState.achievementStates[achievementId].unlockedAt
                    : 'legacy'
            };
        });

        return normalizedState;
    }

    function createGamificationController(options) {
        const config = options || {};
        const definitions = Array.isArray(config.definitions) ? config.definitions : [];
        const rarities = config.rarities || {};
        const categories = config.categories || {};
        const rarityKeys = Array.isArray(config.rarityKeys) ? config.rarityKeys : Object.keys(rarities);
        const prestigeLevels = Array.isArray(config.prestigeLevels) ? config.prestigeLevels : [];
        const featuredLimit = Math.max(Math.round(Number(config.featuredLimit) || 3), 1);
        const utils = config.utils || {};
        const getGamification = fn(config.getGamification, () => normalizeGamificationState(null));
        const setGamification = fn(config.setGamification, () => {});
        const saveGamification = fn(config.saveGamification, () => {});
        const getCompletionHistory = fn(config.getCompletionHistory, () => ({}));
        const getDailyGoal = fn(config.getDailyGoal, () => 1);
        const showToast = fn(config.showToast, () => {});
        const renderCurrentPage = fn(config.renderCurrentPage, () => {});
        const renderAchievementSurfaces = fn(config.renderAchievementSurfaces, () => {});
        const queueAchievementShowcase = fn(config.queueAchievementShowcase, () => {});
        const logAnalyticsEvent = fn(config.logAnalyticsEvent, () => {});
        const getTodayKey = fn(utils.getTodayKey, () => new Date().toISOString().slice(0, 10));
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
            const allowedUsedShields = Math.min(normalizedState.usedShields, earnedShields, protectedDates.length);
            const knownAchievementIds = definitions.map(achievement => achievement.id);
            const achievementStates = {};

            normalizedState.usedShields = Math.max(allowedUsedShields, 0);
            normalizedState.protectedDates = protectedDates.slice(-normalizedState.usedShields);
            knownAchievementIds.forEach(achievementId => {
                if (normalizedState.achievementStates[achievementId]) {
                    achievementStates[achievementId] = normalizeAchievementState(normalizedState.achievementStates[achievementId]);
                }
            });
            normalizedState.achievementStates = achievementStates;
            normalizedState.featuredAchievements = [...new Set(normalizedState.featuredAchievements)]
                .filter(achievementId => knownAchievementIds.includes(achievementId))
                .slice(0, featuredLimit);
            setGamification(normalizedState);
            saveGamification();
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
            return Object.keys(getCompletionHistory()).reduce((bestCount, dateKey) => {
                return Math.max(bestCount, getHistoryCount(dateKey));
            }, 0);
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
                return;
            }

            state.usedShields += 1;
            state.protectedDates = [...new Set(state.protectedDates.concat(rescueState.yesterdayKey))];
            saveGamification();
            syncAchievementCollection(true);
            renderCurrentPage();
        }

        function getRarityMeta(rarity) {
            return rarities[rarity] || rarities.common || { label: 'Común', weight: 1 };
        }

        function getRarityRank(rarity) {
            return rarityKeys.indexOf(rarity) + 1 || 1;
        }

        function getRarityRankLabel(rarity) {
            return 'Rango ' + getRarityRank(rarity);
        }

        function getCategoryMeta(category) {
            return categories[category] || categories.daily || { label: 'Diarias' };
        }

        function getAchievementState(achievementId) {
            const state = getState();

            if (!state.achievementStates[achievementId]) {
                state.achievementStates[achievementId] = createAchievementState();
            }

            return state.achievementStates[achievementId];
        }

        function finalizePendingAchievements() {
            const todayKey = getTodayKey();
            let changed = false;

            Object.keys(getState().achievementStates).forEach(achievementId => {
                const state = getAchievementState(achievementId);

                if (state.pendingDate && state.pendingDate !== todayKey) {
                    state.permanent = true;
                    state.unlockedAt = state.unlockedAt || state.pendingDate;
                    state.pendingDate = null;
                    changed = true;
                }

                if (state.pendingRepeatDate && state.pendingRepeatDate !== todayKey) {
                    state.repeatCount += state.pendingRepeatCount || 1;
                    state.lastRepeatOn = state.pendingRepeatDate;
                    state.pendingRepeatDate = null;
                    state.pendingRepeatCount = 0;
                    state.permanent = true;
                    state.unlockedAt = state.unlockedAt || state.lastRepeatOn;
                    changed = true;
                }
            });

            return changed;
        }

        function forceFinalizePendingAchievements() {
            Object.keys(getState().achievementStates).forEach(achievementId => {
                const state = getAchievementState(achievementId);

                if (state.pendingDate) {
                    state.permanent = true;
                    state.unlockedAt = state.unlockedAt || state.pendingDate;
                    state.pendingDate = null;
                }

                if (state.pendingRepeatDate) {
                    state.repeatCount += state.pendingRepeatCount || 1;
                    state.lastRepeatOn = state.pendingRepeatDate;
                    state.unlockedAt = state.unlockedAt || state.pendingRepeatDate;
                    state.pendingRepeatDate = null;
                    state.pendingRepeatCount = 0;
                    state.permanent = true;
                }
            });

            saveGamification();
            renderCurrentPage();
        }

        function resolveAchievement(definition) {
            const state = getAchievementState(definition.id);
            const current = Math.max(Number(definition.current()) || 0, 0);
            const target = Math.max(Number(definition.target()) || 1, 1);
            const earned = current >= target;
            const remaining = Math.max(target - current, 0);
            const permanent = Boolean(state.permanent) || state.repeatCount > 0;
            const todayKey = getTodayKey();
            const pending = state.pendingDate === todayKey || state.pendingRepeatDate === todayKey;
            const repeatTotal = state.repeatCount + (state.pendingRepeatDate === todayKey ? state.pendingRepeatCount : 0);
            const collected = permanent || pending;
            const progress = collected && !definition.repeatable ? 1 : Math.min(current / target, 1);
            let statusLabel = current + '/' + target;

            if (pending) {
                statusLabel = definition.repeatable && repeatTotal > 1 ? 'En revisión x' + repeatTotal : 'En revisión hoy';
            } else if (permanent) {
                statusLabel = definition.repeatable ? 'Ganado x' + Math.max(state.repeatCount, 1) : 'Coleccionado';
            }

            return {
                id: definition.id,
                title: definition.title,
                message: definition.message,
                rarity: definition.rarity,
                rarityLabel: getRarityMeta(definition.rarity).label,
                rarityWeight: getRarityMeta(definition.rarity).weight,
                category: definition.category || 'daily',
                categoryLabel: getCategoryMeta(definition.category || 'daily').label,
                type: definition.type,
                mark: definition.mark,
                current,
                target,
                remaining,
                earned,
                permanent,
                pending,
                repeatable: Boolean(definition.repeatable),
                tiered: Boolean(definition.tiered),
                repeatTotal,
                collected,
                featured: getState().featuredAchievements.includes(definition.id),
                unseen: getState().unseenAchievementIds.includes(definition.id),
                unlockedAt: state.unlockedAt || state.pendingDate || state.lastRepeatOn || state.pendingRepeatDate || null,
                statusLabel,
                progress
            };
        }

        function getUnseenAchievements() {
            const unseenIds = new Set(getState().unseenAchievementIds);

            return getAllAchievements()
                .filter(achievement => achievement.collected && unseenIds.has(achievement.id))
                .sort((first, second) => second.rarityWeight - first.rarityWeight || first.title.localeCompare(second.title));
        }

        function markAchievementsUnseen(achievements) {
            const nextIds = (Array.isArray(achievements) ? achievements : [])
                .filter(achievement => achievement && achievement.collected)
                .map(achievement => achievement.id);

            if (nextIds.length === 0) {
                return false;
            }

            getState().unseenAchievementIds = [...new Set(getState().unseenAchievementIds.concat(nextIds))];
            return true;
        }

        function markAchievementsSeen(achievementIds) {
            const ids = Array.isArray(achievementIds) ? new Set(achievementIds) : null;
            const previousIds = getState().unseenAchievementIds;
            const nextIds = ids ? previousIds.filter(id => !ids.has(id)) : [];

            if (nextIds.length === previousIds.length) {
                return false;
            }

            getState().unseenAchievementIds = nextIds;
            saveGamification();
            return true;
        }

        function getAllAchievements() {
            return definitions.map(resolveAchievement);
        }

        function sortAchievements(achievements, mode) {
            const sortedAchievements = achievements.slice();

            if (mode === 'rarity-desc') {
                return sortedAchievements.sort((first, second) => second.rarityWeight - first.rarityWeight || first.title.localeCompare(second.title));
            }

            if (mode === 'rarity-asc') {
                return sortedAchievements.sort((first, second) => first.rarityWeight - second.rarityWeight || first.title.localeCompare(second.title));
            }

            if (mode === 'progress-desc') {
                return sortedAchievements.sort((first, second) => {
                    if (first.collected !== second.collected) {
                        return first.collected ? 1 : -1;
                    }

                    if (!first.collected && first.remaining !== second.remaining) {
                        return first.remaining - second.remaining;
                    }

                    if (first.progress !== second.progress) {
                        return second.progress - first.progress;
                    }

                    if (first.target !== second.target) {
                        return first.target - second.target;
                    }

                    return first.rarityWeight - second.rarityWeight || first.title.localeCompare(second.title);
                });
            }

            if (mode === 'collected-first') {
                return sortedAchievements.sort((first, second) => {
                    if (first.collected !== second.collected) {
                        return first.collected ? -1 : 1;
                    }

                    if (first.pending !== second.pending) {
                        return first.pending ? -1 : 1;
                    }

                    return second.rarityWeight - first.rarityWeight || first.title.localeCompare(second.title);
                });
            }

            if (mode === 'title-asc') {
                return sortedAchievements.sort((first, second) => first.title.localeCompare(second.title));
            }

            return sortedAchievements.sort((first, second) => {
                if (first.collected !== second.collected) {
                    return first.collected ? -1 : 1;
                }

                if (first.pending !== second.pending) {
                    return first.pending ? -1 : 1;
                }

                if (first.collected) {
                    const dateDifference = String(second.unlockedAt || '').localeCompare(String(first.unlockedAt || ''));

                    return dateDifference || second.rarityWeight - first.rarityWeight || first.title.localeCompare(second.title);
                }

                if (first.progress !== second.progress) {
                    return second.progress - first.progress;
                }

                if (first.remaining !== second.remaining) {
                    return first.remaining - second.remaining;
                }

                if (first.target !== second.target) {
                    return first.target - second.target;
                }

                return first.rarityWeight - second.rarityWeight || first.title.localeCompare(second.title);
            });
        }

        function getAchievementCollection() {
            return sortAchievements(getAllAchievements(), 'smart');
        }

        function getFilteredAchievementCollection(categoryFilter, rarityFilter, sortMode) {
            const category = categoryFilter || 'all';
            const rarity = rarityFilter || 'all';
            const achievements = getAllAchievements().filter(achievement => {
                const matchesCategory = category === 'all' || achievement.category === category;
                const matchesRarity = rarity === 'all' || achievement.rarity === rarity;

                return matchesCategory && matchesRarity;
            });

            return sortAchievements(achievements, sortMode || 'smart');
        }

        function syncAchievementCollection(shouldShow) {
            const todayKey = getTodayKey();
            const changedByDate = finalizePendingAchievements();
            const newAchievements = [];
            let changed = changedByDate;

            definitions.forEach(definition => {
                const current = Math.max(Number(definition.current()) || 0, 0);
                const target = Math.max(Number(definition.target()) || 1, 1);
                const earned = current >= target;
                const state = getAchievementState(definition.id);

                if (definition.repeatable) {
                    if (earned && state.pendingRepeatDate !== todayKey) {
                        state.pendingRepeatDate = todayKey;
                        state.pendingRepeatCount = 1;
                        changed = true;
                        newAchievements.push(resolveAchievement(definition));
                    } else if (!earned && state.pendingRepeatDate === todayKey) {
                        state.pendingRepeatDate = null;
                        state.pendingRepeatCount = 0;
                        changed = true;
                    }

                    return;
                }

                if (state.permanent) {
                    if (state.pendingDate === todayKey) {
                        state.pendingDate = null;
                        changed = true;
                    }

                    return;
                }

                if (earned && state.pendingDate !== todayKey) {
                    state.pendingDate = todayKey;
                    changed = true;
                    newAchievements.push(resolveAchievement(definition));
                } else if (!earned && state.pendingDate === todayKey) {
                    state.pendingDate = null;
                    changed = true;
                }
            });

            getState().featuredAchievements = getState().featuredAchievements.filter(achievementId => {
                const achievement = getAllAchievements().find(item => item.id === achievementId);
                return achievement && achievement.collected;
            });

            const collectedIds = new Set(getAllAchievements().filter(achievement => achievement.collected).map(achievement => achievement.id));
            const previousUnseenIds = getState().unseenAchievementIds;
            getState().unseenAchievementIds = previousUnseenIds.filter(achievementId => collectedIds.has(achievementId));
            changed = changed || previousUnseenIds.length !== getState().unseenAchievementIds.length;

            if (shouldShow && newAchievements.length > 0) {
                newAchievements.forEach(achievement => {
                    logAnalyticsEvent('achievement_unlocked', {
                        achievementId: achievement.id,
                        rarity: achievement.rarity,
                        category: achievement.category,
                        repeatable: achievement.repeatable
                    });
                });
                changed = markAchievementsUnseen(newAchievements) || changed;
            }

            if (changed) {
                saveGamification();
            }
        }

        function getAutomaticFeaturedAchievements() {
            const achievements = getAllAchievements();
            const collectedAchievements = achievements
                .filter(achievement => achievement.collected)
                .sort((first, second) => {
                    if (first.pending !== second.pending) {
                        return first.pending ? -1 : 1;
                    }

                    if (first.rarityWeight !== second.rarityWeight) {
                        return second.rarityWeight - first.rarityWeight;
                    }

                    return first.title.localeCompare(second.title);
                });
            const closestLockedAchievements = achievements
                .filter(achievement => !achievement.collected)
                .sort((first, second) => {
                    if (first.remaining !== second.remaining) {
                        return first.remaining - second.remaining;
                    }

                    if (first.progress !== second.progress) {
                        return second.progress - first.progress;
                    }

                    if (first.target !== second.target) {
                        return first.target - second.target;
                    }

                    return first.rarityWeight - second.rarityWeight || first.title.localeCompare(second.title);
                });

            return collectedAchievements.concat(closestLockedAchievements).slice(0, featuredLimit);
        }

        function getFeaturedAchievements() {
            const achievements = getAllAchievements();
            const achievementById = new Map(achievements.map(achievement => [achievement.id, achievement]));
            const selectedAchievements = getState().featuredAchievements
                .map(achievementId => achievementById.get(achievementId))
                .filter(achievement => achievement && achievement.collected)
                .slice(0, featuredLimit);

            if (selectedAchievements.length > 0) {
                return selectedAchievements;
            }

            return getAutomaticFeaturedAchievements();
        }

        function toggleFeaturedAchievement(achievementId) {
            const achievement = getAllAchievements().find(item => item.id === achievementId);
            const featuredAchievements = getState().featuredAchievements;
            const currentIndex = featuredAchievements.indexOf(achievementId);

            if (currentIndex >= 0) {
                featuredAchievements.splice(currentIndex, 1);
                saveGamification();
                renderAchievementSurfaces();
                return;
            }

            if (!achievement || !achievement.collected) {
                showToast('Primero debes conseguir ese logro.', 'error');
                return;
            }

            if (featuredAchievements.length >= featuredLimit) {
                showToast('Tu vitrina ya tiene 3 logros. Quita uno para agregar otro.', 'error');
                return;
            }

            featuredAchievements.push(achievementId);
            saveGamification();
            renderAchievementSurfaces();
        }

        function featureAchievement(achievementId) {
            const featuredAchievements = getState().featuredAchievements;

            if (!featuredAchievements.includes(achievementId)) {
                getState().featuredAchievements = featuredAchievements.slice(0, featuredLimit - 1);
                getState().featuredAchievements.push(achievementId);
                saveGamification();
            }

            return getState().featuredAchievements.slice();
        }

        function unfeatureAchievement(achievementId) {
            getState().featuredAchievements = getState().featuredAchievements.filter(id => id !== achievementId);
            saveGamification();

            return getState().featuredAchievements.slice();
        }

        function getStreakPrestigeLevel(streak) {
            return prestigeLevels.reduce((currentLevel, level) => {
                return streak >= level.min ? level : currentLevel;
            }, prestigeLevels[0] || { min: 0, label: 'Sin racha', className: 'streak-empty' });
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
                message: 'Cada bloque de 100 días vuelve más fuerte tu historia.',
                className: getStreakPrestigeLevel(streak).className
            };
        }

        function getContributionLevel(count) {
            if (count >= 5) {
                return 4;
            }

            if (count >= 3) {
                return 3;
            }

            if (count >= 2) {
                return 2;
            }

            if (count >= 1) {
                return 1;
            }

            return 0;
        }

        function grantAchievement(achievementId, shouldAnimate) {
            const definition = definitions.find(item => item.id === achievementId);
            const achievement = definition ? resolveAchievement(definition) : null;

            if (!achievement) {
                return null;
            }

            const state = getAchievementState(achievementId);
            state.permanent = true;
            state.unlockedAt = state.unlockedAt || getTodayKey();
            state.pendingDate = null;
            state.pendingRepeatDate = null;
            state.pendingRepeatCount = 0;

            if (achievement.repeatable && state.repeatCount < 1) {
                state.repeatCount = 1;
            }

            markAchievementsUnseen([resolveAchievement(definition)]);
            saveGamification();
            renderCurrentPage();

            if (shouldAnimate) {
                queueAchievementShowcase([resolveAchievement(definition)]);
            }

            return resolveAchievement(definition);
        }

        function removeAchievement(achievementId) {
            delete getState().achievementStates[achievementId];
            getState().featuredAchievements = getState().featuredAchievements.filter(id => id !== achievementId);
            getState().unseenAchievementIds = getState().unseenAchievementIds.filter(id => id !== achievementId);
            saveGamification();
            renderCurrentPage();
        }

        function resetAchievements() {
            getState().achievementStates = {};
            getState().featuredAchievements = [];
            getState().unseenAchievementIds = [];
            saveGamification();
            renderCurrentPage();
        }

        function unlockAllAchievements(options) {
            const config = options || {};
            const todayKey = getTodayKey();

            definitions.forEach(definition => {
                const state = getAchievementState(definition.id);
                state.permanent = true;
                state.unlockedAt = state.unlockedAt || todayKey;
                state.pendingDate = null;
                state.pendingRepeatDate = null;
                state.pendingRepeatCount = 0;

                if (definition.repeatable && state.repeatCount < 1) {
                    state.repeatCount = 1;
                }
            });

            markAchievementsUnseen(getAllAchievements());

            saveGamification();
            renderCurrentPage();

            if (config.animate !== false) {
                queueAchievementShowcase(getAllAchievements());
            }
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
            getRarityMeta,
            getRarityRank,
            getRarityRankLabel,
            getCategoryMeta,
            getAchievementState,
            finalizePendingAchievements,
            forceFinalizePendingAchievements,
            resolveAchievement,
            getAllAchievements,
            getUnseenAchievements,
            markAchievementsUnseen,
            markAchievementsSeen,
            sortAchievements,
            getAchievementCollection,
            getFilteredAchievementCollection,
            syncAchievementCollection,
            getAutomaticFeaturedAchievements,
            getFeaturedAchievements,
            toggleFeaturedAchievement,
            featureAchievement,
            unfeatureAchievement,
            getStreakPrestigeLevel,
            getStreakPrestigeClassNames,
            getNextStreakReward,
            getContributionLevel,
            grantAchievement,
            removeAchievement,
            resetAchievements,
            unlockAllAchievements
        };
    }

    function fn(candidate, fallback) {
        return typeof candidate === 'function' ? candidate : fallback;
    }

    global.TasklyzenGamification = {
        createAchievementState,
        normalizeAchievementState,
        normalizeGamificationState,
        loadGamification,
        createGamificationController
    };
})(window);
