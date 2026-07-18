import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEvents(context) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'tasklyzen-domain-events.js'), 'utf8');
    vm.runInNewContext(source, context, { filename: 'tasklyzen-domain-events.js' });
}

test('deduplica un evento por mutacion, tipo y objetivo sin bloquear otros objetivos', () => {
    const context = { Date, Math, crypto: { randomUUID: () => 'generated-id' }, window: null };

    context.window = context;
    loadEvents(context);

    const options = {
        getNowTimestamp: () => '2026-07-16T12:00:00.000Z',
        getDateKeyFromTimestamp: () => '2026-07-16'
    };
    const first = context.TasklyzenDomainEvents.append([], 'subtask_completed', {
        mutationId: 'mutation-1',
        todoId: 'hito-1',
        subtaskId: 'paso-1',
        source: 'race'
    }, options);
    const repeated = context.TasklyzenDomainEvents.append(first.events, 'subtask_completed', {
        mutationId: 'mutation-1',
        todoId: 'hito-1',
        subtaskId: 'paso-1',
        source: 'race'
    }, options);
    const milestone = context.TasklyzenDomainEvents.append(repeated.events, 'task_completed', {
        mutationId: 'mutation-1',
        todoId: 'hito-1',
        source: 'race'
    }, options);

    assert.equal(first.appended, true);
    assert.equal(repeated.appended, false);
    assert.equal(milestone.appended, true);
    assert.equal(milestone.events.length, 2);
    assert.equal(milestone.events[0].outcome, 'applied');
    assert.equal(milestone.events[0].dateKey, '2026-07-16');
});
