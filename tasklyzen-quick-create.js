/*
 * Modulo: creacion rapida por teclado
 * Proposito:
 * - Capturar tareas en escritorio al escribir fuera de controles activos.
 * Entradas:
 * - DOM de capa ligera, document y callbacks del runtime.
 * Salidas:
 * - window.TasklyzenQuickCreate con createQuickCreateController.
 * Dependencias:
 * - Ninguna directa; el runtime inyecta creacion y bloqueos.
 */
(function exposeTasklyzenQuickCreate(global) {
    const BLOCKED_SELECTOR = [
        'input',
        'textarea',
        'select',
        'button',
        'a',
        'dialog',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '.settings-panel',
        '.delete-data-dialog',
        '.task-toolbar',
        '.task-action-menu',
        '.todo-item.is-editing',
        '.developer-panel'
    ].join(',');

    function createQuickCreateController(options) {
        const config = options || {};
        const dom = config.dom || {};
        const documentRef = config.documentRef || global.document;
        const desktopQuery = config.desktopQuery || '(min-width: 681px)';
        const onCreate = typeof config.onCreate === 'function' ? config.onCreate : () => false;
        const isTaskEditing = typeof config.isTaskEditing === 'function' ? config.isTaskEditing : () => false;
        const hasExternalBlocker = typeof config.hasExternalBlocker === 'function' ? config.hasExternalBlocker : () => false;
        let draft = '';
        let active = false;

        function isDesktop() {
            if (typeof global.matchMedia !== 'function') {
                return true;
            }

            return global.matchMedia(desktopQuery).matches;
        }

        function isPrintableKey(event) {
            return Boolean(event && event.key && event.key.length === 1 && !/^\s$/.test(event.key));
        }

        function closest(target, selector) {
            return target && typeof target.closest === 'function' ? target.closest(selector) : null;
        }

        function isBlockedTarget(target) {
            return Boolean(closest(target, BLOCKED_SELECTOR));
        }

        function hasOpenDialog() {
            if (documentRef && typeof documentRef.querySelector === 'function' && documentRef.querySelector('dialog[open]')) {
                return true;
            }

            return Boolean(dom.deleteDataDialog && dom.deleteDataDialog.open);
        }

        function hasOpenTaskMenu() {
            return Boolean(documentRef && typeof documentRef.querySelector === 'function' && documentRef.querySelector('.todo-item.actions-open'));
        }

        function isSettingsOpen() {
            return Boolean(dom.settingsPanel && dom.settingsPanel.hidden === false);
        }

        function canUseQuickCreate(event) {
            const activeElement = documentRef ? documentRef.activeElement : null;

            return isDesktop()
                && !hasOpenDialog()
                && !hasOpenTaskMenu()
                && !isSettingsOpen()
                && !isTaskEditing()
                && !hasExternalBlocker()
                && !isBlockedTarget(event && event.target)
                && !isBlockedTarget(activeElement);
        }

        function render() {
            if (dom.quickCreateLayer) {
                dom.quickCreateLayer.hidden = !active;
                dom.quickCreateLayer.classList.toggle('is-active', active);
                dom.quickCreateLayer.classList.toggle('is-empty', draft.trim().length === 0);
            }

            if (dom.quickCreateTitle) {
                dom.quickCreateTitle.textContent = draft || 'Nueva tarea';
            }

            if (dom.quickCreateStatus) {
                dom.quickCreateStatus.textContent = draft.trim()
                    ? 'Enter guarda · Esc cancela'
                    : 'Escribe el título para guardar';
            }
        }

        function open(initialText) {
            draft = String(initialText || '');
            active = true;
            render();
        }

        function close() {
            draft = '';
            active = false;
            render();
        }

        function appendCharacter(character) {
            draft += character;
            render();
        }

        function removeLastCharacter() {
            draft = draft.slice(0, -1);
            render();
        }

        function submit() {
            const title = draft.trim();

            if (!title) {
                render();
                return false;
            }

            if (onCreate(title) !== false) {
                close();
                return true;
            }

            render();
            return false;
        }

        function handleInactiveKeydown(event) {
            if (!isPrintableKey(event) || event.ctrlKey || event.metaKey || event.altKey || !canUseQuickCreate(event)) {
                return;
            }

            event.preventDefault();
            open(event.key);
        }

        function handleActiveKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
                return;
            }

            if (event.key === 'Backspace') {
                event.preventDefault();
                removeLastCharacter();
                return;
            }

            if (event.key === ' ') {
                event.preventDefault();
                appendCharacter(' ');
                return;
            }

            if (isPrintableKey(event) && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                appendCharacter(event.key);
            }
        }

        function handleKeydown(event) {
            if (active) {
                if (event.key !== 'Escape' && !canUseQuickCreate(event)) {
                    close();
                    return;
                }

                handleActiveKeydown(event);
                return;
            }

            handleInactiveKeydown(event);
        }

        function init() {
            if (!documentRef || typeof documentRef.addEventListener !== 'function') {
                return;
            }

            documentRef.addEventListener('keydown', handleKeydown);
            render();
        }

        function destroy() {
            if (documentRef && typeof documentRef.removeEventListener === 'function') {
                documentRef.removeEventListener('keydown', handleKeydown);
            }

            close();
        }

        return {
            init,
            destroy,
            open,
            close,
            submit,
            isActive: () => active,
            getDraft: () => draft,
            canUseQuickCreate
        };
    }

    global.TasklyzenQuickCreate = {
        createQuickCreateController
    };
})(window);
