/*
 * Modulo: AnalyticsEngine
 * Proposito: calcular metricas y series de progreso sin depender del DOM.
 * Entradas: registros diarios, eventos y resumenes de ciclo de tarea.
 * Salidas: porcentajes, promedios, mejores dias y series listas para UI.
 * Dependencias: tasklyzen-utils.js opcional.
 */
const runtimeGlobal = typeof window !== 'undefined' ? window : globalThis;

export class AnalyticsEngine {
    #utils;

    constructor({ utils = runtimeGlobal.TasklyzenUtils } = {}) {
        this.#utils = utils || null;
    }

    getCompletionRate(completed, total) {
        if (!Number.isFinite(total) || total <= 0) {
            return 0;
        }

        return this.#clampPercent(Math.round((Number(completed) / total) * 100));
    }

    getAverageDaily(total, days) {
        if (!Number.isFinite(days) || days <= 0) {
            return 0;
        }

        return Number(total || 0) / days;
    }

    getBestEntry(entries, metric = 'completed') {
        return this.#ensureEntries(entries).reduce((bestEntry, entry) => {
            return Number(entry[metric] || 0) > Number(bestEntry[metric] || 0) ? entry : bestEntry;
        }, { dateKey: null, [metric]: 0 });
    }

    buildSeries(entries, metric = 'completed') {
        return this.#ensureEntries(entries).map(entry => ({
            dateKey: entry.dateKey || null,
            label: this.#formatEntryLabel(entry),
            value: Number(entry[metric] || 0),
            source: entry
        }));
    }

    summarizeFlow({ entries = [], lifecycle = {} } = {}) {
        const completed = Number(lifecycle.completed || 0);
        const eligible = Number(lifecycle.eligible || 0);

        return {
            eligible,
            completed,
            completionRate: this.getCompletionRate(completed, eligible),
            averageDaily: this.getAverageDaily(completed, entries.length),
            bestDay: this.getBestEntry(entries, 'completed'),
            hasFlow: eligible > 0 || completed > 0 || Number(lifecycle.reactivated || 0) > 0
        };
    }

    #ensureEntries(entries) {
        return Array.isArray(entries) ? entries : [];
    }

    #formatEntryLabel(entry) {
        if (entry && entry.date instanceof Date && this.#utils && typeof this.#utils.formatDateKey === 'function') {
            return this.#utils.formatDateKey(entry.date);
        }

        return entry && entry.dateKey ? entry.dateKey : '';
    }

    #clampPercent(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.min(Math.max(value, 0), 100);
    }
}
