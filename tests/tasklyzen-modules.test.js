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
        get length() {
            return store.size;
        },
        key: index => Array.from(store.keys())[index] || null,
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key)
    };
}

function loadBrowserModule(context, fileName) {
    const source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
    vm.runInNewContext(source, context, { filename: fileName });
}

async function getAuthEntryState(strategy) {
    const authStorage = createLocalStorage();
    const domListeners = {};

    if (strategy) {
        authStorage.setItem('tasklyzen-login-strategy', strategy);
    }

    const authContext = {
        console: { error() {}, warn() {} },
        Promise,
        setTimeout,
        localStorage: authStorage,
        document: {
            addEventListener(type, listener) {
                domListeners[type] = listener;
            },
            getElementById() {
                return null;
            }
        },
        dispatchEvent() {},
        CustomEvent: class CustomEvent {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
            }
        },
        window: null
    };
    authContext.window = authContext;
    loadBrowserModule(authContext, 'tasklyzen-auth.js');

    return authContext.TasklyzenAuth.whenReady();
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
loadBrowserModule(context, 'tasklyzen-data-migration.js');
loadBrowserModule(context, 'tasklyzen-storage.js');
loadBrowserModule(context, 'tasklyzen-utils.js');
loadBrowserModule(context, 'tasklyzen-composite-tasks.js');
loadBrowserModule(context, 'tasklyzen-tasks.js');
loadBrowserModule(context, 'components/tasklyzen-ui-components.js');
loadBrowserModule(context, 'tasklyzen-overdue-review.js');
loadBrowserModule(context, 'components/tasklyzen-task-creation-ui.js');
loadBrowserModule(context, 'tasklyzen-settings.js');
loadBrowserModule(context, 'tasklyzen-audio.js');
loadBrowserModule(context, 'tasklyzen-notifications.js');
loadBrowserModule(context, 'tasklyzen-task-ui.js');
loadBrowserModule(context, 'tasklyzen-sustainable-progress.js');
loadBrowserModule(context, 'tasklyzen-analytics-progress.js');
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
const audio = context.TasklyzenAudio;
const notifications = context.TasklyzenNotifications;
const taskUi = context.TasklyzenTaskUi;
const sustainableProgress = context.TasklyzenSustainableProgress;
const analyticsProgress = context.TasklyzenAnalyticsProgress;
const gamification = context.TasklyzenGamification;
const gamificationUi = context.TasklyzenGamificationUi;
const features = context.TasklyzenFeatures;
const developer = context.TasklyzenDeveloper;
const oop = context.TasklyzenOOP;
const { TaskState, TaskManager, AnalyticsEngine, UIController } = oop;

const lostCloudSession = await getAuthEntryState('google');
assert.strictEqual(lostCloudSession.canEnter, false);
assert.strictEqual(lostCloudSession.shouldPrompt, true);
const localEntry = await getAuthEntryState('local');
assert.strictEqual(localEntry.canEnter, true);
assert.strictEqual(localEntry.shouldPrompt, false);

const silentAudioController = audio.createAudioController({
    windowRef: context,
    getSettings: () => ({ sound: false, soundVolume: 0.7 })
});
assert.strictEqual(silentAudioController.unlock(), false);
assert.strictEqual(silentAudioController.playRaceCue('break-start'), false);

let completionToneStarts = 0;
const audibleWindow = {
    AudioContext: class FakeAudioContext {
        constructor() {
            this.state = 'suspended';
            this.currentTime = 0;
            this.destination = {};
        }

        resume() {
            this.state = 'running';
            return Promise.resolve();
        }

        createOscillator() {
            return {
                type: 'sine',
                frequency: {
                    setValueAtTime() {},
                    exponentialRampToValueAtTime() {}
                },
                connect() {},
                start() {
                    completionToneStarts += 1;
                },
                stop() {}
            };
        }

        createGain() {
            return {
                gain: {
                    setValueAtTime() {},
                    exponentialRampToValueAtTime() {}
                },
                connect() {}
            };
        }
    }
};
const audibleController = audio.createAudioController({
    windowRef: audibleWindow,
    getSettings: () => ({ sound: true, soundVolume: 0.7 })
});
assert.strictEqual(audibleController.unlock(), true);
assert.strictEqual(audibleController.playCompletion('regular'), true);
assert.strictEqual(completionToneStarts, 1);

const migration = context.TasklyzenDataMigration;
const migrationKeys = context.TasklyzenConfig.storageKeys;
context.localStorage.setItem(migrationKeys.gamification, JSON.stringify({
    usedShields: 2,
    protectedDates: ['2026-07-03'],
    achievementStates: { legacy: { collected: true } },
    featuredAchievements: ['legacy']
}));
context.localStorage.setItem(migrationKeys.analyticsEvents, JSON.stringify([
    {
        type: 'task-completed',
        taskId: 'task-safe',
        metadata: { achievementProgress: 2, source: 'task-list' }
    },
    { type: 'achievement-unlocked' }
]));
context.localStorage.setItem(migrationKeys.dailyStats, JSON.stringify({
    '2026-07-03': {
        created: 2,
        completed: 1,
        achievements: 4,
        details: { logros: ['legacy'], preserved: true }
    }
}));
context.localStorage.setItem(migrationKeys.developerSnapshot, JSON.stringify({
    todos: [{ id: 'task-safe', text: 'Conservar tarea' }],
    gamification: { usedShields: 1, achievementStates: { legacy: true } },
    view: { achievementPanelOpen: true, preserved: 'yes' }
}));
context.localStorage.setItem(migrationKeys.progressView, 'achievements');
context.localStorage.setItem('todo-achievements', JSON.stringify({ legacy: true }));
assert.strictEqual(storage.migrateLegacyData(), true);
assert.strictEqual(context.localStorage.getItem('todo-achievements'), null);
assert.deepStrictEqual(JSON.parse(context.localStorage.getItem(migrationKeys.gamification)), {
    usedShields: 2,
    protectedDates: ['2026-07-03']
});
assert.deepStrictEqual(JSON.parse(context.localStorage.getItem(migrationKeys.analyticsEvents)), [
    { type: 'task-completed', taskId: 'task-safe', metadata: { source: 'task-list' } }
]);
assert.deepStrictEqual(JSON.parse(context.localStorage.getItem(migrationKeys.dailyStats)), {
    '2026-07-03': { created: 2, completed: 1, details: { preserved: true } }
});
assert.deepStrictEqual(JSON.parse(context.localStorage.getItem(migrationKeys.developerSnapshot)), {
    todos: [{ id: 'task-safe', text: 'Conservar tarea' }],
    gamification: { usedShields: 1 },
    view: { preserved: 'yes' }
});
assert.strictEqual(context.localStorage.getItem(migrationKeys.progressView), 'today');
assert.strictEqual(migration.sanitizeStorageEntry('tasklyzen-achievements', '{}').remove, true);

const cloudDeleteToken = { delete: true };
const cloudWrites = [];
const cloudDocument = {
    get: () => Promise.resolve({
        exists: true,
        data: () => ({
            'todo-achievements': JSON.stringify({ legacy: true }),
            [migrationKeys.gamification]: JSON.stringify({
                usedShields: 3,
                achievementStates: { legacy: true }
            }),
            [migrationKeys.todos]: JSON.stringify([{ id: 'task-cloud', text: 'Conservar' }])
        })
    }),
    set: (updates, options) => {
        cloudWrites.push({ updates, options });
        return Promise.resolve();
    },
    onSnapshot: () => () => {}
};
context.firebase = {
    firestore: {
        FieldValue: { delete: () => cloudDeleteToken }
    }
};
const cloudDb = {
    collection: () => ({ doc: () => cloudDocument })
};

context.localStorage.setItem(migrationKeys.todos, JSON.stringify([
    { id: 'task-cloud', text: 'Conservar' }
]));
storage.onAuthChange({ uid: 'cloud-migration-test' }, cloudDb);
await Promise.resolve();
await Promise.resolve();
const cloudMigrationWrite = cloudWrites.find(write => write.options && write.options.merge);
assert.deepStrictEqual(cloudMigrationWrite.updates['todo-achievements'], cloudDeleteToken);
assert.strictEqual(
    cloudMigrationWrite.updates[migrationKeys.gamification],
    JSON.stringify({ usedShields: 3 })
);
assert.strictEqual(cloudMigrationWrite.updates[migrationKeys.todos], undefined);
storage.onAuthChange(null, null);

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
assert.deepStrictEqual(Array.from(betaControllers.focus.getState().sessionTodoIds), ['beta-3']);
assert.strictEqual(betaControllers.focus.pause().status, 'paused');
assert.strictEqual(betaControllers.focus.resume().status, 'running');
assert.strictEqual(betaControllers.focus.exit().active, true);
assert.strictEqual(betaControllers.focus.getState().suspended, true);
assert.strictEqual(betaControllers.focus.getLaunchState().buttonLabel, 'Continuar ritmo libre');
assert.strictEqual(betaControllers.focus.resumeSession().suspended, false);

let interruptedNow = '2026-07-12T11:00:00.000Z';
const interruptedTodo = { id: 'interrupted-race', text: 'Carrera interrumpida', completed: false };
const interruptedRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'interrupted-race-test',
    definitions: features.plannedLocalFeatures
});
const interruptedController = features.createBetaFeatureControllers({
    registry: interruptedRegistry,
    getTodos: () => [interruptedTodo],
    getTopPriorityTodo: () => interruptedTodo,
    getNowTimestamp: () => interruptedNow
});
interruptedController.focus.start(interruptedTodo.id, { mode: 'free' });
interruptedNow = '2026-07-12T11:03:00.000Z';
const interruptedLaunch = interruptedController.focus.prepareForEntry();
assert.strictEqual(interruptedLaunch.resumable, true);
assert.strictEqual(interruptedController.focus.getState().suspended, true);
assert.strictEqual(interruptedController.focus.getState().sessionAccumulatedMs, 3 * 60 * 1000);

let visibilityNow = '2026-07-12T12:00:00.000Z';
const visibilityTodo = { id: 'visibility-race', text: 'Lectura enfocada', completed: false };
const visibilityRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'visibility-race-test',
    definitions: features.plannedLocalFeatures
});
const visibilityController = features.createBetaFeatureControllers({
    registry: visibilityRegistry,
    getTodos: () => [visibilityTodo],
    getTopPriorityTodo: () => visibilityTodo,
    getNowTimestamp: () => visibilityNow
});
visibilityController.focus.start(visibilityTodo.id, { mode: 'free' });
visibilityNow = '2026-07-12T12:02:00.000Z';
visibilityController.focus.handleVisibilityChange(true);
visibilityNow = '2026-07-12T12:12:00.000Z';
visibilityController.focus.handleVisibilityChange(false);
assert.strictEqual(visibilityController.focus.getTimerSnapshot().timer.sessionElapsedMs, 12 * 60 * 1000);
assert.strictEqual(visibilityController.focus.getState().sessionBackgroundMs, 10 * 60 * 1000);
assert.strictEqual(visibilityController.focus.getState().sessionAwayMs, 0);
assert.strictEqual(visibilityController.focus.getState().status, 'running');

let pausedVisibilityNow = '2026-07-12T13:00:00.000Z';
const pausedVisibilityRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'visibility-paused-test',
    definitions: features.plannedLocalFeatures
});
const pausedVisibilityController = features.createBetaFeatureControllers({
    registry: pausedVisibilityRegistry,
    getTodos: () => [visibilityTodo],
    getTopPriorityTodo: () => visibilityTodo,
    getNowTimestamp: () => pausedVisibilityNow,
    shouldRunInBackground: () => false
});
pausedVisibilityController.focus.start(visibilityTodo.id, { mode: 'free' });
pausedVisibilityNow = '2026-07-12T13:02:00.000Z';
pausedVisibilityController.focus.handleVisibilityChange(true);
pausedVisibilityNow = '2026-07-12T13:12:00.000Z';
pausedVisibilityController.focus.handleVisibilityChange(false);
assert.strictEqual(pausedVisibilityController.focus.getState().sessionAccumulatedMs, 2 * 60 * 1000);
assert.strictEqual(pausedVisibilityController.focus.getState().sessionAwayMs, 10 * 60 * 1000);

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
const raceCues = [];
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
    evaluateSession: sustainableProgress.evaluateSession,
    onCompleteTodo: todoId => {
        if (todoId === raceTodo.id) {
            raceTodo.completed = true;
            return true;
        }

        return false;
    },
    onSessionComplete: session => {
        completedRaceSession = session;
    },
    onTimerCue: cue => raceCues.push(cue)
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
assert.strictEqual(completedRaceSession.completedTodos[0].title, 'Preparar exposición');
assert.strictEqual(completedRaceSession.mode, 'countdown');
assert.strictEqual(completedRaceSession.targetReached, false);
assert.strictEqual(completedRaceSession.focusMs, 6 * 60 * 1000);
assert.strictEqual(completedRaceSession.meaningful, true);
assert.strictEqual(completedRaceSession.sustainable, true);
assert.deepStrictEqual(Array.from(raceCues), ['session-complete']);
assert.strictEqual(raceSessionController.focus.getWeeklySummary().sessions, 1);
assert.strictEqual(raceSessionController.focus.getWeeklySummary().successfulTargets, 1);

let multiTaskNow = '2026-07-12T11:00:00.000Z';
const multiTaskTodos = [
    { id: 'race-task-a', text: 'Preparar diapositivas', completed: false, habit: false },
    { id: 'race-task-b', text: 'Ensayar presentación', completed: false, habit: false },
    { id: 'race-task-excluded', text: 'Tarea fuera de la sesión', completed: false, habit: false }
];
const multiTaskRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'race-multi-task-test',
    definitions: features.plannedLocalFeatures
});
let multiTaskController = null;
multiTaskController = features.createBetaFeatureControllers({
    registry: multiTaskRegistry,
    getTodos: () => multiTaskTodos,
    getTopPriorityTodo: () => multiTaskTodos.find(todo => !todo.completed) || null,
    getNowTimestamp: () => multiTaskNow,
    onCompleteTodo: todoId => {
        const todo = multiTaskTodos.find(item => item.id === todoId);
        if (!todo) return false;
        todo.completed = true;
        multiTaskController.focus.render();
        return true;
    }
});
multiTaskController.focus.start('race-task-a', {
    mode: 'free',
    todoIds: ['race-task-a', 'race-task-b']
});
assert.deepStrictEqual(
    Array.from(multiTaskController.focus.getState().sessionTodoIds),
    ['race-task-a', 'race-task-b']
);
multiTaskNow = '2026-07-12T11:02:00.000Z';
let multiTaskState = multiTaskController.focus.skipToNext();
assert.strictEqual(multiTaskState.selectedTodoId, 'race-task-b');
assert.strictEqual(multiTaskState.sessionAccumulatedMs, 2 * 60 * 1000);
assert.strictEqual(multiTaskState.taskElapsedMsById['race-task-a'], 2 * 60 * 1000);
assert.strictEqual(multiTaskController.focus.getTimerSnapshot().timer.primaryValue, '02:00');
multiTaskNow = '2026-07-12T11:03:00.000Z';
multiTaskState = multiTaskController.focus.skipToNext();
assert.strictEqual(multiTaskState.selectedTodoId, 'race-task-a');
assert.strictEqual(multiTaskState.sessionAccumulatedMs, 3 * 60 * 1000);
assert.strictEqual(multiTaskState.taskElapsedMsById['race-task-b'], 60 * 1000);
multiTaskNow = '2026-07-12T11:04:00.000Z';
multiTaskController.focus.completeAndContinue();
multiTaskNow = '2026-07-12T11:06:00.000Z';
const multiTaskFinished = multiTaskController.focus.finishSession();
const multiTaskBreakdown = Object.fromEntries(
    multiTaskFinished.lastSession.taskBreakdown.map(todo => [todo.id, todo])
);
assert.strictEqual(multiTaskFinished.lastSession.elapsedMs, 6 * 60 * 1000);
assert.strictEqual(multiTaskBreakdown['race-task-a'].elapsedMs, 3 * 60 * 1000);
assert.strictEqual(multiTaskBreakdown['race-task-a'].completed, true);
assert.strictEqual(multiTaskBreakdown['race-task-b'].elapsedMs, 3 * 60 * 1000);
assert.strictEqual(multiTaskBreakdown['race-task-b'].completed, false);
assert.strictEqual(multiTaskBreakdown['race-task-excluded'], undefined);

let pomodoroNow = '2026-07-12T12:00:00.000Z';
const pomodoroTodo = {
    id: 'pomodoro-timer',
    text: 'Estudiar con Pomodoro',
    completed: false,
    habit: false
};
const pomodoroRegistry = features.createFeatureRegistry({
    storage,
    storageKey: 'pomodoro-session-test',
    definitions: features.plannedLocalFeatures
});
const pomodoroCues = [];
let pomodoroAudioUnlocks = 0;
const pomodoroController = features.createBetaFeatureControllers({
    registry: pomodoroRegistry,
    getTodos: () => [pomodoroTodo],
    getTopPriorityTodo: () => pomodoroTodo,
    getNowTimestamp: () => pomodoroNow,
    onTimerCue: cue => pomodoroCues.push(cue),
    unlockAudio: () => {
        pomodoroAudioUnlocks += 1;
    }
});
pomodoroController.focus.start('pomodoro-timer', {
    mode: 'countdown',
    targetMs: 40 * 60 * 1000,
    pomodoroEnabled: true,
    pomodoroWorkMs: 25 * 60 * 1000,
    pomodoroBreakMs: 5 * 60 * 1000
});
assert.strictEqual(pomodoroAudioUnlocks, 1);
pomodoroNow = '2026-07-12T12:25:00.000Z';
let pomodoroSnapshot = pomodoroController.focus.getTimerSnapshot();
assert.strictEqual(pomodoroSnapshot.pomodoro.phase, 'break');
assert.strictEqual(pomodoroSnapshot.pomodoro.remainingMs, 5 * 60 * 1000);
assert.deepStrictEqual(Array.from(pomodoroCues), ['break-start']);
pomodoroNow = '2026-07-12T12:30:00.000Z';
pomodoroSnapshot = pomodoroController.focus.getTimerSnapshot();
assert.strictEqual(pomodoroSnapshot.pomodoro.phase, 'work');
assert.strictEqual(pomodoroSnapshot.pomodoro.remainingMs, 10 * 60 * 1000);
assert.deepStrictEqual(Array.from(pomodoroCues), ['break-start', 'focus-start']);
pomodoroNow = '2026-07-12T12:32:00.000Z';
const suspendedPomodoro = pomodoroController.focus.leave();
assert.strictEqual(suspendedPomodoro.suspended, true);
assert.strictEqual(suspendedPomodoro.sessionAccumulatedMs, 32 * 60 * 1000);
assert.strictEqual(pomodoroController.focus.getLaunchState().buttonLabel, 'Continuar contra reloj');
pomodoroNow = '2026-07-12T12:40:00.000Z';
assert.strictEqual(pomodoroController.focus.getTimerSnapshot().timer.sessionElapsedMs, 32 * 60 * 1000);
pomodoroController.focus.resumeSession();
pomodoroNow = '2026-07-12T12:48:00.000Z';
pomodoroSnapshot = pomodoroController.focus.getTimerSnapshot();
assert.strictEqual(pomodoroSnapshot.timer.remainingMs, 0);
assert.strictEqual(pomodoroSnapshot.pomodoro.finished, true);

pomodoroTodo.completed = false;
pomodoroNow = '2026-07-12T13:00:00.000Z';
pomodoroController.focus.start('pomodoro-timer', {
    mode: 'countdown',
    pomodoroEnabled: true,
    pomodoroWorkMs: 25 * 60 * 1000,
    pomodoroBreakMs: 5 * 60 * 1000,
    pomodoroTargetCycles: 2
});
assert.strictEqual(pomodoroController.focus.getState().targetMs, 55 * 60 * 1000);
assert.strictEqual(pomodoroController.focus.getState().pomodoroTargetCycles, 2);

pomodoroController.focus.start('pomodoro-timer', {
    mode: 'countdown',
    pomodoroEnabled: true,
    pomodoroWorkMs: 25 * 60 * 1000,
    pomodoroBreakMs: 5 * 60 * 1000,
    pomodoroTargetCycles: 99
});
assert.strictEqual(pomodoroController.focus.getState().pomodoroTargetCycles, 8);
assert.strictEqual(pomodoroController.focus.getState().targetMs, 250 * 60 * 1000);

pomodoroNow = '2026-07-12T14:00:00.000Z';
pomodoroController.focus.start('pomodoro-timer', {
    mode: 'countdown',
    pomodoroEnabled: true,
    pomodoroWorkMs: 25 * 60 * 1000,
    pomodoroBreakMs: 5 * 60 * 1000,
    pomodoroTargetCycles: 8
});
pomodoroNow = '2026-07-12T15:55:00.000Z';
pomodoroSnapshot = pomodoroController.focus.getTimerSnapshot();
assert.strictEqual(pomodoroSnapshot.pomodoro.phase, 'break');
assert.strictEqual(pomodoroSnapshot.pomodoro.label, 'Descanso largo');
assert.strictEqual(pomodoroSnapshot.pomodoro.cycle, 4);
assert.strictEqual(pomodoroSnapshot.pomodoro.remainingMs, 20 * 60 * 1000);

pomodoroNow = '2026-07-12T16:30:00.000Z';
pomodoroController.focus.start('pomodoro-timer', {
    mode: 'countdown',
    pomodoroEnabled: true,
    pomodoroWorkMs: 50 * 60 * 1000,
    pomodoroBreakMs: 10 * 60 * 1000,
    pomodoroTargetCycles: 99
});
assert.strictEqual(pomodoroController.focus.getState().pomodoroTargetCycles, 4);
assert.strictEqual(pomodoroController.focus.getState().targetMs, 240 * 60 * 1000);

pomodoroNow = '2026-07-12T13:00:00.000Z';
pomodoroController.focus.start('pomodoro-timer', { mode: 'free' });
pomodoroNow = '2026-07-12T13:08:00.000Z';
const manuallyFinishedRace = pomodoroController.focus.finishSession();
assert.strictEqual(manuallyFinishedRace.active, false);
assert.strictEqual(manuallyFinishedRace.lastSession.result, 'manual');

pomodoroTodo.completed = false;
pomodoroNow = '2026-07-12T13:20:00.000Z';
pomodoroController.focus.start('pomodoro-timer', {
    mode: 'countdown',
    targetMs: 25 * 60 * 1000
});
pomodoroNow = '2026-07-12T13:24:00.000Z';
const earlyCountdownFinish = pomodoroController.focus.finishSession();
assert.strictEqual(earlyCountdownFinish.active, false);
assert.strictEqual(earlyCountdownFinish.lastSession.mode, 'countdown');
assert.strictEqual(earlyCountdownFinish.lastSession.targetReached, false);
assert.strictEqual(earlyCountdownFinish.lastSession.elapsedMs, 4 * 60 * 1000);
assert.strictEqual(manuallyFinishedRace.lastSession.elapsedMs, 8 * 60 * 1000);

const normalizedSettings = settings.normalizeAppSettings({
    theme: 'custom',
    sound: true,
    soundVolume: 2
});
assert.strictEqual(normalizedSettings.theme, 'light');
assert.strictEqual(normalizedSettings.sound, true);
assert.strictEqual(normalizedSettings.soundVolume, 1);
assert.strictEqual(normalizedSettings.progressMode, 'tasks');
assert.strictEqual(normalizedSettings.dailyFocusGoalMinutes, 50);
assert.strictEqual(normalizedSettings.backgroundTimer, true);
assert.strictEqual(settings.normalizeAppSettings({ theme: 'dark' }).theme, 'dark');
assert.strictEqual(settings.normalizeAppSettings({ progressMode: 'balanced', dailyFocusGoalMinutes: 500 }).progressMode, 'balanced');
assert.strictEqual(settings.normalizeAppSettings({ progressMode: 'balanced', dailyFocusGoalMinutes: 500 }).dailyFocusGoalMinutes, 240);
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

const gamificationTodayKey = utils.getTodayKey();
const gamificationYesterdayKey = utils.getDateKeyByOffset(gamificationTodayKey, -1);
let gamificationState = gamification.normalizeGamificationState({
    usedShields: 0,
    protectedDates: [],
    achievementStates: { 'first-spark': { collected: true } },
    featuredAchievements: ['first-spark']
});
assert.deepStrictEqual(Object.keys(gamificationState).sort(), ['lastStreakCelebrationDate', 'protectedDates', 'usedShields']);
let gamificationSaveCount = 0;
const gamificationController = gamification.createGamificationController({
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
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
assert.strictEqual(gamificationSaveCount, 0);

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
    getPriorityLabel: priority => priority === 'urgent' ? 'Urgente' : 'Normal',
    getPriorityRank: priority => priority === 'urgent' ? 3 : 1,
    getCurrentStreak: () => 1,
    getStreakBeforeToday: () => 0,
    getTotalCompletedTasks: () => 1,
    getCompletedPriorityCount: priority => priority === 'urgent' ? 1 : 0,
    getTodoDeadlineState: () => null,
    isTodoAvailableToday: () => false,
    getSustainableRangeSummary: () => ({
        days: [{
            dateKey: analyticsTodayKey,
            focusMs: 30 * 60 * 1000,
            rewardedFocusMs: 25 * 60 * 1000,
            focusGoalMinutes: 25
        }],
        focusMs: 30 * 60 * 1000,
        rewardedFocusMs: 25 * 60 * 1000,
        sustainableSessions: 1
    }),
    getProgressMode: () => 'focus',
    getDailyFocusGoalMinutes: () => 25
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
assert.strictEqual(analyticsProgressController.getFocusPeriodAnalytics('weekly').focusMs, 30 * 60 * 1000);
assert.strictEqual(analyticsProgressController.getFocusPeriodAnalytics('weekly').goalPercent > 0, true);
assert.strictEqual(analyticsProgressController.getProgressGoalRecommendation().mode, 'focus');
assert.strictEqual(analyticsProgressController.getProgressGoalRecommendation().focusGoal, 25);
assert.strictEqual(analyticsProgressController.getProgressGoalRecommendation().message.includes('min'), true);
assert.strictEqual(Array.isArray(analyticsProgressController.getMonthlyAnalytics(0).habitDayEntries), true);
assert.strictEqual(analyticsProgressController.getAnalyticsSnapshot().analisisMensual.completedPercent, 100);
const dailyMissionSnapshot = analyticsProgressController.getDailyMissionSnapshot();
assert.strictEqual(typeof dailyMissionSnapshot.id, 'string');
assert.strictEqual(typeof dailyMissionSnapshot.title, 'string');
assert.strictEqual(typeof dailyMissionSnapshot.current, 'number');
assert.strictEqual(typeof dailyMissionSnapshot.target, 'number');
assert.strictEqual(typeof dailyMissionSnapshot.complete, 'boolean');
assert.strictEqual(typeof dailyMissionSnapshot.statusText, 'string');

const sustainableController = sustainableProgress.createSustainableProgressController({
    storage,
    storageKey: 'sustainable-progress-test',
    getTodayKey: () => '2026-07-14',
    getNowTimestamp: () => '2026-07-14T14:00:00.000Z',
    getDailyGoal: () => 3
});
let sustainableDay = sustainableController.recordSession({
    id: 'meaningful-short',
    startedAt: '2026-07-14T08:00:00.000Z',
    completedAt: '2026-07-14T08:20:00.000Z',
    selectedCount: 1,
    focusMs: 20 * 60 * 1000,
    result: 'manual'
});
assert.strictEqual(sustainableDay.sessions[0].meaningful, false);
assert.strictEqual(sustainableDay.sessions[0].sustainable, false);
assert.strictEqual(sustainableDay.sessions[0].confirmedFocusMs, 0);
sustainableDay = sustainableController.recordSession({
    id: 'long-without-break',
    startedAt: '2026-07-14T09:00:00.000Z',
    completedAt: '2026-07-14T10:00:00.000Z',
    selectedCount: 1,
    completedCount: 1,
    completedTodoIds: ['long-task'],
    focusMs: 60 * 60 * 1000,
    breakMs: 0,
    result: 'manual'
});
assert.strictEqual(sustainableDay.sessions.find(session => session.id === 'long-without-break').meaningful, true);
assert.strictEqual(sustainableDay.sessions.find(session => session.id === 'long-without-break').sustainable, false);
sustainableDay = sustainableController.recordSession({
    id: 'long-with-break',
    startedAt: '2026-07-14T11:00:00.000Z',
    completedAt: '2026-07-14T11:55:00.000Z',
    selectedCount: 1,
    completedCount: 1,
    focusMs: 50 * 60 * 1000,
    breakMs: 5 * 60 * 1000,
    completedBreaks: 1,
    result: 'manual'
});
assert.strictEqual(sustainableDay.sessions.find(session => session.id === 'long-with-break').sustainable, true);
sustainableDay = sustainableController.recordSession({
    id: 'mostly-away',
    startedAt: '2026-07-14T12:00:00.000Z',
    completedAt: '2026-07-14T13:00:00.000Z',
    selectedCount: 1,
    focusMs: 60 * 60 * 1000,
    confirmedAwayMs: 55 * 60 * 1000,
    result: 'manual'
});
assert.strictEqual(sustainableDay.sessions.find(session => session.id === 'mostly-away').meaningful, false);
assert.strictEqual(sustainableDay.active, true);
assert.strictEqual(sustainableController.getMissionSnapshot('2026-07-14').target, 1);
assert.strictEqual(sustainableController.getMissionSnapshot('2026-07-14').statusText.includes('avance'), true);
sustainableController.revokeTaskCompletion('long-task', '2026-07-14');
assert.strictEqual(sustainableController.getDaySnapshot('2026-07-14').sessions.find(session => session.id === 'long-without-break').meaningful, false);
sustainableController.recordTaskCompletion({ id: 'revocable-task' }, { dateKey: '2026-07-15' });
assert.strictEqual(sustainableController.getDaySnapshot('2026-07-15').active, true);
sustainableController.revokeTaskCompletion('revocable-task', '2026-07-15');
assert.strictEqual(sustainableController.getDaySnapshot('2026-07-15').active, false);
sustainableController.recordSession({
    id: 'legacy-session-without-progress',
    startedAt: '2026-07-10T08:00:00.000Z',
    completedAt: '2026-07-10T08:20:00.000Z',
    selectedCount: 1,
    focusMs: 20 * 60 * 1000,
    result: 'manual'
});
const localDateController = sustainableProgress.createSustainableProgressController({
    storage,
    storageKey: 'sustainable-progress-local-date-test',
    getTodayKey: () => '2026-07-14',
    getDateKeyFromTimestamp: () => '2026-07-14'
});
localDateController.recordSession({
    id: 'local-midnight-session',
    startedAt: '2026-07-15T04:30:00.000Z',
    completedAt: '2026-07-15T05:15:00.000Z',
    selectedCount: 1,
    completedCount: 1,
    completedTodoIds: ['local-task'],
    focusMs: 45 * 60 * 1000,
    result: 'manual'
});
assert.strictEqual(localDateController.getDateKeys()[0], '2026-07-14');

let sustainableGamificationState = gamification.normalizeGamificationState({});
const sustainableGamification = gamification.createGamificationController({
    prestigeLevels: context.TasklyzenConfig.streakPrestigeLevels,
    utils,
    getGamification: () => sustainableGamificationState,
    setGamification: value => {
        sustainableGamificationState = value;
    },
    saveGamification: () => {},
    getCompletionHistory: () => ({ '2026-07-10': 1, '2026-07-15': 5 }),
    getDailyGoal: () => 3,
    getMeaningfulDay: dateKey => sustainableController.getDaySnapshot(dateKey),
    getMeaningfulDateKeys: () => sustainableController.getDateKeys()
});
assert.strictEqual(sustainableGamification.hasActiveCredit('2026-07-10'), true);
assert.strictEqual(sustainableGamification.hasActiveCredit('2026-07-15'), false);
assert.strictEqual(sustainableGamification.hasPerfectCredit('2026-07-14'), false);
assert.strictEqual(sustainableGamification.hasLegendaryCredit('2026-07-14'), false);
sustainableController.recordTaskCompletion({ id: 'legendary-1' }, { dateKey: '2026-07-14' });
sustainableController.recordTaskCompletion({ id: 'legendary-2' }, { dateKey: '2026-07-14' });
sustainableController.recordTaskCompletion({ id: 'legendary-3' }, { dateKey: '2026-07-14' });
assert.strictEqual(sustainableGamification.hasPerfectCredit('2026-07-14'), true);
assert.strictEqual(sustainableGamification.hasLegendaryCredit('2026-07-14'), true);

let focusProgressMode = 'focus';
const focusGoalController = sustainableProgress.createSustainableProgressController({
    storage,
    storageKey: 'sustainable-focus-goal-test',
    getTodayKey: () => '2026-07-14',
    getProgressMode: () => focusProgressMode,
    getDailyGoal: () => 2,
    getDailyFocusGoalMinutes: () => 30
});
focusGoalController.recordSession({
    id: 'confirmed-advance',
    startedAt: '2026-07-14T08:00:00.000Z',
    completedAt: '2026-07-14T08:30:00.000Z',
    selectedCount: 1,
    focusMs: 30 * 60 * 1000,
    outcome: 'advanced',
    result: 'manual'
});
assert.strictEqual(focusGoalController.getDaySnapshot('2026-07-14').focusGoalReached, true);
assert.strictEqual(focusGoalController.getDaySnapshot('2026-07-14').goalReached, true);
assert.strictEqual(focusGoalController.getMissionSnapshot('2026-07-14').statusText.includes('min'), true);
focusProgressMode = 'balanced';
assert.strictEqual(focusGoalController.getDaySnapshot('2026-07-14').goalReached, false);
assert.strictEqual(focusGoalController.getMissionSnapshot('2026-07-14').statusText.includes('avances'), true);
assert.strictEqual(focusGoalController.getMissionSnapshot('2026-07-14').statusText.includes('min'), true);
focusGoalController.recordTaskCompletion({ id: 'balanced-a' }, { dateKey: '2026-07-14' });
focusGoalController.recordTaskCompletion({ id: 'balanced-b' }, { dateKey: '2026-07-14' });
assert.strictEqual(focusGoalController.getDaySnapshot('2026-07-14').goalReached, true);
focusGoalController.recordSession({
    id: 'blocked-session',
    startedAt: '2026-07-14T09:00:00.000Z',
    completedAt: '2026-07-14T09:20:00.000Z',
    selectedCount: 1,
    focusMs: 20 * 60 * 1000,
    outcome: 'blocked',
    result: 'manual'
});
assert.strictEqual(focusGoalController.getRangeSummary('2026-07-14', '2026-07-14').focusMs, 50 * 60 * 1000);
assert.strictEqual(focusGoalController.getDaySnapshot('2026-07-14').sessions.find(session => session.id === 'blocked-session').meaningful, false);

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
