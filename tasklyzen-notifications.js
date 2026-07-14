/*
 * Modulo: notificaciones y recordatorios
 * Proposito:
 * - Separar avisos internos, permisos y recordatorios externos del runtime.
 * Entradas:
 * - DOM de notificaciones, ajustes actuales y callbacks de tareas.
 * Salidas:
 * - window.TasklyzenNotifications con controlador publico.
 * Dependencias:
 * - TasklyzenUiComponents para toast interno.
 */
(function exposeTasklyzenNotifications(global) {
    const DEFAULT_BROWSER_REMINDER_INTERVAL_MS = 20 * 60 * 1000;
    const DEFAULT_TOAST_DURATION_MS = 3600;
    const DEFAULT_TOAST_DEDUPE_MS = 1200;
    const REPETITIVE_FEEDBACK_MATCHERS = [
        'tarea completada',
        'tarea reactivada',
        'meta diaria completa',
        'meta semanal completa',
        'extra legendario',
        'logro desbloqueado',
        'nuevo escudo de racha',
        'racha rescatada',
        'logro agregado',
        'logro removido',
        'logros en revision',
        'logros reiniciados'
    ];

    function createNotificationController(options) {
        const config = options || {};
        const dom = config.dom || {};
        const components = config.components || global.TasklyzenUiComponents;
        const getSettings = typeof config.getSettings === 'function' ? config.getSettings : () => ({ notifications: true, sound: false });
        const getTodos = typeof config.getTodos === 'function' ? config.getTodos : () => [];
        const getTodayKey = typeof config.getTodayKey === 'function' ? config.getTodayKey : () => new Date().toISOString().slice(0, 10);
        const getTopPriorityTodo = typeof config.getTopPriorityTodo === 'function' ? config.getTopPriorityTodo : () => null;
        const getDeadlineState = typeof config.getDeadlineState === 'function' ? config.getDeadlineState : () => null;
        const isDeadlineLate = typeof config.isDeadlineLate === 'function' ? config.isDeadlineLate : () => false;
        const isAvailableToday = typeof config.isAvailableToday === 'function' ? config.isAvailableToday : () => false;
        const hasTaskSurface = typeof config.hasTaskSurface === 'function' ? config.hasTaskSurface : () => true;
        const setNotificationsEnabled = typeof config.setNotificationsEnabled === 'function' ? config.setNotificationsEnabled : () => {};
        const reminderIntervalMs = Number(config.reminderIntervalMs) > 0 ? Number(config.reminderIntervalMs) : DEFAULT_BROWSER_REMINDER_INTERVAL_MS;
        let toastTimer = null;
        let lastToast = {
            key: '',
            timestamp: 0
        };
        let activeToastPriority = 0;
        let deadlineNotificationKey = '';
        let browserNotificationKey = '';
        let permissionAttempted = false;

        function normalizeToastText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        }

        function getToastPriority(type, options) {
            if (options && (options.critical || options.priority === 'critical')) {
                return 3;
            }

            if (type === 'error') {
                return 3;
            }

            if (type === 'warning') {
                return 2;
            }

            return 1;
        }

        function shouldSuppressRepetitiveToast(message, type, options) {
            if (type === 'error' || (options && options.allowRepetitive)) {
                return false;
            }

            const normalizedMessage = normalizeToastText(message);

            return REPETITIVE_FEEDBACK_MATCHERS.some(pattern => normalizedMessage.includes(pattern));
        }

        function getSafeSettings() {
            const settings = getSettings() || {};

            return {
                notifications: settings.notifications !== false,
                sound: Boolean(settings.sound)
            };
        }

        function shouldSuppressToast(key, type, dedupeMs) {
            if (type === 'error') {
                return false;
            }

            const now = Date.now();
            const windowMs = Number.isFinite(dedupeMs) ? dedupeMs : DEFAULT_TOAST_DEDUPE_MS;

            if (key && key === lastToast.key && now - lastToast.timestamp < windowMs) {
                return true;
            }

            lastToast = {
                key,
                timestamp: now
            };
            return false;
        }

        function showToast(message, type, toastOptions) {
            if (!dom.toast || !message) {
                return;
            }

            const options = toastOptions || {};
            const toastType = type || 'info';
            const key = options.key || toastType + '|' + message;
            const nextPriority = getToastPriority(toastType, options);

            if (shouldSuppressRepetitiveToast(message, toastType, options)) {
                return;
            }

            if (activeToastPriority >= 3 && nextPriority < activeToastPriority && !options.replaceCritical) {
                return;
            }

            if (options.dedupe !== false && shouldSuppressToast(key, toastType, options.dedupeMs)) {
                return;
            }

            global.clearTimeout(toastTimer);
            activeToastPriority = nextPriority;
            components.renderToast(dom.toast, {
                message,
                type
            });

            toastTimer = global.setTimeout(() => {
                dom.toast.classList.remove('show');
                activeToastPriority = 0;
            }, Number(options.durationMs) > 0 ? Number(options.durationMs) : DEFAULT_TOAST_DURATION_MS);
        }

        function canUseBrowserNotifications() {
            return typeof global !== 'undefined' && 'Notification' in global;
        }

        function getBrowserNotificationPermission() {
            if (!canUseBrowserNotifications()) {
                return 'unsupported';
            }

            return global.Notification.permission;
        }

        function getEnvironmentInfo() {
            return {
                permission: getBrowserNotificationPermission(),
                protocol: global.location ? global.location.protocol : '',
                secure: global.isSecureContext !== false
            };
        }

        function getGuideText() {
            const info = getEnvironmentInfo();

            if (info.permission === 'granted') {
                return 'Listo. Usa Probar aviso si quieres confirmar que funcionan.';
            }

            if (info.permission === 'denied') {
                return 'Avisos bloqueados. Abre los permisos de este sitio desde tu navegador y cambia Notificaciones a Permitir.';
            }

            if (info.protocol === 'file:') {
                return 'Estas abriendo Tasklyzen como archivo local. Algunos navegadores no conservan permisos asi; usa una version servida de la app para activar avisos externos.';
            }

            if (!info.secure) {
                return 'Tu navegador exige una conexion segura para permitir notificaciones externas.';
            }

            return 'Avisos pendientes. Si no aparece una ventana, revisa los permisos de notificaciones del navegador.';
        }

        function getStatusCopy() {
            const permission = getBrowserNotificationPermission();

            if (!getSafeSettings().notifications) {
                return {
                    tone: 'off',
                    text: 'Desactivadas. Activa recordatorios para recibir avisos internos y externos.',
                    canRequest: false,
                    canTest: false,
                    permissionLabel: 'Permitir avisos'
                };
            }

            if (permission === 'unsupported') {
                return {
                    tone: 'unsupported',
                    text: 'Este navegador no permite notificaciones aqui. Tasklyzen usara solo avisos dentro de la app.',
                    canRequest: false,
                    canTest: false,
                    permissionLabel: 'No disponible'
                };
            }

            if (permission === 'denied') {
                return {
                    tone: 'blocked',
                    text: 'Permiso bloqueado. Activalo desde los permisos del navegador para recibir avisos fuera de la app.',
                    canRequest: false,
                    canTest: false,
                    permissionLabel: 'Bloqueado'
                };
            }

            if (permission === 'granted') {
                return {
                    tone: 'active',
                    text: 'Listo. Te avisare si hay tareas vencidas, por vencer o pendientes cuando Tasklyzen este en segundo plano.',
                    canRequest: false,
                    canTest: true,
                    permissionLabel: 'Activado'
                };
            }

            if (permissionAttempted) {
                return {
                    tone: 'manual',
                    text: 'El navegador no concedio el permiso. Si no viste una ventana, revisa el icono de candado o permisos del sitio y permite notificaciones.',
                    canRequest: true,
                    canTest: true,
                    permissionLabel: 'Reintentar permiso'
                };
            }

            return {
                tone: 'pending',
                text: 'Falta permiso de avisos. Pulsa Permitir avisos o Probar aviso para activarlo.',
                canRequest: true,
                canTest: true,
                permissionLabel: 'Permitir avisos'
            };
        }

        function syncControls() {
            const status = getStatusCopy();

            if (dom.settingsNotificationStatus) {
                dom.settingsNotificationStatus.className = 'notification-status-card ' + status.tone;

                if (dom.settingsNotificationStatusText) {
                    dom.settingsNotificationStatusText.textContent = 'Estado: ' + status.text;
                } else {
                    dom.settingsNotificationStatus.textContent = 'Estado: ' + status.text;
                }
            }

            if (dom.settingsNotificationPermission) {
                dom.settingsNotificationPermission.textContent = status.permissionLabel;
                dom.settingsNotificationPermission.disabled = !status.canRequest;
            }

            if (dom.settingsNotificationTest) {
                dom.settingsNotificationTest.disabled = !getSafeSettings().notifications;
            }

            if (dom.settingsNotificationGuide) {
                dom.settingsNotificationGuide.textContent = getGuideText();
            }
        }

        function requestBrowserPermission() {
            if (!canUseBrowserNotifications()) {
                showToast('Tu navegador no permite notificaciones desde esta app.', 'error');
                syncControls();
                return Promise.resolve('unsupported');
            }

            if (global.Notification.permission === 'granted' || global.Notification.permission === 'denied') {
                syncControls();
                return Promise.resolve(global.Notification.permission);
            }

            permissionAttempted = true;

            return new Promise(resolve => {
                let settled = false;
                let pollTimer = null;
                let timeoutTimer = null;

                const finish = permission => {
                    const finalPermission = permission || getBrowserNotificationPermission();

                    if (settled) {
                        return;
                    }

                    settled = true;
                    global.clearInterval(pollTimer);
                    global.clearTimeout(timeoutTimer);

                    if (finalPermission === 'granted') {
                        showToast('Recordatorios del navegador activados.', 'success');
                    } else if (finalPermission === 'denied') {
                        showToast('El navegador bloqueo las notificaciones.', 'error');
                    } else {
                        showToast('El permiso sigue pendiente. Revisa los permisos del sitio en el navegador.', 'info');
                    }

                    syncControls();
                    resolve(finalPermission);
                };

                try {
                    const requestResult = global.Notification.requestPermission();

                    pollTimer = global.setInterval(() => {
                        const currentPermission = getBrowserNotificationPermission();

                        if (currentPermission === 'granted' || currentPermission === 'denied') {
                            finish(currentPermission);
                        }
                    }, 250);
                    timeoutTimer = global.setTimeout(() => finish(getBrowserNotificationPermission()), 20000);

                    if (requestResult && typeof requestResult.then === 'function') {
                        requestResult.then(finish).catch(() => finish('denied'));
                    }
                } catch (error) {
                    finish('denied');
                }
            });
        }

        function getTasklyzenNotificationTitle(title) {
            const cleanTitle = String(title || '').trim();

            if (!cleanTitle) {
                return 'Tasklyzen';
            }

            if (cleanTitle.toLowerCase().startsWith('tasklyzen')) {
                return cleanTitle;
            }

            return 'Tasklyzen - ' + cleanTitle;
        }

        function createBrowserNotification(title, body, tag) {
            if (!canUseBrowserNotifications() || global.Notification.permission !== 'granted') {
                return false;
            }

            try {
                const notification = new global.Notification(getTasklyzenNotificationTitle(title), {
                    body,
                    tag,
                    renotify: false,
                    requireInteraction: false,
                    silent: !getSafeSettings().sound
                });

                notification.onclick = () => {
                    global.focus();
                    notification.close();
                };

                return true;
            } catch (error) {
                return false;
            }
        }

        function sendNotificationReadyConfirmation() {
            return createBrowserNotification(
                'Listo',
                'Permiso activado. Te avisare cuando haya tareas relevantes.',
                'tasklyzen-permission-ready-' + Date.now()
            );
        }

        function getBrowserReminderPayload() {
            const todos = getTodos();
            const lateTodos = todos.filter(isDeadlineLate);
            const soonTodos = todos.filter(todo => {
                const state = getDeadlineState(todo);

                return state && state.level === 'soon';
            });
            const availableTodos = todos.filter(isAvailableToday);
            const topTodo = getTopPriorityTodo();

            if (lateTodos.length > 0) {
                return {
                    key: 'late|' + getTodayKey() + '|' + lateTodos.map(todo => todo.id).sort().join(','),
                    title: lateTodos.length === 1 ? 'Tarea vencida' : 'Tareas vencidas',
                    body: lateTodos.length === 1
                        ? 'Hay 1 tarea fuera de tiempo. Abre Tasklyzen para decidir que hacer.'
                        : 'Hay ' + lateTodos.length + ' tareas fuera de tiempo. Abre Tasklyzen para despejar el foco.'
                };
            }

            if (soonTodos.length > 0) {
                const firstSoon = soonTodos[0];
                const preview = firstSoon.text.length > 44 ? firstSoon.text.slice(0, 41) + '...' : firstSoon.text;

                return {
                    key: 'soon|' + getTodayKey() + '|' + soonTodos.map(todo => todo.id).sort().join(','),
                    title: soonTodos.length === 1 ? 'Tarea por vencer' : 'Tareas por vencer',
                    body: soonTodos.length === 1
                        ? '"' + preview + '" esta por vencer. Toca para abrir Tasklyzen.'
                        : soonTodos.length + ' tareas estan por vencer. Toca para abrir Tasklyzen.'
                };
            }

            if (topTodo && availableTodos.length > 0) {
                const preview = topTodo.text.length > 48 ? topTodo.text.slice(0, 45) + '...' : topTodo.text;
                const remaining = availableTodos.length - 1;

                return {
                    key: 'pending|' + getTodayKey() + '|' + topTodo.id + '|' + availableTodos.length,
                    title: 'Tu proxima tarea te espera',
                    body: '"' + preview + '"' + (remaining > 0 ? ' y ' + remaining + ' mas despues.' : ' es el mejor siguiente paso.')
                };
            }

            return null;
        }

        function sendBrowserTaskReminder(force) {
            const payload = getBrowserReminderPayload();

            if (!getSafeSettings().notifications || !payload) {
                return false;
            }

            if (!force && typeof global.document !== 'undefined' && global.document.visibilityState === 'visible') {
                return false;
            }

            if (!force && payload.key === browserNotificationKey) {
                return false;
            }

            if (createBrowserNotification(payload.title, payload.body, 'tasklyzen-' + payload.key)) {
                browserNotificationKey = payload.key;
                return true;
            }

            return false;
        }

        function notifyDeadlineRisks() {
            if (!getSafeSettings().notifications || !hasTaskSurface()) {
                return;
            }

            const todos = getTodos();
            const soonTodos = todos.filter(todo => {
                const state = getDeadlineState(todo);

                return state && state.level === 'soon';
            });
            const lateTodos = todos.filter(isDeadlineLate);
            const notificationKey = [
                getTodayKey(),
                soonTodos.map(todo => todo.id).sort().join(','),
                lateTodos.map(todo => todo.id).sort().join(',')
            ].join('|');

            if ((!soonTodos.length && !lateTodos.length) || notificationKey === deadlineNotificationKey) {
                sendBrowserTaskReminder(false);
                return;
            }

            deadlineNotificationKey = notificationKey;

            if (lateTodos.length > 0) {
                showToast(lateTodos.length === 1 ? 'Tienes 1 tarea vencida para revisar.' : 'Tienes ' + lateTodos.length + ' tareas vencidas para revisar.', 'error', {
                    key: 'deadline-late|' + notificationKey
                });
                sendBrowserTaskReminder(false);
                return;
            }

            showToast(soonTodos.length === 1 ? '1 tarea esta proxima a vencer.' : soonTodos.length + ' tareas estan proximas a vencer.', 'info', {
                key: 'deadline-soon|' + notificationKey
            });
            sendBrowserTaskReminder(false);
        }

        function handlePreferenceChange(event) {
            const enabled = Boolean(event.target.checked);

            deadlineNotificationKey = '';
            browserNotificationKey = '';
            setNotificationsEnabled(enabled);

            if (enabled) {
                requestBrowserPermission().then(permission => {
                    notifyDeadlineRisks();

                    if (permission === 'granted' && !sendBrowserTaskReminder(true)) {
                        sendNotificationReadyConfirmation();
                    }

                    syncControls();
                });
                return;
            }

            notifyDeadlineRisks();
            syncControls();
        }

        function handlePermissionClick() {
            if (!getSafeSettings().notifications) {
                showToast('Activa recordatorios antes de pedir permiso.', 'info');
                return;
            }

            requestBrowserPermission().then(permission => {
                if (permission === 'granted') {
                    const sentTaskReminder = sendBrowserTaskReminder(true);

                    if (!sentTaskReminder) {
                        sendNotificationReadyConfirmation();
                    }
                }

                syncControls();
            });
        }

        function handleTestClick() {
            if (!getSafeSettings().notifications) {
                showToast('Activa recordatorios para probarlos.', 'info');
                return;
            }

            requestBrowserPermission().then(permission => {
                if (permission !== 'granted') {
                    showToast('Prueba interna: la app si puede avisarte aqui, pero el navegador aun no permite avisos externos.', 'info');
                    syncControls();
                    return;
                }

                const sentTaskReminder = sendBrowserTaskReminder(true);

                if (!sentTaskReminder) {
                    createBrowserNotification('Listo', 'Las notificaciones funcionan. Te avisare cuando haya tareas relevantes.', 'tasklyzen-test-' + Date.now());
                }

                showToast('Aviso de prueba enviado.', 'success');
                syncControls();
            });
        }

        function resetExternalState() {
            deadlineNotificationKey = '';
            browserNotificationKey = '';
        }

        return {
            canUseBrowserNotifications,
            getBrowserNotificationPermission,
            getEnvironmentInfo,
            getGuideText,
            getStatusCopy,
            syncControls,
            requestBrowserPermission,
            createBrowserNotification,
            sendNotificationReadyConfirmation,
            getBrowserReminderPayload,
            sendBrowserTaskReminder,
            notifyDeadlineRisks,
            showToast,
            handlePreferenceChange,
            handlePermissionClick,
            handleTestClick,
            resetExternalState,
            getReminderIntervalMs: () => reminderIntervalMs
        };
    }

    global.TasklyzenNotifications = {
        DEFAULT_BROWSER_REMINDER_INTERVAL_MS,
        createNotificationController
    };
})(window);
