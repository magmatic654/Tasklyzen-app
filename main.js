/*
 * Módulo: runtime principal
 * Propósito:
 * - Coordinar tareas, analítica, rachas y modo desarrollador.
 * Entradas:
 * - TasklyzenConfig, TasklyzenStorage, TasklyzenUtils, TasklyzenTasks, TasklyzenDom y TasklyzenOOP.
 * Salidas:
 * - UI renderizada, persistencia local y API dev opcional.
 */
const TASKLYZEN_CONFIG = window.TasklyzenConfig;
const STORAGE_KEY = TASKLYZEN_CONFIG.storageKeys.todos;
const HISTORY_KEY = TASKLYZEN_CONFIG.storageKeys.history;
const DAILY_GOAL_KEY = TASKLYZEN_CONFIG.storageKeys.dailyGoal;
const GAMIFICATION_KEY = TASKLYZEN_CONFIG.storageKeys.gamification;
const DEVELOPER_SNAPSHOT_KEY = TASKLYZEN_CONFIG.storageKeys.developerSnapshot;
const PROGRESS_VIEW_KEY = TASKLYZEN_CONFIG.storageKeys.progressView;
const ANALYTICS_EVENT_LOG_KEY = TASKLYZEN_CONFIG.storageKeys.analyticsEvents;
const DAILY_STATS_KEY = TASKLYZEN_CONFIG.storageKeys.dailyStats;
const ANALYTICS_FLOW_PERIOD_KEY = TASKLYZEN_CONFIG.storageKeys.analyticsFlowPeriod;
const FEATURES_KEY = TASKLYZEN_CONFIG.storageKeys.features;
const SETTINGS_KEY = TASKLYZEN_CONFIG.storageKeys.settings;
const OVERDUE_REVIEW_KEY = TASKLYZEN_CONFIG.storageKeys.overdueReview;
const SUSTAINABLE_PROGRESS_KEY = TASKLYZEN_CONFIG.storageKeys.sustainableProgress;
const DEFAULT_DAILY_GOAL = TASKLYZEN_CONFIG.defaults.dailyGoal;
const TASK_EXPIRATION_DAYS = TASKLYZEN_CONFIG.defaults.taskExpirationDays;
const TASK_TIME_LIMIT_DEFAULT_DAYS = TASKLYZEN_CONFIG.defaults.taskTimeLimitDefaultDays;
const TASK_TIME_LIMIT_MAX_DAYS = TASKLYZEN_CONFIG.defaults.taskTimeLimitMaxDays;
const TASK_DEADLINE_SOON_HOURS = TASKLYZEN_CONFIG.defaults.taskDeadlineSoonHours;
const OVERDUE_REVIEW_INTERVAL_DAYS = TASKLYZEN_CONFIG.defaults.overdueReviewIntervalDays;
const OVERDUE_AUTO_DELETE_DAYS = TASKLYZEN_CONFIG.defaults.overdueAutoDeleteDays;
const STREAK_PRESTIGE_LEVELS = TASKLYZEN_CONFIG.streakPrestigeLevels;
const TASKLYZEN_STORAGE = window.TasklyzenStorage;
const TASKLYZEN_UI_COMPONENTS = window.TasklyzenUiComponents;
const TASKLYZEN_TASK_CREATION_UI = window.TasklyzenTaskCreationUi;
const TASKLYZEN_SETTINGS = window.TasklyzenSettings;
const TASKLYZEN_AUDIO = window.TasklyzenAudio;
const TASKLYZEN_NOTIFICATIONS = window.TasklyzenNotifications;
const TASKLYZEN_TASK_UI = window.TasklyzenTaskUi;
const TASKLYZEN_OVERDUE_REVIEW = window.TasklyzenOverdueReview || {
    createOverdueReviewController: () => ({
        init: () => {},
        reload: () => [],
        refresh: () => [],
        forceReview: () => [],
        closeDialog: () => {},
        keepTasks: () => {},
        requestDelete: () => {},
        confirmDelete: () => {},
        getState: () => ({ pending: false, taskIds: [] }),
        getPendingTasks: () => [],
        getAutoDeleteTasks: () => []
    })
};

const TASKLYZEN_ANALYTICS_PROGRESS = window.TasklyzenAnalyticsProgress;
const TASKLYZEN_GAMIFICATION = window.TasklyzenGamification;
const TASKLYZEN_GAMIFICATION_UI = window.TasklyzenGamificationUi;
const TASKLYZEN_SUSTAINABLE_PROGRESS = window.TasklyzenSustainableProgress;
const TASKLYZEN_FEATURES = window.TasklyzenFeatures;
const TASKLYZEN_DEVELOPER = window.TasklyzenDeveloper;
const TASKLYZEN_DOM = window.TasklyzenDom;
const {
    taskCreatePanel,
    taskCreateToggle,
    taskCreateClose,
    todoForm,
    settingsButton,
    settingsPanel,
    settingsCloseButton,
    settingsThemeInputs,
    settingsNotifications,
    settingsNotificationStatus,
    settingsNotificationStatusText,
    settingsNotificationPermission,
    settingsNotificationTest,
    settingsNotificationGuide,
    settingsSound,
    settingsSoundVolume,
    settingsSoundVolumeValue,
    settingsAnimations,
    settingsSimplifiedAnalytics,
    focusModeButton,
    settingsExportData,
    settingsImportData,
    settingsImportFile,
    settingsDeleteData,
    deleteDataDialog,
    deleteConfirmCode,
    deleteConfirmInput,
    cancelDeleteData,
    confirmDeleteData,
    todoInput,
    taskTypeInput,
    priorityInput,
    timeLimitInput,
    dueDateCompactSelect,
    habitInput,
    compositeTaskBuilder,
    compositeBuilderCount,
    compositeBuilderList,
    compositeBuilderError,
    subtaskDraftInput,
    subtaskDraftOptional,
    addSubtaskDraftButton,
    todoList,
    taskCount,
    taskSummary,
    taskToolbar,
    clearCompletedTasksButton,
    expiredTasksPanel,
    expiredTaskCount,
    expiredTaskSummary,
    expiredTaskList,
    nextActionCard,
    nextActionTitle,
    nextActionReason,
    nextActionCompleteButton,
    nextActionEditButton,
    toast,
    completionCelebration,
    completionTitle,
    overdueReviewDialog,
    progressPanel,
    compactProgressWidget,
    compactProgressButtons,
    compactProgressToggle,
    compactProgressMenu,
    compactProgressToday,
    compactProgressTodayBar,
    compactProgressTodayItem,
    compactProgressTodayNote,
    compactProgressTodayStatus,
    compactProgressMissionItem,
    compactProgressMissionTitle,
    compactProgressMissionNote,
    compactProgressMissionStatus,
    compactProgressStreakChip,
    compactProgressStreakMenuItem,
    compactProgressStreak,
    compactProgressStreakNote,
    compactProgressStreakStatus,
    compactProgressWeek,
    compactProgressWeekItem,
    compactProgressWeekNote,
    compactProgressWeekStatus,
    progressToggle,
    progressDetailLayer,
    progressHeadingKicker,
    progressHeadingTitle,
    streakPill,
    streakCount,
    streakLabel,
    streakTier,
    streakPrestigeRoad,
    streakRouteSummary,
    streakHeroCard,
    streakHeroEmblem,
    streakHeroCount,
    streakHeroUnit,
    streakHeroTier,
    streakHeroStatus,
    streakRemaining,
    progressTabs,
    progressTabButtons,
    progressSections,
    motivationTitle,
    motivationMessage,
    dailyGoalCount,
    dailyGoalBar,
    dailyGoalInput,
    dailyMissionCard,
    dailyMissionTitle,
    dailyMissionMessage,
    dailyMissionStatus,
    dailyCloseCard,
    dailyCloseTitle,
    dailyCloseSummary,
    recommendedGoalText,
    applyRecommendedGoalButton,
    analyticsPeriodControl,
    analyticsPeriodButtons,
    analyticsCompletionRate,
    analyticsCompletionDetail,
    analyticsPeriodComparison,
    analyticsCompletionBar,
    analyticsProgressBar,
    streakRiskCard,
    streakRiskLevel,
    streakRiskTitle,
    streakRiskMessage,
    analyticsActionTitle,
    analyticsActionMessage,
    analyticsBalanceLabel,
    analyticsBalanceTrack,
    analyticsBalanceCompleted,
    analyticsBalancePending,
    analyticsActiveDays,
    analyticsBestRhythm,
    analyticsBestRhythmDetail,
    analyticsHabitDetail,
    analyticsHabitRate,
    analyticsHabitCount,
    analyticsInsights,
    analyticsRings,
    analyticsClarityBoard,
    weeklyFlowChart,
    backlogHealthCard,
    backlogHealthLevel,
    backlogHealthTitle,
    backlogHealthMessage,
    taskFunnel,
    consistencyStrip,
    activeStreakTotal,
    perfectStreakTotal,
    legendaryStreakTotal,
    activeDaysTotal,
    bestDayTotal,
    recordStreakTotal,
    shieldTotal,
    shieldMessage,
    streakSafetyCard,
    rescueButton,
    rewardTitle,
    rewardMessage,
    rewardCount,
    rewardBar,
    nextRewardCard,
    streakDayCelebration,
    streakCelebrationCard,
    streakCelebrationEmblem,
    streakCelebrationKicker,
    streakCelebrationTitle,
    streakCelebrationMessage,
    contributionGrid
} = TASKLYZEN_DOM;
const TASKLYZEN_UTILS = window.TasklyzenUtils;
const {
    isDateKey,
    getStartOfDay,
    formatDateKey,
    addDays,
    getTodayKey,
    getTomorrowKey,
    getNowTimestamp,
    createTimestampFromDateKey,
    normalizeTimestamp,
    getDateKeyFromTimestamp,
    getHourFromTimestamp,
    getHoursBetween,
    getDaysSince,
    getDateKeyByOffset,
    formatMetricNumber,
    formatDurationHours
} = TASKLYZEN_UTILS;
const TASKLYZEN_TASKS = window.TasklyzenTasks;
const TASKLYZEN_COMPOSITE_TASKS = window.TasklyzenCompositeTasks;
const TASKLYZEN_OOP = window.TasklyzenOOP;
const {
    TaskManager,
    TaskState,
    AnalyticsEngine,
    UIController
} = TASKLYZEN_OOP;
const {
    normalizeTaskTimeLimit,
    normalizeTaskDueDate,
    getLegacyDueDate,
    getTaskDueDate,
    createTodo,
    getTodoAgeDays,
    getTodoOperationalAgeDays
} = TASKLYZEN_TASKS;
const taskState = new TaskState({ taskApi: TASKLYZEN_TASKS });
const taskManager = new TaskManager({
    taskApi: TASKLYZEN_TASKS,
    utils: TASKLYZEN_UTILS,
    taskState
});
const analyticsEngine = new AnalyticsEngine({ utils: TASKLYZEN_UTILS });
const uiController = new UIController({ dom: TASKLYZEN_DOM });
const isTodoExpired = todo => taskState.isExpired(todo);
const isCompletedTodoCleanable = todo => taskState.isCleanable(todo);
const getTodoDeadlineInfo = todo => taskState.getDeadlineInfo(todo);
const getTodoDeadlineState = todo => taskState.getDeadlineState(todo);
const getTodoUrgencyState = todo => taskState.getUrgencyState(todo);
const isTodoSnoozedForToday = todo => taskState.isSnoozedForToday(todo);
const isTodoDeadlineLate = todo => taskState.isLate(todo);
const isTodoAvailableToday = todo => taskState.isAvailableToday(todo);
window.TasklyzenRuntime = {
    taskState,
    taskManager,
    analyticsEngine,
    uiController
};

const settingsController = TASKLYZEN_SETTINGS.createSettingsController({
    storage: TASKLYZEN_STORAGE,
    storageKey: SETTINGS_KEY,
    storageKeys: TASKLYZEN_CONFIG.storageKeys,
    dom: TASKLYZEN_DOM,
    getNowTimestamp,
    getTodayKey,
    showToast,
    render: renderCurrentPage,
    syncNotifications: syncNotificationControls,
    onChange: settings => {
        appSettings = settings;
    },
    onPanelToggle: handleSettingsPanelToggle,
    onAfterImport: restoreRuntimeFromStorage,
    onAfterDelete: resetRuntimeAfterDataDeletion
});
const TASK_STATE_REFRESH_MIN_DELAY_MS = 1000;
const TASK_STATE_REFRESH_MAX_DELAY_MS = 30 * 60 * 1000;
const TASK_STATE_REFRESH_EDIT_RETRY_MS = 30 * 1000;
const TASK_STATE_REFRESH_BUFFER_MS = 1500;

let todos = loadTodoList();
let analyticsEvents = loadAnalyticsEvents();
let completionHistory = buildCompletionHistory(todos, analyticsEvents);
let gamification = loadGamification();
let dailyStats = loadDailyStats();
let appSettings = settingsController.load();
const audioController = TASKLYZEN_AUDIO.createAudioController({
    windowRef: window,
    getSettings: () => appSettings
});
let dailyGoal = loadDailyGoal();
let activeProgressView = loadProgressView();
let activeFlowPeriod = loadAnalyticsFlowPeriod();
let celebrationTimer;
let streakCelebrationTimer;
let taskStateRefreshTimer = null;
let analyticsDataStale = true;
let progressDashboardHydrated = !todoForm;
let progressHydrationScheduled = false;
let progressHydrationObserver = null;
let progressPanelExpanded = false;
let lastCompactMissionSnapshot = null;
let lastCompactStreakTodayState = null;
let progressPanelDragStartY = 0;
let progressPanelDragPointerId = null;
let progressPanelDragLastY = 0;
let progressPanelDragCaptureTarget = null;
let progressPanelCloseTimer = null;
let deferredStartupScheduled = false;
let browserReminderIntervalId = null;
let contributionGridObserverReady = false;
let compositeDraftSubtasks = [];
let pendingCompositeDraftDiscard = false;
const notificationController = TASKLYZEN_NOTIFICATIONS.createNotificationController({
    dom: TASKLYZEN_DOM,
    components: TASKLYZEN_UI_COMPONENTS,
    compositeTasks: TASKLYZEN_COMPOSITE_TASKS,
    getSettings: () => appSettings,
    getTodos: () => todos,
    getTodayKey,
    getTopPriorityTodo,
    getDeadlineState: getTodoDeadlineState,
    isDeadlineLate: isTodoDeadlineLate,
    isAvailableToday: isTodoAvailableToday,
    hasTaskSurface: () => Boolean(todoForm),
    setNotificationsEnabled: enabled => settingsController.handleNotificationsChange({
        target: {
            checked: enabled
        }
    })
});
const taskUiController = TASKLYZEN_TASK_UI.createTaskUiController({
    dom: TASKLYZEN_DOM,
    documentRef: document,
    uiController,
    components: TASKLYZEN_UI_COMPONENTS,
    getTodos: () => todos,
    getDailyGoal: () => dailyGoal,
    getTodayKey,
    getHistoryCount,
    getTopPriorityTodo,
    getDateLabel,
    getStartOfDay,
    formatDateKey,
    getTaskDueDate,
    getTodoDeadlineInfo,
    getTodoUrgencyState,
    isTodoSnoozedForToday,
    isTodoDeadlineLate,
    isTodoAvailableToday,
    isCompletedTodoCleanable,
    onToggleTodo: toggleTodoItem,
    onEditTodo: editTodoItem,
    onSaveEdit: saveEditedTodoItem,
    onCancelEdit: cancelEditTodoItem,
    onDeleteTodo: removeTodoItem,
    onClearCompleted: clearCompletedTodos,
    onCompositeInfo: todoId => taskUiController.setExpandedTodo(todoId, true, true),
    onAddSubtask: addSubtaskToTodo,
    onToggleSubtask: toggleTodoSubtask,
    onSaveSubtaskEdit: saveTodoSubtaskEdit,
    onRequestSubtaskDelete: getSubtaskDeleteRequest,
    onDeleteSubtask: deleteTodoSubtask,
    onMoveSubtask: moveTodoSubtask,
    onConvertToNormal: convertCompositeTodoToNormal,
    showCriticalError: message => showToast(message, 'error', {
        critical: true,
        key: 'task-update-error',
        dedupeMs: 1200
    }),
    scheduleRefresh: scheduleTaskStateRefresh
});
window.TasklyzenRuntime.taskUiController = taskUiController;
const overdueReviewController = TASKLYZEN_OVERDUE_REVIEW.createOverdueReviewController({
    storage: TASKLYZEN_STORAGE,
    storageKey: OVERDUE_REVIEW_KEY,
    dom: TASKLYZEN_DOM,
    components: TASKLYZEN_UI_COMPONENTS,
    taskApi: TASKLYZEN_TASKS,
    intervalDays: OVERDUE_REVIEW_INTERVAL_DAYS,
    autoDeleteDays: OVERDUE_AUTO_DELETE_DAYS,
    getTodos: () => todos,
    isProtectedTask: isDeveloperStatePreviewTodo,
    onKeep: () => showToast('Las tareas vencidas se conservaron. Volveremos a preguntarte dentro de 7 d\u00edas.', 'info', {
        critical: true,
        key: 'overdue-review-kept'
    }),
    onDelete: tasks => removeOverdueTasks(tasks, 'task_deleted'),
    onAfterDelete: tasks => {
        showToast('Se eliminaron ' + tasks.length + ' ' + (tasks.length === 1 ? 'tarea vencida.' : 'tareas vencidas.'), 'info', {
            critical: true,
            key: 'overdue-review-deleted'
        });
        renderCurrentPage();
    },
    onError: message => showToast(message, 'error', {
        critical: true,
        key: 'overdue-review-error'
    })
});
window.TasklyzenRuntime.overdueReviewController = overdueReviewController;

const sustainableProgressController = TASKLYZEN_SUSTAINABLE_PROGRESS.createSustainableProgressController({
    storage: TASKLYZEN_STORAGE,
    storageKey: SUSTAINABLE_PROGRESS_KEY,
    getNowTimestamp,
    getTodayKey,
    getDateKeyFromTimestamp,
    getDailyGoal: () => dailyGoal
});
window.TasklyzenRuntime.sustainableProgressController = sustainableProgressController;

const gamificationController = TASKLYZEN_GAMIFICATION.createGamificationController({
    prestigeLevels: STREAK_PRESTIGE_LEVELS,
    utils: TASKLYZEN_UTILS,
    getGamification: () => gamification,
    setGamification: value => {
        gamification = value;
    },
    saveGamification,
    getCompletionHistory: () => completionHistory,
    getDailyGoal: () => dailyGoal,
    getMeaningfulDay: dateKey => sustainableProgressController.getDaySnapshot(dateKey),
    getMeaningfulDateKeys: () => sustainableProgressController.getDateKeys(),
    renderCurrentPage
});
window.TasklyzenRuntime.gamificationController = gamificationController;
const gamificationUiController = TASKLYZEN_GAMIFICATION_UI.createGamificationUiController({
    dom: TASKLYZEN_DOM,
    documentRef: document,
    components: TASKLYZEN_UI_COMPONENTS,
    windowRef: window,
    prestigeLevels: STREAK_PRESTIGE_LEVELS,
    utils: TASKLYZEN_UTILS,
    getCurrentStreak,
    getPerfectStreak,
    getLegendaryStreak,
    getActiveDaysTotal,
    getBestDayTotal,
    getLongestActiveStreak,
    getAvailableShields,
    getRescueState,
    getStreakPrestigeLevel,
    getStreakPrestigeClassNames,
    getNextStreakReward,
    getContributionLevel,
    getHistoryCount,
    isProtectedDate
});
window.TasklyzenRuntime.gamificationUiController = gamificationUiController;
const analyticsProgressController = TASKLYZEN_ANALYTICS_PROGRESS.createAnalyticsProgressController({
    dom: TASKLYZEN_DOM,
    documentRef: document,
    components: TASKLYZEN_UI_COMPONENTS,
    analyticsEngine,
    storage: TASKLYZEN_STORAGE,
    storageKeys: TASKLYZEN_CONFIG.storageKeys,
    defaults: TASKLYZEN_CONFIG.defaults,
    utils: TASKLYZEN_UTILS,
    getTodos: () => todos,
    getDailyStats: () => ensureAnalyticsDataFresh(),
    getDailyGoal: () => dailyGoal,
    setDailyGoal: value => {
        dailyGoal = value;
    },
    getCompletionHistory: () => completionHistory,
    getAnalyticsEvents: () => analyticsEvents,
    setAnalyticsEvents: value => {
        analyticsEvents = value;
    },
    getActiveProgressView: () => activeProgressView,
    setActiveProgressView: value => {
        activeProgressView = value;
    },
    getActiveFlowPeriod: () => activeFlowPeriod,
    setActiveFlowPeriod: value => {
        activeFlowPeriod = value;
    },
    getHistoryCount,
    getTaskStats,
    getTopPriorityTodo,
    getNextActionReason,
    getPriorityLabel,
    getPriorityRank,
    getLifecycleAnalyticsForRange,
    getRescueState,
    getCurrentStreak,
    getStreakBeforeToday,
    getTotalCompletedTasks,
    getCompletedPriorityCount,
    getTodayCompletedPriorityCount,
    getTodayCompletedHabitCount,
    getSustainableMissionSnapshot: dateKey => sustainableProgressController.getMissionSnapshot(dateKey),
    getTodoDeadlineState,
    isTodoAvailableToday,
    isProtectedDate,
    getContributionLevel,
    renderStreakStats,
    renderStreakPrestigeRoad,
    renderStreakSafety,
    renderNextReward,
    showToast,
    saveDailyGoal,
    logAnalyticsEvent,
    scheduleContributionGridRender
});
window.TasklyzenRuntime.analyticsProgressController = analyticsProgressController;
const featureRegistry = TASKLYZEN_FEATURES.createFeatureRegistry({
    storage: TASKLYZEN_STORAGE,
    storageKey: FEATURES_KEY,
    definitions: TASKLYZEN_FEATURES.plannedLocalFeatures,
    getContext: getLocalFeatureContext
});
window.TasklyzenRuntime.featureRegistry = featureRegistry;
const betaFeatureControllers = TASKLYZEN_FEATURES.createBetaFeatureControllers({
    registry: featureRegistry,
    documentRef: document,
    windowRef: window,
    getTodos: () => todos.slice(),
    getCompletionHistory: () => completionHistory,
    getDailyGoal: () => dailyGoal,
    getTopPriorityTodo,
    getNowTimestamp,
    getStartOfDay,
    addDays,
    formatDateKey,
    onCompleteTodo: completeTodoFromFeature,
    onToggleSubtask: toggleSubtaskFromFeature,
    onSessionComplete: handleFocusSessionComplete,
    evaluateSession: record => sustainableProgressController.evaluateSession(record),
    onStateChange: renderRaceModeButton,
    onTimerCue: type => audioController.playRaceCue(type),
    unlockAudio: () => audioController.unlock(),
    analyticsDom: {
        card: TASKLYZEN_DOM.analytics.raceAnalyticsSummary,
        minutes: TASKLYZEN_DOM.analytics.raceAnalyticsMinutes,
        sessions: TASKLYZEN_DOM.analytics.raceAnalyticsSessions,
        targets: TASKLYZEN_DOM.analytics.raceAnalyticsTargets
    },
    alwaysEnabled: true
});
window.TasklyzenRuntime.beta = betaFeatureControllers;
let developerController = null;

function getDeveloperController() {
    if (developerController) {
        return developerController;
    }

    developerController = TASKLYZEN_DEVELOPER.createDeveloperModeController({
        documentRef: document,
        windowRef: window,
        storage: TASKLYZEN_STORAGE,
        snapshotKey: DEVELOPER_SNAPSHOT_KEY,
        defaults: {
            dailyGoal: DEFAULT_DAILY_GOAL,
            developerStreakPrefix: TASKLYZEN_CONFIG.defaults.developerStreakPrefix,
            developerStreakMaxDays: TASKLYZEN_CONFIG.defaults.developerStreakMaxDays,
            overdueReviewIntervalDays: OVERDUE_REVIEW_INTERVAL_DAYS,
            overdueAutoDeleteDays: OVERDUE_AUTO_DELETE_DAYS
        },
        taskDefaults: {
            expirationDays: TASK_EXPIRATION_DAYS,
            defaultDays: TASK_TIME_LIMIT_DEFAULT_DAYS,
            maxDays: TASK_TIME_LIMIT_MAX_DAYS,
            soonHours: TASK_DEADLINE_SOON_HOURS
        },
        getTodos: () => todos,
        setTodos: value => {
            todos = Array.isArray(value) ? value : [];
        },
        getCompletionHistory: () => completionHistory,
        setCompletionHistory: value => {
            completionHistory = value && typeof value === 'object' ? value : {};
        },
        getDailyGoal: () => dailyGoal,
        setDailyGoal: value => {
            dailyGoal = value;
        },
        getGamification: () => gamification,
        setGamification: value => {
            gamification = value;
        },
        getAnalyticsSnapshot,
        getDailyMission,
        getCurrentStreak,
        getPerfectStreak,
        getLegendaryStreak,
        getHistoryCount,
        getPriorityLabel,
        isTodoSnoozedForToday,
        createTodo,
        addTodoItem,
        removeTodoItem,
        reactivateTodoForToday,
        createNextHabitOccurrence,
        removeNextHabitOccurrence,
        updateDailyGoal,
        showCompletionAnimation,
        showStreakDayCelebration,
        previewRaceState: state => {
            if (!todos.some(todo => todo && !todo.completed)) {
                addTodoItem('Sesión de prueba de Modo Carrera', 'normal');
            }

            return betaFeatureControllers.focus.previewForDeveloper(state);
        },
        getSustainableProgress: () => sustainableProgressController.getSnapshot(),
        replaceSustainableProgress: value => sustainableProgressController.replace(value),
        clearSustainableProgress: () => sustainableProgressController.clear(),
        recordSustainableTaskCompletion: todo => sustainableProgressController.recordTaskCompletion(todo, {
            dateKey: getCompletionDateKey(todo) || getTodayKey(),
            completedAt: todo && todo.completedAt,
            source: 'developer'
        }),
        simulateSustainableSession: simulateSustainableSessionForDev,
        playRaceCue: cue => {
            audioController.unlock();
            return audioController.playRaceCue(cue);
        },
        enableAppSound: () => {
            audioController.unlock();
            settingsController.update({
                sound: true,
                soundVolume: appSettings.soundVolume > 0 ? appSettings.soundVolume : 0.6
            }, 'Sonido activado para las demos de Modo Carrera.');
            return true;
        },
        showToast,
        saveTodoList,
        saveCompletionHistory,
        saveDailyGoal,
        saveGamification,
        syncCompletionHistory,
        renderCurrentPage,
        taskUiController,
        gamificationController,
        normalizeGamification,
        normalizeStoredTodoText,
        normalizeTaskTimeLimit,
        normalizeTaskDueDate,
        normalizeTimestamp,
        getStartOfDay,
        addDays,
        formatDateKey,
        getTodayKey,
        getNowTimestamp,
        createTimestampFromDateKey,
        getDateKeyFromTimestamp,
        getStreakPill: () => streakPill,
        taskApi: TASKLYZEN_TASKS,
        overdueReviewApi: TASKLYZEN_OVERDUE_REVIEW,
        overdueReviewController,
        processOverdueRetention
    });
    window.TasklyzenRuntime.developerController = developerController;

    return developerController;
}

settingsController.apply(false);
settingsController.syncControls();
normalizeGamification();
overdueReviewController.init();
processOverdueRetention(true);
if (!todoForm) {
    saveCompletionHistory();
    saveGamification();
    syncAnalyticsData();
}
TASKLYZEN_STORAGE.subscribe([
    STORAGE_KEY,
    HISTORY_KEY,
    DAILY_GOAL_KEY,
    GAMIFICATION_KEY,
    PROGRESS_VIEW_KEY,
    ANALYTICS_EVENT_LOG_KEY,
    DAILY_STATS_KEY,
    ANALYTICS_FLOW_PERIOD_KEY,
    FEATURES_KEY,
    SETTINGS_KEY,
    OVERDUE_REVIEW_KEY,
    SUSTAINABLE_PROGRESS_KEY
], handleExternalStorageChange);

function saveTodoList() {
    TASKLYZEN_STORAGE.writeJson(STORAGE_KEY, todos);
    if (Array.isArray(analyticsEvents)) {
        syncAnalyticsData();
    }
}

function saveCompletionHistory() {
    TASKLYZEN_STORAGE.writeJson(HISTORY_KEY, completionHistory);
}

function saveDailyGoal() {
    TASKLYZEN_STORAGE.writeText(DAILY_GOAL_KEY, dailyGoal);
}

function saveGamification() {
    TASKLYZEN_STORAGE.writeJson(GAMIFICATION_KEY, gamification);
}

function saveAnalyticsEvents() {
    TASKLYZEN_STORAGE.writeJson(ANALYTICS_EVENT_LOG_KEY, analyticsEvents);
}

function saveDailyStats() {
    TASKLYZEN_STORAGE.writeJson(DAILY_STATS_KEY, dailyStats);
}

function loadDailyStats() {
    const savedStats = TASKLYZEN_STORAGE.readJson(DAILY_STATS_KEY, {});

    return savedStats && typeof savedStats === 'object' && !Array.isArray(savedStats) ? savedStats : {};
}

function markAnalyticsDataStale() {
    analyticsDataStale = true;
}

function ensureAnalyticsDataFresh() {
    if (analyticsDataStale) {
        syncAnalyticsData();
    }

    return dailyStats;
}

function normalizeAnalyticsFlowPeriod(value) {
    return TASKLYZEN_ANALYTICS_PROGRESS.normalizeFlowPeriod(value);
}

function loadAnalyticsFlowPeriod() {
    return normalizeAnalyticsFlowPeriod(TASKLYZEN_STORAGE.readText(ANALYTICS_FLOW_PERIOD_KEY, null));
}

function saveAnalyticsFlowPeriod() {
    analyticsProgressController.saveFlowPeriod();
}

function restoreRuntimeFromStorage() {
    todos = loadTodoList();
    analyticsEvents = loadAnalyticsEvents();
    completionHistory = buildCompletionHistory(todos, analyticsEvents);
    gamification = loadGamification();
    dailyStats = loadDailyStats();
    markAnalyticsDataStale();
    dailyGoal = loadDailyGoal();
    activeProgressView = loadProgressView();
    activeFlowPeriod = loadAnalyticsFlowPeriod();
    appSettings = settingsController.load();
    taskUiController.clearEditingTodo(false);
    notificationController.resetExternalState();
    settingsController.apply(false);
    settingsController.syncControls();
    sustainableProgressController.reload();
    featureRegistry.reload();
    syncRaceHistoryIntoSustainableProgress();
    normalizeGamification();
    overdueReviewController.reload({ refresh: false });
    processOverdueRetention(false);
    renderCurrentPage();
}

function resetRuntimeAfterDataDeletion() {
    todos = loadTodoList();
    analyticsEvents = loadAnalyticsEvents();
    completionHistory = buildCompletionHistory(todos, analyticsEvents);
    gamification = loadGamification();
    dailyStats = loadDailyStats();
    markAnalyticsDataStale();
    dailyGoal = loadDailyGoal();
    activeProgressView = loadProgressView();
    activeFlowPeriod = loadAnalyticsFlowPeriod();
    appSettings = settingsController.load();
    taskUiController.clearEditingTodo(false);
    taskUiController.setFilter('pending', false);
    notificationController.resetExternalState();
    settingsController.apply(false);
    settingsController.syncControls();
    sustainableProgressController.reload();
    featureRegistry.reload();
    overdueReviewController.reload({ refresh: false });
    renderCurrentPage();
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

function getMutableDailyStat(stats, dateKey) {
    if (!stats[dateKey]) {
        stats[dateKey] = createEmptyDailyStat(dateKey);
    }

    return stats[dateKey];
}

function loadAnalyticsEvents() {
    const savedEvents = TASKLYZEN_STORAGE.readJson(ANALYTICS_EVENT_LOG_KEY, []);

    if (!Array.isArray(savedEvents)) {
        return [];
    }

    return savedEvents
        .filter(event => event && typeof event.type === 'string')
        .map(event => {
            const timestamp = normalizeTimestamp(event.timestamp, event.dateKey);

            return {
                ...event,
                id: typeof event.id === 'string' ? event.id : 'event-' + Date.now() + '-' + Math.random().toString(16).slice(2),
                timestamp,
                dateKey: isDateKey(event.dateKey) ? event.dateKey : getDateKeyFromTimestamp(timestamp)
            };
        })
        .slice(-1500);
}

function buildDailyStats(todoItems, events) {
    const stats = {};
    const sourceEvents = Array.isArray(events) ? events : [];
    const lifecycleRecords = getTaskLifecycleRecords(todoItems, sourceEvents);
    const eventTodoIds = new Set(sourceEvents.map(event => event && event.todoId).filter(Boolean));

    lifecycleRecords.forEach(record => {
        const isDraftDeleted = isLifecycleDeletedBeforeAnalyticsLock(record);

        if (isDraftDeleted) {
            return;
        }

        if (isDateKey(record.createdOn)) {
            const createdStat = getMutableDailyStat(stats, record.createdOn);

            createdStat.created += 1;
        }

        if (isDateKey(record.completedOn) && (record.completed || record.deletedWasCompleted)) {
            const completedStat = getMutableDailyStat(stats, record.completedOn);
            const priority = record.priority || 'normal';

            completedStat.completed += 1;
            completedStat.completionValue += Math.max(Math.round(Number(record.completionValue) || 1), 1);

            if (record.habit) {
                completedStat.habitsCompleted += 1;
            } else {
                completedStat.tasksCompleted += 1;
            }

            if (priority === 'urgent') {
                completedStat.urgentCompleted += 1;
            } else if (priority === 'important') {
                completedStat.importantCompleted += 1;
            } else {
                completedStat.normalCompleted += 1;
            }
        }

        if (isDateKey(record.deletedOn) && !record.deletedWasCompleted) {
            const deletedStat = getMutableDailyStat(stats, record.deletedOn);

            deletedStat.deleted += 1;
        }
    });

    sourceEvents.forEach(event => {
        const stat = getMutableDailyStat(stats, isDateKey(event.dateKey) ? event.dateKey : getDateKeyFromTimestamp(event.timestamp));

        stat.usageEvents += 1;

        if (event.type === 'task_reactivated') {
            stat.reactivated += 1;
        } else if (event.type === 'task_edited') {
            stat.edited += 1;
        } else if (event.type === 'task_snoozed') {
            stat.snoozed += 1;
        } else if (event.type === 'goal_changed') {
            stat.goalChanges += 1;
        }
    });

    todoItems.forEach(todo => {
        if (eventTodoIds.has(todo.id)) {
            return;
        }

        if (isDateKey(todo.createdOn)) {
            getMutableDailyStat(stats, todo.createdOn).usageEvents += 1;
        }

        if (todo.completed && isDateKey(todo.completedOn)) {
            const completedStat = getMutableDailyStat(stats, todo.completedOn);

            completedStat.usageEvents += 1;
        }
    });

    return stats;
}

function syncAnalyticsData() {
    dailyStats = buildDailyStats(todos, analyticsEvents);
    analyticsDataStale = false;
    saveDailyStats();
}

function handleExternalStorageChange() {
    todos = loadTodoList();
    analyticsEvents = loadAnalyticsEvents();
    completionHistory = buildCompletionHistory(todos, analyticsEvents);
    gamification = loadGamification();
    dailyStats = loadDailyStats();
    markAnalyticsDataStale();
    dailyGoal = loadDailyGoal();
    activeProgressView = loadProgressView();
    activeFlowPeriod = loadAnalyticsFlowPeriod();
    appSettings = settingsController.load();
    settingsController.apply(false);
    settingsController.syncControls();
    sustainableProgressController.reload();
    featureRegistry.reload();
    syncRaceHistoryIntoSustainableProgress();
    normalizeGamification();
    overdueReviewController.reload({ refresh: false });
    processOverdueRetention(false);
    renderCurrentPage();
}

function logAnalyticsEvent(type, payload) {
    const timestamp = getNowTimestamp();
    const event = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'event-' + Date.now().toString(),
        type,
        timestamp,
        dateKey: getDateKeyFromTimestamp(timestamp),
        ...(payload || {})
    };

    analyticsEvents.push(event);
    analyticsEvents = analyticsEvents.slice(-1500);
    saveAnalyticsEvents();
    syncAnalyticsData();

    return event;
}

function loadTodoList() {
    const savedTodos = TASKLYZEN_STORAGE.readJson(STORAGE_KEY, []);

    return savedTodos.map(todo => {
        const createdOn = isDateKey(todo.createdOn) ? todo.createdOn : getTodayKey();
        const completedOn = isDateKey(todo.completedOn) ? todo.completedOn : null;
        const createdAt = normalizeTimestamp(todo.createdAt, createdOn);
        const completedAt = completedOn ? normalizeTimestamp(todo.completedAt, completedOn) : null;
        const deadlineStartedAt = normalizeTimestamp(todo.deadlineStartedAt || todo.reactivatedAt || createdAt, createdOn);
        const hasStoredDueDate = Object.prototype.hasOwnProperty.call(todo, 'dueDate');
        const dueDate = hasStoredDueDate
            ? normalizeTaskDueDate(todo.dueDate)
            : getLegacyDueDate(deadlineStartedAt, todo.timeLimitDays);

        const normalizedTodo = {
            id: todo.id,
            text: normalizeStoredTodoText(todo.text),
            type: todo.type === 'composite' || Array.isArray(todo.subtasks) ? 'composite' : 'normal',
            priority: todo.priority || 'normal',
            completed: Boolean(todo.completed),
            completedOn,
            completedAt,
            createdOn,
            createdAt,
            deadlineStartedAt,
            dueDate,
            deletedAt: typeof todo.deletedAt === 'string' ? todo.deletedAt : null,
            updatedAt: normalizeTimestamp(todo.updatedAt, completedOn || createdOn),
            completionValue: Math.max(Math.round(Number(todo.completionValue) || 1), 1),
            timeLimitDays: normalizeTaskTimeLimit(todo.timeLimitDays),
            habit: Boolean(todo.habit),
            recurrence: todo.recurrence || (todo.habit ? 'daily' : 'none'),
            snoozedUntil: typeof todo.snoozedUntil === 'string' ? todo.snoozedUntil : null,
            sourceHabitId: typeof todo.sourceHabitId === 'string' ? todo.sourceHabitId : null
        };

        if (normalizedTodo.type === 'composite') {
            normalizedTodo.subtasks = TASKLYZEN_COMPOSITE_TASKS.normalizeSubtasks(todo.subtasks);
        }

        return TASKLYZEN_COMPOSITE_TASKS.normalizeTask(normalizedTodo);
    });
}

function normalizeStoredTodoText(text) {
    if (text === 'Definir primera tarea de manana') {
        return 'Definir primera tarea de hoy';
    }

    return text;
}

function loadDailyGoal() {
    const savedGoal = Number(TASKLYZEN_STORAGE.readText(DAILY_GOAL_KEY, null));

    if (Number.isFinite(savedGoal) && savedGoal >= 1) {
        return Math.min(Math.round(savedGoal), 20);
    }

    return DEFAULT_DAILY_GOAL;
}

function loadGamification() {
    return TASKLYZEN_GAMIFICATION.loadGamification(TASKLYZEN_STORAGE, GAMIFICATION_KEY);
}

function buildCompletionHistory(todoItems, events) {
    const history = {};
    const records = getTaskLifecycleRecords(todoItems, events || []);

    records.forEach(record => {
        if (!record.completedOn || isSameDayDeletedLifecycle(record)) {
            return;
        }

        if (!record.completed && !record.deletedWasCompleted) {
            return;
        }

        history[record.completedOn] = (history[record.completedOn] || 0) + Math.max(Math.round(Number(record.completionValue) || 1), 1);
    });

    return history;
}

function syncCompletionHistory() {
    completionHistory = buildCompletionHistory(todos, analyticsEvents);
    normalizeGamification();
    saveCompletionHistory();
    syncAnalyticsData();
}

function normalizeGamification() {
    gamificationController.normalizeGamification();
}

function getTaskLifecycleRecords(todoItems, events) {
    const records = new Map();
    const sourceEvents = Array.isArray(events) ? events : analyticsEvents;
    const sourceTodos = Array.isArray(todoItems) ? todoItems : todos;

    function ensureRecord(todoId) {
        if (!records.has(todoId)) {
            records.set(todoId, {
                id: todoId,
                text: 'Tarea sin nombre',
                priority: 'normal',
                habit: false,
                createdOn: null,
                createdAt: null,
                completed: false,
                completedOn: null,
                completedAt: null,
                completionValue: 1,
                timeLimitDays: TASK_TIME_LIMIT_DEFAULT_DAYS,
                dueDate: null,
                deadlineStartedAt: null,
                deletedOn: null,
                deletedAt: null,
                deletedWasCompleted: false,
                expired: false,
                reactivated: 0
            });
        }

        return records.get(todoId);
    }

    sourceEvents
        .filter(event => event && event.todoId)
        .slice()
        .sort((first, second) => String(first.timestamp || '').localeCompare(String(second.timestamp || '')))
        .forEach(event => {
            const record = ensureRecord(event.todoId);
            const eventDateKey = isDateKey(event.dateKey) ? event.dateKey : getDateKeyFromTimestamp(event.timestamp);

            if (event.text || event.taskText) {
                record.text = event.text || event.taskText;
            }

            if (event.priority) {
                record.priority = event.priority;
            }

            if (typeof event.habit === 'boolean') {
                record.habit = event.habit;
            }

            if (event.timeLimitDays) {
                record.timeLimitDays = normalizeTaskTimeLimit(event.timeLimitDays);
            }

            if (Object.prototype.hasOwnProperty.call(event, 'dueDate')) {
                record.dueDate = normalizeTaskDueDate(event.dueDate);
            }

            if (event.type === 'task_created') {
                record.createdOn = isDateKey(event.createdOn) ? event.createdOn : eventDateKey;
                record.createdAt = event.createdAt || event.timestamp || createTimestampFromDateKey(eventDateKey);
                record.scheduledFor = event.scheduledFor || record.scheduledFor || eventDateKey;
            }

            if (event.deadlineStartedAt) {
                record.deadlineStartedAt = event.deadlineStartedAt;
            }

            if (event.type === 'task_completed') {
                record.completed = true;
                record.completedOn = isDateKey(event.completedOn) ? event.completedOn : eventDateKey;
                record.completedAt = event.completedAt || event.timestamp || createTimestampFromDateKey(record.completedOn);
                if (isDateKey(event.createdOn)) {
                    record.createdOn = event.createdOn;
                    record.createdAt = event.createdAt || record.createdAt || createTimestampFromDateKey(event.createdOn);
                }
                record.completionValue = Math.max(Math.round(Number(event.completionValue) || record.completionValue || 1), 1);
            }

            if (event.type === 'task_reactivated') {
                record.completed = false;
                record.completedOn = null;
                record.completedAt = null;
                record.reactivated += 1;
            }

            if (event.type === 'task_deleted' || event.type === 'task_expired' || event.type === 'task_auto_deleted') {
                record.deletedOn = eventDateKey;
                record.deletedAt = event.timestamp || createTimestampFromDateKey(eventDateKey);
                record.deletedWasCompleted = Boolean(event.wasCompleted);
                record.completed = record.deletedWasCompleted;
                record.expired = event.type === 'task_expired' || event.type === 'task_auto_deleted';

                if (isDateKey(event.createdOn)) {
                    record.createdOn = event.createdOn;
                    record.createdAt = event.createdAt || record.createdAt || createTimestampFromDateKey(event.createdOn);
                }

                if (record.deletedWasCompleted && isDateKey(event.completedOn)) {
                    record.completedOn = event.completedOn;
                    record.completedAt = event.completedAt || record.completedAt || createTimestampFromDateKey(event.completedOn);
                }

                if (!record.createdOn && Number.isFinite(Number(event.ageDays))) {
                    record.createdOn = getDateKeyByOffset(eventDateKey, -Math.max(Math.round(Number(event.ageDays)), 0));
                    record.createdAt = createTimestampFromDateKey(record.createdOn);
                }

                if (!record.deletedWasCompleted) {
                    record.completedOn = null;
                    record.completedAt = null;
                }
            }
        });

    sourceTodos.forEach(todo => {
        const record = ensureRecord(todo.id);

        record.text = todo.text || record.text;
        record.priority = todo.priority || record.priority;
        record.habit = Boolean(todo.habit);
        record.createdOn = isDateKey(todo.createdOn) ? todo.createdOn : record.createdOn || getTodayKey();
        record.createdAt = todo.createdAt || record.createdAt || createTimestampFromDateKey(record.createdOn);
        record.deadlineStartedAt = todo.deadlineStartedAt || record.deadlineStartedAt || record.createdAt;
        record.completed = Boolean(todo.completed);
        record.completedOn = todo.completed && isDateKey(todo.completedOn) ? todo.completedOn : null;
        record.completedAt = todo.completed ? todo.completedAt : null;
        record.completionValue = Math.max(Math.round(Number(todo.completionValue) || record.completionValue || 1), 1);
        record.timeLimitDays = normalizeTaskTimeLimit(todo.timeLimitDays);
        record.dueDate = getTaskDueDate(todo);
        record.deletedOn = null;
        record.deletedAt = null;
        record.deletedWasCompleted = false;
        record.expired = false;
    });

    return [...records.values()]
        .filter(record => record.createdOn || record.completedOn || record.deletedOn)
        .map(record => {
            const analyticsState = getLifecycleAnalyticsLockState(record);

            return {
                ...record,
                analyticsState,
                analyticsFixed: analyticsState.fixed
            };
        });
}

function getLifecycleAnalyticsLockState(record) {
    const createdOn = isDateKey(record.createdOn) ? record.createdOn : null;
    const referenceDateKey = isDateKey(record.deletedOn) ? record.deletedOn : getTodayKey();
    const fixed = Boolean(createdOn && createdOn < referenceDateKey);

    return {
        fixed,
        provisional: Boolean(createdOn && !fixed),
        createdOn,
        referenceDateKey
    };
}

function isLifecycleDeletedBeforeAnalyticsLock(record) {
    return Boolean(record.deletedOn && !getLifecycleAnalyticsLockState(record).fixed);
}

function isSameDayDeletedLifecycle(record) {
    return isLifecycleDeletedBeforeAnalyticsLock(record);
}

function isLifecycleRelevantForRange(record, startKey, endKey) {
    if (isSameDayDeletedLifecycle(record)) {
        return false;
    }

    return isDateKeyInRange(record.createdOn, startKey, endKey)
        || isDateKeyInRange(record.completedOn, startKey, endKey)
        || isDateKeyInRange(record.deletedOn, startKey, endKey);
}

function getLifecycleAnalyticsForRange(startKey, endKey) {
    const records = getTaskLifecycleRecords().filter(record => isLifecycleRelevantForRange(record, startKey, endKey));
    const completedRecords = records.filter(record => isDateKeyInRange(record.completedOn, startKey, endKey) && (record.completed || record.deletedWasCompleted));
    const deletedUnfinishedRecords = records.filter(record => record.deletedOn && !record.deletedWasCompleted);
    const createdRecords = records.filter(record => isDateKeyInRange(record.createdOn, startKey, endKey));
    const reactivatedRecords = records.filter(record => record.reactivated > 0 && (
        isDateKeyInRange(record.createdOn, startKey, endKey)
        || isDateKeyInRange(record.deletedOn, startKey, endKey)
        || isDateKeyInRange(record.completedOn, startKey, endKey)
    ));

    return {
        records,
        createdRecords,
        completedRecords,
        deletedUnfinishedRecords,
        reactivatedRecords,
        eligible: records.length,
        created: createdRecords.length,
        completed: completedRecords.length,
        deleted: deletedUnfinishedRecords.length,
        reactivated: reactivatedRecords.reduce((total, record) => total + record.reactivated, 0),
        completionRate: getPercent(completedRecords.length, records.length),
        notCompleted: Math.max(records.length - completedRecords.length, 0)
    };
}

function getHistoryCount(dateKey) {
    return completionHistory[dateKey] || 0;
}

function isProtectedDate(dateKey) {
    return gamificationController.isProtectedDate(dateKey);
}

function hasActiveCredit(dateKey) {
    return gamificationController.hasActiveCredit(dateKey);
}

function getStreakByRule(rule) {
    return gamificationController.getStreakByRule(rule);
}

function getActiveStreakEndingAt(date) {
    return gamificationController.getActiveStreakEndingAt(date);
}

function getDateRangeStart() {
    return gamificationController.getDateRangeStart();
}

function getLongestStreakByRule(rule) {
    return gamificationController.getLongestStreakByRule(rule);
}

function getPerfectStreak() {
    return gamificationController.getPerfectStreak();
}

function getLegendaryStreak() {
    return gamificationController.getLegendaryStreak();
}

function getLongestActiveStreak() {
    return gamificationController.getLongestActiveStreak();
}

function getEarnedShields() {
    return gamificationController.getEarnedShields();
}

function getAvailableShields() {
    return gamificationController.getAvailableShields();
}

function getRescueState() {
    return gamificationController.getRescueState();
}

function rescueYesterday() {
    gamificationController.rescueYesterday();
}

function getTaskStats() {
    return taskUiController.getStats();
}

function getPriorityRank(priority) {
    if (priority === 'urgent') {
        return 3;
    }

    if (priority === 'important') {
        return 2;
    }

    return 1;
}

function getPendingHabitOccurrence(todo) {
    return todos.find(item => {
        return item.sourceHabitId === todo.id && !item.completed && item.snoozedUntil === getTomorrowKey();
    });
}

function createNextHabitOccurrence(todo) {
    if (!todo.habit || todo.recurrence !== 'daily' || getPendingHabitOccurrence(todo)) {
        return;
    }

    todos.push(createTodo(todo.text, todo.priority, {
        habit: true,
        recurrence: 'daily',
        dueDate: null,
        snoozedUntil: getTomorrowKey(),
        sourceHabitId: todo.id
    }));
}

function removeNextHabitOccurrence(todo) {
    todos = todos.filter(item => {
        return !(item.sourceHabitId === todo.id && !item.completed && item.snoozedUntil === getTomorrowKey());
    });
}

function getTopPriorityTodo() {
    const pendingTodos = todos.filter(isTodoAvailableToday);

    return pendingTodos.reduce((topTodo, todo) => {
        if (!topTodo) {
            return todo;
        }

        const priorityDifference = getPriorityRank(todo.priority) - getPriorityRank(topTodo.priority);

        if (priorityDifference !== 0) {
            return priorityDifference > 0 ? todo : topTodo;
        }

        if (todo.habit !== topTodo.habit) {
            return todo.habit ? todo : topTodo;
        }

        return todo.createdOn < topTodo.createdOn ? todo : topTodo;
    }, null);
}

function getVisibleTodos() {
    return taskUiController.getVisibleTodos();
}

function getEmptyStateMessage() {
    return taskUiController.getEmptyStateMessage();
}

function getExpiredTaskRecords(limit) {
    return taskUiController.getExpiredTaskRecords(limit);
}

function canUseBrowserNotifications() {
    return notificationController.canUseBrowserNotifications();
}

function getBrowserNotificationPermission() {
    return notificationController.getBrowserNotificationPermission();
}

function getNotificationEnvironmentInfo() {
    return notificationController.getEnvironmentInfo();
}

function getNotificationGuideText() {
    return notificationController.getGuideText();
}

function getNotificationStatusCopy() {
    return notificationController.getStatusCopy();
}

function syncNotificationControls() {
    notificationController.syncControls();
}

function requestBrowserNotificationPermission() {
    return notificationController.requestBrowserPermission();
}

function sendNotificationReadyConfirmation() {
    return notificationController.sendNotificationReadyConfirmation();
}

function createBrowserNotification(title, body, tag) {
    return notificationController.createBrowserNotification(title, body, tag);
}

function getBrowserReminderPayload() {
    return notificationController.getBrowserReminderPayload();
}

function sendBrowserTaskReminder(force) {
    return notificationController.sendBrowserTaskReminder(force);
}

function notifyDeadlineRisks() {
    notificationController.notifyDeadlineRisks();
}

function renderExpiredTasksPanel() {
    taskUiController.renderExpiredTasksPanel();
}

function getNextActionReason(todo) {
    return taskUiController.getNextActionReason(todo);
}

function renderNextAction() {
    taskUiController.renderNextAction();
}

function showToast(message, type, options) {
    notificationController.showToast(message, type, options);
}

function playCompletionSound(type) {
    audioController.playCompletion(type);
}

function getCompletionCelebrationCopy(type) {
    if (type === 'goal') {
        return 'Meta diaria completa';
    }

    if (type === 'legendary') {
        return 'Extra legendario';
    }

    return 'Tarea completada';
}

function getCompletionCelebrationDuration(type) {
    if (type === 'legendary') {
        return 2200;
    }

    if (type === 'goal') {
        return 2000;
    }

    return 1500;
}

function getPriorityLabel(priority) {
    return taskUiController.getPriorityLabel(priority);
}

function showCompletionAnimation(type) {
    const celebrationType = type || 'regular';

    playCompletionSound(celebrationType);

    if (!appSettings.animations) {
        return;
    }

    if (!completionCelebration || !completionTitle) {
        return;
    }

    clearTimeout(celebrationTimer);
    completionCelebration.classList.remove('show', 'regular', 'goal', 'legendary');
    completionTitle.textContent = getCompletionCelebrationCopy(celebrationType);
    completionCelebration.setAttribute('aria-hidden', 'false');
    void completionCelebration.offsetWidth;
    completionCelebration.classList.add('show', celebrationType);

    celebrationTimer = setTimeout(() => {
        completionCelebration.classList.remove('show', 'regular', 'goal', 'legendary');
        completionCelebration.setAttribute('aria-hidden', 'true');
    }, getCompletionCelebrationDuration(celebrationType));
}

function showStreakDayCelebration(streak, options) {
    const config = options || {};
    const safeStreak = Math.max(Math.round(Number(streak) || 0), 0);
    const level = getStreakPrestigeLevel(safeStreak);
    const isMilestone = safeStreak > 1 && safeStreak === level.min;
    const isRecord = Boolean(config.isRecord);

    if (!appSettings.animations || !streakDayCelebration || !streakCelebrationCard) {
        return;
    }

    window.clearTimeout(streakCelebrationTimer);
    streakDayCelebration.classList.remove('show', 'milestone', 'record');
    streakCelebrationCard.classList.remove(...getStreakPrestigeClassNames());
    streakCelebrationCard.classList.add(level.className);

    if (streakCelebrationEmblem) {
        streakCelebrationEmblem.classList.remove(...getStreakPrestigeClassNames());
        streakCelebrationEmblem.classList.add(level.className);
    }

    if (streakCelebrationKicker) {
        streakCelebrationKicker.textContent = isMilestone
            ? 'Nuevo nivel de racha'
            : isRecord ? 'Nuevo récord personal' : 'Racha actualizada';
    }

    if (streakCelebrationTitle) {
        streakCelebrationTitle.textContent = isMilestone
            ? level.label
            : safeStreak + ' día' + (safeStreak === 1 ? '' : 's') + ' seguido' + (safeStreak === 1 ? '' : 's');
    }

    if (streakCelebrationMessage) {
        streakCelebrationMessage.textContent = isMilestone
            ? level.rewardMessage
            : isRecord
                ? 'Superaste tu mejor marca. Tu constancia ya cuenta hoy.'
                : 'Tu constancia ya cuenta hoy.';
    }

    streakDayCelebration.setAttribute('aria-hidden', 'false');
    void streakDayCelebration.offsetWidth;
    streakDayCelebration.classList.add('show');
    if (isMilestone) streakDayCelebration.classList.add('milestone');
    if (isRecord && !isMilestone) streakDayCelebration.classList.add('record');

    streakCelebrationTimer = window.setTimeout(() => {
        streakDayCelebration.classList.remove('show', 'milestone', 'record');
        streakDayCelebration.setAttribute('aria-hidden', 'true');
    }, isMilestone ? 3100 : isRecord ? 2500 : 1900);
}

function updateDailyGoal(value, shouldNotify) {
    if (todoForm) {
        progressDashboardHydrated = true;
        ensureContributionGridObserver();
    }

    analyticsProgressController.updateDailyGoal(value, shouldNotify);
}

function getCurrentStreak() {
    return gamificationController.getCurrentStreak();
}

function getStreakBeforeToday() {
    return gamificationController.getStreakBeforeToday();
}

function getActiveDaysTotal() {
    return gamificationController.getActiveDaysTotal();
}

function getTotalCompletedTasks() {
    return gamificationController.getTotalCompletedTasks();
}

function getBestDayTotal() {
    return gamificationController.getBestDayTotal();
}

function getCompletedPriorityCount(priority) {
    return todos.filter(todo => todo.completed && todo.priority === priority).length;
}

function getTodayCompletedPriorityCount(priority) {
    const todayKey = getTodayKey();

    return todos.filter(todo => todo.completed && todo.completedOn === todayKey && todo.priority === priority).length;
}

function getTodayCompletedHabitCount() {
    const todayKey = getTodayKey();

    return todos.filter(todo => todo.completed && todo.completedOn === todayKey && todo.habit).length;
}

function getRecentHistoryCounts(days) {
    return analyticsProgressController.getRecentHistoryCounts(days);
}

function getDateLabel(dateKey, options) {
    return analyticsProgressController.getDateLabel(dateKey, options);
}

function getPeriodEntries(days, offsetDays) {
    return analyticsProgressController.getPeriodEntries(days, offsetDays);
}

function getStatsFromEntries(entries) {
    return analyticsProgressController.getStatsFromEntries(entries);
}

function getPeriodStats(days, offsetDays) {
    return analyticsProgressController.getPeriodStats(days, offsetDays);
}

function getCurrentMonthStats(monthOffset) {
    return analyticsProgressController.getCurrentMonthStats(monthOffset);
}

function getMonthRange(monthOffset) {
    return analyticsProgressController.getMonthRange(monthOffset);
}

function getCurrentWeekRange() {
    return analyticsProgressController.getCurrentWeekRange();
}

function getCurrentWeekToDateRange() {
    return analyticsProgressController.getCurrentWeekToDateRange();
}

function getCurrentQuarterRange() {
    return analyticsProgressController.getCurrentQuarterRange();
}

function getAnalyticsPeriodRange(period) {
    return analyticsProgressController.getAnalyticsPeriodRange(period);
}

function getDailyStatsForRange(start, end) {
    return analyticsProgressController.getDailyStatsForRange(start, end);
}

function getFlowPeriodAnalytics(period) {
    return analyticsProgressController.getFlowPeriodAnalytics(period);
}

function getMonthLabel(date) {
    return analyticsProgressController.getMonthLabel(date);
}

function isDateKeyInRange(dateKey, startKey, endKey) {
    return analyticsProgressController.isDateKeyInRange(dateKey, startKey, endKey);
}

function getTodoScheduleDateKey(todo) {
    return analyticsProgressController.getTodoScheduleDateKey(todo);
}

function getTodosRelevantForRange(startKey, endKey) {
    return analyticsProgressController.getTodosRelevantForRange(startKey, endKey);
}

function getPercent(part, total) {
    return analyticsProgressController.getPercent(part, total);
}

function getMonthlyAnalytics(monthOffset) {
    return analyticsProgressController.getMonthlyAnalytics(monthOffset);
}

function getMonthlyAnalyticsHistory(months) {
    return analyticsProgressController.getMonthlyAnalyticsHistory(months);
}

function getDailyStat(dateKey) {
    return analyticsProgressController.getDailyStat(dateKey);
}

function getDailyStatEntries(days, offsetDays) {
    return analyticsProgressController.getDailyStatEntries(days, offsetDays);
}

function sumDailyStats(entries, key) {
    return analyticsProgressController.sumDailyStats(entries, key);
}

function getCompletionHoursForTodos(todoItems) {
    return analyticsProgressController.getCompletionHoursForTodos(todoItems);
}

function formatHourLabel(hour) {
    return analyticsProgressController.formatHourLabel(hour);
}

function getBestCompletionWindow(days) {
    return analyticsProgressController.getBestCompletionWindow(days);
}

function getWeekdayName(dateKey) {
    return analyticsProgressController.getWeekdayName(dateKey);
}

function getBestRhythmInsight(weekStats, clarity) {
    return analyticsProgressController.getBestRhythmInsight(weekStats, clarity);
}

function getFlowRhythmInsight(flow, fallbackRhythm) {
    return analyticsProgressController.getFlowRhythmInsight(flow, fallbackRhythm);
}

function getMinimalAnalyticsAdvice(clarity, weekStats) {
    return analyticsProgressController.getMinimalAnalyticsAdvice(clarity, weekStats);
}

function getBacklogAnalytics() {
    return analyticsProgressController.getBacklogAnalytics();
}

function getWeeklyLifecycleAnalytics() {
    return analyticsProgressController.getWeeklyLifecycleAnalytics();
}

function getMonthlyFunnelAnalytics(monthAnalytics) {
    return analyticsProgressController.getMonthlyFunnelAnalytics(monthAnalytics);
}

function getClarityAnalytics() {
    return analyticsProgressController.getClarityAnalytics();
}
function getConsistencyAnalytics(days) {
    return analyticsProgressController.getConsistencyAnalytics(days);
}

function getWeeklyActivities() {
    return analyticsProgressController.getWeeklyActivities();
}

function getAdaptiveGoalRecommendation() {
    return analyticsProgressController.getAdaptiveGoalRecommendation();
}

function getRecommendedDailyGoal() {
    return analyticsProgressController.getRecommendedDailyGoal();
}

function getProgressViewKeys() {
    return analyticsProgressController.getProgressViewKeys();
}

function loadProgressView() {
    const savedView = TASKLYZEN_STORAGE.readText(PROGRESS_VIEW_KEY, null);

    return TASKLYZEN_ANALYTICS_PROGRESS.normalizeProgressView(savedView);
}

function saveProgressView() {
    analyticsProgressController.saveProgressView();
}

function isContributionGridMeasurable() {
    return gamificationUiController.isContributionGridMeasurable();
}

function scheduleContributionGridRender() {
    gamificationUiController.scheduleContributionGridRender();
}

function installContributionGridObserver() {
    gamificationUiController.installContributionGridObserver();
}

function renderProgressSections() {
    analyticsProgressController.renderProgressSections();
}

function setProgressView(view, shouldSave) {
    analyticsProgressController.setProgressView(view, shouldSave);
}

function getProductivityProfile() {
    return analyticsProgressController.getProductivityProfile();
}

function getStreakRiskInsight() {
    return analyticsProgressController.getStreakRiskInsight();
}

function getDominantCompletedPriority() {
    return analyticsProgressController.getDominantCompletedPriority();
}

function getAnalyticsNextAction() {
    return analyticsProgressController.getAnalyticsNextAction();
}

function getAnalyticsInsights() {
    return analyticsProgressController.getAnalyticsInsights();
}

function getMonthlyRecap() {
    return analyticsProgressController.getMonthlyRecap();
}

function getAnalyticsSnapshot() {
    return analyticsProgressController.getAnalyticsSnapshot();
}

function requestIdleTask(callback, timeout) {
    if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(callback, { timeout: timeout || 1200 });
    }

    return window.setTimeout(() => callback({
        didTimeout: true,
        timeRemaining: () => 0
    }), 0);
}

function disconnectProgressHydrationObserver() {
    if (progressHydrationObserver && typeof progressHydrationObserver.disconnect === 'function') {
        progressHydrationObserver.disconnect();
    }

    progressHydrationObserver = null;
}

function syncProgressToggleLabel(isExpanded) {
    if (!progressToggle) {
        return;
    }

    progressToggle.setAttribute('aria-expanded', isExpanded.toString());
    progressToggle.textContent = isExpanded ? 'Cerrar' : 'Progreso';
    progressToggle.setAttribute('aria-label', isExpanded ? 'Cerrar panel de progreso' : 'Abrir panel de progreso');
}

function getWeekDateKeysForCompactProgress() {
    const range = getCurrentWeekRange();
    const start = new Date(range.startKey + 'T00:00:00');
    const end = new Date(range.endKey + 'T00:00:00');
    const dateKeys = [];

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return [getTodayKey()];
    }

    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
        dateKeys.push(formatDateKey(cursor));
    }

    return dateKeys;
}

function replayCompactFeedback(element, className) {
    if (!element) {
        return;
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}

function renderCompactProgressWidget() {
    if (!compactProgressWidget) {
        return;
    }

    const todayCount = getHistoryCount(getTodayKey());
    const safeDailyGoal = Math.max(Number(dailyGoal) || DEFAULT_DAILY_GOAL, 1);
    const streak = getCurrentStreak();
    const streakLevel = getStreakPrestigeLevel(streak);
    const todayKey = getTodayKey();
    const streakProtectedToday = getHistoryCount(todayKey) > 0 || isProtectedDate(todayKey);
    const streakRescueState = getRescueState();
    const weekDateKeys = getWeekDateKeysForCompactProgress();
    const weekCompleted = weekDateKeys.reduce((total, dateKey) => total + getHistoryCount(dateKey), 0);
    const weekTarget = Math.max(safeDailyGoal * 7, 1);
    const weekPercent = Math.min(Math.round((weekCompleted / weekTarget) * 100), 100);
    const todayPercent = Math.min(Math.round((todayCount / safeDailyGoal) * 100), 100);
    const missionSnapshot = analyticsProgressController.getDailyMissionSnapshot();
    const streakTodayState = streakProtectedToday ? 'protected' : streak > 0 ? 'pending' : 'empty';

    if (compactProgressToday) {
        compactProgressToday.textContent = 'Hoy ' + todayCount + '/' + safeDailyGoal;
    }

    if (compactProgressTodayBar) {
        compactProgressTodayBar.style.width = todayPercent + '%';
    }

    if (compactProgressTodayNote) {
        compactProgressTodayNote.textContent = todayCount === 0
            ? 'Empieza con 1 tarea'
            : todayCount >= safeDailyGoal ? 'Meta completa de hoy' : 'Faltan ' + (safeDailyGoal - todayCount) + ' para cerrar Hoy';
    }

    if (compactProgressTodayStatus) {
        compactProgressTodayStatus.textContent = todayCount >= safeDailyGoal
            ? 'Cumplida'
            : Math.min(todayCount, safeDailyGoal) + '/' + safeDailyGoal;
    }

    if (compactProgressTodayItem) {
        compactProgressTodayItem.classList.toggle('is-complete', todayCount >= safeDailyGoal);
    }

    if (compactProgressMissionTitle) {
        compactProgressMissionTitle.textContent = missionSnapshot.title;
    }

    if (compactProgressMissionNote) {
        compactProgressMissionNote.textContent = missionSnapshot.complete
            ? 'Reto completado por hoy'
            : missionSnapshot.message;
    }

    if (compactProgressMissionStatus) {
        compactProgressMissionStatus.textContent = missionSnapshot.complete
            ? 'Cumplida'
            : Math.min(missionSnapshot.current, missionSnapshot.target) + '/' + missionSnapshot.target;
    }

    if (compactProgressMissionItem) {
        const missionAdvanced = lastCompactMissionSnapshot
            && lastCompactMissionSnapshot.id === missionSnapshot.id
            && (missionSnapshot.current > lastCompactMissionSnapshot.current
                || missionSnapshot.complete && !lastCompactMissionSnapshot.complete);

        compactProgressMissionItem.classList.toggle('is-complete', missionSnapshot.complete);
        compactProgressMissionItem.dataset.missionState = missionSnapshot.complete ? 'complete' : 'pending';
        compactProgressMissionItem.setAttribute('aria-label', 'Misión diaria: ' + missionSnapshot.title + '. '
            + (missionSnapshot.complete ? 'Cumplida.' : missionSnapshot.current + ' de ' + missionSnapshot.target + '.'));

        if (missionAdvanced) {
            replayCompactFeedback(compactProgressMissionItem, 'mission-progressed');
        }
    }

    lastCompactMissionSnapshot = missionSnapshot;

    if (compactProgressStreak) {
        compactProgressStreak.textContent = String(streak);
    }

    if (compactProgressStreakNote) {
        compactProgressStreakNote.textContent = streakProtectedToday
            ? streak + ' día' + (streak === 1 ? '' : 's') + ' · Hoy protegido'
            : streakRescueState.waitingForToday
                ? 'Rescate disponible al volver hoy'
                : streak > 0
                    ? streak + ' día' + (streak === 1 ? '' : 's') + ' · Hoy pendiente'
                    : 'Sin racha todavía';
    }

    if (compactProgressStreakStatus) {
        compactProgressStreakStatus.textContent = streakProtectedToday ? 'Cumplida' : 'Pendiente';
    }

    if (compactProgressStreakMenuItem) {
        compactProgressStreakMenuItem.classList.toggle('is-complete', streakProtectedToday);
    }

    [compactProgressStreakChip, compactProgressStreakMenuItem].forEach(element => {
        if (!element) {
            return;
        }

        element.classList.remove(...getStreakPrestigeClassNames());
        element.classList.add(streakLevel.className);
        element.dataset.todayState = streakTodayState;
        element.setAttribute('aria-label', compactProgressStreakNote
            ? compactProgressStreakNote.textContent
            : streak + ' días de racha');
    });

    if (lastCompactStreakTodayState && lastCompactStreakTodayState !== 'protected' && streakTodayState === 'protected') {
        replayCompactFeedback(compactProgressStreakChip, 'streak-just-protected');
    }

    lastCompactStreakTodayState = streakTodayState;

    if (compactProgressWeek) {
        compactProgressWeek.textContent = weekPercent + '%';
    }

    if (compactProgressWeekNote) {
        compactProgressWeekNote.textContent = weekCompleted >= weekTarget
            ? 'Objetivo semanal completado'
            : weekCompleted > 0 ? 'Sigue construyendo tu ritmo' : 'Completa una tarea para empezar';
    }

    if (compactProgressWeekStatus) {
        compactProgressWeekStatus.textContent = weekCompleted >= weekTarget
            ? 'Cumplida'
            : weekCompleted + '/' + weekTarget;
    }

    if (compactProgressWeekItem) {
        compactProgressWeekItem.classList.toggle('is-complete', weekCompleted >= weekTarget);
    }

    if (compactProgressButtons) {
        compactProgressButtons.forEach(button => {
            const isActive = button.dataset.progressShortcut === activeProgressView;

            button.classList.toggle('is-active', isActive);
            if (button.closest('.compact-progress-shell')) {
                button.setAttribute('aria-pressed', isActive.toString());
            } else {
                button.removeAttribute('aria-pressed');
            }
        });
    }
}

function setCompactProgressMenuOpen(isOpen) {
    if (!compactProgressMenu || !compactProgressToggle || !compactProgressWidget) {
        return;
    }

    compactProgressMenu.hidden = !isOpen;
    compactProgressToggle.setAttribute('aria-expanded', isOpen.toString());
    compactProgressWidget.classList.toggle('is-open', isOpen);
}

function openProgressPanelView(view) {
    const nextView = TASKLYZEN_ANALYTICS_PROGRESS.normalizeProgressView(view || 'today');

    if (nextView === 'analytics') {
        activeFlowPeriod = 'weekly';
        saveAnalyticsFlowPeriod();
    }

    analyticsProgressController.setProgressView(nextView, true);
    setCompactProgressMenuOpen(false);
    setProgressPanelExpanded(true, true);
}

function handleCompactProgressWidgetClick(event) {
    const toggle = event.target.closest('#compact-progress-toggle');

    if (toggle) {
        setCompactProgressMenuOpen(compactProgressToggle.getAttribute('aria-expanded') !== 'true');
        return;
    }

    const button = event.target.closest('[data-progress-shortcut]');

    if (!button) {
        return;
    }

    openProgressPanelView(button.dataset.progressShortcut);
}

function handleCompactProgressDocumentClick(event) {
    if (!compactProgressWidget || !compactProgressWidget.classList.contains('is-open')) {
        return;
    }

    if (event.target && compactProgressWidget.contains(event.target)) {
        return;
    }

    setCompactProgressMenuOpen(false);
}

function handleCompactProgressKeydown(event) {
    if (event.key !== 'Escape' || !compactProgressWidget || !compactProgressWidget.classList.contains('is-open')) {
        return;
    }

    setCompactProgressMenuOpen(false);
    if (compactProgressToggle) {
        compactProgressToggle.focus({ preventScroll: true });
    }
}

function isSettingsPanelOpen() {
    return Boolean(settingsPanel && !settingsPanel.hidden);
}

function syncAppLayerState() {
    if (!document.body) {
        return;
    }

    const hasOpenLayer = progressPanelExpanded || isSettingsPanelOpen();

    document.body.classList.toggle('settings-panel-open', isSettingsPanelOpen());
    document.body.classList.remove('modal-panel-open');
    document.body.classList.toggle('app-layer-open', hasOpenLayer);
}

function handleSettingsPanelToggle(isOpen) {
    if (isOpen) {
        if (progressPanelExpanded) {
            setProgressPanelExpanded(false, false);
        }
    }

    syncAppLayerState();
}

function finalizeProgressPanelClose() {
    if (progressPanelExpanded) {
        return;
    }

    window.clearTimeout(progressPanelCloseTimer);
    progressPanelCloseTimer = null;

    document.body.classList.remove('progress-panel-open');
    syncAppLayerState();

    if (progressPanel) {
        progressPanel.classList.remove('progress-expanded', 'progress-closing', 'is-dragging');
        progressPanel.classList.add('progress-collapsed');
        progressPanel.removeAttribute('tabindex');
        progressPanel.style.transform = '';
    }

    if (progressDetailLayer) {
        progressDetailLayer.hidden = true;
    }

    syncProgressToggleLabel(false);
}

function setProgressPanelExpanded(isExpanded, shouldHydrate) {
    const wasExpanded = progressPanelExpanded;
    const currentPanelTransform = progressPanel ? progressPanel.style.transform : '';
    progressPanelExpanded = Boolean(isExpanded);

    if (progressPanelExpanded && isSettingsPanelOpen()) {
        settingsController.setPanelOpen(false);
    }

    window.clearTimeout(progressPanelCloseTimer);
    progressPanelCloseTimer = null;

    if (progressPanel) {
        progressPanel.classList.remove('progress-closing');
    }

    if (!progressPanelExpanded && wasExpanded && progressPanel) {
        progressPanelDragStartY = 0;
        progressPanelDragLastY = 0;
        progressPanelDragPointerId = null;
        progressPanelDragCaptureTarget = null;
        document.body.classList.add('progress-panel-open');
        progressPanel.classList.add('progress-expanded', 'progress-closing');
        progressPanel.classList.remove('progress-collapsed', 'is-dragging');
        if (currentPanelTransform) {
            progressPanel.style.transform = currentPanelTransform;
            void progressPanel.offsetHeight;
            progressPanel.style.transform = '';
        }
        syncProgressToggleLabel(false);
        progressPanelCloseTimer = window.setTimeout(finalizeProgressPanelClose, 220);
        return;
    }

    resetProgressPanelDrag();

    document.body.classList.toggle('progress-panel-open', progressPanelExpanded);
    syncAppLayerState();

    if (progressPanel) {
        progressPanel.classList.toggle('progress-expanded', progressPanelExpanded);
        progressPanel.classList.toggle('progress-collapsed', !progressPanelExpanded);

        if (progressPanelExpanded) {
            progressPanel.setAttribute('tabindex', '-1');
            progressPanel.focus({ preventScroll: true });
        } else {
            progressPanel.removeAttribute('tabindex');
        }
    }

    if (progressDetailLayer) {
        progressDetailLayer.hidden = !progressPanelExpanded;
    }

    syncProgressToggleLabel(progressPanelExpanded);

    if (progressPanelExpanded && shouldHydrate !== false) {
        hydrateProgressDashboard('progress-toggle');
    }
}

function handleProgressToggleClick() {
    setProgressPanelExpanded(!progressPanelExpanded, true);
}

function handleProgressPanelKeydown(event) {
    if (event.key !== 'Escape' || !progressPanelExpanded) {
        return;
    }

    event.preventDefault();
    setProgressPanelExpanded(false, false);
    if (progressToggle) {
        progressToggle.focus({ preventScroll: true });
    }
}

function isProgressPanelSheetViewport() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 680px)').matches;
}

function resetProgressPanelDrag() {
    progressPanelDragStartY = 0;
    progressPanelDragLastY = 0;
    progressPanelDragPointerId = null;
    progressPanelDragCaptureTarget = null;

    if (progressPanel) {
        progressPanel.style.transform = '';
        progressPanel.classList.remove('is-dragging');
    }
}

function canStartProgressPanelDrag(event) {
    if (!progressPanelExpanded || !progressPanel || !isProgressPanelSheetViewport()) {
        return false;
    }

    if (event.target && event.target.closest && event.target.closest('.progress-sheet-handle')) {
        return true;
    }

    if (event.target && event.target.closest && event.target.closest('button, a, input, select, textarea, [role="tab"]')) {
        return false;
    }

    const panelRect = progressPanel.getBoundingClientRect();
    return event.clientY >= panelRect.top && event.clientY <= panelRect.top + 38;
}

function handleProgressPanelPointerDown(event) {
    if (!canStartProgressPanelDrag(event)) {
        return;
    }

    progressPanelDragStartY = event.clientY;
    progressPanelDragLastY = event.clientY;
    progressPanelDragPointerId = event.pointerId;
    progressPanelDragCaptureTarget = event.target && event.target.closest
        ? event.target.closest('.progress-sheet-handle') || progressPanel
        : progressPanel;
    progressPanel.classList.add('is-dragging');

    if (progressPanelDragCaptureTarget && typeof progressPanelDragCaptureTarget.setPointerCapture === 'function') {
        progressPanelDragCaptureTarget.setPointerCapture(event.pointerId);
    }
}

function handleProgressPanelPointerMove(event) {
    if (progressPanelDragPointerId !== event.pointerId || !progressPanel) {
        return;
    }

    progressPanelDragLastY = event.clientY;
    const dragDistance = Math.max(event.clientY - progressPanelDragStartY, 0);

    if (dragDistance > 4) {
        event.preventDefault();
    }

    const maxDragDistance = Math.max(progressPanel.offsetHeight || 0, window.innerHeight || 0);
    progressPanel.style.transform = 'translateY(' + Math.min(dragDistance, maxDragDistance) + 'px)';
}

function handleProgressPanelPointerEnd(event) {
    if (progressPanelDragPointerId !== event.pointerId || !progressPanel) {
        return;
    }

    const dragDistance = Math.max(progressPanelDragLastY - progressPanelDragStartY, 0);
    const shouldClose = dragDistance >= 72;

    if (progressPanelDragCaptureTarget && typeof progressPanelDragCaptureTarget.releasePointerCapture === 'function') {
        try {
            progressPanelDragCaptureTarget.releasePointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture may already be released by the browser.
        }
    }

    resetProgressPanelDrag();

    if (shouldClose) {
        setProgressPanelExpanded(false, false);
        if (progressToggle) {
            progressToggle.focus({ preventScroll: true });
        }
    }
}

function handleProgressPanelClick(event) {
    if (!progressPanelExpanded || !event.target || !event.target.closest) {
        return;
    }

    if (!event.target.closest('.progress-sheet-handle')) {
        return;
    }

    setProgressPanelExpanded(false, false);
    if (progressToggle) {
        progressToggle.focus({ preventScroll: true });
    }
}

function isEventInsideElement(event, element) {
    if (!event || !event.target || !element) {
        return false;
    }

    if (typeof event.composedPath === 'function') {
        return event.composedPath().includes(element);
    }

    return typeof element.contains === 'function' && element.contains(event.target);
}

function absorbLayerBackdropEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
    }
}

function handleAppLayerPointerDown(event) {
    if (isSettingsPanelOpen()) {
        if (!isEventInsideElement(event, settingsPanel) && !isEventInsideElement(event, settingsButton)) {
            settingsController.setPanelOpen(false);
            absorbLayerBackdropEvent(event);
        }

        return;
    }

    if (progressPanelExpanded && !isEventInsideElement(event, progressPanel)) {
        setProgressPanelExpanded(false, false);
        absorbLayerBackdropEvent(event);
    }
}

function installProgressHydrationObserver() {
    if (!todoForm || progressDashboardHydrated || progressHydrationObserver || typeof window.IntersectionObserver !== 'function') {
        return;
    }

    const progressPanel = document.querySelector('.progress-panel');

    if (!progressPanel) {
        return;
    }

    progressHydrationObserver = new window.IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
            hydrateProgressDashboard('visible');
        }
    }, {
        root: null,
        rootMargin: '160px 0px',
        threshold: 0.01
    });
    progressHydrationObserver.observe(progressPanel);
}

function ensureContributionGridObserver() {
    if (contributionGridObserverReady) {
        return;
    }

    installContributionGridObserver();
    contributionGridObserverReady = true;
}

function startBrowserReminderLoop() {
    if (browserReminderIntervalId) {
        return;
    }

    browserReminderIntervalId = window.setInterval(() => {
        sendBrowserTaskReminder(false);
    }, notificationController.getReminderIntervalMs());
}

function renderEssentialProgressDashboard() {
    renderStreakStats();
    renderMotivationPanel();
    renderDailyMission();
    renderProgressSections();
}

function hydrateProgressDashboard(reason) {
    if (!todoForm || progressDashboardHydrated) {
        return;
    }

    progressDashboardHydrated = true;
    progressHydrationScheduled = false;
    disconnectProgressHydrationObserver();
    renderProgressDashboard(reason);
}

function scheduleProgressHydration() {
    if (!todoForm || progressDashboardHydrated || progressHydrationScheduled) {
        return;
    }

    progressHydrationScheduled = true;
    installProgressHydrationObserver();
    requestIdleTask(() => hydrateProgressDashboard('idle'), 1400);
}

function runDeferredStartupWork() {
    deferredStartupScheduled = false;
    saveCompletionHistory();
    saveGamification();
    ensureAnalyticsDataFresh();

    if (todoForm) {
        if (progressDashboardHydrated) {
            renderProgressDashboard('startup');
        } else {
            hydrateProgressDashboard('startup');
        }
    }

    startBrowserReminderLoop();
}

function scheduleDeferredStartupWork() {
    if (deferredStartupScheduled) {
        return;
    }

    deferredStartupScheduled = true;
    requestIdleTask(runDeferredStartupWork, 1800);
}

function getLocalFeatureContext() {
    return {
        page: todoForm ? 'main' : 'unknown',
        dom: TASKLYZEN_DOM,
        settings: appSettings,
        getTodos: () => todos.slice(),
        getDailyGoal: () => dailyGoal,
        getActiveProgressView: () => activeProgressView,
        getAnalyticsSnapshot,
        getDailyMission,
        getCurrentStreak,
        showToast,
        renderCurrentPage
    };
}

function renderFeatureSurfaces() {
    betaFeatureControllers.render();
    renderRaceModeButton();
}

function renderRaceModeButton() {
    if (!focusModeButton) {
        return;
    }

    const launchState = betaFeatureControllers.focus.getLaunchState();
    const textNode = focusModeButton.querySelector('span:last-child');

    focusModeButton.hidden = false;
    focusModeButton.classList.toggle('has-resumable-session', launchState.resumable);
    focusModeButton.setAttribute('aria-label', launchState.resumable
        ? launchState.buttonLabel + ' para ' + launchState.todoTitle
        : 'Iniciar Modo Carrera');

    if (textNode) {
        textNode.textContent = launchState.buttonLabel;
    }
}

function startFocusModeFromApp() {
    const result = betaFeatureControllers.focus.openLauncher();

    if (result && result.status === 'empty') {
        showToast(result.message || 'No hay tareas disponibles para iniciar Modo Carrera.', 'info', { key: 'focus-mode-empty' });
    }
}

function handleFocusSessionComplete(record) {
    if (record) {
        sustainableProgressController.recordSession(record);
        normalizeGamification();
    }

    renderCurrentPage();
}

function syncRaceHistoryIntoSustainableProgress() {
    const focusState = featureRegistry.getFeatureState('focus-mode');
    const history = Array.isArray(focusState && focusState.history) ? focusState.history : [];
    const storedIds = new Set(
        sustainableProgressController.getDateKeys().flatMap(dateKey => (
            sustainableProgressController.getDaySnapshot(dateKey).sessions.map(session => session.id)
        ))
    );

    history.forEach(session => {
        if (!session || !session.id || storedIds.has(session.id)) {
            return;
        }

        sustainableProgressController.recordSession({
            ...session,
            focusMs: Number.isFinite(Number(session.focusMs)) ? session.focusMs : session.elapsedMs,
            selectedCount: Number(session.selectedCount) || (Array.isArray(session.sessionTodoIds) ? session.sessionTodoIds.length : 0)
        });
    });
}

function simulateSustainableSessionForDev(type) {
    const simulationType = ['meaningful', 'sustainable', 'suspicious'].includes(type) ? type : 'meaningful';
    const existingCount = sustainableProgressController.getDaySnapshot(getTodayKey()).sessions.length;
    const completedAtMs = Date.now() - ((existingCount + 1) * 2 * 60 * 60 * 1000);
    const sustainable = simulationType === 'sustainable';
    const suspicious = simulationType === 'suspicious';
    const focusMs = sustainable ? 50 * 60 * 1000 : suspicious ? 60 * 60 * 1000 : 25 * 60 * 1000;
    const breakMs = sustainable ? 5 * 60 * 1000 : 0;
    const record = {
        id: 'dev-sustainable-' + Date.now().toString(36) + '-' + simulationType,
        startedAt: new Date(completedAtMs - focusMs - breakMs).toISOString(),
        completedAt: new Date(completedAtMs).toISOString(),
        mode: 'free',
        result: 'manual',
        selectedCount: 1,
        completedCount: suspicious ? 0 : 1,
        completedSubtaskCount: 0,
        focusMs,
        breakMs,
        pausedMs: 0,
        awayMs: suspicious ? 55 * 60 * 1000 : 0,
        confirmedAwayMs: suspicious ? 55 * 60 * 1000 : 0,
        completedBreaks: sustainable ? 1 : 0,
        longBreaks: 0,
        pomodoroEnabled: sustainable,
        integrityFlags: []
    };
    const day = sustainableProgressController.recordSession(record);

    normalizeGamification();
    renderCurrentPage();
    return day;
}

function getStreakPrestigeLevel(streak) {
    return gamificationController.getStreakPrestigeLevel(streak);
}

function getStreakPrestigeClassNames() {
    return gamificationController.getStreakPrestigeClassNames();
}

function getNextStreakReward(streak) {
    return gamificationController.getNextStreakReward(streak);
}

function getContributionLevel(count) {
    return gamificationController.getContributionLevel(count);
}

function getVisibleContributionWeeks() {
    return gamificationUiController.getVisibleContributionWeeks();
}

function renderStreakStats() {
    gamificationUiController.renderStreakStats();
}

function renderStreakPrestigeRoad() {
    gamificationUiController.renderStreakPrestigeRoad();
}

function renderStreakSafety() {
    gamificationUiController.renderStreakSafety();
}

function renderRecommendedGoal() {
    analyticsProgressController.renderRecommendedGoal();
}

function renderPerformanceSummary(element, monthAnalytics, compact) {
    analyticsProgressController.renderPerformanceSummary(element, monthAnalytics, compact);
}

function renderMonthlyCompletionDonut(container, monthAnalytics, compact) {
    analyticsProgressController.renderMonthlyCompletionDonut(container, monthAnalytics, compact);
}

function renderAnalyticsTooltips() {
    analyticsProgressController.renderAnalyticsTooltips();
}

function renderMonthlyAnalytics() {
    analyticsProgressController.renderMonthlyAnalytics();
}

function renderWeeklyFlowChart(flowData, targetElement) {
    analyticsProgressController.renderWeeklyFlowChart(flowData, targetElement);
}

function renderDataAnalyticsSurfaces(clarity, monthAnalytics, flowAnalytics) {
    analyticsProgressController.renderDataAnalyticsSurfaces(clarity, monthAnalytics, flowAnalytics);
}

function renderAnalyticsPanel() {
    analyticsProgressController.renderAnalyticsPanel();
}
function getDailyMission() {
    return analyticsProgressController.getDailyMission();
}

function renderDailyMission() {
    analyticsProgressController.renderDailyMission();
}

function renderDailyClose() {
    analyticsProgressController.renderDailyClose();
}

function renderNextReward() {
    gamificationUiController.renderNextReward();
}

function renderMotivationPanel() {
    analyticsProgressController.renderMotivationPanel();
}

function renderContributionGrid() {
    gamificationUiController.renderContributionGrid();
}

function renderProgressDashboard() {
    if (todoForm) {
        progressDashboardHydrated = true;
        ensureContributionGridObserver();
    }

    analyticsProgressController.renderProgressDashboard();
}

function getNextMidnightRefreshAt() {
    return addDays(getStartOfDay(new Date()), 1);
}

function getNextTaskStateRefreshAt() {
    const now = Date.now();
    const transitionTimes = [];

    todos.forEach(todo => {
        if (!todo || todo.completed) {
            return;
        }

        const deadline = getTodoDeadlineInfo(todo);
        const soonAt = deadline.hasDeadline && deadline.deadlineAt
            ? new Date(deadline.deadlineAt.getTime() - (TASK_DEADLINE_SOON_HOURS * 3600000))
            : null;

        [soonAt, deadline.deadlineAt].forEach(date => {
            if (date instanceof Date && !Number.isNaN(date.getTime()) && date.getTime() > now) {
                transitionTimes.push(date.getTime());
            }
        });
    });

    if (todos.length > 0) {
        transitionTimes.push(getNextMidnightRefreshAt().getTime());
    }

    if (transitionTimes.length === 0) {
        return null;
    }

    return new Date(Math.min(...transitionTimes));
}

function scheduleTaskStateRefresh(customDelay) {
    window.clearTimeout(taskStateRefreshTimer);

    if (!todoForm || todos.length === 0) {
        taskStateRefreshTimer = null;
        return;
    }

    const nextRefreshAt = getNextTaskStateRefreshAt();
    const calculatedDelay = nextRefreshAt
        ? nextRefreshAt.getTime() - Date.now() + TASK_STATE_REFRESH_BUFFER_MS
        : TASK_STATE_REFRESH_MAX_DELAY_MS;
    const requestedDelay = Number.isFinite(customDelay) ? customDelay : calculatedDelay;
    const delay = Math.max(
        TASK_STATE_REFRESH_MIN_DELAY_MS,
        Math.min(requestedDelay, TASK_STATE_REFRESH_MAX_DELAY_MS)
    );

    taskStateRefreshTimer = window.setTimeout(refreshTimeSensitiveTaskState, delay);
}

function refreshTimeSensitiveTaskState() {
    taskStateRefreshTimer = null;

    if (!todoForm) {
        return;
    }

    if (taskUiController.getEditingTodoId()) {
        scheduleTaskStateRefresh(TASK_STATE_REFRESH_EDIT_RETRY_MS);
        return;
    }

    processOverdueRetention(true);
    renderCurrentPage();
}

function renderApp() {
    taskUiController.renderTaskSurface();
    renderCompactProgressWidget();

    if (!progressDashboardHydrated && activeProgressView === 'today') {
        renderEssentialProgressDashboard();
        scheduleProgressHydration();
        return;
    }

    renderProgressDashboard();
}

function renderCurrentPage() {
    if (todoForm) {
        renderApp();
        overdueReviewController.refresh();
        notifyDeadlineRisks();
    }

    renderFeatureSurfaces();
    refreshDeveloperPanel();
}

function renderTodoList() {
    taskUiController.renderTodoList();
}

function addTodoItem(text, priority, options) {
    const config = options || {};
    const todo = taskManager.create(text, priority, options);

    todos.push(todo);
    saveTodoList();
    logAnalyticsEvent('task_created', {
        todoId: todo.id,
        text: todo.text,
        priority: todo.priority,
        habit: todo.habit,
        timeLimitDays: todo.timeLimitDays,
        dueDate: todo.dueDate,
        createdOn: todo.createdOn,
        createdAt: todo.createdAt,
        deadlineStartedAt: todo.deadlineStartedAt,
        scheduledFor: todo.snoozedUntil || todo.createdOn
    });
    if (!config.silent) {
        // showToast(config.habit ? 'Hábito agregado correctamente.' : 'Tarea agregada correctamente.', 'success');
    }
    processOverdueRetention(true);
    renderCurrentPage();
}

function editTodoItem(id) {
    taskUiController.setEditingTodoId(id, false);
    renderCurrentPage();
}

function saveEditedTodoItem(id) {
    const todo = todos.find(item => item.id === id);
    const editDraft = taskUiController.getEditDraft(id);

    if (!todo || !editDraft.input || !editDraft.priorityInput || !editDraft.timeLimitInput) {
        return;
    }

    const cleanText = editDraft.text;
    const previousText = todo.text;
    const previousPriority = todo.priority;
    const previousDueDate = getTaskDueDate(todo);

    if (!cleanText) {
        editDraft.input.focus();
        return;
    }

    todo.text = cleanText;
    todo.priority = editDraft.priority;
    todo.dueDate = normalizeTaskDueDate(editDraft.dueDate);
    todo.updatedAt = getNowTimestamp();
    taskUiController.clearEditingTodo(false);
    saveTodoList();
    logAnalyticsEvent('task_edited', {
        todoId: todo.id,
        text: todo.text,
        previousPriority,
        nextPriority: todo.priority,
        previousDueDate,
        nextDueDate: todo.dueDate,
        dueDate: todo.dueDate,
        timeLimitDays: todo.timeLimitDays,
        textChanged: previousText !== cleanText
    });
    syncCompletionHistory();
    processOverdueRetention(true);
    renderCurrentPage();
}

function cancelEditTodoItem() {
    taskUiController.clearEditingTodo(false);
    renderCurrentPage();
}

function logTodoRemoval(todo, type) {
    logAnalyticsEvent(type || 'task_deleted', {
        todoId: todo.id,
        text: todo.text,
        priority: todo.priority,
        habit: todo.habit,
        timeLimitDays: todo.timeLimitDays,
        dueDate: todo.dueDate,
        createdOn: todo.createdOn,
        createdAt: todo.createdAt,
        deadlineStartedAt: todo.deadlineStartedAt,
        completedOn: todo.completedOn,
        completedAt: todo.completedAt,
        wasCompleted: todo.completed,
        ageDays: getTodoAgeDays(todo)
    });
}

function removeOverdueTasks(taskItems, eventType) {
    const requestedIds = new Set((Array.isArray(taskItems) ? taskItems : []).map(todo => todo && todo.id).filter(Boolean));
    const removableTodos = todos.filter(todo => requestedIds.has(todo.id));

    if (removableTodos.length === 0) {
        return false;
    }

    try {
        removableTodos.forEach(todo => {
            removeNextHabitOccurrence(todo);
            logTodoRemoval(todo, eventType || 'task_deleted');
        });

        todos = todos.filter(todo => !requestedIds.has(todo.id));
        saveTodoList();
        syncCompletionHistory();
        return true;
    } catch (error) {
        showToast('No se pudieron eliminar las tareas vencidas. Intenta de nuevo.', 'error', {
            critical: true,
            key: 'overdue-delete-failed'
        });
        return false;
    }
}

function processOverdueRetention(shouldNotify, options) {
    const retentionOptions = options || {};
    const targetIds = Array.isArray(retentionOptions.taskIds)
        ? new Set(retentionOptions.taskIds.filter(id => typeof id === 'string' && id))
        : null;
    const autoDeleteTodos = overdueReviewController.getAutoDeleteTasks()
        .filter(todo => !targetIds || targetIds.has(todo.id));

    if (autoDeleteTodos.length > 0 && removeOverdueTasks(autoDeleteTodos, 'task_auto_deleted') && shouldNotify) {
        showToast(
            'Se eliminaron autom\u00e1ticamente ' + autoDeleteTodos.length + ' ' + (autoDeleteTodos.length === 1
                ? 'tarea que llevaba al menos 30 d\u00edas vencida.'
                : 'tareas que llevaban al menos 30 d\u00edas vencidas.'),
            'info',
            {
                critical: true,
                key: 'overdue-auto-delete'
            }
        );
    }

    if (retentionOptions.refresh !== false) {
        overdueReviewController.refresh();
    }
    return autoDeleteTodos.length;
}

function clearCompletedTodos() {
    const cleanableResult = taskManager.clearCompleted(todos);
    const cleanableTodos = cleanableResult.removedTodos;

    if (cleanableTodos.length === 0) {
        return;
    }

    cleanableTodos.forEach(todo => {
        logTodoRemoval(todo, 'task_deleted');
    });

    todos = cleanableResult.todos;
    saveTodoList();
    syncCompletionHistory();
    renderCurrentPage();
}

function reactivateTodoForToday(todo) {
    const completedOn = getCompletionDateKey(todo);
    const reactivatedAt = taskManager.reactivate(todo).reactivatedAt;

    if (todo && completedOn === getTodayKey()) {
        sustainableProgressController.revokeTaskCompletion(todo.id, completedOn);
    }

    return reactivatedAt;
}

function getCompletionDateKey(item) {
    return item && (item.completedOn || getDateKeyFromTimestamp(item.completedAt));
}

function revokeTodaySustainableCredits(todo) {
    if (!todo) return;
    const todayKey = getTodayKey();

    if (getCompletionDateKey(todo) === todayKey) {
        sustainableProgressController.revokeTaskCompletion(todo.id, todayKey);
    }

    if (Array.isArray(todo.subtasks)) {
        todo.subtasks.forEach(subtask => {
            if (!subtask.optional && subtask.completed && getDateKeyFromTimestamp(subtask.completedAt) === todayKey) {
                sustainableProgressController.revokeSubtaskCompletion(todo.id, subtask.id, todayKey);
            }
        });
    }
}

function toggleTodoItem(id, options) {
    const actionContext = options || {};
    const todo = todos.find(item => item.id === id);
    const wasCompleted = todo ? todo.completed : false;
    let streakCelebrationContext = null;

    if (!todo) {
        return;
    }

    if (TASKLYZEN_COMPOSITE_TASKS.isCompositeTask(todo)) {
        taskUiController.setExpandedTodo(todo.id, true, true);
        return;
    }

    if (!wasCompleted) {
        audioController.unlock();
    }

    if (todo.completed) {
        const reactivatedAt = reactivateTodoForToday(todo);
        const todayKey = getTodayKey();

        removeNextHabitOccurrence(todo);
        logAnalyticsEvent('task_reactivated', {
            todoId: todo.id,
            text: todo.text,
            priority: todo.priority,
            habit: todo.habit,
            timeLimitDays: todo.timeLimitDays,
            dueDate: todo.dueDate,
            createdOn: todo.createdOn,
            createdAt: todo.createdAt,
            reactivatedOn: todayKey,
            reactivatedAt,
            deadlineStartedAt: todo.deadlineStartedAt
        });
    } else {
        const todayKey = getTodayKey();
        const completedAt = getNowTimestamp();
        const previousTodayCount = getHistoryCount(todayKey);
        const previousRecord = getLongestActiveStreak();
        const nextTodayCount = previousTodayCount + 1;
        let celebrationType = 'regular';

        taskManager.complete(todo, { completedOn: todayKey, completedAt });
        sustainableProgressController.recordTaskCompletion(todo, {
            dateKey: todayKey,
            completedAt,
            source: actionContext.source || 'tasks',
            sessionId: actionContext.sessionId || null
        });

        if (previousTodayCount === 0 && !gamificationController.hasCelebratedStreakDate(todayKey)) {
            streakCelebrationContext = { todayKey, previousRecord };
        }

        if (nextTodayCount === dailyGoal) {
            celebrationType = 'goal';
        } else if (nextTodayCount > dailyGoal) {
            celebrationType = 'legendary';
        }

        if (celebrationType === 'regular') {
            playCompletionSound(celebrationType);
        } else {
            showCompletionAnimation(celebrationType);
        }

        createNextHabitOccurrence(todo);
        logAnalyticsEvent('task_completed', {
            todoId: todo.id,
            text: todo.text,
            priority: todo.priority,
            habit: todo.habit,
            timeLimitDays: todo.timeLimitDays,
            dueDate: todo.dueDate,
            createdOn: todo.createdOn,
            createdAt: todo.createdAt,
            deadlineStartedAt: todo.deadlineStartedAt,
            completedOn: todo.completedOn,
            completedAt: todo.completedAt,
            completionValue: todo.completionValue,
            hoursToComplete: getHoursBetween(todo.createdAt, completedAt)
        });
    }

    saveTodoList();
    syncCompletionHistory();

    if (streakCelebrationContext) {
        const updatedStreak = getCurrentStreak();

        gamificationController.markStreakDateCelebrated(streakCelebrationContext.todayKey);
        showStreakDayCelebration(updatedStreak, {
            isRecord: updatedStreak > streakCelebrationContext.previousRecord
        });
    }

    renderCurrentPage();
}

function removeTodoItem(id) {
    const removalResult = taskManager.removeById(todos, id);
    const removedTodo = removalResult.removedTodo;

    if (removedTodo) {
        revokeTodaySustainableCredits(removedTodo);
        removeNextHabitOccurrence(removedTodo);
        logTodoRemoval(removedTodo, 'task_deleted');
    }

    todos = removalResult.todos;
    saveTodoList();

    if (removedTodo && removedTodo.completed) {
        syncCompletionHistory();
    }

    renderCurrentPage();
}

function logCompositeTransition(todo, transition) {
    if (!transition || !transition.changed) {
        return;
    }

    if (transition.completedNow) {
        logAnalyticsEvent('task_completed', {
            todoId: todo.id,
            text: todo.text,
            priority: todo.priority,
            habit: false,
            timeLimitDays: todo.timeLimitDays,
            dueDate: todo.dueDate,
            createdOn: todo.createdOn,
            createdAt: todo.createdAt,
            completedOn: todo.completedOn,
            completedAt: todo.completedAt,
            completionValue: todo.completionValue,
            composite: true,
            hoursToComplete: getHoursBetween(todo.createdAt, todo.completedAt)
        });
        showCompletionAnimation(getHistoryCount(getTodayKey()) + 1 >= dailyGoal ? 'goal' : 'regular');
    } else if (transition.reactivatedNow) {
        logAnalyticsEvent('task_reactivated', {
            todoId: todo.id,
            text: todo.text,
            priority: todo.priority,
            dueDate: todo.dueDate,
            createdOn: todo.createdOn,
            createdAt: todo.createdAt,
            reactivatedOn: getTodayKey(),
            reactivatedAt: todo.updatedAt,
            composite: true
        });
    }
}

function commitCompositeChange(todo, previousCompleted, options) {
    if (!todo) return false;
    const actionContext = options || {};
    const todayKey = getTodayKey();
    const previousTodayCount = getHistoryCount(todayKey);
    const previousRecord = getLongestActiveStreak();
    todo.completed = Boolean(previousCompleted);
    const transition = TASKLYZEN_COMPOSITE_TASKS.synchronizeCompositeTask(todo, { dateKey: todayKey });

    if (transition.completedNow) {
        sustainableProgressController.recordTaskCompletion(todo, {
            dateKey: todayKey,
            completedAt: todo.completedAt,
            source: actionContext.source || 'tasks',
            sessionId: actionContext.sessionId || null
        });
    } else if (transition.reactivatedNow) {
        sustainableProgressController.revokeTaskCompletion(todo.id, todayKey);
    }

    logCompositeTransition(todo, transition);
    saveTodoList();
    syncCompletionHistory();

    if (transition.completedNow && previousTodayCount === 0 && !gamificationController.hasCelebratedStreakDate(todayKey)) {
        const updatedStreak = getCurrentStreak();

        gamificationController.markStreakDateCelebrated(todayKey);
        showStreakDayCelebration(updatedStreak, {
            isRecord: updatedStreak > previousRecord
        });
    }

    renderCurrentPage();
    return true;
}

function addSubtaskToTodo(todoId, title, optional, options) {
    const config = options || {};
    const todo = todos.find(item => item.id === todoId);
    const cleanTitle = String(title || '').trim();
    if (!todo || !cleanTitle) {
        showToast('Escribe un título para la subtarea.', 'error');
        return false;
    }

    const currentSubtasks = TASKLYZEN_COMPOSITE_TASKS.isCompositeTask(todo) ? todo.subtasks : [];
    if (!TASKLYZEN_COMPOSITE_TASKS.isCompositeTask(todo) && optional) {
        showToast('La primera subtarea debe ser obligatoria.', 'error');
        return false;
    }
    if (currentSubtasks.some(subtask => subtask.title.toLocaleLowerCase('es') === cleanTitle.toLocaleLowerCase('es'))) {
        showToast('Esa subtarea ya existe.', 'error');
        return false;
    }

    if (!TASKLYZEN_COMPOSITE_TASKS.isCompositeTask(todo) && todo.completed) {
        if (!config.confirmed) {
            return {
                requiresConfirmation: true,
                message: 'La tarea se reactivará y se convertirá en una tarea con subtareas. Podrás completarla de nuevo al terminar sus pasos obligatorios.'
            };
        }
    }

    const previousCompleted = Boolean(todo.completed);
    todo.type = 'composite';
    todo.subtasks = currentSubtasks;
    todo.subtasks.push(TASKLYZEN_COMPOSITE_TASKS.createSubtask(cleanTitle, {
        optional: Boolean(optional),
        order: todo.subtasks.length
    }));

    return commitCompositeChange(todo, previousCompleted);
}

function toggleTodoSubtask(todoId, subtaskId, options) {
    const actionContext = options || {};
    const todo = todos.find(item => item.id === todoId);
    const subtask = todo && Array.isArray(todo.subtasks) ? todo.subtasks.find(item => item.id === subtaskId) : null;
    if (!subtask) return false;
    const wasCompleted = Boolean(subtask.completed);
    const previousCompletedAt = subtask.completedAt;
    if (!subtask.completed) {
        audioController.unlock();
    }
    const previousCompleted = Boolean(todo.completed);
    subtask.completed = !subtask.completed;
    subtask.completedAt = subtask.completed ? getNowTimestamp() : null;
    subtask.updatedAt = getNowTimestamp();
    const committed = commitCompositeChange(todo, previousCompleted, actionContext);

    if (committed && !subtask.optional) {
        if (!wasCompleted && subtask.completed) {
            sustainableProgressController.recordSubtaskCompletion(todo.id, subtask.id, {
                completedAt: subtask.completedAt,
                source: actionContext.source || 'tasks',
                sessionId: actionContext.sessionId || null
            });
        } else if (wasCompleted && !subtask.completed && getDateKeyFromTimestamp(previousCompletedAt) === getTodayKey()) {
            sustainableProgressController.revokeSubtaskCompletion(todo.id, subtask.id, getTodayKey());
        }
    }

    return committed;
}

function completeTodoFromFeature(todoId, context) {
    const todo = todos.find(item => item.id === todoId);

    if (!todo) {
        return false;
    }

    if (todo.completed) {
        return true;
    }

    if (TASKLYZEN_COMPOSITE_TASKS.isCompositeTask(todo)) {
        return TASKLYZEN_COMPOSITE_TASKS.isCompositeTaskCompleted(todo);
    }

    toggleTodoItem(todoId, {
        source: 'race',
        sessionId: context && context.sessionId
    });
    return Boolean(todos.find(item => item.id === todoId && item.completed));
}

function toggleSubtaskFromFeature(todoId, subtaskId, context) {
    return toggleTodoSubtask(todoId, subtaskId, {
        source: 'race',
        sessionId: context && context.sessionId
    });
}

function saveTodoSubtaskEdit(todoId, subtaskId, title, optional) {
    const todo = todos.find(item => item.id === todoId);
    const subtask = todo && Array.isArray(todo.subtasks) ? todo.subtasks.find(item => item.id === subtaskId) : null;
    if (!subtask) return false;
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
        showToast('El título de la subtarea no puede quedar vacío.', 'error');
        return false;
    }
    if (todo.subtasks.some(item => item.id !== subtask.id && item.title.toLocaleLowerCase('es') === cleanTitle.toLocaleLowerCase('es'))) {
        showToast('Esa subtarea ya existe.', 'error');
        return false;
    }
    const previousCompleted = Boolean(todo.completed);
    subtask.title = cleanTitle;
    subtask.optional = Boolean(optional);
    if (subtask.optional && !todo.subtasks.some(item => item.id !== subtask.id && !item.optional)) {
        subtask.optional = false;
        showToast('Debe quedar al menos una subtarea obligatoria.', 'error');
    }
    subtask.updatedAt = getNowTimestamp();
    return commitCompositeChange(todo, previousCompleted);
}

function getSubtaskDeleteRequest(todoId, subtaskId) {
    const todo = todos.find(item => item.id === todoId);
    const subtask = todo && Array.isArray(todo.subtasks) ? todo.subtasks.find(item => item.id === subtaskId) : null;
    if (!subtask) return null;

    const otherRequired = todo.subtasks.filter(item => item.id !== subtaskId && !item.optional);
    if (!subtask.optional && otherRequired.length === 0) {
        const optionalReplacement = todo.subtasks.find(item => item.id !== subtaskId && item.optional);
        if (optionalReplacement) {
            return {
                strategy: 'promote-optional'
            };
        } else {
            return {
                strategy: 'convert-normal'
            };
        }
    }

    return {
        strategy: 'remove'
    };
}

function deleteTodoSubtask(todoId, subtaskId, strategy) {
    const todo = todos.find(item => item.id === todoId);
    const subtask = todo && Array.isArray(todo.subtasks) ? todo.subtasks.find(item => item.id === subtaskId) : null;
    if (!subtask) return false;
    const todayKey = getTodayKey();

    if (!subtask.optional && subtask.completed && getDateKeyFromTimestamp(subtask.completedAt) === todayKey) {
        sustainableProgressController.revokeSubtaskCompletion(todo.id, subtask.id, todayKey);
    }

    if (strategy === 'promote-optional') {
        const optionalReplacement = todo.subtasks.find(item => item.id !== subtaskId && item.optional);
        if (!optionalReplacement) return false;
        optionalReplacement.optional = false;
        if (optionalReplacement.completed && getDateKeyFromTimestamp(optionalReplacement.completedAt) === todayKey) {
            sustainableProgressController.recordSubtaskCompletion(todo.id, optionalReplacement.id, {
                dateKey: todayKey,
                completedAt: optionalReplacement.completedAt,
                source: 'tasks'
            });
        }
    }

    if (strategy === 'convert-normal') {
        revokeTodaySustainableCredits(todo);
        todo.type = 'normal';
        delete todo.subtasks;
        delete todo.compositeStatus;
        todo.completed = false;
        todo.completedOn = null;
        todo.completedAt = null;
        todo.deadlineStartedAt = getNowTimestamp();
        todo.updatedAt = todo.deadlineStartedAt;
        saveTodoList();
        syncCompletionHistory();
        renderCurrentPage();
        return true;
    }

    const previousCompleted = Boolean(todo.completed);
    todo.subtasks = todo.subtasks.filter(item => item.id !== subtaskId).map((item, index) => ({ ...item, order: index }));
    return commitCompositeChange(todo, previousCompleted);
}

function moveTodoSubtask(todoId, subtaskId, direction) {
    const todo = todos.find(item => item.id === todoId);
    if (!todo || !Array.isArray(todo.subtasks)) return;
    const index = todo.subtasks.findIndex(item => item.id === subtaskId);
    const nextIndex = index + Number(direction);
    if (index < 0 || nextIndex < 0 || nextIndex >= todo.subtasks.length) return;
    const reordered = todo.subtasks.slice();
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    todo.subtasks = reordered.map((item, order) => ({ ...item, order, updatedAt: getNowTimestamp() }));
    saveTodoList();
    renderCurrentPage();
}

function convertCompositeTodoToNormal(todoId) {
    const todo = todos.find(item => item.id === todoId);
    if (!TASKLYZEN_COMPOSITE_TASKS.isCompositeTask(todo)) return;
    revokeTodaySustainableCredits(todo);
    todo.type = 'normal';
    delete todo.subtasks;
    delete todo.compositeStatus;
    todo.completed = false;
    todo.completedOn = null;
    todo.completedAt = null;
    todo.deadlineStartedAt = getNowTimestamp();
    todo.updatedAt = todo.deadlineStartedAt;
    saveTodoList();
    syncCompletionHistory();
    renderCurrentPage();
    return true;
}

function createTodoFromInput(text, options) {
    const config = options || {};
    const newTodoText = String(text || '').trim();
    const shouldFocusOnError = config.focusOnError !== false;

    if (!newTodoText) {
        showToast('Escribe una tarea antes de anadirla.', 'error');
        if (shouldFocusOnError && todoInput) {
            todoInput.focus();
        }
        return false;
    }

    const duplicatedTask = todos.some(todo => todo.text.toLowerCase() === newTodoText.toLowerCase());

    if (duplicatedTask) {
        showToast('Esa tarea ya existe.', 'error');
        if (shouldFocusOnError && todoInput) {
            todoInput.focus();
            todoInput.select();
        }
        return false;
    }

    if (config.type === 'composite') {
        const validation = TASKLYZEN_COMPOSITE_TASKS.validateCompositeDraft(newTodoText, config.subtasks);
        if (!validation.valid) {
            showCompositeBuilderError(validation.message);
            return false;
        }
        config.subtasks = validation.subtasks;
    }

    addTodoItem(newTodoText, config.priority || 'normal', {
        type: config.type === 'composite' ? 'composite' : 'normal',
        subtasks: config.subtasks,
        habit: Boolean(config.habit),
        dueDate: Object.prototype.hasOwnProperty.call(config, 'dueDate') ? config.dueDate : null,
        silent: Boolean(config.silent)
    });

    return true;
}

function setTaskCreationOpen(isOpen, options) {
    if (!taskCreatePanel || !taskCreateToggle || !document.body) {
        return;
    }

    const config = options || {};
    const shouldOpen = Boolean(isOpen);

    document.body.classList.toggle('task-create-open', shouldOpen);
    taskCreatePanel.setAttribute('aria-hidden', (!shouldOpen).toString());
    taskCreateToggle.setAttribute('aria-expanded', shouldOpen.toString());
    taskCreateToggle.setAttribute('aria-label', shouldOpen ? 'Ocultar creacion de tarea' : 'Crear nueva tarea');

    if (shouldOpen && config.focus !== false && todoInput) {
        window.requestAnimationFrame(() => {
            taskCreatePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            todoInput.focus();
        });
    }
}

function toggleTaskCreationPanel() {
    const isOpen = document.body && document.body.classList.contains('task-create-open');
    setTaskCreationOpen(!isOpen, { focus: !isOpen });
}

function closeTaskCreationAfterCreate() {
    setTaskCreationOpen(false, { focus: false });
    if (taskCreateToggle) {
        taskCreateToggle.focus({ preventScroll: true });
    }
}

function handleTaskCreationKeydown(event) {
    if (event.key !== 'Escape' || !document.body || !document.body.classList.contains('task-create-open')) {
        return;
    }

    const isModalOpen = Boolean(
        (deleteDataDialog && deleteDataDialog.open)
        || (overdueReviewDialog && overdueReviewDialog.open)
        || (settingsPanel && settingsPanel.hidden === false)
    );

    if (isModalOpen) {
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    closeTaskCreationAfterCreate();
}

function handleFormSubmit(event) {
    event.preventDefault();
    const created = createTodoFromInput(todoInput.value, {
        type: taskTypeInput ? taskTypeInput.value : 'normal',
        subtasks: compositeDraftSubtasks,
        priority: priorityInput.value,
        habit: habitInput ? habitInput.checked : false,
        dueDate: timeLimitInput ? timeLimitInput.value : null,
        focusOnError: true
    });

    if (!created) {
        return;
    }

    todoInput.value = '';
    priorityInput.value = 'normal';
    if (timeLimitInput) {
        timeLimitInput.value = '';
        syncDueDateControls();
    }
    if (habitInput) {
        habitInput.checked = false;
    }
    resetCompositeBuilder();
    closeTaskCreationAfterCreate();
}

function getDueDatePresetButtons() {
    return todoForm ? Array.from(todoForm.querySelectorAll('[data-due-preset]')) : [];
}

function getDueDateField() {
    return todoForm ? todoForm.querySelector('.task-date-field') : null;
}

function getDueDatePresetFromValue(value) {
    if (!isDateKey(value)) {
        return 'none';
    }

    if (value === getTodayKey()) {
        return 'today';
    }

    if (value === getTomorrowKey()) {
        return 'tomorrow';
    }

    return 'custom';
}

function syncDueDateControls(activePreset) {
    if (!timeLimitInput) {
        return;
    }

    const dueDate = normalizeTaskDueDate(timeLimitInput.value);
    const preset = activePreset || getDueDatePresetFromValue(dueDate);
    const buttons = getDueDatePresetButtons();
    const customButton = buttons.find(button => button.dataset.duePreset === 'custom');

    timeLimitInput.value = dueDate || '';
    buttons.forEach(button => {
        const active = button.dataset.duePreset === preset;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active.toString());
    });

    if (customButton) {
        customButton.textContent = preset === 'custom' && dueDate
            ? getDateLabel(dueDate, { day: 'numeric', month: 'short' })
            : 'Elegir';
    }

    if (TASKLYZEN_TASK_CREATION_UI) {
        TASKLYZEN_TASK_CREATION_UI.syncDueDatePresetSelect(
            dueDateCompactSelect,
            preset,
            dueDate ? getDateLabel(dueDate, { day: 'numeric', month: 'short' }) : ''
        );
    }
}

function openCustomDueDatePicker() {
    const dateField = getDueDateField();

    if (!timeLimitInput) {
        return;
    }

    if (dateField) {
        dateField.classList.add('custom-open');
    }

    syncDueDateControls('custom');
    timeLimitInput.focus();

    if (typeof timeLimitInput.showPicker === 'function') {
        try {
            timeLimitInput.showPicker();
        } catch (error) {
            // El input queda visible como respaldo cuando el navegador no permite showPicker.
        }
    }
}

function setDueDatePreset(preset) {
    if (!timeLimitInput) {
        return;
    }

    if (preset === 'custom') {
        openCustomDueDatePicker();
        return;
    }

    const dateField = getDueDateField();

    if (preset === 'today') {
        timeLimitInput.value = getTodayKey();
    } else if (preset === 'tomorrow') {
        timeLimitInput.value = getTomorrowKey();
    } else {
        timeLimitInput.value = '';
    }

    if (dateField) {
        dateField.classList.remove('custom-open');
    }

    syncDueDateControls();
}

function handleDueDatePresetClick(event) {
    const dueDateButton = event.target.closest('[data-due-preset]');

    if (!dueDateButton || !todoForm || !todoForm.contains(dueDateButton)) {
        return;
    }

    setDueDatePreset(dueDateButton.dataset.duePreset);
}

function handleDueDateInputChange() {
    const dateField = getDueDateField();

    if (dateField) {
        dateField.classList.remove('custom-open');
    }

    syncDueDateControls();
}

function handleDueDateCompactSelectChange() {
    const preset = TASKLYZEN_TASK_CREATION_UI
        ? TASKLYZEN_TASK_CREATION_UI.getDueDatePreset(dueDateCompactSelect)
        : dueDateCompactSelect && dueDateCompactSelect.value;

    setDueDatePreset(preset || 'none');
}

function showCompositeBuilderError(message) {
    if (!compositeBuilderError) return;
    compositeBuilderError.textContent = message || '';
    compositeBuilderError.hidden = !message;
}

function renderCompositeBuilder() {
    if (!compositeTaskBuilder || !compositeBuilderList) return;
    const compositeSelected = Boolean(taskTypeInput && taskTypeInput.value === 'composite');
    const existingPrompt = compositeTaskBuilder.querySelector('.composite-builder-confirmation');

    if (existingPrompt) existingPrompt.remove();

    compositeTaskBuilder.hidden = !compositeSelected;
    compositeBuilderList.innerHTML = '';
    compositeDraftSubtasks.forEach((subtask, index) => {
        compositeBuilderList.appendChild(TASKLYZEN_UI_COMPONENTS.createCompositeDraftItem({
            documentRef: document,
            subtask,
            first: index === 0,
            last: index === compositeDraftSubtasks.length - 1
        }));
    });
    if (compositeBuilderCount) {
        compositeBuilderCount.textContent = compositeDraftSubtasks.length + ' añadida' + (compositeDraftSubtasks.length === 1 ? '' : 's');
    }
    if (pendingCompositeDraftDiscard && compositeSelected && TASKLYZEN_UI_COMPONENTS.createCompositeDraftDiscardPrompt) {
        compositeTaskBuilder.appendChild(TASKLYZEN_UI_COMPONENTS.createCompositeDraftDiscardPrompt({ documentRef: document }));
    }
}

function resetCompositeBuilder() {
    compositeDraftSubtasks = [];
    pendingCompositeDraftDiscard = false;
    if (taskTypeInput) taskTypeInput.value = 'normal';
    if (subtaskDraftInput) subtaskDraftInput.value = '';
    if (subtaskDraftOptional) subtaskDraftOptional.checked = false;
    showCompositeBuilderError('');
    renderCompositeBuilder();
}

function addCompositeDraftSubtask() {
    const title = subtaskDraftInput ? subtaskDraftInput.value.trim() : '';
    if (!title) {
        showCompositeBuilderError('Escribe un título para la subtarea.');
        if (subtaskDraftInput) subtaskDraftInput.focus();
        return;
    }
    if (compositeDraftSubtasks.some(item => item.title.toLocaleLowerCase('es') === title.toLocaleLowerCase('es'))) {
        showCompositeBuilderError('Esa subtarea ya está en la lista.');
        return;
    }
    compositeDraftSubtasks.push(TASKLYZEN_COMPOSITE_TASKS.createSubtask(title, {
        optional: Boolean(subtaskDraftOptional && subtaskDraftOptional.checked),
        order: compositeDraftSubtasks.length
    }));
    pendingCompositeDraftDiscard = false;
    subtaskDraftInput.value = '';
    if (subtaskDraftOptional) subtaskDraftOptional.checked = false;
    showCompositeBuilderError('');
    renderCompositeBuilder();
    subtaskDraftInput.focus();
}

function handleTaskTypeChange() {
    if (!taskTypeInput) return;
    if (taskTypeInput.value === 'normal' && compositeDraftSubtasks.length > 0) {
        taskTypeInput.value = 'composite';
        pendingCompositeDraftDiscard = true;
        showCompositeBuilderError('');
        renderCompositeBuilder();
        return;
    }
    pendingCompositeDraftDiscard = false;
    showCompositeBuilderError('');
    renderCompositeBuilder();
}

function handleCompositeBuilderClick(event) {
    const button = event.target.closest('[data-builder-action]');
    if (!button) return;
    const action = button.dataset.builderAction;

    if (action === 'cancel-discard-drafts') {
        pendingCompositeDraftDiscard = false;
        renderCompositeBuilder();
        return;
    }

    if (action === 'discard-drafts') {
        compositeDraftSubtasks = [];
        pendingCompositeDraftDiscard = false;
        if (taskTypeInput) taskTypeInput.value = 'normal';
        showCompositeBuilderError('');
        renderCompositeBuilder();
        return;
    }

    const index = compositeDraftSubtasks.findIndex(item => item.id === button.dataset.draftId);
    if (index < 0) return;
    pendingCompositeDraftDiscard = false;
    if (action === 'remove') compositeDraftSubtasks.splice(index, 1);
    if (action === 'up' && index > 0) [compositeDraftSubtasks[index - 1], compositeDraftSubtasks[index]] = [compositeDraftSubtasks[index], compositeDraftSubtasks[index - 1]];
    if (action === 'down' && index < compositeDraftSubtasks.length - 1) [compositeDraftSubtasks[index + 1], compositeDraftSubtasks[index]] = [compositeDraftSubtasks[index], compositeDraftSubtasks[index + 1]];
    compositeDraftSubtasks = compositeDraftSubtasks.map((item, order) => ({ ...item, order }));
    renderCompositeBuilder();
}

function handleFilterClick(event) {
    taskUiController.handleFilterClick(event);
}

function handleDailyGoalChange(event) {
    if (event.target.value === '') {
        dailyGoalInput.value = dailyGoal;
        return;
    }

    updateDailyGoal(event.target.value, true);
}

function handleDailyGoalInput(event) {
    updateDailyGoal(event.target.value, false);
}

function handleRecommendedGoalClick() {
    updateDailyGoal(applyRecommendedGoalButton.dataset.goal, true);
}

function handleProgressTabClick(event) {
    const button = event.target.closest('[data-progress-view]');

    analyticsProgressController.handleProgressTabClick(event);

    if (button) {
        hydrateProgressDashboard('progress-tab');
    }
}

function handleFlowPeriodChange(event) {
    hydrateProgressDashboard('flow-period');
    analyticsProgressController.handleFlowPeriodChange(event);
}

function handleNextActionComplete() {
    taskUiController.handleNextActionComplete();
}

function handleNextActionEdit() {
    taskUiController.handleNextActionEdit();
}

function handleClearCompletedTasksClick() {
    taskUiController.handleClearCompletedTasksClick();
}

function handleRescueClick() {
    rescueYesterday();
}

function handleTodoAction(event) {
    taskUiController.handleTodoAction(event);
}

function handleTodoKeydown(event) {
    taskUiController.handleTodoKeydown(event);
}

function isDeveloperStatePreviewTodo(todo) {
    return TASKLYZEN_DEVELOPER.isStatePreviewTodo(todo);
}

function refreshDeveloperPanel() {
    if (developerController) {
        developerController.refreshPanel();
    }
}

function installDeveloperModeCommand() {
    if (typeof window === 'undefined') {
        return;
    }

    const activateDeveloperMode = () => getDeveloperController().activate();

    window.activarModoDesarrollador = activateDeveloperMode;
    window.enableTodoDevMode = activateDeveloperMode;
    window.abrirPanelDesarrollador = () => {
        const controller = getDeveloperController();
        const api = window.todoDev || controller.activate();

        controller.ensurePanel();

        return api;
    };

    if (window.location && (window.location.search.includes('dev=1') || window.location.hash.toLowerCase() === '#dev')) {
        activateDeveloperMode();
    }
}

function handleNotificationsChange(event) {
    notificationController.handlePreferenceChange(event);
}

function handleNotificationPermissionClick() {
    notificationController.handlePermissionClick();
}

function handleNotificationTestClick() {
    notificationController.handleTestClick();
}

if (todoForm) {
    todoForm.addEventListener('submit', handleFormSubmit);
    todoForm.addEventListener('click', handleDueDatePresetClick);
    setTaskCreationOpen(false, { focus: false });
}

if (taskCreateToggle) {
    taskCreateToggle.addEventListener('click', toggleTaskCreationPanel);
}

if (taskCreateClose) {
    taskCreateClose.addEventListener('click', closeTaskCreationAfterCreate);
}

if (timeLimitInput) {
    timeLimitInput.addEventListener('change', handleDueDateInputChange);
    syncDueDateControls();
}

if (dueDateCompactSelect) {
    dueDateCompactSelect.addEventListener('change', handleDueDateCompactSelectChange);
}

if (taskTypeInput) {
    taskTypeInput.addEventListener('change', handleTaskTypeChange);
}

if (addSubtaskDraftButton) {
    addSubtaskDraftButton.addEventListener('click', addCompositeDraftSubtask);
}

if (subtaskDraftInput) {
    subtaskDraftInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addCompositeDraftSubtask();
        }
    });
}

if (compositeTaskBuilder) {
    compositeTaskBuilder.addEventListener('click', handleCompositeBuilderClick);
}

if (settingsButton) {
    settingsButton.addEventListener('click', () => {
        settingsController.togglePanel();
    });
}

if (settingsCloseButton) {
    settingsCloseButton.addEventListener('click', () => settingsController.setPanelOpen(false));
}

if (settingsPanel) {
    settingsPanel.addEventListener('change', settingsController.handleThemeChange);
}

if (settingsNotifications) {
    settingsNotifications.addEventListener('change', handleNotificationsChange);
}

if (settingsNotificationPermission) {
    settingsNotificationPermission.addEventListener('click', handleNotificationPermissionClick);
}

if (settingsNotificationTest) {
    settingsNotificationTest.addEventListener('click', handleNotificationTestClick);
}

if (settingsSound) {
    settingsSound.addEventListener('change', settingsController.handleSoundChange);
}

if (settingsSoundVolume) {
    settingsSoundVolume.addEventListener('input', settingsController.handleSoundVolumeInput);
}

if (settingsAnimations) {
    settingsAnimations.addEventListener('change', settingsController.handleAnimationsChange);
}

if (settingsSimplifiedAnalytics) {
    settingsSimplifiedAnalytics.addEventListener('change', settingsController.handleSimplifiedAnalyticsChange);
}

if (focusModeButton) {
    focusModeButton.addEventListener('click', startFocusModeFromApp);
}

if (settingsExportData) {
    settingsExportData.addEventListener('click', settingsController.exportData);
}

if (settingsImportData) {
    settingsImportData.addEventListener('click', settingsController.triggerImportFile);
}

if (settingsImportFile) {
    settingsImportFile.addEventListener('change', settingsController.handleImportFileChange);
}

if (settingsDeleteData) {
    settingsDeleteData.addEventListener('click', settingsController.openDeleteDataDialog);
}

if (deleteConfirmInput) {
    deleteConfirmInput.addEventListener('input', settingsController.updateDeleteConfirmationState);
}

if (cancelDeleteData) {
    cancelDeleteData.addEventListener('click', settingsController.closeDeleteDataDialog);
}

if (confirmDeleteData) {
    confirmDeleteData.addEventListener('click', settingsController.deleteAllData);
}

if (deleteDataDialog) {
    deleteDataDialog.addEventListener('click', settingsController.handleDeleteDialogClick);
}

if (todoList) {
    todoList.addEventListener('click', handleTodoAction);
    todoList.addEventListener('keydown', handleTodoKeydown);
}

if (taskToolbar) {
    taskToolbar.addEventListener('click', handleFilterClick);
}

if (clearCompletedTasksButton) {
    clearCompletedTasksButton.addEventListener('click', handleClearCompletedTasksClick);
}

if (dailyGoalInput) {
    dailyGoalInput.addEventListener('change', handleDailyGoalChange);
    dailyGoalInput.addEventListener('input', handleDailyGoalInput);
}

if (applyRecommendedGoalButton) {
    applyRecommendedGoalButton.addEventListener('click', handleRecommendedGoalClick);
}

if (progressTabs) {
    progressTabs.addEventListener('click', handleProgressTabClick);
}

if (progressToggle) {
    progressToggle.addEventListener('click', handleProgressToggleClick);
}

if (compactProgressWidget) {
    compactProgressWidget.addEventListener('click', handleCompactProgressWidgetClick);
}

document.addEventListener('click', handleCompactProgressDocumentClick);
document.addEventListener('keydown', handleProgressPanelKeydown);
document.addEventListener('keydown', handleCompactProgressKeydown);

function handleGlobalKeydownForTaskInput(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const isEditingTask = Boolean(taskUiController.getEditingTodoId());
    const hasExternalBlocker = Boolean((settingsPanel && settingsPanel.hidden === false)
        || (deleteDataDialog && deleteDataDialog.open)
        || (overdueReviewDialog && overdueReviewDialog.open)
        || (typeof onboardingOverlay !== 'undefined' && onboardingOverlay && onboardingOverlay.hidden === false)
        || document.activeElement.tagName === 'INPUT'
        || document.activeElement.tagName === 'TEXTAREA');

    if (isEditingTask || hasExternalBlocker) return;
    
    if (event.key.length === 1 || event.key === 'Enter') {
        const todoInput = document.getElementById('todo-input');
        if (todoInput) {
            if (event.key === 'Enter') {
                event.preventDefault();
            } else if (event.key.length === 1) {
                event.preventDefault();
                todoInput.value += event.key;
            }
            if (typeof setTaskCreationOpen === 'function') {
                setTaskCreationOpen(true, { focus: false });
            }
            todoInput.focus();
        }
    }
}
document.addEventListener('keydown', handleGlobalKeydownForTaskInput);
document.addEventListener('keydown', handleTaskCreationKeydown, true);

document.addEventListener('pointerdown', handleAppLayerPointerDown, true);

if (progressPanel) {
    progressPanel.addEventListener('pointerdown', handleProgressPanelPointerDown);
    progressPanel.addEventListener('click', handleProgressPanelClick);
}

document.addEventListener('pointermove', handleProgressPanelPointerMove);
document.addEventListener('pointerup', handleProgressPanelPointerEnd);
document.addEventListener('pointercancel', handleProgressPanelPointerEnd);

if (analyticsPeriodControl) {
    analyticsPeriodControl.addEventListener('click', handleFlowPeriodChange);
}

if (nextActionCompleteButton) {
    nextActionCompleteButton.addEventListener('click', handleNextActionComplete);
}

if (nextActionEditButton) {
    nextActionEditButton.addEventListener('click', handleNextActionEdit);
}

if (rescueButton) {
    rescueButton.addEventListener('click', handleRescueClick);
}


setProgressPanelExpanded(false, false);

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (progressDashboardHydrated && activeProgressView === 'streak') {
            scheduleContributionGridRender();
        }
    }, 120);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        betaFeatureControllers.focus.handleVisibilityChange(true);
        sendBrowserTaskReminder(false);
        return;
    }

    betaFeatureControllers.focus.handleVisibilityChange(false);
    refreshTimeSensitiveTaskState();
});

window.addEventListener('focus', refreshTimeSensitiveTaskState);

// Entrada de usuario y recuperación de sesión
const onboardingOverlay = document.getElementById('onboarding-overlay');
const onboardingSkipBtn = document.getElementById('onboarding-skip-btn');

let appStarted = false;
let startupRacePromptHandled = false;

function openStartupRacePrompt() {
    if (!appStarted || startupRacePromptHandled || (onboardingOverlay && !onboardingOverlay.hidden)) {
        return;
    }

    const launchState = betaFeatureControllers.focus.getLaunchState();

    if (!launchState.resumable) {
        return;
    }

    startupRacePromptHandled = true;
    window.setTimeout(() => {
        betaFeatureControllers.focus.openResumePrompt();
    }, 0);
}

function startApp() {
    if (appStarted) return;
    appStarted = true;
    installDeveloperModeCommand();
    featureRegistry.init();
    syncRaceHistoryIntoSustainableProgress();
    normalizeGamification();
    betaFeatureControllers.focus.prepareForEntry();
    renderCurrentPage();
    scheduleDeferredStartupWork();
    openStartupRacePrompt();
}
window.__TLZ_startApp = startApp;

window.addEventListener('tasklyzen:entry-ready', startApp);

if (window.TasklyzenAuth && typeof window.TasklyzenAuth.whenReady === 'function') {
    window.TasklyzenAuth.whenReady().then(entryState => {
        if (entryState.canEnter) {
            startApp();
        }
    });
} else {
    const loginStrategy = localStorage.getItem('tasklyzen-login-strategy');

    if (!loginStrategy && onboardingOverlay) {
        onboardingOverlay.hidden = false;
    } else {
        if (onboardingOverlay) onboardingOverlay.hidden = true;
        startApp();
    }

    if (onboardingSkipBtn) {
        onboardingSkipBtn.addEventListener('click', () => {
            localStorage.setItem('tasklyzen-login-strategy', 'local');
            onboardingOverlay.hidden = true;
            startApp();
        });
    }
}

window.addEventListener('pagehide', () => {
    const raceState = betaFeatureControllers.focus.getState();

    if (raceState.active && !raceState.suspended) {
        betaFeatureControllers.focus.leave();
    }
});

