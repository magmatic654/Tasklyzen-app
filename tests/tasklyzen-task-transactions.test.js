import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadBrowserModule(context, fileName) {
    const source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
    vm.runInNewContext(source, context, { filename: fileName });
}

function createContext() {
    let uuid = 0;
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
        crypto: { randomUUID: () => 'mutation-' + uuid++ },
        window: null
    };

    context.window = context;
    loadBrowserModule(context, 'tasklyzen-config.js');
    loadBrowserModule(context, 'tasklyzen-utils.js');
    loadBrowserModule(context, 'tasklyzen-composite-tasks.js');
    loadBrowserModule(context, 'tasklyzen-tasks.js');
    loadBrowserModule(context, 'tasklyzen-oop.js');
    loadBrowserModule(context, 'tasklyzen-task-transactions.js');
    return context;
}

function createController(context, initialTodos) {
    let todos = initialTodos;
    const calls = {
        completions: 0,
        reactivations: 0,
        removals: 0,
        subtaskTransitions: [],
        subtaskRemovals: [],
        subtaskPromotions: [],
        compositeTransitions: [],
        persists: 0,
        syncs: 0
    };
    const taskManager = new context.TasklyzenOOP.TaskManager({
        taskApi: context.TasklyzenTasks,
        utils: context.TasklyzenUtils
    });
    const effects = {
        handleTaskCompletion(todo) {
            calls.completions += 1;
            return { todayKey: '2026-07-16', celebrationType: 'regular', shouldCelebrateStreak: false, todoId: todo.id };
        },
        handleTaskReactivation() {
            calls.reactivations += 1;
        },
        handleRemoval() {
            calls.removals += 1;
            return { analyticsRetained: false, expiredAtRemoval: false };
        },
        handleCompositeTransition(todo, transition, metadata) {
            calls.compositeTransitions.push({ todo, transition, metadata });
            return transition.completedNow
                ? { completedNow: true, feedbackType: 'regular', shouldCelebrateStreak: false }
                : transition.reactivatedNow
                    ? { reactivatedNow: true }
                    : null;
        },
        handleSubtaskTransition(todo, subtask, metadata) {
            calls.subtaskTransitions.push({ todo, subtask, metadata });
            return { credited: !metadata.skipProgressCredit };
        },
        handleSubtaskRemoval(todo, subtask, metadata) {
            calls.subtaskRemovals.push({ todo, subtask, metadata });
            return { revoked: false };
        },
        handleSubtaskPromotion(todo, subtask, metadata) {
            calls.subtaskPromotions.push({ todo, subtask, metadata });
            return { credited: Boolean(subtask.completed) };
        },
        revokeTodayCredits() {
            calls.revokedToday = (calls.revokedToday || 0) + 1;
        }
    };
    const controller = context.TasklyzenTaskTransactions.createTaskTransactionController({
        taskManager,
        taskEffects: effects,
        getTodos: () => todos,
        setTodos: value => {
            todos = value;
        },
        getTodayKey: () => '2026-07-16',
        getNowTimestamp: () => '2026-07-16T12:00:00.000Z',
        getDateKeyFromTimestamp: () => '2026-07-16',
        isCompositeTask: context.TasklyzenCompositeTasks.isCompositeTask,
        compositeTasks: context.TasklyzenCompositeTasks,
        createNextHabitOccurrence: () => {},
        removeNextHabitOccurrenceFromList: (todo, todoItems) => todoItems.filter(item => item.sourceHabitId !== todo.id),
        persist: () => {
            calls.persists += 1;
        },
        syncDerivedState: () => {
            calls.syncs += 1;
        }
    });

    return { controller, calls, getTodos: () => todos };
}

function createTodo(id, overrides = {}) {
    return {
        id,
        text: 'Tarea ' + id,
        priority: 'normal',
        completed: false,
        createdAt: '2026-07-16T08:00:00.000Z',
        createdOn: '2026-07-16',
        dueDate: null,
        ...overrides
    };
}

test('completar una tarea simple es idempotente por operacion', () => {
    const context = createContext();
    const todo = createTodo('simple-1');
    const { controller, calls } = createController(context, [todo]);

    const first = controller.complete(todo.id, { source: 'tasks' });
    const repeated = controller.complete(todo.id, { source: 'tasks' });

    assert.equal(first.changed, true);
    assert.equal(first.after.completed, true);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.reason, 'already-completed');
    assert.equal(calls.completions, 1);
    assert.equal(calls.persists, 1);
    assert.equal(calls.syncs, 1);
});

test('reactivar una tarea simple revoca una sola vez y conserva el orden', () => {
    const context = createContext();
    const todo = createTodo('simple-2', {
        completed: true,
        completedOn: '2026-07-16',
        completedAt: '2026-07-16T10:00:00.000Z'
    });
    const { controller, calls, getTodos } = createController(context, [todo]);

    const first = controller.reactivate(todo.id, { source: 'race' });
    const repeated = controller.reactivate(todo.id, { source: 'race' });

    assert.equal(first.changed, true);
    assert.equal(first.after.completed, false);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.reason, 'already-active');
    assert.equal(getTodos()[0].id, todo.id);
    assert.equal(calls.reactivations, 1);
    assert.equal(calls.persists, 1);
    assert.equal(calls.syncs, 1);
});

test('eliminar una tarea simple elimina su siguiente ocurrencia de habito una sola vez', () => {
    const context = createContext();
    const habit = createTodo('habit-1', { habit: true, recurrence: 'daily' });
    const nextOccurrence = createTodo('habit-2', { sourceHabitId: habit.id, snoozedUntil: '2026-07-17' });
    const { controller, calls, getTodos } = createController(context, [habit, nextOccurrence]);

    const first = controller.remove(habit.id, 'task_deleted', { source: 'tasks' });
    const repeated = controller.remove(habit.id, 'task_deleted', { source: 'tasks' });

    assert.equal(first.changed, true);
    assert.equal(repeated.changed, false);
    assert.equal(getTodos().length, 0);
    assert.equal(calls.removals, 1);
    assert.equal(calls.persists, 1);
    assert.equal(calls.syncs, 1);
});

test('el ultimo paso obligatorio cierra el hito sin sumar un credito final duplicado', () => {
    const context = createContext();
    const milestone = context.TasklyzenTasks.createTodo('Preparar examen', 'normal', {
        type: 'composite',
        subtasks: [context.TasklyzenCompositeTasks.createSubtask('Resolver ejercicios', { id: 'step-final' })]
    });
    const { controller, calls, getTodos } = createController(context, [milestone]);

    const first = controller.setSubtaskCompletion(milestone.id, 'step-final', true, {
        dateKey: '2026-07-16',
        mutationId: 'finish-milestone'
    });
    const repeated = controller.setSubtaskCompletion(milestone.id, 'step-final', true, {
        dateKey: '2026-07-16',
        mutationId: 'finish-milestone'
    });

    assert.equal(first.changed, true);
    assert.equal(first.transition.completedNow, true);
    assert.equal(first.credits.length, 1);
    assert.equal(first.credits[0].kind, 'task');
    assert.equal(first.credits[0].todoId, milestone.id);
    assert.equal(first.credits[0].dateKey, '2026-07-16');
    assert.equal(getTodos()[0].completed, true);
    assert.equal(calls.subtaskTransitions[0].metadata.skipProgressCredit, true);
    assert.equal(repeated.changed, false);
    assert.equal(calls.persists, 1);
    assert.equal(calls.syncs, 1);
});

test('reactivar un paso obligatorio conserva la fecha previa del hito para sus efectos', () => {
    const context = createContext();
    const milestone = context.TasklyzenTasks.createTodo('Proyecto final', 'normal', {
        type: 'composite',
        subtasks: [context.TasklyzenCompositeTasks.createSubtask('Paso principal', {
            id: 'step-reactivate',
            completed: true,
            completedAt: '2026-07-16T09:00:00.000Z'
        })]
    });

    milestone.completed = true;
    milestone.completedOn = '2026-07-16';
    milestone.completedAt = '2026-07-16T09:00:00.000Z';
    const { controller, calls, getTodos } = createController(context, [milestone]);

    const result = controller.setSubtaskCompletion(milestone.id, 'step-reactivate', false, {
        dateKey: '2026-07-16',
        mutationId: 'reactivate-milestone'
    });

    assert.equal(result.changed, true);
    assert.equal(result.transition.reactivatedNow, true);
    assert.equal(getTodos()[0].completed, false);
    assert.equal(calls.compositeTransitions[0].metadata.previousCompletedOn, '2026-07-16');
    assert.equal(calls.subtaskTransitions[0].metadata.skipProgressCredit, false);
});

test('promover un paso opcional y eliminar un hito usan una sola transaccion por accion', () => {
    const context = createContext();
    const milestone = context.TasklyzenTasks.createTodo('Entrega', 'normal', {
        type: 'composite',
        subtasks: [
            context.TasklyzenCompositeTasks.createSubtask('Paso obligatorio', { id: 'required-step' }),
            context.TasklyzenCompositeTasks.createSubtask('Plan alterno', { id: 'optional-step', optional: true })
        ]
    });
    const { controller, calls, getTodos } = createController(context, [milestone]);

    const promoted = controller.removeSubtask(milestone.id, 'required-step', 'promote-optional', {
        dateKey: '2026-07-16',
        mutationId: 'promote-step'
    });

    assert.equal(promoted.changed, true);
    assert.equal(getTodos()[0].subtasks.length, 1);
    assert.equal(getTodos()[0].subtasks[0].optional, false);
    assert.equal(calls.subtaskRemovals.length, 1);
    assert.equal(calls.subtaskPromotions.length, 1);
    assert.equal(calls.subtaskRemovals[0].metadata.mutationId, calls.subtaskPromotions[0].metadata.mutationId);

    const removed = controller.remove(milestone.id, 'task_deleted', { mutationId: 'delete-milestone' });

    assert.equal(removed.changed, true);
    assert.equal(getTodos().length, 0);
    assert.equal(calls.removals, 1);
});
