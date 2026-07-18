/*
 * Módulo: configuración estática
 * Propósito:
 * - Centralizar llaves, límites y catálogos visuales de Tasklyzen.
 * Entradas:
 * - Ninguna; solo constantes declarativas.
 * Salidas:
 * - window.TasklyzenConfig para el runtime principal.
 */
(function exposeTasklyzenConfig(global) {
    const storageKeys = {
        todos: 'todos',
        history: 'todo-completion-history',
        dailyGoal: 'todo-daily-goal',
        gamification: 'todo-gamification',
        developerSnapshot: 'todo-developer-snapshot',
        progressView: 'todo-progress-view',
        analyticsEvents: 'tasklyzen-analytics-events',
        dailyStats: 'tasklyzen-daily-stats',
        analyticsFlowPeriod: 'tasklyzen-analytics-flow-period',
        sustainableProgress: 'tasklyzen-sustainable-progress',
        features: 'tasklyzen-local-features',
        settings: 'tasklyzen-settings',
        experience: 'tasklyzen-experience-state',
        overdueReview: 'tasklyzen-overdue-review'
    };

    // Datos duraderos que pueden sincronizarse sin trasladar estado de interfaz
    // ni una sesion activa de Carrera a otro dispositivo.
    const cloudStorageKeys = Object.freeze([
        storageKeys.todos,
        storageKeys.history,
        storageKeys.dailyGoal,
        storageKeys.gamification,
        storageKeys.analyticsEvents,
        storageKeys.dailyStats,
        storageKeys.sustainableProgress,
        storageKeys.experience
    ]);

    // Estas claves no se suben. Algunas guardan interfaz, otras una sesion que
    // solo tiene sentido en el dispositivo que la inicio.
    const localOnlyStorageKeys = Object.freeze([
        storageKeys.developerSnapshot,
        storageKeys.progressView,
        storageKeys.analyticsFlowPeriod,
        storageKeys.features,
        storageKeys.settings,
        storageKeys.overdueReview,
        'tasklyzen-login-strategy'
    ]);

    // Todas estas claves se sincronizaron en versiones anteriores. No se usan
    // para nuevas escrituras, pero se pueden borrar de Firestore al eliminar
    // los datos del usuario.
    const cloudDeletionKeys = Object.freeze([
        storageKeys.todos,
        storageKeys.history,
        storageKeys.dailyGoal,
        storageKeys.gamification,
        storageKeys.developerSnapshot,
        storageKeys.progressView,
        storageKeys.analyticsEvents,
        storageKeys.dailyStats,
        storageKeys.analyticsFlowPeriod,
        storageKeys.sustainableProgress,
        storageKeys.features,
        storageKeys.settings,
        storageKeys.experience,
        storageKeys.overdueReview
    ]);

    const defaults = {
        dailyGoal: 3,
        developerStreakPrefix: 'Racha dev',
        developerStreakMaxDays: 5000,
        taskExpirationDays: 30,
        overdueReviewIntervalDays: 7,
        overdueAutoDeleteDays: 30,
        taskTimeLimitDefaultDays: 1,
        taskTimeLimitMaxDays: 3,
        taskDeadlineSoonHours: 12,
        taskTitleMaxLength: 96
    };

    const streakPrestigeLevels = [
        { min: 0, label: 'Sin racha', className: 'streak-empty', rewardTitle: 'Primer día encendido', rewardMessage: 'Completa una tarea hoy para estrenar tu racha.' },
        { min: 1, label: 'Encendida', className: 'streak-kindled', rewardTitle: 'Racha encendida', rewardMessage: 'El primer regreso ya separa intención de acción.' },
        { min: 3, label: 'Chispa estable', className: 'streak-spark', rewardTitle: 'Mini racha', rewardMessage: 'Tres días seguidos convierten la lista en hábito.' },
        { min: 7, label: 'Semana fuerte', className: 'streak-hot', rewardTitle: 'Semana fuerte', rewardMessage: 'Siete días seguidos desbloquean una racha caliente.' },
        { min: 14, label: 'Doble semana', className: 'streak-blaze', rewardTitle: 'Doble semana', rewardMessage: 'Catorce días dan una sensación real de constancia.' },
        { min: 30, label: 'Mes imparable', className: 'streak-comet', rewardTitle: 'Mes imparable', rewardMessage: 'Treinta días crean una marca difícil de abandonar.' },
        { min: 60, label: 'Forja seria', className: 'streak-forge', rewardTitle: 'Ritmo serio', rewardMessage: 'Sesenta días sostienen una rutina con peso propio.' },
        { min: 100, label: 'Mítica', className: 'streak-mythic', rewardTitle: 'Constancia brutal', rewardMessage: 'Cien días convierten el progreso en identidad.' },
        { min: 365, label: 'Inmortal', className: 'streak-immortal', rewardTitle: 'Año legendario', rewardMessage: 'Un año completo merece una marca histórica.' },
        { min: 500, label: 'Ascendente', className: 'streak-ascendant', rewardTitle: 'Quinientos días', rewardMessage: '500 días están por encima del año: ya no es casualidad, es dominio.' },
        { min: 730, label: 'Eterna', className: 'streak-eternal', rewardTitle: 'Dos años de fuego', rewardMessage: 'La constancia ya no es evento, es territorio.' },
        { min: 1000, label: 'Celestial', className: 'streak-celestial', rewardTitle: 'Mil días despierto', rewardMessage: 'Mil regresos convierten la app en ritual personal.' },
        { min: 1500, label: 'Leyenda viva', className: 'streak-transcendent', rewardTitle: 'Leyenda viva', rewardMessage: 'A este nivel la racha merece una presencia monumental.' }
    ];

    global.TasklyzenConfig = {
        storageKeys,
        cloudStorageKeys,
        localOnlyStorageKeys,
        cloudDeletionKeys,
        defaults,
        streakPrestigeLevels
    };
})(window);
