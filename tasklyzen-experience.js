/*
 * Modulo: bienvenida y personalizacion versionada
 * Proposito:
 * - Presentar el flujo principal y recoger preferencias sin repetir el recorrido.
 * Entradas:
 * - Storage, settings, meta diaria, DOM y contexto de entrada.
 * Salidas:
 * - window.TasklyzenExperience con normalizacion y controlador.
 * Dependencias:
 * - TasklyzenSettings por inyeccion o global.
 */
(function exposeTasklyzenExperience(global) {
    const SCHEMA_VERSION = 1;
    const PROFILE_VERSION = 1;
    const WALKTHROUGH_VERSION = 2;
    const STEP_COUNT = 5;
    const VALID_STATUSES = ['pending', 'completed', 'deferred'];
    const VALID_SOURCES = ['new', 'migration', 'manual', 'reset'];

    function normalizeExperienceState(value) {
        const source = value && typeof value === 'object' ? value : {};

        return {
            schemaVersion: SCHEMA_VERSION,
            profileVersion: Math.max(Number(source.profileVersion) || 0, 0),
            walkthroughVersion: Math.max(Number(source.walkthroughVersion) || 0, 0),
            status: VALID_STATUSES.includes(source.status) ? source.status : 'pending',
            lastStep: Math.min(Math.max(Math.round(Number(source.lastStep) || 0), 0), STEP_COUNT - 1),
            lastOfferedVersion: Math.max(Number(source.lastOfferedVersion) || 0, 0),
            source: VALID_SOURCES.includes(source.source) ? source.source : 'new',
            completedAt: typeof source.completedAt === 'string' ? source.completedAt : null,
            deferredAt: typeof source.deferredAt === 'string' ? source.deferredAt : null
        };
    }

    function shouldOfferExperience(value) {
        const state = normalizeExperienceState(value);
        const isCurrent = state.profileVersion >= PROFILE_VERSION
            && state.walkthroughVersion >= WALKTHROUGH_VERSION;

        if (state.status === 'completed' && isCurrent) {
            return false;
        }

        if (state.status === 'deferred' && state.lastOfferedVersion >= WALKTHROUGH_VERSION) {
            return false;
        }

        return true;
    }

    function createExperienceController(options) {
        const config = options || {};
        const storage = config.storage || {};
        const storageKey = config.storageKey || 'tasklyzen-experience-state';
        const dom = config.dom || {};
        const documentRef = config.documentRef || global.document;
        const normalizeSettings = typeof config.normalizeSettings === 'function'
            ? config.normalizeSettings
            : settings => ({ ...(settings || {}) });
        const getSettings = typeof config.getSettings === 'function' ? config.getSettings : () => ({});
        const applySettings = typeof config.applySettings === 'function' ? config.applySettings : () => {};
        const getDailyGoal = typeof config.getDailyGoal === 'function' ? config.getDailyGoal : () => 3;
        const applyDailyGoal = typeof config.applyDailyGoal === 'function' ? config.applyDailyGoal : () => {};
        const getNowTimestamp = typeof config.getNowTimestamp === 'function'
            ? config.getNowTimestamp
            : () => new Date().toISOString();
        const onOpen = typeof config.onOpen === 'function' ? config.onOpen : () => {};
        const onClose = typeof config.onClose === 'function' ? config.onClose : () => {};
        const onComplete = typeof config.onComplete === 'function' ? config.onComplete : () => {};
        const onPreviewSound = typeof config.onPreviewSound === 'function' ? config.onPreviewSound : () => {};
        const onPreviewAnimation = typeof config.onPreviewAnimation === 'function' ? config.onPreviewAnimation : () => {};
        const onRequestNotificationPermission = typeof config.onRequestNotificationPermission === 'function' ? config.onRequestNotificationPermission : () => {};
        const defaultSettings = normalizeSettings(config.defaultSettings || {});
        const defaultDailyGoal = Math.min(Math.max(Math.round(Number(config.defaultDailyGoal) || 3), 1), 20);
        let state = normalizeExperienceState(read());
        let stateBeforeOpen = state;
        let source = 'new';
        let step = 0;
        let draftSettings = normalizeSettings(getSettings());
        let draftDailyGoal = normalizeDailyGoal(getDailyGoal());
        let initialized = false;

        function read() {
            return typeof storage.readJson === 'function' ? storage.readJson(storageKey, null) : null;
        }

        function save() {
            if (typeof storage.writeJson === 'function') {
                storage.writeJson(storageKey, state);
            }
            return getState();
        }

        function reload() {
            state = normalizeExperienceState(read());
            return getState();
        }

        function reset() {
            state = normalizeExperienceState(null);
            return getState();
        }

        function getState() {
            return { ...state };
        }

        function normalizeDailyGoal(value) {
            return Math.min(Math.max(Math.round(Number(value) || defaultDailyGoal), 1), 20);
        }

        function isOpen() {
            return Boolean(dom.dialog && dom.dialog.open);
        }

        function getSourceCopy() {
            if (source === 'migration') {
                return {
                    kicker: 'Guía esencial',
                    title: 'Conoce Tasklyzen de principio a fin',
                    message: 'Repasa las herramientas principales y descubre cómo se conectan para ayudarte a estudiar con menos fricción.',
                    secondary: 'Omitir guía'
                };
            }

            if (source === 'manual') {
                return {
                    kicker: 'Guía esencial',
                    title: 'Cómo funciona Tasklyzen',
                    message: 'Repasa el flujo completo sin perder tus tareas ni tus preferencias actuales.',
                    secondary: 'Cerrar'
                };
            }

            if (source === 'reset') {
                return {
                    kicker: 'Empezar de nuevo',
                    title: 'Prepara tu centro de estudio',
                    message: 'Conoce cada herramienta importante y vuelve a elegir cómo quieres medir tu avance.',
                    secondary: 'Omitir configuración'
                };
            }

            return {
                kicker: 'Tu primer recorrido',
                title: 'Conoce tu centro de estudio',
                message: 'Aprende el flujo principal en cinco pasos breves y deja Tasklyzen listo para ti.',
                secondary: 'Omitir configuración'
            };
        }

        function renderTasksGuide() {
            const copy = getSourceCopy();

            return [
                '<div class="experience-intro">',
                '<p>' + copy.message + '</p>',
                '<div class="experience-showcase experience-showcase--tasks" role="img" aria-label="Ejemplo de una tarea simple y un hito en Tasklyzen">',
                '<div class="experience-mini-create"><i aria-hidden="true"></i><strong>Escribe para crear una tarea</strong></div>',
                '<div class="experience-mini-task">',
                '<i class="experience-mini-check" aria-hidden="true"></i>',
                '<span><strong>Leer capítulo de historia</strong><small>Tarea simple · Hoy</small></span>',
                '<em>Normal</em><i class="experience-mini-chevron" aria-hidden="true"></i>',
                '</div>',
                '<div class="experience-mini-task is-milestone">',
                '<i class="experience-mini-check" aria-hidden="true"></i>',
                '<span><strong>Preparar exposición</strong><small>Hito · 2 de 4 subtareas</small><b class="experience-mini-progress"><i></i></b></span>',
                '<em>Importante</em><i class="experience-mini-chevron" aria-hidden="true"></i>',
                '</div>',
                '</div>',
                '<div class="experience-caption-grid">',
                '<p><strong>Completa</strong><span>Marca el círculo para darla por terminada.</span></p>',
                '<p><strong>Consulta</strong><span>Toca la tarjeta para desplegar detalles.</span></p>',
                '<p><strong>Divide</strong><span>Convierte proyectos grandes en hitos.</span></p>',
                '</div>'
            ].join('');
        }

        function renderRaceGuide() {
            return [
                '<div class="experience-intro">',
                '<p>Modo Carrera reúne las tareas elegidas en una sesión y conserva el contador aunque vuelvas a la lista.</p>',
                '<div class="experience-showcase experience-showcase--race" role="img" aria-label="Ejemplo del cronómetro y la cola de tareas de Modo Carrera">',
                '<div class="experience-mini-modes"><span>Ritmo libre</span><span class="is-active">Contra reloj</span></div>',
                '<div class="experience-mini-pomodoro"><i class="experience-mini-check" aria-hidden="true"></i><span>Usar Pomodoro</span></div>',
                '<div class="experience-mini-race-layout">',
                '<div class="experience-mini-clock"><i aria-hidden="true"></i><strong>24:36</strong><small>Tiempo en tarea</small></div>',
                '<div class="experience-mini-queue"><small>Ahora</small><strong>Resolver ejercicios</strong><b><i></i></b><span>3 tareas en esta Carrera</span></div>',
                '</div>',
                '</div>',
                '<div class="experience-caption-grid experience-caption-grid--race">',
                '<p><strong>Elige</strong><span>Todas tus tareas o una selección.</span></p>',
                '<p><strong>Continúa</strong><span>El tiempo de sesión no se reinicia.</span></p>',
                '<p><strong>Comprende</strong><span>Al cerrar verás el tiempo por tarea.</span></p>',
                '</div>'
            ].join('');
        }

        function renderProgressGuide() {
            return [
                '<div class="experience-intro">',
                '<p>La barra superior resume lo esencial. Al tocar un indicador se abre su contexto dentro de Progreso.</p>',
                '<div class="experience-showcase experience-showcase--progress" role="img" aria-label="Ejemplo de la barra compacta y el panel de Progreso">',
                '<div class="experience-mini-summary">',
                '<strong>Hoy 2/3</strong><b><i></i></b><span class="experience-mini-flame" aria-hidden="true"></span><strong>4</strong><span>Semana <strong>67%</strong></span>',
                '</div>',
                '<div class="experience-mini-panel">',
                '<nav><span class="is-active">Hoy</span><span>Rendimiento</span><span>Racha</span></nav>',
                '<div class="experience-mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
                '<p><strong>Tu mejor ritmo: viernes</strong><span>Reserva ahí tu tarea más importante.</span></p>',
                '</div>',
                '</div>',
                '<div class="experience-caption-grid experience-caption-grid--progress">',
                '<p><strong>Hoy</strong><span>Tu meta y avance diario.</span></p>',
                '<p><strong>Rendimiento</strong><span>Tu constancia reciente.</span></p>',
                '<p><strong>Racha</strong><span>Días con progreso significativo.</span></p>',
                '</div>'
            ].join('');
        }

        function renderComfort() {
            return [
                '<fieldset class="experience-fieldset">',
                '<legend>Elige el ambiente que te resulte más cómodo</legend>',
                '<div class="experience-choice-row">',
                renderChoice('experience-theme', 'light', 'Claro', 'Luminoso y suave', draftSettings.theme === 'light'),
                renderChoice('experience-theme', 'dark', 'Oscuro', 'Contraste para sesiones nocturnas', draftSettings.theme === 'dark'),
                '</div>',
                '</fieldset>',
                '<div class="experience-switch-list">',
                renderSwitch('sound', 'Efectos sonoros', 'Reproduce un sonido breve al completar tareas.', draftSettings.sound),
                renderSwitch('animations', 'Animaciones de celebración', 'Controla los efectos visuales al avanzar.', draftSettings.animations),
                renderSwitch('backgroundTimer', 'Continuar en segundo plano', 'La Carrera sigue mientras estudias en otras pestañas o aplicaciones.', draftSettings.backgroundTimer),
                renderSwitch('notifications', 'Recordatorios inteligentes', 'Avisa cuando tengas pendientes relevantes.', draftSettings.notifications),
                '</div>'
            ].join('');
        }

        function renderGoals() {
            const mode = draftSettings.progressMode || 'tasks';
            const taskGoalVisible = mode !== 'focus';
            const focusGoalVisible = mode !== 'tasks';
            const modeLabel = mode === 'focus' ? 'Enfoque' : mode === 'balanced' ? 'Equilibrado' : 'Avances';
            const goalLabel = mode === 'focus'
                ? draftSettings.dailyFocusGoalMinutes + ' min'
                : mode === 'balanced'
                    ? draftDailyGoal + ' tareas + ' + draftSettings.dailyFocusGoalMinutes + ' min'
                    : draftDailyGoal + ' tareas';

            return [
                '<fieldset class="experience-fieldset">',
                '<legend>¿Qué debe representar un buen día?</legend>',
                '<div class="experience-mode-list">',
                renderChoice('experience-progress-mode', 'tasks', 'Avances', 'Tareas y pasos cerrados.', mode === 'tasks'),
                renderChoice('experience-progress-mode', 'focus', 'Enfoque', 'Tiempo confirmado.', mode === 'focus'),
                renderChoice('experience-progress-mode', 'balanced', 'Equilibrado', 'Avance y tiempo.', mode === 'balanced'),
                '</div>',
                '</fieldset>',
                '<div class="experience-goals">',
                taskGoalVisible ? renderNumberField('dailyGoal', 'Tareas por día', draftDailyGoal, 1, 20, 1) : '',
                focusGoalVisible ? renderNumberField('dailyFocusGoalMinutes', 'Minutos de enfoque', draftSettings.dailyFocusGoalMinutes, 15, 240, 5) : '',
                '</div>',
                '<div class="experience-summary" aria-label="Resumen de personalización">',
                '<span><small>Progreso</small><strong>' + modeLabel + '</strong></span>',
                '<span><small>Meta</small><strong>' + goalLabel + '</strong></span>',
                '<span><small>Ambiente</small><strong>' + (draftSettings.theme === 'dark' ? 'Oscuro' : 'Claro') + '</strong></span>',
                '</div>'
            ].join('');
        }

        function renderChoice(name, value, title, description, checked) {
            return '<label class="experience-choice' + (checked ? ' is-selected' : '') + '">'
                + '<input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '>'
                + '<span><strong>' + title + '</strong><small>' + description + '</small></span>'
                + '</label>';
        }

        function renderSwitch(setting, title, description, checked) {
            return '<label class="experience-switch">'
                + '<span><strong>' + title + '</strong><small>' + description + '</small></span>'
                + '<input type="checkbox" data-experience-setting="' + setting + '"' + (checked ? ' checked' : '') + '>'
                + '<i aria-hidden="true"></i>'
                + '</label>';
        }

        function renderNumberField(setting, label, value, min, max, stepValue) {
            return '<label class="experience-number-field">'
                + '<span>' + label + '</span>'
                + '<input type="number" data-experience-setting="' + setting + '" min="' + min + '" max="' + max + '" step="' + stepValue + '" value="' + value + '">'
                + '</label>';
        }

        function renderStep(shouldFocus) {
            if (!dom.body || !dom.title || !dom.kicker || !dom.progress || !dom.back || !dom.next || !dom.secondary) {
                return;
            }

            const sourceCopy = getSourceCopy();
            const steps = [
                { kicker: sourceCopy.kicker, title: sourceCopy.title, render: renderTasksGuide },
                { kicker: 'Paso 2 de 5', title: 'Trabaja con Modo Carrera', render: renderRaceGuide },
                { kicker: 'Paso 3 de 5', title: 'Entiende tu progreso', render: renderProgressGuide },
                { kicker: 'Paso 4 de 5', title: 'Hazla cómoda para ti', render: renderComfort },
                { kicker: 'Paso 5 de 5', title: 'Define qué significa avanzar', render: renderGoals }
            ];
            const current = steps[step];

            dom.kicker.textContent = current.kicker;
            dom.title.textContent = current.title;
            dom.body.innerHTML = current.render();
            dom.progress.innerHTML = Array.from({ length: STEP_COUNT }, (_item, index) => (
                '<span class="' + (index <= step ? 'is-active' : '') + '" aria-hidden="true"></span>'
            )).join('');
            dom.progress.setAttribute('aria-label', 'Paso ' + (step + 1) + ' de ' + STEP_COUNT);
            dom.back.hidden = step === 0;
            dom.next.textContent = step === STEP_COUNT - 1
                ? (source === 'migration' || source === 'manual' ? 'Guardar cambios' : 'Guardar y empezar')
                : 'Continuar';
            dom.secondary.textContent = sourceCopy.secondary;

            if (shouldFocus && typeof dom.title.focus === 'function') {
                dom.title.focus({ preventScroll: true });
            }
        }

        function open(openOptions) {
            const mode = openOptions || {};

            source = VALID_SOURCES.includes(mode.source) ? mode.source : 'new';
            stateBeforeOpen = getState();
            draftSettings = normalizeSettings(getSettings());
            draftDailyGoal = normalizeDailyGoal(getDailyGoal());
            step = mode.resume ? state.lastStep : 0;
            renderStep(false);

            if (dom.dialog && typeof dom.dialog.showModal === 'function' && !dom.dialog.open) {
                dom.dialog.showModal();
            } else if (dom.dialog) {
                dom.dialog.setAttribute('open', '');
            }
            if (documentRef && documentRef.body) {
                documentRef.body.classList.add('experience-active');
            }
            onOpen({ source });
            if (dom.title && typeof dom.title.focus === 'function') {
                dom.title.focus({ preventScroll: true });
            }
            return { opened: true, source };
        }

        function maybeOpen(context) {
            const launch = context || {};

            reload();
            if (!shouldOfferExperience(state)) {
                return { opened: false, reason: 'already-seen' };
            }

            return open({
                source: launch.source || (launch.hasExistingData ? 'migration' : 'new'),
                resume: state.status === 'pending' && state.lastStep > 0
            });
        }

        function close() {
            if (dom.dialog && typeof dom.dialog.close === 'function' && dom.dialog.open) {
                dom.dialog.close();
            } else if (dom.dialog) {
                dom.dialog.removeAttribute('open');
            }
            if (documentRef && documentRef.body) {
                documentRef.body.classList.remove('experience-active');
            }
            onClose({ source });
        }

        function defer() {
            if (source === 'manual') {
                state = normalizeExperienceState(stateBeforeOpen);
                close();
                return getState();
            }

            state = normalizeExperienceState({
                ...state,
                status: 'deferred',
                lastStep: step,
                lastOfferedVersion: WALKTHROUGH_VERSION,
                source,
                deferredAt: getNowTimestamp()
            });
            save();
            close();
            return getState();
        }

        function complete(useDefaults) {
            if (useDefaults) {
                draftSettings = normalizeSettings(defaultSettings);
                draftDailyGoal = defaultDailyGoal;
            }

            applySettings(normalizeSettings(draftSettings));
            applyDailyGoal(normalizeDailyGoal(draftDailyGoal));
            state = normalizeExperienceState({
                ...state,
                status: 'completed',
                profileVersion: PROFILE_VERSION,
                walkthroughVersion: WALKTHROUGH_VERSION,
                lastOfferedVersion: WALKTHROUGH_VERSION,
                lastStep: STEP_COUNT - 1,
                source,
                completedAt: getNowTimestamp(),
                deferredAt: null
            });
            save();
            close();
            onComplete({ source, settings: normalizeSettings(draftSettings), dailyGoal: draftDailyGoal });
            return getState();
        }

        function handleSecondaryAction() {
            if (source === 'new' || source === 'reset') {
                return complete(true);
            }
            return defer();
        }

        function handleClick(event) {
            if (!event || !event.target) {
                return;
            }
            if (event.target === dom.dialog) {
                return;
            }

            const action = event.target.closest ? event.target.closest('[data-experience-action]') : null;
            if (!action) {
                return;
            }

            if (action.dataset.experienceAction === 'back') {
                step = Math.max(step - 1, 0);
                renderStep(true);
            } else if (action.dataset.experienceAction === 'next') {
                if (step >= STEP_COUNT - 1) {
                    complete(false);
                } else {
                    step += 1;
                    renderStep(true);
                }
            } else {
                handleSecondaryAction();
            }
        }

        function handleChange(event) {
            const target = event && event.target;
            if (!target) {
                return;
            }

            if (target.name === 'experience-theme') {
                draftSettings.theme = target.value;
                applySettings(normalizeSettings(draftSettings));
                renderStep(false);
                return;
            }

            if (target.name === 'experience-progress-mode') {
                draftSettings.progressMode = target.value;
                applySettings(normalizeSettings(draftSettings));
                renderStep(false);
                return;
            }

            const setting = target.dataset ? target.dataset.experienceSetting : null;
            if (!setting) {
                return;
            }

            if (setting === 'dailyGoal') {
                draftDailyGoal = normalizeDailyGoal(target.value);
                return;
            }

            if (target.type === 'checkbox') {
                draftSettings[setting] = Boolean(target.checked);
                applySettings(normalizeSettings(draftSettings));

                if (event.type === 'change') {
                    if (setting === 'sound' && target.checked) {
                        onPreviewSound();
                    }

                    if (setting === 'animations' && target.checked) {
                        onPreviewAnimation();
                    }
                    if (setting === 'notifications' && target.checked) {
                        const promise = onRequestNotificationPermission();
                        if (promise && typeof promise.then === 'function') {
                            promise.then(permission => {
                                if (permission !== 'granted') {
                                    target.checked = false;
                                    draftSettings[setting] = false;
                                    applySettings(normalizeSettings(draftSettings));
                                }
                            });
                        }
                    }
                }
            } else if (setting === 'dailyFocusGoalMinutes') {
                draftSettings[setting] = Math.min(Math.max(Math.round(Number(target.value) / 5) * 5, 15), 240);
            }
        }

        function init() {
            if (initialized || !dom.dialog) {
                return;
            }
            initialized = true;
            dom.dialog.addEventListener('click', handleClick);
            dom.dialog.addEventListener('change', handleChange);
            dom.dialog.addEventListener('input', handleChange);
            dom.dialog.addEventListener('cancel', event => {
                event.preventDefault();
                handleSecondaryAction();
            });
        }

        return {
            init,
            load: reload,
            reload,
            reset,
            save,
            getState,
            shouldOffer: () => shouldOfferExperience(state),
            maybeOpen,
            open,
            openManual: () => open({ source: 'manual' }),
            openAfterReset: () => {
                reset();
                return open({ source: 'reset' });
            },
            close,
            defer,
            complete,
            isOpen,
            getCurrentStep: () => step,
            getDraft: () => ({ settings: normalizeSettings(draftSettings), dailyGoal: draftDailyGoal })
        };
    }

    global.TasklyzenExperience = {
        constants: {
            schemaVersion: SCHEMA_VERSION,
            profileVersion: PROFILE_VERSION,
            walkthroughVersion: WALKTHROUGH_VERSION,
            stepCount: STEP_COUNT
        },
        normalizeExperienceState,
        shouldOfferExperience,
        createExperienceController
    };
})(window);
