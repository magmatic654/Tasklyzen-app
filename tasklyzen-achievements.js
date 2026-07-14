/*
 * Modulo: catalogo de logros
 * Proposito:
 * - Construir definiciones de logros sin mezclar el catalogo con el runtime.
 * Entradas:
 * - Callbacks de progreso calculados por el runtime.
 * Salidas:
 * - window.TasklyzenAchievements con fabrica de logros.
 * Dependencias:
 * - Ninguna.
 */
(function exposeTasklyzenAchievements(global) {
    const zero = () => 0;
    const one = () => 1;

    function createTieredAchievementSet(config) {
        return config.tiers.map(tier => ({
            id: tier.id || config.idPrefix + '-' + tier.target,
            title: tier.title,
            message: typeof tier.message === 'function' ? tier.message(tier.target) : tier.message,
            rarity: tier.rarity,
            type: config.type,
            mark: tier.mark || String(tier.target),
            current: config.current,
            target: () => tier.target,
            tiered: true,
            category: config.category || 'daily'
        }));
    }

    function createAchievementDefinitions(callbacks) {
        const progress = callbacks || {};
        const getTodayHistory = progress.getTodayHistory || zero;
        const getDailyGoal = progress.getDailyGoal || one;
        const getCleanDayProgress = progress.getCleanDayProgress || zero;
        const getCurrentStreak = progress.getCurrentStreak || zero;
        const getPerfectStreak = progress.getPerfectStreak || zero;
        const getLegendaryStreak = progress.getLegendaryStreak || zero;
        const getTotalCompletedTasks = progress.getTotalCompletedTasks || zero;
        const getBestDayTotal = progress.getBestDayTotal || zero;
        const getCompletedPriorityCount = progress.getCompletedPriorityCount || zero;
        const getEarnedShields = progress.getEarnedShields || zero;
        const getActiveDaysTotal = progress.getActiveDaysTotal || zero;
        const getUsedShields = progress.getUsedShields || zero;

        return [
            {
                id: 'first-spark',
                title: 'Primer impulso',
                message: 'Completa una tarea y enciende el día.',
                rarity: 'common',
                type: 'active',
                category: 'daily',
                mark: 'I',
                current: getTodayHistory,
                target: one
            },
            {
                id: 'daily-goal',
                title: 'Meta diaria',
                message: 'Cumple la meta que elegiste para hoy.',
                rarity: 'uncommon',
                type: 'perfect',
                category: 'daily',
                mark: 'M',
                current: getTodayHistory,
                target: getDailyGoal
            },
            {
                id: 'clean-day',
                title: 'Día limpio',
                message: 'Termina todas tus pendientes actuales.',
                rarity: 'common',
                type: 'clean',
                category: 'daily',
                mark: 'C',
                current: getCleanDayProgress,
                target: one
            },
            {
                id: 'legend-day',
                title: 'Día legendario',
                message: 'Haz una tarea extra por encima de tu meta.',
                rarity: 'rare',
                type: 'legendary',
                category: 'daily',
                mark: 'L',
                current: getTodayHistory,
                target: () => getDailyGoal() + 1
            },
            ...createTieredAchievementSet({
                idPrefix: 'active-streak',
                type: 'active',
                category: 'streak',
                current: getCurrentStreak,
                tiers: [
                    { id: 'mini-streak', target: 3, title: 'Mini racha', message: 'Suma 3 días activos seguidos.', rarity: 'uncommon', mark: '3' },
                    { id: 'week-streak', target: 7, title: 'Semana fuerte', message: 'Llega a 7 días activos seguidos.', rarity: 'rare', mark: '7' },
                    { target: 14, title: 'Doble semana', message: 'Mantén 14 días activos seguidos.', rarity: 'epic', mark: '14' },
                    { id: 'month-streak', target: 30, title: 'Mes imparable', message: 'Mantén 30 días activos seguidos.', rarity: 'legendary', mark: '30' },
                    { target: 60, title: 'Ritmo serio', message: 'Sostén 60 días activos sin soltar el hábito.', rarity: 'legendary', mark: '60' },
                    { target: 100, title: 'Constancia brutal', message: 'Convierte 100 días activos en identidad.', rarity: 'mythic', mark: '100' },
                    { id: 'year-path', target: 365, title: 'Año legendario', message: 'Alcanza 365 días activos seguidos.', rarity: 'mythic', mark: '365' },
                    { target: 500, title: 'Quinientos días', message: 'Supera el año y alcanza 500 días activos seguidos.', rarity: 'mythic', mark: '500' },
                    { target: 730, title: 'Dos años de fuego', message: 'Sostén 730 días activos seguidos.', rarity: 'mythic', mark: '730' },
                    { target: 1000, title: 'Mil días despierto', message: 'Llega a 1000 días activos seguidos.', rarity: 'mythic', mark: '1000' },
                    { target: 1500, title: 'Leyenda viva', message: 'Haz de 1500 días una marca casi imposible de soltar.', rarity: 'mythic', mark: '1500' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'perfect-streak',
                type: 'perfect',
                category: 'streak',
                current: getPerfectStreak,
                tiers: [
                    { id: 'perfect-three', target: 3, title: 'Racha perfecta', message: 'Cumple tu meta 3 días seguidos.', rarity: 'rare', mark: '3' },
                    { target: 7, title: 'Semana perfecta', message: 'Cumple tu meta 7 días seguidos.', rarity: 'epic', mark: '7' },
                    { target: 30, title: 'Mes perfecto', message: 'Cumple tu meta diaria durante 30 días seguidos.', rarity: 'legendary', mark: '30' },
                    { target: 100, title: 'Disciplina mítica', message: 'Cumple tu meta diaria durante 100 días seguidos.', rarity: 'mythic', mark: '100' },
                    { target: 365, title: 'Año perfecto', message: 'Cumple tu meta diaria durante 365 días seguidos.', rarity: 'mythic', mark: '365' },
                    { target: 730, title: 'Ritual eterno', message: 'Mantén dos años completos de meta diaria cumplida.', rarity: 'mythic', mark: '730' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'legendary-streak',
                type: 'legendary',
                category: 'streak',
                current: getLegendaryStreak,
                tiers: [
                    { id: 'legend-streak', target: 3, title: 'Modo leyenda', message: 'Supera tu meta 3 días seguidos.', rarity: 'epic', mark: '3' },
                    { target: 7, title: 'Semana leyenda', message: 'Supera tu meta 7 días seguidos.', rarity: 'legendary', mark: '7' },
                    { target: 30, title: 'Mes sobrehumano', message: 'Supera tu meta durante 30 días seguidos.', rarity: 'mythic', mark: '30' },
                    { target: 100, title: 'Cien días extra', message: 'Supera tu meta durante 100 días seguidos.', rarity: 'mythic', mark: '100' },
                    { target: 365, title: 'Año sobrehumano', message: 'Haz extras por encima de tu meta durante 365 días seguidos.', rarity: 'mythic', mark: '365' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'total-tasks',
                type: 'active',
                category: 'volume',
                current: getTotalCompletedTasks,
                tiers: [
                    { target: 5, title: 'Cinco pasos', message: 'Completa 5 tareas en total.', rarity: 'common', mark: '5' },
                    { target: 15, title: 'Quince victorias', message: 'Completa 15 tareas en total.', rarity: 'uncommon', mark: '15' },
                    { target: 40, title: 'Plan en marcha', message: 'Completa 40 tareas en total.', rarity: 'rare', mark: '40' },
                    { target: 100, title: 'Centena productiva', message: 'Completa 100 tareas en total.', rarity: 'epic', mark: '100' },
                    { target: 250, title: 'Maestría diaria', message: 'Completa 250 tareas en total.', rarity: 'legendary', mark: '250' },
                    { target: 500, title: 'Archivo mítico', message: 'Completa 500 tareas en total.', rarity: 'mythic', mark: '500' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'best-day',
                type: 'legendary',
                category: 'volume',
                current: getBestDayTotal,
                tiers: [
                    { target: 3, title: 'Día con ritmo', message: 'Completa 3 tareas en un solo día.', rarity: 'uncommon', mark: '3' },
                    { target: 5, title: 'Día potente', message: 'Completa 5 tareas en un solo día.', rarity: 'rare', mark: '5' },
                    { target: 8, title: 'Día imparable', message: 'Completa 8 tareas en un solo día.', rarity: 'epic', mark: '8' },
                    { target: 12, title: 'Día histórico', message: 'Completa 12 tareas en un solo día.', rarity: 'epic', mark: '12' },
                    { target: 20, title: 'Día mítico', message: 'Completa 20 tareas en un solo día.', rarity: 'legendary', mark: '20' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'urgent-master',
                type: 'urgent',
                category: 'priority',
                current: () => getCompletedPriorityCount('urgent'),
                tiers: [
                    { id: 'urgent-three', target: 3, title: 'Domador de urgencias', message: 'Completa 3 tareas urgentes.', rarity: 'uncommon', mark: 'U3' },
                    { target: 10, title: 'Control de incendios', message: 'Completa 10 tareas urgentes.', rarity: 'rare', mark: 'U10' },
                    { target: 25, title: 'Crisis bajo control', message: 'Completa 25 tareas urgentes.', rarity: 'epic', mark: 'U25' },
                    { target: 60, title: 'Calma en tormenta', message: 'Completa 60 tareas urgentes.', rarity: 'epic', mark: 'U60' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'important-builder',
                type: 'important',
                category: 'priority',
                current: () => getCompletedPriorityCount('important'),
                tiers: [
                    { id: 'important-five', target: 5, title: 'Constructor de progreso', message: 'Completa 5 tareas importantes.', rarity: 'uncommon', mark: 'P5' },
                    { target: 15, title: 'Arquitecto del avance', message: 'Completa 15 tareas importantes.', rarity: 'rare', mark: 'P15' },
                    { target: 40, title: 'Obra maestra diaria', message: 'Completa 40 tareas importantes.', rarity: 'epic', mark: 'P40' },
                    { target: 100, title: 'Proyecto monumental', message: 'Completa 100 tareas importantes.', rarity: 'legendary', mark: 'P100' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'shield-stack',
                type: 'shield',
                category: 'shields',
                current: getEarnedShields,
                tiers: [
                    { id: 'shield-earned', target: 1, title: 'Escudo ganado', message: 'Acumula 5 días activos reales.', rarity: 'uncommon', mark: 'E1' },
                    { target: 3, title: 'Reserva de calma', message: 'Gana 3 escudos de racha.', rarity: 'rare', mark: 'E3' },
                    { target: 7, title: 'Fortaleza de hábito', message: 'Gana 7 escudos de racha.', rarity: 'epic', mark: 'E7' },
                    { target: 15, title: 'Bunker de constancia', message: 'Gana 15 escudos de racha.', rarity: 'epic', mark: 'E15' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'active-days',
                type: 'active',
                category: 'streak',
                current: getActiveDaysTotal,
                tiers: [
                    { target: 5, title: 'Cinco días vivos', message: 'Registra tareas en 5 días distintos.', rarity: 'uncommon', mark: '5D' },
                    { target: 20, title: 'Veinte regresos', message: 'Registra tareas en 20 días distintos.', rarity: 'rare', mark: '20D' },
                    { target: 50, title: 'Ritual instalado', message: 'Registra tareas en 50 días distintos.', rarity: 'epic', mark: '50D' },
                    { target: 120, title: 'Temporada completa', message: 'Registra tareas en 120 días distintos.', rarity: 'legendary', mark: '120' },
                    { target: 365, title: 'Calendario completo', message: 'Registra tareas en 365 días distintos.', rarity: 'mythic', mark: '365' },
                    { target: 500, title: 'Quinientos regresos', message: 'Vuelve a completar tareas en 500 días distintos.', rarity: 'mythic', mark: '500' },
                    { target: 730, title: 'Doble calendario', message: 'Registra tareas en 730 días distintos.', rarity: 'mythic', mark: '730' },
                    { target: 1000, title: 'Mil regresos', message: 'Vuelve a la app en 1000 días distintos.', rarity: 'mythic', mark: '1000' }
                ]
            }),
            ...createTieredAchievementSet({
                idPrefix: 'rescue-master',
                type: 'shield',
                category: 'shields',
                current: getUsedShields,
                tiers: [
                    { target: 1, title: 'Regreso salvado', message: 'Usa un escudo para rescatar una racha.', rarity: 'uncommon', mark: 'S1' },
                    { target: 3, title: 'Experto en volver', message: 'Rescata tu racha 3 veces.', rarity: 'rare', mark: 'S3' },
                    { target: 7, title: 'Nada te saca', message: 'Rescata tu racha 7 veces.', rarity: 'epic', mark: 'S7' },
                    { target: 15, title: 'Regreso legendario', message: 'Rescata tu racha 15 veces.', rarity: 'epic', mark: 'S15' }
                ]
            })
        ];
    }

    global.TasklyzenAchievements = {
        createTieredAchievementSet,
        createAchievementDefinitions
    };
})(window);
