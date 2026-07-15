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
    const WALKTHROUGH_VERSION = 1;
    const STEP_COUNT = 4;
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
                    kicker: 'Una nueva etapa',
                    title: 'Tasklyzen ha cambiado contigo',
                    message: 'Revisa el nuevo flujo y ajusta la experiencia a tu forma actual de estudiar.',
                    secondary: 'Ahora no'
                };
            }

            if (source === 'manual') {
                return {
                    kicker: 'Tu experiencia',
                    title: 'Ajusta Tasklyzen a tu ritmo',
                    message: 'Puedes revisar el recorrido sin perder tus preferencias actuales.',
                    secondary: 'Cerrar'
                };
            }

            if (source === 'reset') {
                return {
                    kicker: 'Empezar de nuevo',
                    title: 'Prepara tu nueva experiencia',
                    message: 'Tus datos se eliminaron. Puedes configurar Tasklyzen otra vez o usar los valores iniciales.',
                    secondary: 'Usar valores iniciales'
                };
            }

            return {
                kicker: 'Tu primer recorrido',
                title: 'Conoce tu centro de estudio',
                message: 'Cuatro pasos breves bastan para dejar Tasklyzen listo para ti.',
                secondary: 'Usar valores iniciales'
            };
        }

        function renderOverview() {
            const copy = getSourceCopy();

            return [
                '<div class="experience-intro">',
                '<p>' + copy.message + '</p>',
                '<div class="experience-flow" aria-label="Flujo principal de Tasklyzen">',
                '<div><span class="experience-flow-icon is-task" aria-hidden="true"></span><strong>Organiza</strong><small>Crea tareas simples o hitos.</small></div>',
                '<div><span class="experience-flow-icon is-race" aria-hidden="true"></span><strong>Concéntrate</strong><small>Usa Modo Carrera cuando necesites un bloque de trabajo.</small></div>',
                '<div><span class="experience-flow-icon is-progress" aria-hidden="true"></span><strong>Comprende</strong><small>Consulta tu avance sin perder de vista las tareas.</small></div>',
                '</div>',
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
                renderSwitch('sound', 'Sonidos de apoyo', 'Avisos de Carrera y cierre de tareas.', draftSettings.sound),
                renderSwitch('animations', 'Movimiento amable', 'Microanimaciones breves al interactuar.', draftSettings.animations),
                '</div>'
            ].join('');
        }

        function renderProgress() {
            const mode = draftSettings.progressMode || 'tasks';
            const taskGoalVisible = mode !== 'focus';
            const focusGoalVisible = mode !== 'tasks';

            return [
                '<fieldset class="experience-fieldset">',
                '<legend>¿Qué debe representar un buen día?</legend>',
                '<div class="experience-mode-list">',
                renderChoice('experience-progress-mode', 'tasks', 'Avances', 'Da prioridad a tareas y subtareas terminadas.', mode === 'tasks'),
                renderChoice('experience-progress-mode', 'focus', 'Enfoque', 'Da prioridad al tiempo de trabajo confirmado.', mode === 'focus'),
                renderChoice('experience-progress-mode', 'balanced', 'Equilibrado', 'Combina resultados y tiempo dedicado.', mode === 'balanced'),
                '</div>',
                '</fieldset>',
                '<div class="experience-goals">',
                taskGoalVisible ? renderNumberField('dailyGoal', 'Tareas por día', draftDailyGoal, 1, 20, 1) : '',
                focusGoalVisible ? renderNumberField('dailyFocusGoalMinutes', 'Minutos de enfoque', draftSettings.dailyFocusGoalMinutes, 15, 240, 5) : '',
                '</div>'
            ].join('');
        }

        function renderRace() {
            const modeLabel = draftSettings.progressMode === 'focus'
                ? 'Enfoque'
                : draftSettings.progressMode === 'balanced' ? 'Equilibrado' : 'Avances';
            const goalLabel = draftSettings.progressMode === 'focus'
                ? draftSettings.dailyFocusGoalMinutes + ' min'
                : draftSettings.progressMode === 'balanced'
                    ? draftDailyGoal + ' tareas + ' + draftSettings.dailyFocusGoalMinutes + ' min'
                    : draftDailyGoal + ' tareas';

            return [
                '<div class="experience-race-note">',
                '<span class="experience-race-mark" aria-hidden="true"></span>',
                '<div><strong>Modo Carrera es opcional</strong><p>Úsalo para trabajar una selección de tareas con ritmo libre, contra reloj o Pomodoro.</p></div>',
                '</div>',
                '<div class="experience-switch-list">',
                renderSwitch('backgroundTimer', 'Continuar en segundo plano', 'El reloj sigue mientras trabajas en otras ventanas.', draftSettings.backgroundTimer),
                renderSwitch('notifications', 'Recordatorios', 'Podrás conceder permiso desde Ajustes cuando lo necesites.', draftSettings.notifications),
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
                { kicker: sourceCopy.kicker, title: sourceCopy.title, render: renderOverview },
                { kicker: 'Paso 2 de 4', title: 'Hazla cómoda para ti', render: renderComfort },
                { kicker: 'Paso 3 de 4', title: 'Define tu forma de avanzar', render: renderProgress },
                { kicker: 'Paso 4 de 4', title: 'Todo listo para tu próxima Carrera', render: renderRace }
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
                renderStep(false);
                return;
            }

            if (target.name === 'experience-progress-mode') {
                draftSettings.progressMode = target.value;
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
