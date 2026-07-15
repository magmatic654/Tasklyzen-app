/*
 * Módulo: UI de rachas
 * Propósito: renderizar rachas, escudos, niveles y cuadrícula de progreso.
 * Entradas: DOM, estado calculado por el motor de rachas y utilidades de fecha.
 * Salidas: window.TasklyzenGamificationUi con createGamificationUiController.
 * Dependencias: TasklyzenUiComponents por inyección.
 */
(function exposeTasklyzenGamificationUi(global) {
    const PRESTIGE_CHAPTERS = ['Inicio', 'Disciplina', 'Prestigio', 'Legado'];

    function createGamificationUiController(options) {
        const config = options || {};
        const dom = config.dom || {};
        const documentRef = config.documentRef || global.document;
        const components = config.components || global.TasklyzenUiComponents;
        const windowRef = config.windowRef || global;
        const prestigeLevels = Array.isArray(config.prestigeLevels) ? config.prestigeLevels : [];
        const utils = config.utils || {};
        const getCurrentStreak = fn(config.getCurrentStreak, () => 0);
        const getPerfectStreak = fn(config.getPerfectStreak, () => 0);
        const getLegendaryStreak = fn(config.getLegendaryStreak, () => 0);
        const getActiveDaysTotal = fn(config.getActiveDaysTotal, () => 0);
        const getBestDayTotal = fn(config.getBestDayTotal, () => 0);
        const getLongestActiveStreak = fn(config.getLongestActiveStreak, () => 0);
        const getAvailableShields = fn(config.getAvailableShields, () => 0);
        const getRescueState = fn(config.getRescueState, () => ({}));
        const getStreakPrestigeLevel = fn(config.getStreakPrestigeLevel, () => prestigeLevels[0] || { className: 'streak-empty', label: 'Sin racha' });
        const getStreakPrestigeClassNames = fn(config.getStreakPrestigeClassNames, () => prestigeLevels.map(level => level.className));
        const getNextStreakReward = fn(config.getNextStreakReward, () => ({ target: 1, title: '', message: '', className: '' }));
        const getContributionLevel = fn(config.getContributionLevel, () => 0);
        const getHistoryCount = fn(config.getHistoryCount, () => 0);
        const isProtectedDate = fn(config.isProtectedDate, () => false);
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
        let contributionGridFrame = null;
        let contributionResizeObserver = null;
        let lastVisibleContributionWeeks = 12;

        function renderNextReward() {
            const streak = getCurrentStreak();
            const nextReward = getNextStreakReward(streak);
            const progress = Math.min((streak / nextReward.target) * 100, 100);
            const remaining = Math.max(nextReward.target - streak, 0);

            if (dom.nextRewardCard) {
                dom.nextRewardCard.classList.remove(...getStreakPrestigeClassNames());
                dom.nextRewardCard.classList.add(getStreakPrestigeLevel(streak).className);
            }

            setText(dom.rewardTitle, nextReward.title);
            setText(dom.rewardMessage, nextReward.message);
            setText(dom.rewardCount, streak + '/' + nextReward.target);

            if (dom.rewardBar) {
                dom.rewardBar.style.width = progress + '%';
            }

            if (dom.streakRemaining) {
                dom.streakRemaining.textContent = remaining === 0
                    ? 'Nivel alcanzado'
                    : 'Falta' + (remaining === 1 ? '' : 'n') + ' ' + remaining + ' día' + (remaining === 1 ? '' : 's');
            }

            const rewardTrack = dom.rewardBar && dom.rewardBar.parentElement;

            if (rewardTrack) {
                rewardTrack.setAttribute('aria-valuemax', String(nextReward.target));
                rewardTrack.setAttribute('aria-valuenow', String(Math.min(streak, nextReward.target)));
                rewardTrack.setAttribute('aria-valuetext', streak + ' de ' + nextReward.target + ' días');
            }
        }

        function renderStreakStats() {
            const streak = getCurrentStreak();
            const perfectStreak = getPerfectStreak();
            const legendaryStreak = getLegendaryStreak();
            const prestigeLevel = getStreakPrestigeLevel(streak);
            const todayKey = getTodayKey();
            const todayProtected = getHistoryCount(todayKey) > 0 || isProtectedDate(todayKey);
            const rescueState = getRescueState();
            let statusMessage = 'Completa una tarea hoy para empezar tu primera racha.';

            if (todayProtected) {
                statusMessage = 'Día protegido. Tu constancia ya cuenta hoy.';
            } else if (rescueState.waitingForToday) {
                statusMessage = 'Vuelve hoy para activar el rescate de tu racha anterior.';
            } else if (streak > 0) {
                statusMessage = 'Tu racha sigue viva. Completa una tarea hoy para llegar a ' + (streak + 1) + ' días.';
            }

            setText(dom.streakCount, streak);
            setText(dom.streakLabel, streak === 1 ? 'día seguido' : 'días seguidos');
            setText(dom.streakHeroCount, streak);
            setText(dom.streakHeroUnit, streak === 1 ? 'día' : 'días');
            setText(dom.streakHeroTier, prestigeLevel.label);
            setText(dom.streakHeroStatus, statusMessage);
            setText(dom.activeStreakTotal, streak);
            setText(dom.perfectStreakTotal, perfectStreak);
            setText(dom.legendaryStreakTotal, legendaryStreak);
            setText(dom.activeDaysTotal, getActiveDaysTotal());
            setText(dom.bestDayTotal, getBestDayTotal());
            setText(dom.recordStreakTotal, getLongestActiveStreak());
            setText(dom.shieldTotal, getAvailableShields());

            if (dom.streakPill) {
                dom.streakPill.classList.remove(...getStreakPrestigeClassNames());
                dom.streakPill.classList.toggle('streak-live', streak > 0);
                dom.streakPill.classList.add(prestigeLevel.className);
                dom.streakPill.dataset.prestige = prestigeLevel.label;
                dom.streakPill.setAttribute('aria-label', streak + ' ' + (streak === 1 ? 'día seguido' : 'días seguidos') + ', prestigio ' + prestigeLevel.label);
            }

            [dom.streakHeroCard, dom.streakHeroEmblem].forEach(element => {
                if (!element) return;
                element.classList.remove(...getStreakPrestigeClassNames());
                element.classList.add(prestigeLevel.className);
            });

            if (dom.streakHeroCard) {
                const streakDigits = String(Math.max(0, streak)).length;

                dom.streakHeroCard.classList.toggle('streak-count-long', streakDigits >= 3);
                dom.streakHeroCard.classList.toggle('streak-count-very-long', streakDigits >= 4);
                dom.streakHeroCard.dataset.streakDigits = String(streakDigits);
                dom.streakHeroCard.dataset.todayState = todayProtected ? 'protected' : streak > 0 ? 'pending' : 'empty';
                dom.streakHeroCard.setAttribute('aria-label', streak + ' ' + (streak === 1 ? 'día de racha' : 'días de racha') + '. ' + statusMessage);
            }

            setText(dom.streakTier, prestigeLevel.label);
        }

        function renderStreakPrestigeRoad() {
            if (!dom.streakPrestigeRoad) return;

            const streak = getCurrentStreak();
            const levels = prestigeLevels.filter(level => level.min > 0);
            const currentLevel = levels.reduce((current, level) => streak >= level.min ? level : current, null);
            const nextLevel = levels.find(level => streak < level.min) || null;

            dom.streakPrestigeRoad.innerHTML = '';

            PRESTIGE_CHAPTERS.forEach((title, chapterIndex) => {
                const chapterLevels = levels.slice(chapterIndex * 3, chapterIndex * 3 + 3);

                if (chapterLevels.length === 0) return;

                const steps = chapterLevels.map(level => {
                    const levelIndex = levels.indexOf(level);
                    const reached = streak >= level.min;
                    const state = currentLevel && level.min === currentLevel.min
                        ? 'current'
                        : reached
                            ? 'past'
                            : nextLevel && level.min === nextLevel.min ? 'next' : 'locked';

                    return components.createPrestigeStep({
                        documentRef,
                        level,
                        reached,
                        state,
                        quality: Math.min(Math.floor(levelIndex / 2) + 1, 6)
                    });
                });

                dom.streakPrestigeRoad.appendChild(components.createPrestigeChapter({
                    documentRef,
                    title,
                    range: chapterLevels[0].min + '–' + chapterLevels[chapterLevels.length - 1].min + ' días',
                    steps
                }));
            });

            if (dom.streakRouteSummary) {
                const reachedCount = levels.filter(level => streak >= level.min).length;
                dom.streakRouteSummary.textContent = currentLevel
                    ? 'Nivel ' + reachedCount + ' de ' + levels.length + ' · ' + currentLevel.label
                    : 'Tu primer nivel empieza en 1 día';
            }
        }

        function renderStreakSafety() {
            const rescueState = getRescueState();
            const availableShields = getAvailableShields();
            const shouldShowSafety = rescueState.eligible || rescueState.waitingForToday || availableShields > 0;

            if (dom.streakSafetyCard) dom.streakSafetyCard.hidden = !shouldShowSafety;
            if (dom.rescueButton) dom.rescueButton.disabled = !rescueState.eligible;
            if (!dom.shieldMessage) return;

            if (rescueState.eligible) {
                dom.shieldMessage.textContent = 'Ayer quedó vacío, pero hoy volviste. Puedes gastar 1 escudo para unir la racha.';
            } else if (rescueState.waitingForToday) {
                dom.shieldMessage.textContent = 'Completa una tarea hoy y podrás rescatar la racha de ayer con 1 escudo.';
            } else if (availableShields > 0) {
                dom.shieldMessage.textContent = 'Tienes ' + availableShields + ' escudo disponible para un día difícil.';
            } else {
                dom.shieldMessage.textContent = 'Gana 1 escudo por cada 5 días activos reales.';
            }
        }

        function isContributionGridMeasurable() {
            if (!dom.contributionGrid || !dom.contributionGrid.parentElement) return false;
            if (typeof dom.contributionGrid.closest === 'function' && dom.contributionGrid.closest('.progress-section-hidden')) return false;
            return dom.contributionGrid.parentElement.clientWidth > 0;
        }

        function getVisibleContributionWeeks() {
            const contributionViewport = dom.contributionGrid ? dom.contributionGrid.parentElement : null;
            const cellSize = 18;
            const cellGap = 6;
            const viewportPadding = 16;
            const viewportWidth = contributionViewport ? contributionViewport.clientWidth - viewportPadding : 0;

            if (!isContributionGridMeasurable() || viewportWidth <= 0) return lastVisibleContributionWeeks;

            const weeksThatFit = Math.floor((viewportWidth + cellGap) / (cellSize + cellGap));
            const visibleWeeks = Math.max(4, Math.min(53, weeksThatFit || lastVisibleContributionWeeks));
            lastVisibleContributionWeeks = visibleWeeks;
            return visibleWeeks;
        }

        function renderContributionGrid() {
            if (!dom.contributionGrid || !isContributionGridMeasurable()) return;

            const today = getStartOfDay(new Date());
            const endDate = addDays(today, 6 - today.getDay());
            const visibleWeeks = getVisibleContributionWeeks();
            const totalDays = visibleWeeks * 7;
            const startDate = addDays(endDate, -(totalDays - 1));
            const gridWidth = (visibleWeeks * 18) + (Math.max(visibleWeeks - 1, 0) * 6);

            dom.contributionGrid.innerHTML = '';
            dom.contributionGrid.style.setProperty('--visible-weeks', visibleWeeks);
            dom.contributionGrid.style.width = gridWidth + 'px';

            for (let index = 0; index < totalDays; index += 1) {
                const date = addDays(startDate, index);
                const dateKey = formatDateKey(date);
                const isFutureDate = date > today;
                const count = isFutureDate ? 0 : getHistoryCount(dateKey);
                const isShieldedDate = !isFutureDate && isProtectedDate(dateKey) && count === 0;
                const level = getContributionLevel(count);
                const taskText = count === 1 ? '1 tarea completada' : count + ' tareas completadas';

                dom.contributionGrid.appendChild(components.createContributionDay({
                    documentRef,
                    dateKey,
                    count,
                    level,
                    isShieldedDate,
                    isFutureDate,
                    isToday: dateKey === formatDateKey(today),
                    taskText
                }));
            }
        }

        function scheduleContributionGridRender() {
            if (!dom.contributionGrid) return;

            const requestFrame = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 16));
            const cancelFrame = windowRef.cancelAnimationFrame || windowRef.clearTimeout;

            if (contributionGridFrame) cancelFrame(contributionGridFrame);

            contributionGridFrame = requestFrame(() => {
                contributionGridFrame = requestFrame(() => {
                    contributionGridFrame = null;
                    renderContributionGrid();
                });
            });
        }

        function installContributionGridObserver() {
            if (!dom.contributionGrid || contributionResizeObserver || !windowRef.ResizeObserver) return;

            const contributionViewport = dom.contributionGrid.parentElement;
            if (!contributionViewport) return;

            contributionResizeObserver = new windowRef.ResizeObserver(scheduleContributionGridRender);
            contributionResizeObserver.observe(contributionViewport);
        }

        function setText(element, value) {
            if (element) element.textContent = value;
        }

        return {
            renderNextReward,
            renderStreakStats,
            renderStreakPrestigeRoad,
            renderStreakSafety,
            isContributionGridMeasurable,
            getVisibleContributionWeeks,
            renderContributionGrid,
            scheduleContributionGridRender,
            installContributionGridObserver
        };
    }

    function fn(candidate, fallback) {
        return typeof candidate === 'function' ? candidate : fallback;
    }

    global.TasklyzenGamificationUi = {
        createGamificationUiController
    };
})(window);
