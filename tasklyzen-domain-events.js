/*
 * Module: domain events.
 * Purpose: normalize and deduplicate task lifecycle events.
 * Inputs: event type, payload, existing event list and time helpers.
 * Outputs: window.TasklyzenDomainEvents.
 * Dependencies: injected callbacks only.
 */
(function exposeTasklyzenDomainEvents(global) {
    const EVENT_TYPES = Object.freeze({
        taskCreated: 'task_created',
        taskEdited: 'task_edited',
        taskCompleted: 'task_completed',
        taskReactivated: 'task_reactivated',
        taskDeleted: 'task_deleted',
        taskExpired: 'task_expired',
        taskAutoDeleted: 'task_auto_deleted',
        subtaskCompleted: 'subtask_completed',
        subtaskReactivated: 'subtask_reactivated',
        subtaskDeleted: 'subtask_deleted',
        subtaskPromoted: 'subtask_promoted'
    });

    function createMutationId() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }

        return 'mutation-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function createEventId() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }

        return 'event-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function normalizeEvent(type, payload, options) {
        const data = payload && typeof payload === 'object' ? payload : {};
        const config = options || {};
        const getNowTimestamp = typeof config.getNowTimestamp === 'function'
            ? config.getNowTimestamp
            : () => new Date().toISOString();
        const getDateKeyFromTimestamp = typeof config.getDateKeyFromTimestamp === 'function'
            ? config.getDateKeyFromTimestamp
            : timestamp => String(timestamp || '').slice(0, 10);
        const timestamp = typeof data.timestamp === 'string' ? data.timestamp : getNowTimestamp();
        const dateKey = typeof data.dateKey === 'string' && data.dateKey
            ? data.dateKey
            : getDateKeyFromTimestamp(timestamp);

        return {
            ...data,
            id: typeof data.id === 'string' && data.id ? data.id : createEventId(),
            mutationId: typeof data.mutationId === 'string' && data.mutationId ? data.mutationId : createMutationId(),
            type: String(type || ''),
            source: typeof data.source === 'string' && data.source ? data.source : 'tasks',
            outcome: typeof data.outcome === 'string' && data.outcome ? data.outcome : 'applied',
            timestamp,
            dateKey
        };
    }

    function isSameMutationTarget(first, second) {
        return Boolean(first && second
            && first.mutationId
            && first.mutationId === second.mutationId
            && first.type === second.type
            && (first.todoId || null) === (second.todoId || null)
            && (first.subtaskId || null) === (second.subtaskId || null));
    }

    function append(events, type, payload, options) {
        const source = Array.isArray(events) ? events : [];
        const config = options || {};
        const event = normalizeEvent(type, payload, config);
        const existing = source.find(item => isSameMutationTarget(item, event));

        if (existing) {
            return { events: source, event: existing, appended: false };
        }

        const limit = Math.max(Math.round(Number(config.limit) || 1500), 1);

        return {
            events: source.concat(event).slice(-limit),
            event,
            appended: true
        };
    }

    global.TasklyzenDomainEvents = {
        EVENT_TYPES,
        createMutationId,
        normalizeEvent,
        append,
        isSameMutationTarget
    };
})(window);
