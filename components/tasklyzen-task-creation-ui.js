/*
 * Modulo: selector compacto de creacion de tareas
 * Proposito: sincronizar controles de fecha para la barra de creacion.
 * Entradas: select HTML, preset de fecha y etiqueta opcional.
 * Salidas: select actualizado sin leer estado global ni almacenamiento.
 * Dependencias: ninguna.
 */
(function exposeTasklyzenTaskCreationUi(global) {
    const PRESETS = new Set(['none', 'today', 'tomorrow', 'custom']);

    function getDueDatePreset(selectElement) {
        if (!selectElement || !PRESETS.has(selectElement.value)) {
            return 'none';
        }

        return selectElement.value;
    }

    function syncDueDatePresetSelect(selectElement, preset, customLabel) {
        if (!selectElement) {
            return;
        }

        const selectedPreset = PRESETS.has(preset) ? preset : 'none';
        const customOption = Array.from(selectElement.options || [])
            .find(option => option.value === 'custom');

        selectElement.value = selectedPreset;

        if (customOption) {
            customOption.textContent = selectedPreset === 'custom' && customLabel
                ? 'Fecha: ' + customLabel
                : 'Elegir fecha';
        }
    }

    global.TasklyzenTaskCreationUi = {
        getDueDatePreset,
        syncDueDatePresetSelect
    };
})(window);
