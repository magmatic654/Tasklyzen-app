/*
 * Integracion: mutaciones de tareas, efectos y progreso sostenible.
 * Entradas: modulos de dominio reales con almacenamiento en memoria.
 * Salidas: protege el contrato compartido sin depender del DOM.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMemoryStorage() {
    const values = new Map();

    return {
        readJson(key, fallback) {
            const value = values.get(key);

            if (typeof value !== 'string') {
                return fallback;
            }

            try {
                return JSON.parse(value);
            } catch {
                return fallback;
            }
        },
        writeJson(key, value) {
            values.set(key, JSON.stringify(value));
        }
    };
}

function loadModule(context, fileName) {
    const source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');

    vm.runInNewContext(source, context, { filename: fileName });
}

function createDomainContext() {
    let id = 0;
    const context = {
        console,
        Date,
        JSON,
        Math,
        Number,
        RegExp,
        Set,
        String,
        crypto: { randomUUID: () => 'integration-' + (++id) },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        window: null
    };

    context.window = context;
    [
        'tasklyzen-config.js',
        'tasklyzen-utils.js',
        'tasklyzen-composite-tasks.js',
        'tasklyzen-tasks.js',
        'tasklyzen-task-lifecycle.js',
        'tasklyzen-domain-events.js',
        'tasklyzen-task-effects.js',
        'tasklyzen-sustainable-progress.js'
    ].forEach(fileName => loadModule(context, fileName));

    return context;
}

test('mantiene sincronizados tarea, eventos y progreso durante completar, reactivar y eliminar', () => {
    const context = createDomainContext();
    const dateKey = '2026-07-16';
    const storage = createMemoryStorage();
    const progress = context.TasklyzenSustainableProgress.createSustainableProgressController({
        storage,
        storageKey: 'integration-progress',
        getTodayKey: () => dateKey,
        getNowTimestamp: () => dateKey + 'T12:00:00.000Z',
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getDailyGoal: () => 2
    });
    const analyticsEvents = [];
    const discardedIds = [];
    const effects = context.TasklyzenTaskEffects.createTaskEffectsController({
        taskApi: context.TasklyzenTasks,
        lifecycle: context.TasklyzenTaskLifecycle,
        sustainableProgress: progress,
        getTodayKey: () => dateKey,
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getHoursBetween: () => 1,
        getDailyGoal: () => 2,
        getHistoryCount: () => 0,
        getLongestActiveStreak: () => 0,
        logAnalyticsEvent(type, payload) {
            analyticsEvents.push({ type, payload });
        },
        discardAnalyticsEvents(todoId) {
            discardedIds.push(todoId);

            for (let index = analyticsEvents.length - 1; index >= 0; index -= 1) {
                if (analyticsEvents[index].payload.todoId === todoId) {
                    analyticsEvents.splice(index, 1);
                }
            }
        }
    });
    const todo = context.TasklyzenTasks.createTodo('Entregar practica', 'important', {
        createdOn: dateKey,
        createdAt: dateKey + 'T08:00:00.000Z',
        dueDate: '2026-07-18'
    });

    todo.completed = true;
    todo.completedOn = dateKey;
    todo.completedAt = dateKey + 'T09:00:00.000Z';
    effects.handleTaskCompletion(todo, { dateKey, completedAt: todo.completedAt, source: 'integration' });
    assert.deepStrictEqual([...progress.getDaySnapshot(dateKey).taskIds], [todo.id]);
    assert.strictEqual(analyticsEvents.filter(event => event.type === 'task_completed').length, 1);

    todo.completed = false;
    effects.handleTaskReactivation(todo, {
        dateKey,
        completedOn: dateKey,
        reactivatedAt: dateKey + 'T09:10:00.000Z'
    });
    assert.deepStrictEqual([...progress.getDaySnapshot(dateKey).taskIds], []);
    assert.strictEqual(analyticsEvents.filter(event => event.type === 'task_reactivated').length, 1);

    todo.completed = true;
    todo.completedOn = dateKey;
    todo.completedAt = dateKey + 'T09:20:00.000Z';
    effects.handleTaskCompletion(todo, { dateKey, completedAt: todo.completedAt, source: 'integration' });
    const removal = effects.handleRemoval(todo, 'task_deleted');

    assert.strictEqual(removal.analyticsRetained, false);
    assert.deepStrictEqual(discardedIds, [todo.id]);
    assert.deepStrictEqual([...progress.getDaySnapshot(dateKey).taskIds], []);
    assert.strictEqual(analyticsEvents.some(event => event.payload.todoId === todo.id), false);

    const restoredProgress = context.TasklyzenSustainableProgress.createSustainableProgressController({
        storage,
        storageKey: 'integration-progress',
        getTodayKey: () => dateKey,
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getDailyGoal: () => 2
    });
    assert.deepStrictEqual([...restoredProgress.getDaySnapshot(dateKey).taskIds], []);
});

test('retiene solo la huella analitica de tareas vencidas y revoca los pasos de un hito reactivado', () => {
    const context = createDomainContext();
    const dateKey = '2026-07-16';
    const storage = createMemoryStorage();
    const progress = context.TasklyzenSustainableProgress.createSustainableProgressController({
        storage,
        storageKey: 'composite-integration-progress',
        getTodayKey: () => dateKey,
        getNowTimestamp: () => dateKey + 'T12:00:00.000Z',
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getDailyGoal: () => 2
    });
    const analyticsEvents = [];
    const effects = context.TasklyzenTaskEffects.createTaskEffectsController({
        taskApi: context.TasklyzenTasks,
        lifecycle: context.TasklyzenTaskLifecycle,
        sustainableProgress: progress,
        getTodayKey: () => dateKey,
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getHoursBetween: () => 1,
        getDailyGoal: () => 2,
        getHistoryCount: () => 0,
        getLongestActiveStreak: () => 0,
        logAnalyticsEvent(type, payload) {
            analyticsEvents.push({ type, payload });
        },
        discardAnalyticsEvents() {}
    });
    const expiredTodo = context.TasklyzenTasks.createTodo('Tarea vencida', 'normal', {
        createdOn: '2026-07-01',
        createdAt: '2026-07-01T08:00:00.000Z',
        dueDate: '2000-01-01'
    });
    const expiredRemoval = effects.handleRemoval(expiredTodo, 'task_deleted');

    assert.strictEqual(expiredRemoval.analyticsRetained, true);
    assert.strictEqual(expiredRemoval.expiredAtRemoval, true);
    assert.strictEqual(analyticsEvents.at(-1).type, 'task_deleted');

    const milestone = context.TasklyzenTasks.createTodo('Preparar entrega', 'normal', {
        type: 'composite',
        createdOn: dateKey,
        createdAt: dateKey + 'T08:00:00.000Z',
        subtasks: [context.TasklyzenCompositeTasks.createSubtask('Paso clave')]
    });
    const step = milestone.subtasks[0];
    step.completed = true;
    step.completedAt = dateKey + 'T10:00:00.000Z';
    effects.handleSubtaskTransition(milestone, step, { dateKey, wasCompleted: false, source: 'integration' });
    const completedTransition = context.TasklyzenCompositeTasks.synchronizeCompositeTask(milestone, {
        dateKey,
        timestamp: step.completedAt
    });
    effects.handleCompositeTransition(milestone, completedTransition, { dateKey, source: 'integration' });

    let day = progress.getDaySnapshot(dateKey);
    assert.strictEqual(day.taskIds.includes(milestone.id), true);
    assert.strictEqual(day.requiredSubtaskKeys.includes(milestone.id + ':' + step.id), true);

    const previousCompletedAt = step.completedAt;
    step.completed = false;
    step.completedAt = null;
    effects.handleSubtaskTransition(milestone, step, {
        dateKey,
        wasCompleted: true,
        previousCompletedAt
    });
    const reactivatedTransition = context.TasklyzenCompositeTasks.synchronizeCompositeTask(milestone, {
        dateKey,
        timestamp: dateKey + 'T10:10:00.000Z'
    });
    effects.handleCompositeTransition(milestone, reactivatedTransition, { dateKey, source: 'integration' });

    day = progress.getDaySnapshot(dateKey);
    assert.strictEqual(day.taskIds.includes(milestone.id), false);
    assert.strictEqual(day.requiredSubtaskKeys.includes(milestone.id + ':' + step.id), false);
});

test('registra pasos obligatorios y opcionales sin inflar tareas completadas', () => {
    const context = createDomainContext();
    const dateKey = '2026-07-16';
    const storage = createMemoryStorage();
    const progress = context.TasklyzenSustainableProgress.createSustainableProgressController({
        storage,
        storageKey: 'subtask-event-progress',
        getTodayKey: () => dateKey,
        getNowTimestamp: () => dateKey + 'T12:00:00.000Z',
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getDailyGoal: () => 3
    });
    let events = [];
    const logAnalyticsEvent = (type, payload) => {
        const result = context.TasklyzenDomainEvents.append(events, type, payload, {
            getNowTimestamp: () => dateKey + 'T12:00:00.000Z',
            getDateKeyFromTimestamp: value => String(value || '').slice(0, 10)
        });

        events = result.events;
        return result.event;
    };
    const effects = context.TasklyzenTaskEffects.createTaskEffectsController({
        taskApi: context.TasklyzenTasks,
        lifecycle: context.TasklyzenTaskLifecycle,
        sustainableProgress: progress,
        getTodayKey: () => dateKey,
        getDateKeyFromTimestamp: value => String(value || '').slice(0, 10),
        getHoursBetween: () => 1,
        getDailyGoal: () => 3,
        getHistoryCount: () => 0,
        getLongestActiveStreak: () => 0,
        createMutationId: context.TasklyzenDomainEvents.createMutationId,
        logAnalyticsEvent,
        discardAnalyticsEvents() {}
    });
    const milestone = context.TasklyzenTasks.createTodo('Preparar examen', 'normal', {
        type: 'composite',
        subtasks: [
            context.TasklyzenCompositeTasks.createSubtask('Resolver ejercicios', { id: 'required-step' }),
            context.TasklyzenCompositeTasks.createSubtask('Leer material extra', { id: 'optional-step', optional: true })
        ]
    });
    const required = milestone.subtasks[0];
    const optional = milestone.subtasks[1];

    required.completed = true;
    required.completedAt = dateKey + 'T09:00:00.000Z';
    effects.handleSubtaskTransition(milestone, required, {
        dateKey,
        wasCompleted: false,
        mutationId: 'required-completion'
    });
    effects.handleSubtaskTransition(milestone, required, {
        dateKey,
        wasCompleted: false,
        mutationId: 'required-completion'
    });

    optional.completed = true;
    optional.completedAt = dateKey + 'T09:10:00.000Z';
    effects.handleSubtaskTransition(milestone, optional, {
        dateKey,
        wasCompleted: false,
        mutationId: 'optional-completion'
    });

    let day = progress.getDaySnapshot(dateKey);
    assert.deepStrictEqual([...day.requiredSubtaskKeys], [milestone.id + ':' + required.id]);
    assert.deepStrictEqual([...day.taskIds], []);
    assert.deepStrictEqual(events.map(event => event.type), ['subtask_completed', 'subtask_completed']);
    assert.equal(events[0].subtaskId, required.id);
    assert.equal(events[1].subtaskOptional, true);

    required.completed = false;
    required.completedAt = null;
    effects.handleSubtaskTransition(milestone, required, {
        dateKey,
        wasCompleted: true,
        previousCompletedAt: dateKey + 'T09:00:00.000Z',
        mutationId: 'required-reactivation'
    });

    day = progress.getDaySnapshot(dateKey);
    assert.deepStrictEqual([...day.requiredSubtaskKeys], []);
    assert.equal(events.at(-1).type, 'subtask_reactivated');
    assert.equal(events.at(-1).outcome, 'applied');
});
