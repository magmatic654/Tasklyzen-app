/*
 * Modulo: UIController
 * Proposito: operaciones DOM pequenas y consistentes para componentes.
 * Entradas: elementos HTML, texto, clases y estados visuales.
 * Salidas: DOM actualizado.
 * Dependencias: document opcional.
 */
const runtimeGlobal = typeof window !== 'undefined' ? window : globalThis;

export class UIController {
    #documentRef;
    #dom;

    constructor({
        documentRef = runtimeGlobal.document,
        dom = runtimeGlobal.TasklyzenDom
    } = {}) {
        this.#documentRef = documentRef || null;
        this.#dom = dom || {};
    }

    get dom() {
        return this.#dom;
    }

    createElement(tagName, { className = '', text = '', attributes = {} } = {}) {
        if (!this.#documentRef) {
            throw new Error('UIController necesita document para crear elementos.');
        }

        const element = this.#documentRef.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (text !== '') {
            element.textContent = text;
        }

        Object.entries(attributes).forEach(([name, value]) => {
            element.setAttribute(name, value);
        });

        return element;
    }

    clear(element) {
        if (this.#isElement(element)) {
            element.innerHTML = '';
        }
    }

    setText(element, value) {
        if (this.#isElement(element)) {
            element.textContent = String(value);
        }
    }

    setHidden(element, hidden) {
        if (this.#isElement(element)) {
            element.hidden = Boolean(hidden);
        }
    }

    toggleClass(element, className, enabled) {
        if (this.#isElement(element) && className) {
            element.classList.toggle(className, Boolean(enabled));
        }
    }

    setButtonDisabled(button, disabled) {
        if (this.#isElement(button)) {
            button.disabled = Boolean(disabled);
        }
    }

    #isElement(element) {
        return Boolean(element && typeof element === 'object');
    }
}
