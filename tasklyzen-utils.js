/*
 * Módulo: utilidades puras
 * Propósito:
 * - Compartir fechas, formato y cálculos simples sin depender del DOM.
 * Entradas:
 * - Valores primitivos, fechas y timestamps.
 * Salidas:
 * - window.TasklyzenUtils con funciones reutilizables.
 * Dependencias:
 * - Ninguna.
 */
(function exposeTasklyzenUtils(global) {
    function isDateKey(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    function getStartOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return year + '-' + month + '-' + day;
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function getTodayKey() {
        return formatDateKey(getStartOfDay(new Date()));
    }

    function getTomorrowKey() {
        return formatDateKey(addDays(getStartOfDay(new Date()), 1));
    }

    function getNowTimestamp() {
        return new Date().toISOString();
    }

    function createTimestampFromDateKey(dateKey) {
        return (isDateKey(dateKey) ? dateKey : getTodayKey()) + 'T12:00:00.000';
    }

    function normalizeTimestamp(timestamp, fallbackDateKey) {
        if (typeof timestamp === 'string') {
            if (/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
                return timestamp;
            }

            if (isDateKey(timestamp)) {
                return createTimestampFromDateKey(timestamp);
            }
        }

        return createTimestampFromDateKey(fallbackDateKey);
    }

    function getDateKeyFromTimestamp(timestamp) {
        if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
            return timestamp.slice(0, 10);
        }

        return getTodayKey();
    }

    function getHourFromTimestamp(timestamp) {
        const parsedDate = new Date(timestamp);

        return Number.isNaN(parsedDate.getTime()) ? 12 : parsedDate.getHours();
    }

    function getHoursBetween(startTimestamp, endTimestamp) {
        const start = new Date(startTimestamp);
        const end = new Date(endTimestamp);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
            return 0;
        }

        return Math.round(((end - start) / 3600000) * 10) / 10;
    }

    function getDaysSince(timestamp) {
        const startDateKey = getDateKeyFromTimestamp(timestamp);
        const start = getStartOfDay(new Date(startDateKey + 'T00:00:00'));
        const today = getStartOfDay(new Date());

        if (Number.isNaN(start.getTime()) || start > today) {
            return 0;
        }

        return Math.floor((today - start) / 86400000);
    }

    function getDateKeyByOffset(dateKey, offsetDays) {
        const date = getStartOfDay(new Date(dateKey + 'T00:00:00'));

        if (Number.isNaN(date.getTime())) {
            return dateKey;
        }

        return formatDateKey(addDays(date, offsetDays));
    }

    function formatMetricNumber(value) {
        if (!Number.isFinite(value)) {
            return '0';
        }

        return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }

    function formatDurationHours(hours) {
        if (!Number.isFinite(hours) || hours <= 0) {
            return 'Sin datos';
        }

        if (hours < 24) {
            return formatMetricNumber(hours) + ' h';
        }

        return formatMetricNumber(hours / 24) + ' d';
    }

    global.TasklyzenUtils = {
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
    };
})(window);
