/*
 * Modulo: preferencias de experiencia
 * Proposito:
 * - Normalizar, persistir, aplicar y sincronizar ajustes de experiencia.
 * Entradas:
 * - Storage, DOM de ajustes, callbacks del runtime y ajustes parciales.
 * Salidas:
 * - window.TasklyzenSettings con defaults, normalizadores y controlador.
 * Dependencias:
 * - Ninguna.
 */
(function exposeTasklyzenSettings(global) {
    const defaultSettings = Object.freeze({
        theme: 'light',
        notifications: true,
        sound: false,
        soundVolume: 0.7,
        animations: true,
        simplifiedAnalytics: false,
        progressMode: 'tasks',
        dailyFocusGoalMinutes: 50,
        backgroundTimer: true
    });
    const themeValues = Object.freeze(['light', 'dark']);
    const progressModeValues = Object.freeze(['tasks', 'focus', 'balanced']);

    function normalizeSettingsVolume(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return defaultSettings.soundVolume;
        }

        return Math.min(Math.max(number, 0), 1);
    }

    function normalizeAppSettings(settings) {
        const source = settings && typeof settings === 'object' ? settings : {};
        const theme = themeValues.includes(source.theme) ? source.theme : defaultSettings.theme;
        const progressMode = progressModeValues.includes(source.progressMode)
            ? source.progressMode
            : defaultSettings.progressMode;
        const focusGoal = Math.round(Number(source.dailyFocusGoalMinutes));

        return {
            theme,
            notifications: typeof source.notifications === 'boolean' ? source.notifications : defaultSettings.notifications,
            sound: typeof source.sound === 'boolean' ? source.sound : defaultSettings.sound,
            soundVolume: normalizeSettingsVolume(source.soundVolume),
            animations: typeof source.animations === 'boolean' ? source.animations : defaultSettings.animations,
            simplifiedAnalytics: typeof source.simplifiedAnalytics === 'boolean' ? source.simplifiedAnalytics : defaultSettings.simplifiedAnalytics,
            progressMode,
            dailyFocusGoalMinutes: Number.isFinite(focusGoal)
                ? Math.min(Math.max(focusGoal, 15), 240)
                : defaultSettings.dailyFocusGoalMinutes,
            backgroundTimer: typeof source.backgroundTimer === 'boolean'
                ? source.backgroundTimer
                : defaultSettings.backgroundTimer
        };
    }

    function createDeleteConfirmationCode() {
        return 'CONFIRMAR-' + String(Math.floor(1000 + Math.random() * 9000));
    }

    function createSettingsController(options) {
        const config = options || {};
        const storage = config.storage;
        const dom = config.dom || {};
        const storageKey = config.storageKey;
        const storageKeys = config.storageKeys || {};
        const getNowTimestamp = typeof config.getNowTimestamp === 'function' ? config.getNowTimestamp : () => new Date().toISOString();
        const getTodayKey = typeof config.getTodayKey === 'function' ? config.getTodayKey : () => new Date().toISOString().slice(0, 10);
        const showToast = typeof config.showToast === 'function' ? config.showToast : () => {};
        const render = typeof config.render === 'function' ? config.render : () => {};
        const syncNotifications = typeof config.syncNotifications === 'function' ? config.syncNotifications : () => {};
        const onChange = typeof config.onChange === 'function' ? config.onChange : () => {};
        const onAfterImport = typeof config.onAfterImport === 'function' ? config.onAfterImport : () => {};
        const onAfterDelete = typeof config.onAfterDelete === 'function' ? config.onAfterDelete : () => {};
        const onPanelToggle = typeof config.onPanelToggle === 'function' ? config.onPanelToggle : () => {};
        let currentSettings = normalizeAppSettings(config.initialSettings || defaultSettings);
        let deleteConfirmationCode = '';

        function requireStorage() {
            if (!storage || typeof storage.readJson !== 'function' || typeof storage.writeJson !== 'function') {
                throw new Error('TasklyzenSettings necesita una API de almacenamiento valida.');
            }
        }

        function setCurrentSettings(nextSettings, shouldNotify) {
            currentSettings = normalizeAppSettings(nextSettings);

            if (shouldNotify) {
                onChange(currentSettings);
            }

            return currentSettings;
        }

        function load() {
            requireStorage();
            return setCurrentSettings(storage.readJson(storageKey, defaultSettings), false);
        }

        function save() {
            requireStorage();
            storage.writeJson(storageKey, currentSettings);
        }

        function getSettings() {
            return currentSettings;
        }

        function apply(shouldRender) {
            const body = global.document && global.document.body;

            if (!body) {
                return;
            }

            body.classList.remove('theme-light', 'theme-dark');
            body.classList.add('theme-' + currentSettings.theme);
            body.classList.toggle('reduced-animations', !currentSettings.animations);
            body.classList.toggle('analytics-simple', currentSettings.simplifiedAnalytics);

            [
                '--blue',
                '--sky-blue',
                '--brand-primary',
                '--brand-secondary',
                '--state-info',
                '--progress-high',
                '--coral',
                '--brand-accent',
                '--paper',
                '--surface-page',
                '--app-background'
            ].forEach(name => {
                body.style.removeProperty(name);
            });

            if (shouldRender) {
                render();
            }
        }

        function syncControls() {
            if (dom.settingsThemeInputs) {
                dom.settingsThemeInputs.forEach(input => {
                    input.checked = input.value === currentSettings.theme;
                });
            }

            if (dom.settingsNotifications) {
                dom.settingsNotifications.checked = currentSettings.notifications;
            }

            syncNotifications();

            if (dom.settingsSound) {
                dom.settingsSound.checked = currentSettings.sound;
            }

            if (dom.settingsSoundVolume) {
                dom.settingsSoundVolume.value = Math.round(currentSettings.soundVolume * 100);
                dom.settingsSoundVolume.disabled = !currentSettings.sound;
            }

            if (dom.settingsSoundVolumeValue) {
                dom.settingsSoundVolumeValue.textContent = Math.round(currentSettings.soundVolume * 100) + '%';
            }

            if (dom.settingsAnimations) {
                dom.settingsAnimations.checked = currentSettings.animations;
            }

            if (dom.settingsSimplifiedAnalytics) {
                dom.settingsSimplifiedAnalytics.checked = currentSettings.simplifiedAnalytics;
            }

            if (dom.settingsProgressModeInputs) {
                dom.settingsProgressModeInputs.forEach(input => {
                    input.checked = input.value === currentSettings.progressMode;
                });
            }

            if (dom.settingsFocusGoal) {
                dom.settingsFocusGoal.value = currentSettings.dailyFocusGoalMinutes;
            }

            if (dom.settingsFocusGoalValue) {
                dom.settingsFocusGoalValue.textContent = currentSettings.dailyFocusGoalMinutes + ' min';
            }

            if (dom.settingsBackgroundTimer) {
                dom.settingsBackgroundTimer.checked = currentSettings.backgroundTimer;
            }

        }

        function update(changes, message, updateOptions) {
            const mode = updateOptions || {};

            setCurrentSettings({
                ...currentSettings,
                ...(changes || {})
            }, true);
            save();

            if (mode.apply !== false) {
                apply(mode.render !== false);
            }

            syncControls();

            if (message) {
                showToast(message, 'info');
            }

            return currentSettings;
        }

        function setPanelOpen(isOpen) {
            if (!dom.settingsPanel || !dom.settingsButton) {
                return;
            }

            dom.settingsPanel.hidden = !isOpen;
            dom.settingsButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
            onPanelToggle(Boolean(isOpen));
        }

        function togglePanel() {
            setPanelOpen(dom.settingsPanel ? dom.settingsPanel.hidden : true);
        }

        function getStorageKeys() {
            return Array.from(new Set(Object.values(storageKeys).filter(Boolean)));
        }

        function exportData() {
            const exportedStorage = {};

            getStorageKeys().forEach(key => {
                const value = storage.readText(key, null);

                if (value !== null) {
                    exportedStorage[key] = value;
                }
            });

            const payload = {
                app: 'Tasklyzen',
                version: 1,
                exportedAt: getNowTimestamp(),
                storage: exportedStorage
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = global.document.createElement('a');

            link.href = url;
            link.download = 'tasklyzen-respaldo-' + getTodayKey() + '.json';
            global.document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast('Respaldo exportado.', 'success');
        }

        function importData(file) {
            if (!file) {
                return;
            }

            const reader = new FileReader();

            reader.addEventListener('load', () => {
                try {
                    const payload = JSON.parse(String(reader.result || '{}'));
                    const importedStorage = payload && typeof payload.storage === 'object' ? payload.storage : null;

                    if (!importedStorage) {
                        throw new Error('Formato invalido');
                    }

                    getStorageKeys().forEach(key => {
                        if (Object.prototype.hasOwnProperty.call(importedStorage, key)) {
                            const value = importedStorage[key];

                            storage.writeText(key, typeof value === 'string' ? value : JSON.stringify(value));
                        } else {
                            storage.remove(key);
                        }
                    });

                    onAfterImport();
                    showToast('Respaldo restaurado correctamente.', 'success');
                } catch (error) {
                    showToast('No se pudo importar el respaldo.', 'error');
                }

                if (dom.settingsImportFile) {
                    dom.settingsImportFile.value = '';
                }
            });
            reader.readAsText(file);
        }

        function triggerImportFile() {
            if (dom.settingsImportFile) {
                dom.settingsImportFile.click();
            }
        }

        function handleImportFileChange(event) {
            const file = event.target && event.target.files ? event.target.files[0] : null;

            importData(file);
        }

        function openDeleteDataDialog() {
            if (!dom.deleteDataDialog || !dom.deleteConfirmInput || !dom.deleteConfirmCode || !dom.confirmDeleteData) {
                return;
            }

            deleteConfirmationCode = createDeleteConfirmationCode();
            dom.deleteConfirmCode.textContent = deleteConfirmationCode;
            dom.deleteConfirmInput.value = '';
            dom.confirmDeleteData.disabled = true;

            if (typeof dom.deleteDataDialog.showModal === 'function') {
                dom.deleteDataDialog.showModal();
            } else {
                dom.deleteDataDialog.setAttribute('open', '');
                dom.deleteDataDialog.classList.add('fallback-open');
            }

            dom.deleteConfirmInput.focus();
        }

        function closeDeleteDataDialog() {
            if (!dom.deleteDataDialog) {
                return;
            }

            if (typeof dom.deleteDataDialog.close === 'function') {
                dom.deleteDataDialog.close();
            } else {
                dom.deleteDataDialog.removeAttribute('open');
                dom.deleteDataDialog.classList.remove('fallback-open');
            }

            deleteConfirmationCode = '';
        }

        function updateDeleteConfirmationState() {
            if (!dom.deleteConfirmInput || !dom.confirmDeleteData) {
                return;
            }

            dom.confirmDeleteData.disabled = dom.deleteConfirmInput.value !== deleteConfirmationCode;
        }

        function deleteAllData() {
            if (!dom.deleteConfirmInput || dom.deleteConfirmInput.value !== deleteConfirmationCode) {
                closeDeleteDataDialog();
                showToast('El texto no coincidió. Eliminación cancelada.', 'error');
                return;
            }

            getStorageKeys().forEach(key => storage.remove(key));
            closeDeleteDataDialog();
            onAfterDelete();
            showToast('Todos los datos fueron eliminados.', 'info');
        }

        function handleDeleteDialogClick(event) {
            if (event.target === dom.deleteDataDialog) {
                closeDeleteDataDialog();
            }
        }

        function handleThemeChange(event) {
            if (!event.target || !event.target.matches('input[name="settings-theme"]')) {
                return;
            }

            update({ theme: event.target.value }, 'Tema actualizado.');
        }

        function handleNotificationsChange(event) {
            update({ notifications: Boolean(event.target.checked) }, event.target.checked ? 'Recordatorios activados.' : 'Recordatorios desactivados.');
        }

        function handleSoundChange(event) {
            update({ sound: Boolean(event.target.checked) }, event.target.checked ? 'Sonido activado.' : 'Sonido desactivado.');
        }

        function handleSoundVolumeInput(event) {
            update({
                soundVolume: normalizeSettingsVolume(Number(event.target.value) / 100)
            }, null, {
                apply: false,
                render: false
            });
        }

        function handleAnimationsChange(event) {
            update({ animations: Boolean(event.target.checked) }, event.target.checked ? 'Animaciones activadas.' : 'Animaciones desactivadas.');
        }

        function handleSimplifiedAnalyticsChange(event) {
            update({ simplifiedAnalytics: Boolean(event.target.checked) }, event.target.checked ? 'Analítica simplificada activada.' : 'Analítica completa activada.');
        }

        function handleProgressModeChange(event) {
            if (!event.target || !event.target.matches('input[name="settings-progress-mode"]')) {
                return;
            }

            update({ progressMode: event.target.value });
        }

        function handleFocusGoalInput(event) {
            update({
                dailyFocusGoalMinutes: Number(event.target.value)
            });
        }

        function handleBackgroundTimerChange(event) {
            update({ backgroundTimer: Boolean(event.target.checked) });
        }

        return {
            load,
            save,
            getSettings,
            apply,
            syncControls,
            update,
            setPanelOpen,
            togglePanel,
            getStorageKeys,
            exportData,
            importData,
            triggerImportFile,
            handleImportFileChange,
            openDeleteDataDialog,
            closeDeleteDataDialog,
            updateDeleteConfirmationState,
            deleteAllData,
            handleDeleteDialogClick,
            handleThemeChange,
            handleNotificationsChange,
            handleSoundChange,
            handleSoundVolumeInput,
            handleAnimationsChange,
            handleSimplifiedAnalyticsChange,
            handleProgressModeChange,
            handleFocusGoalInput,
            handleBackgroundTimerChange
        };
    }

    global.TasklyzenSettings = {
        defaultSettings,
        themeValues,
        progressModeValues,
        normalizeSettingsVolume,
        normalizeAppSettings,
        createSettingsController
    };
})(window);
