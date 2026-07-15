/*
 * Modulo: referencias DOM
 * Proposito:
 * - Centralizar nodos compartidos por runtime y modulos de Tasklyzen.
 * Entradas:
 * - document ya cargado al final del body.
 * Salidas:
 * - window.TasklyzenDom con grupos por dominio y alias planos compatibles.
 */
(function exposeTasklyzenDom(global) {
    const doc = global.document;
    const byId = id => doc ? doc.getElementById(id) : null;
    const select = selector => doc ? doc.querySelector(selector) : null;
    const selectAll = selector => doc ? doc.querySelectorAll(selector) : [];

    const settings = {
        settingsButton: byId('settings-button'),
        settingsPanel: byId('settings-panel'),
        settingsCloseButton: byId('settings-close'),
        settingsThemeInputs: selectAll('input[name="settings-theme"]'),
        settingsSound: byId('settings-sound'),
        settingsSoundVolume: byId('settings-sound-volume'),
        settingsSoundVolumeValue: byId('settings-sound-volume-value'),
        settingsAnimations: byId('settings-animations'),
        settingsSimplifiedAnalytics: byId('settings-simplified-analytics'),
        settingsProgressModeInputs: selectAll('input[name="settings-progress-mode"]'),
        settingsFocusGoal: byId('settings-focus-goal'),
        settingsFocusGoalValue: byId('settings-focus-goal-value'),
        settingsBackgroundTimer: byId('settings-background-timer'),
        settingsExportData: byId('settings-export-data'),
        settingsImportData: byId('settings-import-data'),
        settingsImportFile: byId('settings-import-file'),
        settingsExperienceButton: byId('settings-experience-button'),
        settingsDeleteData: byId('settings-delete-data'),
        deleteDataDialog: byId('delete-data-dialog'),
        deleteConfirmCode: byId('delete-confirm-code'),
        deleteConfirmInput: byId('delete-confirm-input'),
        cancelDeleteData: byId('cancel-delete-data'),
        confirmDeleteData: byId('confirm-delete-data')
    };

    const notifications = {
        settingsNotifications: byId('settings-notifications'),
        settingsNotificationStatus: byId('settings-notification-status'),
        settingsNotificationStatusText: byId('settings-notification-status-text'),
        settingsNotificationPermission: byId('settings-notification-permission'),
        settingsNotificationTest: byId('settings-notification-test'),
        settingsNotificationGuide: byId('settings-notification-guide')
    };

    const tasks = {
        taskCreatePanel: byId('task-create-panel'),
        taskCreateToggle: byId('task-create-toggle'),
        taskCreateClose: byId('task-create-close'),
        todoForm: byId('todo-form'),
        todoInput: byId('todo-input'),
        taskTypeInput: byId('task-type-input'),
        priorityInput: byId('priority-input'),
        timeLimitInput: byId('time-limit-input'),
        dueDateCompactSelect: byId('due-date-compact-select'),
        habitInput: byId('habit-input'),
        compositeTaskBuilder: byId('composite-task-builder'),
        compositeBuilderCount: byId('composite-builder-count'),
        compositeBuilderList: byId('composite-builder-list'),
        compositeBuilderError: byId('composite-builder-error'),
        subtaskDraftInput: byId('subtask-draft-input'),
        subtaskDraftOptional: byId('subtask-draft-optional'),
        addSubtaskDraftButton: byId('add-subtask-draft'),
        quickCreateHint: byId('quick-create-hint'),
        quickCreateLayer: byId('quick-create-layer'),
        quickCreateTitle: byId('quick-create-title'),
        quickCreateStatus: byId('quick-create-status'),
        todoList: byId('todo-list'),
        taskCount: byId('task-count'),
        taskSummary: byId('task-summary'),
        taskToolbar: select('.task-toolbar'),
        taskFilterButtons: selectAll('.filter-button'),
        clearCompletedTasksButton: byId('clear-completed-tasks'),
        expiredTasksPanel: byId('expired-tasks-panel'),
        expiredTaskCount: byId('expired-task-count'),
        expiredTaskSummary: byId('expired-task-summary'),
        expiredTaskList: byId('expired-task-list'),
        nextActionCard: byId('next-action-card'),
        nextActionTitle: byId('next-action-title'),
        nextActionReason: byId('next-action-reason'),
        nextActionCompleteButton: byId('next-action-complete'),
        nextActionEditButton: byId('next-action-edit')
    };

    const feedback = {
        toast: byId('toast'),
        completionCelebration: byId('completion-celebration'),
        completionTitle: byId('completion-title')
    };

    const overdueReview = {
        overdueReviewDialog: byId('overdue-review-dialog'),
        overdueReviewTitle: byId('overdue-review-title'),
        overdueReviewCount: byId('overdue-review-count'),
        overdueReviewList: byId('overdue-review-list'),
        overdueReviewActions: byId('overdue-review-actions'),
        keepOverdueTasksButton: select('[data-overdue-review-action="keep"]'),
        deleteOverdueTasksButton: select('[data-overdue-review-action="request-delete"]'),
        overdueReviewConfirmation: byId('overdue-review-confirmation'),
        overdueReviewConfirmText: byId('overdue-review-confirm-text'),
        cancelDeleteOverdueButton: select('[data-overdue-review-action="cancel-delete"]'),
        confirmDeleteOverdueButton: byId('confirm-delete-overdue')
    };

    const progress = {
        progressPanel: byId('progress-panel'),
        compactProgressWidget: byId('compact-progress-widget'),
        compactProgressButtons: selectAll('[data-progress-shortcut]'),
        compactProgressToggle: byId('compact-progress-toggle'),
        compactProgressMenu: byId('compact-progress-menu'),
        compactProgressToday: byId('compact-progress-today'),
        compactProgressTodayBar: byId('compact-progress-today-bar'),
        compactProgressTodayItem: byId('compact-progress-today-item'),
        compactProgressTodayNote: byId('compact-progress-today-note'),
        compactProgressTodayStatus: byId('compact-progress-today-status'),
        compactProgressMissionItem: byId('compact-progress-mission-item'),
        compactProgressMissionTitle: byId('compact-progress-mission-title'),
        compactProgressMissionNote: byId('compact-progress-mission-note'),
        compactProgressMissionStatus: byId('compact-progress-mission-status'),
        compactProgressStreakChip: select('.compact-progress-streak'),
        compactProgressStreakMenuItem: byId('compact-progress-streak-menu-item'),
        compactProgressStreak: byId('compact-progress-streak'),
        compactProgressStreakNote: byId('compact-progress-streak-note'),
        compactProgressStreakStatus: byId('compact-progress-streak-status'),
        compactProgressWeek: byId('compact-progress-week'),
        compactProgressWeekItem: byId('compact-progress-week-item'),
        compactProgressWeekNote: byId('compact-progress-week-note'),
        compactProgressWeekStatus: byId('compact-progress-week-status'),
        progressToggle: byId('progress-toggle'),
        progressDetailLayer: byId('progress-detail-layer'),
        progressHeadingKicker: byId('progress-heading-kicker'),
        progressHeadingTitle: byId('progress-heading-title'),
        streakPill: select('.streak-pill'),
        streakCount: byId('streak-count'),
        streakLabel: byId('streak-label'),
        streakTier: byId('streak-tier'),
        progressTabs: select('.progress-tabs'),
        progressTabButtons: selectAll('[data-progress-view]'),
        progressSections: selectAll('[data-progress-section]'),
        motivationTitle: byId('motivation-title'),
        motivationMessage: byId('motivation-message'),
        dailyGoalCount: byId('daily-goal-count'),
        dailyGoalBar: byId('daily-goal-bar'),
        dailyGoalLabel: byId('daily-goal-label'),
        dailyGoalInput: byId('daily-goal-input'),
        dailyTaskGoalSetting: byId('daily-task-goal-setting'),
        dailyFocusGoalInput: byId('daily-focus-goal-input'),
        dailyFocusGoalSetting: byId('daily-focus-goal-setting'),
        recommendedTaskGoal: byId('recommended-task-goal'),
        dailyMissionCard: byId('daily-mission-card'),
        dailyMissionTitle: byId('daily-mission-title'),
        dailyMissionMessage: byId('daily-mission-message'),
        dailyMissionStatus: byId('daily-mission-status'),
        dailyCloseCard: byId('daily-close-card'),
        dailyCloseTitle: byId('daily-close-title'),
        dailyCloseSummary: byId('daily-close-summary'),
        recommendedGoalText: byId('recommended-goal-text'),
        applyRecommendedGoalButton: byId('apply-recommended-goal'),
        contributionGrid: byId('contribution-grid')
    };

    const analytics = {
        analyticsPeriodControl: byId('analytics-period-control'),
        analyticsPeriodButtons: selectAll('[data-analytics-period]'),
        analyticsCompletionRate: byId('analytics-completion-rate'),
        analyticsPrimaryLabel: byId('analytics-primary-label'),
        analyticsCompletionDetail: byId('analytics-completion-detail'),
        analyticsPeriodComparison: byId('analytics-period-comparison'),
        analyticsCompletionBar: byId('analytics-completion-bar'),
        analyticsProgressBar: select('.performance-progress'),
        weeklyFlowChart: byId('weekly-flow-chart'),
        focusFlowChart: byId('focus-flow-chart'),
        analyticsFocusTotal: byId('analytics-focus-total'),
        analyticsFocusSessions: byId('analytics-focus-sessions'),
        analyticsFocusAverage: byId('analytics-focus-average'),
        analyticsBalanceLabel: byId('analytics-balance-label'),
        analyticsBalanceTrack: select('.performance-balance-track'),
        analyticsBalanceCompleted: byId('analytics-balance-completed'),
        analyticsBalancePending: byId('analytics-balance-pending'),
        analyticsActionTitle: byId('analytics-action-title'),
        analyticsActionMessage: byId('analytics-action-message'),
        analyticsActiveDays: byId('analytics-active-days'),
        analyticsBestRhythm: byId('analytics-best-rhythm'),
        analyticsBestRhythmDetail: byId('analytics-best-rhythm-detail'),
        analyticsHabitDetail: byId('analytics-habit-detail'),
        analyticsHabitRate: byId('analytics-habit-rate'),
        analyticsHabitCount: byId('analytics-habit-count'),
        raceAnalyticsSummary: byId('race-analytics-summary'),
        raceAnalyticsMinutes: byId('race-analytics-minutes'),
        raceAnalyticsSessions: byId('race-analytics-sessions'),
        raceAnalyticsTargets: byId('race-analytics-targets'),
        analyticsInsights: byId('analytics-insights'),
        analyticsRings: byId('analytics-rings'),
        analyticsClarityBoard: byId('analytics-clarity-board'),
        backlogHealthCard: byId('backlog-health-card'),
        backlogHealthLevel: byId('backlog-health-level'),
        backlogHealthTitle: byId('backlog-health-title'),
        backlogHealthMessage: byId('backlog-health-message'),
        taskFunnel: byId('task-funnel'),
        consistencyStrip: byId('consistency-strip')
    };

    const gamification = {
        streakPrestigeRoad: byId('streak-prestige-road'),
        streakRouteSummary: byId('streak-route-summary'),
        streakHeroCard: byId('streak-hero-card'),
        streakHeroEmblem: byId('streak-hero-emblem'),
        streakHeroCount: byId('streak-hero-count'),
        streakHeroUnit: byId('streak-hero-unit'),
        streakHeroTier: byId('streak-hero-tier'),
        streakHeroStatus: byId('streak-hero-status'),
        streakRemaining: byId('streak-remaining'),
        activeStreakTotal: byId('active-streak-total'),
        perfectStreakTotal: byId('perfect-streak-total'),
        legendaryStreakTotal: byId('legendary-streak-total'),
        activeDaysTotal: byId('active-days-total'),
        bestDayTotal: byId('best-day-total'),
        recordStreakTotal: byId('record-streak-total'),
        shieldTotal: byId('shield-total'),
        shieldMessage: byId('shield-message'),
        streakSafetyCard: byId('streak-safety-card'),
        rescueButton: byId('rescue-button'),
        rewardTitle: byId('reward-title'),
        rewardMessage: byId('reward-message'),
        rewardCount: byId('reward-count'),
        rewardBar: byId('reward-bar'),
        nextRewardCard: byId('streak-hero-card'),
        streakDayCelebration: byId('streak-day-celebration'),
        streakCelebrationCard: byId('streak-celebration-card'),
        streakCelebrationEmblem: byId('streak-celebration-emblem'),
        streakCelebrationKicker: byId('streak-celebration-kicker'),
        streakCelebrationTitle: byId('streak-celebration-title'),
        streakCelebrationMessage: byId('streak-celebration-message')
    };

    const features = {
        focusModeButton: byId('focus-mode-button')
    };

    const experience = {
        dialog: byId('experience-dialog'),
        body: byId('experience-body'),
        kicker: byId('experience-kicker'),
        title: byId('experience-title'),
        progress: byId('experience-progress'),
        back: byId('experience-back'),
        next: byId('experience-next'),
        secondary: byId('experience-secondary')
    };

    const dev = {
        panelSelector: '.developer-panel',
        fieldSelector: '[data-dev-field]',
        actionSelector: '[data-dev-action]'
    };

    global.TasklyzenDom = Object.assign({
        settings,
        notifications,
        tasks,
        feedback,
        overdueReview,
        progress,
        analytics,
        gamification,
        features,
        experience,
        dev
    }, settings, notifications, tasks, feedback, overdueReview, progress, analytics, gamification, features, experience);
})(window);
