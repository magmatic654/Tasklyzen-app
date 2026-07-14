import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createLocalStorage() {
    const store = new Map();

    return {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key)
    };
}

function loadBrowserModule(context, fileName) {
    const source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
    vm.runInNewContext(source, context, { filename: fileName });
}

let uuidCounter = 0;
const context = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    RegExp,
    Set,
    Map,
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    localStorage: createLocalStorage(),
    crypto: { randomUUID: () => 'test-id-' + uuidCounter++ },
    window: null
};
context.window = context;
context.window.addEventListener = () => {};

loadBrowserModule(context, 'tasklyzen-config.js');
loadBrowserModule(context, 'tasklyzen-storage.js');
loadBrowserModule(context, 'tasklyzen-utils.js');
loadBrowserModule(context, 'tasklyzen-composite-tasks.js');
loadBrowserModule(context, 'tasklyzen-tasks.js');
loadBrowserModule(context, 'components/tasklyzen-ui-components.js');
loadBrowserModule(context, 'tasklyzen-overdue-review.js');
loadBrowserModule(context, 'components/tasklyzen-task-creation-ui.js');
loadBrowserModule(context, 'tasklyzen-settings.js');
loadBrowserModule(context, 'tasklyzen-notifications.js');
loadBrowserModule(context, 'tasklyzen-task-ui.js');
loadBrowserModule(context, 'tasklyzen-analytics-progress.js');
loadBrowserModule(context, 'tasklyzen-achievements.js');
loadBrowserModule(context, 'tasklyzen-gamification.js');
loadBrowserModule(context, 'tasklyzen-gamification-ui.js');
loadBrowserModule(context, 'tasklyzen-features.js');
loadBrowserModule(context, 'tasklyzen-developer.js');
loadBrowserModule(context, 'tasklyzen-oop.js');

const utils = context.TasklyzenUtils;
const tasks = context.TasklyzenTasks;
const compositeTasks = context.TasklyzenCompositeTasks;
const components = context.TasklyzenUiComponents;
const overdueReview = context.TasklyzenOverdueReview;
const taskCreationUi = context.TasklyzenTaskCreationUi;
const storage = context.TasklyzenStorage;
const settings = context.TasklyzenSettings;
const notifications = context.TasklyzenNotifications;
const taskUi = context.TasklyzenTaskUi;
const analyticsProgress = context.TasklyzenAnalyticsProgress;
const achievements = context.TasklyzenAchievements;
const gamification = context.TasklyzenGamification;
const gamificationUi = context.TasklyzenGamificationUi;
const features = context.TasklyzenFeatures;
const developer = context.TasklyzenDeveloper;
const oop = context.TasklyzenOOP;
const { TaskState, TaskManager, AnalyticsEngine, UIController } = oop;

assert.strictEqual(utils.isDateKey('2026-07-02'), true);
assert.strictEqual(utils.isDateKey('02-07-2026'), false);
assert.strictEqual(utils.createTimestampFromDateKey('2026-07-02'), '2026-07-02T12:00:00.000');
assert.strictEqual(utils.getHoursBetween('2026-07-02T10:00:00.000', '2026-07-02T12:30:00.000'), 2.5);

const compactDueDateSelect = {
    value: 'none',
    options: [
        { value: 'none', textContent: 'Sin fecha' },
        { value: 'today', textContent: 'Hoy' },
        { value: 'tomorrow', textContent: 'Mañana' },
        { value: 'custom', textContent: 'Elegir fecha' }
    ]
};
taskCreationUi.syncDueDatePresetSelect(compactDueDateSelect, 'custom', '10 jul');
assert.strictEqual(compactDueDateSelect.value, 'custom');
assert.strictEqual(compactDueDateSelect.options[3].textContent, 'Fecha: 10 jul');
assert.strictEqual(taskCreationUi.getDueDatePreset({ value: 'invalid' }), 'none');

const defaultTodo = tasks.createTodo('Probar modulo', 'normal');
assert.strictEqual(defaultTodo.timeLimitDays, 1);
assert.strictEqual(defaultTodo.dueDate, null);
assert.strictEqual(tasks.getTodoDeadlineState(defaultTodo), null);
assert.strictEqual(defaultTodo.completed, false);

const compositeDraft = [
    compositeTasks.createSubtask('Paso obligatorio', { optional: false }),
    compositeTasks.createSubtask('Paso opcional', { optional: true })
];
const compositeTodo = tasks.createTodo('Proyecto', 'important', { type: 'composite', subtasks: compositeDraft });
assert.strictEqual(compositeTasks.isCompositeTask(compositeTodo), true);
assert.strictEqual(compositeTasks.getCompositeTaskStatus(compositeTodo), 'in-progress');
assert.strictEqual(compositeTasks.getCompositeTaskProgress(compositeTodo).requiredTotal, 1);
compositeTodo.subtasks[0].completed = true;
let compositeTransition = compositeTasks.synchronizeCompositeTask(compositeTodo, {
    timestamp: '2026-07-10T12:00:00.000',
    dateKey: '2026-07-10'
});
assert.strictEqual(compositeTransition.completedNow, true);
assert.strictEqual(compositeTodo.completed, true);
assert.strictEqual(compositeTasks.getCompositeTaskStatus(compositeTodo), 'completed-with-optional-pending');
compositeTodo.subtasks[1].completed = true;
compositeTasks.synchronizeCompositeTask(compositeTodo, { timestamp: '2026-07-10T12:10:00.000' });
assert.strictEqual(compositeTasks.getCompositeTaskStatus(compositeTodo), 'fully-completed');
compositeTodo.subtasks[0].completed = false;
compositeTransition = compositeTasks.synchronizeCompositeTask(compositeTodo, { timestamp: '2026-07-10T12:20:00.000' });
assert.strictEqual(compositeTransition.reactivatedNow, true);
assert.strictEqual(compositeTodo.completed, false);
assert.strictEqual(compositeTasks.validateCompositeDraft('Proyecto', [compositeTasks.createSubtask('Solo opcional', { optional: true })]).valid, false);

const clampedTodo = tasks.createTodo('Limite maximo', 'normal', { timeLimitDays: 99 });
assert.strictEqual(clampedTodo.timeLimitDays, 3);
assert.strictEqual(utils.isDateKey(clampedTodo.dueDate), true);

const oldTodo = tasks.createTodo('Vieja', 'normal', {
    createdOn: '2026-06-01',
    createdAt: '2026-06-01T08:00:00.000',
    timeLimitDays: 1
});
assert.strictEqual(tasks.isTodoDeadlineLate(oldTodo), true);
assert.strictEqual(tasks.isTodoAvailableToday(oldTodo), false);
assert.strictEqual(tasks.getTodoDeadlineState(oldTodo).label, 'Vencida');
assert.strictEqual(tasks.getTodoUrgencyState(oldTodo).label, 'Vencida');

const overdueNow = new Date('2026-07-31T23:59:59.999');
const overdueCandidate = tasks.createTodo('Vencida por revisar', 'urgent', {
    dueDate: '2026-07-01',
    createdOn: '2026-06-30',
    createdAt: '2026-06-30T10:00:00.000'
});
assert.strictEqual(overdueReview.isOverdueTask(overdueCandidate, overdueNow, { taskApi: tasks }), true);
assert.strictEqual(overdueReview.getOverdueDays(overdueCandidate, new Date('2026-07-30T23:59:59.999'), { taskApi: tasks }), 29);
assert.strictEqual(overdueReview.shouldAutoDeleteTask(overdueCandidate, new Date('2026-07-30T23:59:59.999'), { taskApi: tasks, autoDeleteDays: 30 }), false);
assert.strictEqual(overdueReview.shouldAutoDeleteTask(overdueCandidate, overdueNow, { taskApi: tasks, autoDeleteDays: 30 }), true);

const completedOverdue = { ...overdueCandidate, id: 'completed-overdue', completed: true };
const undatedTodo = { ...overdueCandidate, id: 'undated', dueDate: null };
const invalidDateTodo = { ...overdueCandidate, id: 'invalid-date', dueDate: 'fecha-invalida' };
assert.strictEqual(overdueReview.isOverdueTask(completedOverdue, overdueNow, { taskApi: tasks }), false);
assert.strictEqual(overdueReview.isOverdueTask(undatedTodo, overdueNow, { taskApi: tasks }), false);
assert.strictEqual(overdueReview.shouldAutoDeleteTask(invalidDateTodo, overdueNow, { taskApi: tasks }), false);

const initialReviewState = overdueReview.normalizeReviewState(null);
assert.strictEqual(overdueReview.isReviewDue(initialReviewState, new Date('2026-07-10T12:00:00.000'), 7), true);
const pendingReviewState = overdueReview.createPendingReview(initialReviewState, [overdueCandidate], new Date('2026-07-10T12:00:00.000'));
assert.strictEqual(pendingReviewState.pending, true);
assert.deepStrictEqual(pendingReviewState.taskIds, [overdueCandidate.id]);
assert.strictEqual(overdueReview.getReviewTasks(pendingReviewState, [completedOverdue], overdueNow, { taskApi: tasks }).length, 0);
const keptReviewState = overdueReview.resolveReview(pendingReviewState, 'keep', new Date('2026-07-10T12:05:00.000'));
assert.strictEqual(overdueReview.isReviewDue(keptReviewState, new Date('2026-07-17T12:04:59.999'), 7), false);
assert.strictEqual(overdueReview.isReviewDue(keptReviewState, new Date('2026-07-17T12:05:00.000'), 7), true);

oldTodo.dueDate = utils.formatDateKey(utils.addDays(utils.getStartOfDay(new Date()), 1));
assert.strictEqual(tasks.isTodoDeadlineLate(oldTodo), false);
assert.strictEqual(tasks.isTodoAvailableToday(oldTodo), true);

storage.writeJson('sample', { ok: true });
assert.deepStrictEqual(storage.readJson('sample', null), { ok: true });
storage.writeText('mode', 'weekly');
assert.strictEqual(storage.readText('mode', null), 'weekly');
storage.remove('mode');
assert.strictEqual(storage.readText('mode', 'fallback'), 'fallback');

assert.strictEqual(features.plannedLocalFeatures.some(feature => feature.id === 'focus-mode' && feature.defaultEnabled === true), true);
assert.strictEqual(features.plannedLocalFeatures.some(feature => feature.id === 'local-summary'), false);
let featureInitCount = 0;
let featureRenderCount = 0;
let featureDestroyCount = 0;
let featureChangeCount = 0;
const featureRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'features-test',
    definitions: [
        {
            id: 'focus-mode',
            label: 'Focus Mode',
            defaultEnabled: false,
            defaultState: {
                active: false
            },
            init(_context, scope) {
                featureInitCount += 1;
                scope.updateState({ initialized: true }, { notify: false });
            },
            render() {
                featureRenderCount += 1;
            },
            destroy() {
                featureDestroyCount += 1;
            }
        }
    ],
    getContext: () => ({ page: 'test' }),
    onChange: () => {
        featureChangeCount += 1;
    }
});
featureRegistry.init();
assert.strictEqual(featureInitCount, 0);
assert.strictEqual(featureRegistry.isEnabled('focus-mode'), false);
assert.strictEqual(featureRegistry.setEnabled('focus-mode', true), true);
assert.strictEqual(featureInitCount, 1);
assert.strictEqual(featureRenderCount, 1);
assert.strictEqual(featureRegistry.getFeatureState('focus-mode').initialized, true);
featureRegistry.render();
assert.strictEqual(featureRenderCount, 2);
assert.strictEqual(storage.readJson('features-test', null).features['focus-mode'].enabled, true);
assert.strictEqual(featureRegistry.setEnabled('focus-mode', false), false);
assert.strictEqual(featureDestroyCount, 1);
assert.strictEqual(featureChangeCount >= 2, true);

const betaTodos = [
    { id: 'beta-1', text: 'Preparar reporte', createdOn: '2026-07-11', completed: true, completedOn: '2026-07-11', habit: false },
    { id: 'beta-2', text: 'Habito beta', createdOn: '2026-07-10', completed: true, completedOn: '2026-07-10', habit: true },
    { id: 'beta-3', text: 'Tarea pendiente', createdOn: '2026-07-12', completed: false, habit: false }
];
const betaRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'beta-features-test',
    definitions: features.plannedLocalFeatures
});
const betaControllers = features.createBetaFeatureControllers({
    registry: betaRegistry,
    getTodos: () => betaTodos,
    getCompletionHistory: () => ({ '2026-07-11': 1, '2026-07-10': 1 }),
    getDailyGoal: () => 1,
    getTopPriorityTodo: () => betaTodos[2],
    getNowTimestamp: () => '2026-07-12T10:00:00.000'
});
assert.strictEqual(betaRegistry.isEnabled('focus-mode'), true);
assert.strictEqual(betaControllers.summary, undefined);
assert.strictEqual(betaControllers.focus.start('beta-3').selectedTodoId, 'beta-3');
assert.strictEqual(betaControllers.focus.pause().status, 'paused');
assert.strictEqual(betaControllers.focus.resume().status, 'running');
assert.strictEqual(betaControllers.focus.exit().active, false);

const focusHito = {
    id: 'focus-hito',
    text: 'Hito en carrera',
    type: 'composite',
    completed: false,
    subtasks: [
        compositeTasks.createSubtask('Paso clave', { id: 'focus-step-1', optional: false }),
        compositeTasks.createSubtask('Paso opcional', { id: 'focus-step-2', optional: true })
    ]
};
const focusDraftRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'focus-draft-test',
    definitions: features.plannedLocalFeatures
});
const focusDraftControllers = features.createBetaFeatureControllers({
    registry: focusDraftRegistry,
    getTodos: () => [focusHito],
    getTopPriorityTodo: () => focusHito,
    getNowTimestamp: () => '2026-07-12T10:30:00.000',
    onToggleSubtask: (_todoId, subtaskId) => {
        const subtask = focusHito.subtasks.find(item => item.id === subtaskId);
        subtask.completed = !subtask.completed;
        compositeTasks.synchronizeCompositeTask(focusHito, {
            timestamp: '2026-07-12T10:30:00.000',
            dateKey: '2026-07-12'
        });
        return true;
    }
});
focusDraftControllers.focus.start('focus-hito');
assert.strictEqual(focusDraftControllers.focus.toggleSubtaskInFocus('focus-step-1'), true);
assert.strictEqual(focusHito.subtasks[0].completed, false);
assert.strictEqual(focusHito.completed, false);
assert.strictEqual(focusDraftControllers.focus.getState().focusSubtaskDraft.completions['focus-step-1'], true);
assert.deepStrictEqual(
    Array.from(focusDraftControllers.focus.getState().focusSubtaskDraft.order),
    ['focus-step-1', 'focus-step-2']
);
assert.strictEqual(focusDraftControllers.focus.toggleSubtaskInFocus('focus-step-1'), true);
assert.strictEqual(focusDraftControllers.focus.getState().focusSubtaskDraft.completions['focus-step-1'], false);
assert.deepStrictEqual(
    Array.from(focusDraftControllers.focus.getState().focusSubtaskDraft.order),
    ['focus-step-1', 'focus-step-2']
);
assert.strictEqual(focusDraftControllers.focus.toggleSubtaskInFocus('focus-step-1'), true);
assert.strictEqual(focusDraftControllers.focus.completeAndContinue().active, false);
assert.strictEqual(focusHito.subtasks[0].completed, true);
assert.strictEqual(focusHito.completed, true);

let raceNow = '2026-07-12T10:00:00.000Z';
const raceTodo = {
    id: 'race-timer',
    text: 'Preparar exposición',
    completed: false,
    habit: false
};
let completedRaceSession = null;
const raceSessionRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'race-session-test',
    definitions: features.plannedLocalFeatures
});
const raceSessionController = features.createBetaFeatureControllers({
    registry: raceSessionRegistry,
    getTodos: () => [raceTodo],
    getTopPriorityTodo: () => raceTodo,
    getNowTimestamp: () => raceNow,
    onCompleteTodo: todoId => {
        if (todoId === raceTodo.id) {
            raceTodo.completed = true;
            return true;
        }

        return false;
    },
    onSessionComplete: session => {
        completedRaceSession = session;
    }
});
raceSessionController.focus.start('race-timer', { mode: 'countdown', targetMs: 10 * 60 * 1000 });
assert.strictEqual(raceSessionController.focus.getState().mode, 'countdown');
assert.strictEqual(raceSessionController.focus.getState().targetMs, 10 * 60 * 1000);
raceNow = '2026-07-12T10:05:00.000Z';
raceSessionController.focus.pause();
assert.strictEqual(raceSessionController.focus.getState().sessionAccumulatedMs, 5 * 60 * 1000);
assert.strictEqual(raceSessionController.focus.getState().taskElapsedMsById['race-timer'], 5 * 60 * 1000);
raceSessionController.focus.resume();
raceNow = '2026-07-12T10:06:00.000Z';
const finishedRaceState = raceSessionController.focus.completeAndContinue();
assert.strictEqual(finishedRaceState.active, false);
assert.strictEqual(completedRaceSession.completedCount, 1);
assert.strictEqual(completedRaceSession.mode, 'countdown');
assert.strictEqual(completedRaceSession.targetReached, false);
assert.strictEqual(raceSessionController.focus.getWeeklySummary().sessions, 1);
assert.strictEqual(raceSessionController.focus.getWeeklySummary().successfulTargets, 1);

const normalizedSettings = settings.normalizeAppSettings({
    theme: 'custom',
    sound: true,
    soundVolume: 2
});
assert.strictEqual(normalizedSettings.theme, 'light');
assert.strictEqual(normalizedSettings.sound, true);
assert.strictEqual(normalizedSettings.soundVolume, 1);
assert.strictEqual(settings.normalizeAppSettings({ theme: 'dark' }).theme, 'dark');
assert.strictEqual(settings.normalizeSettingsVolume(-1), 0);

function createClassList() {
    const values = new Set();

    return {
        values,
        add: (...classNames) => classNames.forEach(className => values.add(className)),
        remove: (...classNames) => classNames.forEach(className => values.delete(className)),
        toggle(className, enabled) {
            if (enabled) {
                values.add(className);
            } else {
                values.delete(className);
            }
        },
        contains: className => values.has(className)
    };
}

function createFakeElement(tagName = 'div') {
    const element = {
        tagName: tagName.toUpperCase(),
        children: [],
        dataset: {},
        attributes: {},
        textContent: '',
        _innerHTML: '',
        style: {
            setProperty(name, value) {
                this[name] = String(value);
            },
            removeProperty(name) {
                delete this[name];
            }
        },
        value: '',
        disabled: false,
        hidden: false,
        parentElement: null,
        classList: createClassList(),
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        append(...nodes) {
            nodes.forEach(node => this.appendChild(node));
        },
        appendChild(node) {
            node.parentElement = this;
            this.children.push(node);
            return node;
        },
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const matches = [];
            const expectedClass = selector.startsWith('.') ? selector.slice(1) : null;

            function visit(node) {
                if (expectedClass && node.classList && node.classList.contains(expectedClass)) {
                    matches.push(node);
                }

                node.children.forEach(visit);
            }

            this.children.forEach(visit);
            return matches;
        },
        focus() {
            this.focused = true;
        },
        select() {
            this.selected = true;
        }
    };

    Object.defineProperty(element, 'className', {
        get() {
            return Array.from(this.classList.values).join(' ');
        },
        set(value) {
            this.classList.values.clear();
            String(value || '').split(/\s+/).filter(Boolean).forEach(className => this.classList.add(className));
        }
    });
    Object.defineProperty(element, 'innerHTML', {
        get() {
            return this._innerHTML;
        },
        set(value) {
            this._innerHTML = String(value || '');

            if (this._innerHTML === '') {
                this.children = [];
            }
        }
    });

    return element;
}

const bodyClassList = createClassList();
const bodyStyles = new Map();
context.document = {
    body: {
        classList: bodyClassList,
        style: {
            setProperty: (name, value) => bodyStyles.set(name, value),
            removeProperty: name => bodyStyles.delete(name)
        }
    },
    createElement: createFakeElement,
    createElementNS: (_namespace, tagName) => createFakeElement(tagName)
};

const emptyStateComponent = components.createEmptyState({
    documentRef: context.document,
    message: 'Sin datos'
});
assert.strictEqual(emptyStateComponent.className, 'empty-state');
assert.strictEqual(emptyStateComponent.textContent, 'Sin datos');

const taskDisplayComponent = components.createTaskDisplayContent({
    documentRef: context.document,
    todo: { id: 'todo-1', text: 'Tarea compacta', completed: false },
    expanded: false,
    actionsOpen: false
});
assert.strictEqual(taskDisplayComponent.content.querySelectorAll('.task-inline-action').length, 0);
assert.strictEqual(taskDisplayComponent.content.querySelectorAll('.task-more-button').length, 1);
assert.strictEqual(taskDisplayComponent.content.querySelectorAll('.task-menu-action').length, 2);
assert.strictEqual(taskDisplayComponent.content.querySelector('.task-more-button').attributes['aria-expanded'], 'false');

const compositeListComponent = components.createSubtaskList({
    documentRef: context.document,
    subtasks: compositeTodo.subtasks,
    composite: true,
    progressLabel: compositeTasks.getCompositeProgressLabel(compositeTodo)
});
assert.strictEqual(compositeListComponent.classList.contains('composite-details'), true);
assert.strictEqual(compositeListComponent.querySelectorAll('.subtask-item').length, 2);

const openActionTaskItem = components.createTaskListItem({
    documentRef: context.document,
    todo: { id: 'todo-1' },
    actionsOpen: true
});
assert.strictEqual(openActionTaskItem.classList.contains('actions-open'), true);

const summaryMetricComponent = components.createSummaryMetric({
    documentRef: context.document,
    value: '75%',
    label: 'Finalizacion',
    detail: 'Prueba',
    className: 'primary'
});
assert.strictEqual(summaryMetricComponent.className, 'summary-metric primary');
assert.strictEqual(summaryMetricComponent.children.length, 3);

const analyticsMetricComponent = components.createAnalyticsMetric({
    documentRef: context.document,
    value: '4',
    label: 'Promedio',
    detail: 'diario',
    className: 'compact'
});
assert.strictEqual(analyticsMetricComponent.className, 'summary-metric compact');

const performanceSummaryComponent = components.createPerformanceSummary({
    documentRef: context.document,
    focus: {
        tone: 'steady',
        title: 'Ritmo estable',
        message: 'Buen avance.',
        action: 'Siguiente paso.'
    },
    compact: true
});
assert.strictEqual(performanceSummaryComponent.className, 'monthly-performance-summary compact tone-steady');
assert.strictEqual(performanceSummaryComponent.children.length, 3);

const donutComponent = components.createMonthlyCompletionDonut({
    documentRef: context.document,
    monthAnalytics: {
        completedPercent: 60,
        completedActivities: 3,
        totalActivities: 5
    },
    compact: true
});
assert.strictEqual(donutComponent.className, 'monthly-comparison-bars monthly-donut-chart compact');
assert.strictEqual(donutComponent.children.length, 2);

const monthlyMetricComponent = components.createMonthlyMetricCard({
    documentRef: context.document,
    value: '90%',
    label: 'Actividades completadas',
    detail: '10% sin completar'
});
assert.strictEqual(monthlyMetricComponent.className, 'monthly-metric-card');
assert.strictEqual(monthlyMetricComponent.children.length, 3);

const recapStatComponent = components.createMonthlyRecapStat({
    documentRef: context.document,
    value: 4,
    label: 'hábitos'
});
assert.strictEqual(recapStatComponent.children.length, 2);

const flowChartComponent = components.createWeeklyFlowChart({
    documentRef: context.document,
    flow: { label: 'Semanal', completed: 2, captionSuffix: 'esta semana' },
    entries: [{ dateKey: '2026-07-01', completed: 2 }],
    points: [{ x: 20, y: 40, radius: 4.6, goalHit: true, entry: { dateKey: '2026-07-01', completed: 2 } }],
    axisLabels: [{ x: 20, y: 113, label: 'MIE' }],
    goalY: 50
});
assert.strictEqual(flowChartComponent.className, 'weekly-flow-chart weekly-line-chart');
assert.strictEqual(flowChartComponent.children.length, 2);

const achievementCardComponent = components.createAchievementCard({
    documentRef: context.document,
    achievement: {
        id: 'a1',
        title: 'Primer logro',
        message: 'Haz algo.',
        mark: 'A',
        rarity: 'rare',
        rarityLabel: 'Raro',
        categoryLabel: 'Diarias',
        statusLabel: 'Pendiente',
        type: 'single',
        progress: 0.5,
        collected: false,
        pending: false,
        repeatable: false
    },
    rarityText: 'Raro · Rango 3',
    showFeatureButton: true,
    canFeature: false,
    featureButtonText: 'Bloqueado'
});
assert.strictEqual(achievementCardComponent.classList.contains('achievement-card'), true);
assert.strictEqual(achievementCardComponent.classList.contains('rarity-rare'), true);

const featuredAchievementComponent = components.createFeaturedAchievementCard({
    documentRef: context.document,
    achievement: {
        title: 'Destacado',
        mark: 'D',
        rarity: 'epic',
        collected: true,
        pending: false
    },
    rarityText: 'Epico · Rango 4',
    statusText: 'Conseguido'
});
assert.strictEqual(featuredAchievementComponent.classList.contains('featured-achievement-card'), true);

const achievementSpotlightComponent = components.createAchievementSpotlight({
    documentRef: context.document,
    kind: 'next',
    achievement: {
        title: 'Siguiente logro',
        message: 'Avanza una vez más.',
        mark: 'S',
        rarity: 'uncommon',
        rarityLabel: 'Poco común',
        statusLabel: '1 por completar',
        progress: 0.5,
        collected: false,
        pending: false,
        unseen: false
    }
});
assert.strictEqual(achievementSpotlightComponent.classList.contains('achievement-spotlight'), true);
assert.strictEqual(achievementSpotlightComponent.classList.contains('achievement-spotlight-next'), true);
assert.strictEqual(featuredAchievementComponent.children.length, 2);

const prestigeStepComponent = components.createPrestigeStep({
    documentRef: context.document,
    level: {
        min: 7,
        label: 'Semana fuerte',
        className: 'streak-hot',
        rewardTitle: 'Semana fuerte',
        rewardMessage: 'Sigue asi.'
    },
    reached: true
});
assert.strictEqual(prestigeStepComponent.className, 'prestige-step streak-hot reached');

const lockedPrestigeStepComponent = components.createPrestigeStep({
    documentRef: context.document,
    level: {
        min: 14,
        label: 'Doble semana',
        className: 'streak-blaze',
        rewardTitle: 'Doble semana',
        rewardMessage: 'Sigue asi.'
    },
    reached: false
});
assert.strictEqual(lockedPrestigeStepComponent.className, 'prestige-step streak-blaze locked');
assert.strictEqual(lockedPrestigeStepComponent.children[0].className, 'prestige-lock-icon');
assert.strictEqual(lockedPrestigeStepComponent.children[0].textContent, '');
assert.strictEqual(lockedPrestigeStepComponent.children[1].textContent, 'En 14 días');
assert.strictEqual(lockedPrestigeStepComponent.title.includes('Doble semana'), false);

const currentPrestigeStepComponent = components.createPrestigeStep({
    documentRef: context.document,
    level: {
        min: 100,
        label: 'Mítica',
        className: 'streak-mythic',
        rewardTitle: 'Constancia brutal',
        rewardMessage: 'Sigue así.'
    },
    reached: true,
    state: 'current',
    quality: 4
});
assert.strictEqual(currentPrestigeStepComponent.classList.contains('is-current'), true);
assert.strictEqual(currentPrestigeStepComponent.children[0].classList.contains('prestige-mini-emblem'), true);
assert.strictEqual(currentPrestigeStepComponent.children[0].classList.contains('quality-4'), true);

const prestigeChapterComponent = components.createPrestigeChapter({
    documentRef: context.document,
    title: 'Prestigio',
    range: '100–500 días',
    steps: [currentPrestigeStepComponent]
});
assert.strictEqual(prestigeChapterComponent.className, 'prestige-chapter');
assert.strictEqual(prestigeChapterComponent.children[1].children.length, 1);

const contributionDayComponent = components.createContributionDay({
    documentRef: context.document,
    dateKey: '2026-07-02',
    count: 2,
    level: 2,
    isToday: true
});
assert.strictEqual(contributionDayComponent.classList.contains('contribution-day'), true);
assert.strictEqual(contributionDayComponent.classList.contains('today'), true);

const sharedTodoForm = createFakeElement('form');
const sharedSettingsButton = createFakeElement('button');
const sharedAnalyticsCompletionRate = createFakeElement('strong');
const sharedTaskToolbar = createFakeElement('div');
sharedTaskToolbar.className = 'task-toolbar';
const sharedFilterButton = createFakeElement('button');
sharedFilterButton.className = 'filter-button';
const sharedDomNodes = new Map([
    ['todo-form', sharedTodoForm],
    ['settings-button', sharedSettingsButton],
    ['analytics-completion-rate', sharedAnalyticsCompletionRate],
    ['analytics-action-title', createFakeElement('h4')]
]);
context.document.getElementById = id => sharedDomNodes.get(id) || null;
context.document.querySelector = selector => {
    if (selector === '.task-toolbar') {
        return sharedTaskToolbar;
    }

    return null;
};
context.document.querySelectorAll = selector => {
    if (selector === '.filter-button') {
        return [sharedFilterButton];
    }

    if (selector === 'input[name="settings-theme"]') {
        return [createFakeElement('input')];
    }

    return [];
};
loadBrowserModule(context, 'tasklyzen-dom.js');
assert.strictEqual(context.TasklyzenDom.settings.settingsButton, sharedSettingsButton);
assert.strictEqual(context.TasklyzenDom.tasks.todoForm, sharedTodoForm);
assert.strictEqual(context.TasklyzenDom.todoForm, context.TasklyzenDom.tasks.todoForm);
assert.strictEqual(context.TasklyzenDom.analytics.analyticsCompletionRate, sharedAnalyticsCompletionRate);
assert.strictEqual(context.TasklyzenDom.taskFilterButtons.length, 1);

const panelClassList = createClassList();
const controllerDom = {
    settingsPanel: {
        hidden: true,
        classList: panelClassList
    },
    settingsButton: {
        expanded: '',
        setAttribute(name, value) {
            if (name === 'aria-expanded') {
                this.expanded = value;
            }
        }
    },
    settingsThemeInputs: [
        { value: 'light', checked: false },
        { value: 'dark', checked: false }
    ],
    settingsNotifications: { checked: false },
    settingsSound: { checked: false },
    settingsSoundVolume: { value: '', disabled: false },
    settingsSoundVolumeValue: { textContent: '' },
    settingsAnimations: { checked: false },
    settingsSimplifiedAnalytics: { checked: false }
};
let settingsChange = null;
let settingsRenderCount = 0;
let settingsNotificationSyncCount = 0;
let settingsToast = null;
const settingsController = settings.createSettingsController({
    storage,
    storageKey: 'settings-test',
    storageKeys: {
        settings: 'settings-test',
        todos: 'todos-test'
    },
    dom: controllerDom,
    render: () => {
        settingsRenderCount += 1;
    },
    syncNotifications: () => {
        settingsNotificationSyncCount += 1;
    },
    showToast: (message, type) => {
        settingsToast = { message, type };
    },
    onChange: nextSettings => {
        settingsChange = nextSettings;
    }
});
assert.strictEqual(settingsController.load().theme, 'light');
settingsController.update({
    theme: 'dark',
    sound: true,
    soundVolume: 0.35,
    simplifiedAnalytics: true
}, 'Tema actualizado.');
assert.strictEqual(settingsChange.theme, 'dark');
assert.strictEqual(settingsRenderCount, 1);
assert.strictEqual(settingsNotificationSyncCount > 0, true);
assert.strictEqual(bodyClassList.contains('theme-dark'), true);
assert.strictEqual(bodyClassList.contains('analytics-simple'), true);
assert.strictEqual(bodyStyles.has('--blue'), false);
assert.strictEqual(controllerDom.settingsThemeInputs[1].checked, true);
assert.strictEqual(controllerDom.settingsSound.checked, true);
assert.strictEqual(controllerDom.settingsSoundVolume.value, 35);
assert.strictEqual(controllerDom.settingsSoundVolumeValue.textContent, '35%');
assert.deepStrictEqual(storage.readJson('settings-test', null).theme, 'dark');
assert.deepStrictEqual(settingsToast, { message: 'Tema actualizado.', type: 'info' });
settingsController.setPanelOpen(true);
assert.strictEqual(controllerDom.settingsPanel.hidden, false);
assert.strictEqual(controllerDom.settingsButton.expanded, 'true');
assert.strictEqual(JSON.stringify(settingsController.getStorageKeys()), JSON.stringify(['settings-test', 'todos-test']));

const notificationDom = {
    toast: {
        textContent: '',
        className: '',
        classList: createClassList()
    },
    settingsNotificationStatus: { className: '', textContent: '' },
    settingsNotificationStatusText: { textContent: '' },
    settingsNotificationPermission: { textContent: '', disabled: false },
    settingsNotificationTest: { disabled: false },
    settingsNotificationGuide: { textContent: '' }
};
const notificationController = notifications.createNotificationController({
    dom: notificationDom,
    getSettings: () => ({ notifications: true, sound: true })
});
assert.strictEqual(notificationController.getBrowserNotificationPermission(), 'unsupported');
notificationController.syncControls();
assert.strictEqual(notificationDom.settingsNotificationStatus.className, 'notification-status-card unsupported');
assert.strictEqual(notificationDom.settingsNotificationStatusText.textContent.includes('Estado:'), true);
assert.strictEqual(notificationDom.settingsNotificationPermission.disabled, true);
notificationController.showToast('Hola', 'success', { dedupe: false });
assert.strictEqual(notificationDom.toast.textContent, 'Hola');
assert.strictEqual(notificationDom.toast.className, 'toast show success');
notificationController.showToast('Meta diaria completa. Gran cierre.', 'success', { dedupe: false });
assert.strictEqual(notificationDom.toast.textContent, 'Hola');
notificationController.showToast('No se pudo guardar. Intenta de nuevo.', 'error', { dedupe: false });
assert.strictEqual(notificationDom.toast.textContent, 'No se pudo guardar. Intenta de nuevo.');
assert.strictEqual(notificationDom.toast.className, 'toast show error');

const reminderController = notifications.createNotificationController({
    getSettings: () => ({ notifications: true, sound: false }),
    getTodos: () => [{ id: 'late-1', text: 'Cerrar tarea vencida' }],
    getTodayKey: () => '2026-07-02',
    isDeadlineLate: todo => todo.id === 'late-1'
});
assert.strictEqual(reminderController.getBrowserReminderPayload().title, 'Tarea vencida');

const filterAllButton = createFakeElement('button');
filterAllButton.className = 'filter-button';
filterAllButton.dataset.filter = 'all';
const filterPendingButton = createFakeElement('button');
filterPendingButton.className = 'filter-button';
filterPendingButton.dataset.filter = 'pending';
const filterCompletedButton = createFakeElement('button');
filterCompletedButton.className = 'filter-button';
filterCompletedButton.dataset.filter = 'completed';
const taskToolbarElement = createFakeElement('div');
taskToolbarElement.append(filterAllButton, filterPendingButton, filterCompletedButton);
const taskTodos = [
    {
        id: 'task-1',
        text: 'Avance importante',
        priority: 'important',
        completed: false,
        dueDate: '2026-07-03'
    },
    {
        id: 'task-2',
        text: 'Tarea cerrada',
        priority: 'normal',
        completed: true,
        completedOn: '2026-07-02',
        completedAt: '2026-07-02T12:00:00.000',
        dueDate: null
    }
];
let taskRefreshCount = 0;
const taskUiController = taskUi.createTaskUiController({
    dom: {
        todoList: createFakeElement('ul'),
        taskCount: createFakeElement('span'),
        taskSummary: createFakeElement('p'),
        taskToolbar: taskToolbarElement,
        clearCompletedTasksButton: createFakeElement('button'),
        expiredTasksPanel: createFakeElement('section'),
        expiredTaskCount: createFakeElement('span'),
        expiredTaskSummary: createFakeElement('p'),
        expiredTaskList: createFakeElement('ul'),
        nextActionCard: createFakeElement('article'),
        nextActionTitle: createFakeElement('h3'),
        nextActionReason: createFakeElement('p'),
        nextActionCompleteButton: createFakeElement('button'),
        nextActionEditButton: createFakeElement('button')
    },
    documentRef: context.document,
    uiController: new oop.UIController({ documentRef: context.document }),
    getTodos: () => taskTodos,
    getDailyGoal: () => 2,
    getTodayKey: () => '2026-07-02',
    getHistoryCount: () => 0,
    getTopPriorityTodo: () => taskTodos[0],
    getTaskDueDate: todo => todo.dueDate,
    getTodoUrgencyState: todo => todo.completed ? null : { level: 'on-time', label: 'A tiempo', message: 'Lista para avanzar.' },
    isTodoSnoozedForToday: () => false,
    isTodoDeadlineLate: () => false,
    isTodoAvailableToday: todo => !todo.completed,
    isCompletedTodoCleanable: todo => todo.completed,
    scheduleRefresh: () => {
        taskRefreshCount += 1;
    }
});
taskUiController.renderTaskSurface();
assert.strictEqual(taskUiController.getStats().available, 1);
assert.strictEqual(taskUiController.getStats().completedToday, 1);
assert.strictEqual(taskUiController.getVisibleTodos().length, 1);
assert.strictEqual(taskUiController.getVisibleTodos()[0].id, 'task-1');
taskUiController.setFilter('all', false);
assert.strictEqual(taskUiController.getVisibleTodos().length, 2);
assert.strictEqual(taskUiController.getVisibleTodos()[0].id, 'task-1');
assert.strictEqual(taskUiController.getVisibleTodos()[1].id, 'task-2');
assert.strictEqual(taskUiController.getNextActionTodoId(), 'task-1');
assert.strictEqual(taskUiController.getPriorityLabel('important'), 'Importante');
taskUiController.setFilter('pending', false);
assert.strictEqual(taskUiController.getEmptyStateMessage(), 'No hay tareas pendientes. Crea una nueva para mantener el ritmo.');
assert.strictEqual(taskUiController.getStats().completed, 1);
assert.strictEqual(taskRefreshCount, 1);
taskUiController.setFilter('completed');
assert.strictEqual(taskUiController.getVisibleTodos().length, 1);
assert.strictEqual(taskUiController.getVisibleTodos()[0].id, 'task-2');

const directSubtaskDeleteCalls = [];
const directSubtaskDeleteController = taskUi.createTaskUiController({
    dom: {},
    documentRef: context.document,
    getTodos: () => [],
    onRequestSubtaskDelete: () => ({ strategy: 'remove' }),
    onDeleteSubtask: (todoId, subtaskId, strategy) => {
        directSubtaskDeleteCalls.push({ todoId, subtaskId, strategy });
    }
});
const directDeleteButton = createFakeElement('button');
directDeleteButton.dataset.action = 'delete-subtask';
directDeleteButton.dataset.subtaskId = 'step-direct';
const directDeleteTodoItem = createFakeElement('li');
directDeleteTodoItem.dataset.id = 'todo-direct';
directSubtaskDeleteController.handleTodoAction({
    target: {
        closest(selector) {
            if (selector === '[data-action]') return directDeleteButton;
            if (selector === '.todo-item') return directDeleteTodoItem;
            return null;
        }
    },
    preventDefault() {},
    stopPropagation() {}
});
assert.deepStrictEqual(directSubtaskDeleteCalls, [{
    todoId: 'todo-direct',
    subtaskId: 'step-direct',
    strategy: 'remove'
}]);

const achievementDefinitions = achievements.createAchievementDefinitions({
    getTodayHistory: () => 2,
    getDailyGoal: () => 3,
    getCleanDayProgress: () => 1,
    getCurrentStreak: () => 7,
    getPerfectStreak: () => 3,
    getLegendaryStreak: () => 0,
    getTotalCompletedTasks: () => 15,
    getBestDayTotal: () => 5,
    getCompletedPriorityCount: priority => priority === 'urgent' ? 10 : 4,
    getEarnedShields: () => 1,
    getActiveDaysTotal: () => 20,
    getUsedShields: () => 2
});
const dailyGoalAchievement = achievementDefinitions.find(achievement => achievement.id === 'daily-goal');
const urgentAchievement = achievementDefinitions.find(achievement => achievement.id === 'urgent-master-10');
assert.ok(achievementDefinitions.length > 20);
assert.strictEqual(dailyGoalAchievement.current(), 2);
assert.strictEqual(dailyGoalAchievement.target(), 3);
assert.strictEqual(urgentAchievement.current(), 10);
assert.strictEqual(urgentAchievement.target(), 10);

const gamificationTodayKey = utils.getTodayKey();
const gamificationYesterdayKey = utils.getDateKeyByOffset(gamificationTodayKey, -1);
let gamificationState = gamification.normalizeGamificationState({
    usedShields: 0,
    protectedDates: [],
    achievementStates: {},
    featuredAchievements: []
});
const normalizedUnseenState = gamification.normalizeGamificationState({ unseenAchievementIds: ['first-spark', 'first-spark'] });
assert.deepStrictEqual(Array.from(normalizedUnseenState.unseenAchievementIds), ['first-spark']);
let gamificationSaveCount = 0;
const gamificationController = gamification.createGamificationController({
    definitions: achievementDefinitions,
    rarities: context.TasklyzenConfig.achievementRarities,
    categories: context.TasklyzenConfig.achievementCategories,
    rarityKeys: context.TasklyzenConfig.achievementRarityKeys,
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
    featuredLimit: 3,
    utils,
    getGamification: () => gamificationState,
    setGamification: value => {
        gamificationState = value;
    },
    saveGamification: () => {
        gamificationSaveCount += 1;
    },
    getCompletionHistory: () => ({
        [gamificationTodayKey]: 2,
        [gamificationYesterdayKey]: 1
    }),
    getDailyGoal: () => 2
});
assert.strictEqual(gamificationController.getCurrentStreak(), 2);
assert.strictEqual(gamificationController.getPerfectStreak(), 1);
assert.strictEqual(gamificationController.getContributionLevel(3), 3);
gamificationController.syncAchievementCollection(false);
assert.strictEqual(gamificationController.getAllAchievements().find(achievement => achievement.id === 'first-spark').collected, true);
assert.strictEqual(gamificationSaveCount > 0, true);

let quietAchievementState = gamification.normalizeGamificationState({});
let normalShowcaseCount = 0;
const quietAchievementController = gamification.createGamificationController({
    definitions: achievementDefinitions,
    rarities: context.TasklyzenConfig.achievementRarities,
    categories: context.TasklyzenConfig.achievementCategories,
    rarityKeys: context.TasklyzenConfig.achievementRarityKeys,
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
    utils,
    getGamification: () => quietAchievementState,
    setGamification: value => {
        quietAchievementState = value;
    },
    saveGamification: () => {},
    getCompletionHistory: () => ({ [gamificationTodayKey]: 2 }),
    getDailyGoal: () => 2,
    queueAchievementShowcase: () => {
        normalShowcaseCount += 1;
    }
});
quietAchievementController.syncAchievementCollection(true);
assert.strictEqual(normalShowcaseCount, 0);
assert.strictEqual(quietAchievementController.getUnseenAchievements().length > 0, true);
assert.strictEqual(quietAchievementController.markAchievementsSeen(), true);
assert.strictEqual(quietAchievementController.getUnseenAchievements().length, 0);

let pendingStreakState = gamification.normalizeGamificationState({});
const pendingStreakController = gamification.createGamificationController({
    definitions: [],
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
    utils,
    getGamification: () => pendingStreakState,
    setGamification: value => {
        pendingStreakState = value;
    },
    saveGamification: () => {},
    getCompletionHistory: () => ({
        [gamificationYesterdayKey]: 1
    })
});
assert.strictEqual(pendingStreakController.getCurrentStreak(), 1);
assert.strictEqual(pendingStreakController.hasCelebratedStreakDate(gamificationTodayKey), false);
assert.strictEqual(pendingStreakController.markStreakDateCelebrated(gamificationTodayKey), true);
assert.strictEqual(pendingStreakController.hasCelebratedStreakDate(gamificationTodayKey), true);

const featuredAchievementList = createFakeElement('div');
const featuredAchievementHint = createFakeElement('p');
const gamificationUiController = gamificationUi.createGamificationUiController({
    dom: {
        featuredAchievementList,
        featuredAchievementHint
    },
    documentRef: context.document,
    windowRef: context,
    getGamification: () => gamificationState,
    getFeaturedAchievements: () => [gamificationController.getAllAchievements().find(achievement => achievement.id === 'first-spark')],
    getRarityRankLabel: rarity => gamificationController.getRarityRankLabel(rarity)
});
gamificationUiController.renderFeaturedAchievements();
assert.strictEqual(featuredAchievementList.children.length, 1);
assert.strictEqual(featuredAchievementHint.textContent.includes('Selección automática'), true);

let renderedStreak = 100;
const streakHeroCard = createFakeElement('article');
const streakHeroCount = createFakeElement('strong');
const streakUiController = gamificationUi.createGamificationUiController({
    dom: {
        streakHeroCard,
        streakHeroCount
    },
    documentRef: context.document,
    windowRef: context,
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
    getCurrentStreak: () => renderedStreak,
    getStreakPrestigeLevel: streak => gamificationController.getStreakPrestigeLevel(streak),
    getStreakPrestigeClassNames: () => gamificationController.getStreakPrestigeClassNames()
});
streakUiController.renderStreakStats();
assert.strictEqual(streakHeroCard.classList.contains('streak-count-long'), true);
assert.strictEqual(streakHeroCard.classList.contains('streak-count-very-long'), false);
assert.strictEqual(streakHeroCard.dataset.streakDigits, '3');
renderedStreak = 1000;
streakUiController.renderStreakStats();
assert.strictEqual(streakHeroCard.classList.contains('streak-count-very-long'), true);
assert.strictEqual(streakHeroCard.dataset.streakDigits, '4');

const streakPrestigeRoad = createFakeElement('div');
const streakRouteSummary = createFakeElement('small');
const streakRouteController = gamificationUi.createGamificationUiController({
    dom: {
        streakPrestigeRoad,
        streakRouteSummary
    },
    documentRef: context.document,
    windowRef: context,
    components,
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
    getCurrentStreak: () => 100
});
streakRouteController.renderStreakPrestigeRoad();
assert.strictEqual(streakPrestigeRoad.children.length, 4);
assert.strictEqual(streakPrestigeRoad.children[2].className, 'prestige-chapter');
assert.strictEqual(streakPrestigeRoad.children[2].children[1].children[0].classList.contains('is-current'), true);
assert.strictEqual(streakRouteSummary.textContent, 'Nivel 7 de 12 · Mítica');

let developerTodos = [];
let developerHistory = {};
let developerDailyGoal = 2;
let developerGamification = gamification.normalizeGamificationState({});
let developerRenderCount = 0;
assert.strictEqual(developer.isStatePreviewTodo({ devPreviewType: 'task-state' }), true);
const developerController = developer.createDeveloperModeController({
    documentRef: context.document,
    windowRef: context,
    storage,
    snapshotKey: 'dev-snapshot-test',
    defaults: {
        dailyGoal: 2,
        developerStreakPrefix: 'Racha dev',
        developerStreakMaxDays: 30
    },
    taskDefaults: {
        expirationDays: 7,
        defaultDays: 1,
        maxDays: 3,
        soonHours: 12
    },
    getTodos: () => developerTodos,
    setTodos: value => {
        developerTodos = value;
    },
    getCompletionHistory: () => developerHistory,
    setCompletionHistory: value => {
        developerHistory = value;
    },
    getDailyGoal: () => developerDailyGoal,
    setDailyGoal: value => {
        developerDailyGoal = value;
    },
    getGamification: () => developerGamification,
    setGamification: value => {
        developerGamification = value;
    },
    createTodo: (text, priority, options = {}) => tasks.createTodo(text, priority, {
        createdOn: utils.getTodayKey(),
        createdAt: utils.getNowTimestamp(),
        ...options
    }),
    saveTodoList: () => {},
    saveCompletionHistory: () => {},
    saveDailyGoal: () => {},
    saveGamification: () => {},
    syncCompletionHistory: () => {},
    syncAchievementCollection: () => {},
    renderCurrentPage: () => {
        developerRenderCount += 1;
    },
    showToast: () => {},
    getCurrentStreak: () => 2,
    getPerfectStreak: () => 2,
    getLegendaryStreak: () => 0,
    getHistoryCount: () => 0,
    getPriorityLabel: priority => priority === 'urgent' ? 'Urgente' : 'Normal',
    normalizeTaskTimeLimit: tasks.normalizeTaskTimeLimit,
    normalizeTimestamp: utils.normalizeTimestamp,
    getStartOfDay: utils.getStartOfDay,
    addDays: utils.addDays,
    formatDateKey: utils.formatDateKey,
    getTodayKey: utils.getTodayKey,
    getNowTimestamp: utils.getNowTimestamp,
    createTimestampFromDateKey: utils.createTimestampFromDateKey,
    getDateKeyFromTimestamp: utils.getDateKeyFromTimestamp
});
assert.strictEqual(developerController.isStatePreviewTodo({ devPreviewType: 'task-state' }), true);
assert.strictEqual(developerController.addStatePreviewTodos().length, 4);
assert.strictEqual(developerTodos.length, 4);
assert.strictEqual(developerTodos.some(todo => todo.text.includes('Por vencer')), true);
assert.strictEqual(developerController.setStreak(2, 'perfect', false).days, 2);
assert.strictEqual(developerTodos.some(todo => todo.text.startsWith('Racha dev')), true);
developerController.clearDevStreak();
assert.strictEqual(developerTodos.some(todo => todo.text.startsWith('Racha dev')), false);
developerController.captureSnapshot('Base dev');
assert.strictEqual(storage.readJson('dev-snapshot-test', null).label, 'Base dev');
assert.strictEqual(developerRenderCount > 0, true);

const taskState = new TaskState({ taskApi: tasks });
assert.strictEqual(taskState.isLate(oldTodo), false);
assert.strictEqual(taskState.isAvailableToday(oldTodo), true);

const taskManager = new TaskManager({ taskApi: tasks, utils, taskState });
const managedTodo = taskManager.create(' Tarea desde clase ', 'important', {
    createdOn: '2026-07-02',
    createdAt: '2026-07-02T08:00:00.000',
    dueDate: '2026-07-05'
});
assert.strictEqual(managedTodo.text, 'Tarea desde clase');
assert.strictEqual(managedTodo.dueDate, '2026-07-05');
taskManager.update(managedTodo, { dueDate: '' });
assert.strictEqual(managedTodo.dueDate, null);

const completion = taskManager.complete(managedTodo, {
    completedAt: '2026-07-02T12:00:00.000'
});
assert.strictEqual(completion.completedOn, '2026-07-02');
assert.strictEqual(managedTodo.completed, true);

const reactivation = taskManager.reactivate(managedTodo, {
    reactivatedAt: '2026-07-03T09:00:00.000'
});
assert.strictEqual(reactivation.reactivatedAt, '2026-07-03T09:00:00.000');
assert.strictEqual(managedTodo.completed, false);
assert.strictEqual(managedTodo.deadlineStartedAt, '2026-07-03T09:00:00.000');

const cleanableTodo = tasks.createTodo('Limpia', 'normal', {
    createdOn: '2026-06-01',
    createdAt: '2026-06-01T08:00:00.000'
});
cleanableTodo.completed = true;
cleanableTodo.completedOn = '2026-06-01';
cleanableTodo.completedAt = '2026-06-01T09:00:00.000';

const pendingTodo = tasks.createTodo('Pendiente', 'normal');
const clearResult = taskManager.clearCompleted([cleanableTodo, pendingTodo]);
assert.strictEqual(clearResult.removedTodos.length, 1);
assert.strictEqual(clearResult.todos.length, 1);
assert.strictEqual(clearResult.todos[0].id, pendingTodo.id);

const analyticsEngine = new AnalyticsEngine({ utils });
assert.strictEqual(analyticsEngine.getCompletionRate(3, 4), 75);
assert.strictEqual(analyticsEngine.getAverageDaily(6, 3), 2);
assert.strictEqual(analyticsEngine.getBestEntry([
    { dateKey: '2026-07-01', completed: 1 },
    { dateKey: '2026-07-02', completed: 4 }
], 'completed').dateKey, '2026-07-02');

const analyticsTodayKey = utils.getTodayKey();
const analyticsCompletedTodo = {
    id: 'analytics-1',
    text: 'Medir progreso',
    priority: 'urgent',
    completed: true,
    createdOn: analyticsTodayKey,
    createdAt: analyticsTodayKey + 'T08:00:00.000',
    completedOn: analyticsTodayKey,
    completedAt: analyticsTodayKey + 'T10:00:00.000',
    timeLimitDays: 1
};
const analyticsDailyStats = {
    [analyticsTodayKey]: {
        dateKey: analyticsTodayKey,
        created: 1,
        completed: 1,
        habitsCompleted: 0,
        tasksCompleted: 1,
        urgentCompleted: 1,
        importantCompleted: 0,
        normalCompleted: 0,
        deleted: 0,
        reactivated: 0,
        edited: 0,
        snoozed: 0,
        goalChanges: 0,
        achievements: 0,
        usageEvents: 0,
        completionValue: 3
    }
};
const analyticsLifecycle = {
    records: [analyticsCompletedTodo],
    createdRecords: [analyticsCompletedTodo],
    completedRecords: [analyticsCompletedTodo],
    deletedUnfinishedRecords: [],
    reactivatedRecords: [],
    eligible: 1,
    created: 1,
    completed: 1,
    deleted: 0,
    reactivated: 0,
    completionRate: 100,
    notCompleted: 0
};
const analyticsProgressController = analyticsProgress.createAnalyticsProgressController({
    documentRef: context.document,
    analyticsEngine,
    utils,
    defaults: { dailyGoal: 1 },
    getTodos: () => [analyticsCompletedTodo],
    getDailyStats: () => analyticsDailyStats,
    getDailyGoal: () => 1,
    getHistoryCount: dateKey => dateKey === analyticsTodayKey ? 1 : 0,
    getLifecycleAnalyticsForRange: () => analyticsLifecycle,
    getAllAchievements: () => [],
    getPriorityLabel: priority => priority === 'urgent' ? 'Urgente' : 'Normal',
    getPriorityRank: priority => priority === 'urgent' ? 3 : 1,
    getCurrentStreak: () => 1,
    getStreakBeforeToday: () => 0,
    getTotalCompletedTasks: () => 1,
    getCompletedPriorityCount: priority => priority === 'urgent' ? 1 : 0,
    getTodoDeadlineState: () => null,
    isTodoAvailableToday: () => false
});
assert.strictEqual(analyticsProgress.normalizeFlowPeriod('unknown'), 'weekly');
assert.strictEqual(analyticsProgressController.getPercent(1, 2), 50);
assert.strictEqual(analyticsProgressController.getFlowPeriodAnalytics('weekly').completionRate, 100);
assert.strictEqual(analyticsProgressController.getPeriodComparison(
    { eligible: 2, completionRate: 75 },
    { eligible: 2, completionRate: 50 }
).label, '+25 puntos frente al periodo anterior');
assert.strictEqual(analyticsProgressController.getReliableRhythm({
    completed: 1,
    activeDays: 1,
    bestDay: { completed: 1 }
}).available, false);
assert.strictEqual(analyticsProgressController.getMonthlyAnalytics(0).completedPercent, 100);
assert.strictEqual(analyticsProgressController.getMonthlyAnalytics(0).tasksCreated, 1);
assert.strictEqual(analyticsProgressController.getMonthlyAnalytics(0).totalActivities, 1);
assert.strictEqual(analyticsProgressController.getMonthlyAnalytics(0).notCompletedPercent, 0);
assert.strictEqual(Array.isArray(analyticsProgressController.getMonthlyAnalytics(0).habitDayEntries), true);
assert.strictEqual(analyticsProgressController.getAnalyticsSnapshot().analisisMensual.completedPercent, 100);
const dailyMissionSnapshot = analyticsProgressController.getDailyMissionSnapshot();
assert.strictEqual(typeof dailyMissionSnapshot.id, 'string');
assert.strictEqual(typeof dailyMissionSnapshot.title, 'string');
assert.strictEqual(typeof dailyMissionSnapshot.current, 'number');
assert.strictEqual(typeof dailyMissionSnapshot.target, 'number');
assert.strictEqual(typeof dailyMissionSnapshot.complete, 'boolean');

const toggledClasses = new Set();
const fakeElement = {
    innerHTML: '<span>contenido</span>',
    textContent: '',
    hidden: false,
    disabled: false,
    classList: {
        toggle(className, enabled) {
            if (enabled) {
                toggledClasses.add(className);
            } else {
                toggledClasses.delete(className);
            }
        }
    }
};
const uiController = new UIController();
uiController.clear(fakeElement);
uiController.setText(fakeElement, 'Listo');
uiController.setHidden(fakeElement, true);
uiController.toggleClass(fakeElement, 'active', true);
uiController.setButtonDisabled(fakeElement, true);
assert.strictEqual(fakeElement.innerHTML, '');
assert.strictEqual(fakeElement.textContent, 'Listo');
assert.strictEqual(fakeElement.hidden, true);
assert.strictEqual(fakeElement.disabled, true);
assert.strictEqual(toggledClasses.has('active'), true);

const browserTaskState = new oop.TaskState({ taskApi: tasks });
const browserTaskManager = new oop.TaskManager({ taskApi: tasks, utils, taskState: browserTaskState });
const browserAnalytics = new oop.AnalyticsEngine({ utils });
const browserUi = new oop.UIController();
const browserTodo = browserTaskManager.create('Clase global', 'normal');

assert.strictEqual(browserTodo.text, 'Clase global');
assert.strictEqual(browserTaskState.getTimeLimitDays(browserTodo), 1);
assert.strictEqual(browserTaskState.getDueDate(browserTodo), null);
assert.strictEqual(browserAnalytics.getCompletionRate(1, 2), 50);
browserUi.setText(fakeElement, 'Global listo');
assert.strictEqual(fakeElement.textContent, 'Global listo');

console.log('Tasklyzen module tests passed');
