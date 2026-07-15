/*
 * Modulo: componentes UI vanilla
 * Proposito:
 * - Crear piezas DOM reutilizables sin framework ni JSX.
 * Entradas:
 * - documentRef, datos simples y opciones visuales.
 * Salidas:
 * - window.TasklyzenUiComponents con funciones puras de UI.
 * Dependencias:
 * - Ninguna; cada funcion recibe documentRef o usa window.document.
 */
(function exposeTasklyzenUiComponents(global) {
    function getDocumentRef(documentRef) {
        const ref = documentRef || global.document;

        if (!ref || typeof ref.createElement !== 'function') {
            throw new Error('TasklyzenUiComponents necesita document para crear componentes.');
        }

        return ref;
    }

    function classNames(values) {
        return (Array.isArray(values) ? values : [values]).filter(Boolean).join(' ');
    }

    function setDataset(element, dataset) {
        Object.entries(dataset || {}).forEach(([name, value]) => {
            if (value !== undefined && value !== null) {
                element.dataset[name] = String(value);
            }
        });
    }

    function setAttributes(element, attributes) {
        Object.entries(attributes || {}).forEach(([name, value]) => {
            if (value !== undefined && value !== null && value !== false) {
                element.setAttribute(name, String(value));
            }
        });
    }

    function createElement(tagName, options) {
        const config = options || {};
        const element = getDocumentRef(config.documentRef).createElement(tagName);

        if (config.className) {
            element.className = classNames(config.className);
        }

        if (config.text !== undefined && config.text !== null) {
            element.textContent = String(config.text);
        }

        setDataset(element, config.dataset);
        setAttributes(element, config.attributes);

        if (config.title) {
            element.title = config.title;
        }

        return element;
    }

    function createButton(options) {
        const button = createElement('button', options);

        button.type = (options && options.type) || 'button';

        if (options && Object.prototype.hasOwnProperty.call(options, 'disabled')) {
            button.disabled = Boolean(options.disabled);
        }

        return button;
    }

    function createBadge(options) {
        return createElement('span', options);
    }

    function appendSelectOptions(selectElement, options) {
        const documentRef = getDocumentRef(options && options.documentRef);

        (options && Array.isArray(options.items) ? options.items : []).forEach(item => {
            const option = documentRef.createElement('option');

            option.value = String(item.value);
            option.textContent = String(item.label);
            option.selected = Boolean(item.selected);
            selectElement.appendChild(option);
        });
    }

    function createEmptyState(options) {
        const config = options || {};
        const hasStructuredContent = config.kicker || config.title || config.detail || config.action;
        const item = createElement(config.tagName || 'li', {
            documentRef: config.documentRef,
            className: config.className || 'empty-state',
            text: hasStructuredContent ? '' : config.message || ''
        });

        if (!hasStructuredContent) {
            return item;
        }

        if (config.kicker) {
            item.appendChild(createElement('span', {
                documentRef: config.documentRef,
                className: config.kickerClassName || 'section-kicker',
                text: config.kicker
            }));
        }

        if (config.title) {
            item.appendChild(createElement(config.titleTagName || 'strong', {
                documentRef: config.documentRef,
                text: config.title
            }));
        }

        if (config.detail || config.message) {
            item.appendChild(createElement('p', {
                documentRef: config.documentRef,
                text: config.detail || config.message
            }));
        }

        if (config.action) {
            item.appendChild(config.action);
        }

        return item;
    }

    function createTaskListItem(options) {
        const config = options || {};
        const todo = config.todo || {};
        const item = createElement('li', {
            documentRef: config.documentRef,
            className: [
                'todo-item',
                todo.completed ? 'completed' : '',
                todo.type === 'composite' ? 'is-composite-task' : '',
                todo.priority ? 'priority-' + todo.priority : '',
                config.urgencyLevel ? 'urgency-' + config.urgencyLevel : '',
                config.focused ? 'focus-task' : '',
                config.secondary ? 'secondary-task' : '',
                config.expanded ? 'expanded' : '',
                config.actionsOpen ? 'actions-open' : '',
                config.editing ? 'is-editing' : ''
            ]
        });

        if (todo.id) {
            item.dataset.id = todo.id;
        }

        if (config.focused) {
            item.setAttribute('aria-current', 'true');
        }

        item.setAttribute('aria-expanded', Boolean(config.expanded).toString());

        return item;
    }

    function createTaskDisplayContent(options) {
        const config = options || {};
        const todo = config.todo || {};
        const documentRef = getDocumentRef(config.documentRef);
        const content = createElement('div', { documentRef, className: 'todo-content task-compact-row' });
        const details = createElement('div', { documentRef, className: 'todo-details' });
        const metaBadges = createElement('div', { documentRef, className: 'todo-meta' });
        const text = createButton({
            documentRef,
            className: 'todo-text todo-title-button',
            text: todo.text || '',
            dataset: { action: 'expand' },
            attributes: {
                'aria-expanded': Boolean(config.expanded).toString(),
                'aria-label': config.expanded ? 'Ocultar detalles de tarea' : 'Mostrar detalles de tarea'
            }
        });
        const quickActions = createElement('div', { documentRef, className: 'task-quick-actions' });
        const actionsOpen = Boolean(config.actionsOpen);
        const checkButton = createButton({
            documentRef,
            className: [
                'task-check-button',
                todo.completed ? 'checked' : ''
            ],
            text: todo.completed ? '\u2713' : '',
            dataset: { action: config.composite ? 'composite-info' : 'toggle' },
            attributes: {
                'aria-label': config.compositeStatusLabel || (todo.completed ? 'Reactivar tarea' : 'Completar tarea'),
                'aria-pressed': Boolean(todo.completed).toString()
            }
        });

        if (config.composite) {
            checkButton.classList.add('composite-indicator');
            checkButton.dataset.compositeStatus = config.compositeStatus || 'in-progress';
        }
        const expandButton = createButton({
            documentRef,
            className: 'task-details-toggle',
            text: '',
            dataset: { action: 'expand' },
            attributes: {
                'aria-expanded': Boolean(config.expanded).toString(),
                'aria-label': config.expanded ? 'Ocultar detalles de tarea' : 'Mostrar detalles de tarea'
            }
        });
        const menuButton = createButton({
            documentRef,
            className: 'task-more-button',
            text: '',
            dataset: { action: 'menu' },
            attributes: {
                'aria-haspopup': 'menu',
                'aria-expanded': actionsOpen.toString(),
                'aria-label': actionsOpen ? 'Cerrar acciones de tarea' : 'Abrir acciones de tarea'
            }
        });
        const actionMenu = createElement('div', {
            documentRef,
            className: 'task-action-menu',
            attributes: {
                role: 'menu',
                'aria-label': 'Acciones de tarea'
            }
        });

        (Array.isArray(config.badges) ? config.badges : []).forEach(badge => {
            metaBadges.appendChild(createBadge({
                documentRef,
                className: badge.className,
                text: badge.text,
                title: badge.title
            }));
        });

        actionMenu.append(
            createButton({
                documentRef,
                className: 'task-menu-action edit-button',
                text: 'Editar',
                dataset: { action: 'edit' },
                attributes: {
                    role: 'menuitem',
                    'aria-label': 'Editar tarea'
                }
            }),
            createButton({
                documentRef,
                className: 'task-menu-action delete-button',
                text: 'Eliminar',
                dataset: { action: 'delete' },
                attributes: {
                    role: 'menuitem',
                    'aria-label': 'Eliminar tarea'
                }
            })
        );
        quickActions.append(menuButton, actionMenu);

        content.appendChild(checkButton);
        content.appendChild(text);

        if (config.progressLabel) {
            content.appendChild(createBadge({
                documentRef,
                className: 'composite-progress-badge',
                text: config.progressLabel
            }));
        }

        if (config.essentialBadge) {
            content.appendChild(createBadge({
                documentRef,
                className: classNames(['task-essential-badge', config.essentialBadge.className]),
                text: config.essentialBadge.text,
                title: config.essentialBadge.title
            }));
        }

        content.appendChild(quickActions);
        content.appendChild(expandButton);
        details.append(metaBadges);

        if (config.compositeDetails) {
            details.append(config.compositeDetails);
        }

        return { content, details };
    }

    function createSubtaskList(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const section = createElement('section', { documentRef, className: 'composite-details' });
        const heading = createElement('div', { documentRef, className: 'composite-details-heading' });
        const title = createElement('strong', { documentRef, text: config.progressLabel || 'Subtareas' });
        const list = createElement('ol', { documentRef, className: 'subtask-list' });
        const editingSubtaskId = config.editingSubtaskId || '';
        const confirmation = config.confirmation || null;

        heading.append(
            title,
            createButton({
                documentRef,
                className: 'subtask-add-trigger',
                text: 'Añadir subtarea',
                dataset: { action: 'add-subtask-form' },
                attributes: { 'aria-expanded': Boolean(config.adding).toString() }
            })
        );

        (Array.isArray(config.subtasks) ? config.subtasks : []).forEach((subtask, index, source) => {
            const isEditing = editingSubtaskId === subtask.id;
            const item = createElement('li', {
                documentRef,
                className: ['subtask-item', subtask.completed ? 'completed' : '', subtask.optional ? 'optional' : '', isEditing ? 'is-editing' : ''],
                dataset: { subtaskId: subtask.id },
                attributes: {
                    tabindex: '0',
                    'aria-label': (subtask.optional ? 'Subtarea opcional: ' : 'Subtarea obligatoria: ') + subtask.title
                }
            });
            const check = createButton({
                documentRef,
                className: ['subtask-check', subtask.completed ? 'checked' : ''],
                text: subtask.completed ? '\u2713' : '',
                dataset: { action: 'toggle-subtask', subtaskId: subtask.id },
                attributes: {
                    'aria-label': (subtask.completed ? 'Reactivar subtarea: ' : 'Completar subtarea: ') + subtask.title,
                    'aria-pressed': Boolean(subtask.completed).toString()
                }
            });
            const label = isEditing
                ? createElement('input', {
                    documentRef,
                    className: 'subtask-edit-input',
                    attributes: {
                        value: subtask.title,
                        'aria-label': 'Editar título de subtarea'
                    }
                })
                : createElement('span', { documentRef, className: 'subtask-title', text: subtask.title });
            const meta = createElement('div', { documentRef, className: 'subtask-meta' });
            const actions = createElement('div', { documentRef, className: 'subtask-actions' });

            if (isEditing) {
                const optionalLabel = createElement('label', { documentRef, className: 'subtask-edit-optional' });
                const optionalInput = createElement('input', { documentRef, attributes: { type: 'checkbox' } });
                optionalInput.type = 'checkbox';
                optionalInput.checked = Boolean(subtask.optional);
                optionalLabel.append(optionalInput, createElement('span', { documentRef, text: 'Opcional' }));
                meta.appendChild(optionalLabel);
                actions.append(
                    createButton({ documentRef, className: 'subtask-action save', text: '', title: 'Guardar cambios', dataset: { action: 'save-subtask-edit', subtaskId: subtask.id }, attributes: { 'aria-label': 'Guardar cambios de subtarea' } }),
                    createButton({ documentRef, className: 'subtask-action cancel', text: '', title: 'Cancelar edición', dataset: { action: 'cancel-subtask-edit' }, attributes: { 'aria-label': 'Cancelar edición de subtarea' } })
                );
            } else {
                if (subtask.optional) meta.appendChild(createBadge({ documentRef, className: 'subtask-optional-badge', text: 'Opcional' }));
                actions.append(
                    createButton({ documentRef, className: 'subtask-action edit', text: '', title: 'Editar', dataset: { action: 'edit-subtask', subtaskId: subtask.id }, attributes: { 'aria-label': 'Editar subtarea: ' + subtask.title } }),
                    createButton({ documentRef, className: 'subtask-action move-up', text: '', title: 'Subir', disabled: index === 0, dataset: { action: 'move-subtask-up', subtaskId: subtask.id }, attributes: { 'aria-label': 'Subir subtarea: ' + subtask.title } }),
                    createButton({ documentRef, className: 'subtask-action move-down', text: '', title: 'Bajar', disabled: index === source.length - 1, dataset: { action: 'move-subtask-down', subtaskId: subtask.id }, attributes: { 'aria-label': 'Bajar subtarea: ' + subtask.title } }),
                    createButton({ documentRef, className: 'subtask-action danger delete', text: '', title: 'Eliminar', dataset: { action: 'delete-subtask', subtaskId: subtask.id }, attributes: { 'aria-label': 'Eliminar subtarea: ' + subtask.title } })
                );
            }
            item.append(check, label, meta, actions);
            list.appendChild(item);
        });

        const form = createElement('div', { documentRef, className: 'inline-subtask-form' });
        form.hidden = !config.adding;
        const inlineInput = createElement('input', { documentRef, className: 'inline-subtask-input', attributes: { placeholder: 'Nueva subtarea', 'aria-label': 'Título de nueva subtarea' } });
        const optionalLabel = createElement('label', { documentRef, className: 'subtask-optional-toggle' });
        form.append(inlineInput, optionalLabel);
        const optionalInput = createElement('input', { documentRef, className: 'inline-subtask-optional', attributes: { type: 'checkbox' } });
        optionalInput.type = 'checkbox';
        optionalLabel.append(optionalInput, createElement('span', { documentRef, text: 'Opcional' }));
        form.append(
            createButton({ documentRef, className: 'subtask-inline-save', text: 'Añadir', dataset: { action: 'save-subtask' } }),
            createButton({ documentRef, className: 'subtask-inline-cancel', text: 'Cancelar', dataset: { action: 'cancel-subtask-form' } })
        );
        section.append(heading, list, form);

        if (confirmation) {
            const confirmationCard = createElement('aside', {
                documentRef,
                className: 'composite-confirmation',
                attributes: { role: 'status', 'aria-live': 'polite' }
            });
            confirmationCard.append(
                createElement('strong', { documentRef, text: confirmation.title || 'Confirma este cambio' }),
                createElement('p', { documentRef, text: confirmation.message || '' }),
                createButton({ documentRef, className: 'composite-confirm-cancel', text: 'Cancelar', dataset: { action: 'cancel-composite-confirmation' } }),
                createButton({ documentRef, className: 'composite-confirm-approve', text: confirmation.confirmLabel || 'Confirmar', dataset: { action: 'approve-composite-confirmation' } })
            );
            section.appendChild(confirmationCard);
        }

        return section;
    }

    function createCompositeDraftItem(options) {
        const config = options || {};
        const subtask = config.subtask || {};
        const documentRef = getDocumentRef(config.documentRef);
        const item = createElement('li', {
            documentRef,
            className: 'composite-builder-item',
            dataset: { draftId: subtask.id },
            attributes: { tabindex: '0' }
        });
        const actions = createElement('div', { documentRef, className: 'subtask-actions composite-builder-actions' });

        actions.append(
            createButton({ documentRef, className: 'subtask-action move-up builder-order-button', text: '', title: 'Subir', disabled: config.first, dataset: { builderAction: 'up', draftId: subtask.id }, attributes: { 'aria-label': 'Subir ' + subtask.title } }),
            createButton({ documentRef, className: 'subtask-action move-down builder-order-button', text: '', title: 'Bajar', disabled: config.last, dataset: { builderAction: 'down', draftId: subtask.id }, attributes: { 'aria-label': 'Bajar ' + subtask.title } }),
            createButton({ documentRef, className: 'subtask-action danger delete builder-remove-button', text: '', title: 'Eliminar', dataset: { builderAction: 'remove', draftId: subtask.id }, attributes: { 'aria-label': 'Eliminar ' + subtask.title } })
        );

        item.append(
            createElement('span', { documentRef, className: 'composite-builder-item-title', text: subtask.title }),
            subtask.optional ? createBadge({ documentRef, className: 'subtask-optional-badge', text: 'Opcional' }) : createElement('span', { documentRef, className: 'subtask-required-label', text: 'Obligatoria' }),
            actions
        );
        return item;
    }

    function createCompositeDraftDiscardPrompt(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const card = createElement('aside', {
            documentRef,
            className: 'composite-builder-confirmation',
            attributes: { role: 'status', 'aria-live': 'polite' }
        });
        const copy = createElement('div', { documentRef, className: 'composite-builder-confirmation-copy' });

        copy.append(
            createElement('strong', { documentRef, text: 'Cambiar a tarea simple' }),
            createElement('p', { documentRef, text: 'Se descartarán las subtareas que escribiste para dejar solo la tarea principal.' })
        );
        card.append(
            copy,
            createButton({
                documentRef,
                className: 'composite-builder-keep-button',
                text: 'Seguir como hito',
                dataset: { builderAction: 'cancel-discard-drafts' }
            }),
            createButton({
                documentRef,
                className: 'composite-builder-discard-button',
                text: 'Descartar subtareas',
                dataset: { builderAction: 'discard-drafts' }
            })
        );

        return card;
    }

    function createTaskEditContent(options) {
        const config = options || {};
        const todo = config.todo || {};
        const documentRef = getDocumentRef(config.documentRef);
        const editFields = createElement('div', { documentRef, className: 'edit-fields' });
        const editOptions = createElement('div', { documentRef, className: 'edit-options' });
        const content = createElement('div', { documentRef, className: 'task-edit-content' });
        const actions = createElement('div', { documentRef, className: 'todo-actions task-edit-actions' });
        const editInput = createElement('input', {
            documentRef,
            className: 'edit-input',
            dataset: { editInput: todo.id },
            attributes: { 'aria-label': 'Editar texto de la tarea' }
        });
        const editPriority = createElement('select', {
            documentRef,
            className: 'edit-priority-input',
            dataset: { editPriority: todo.id },
            attributes: { 'aria-label': 'Editar prioridad de la tarea' }
        });
        const editTimeLimit = createElement('input', {
            documentRef,
            className: 'edit-time-limit-input',
            dataset: { editTimeLimit: todo.id },
            attributes: { type: 'date', 'aria-label': 'Editar fecha límite opcional de la tarea; déjalo vacío si no tiene vencimiento', title: 'Déjalo vacío si la tarea no tiene vencimiento' }
        });

        editInput.value = todo.text || '';
        editTimeLimit.type = 'date';
        editTimeLimit.value = todo.dueDate || '';
        appendSelectOptions(editPriority, {
            documentRef,
            items: config.priorityOptions
        });
        actions.append(
            createButton({
                documentRef,
                className: 'task-button save-button',
                text: 'Guardar',
                dataset: { action: 'save' }
            }),
            createButton({
                documentRef,
                className: 'task-button cancel-button',
                text: 'Cancelar',
                dataset: { action: 'cancel' }
            })
        );
        editFields.append(editInput);
        editOptions.append(editPriority, editTimeLimit);
        content.append(editFields, editOptions, actions);

        return {
            content,
            editInput
        };
    }

    function createExpiredTaskItem(options) {
        const config = options || {};
        const record = config.record || {};
        const item = createElement('li', {
            documentRef: config.documentRef,
            className: [
                'expired-task-item',
                'priority-' + (record.priority || 'normal'),
                record.active ? 'active-expired' : ''
            ]
        });
        const title = createElement('strong', {
            documentRef: config.documentRef,
            text: record.text || record.taskText || config.fallbackTitle || 'Tarea vencida'
        });
        const meta = createElement('span', {
            documentRef: config.documentRef,
            text: record.detail || config.meta || ''
        });

        item.append(title, meta);

        return item;
    }

    function createOverdueReviewItem(options) {
        const config = options || {};
        const task = config.task || {};
        const days = Math.max(Math.round(Number(config.overdueDays) || 0), 0);
        const priorityLabels = {
            normal: 'Normal',
            important: 'Importante',
            urgent: 'Urgente'
        };
        const item = createElement('li', {
            documentRef: config.documentRef,
            className: ['overdue-review-item', 'priority-' + (task.priority || 'normal')]
        });
        const copy = createElement('div', {
            documentRef: config.documentRef,
            className: 'overdue-review-item-copy'
        });
        const title = createElement('strong', {
            documentRef: config.documentRef,
            text: task.text || 'Tarea vencida'
        });
        const metaParts = [
            config.dueDate ? 'Venci\u00f3 el ' + config.dueDate : '',
            days === 1 ? '1 d\u00eda vencida' : days + ' d\u00edas vencida',
            priorityLabels[task.priority] || priorityLabels.normal,
            task.type === 'composite' ? 'Hito' : ''
        ].filter(Boolean);
        const meta = createElement('span', {
            documentRef: config.documentRef,
            text: metaParts.join(' \u00b7 ')
        });
        const marker = createElement('span', {
            documentRef: config.documentRef,
            className: 'overdue-review-priority-marker',
            attributes: {
                'aria-hidden': 'true'
            }
        });

        copy.append(title, meta);
        item.append(marker, copy);

        return item;
    }

    function createSummaryMetric(options) {
        const config = options || {};
        const item = createElement('article', {
            documentRef: config.documentRef,
            className: ['summary-metric', config.className]
        });

        item.append(
            createElement('strong', { documentRef: config.documentRef, text: config.value }),
            createElement('span', { documentRef: config.documentRef, text: config.label }),
            createElement('small', { documentRef: config.documentRef, text: config.detail })
        );

        return item;
    }

    function createAnalyticsMetric(options) {
        const config = options || {};

        return createSummaryMetric({
            documentRef: config.documentRef,
            value: config.value,
            label: config.label,
            detail: config.detail,
            className: config.className
        });
    }

    function createMonthlyMetricCard(options) {
        const config = options || {};
        const item = createElement('article', {
            documentRef: config.documentRef,
            className: ['monthly-metric-card', config.className]
        });

        item.append(
            createElement('strong', { documentRef: config.documentRef, text: config.value }),
            createElement('span', { documentRef: config.documentRef, text: config.label }),
            createElement('p', { documentRef: config.documentRef, text: config.detail })
        );

        return item;
    }

    function createMonthlyRecapStat(options) {
        const config = options || {};
        const item = createElement('span', {
            documentRef: config.documentRef,
            className: config.className
        });

        item.append(
            createElement('strong', { documentRef: config.documentRef, text: config.value }),
            createElement('em', { documentRef: config.documentRef, text: config.label })
        );

        return item;
    }

    function createPerformanceSummary(options) {
        const config = options || {};
        const focus = config.focus || {};
        const item = createElement(config.tagName || 'p', {
            documentRef: config.documentRef,
            className: [
                'monthly-performance-summary',
                config.compact ? 'compact' : '',
                focus.tone ? 'tone-' + focus.tone : ''
            ]
        });

        item.append(
            createElement('strong', { documentRef: config.documentRef, text: focus.title || '' }),
            createElement('span', { documentRef: config.documentRef, text: focus.message || '' }),
            createElement('em', { documentRef: config.documentRef, text: focus.action || '' })
        );

        return item;
    }

    function renderPerformanceSummary(element, options) {
        if (!element) {
            return;
        }

        const summary = createPerformanceSummary({
            ...(options || {}),
            documentRef: options && options.documentRef,
            tagName: element.tagName ? element.tagName.toLowerCase() : 'p'
        });

        element.innerHTML = '';
        element.className = summary.className;
        Array.from(summary.children || []).forEach(child => element.appendChild(child));
    }

    function createMonthlyCompletionDonut(options) {
        const config = options || {};
        const analytics = config.monthAnalytics || {};
        const container = createElement('div', {
            documentRef: config.documentRef,
            className: [
                'monthly-comparison-bars',
                'monthly-donut-chart',
                config.compact ? 'compact' : ''
            ],
            attributes: { 'aria-label': 'Grafico circular de finalizacion mensual' }
        });
        const donut = createElement('div', {
            documentRef: config.documentRef,
            className: 'monthly-donut'
        });
        const completedPercent = Math.max(Math.round(Number(analytics.completedPercent) || 0), 0);
        const completedActivities = Math.max(Math.round(Number(analytics.completedActivities) || 0), 0);
        const totalActivities = Math.max(Math.round(Number(analytics.totalActivities) || 0), 0);

        donut.style.setProperty('--percent', completedPercent + '%');
        donut.append(
            createElement('strong', { documentRef: config.documentRef, text: completedPercent + '%' }),
            createElement('span', { documentRef: config.documentRef, text: 'Completado' })
        );
        container.append(
            donut,
            createElement('p', {
                documentRef: config.documentRef,
                text: completedActivities + ' de ' + totalActivities + ' actividades'
            })
        );

        return container;
    }

    function renderMonthlyCompletionDonut(container, options) {
        if (!container) {
            return;
        }

        const donut = createMonthlyCompletionDonut(options || {});

        container.innerHTML = '';
        container.className = donut.className;
        container.setAttribute('aria-label', 'Grafico circular de finalizacion mensual');
        Array.from(donut.children || []).forEach(child => container.appendChild(child));
    }

    function createWeeklyFlowChart(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const flow = config.flow || {};
        const entries = Array.isArray(config.entries) ? config.entries : [];
        const points = Array.isArray(config.points) ? config.points : [];
        const axisLabels = Array.isArray(config.axisLabels) ? config.axisLabels : [];
        const width = Number(config.width) || 360;
        const height = Number(config.height) || 120;
        const chart = createElement('div', {
            documentRef,
            className: 'weekly-flow-chart weekly-line-chart'
        });
        const svg = documentRef.createElementNS(svgNamespace, 'svg');
        const goalLine = documentRef.createElementNS(svgNamespace, 'line');
        const line = documentRef.createElementNS(svgNamespace, 'polyline');
        const polylinePoints = points.map(point => point.x + ',' + point.y).join(' ');

        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', config.ariaLabel || 'Linea de tareas completadas');
        goalLine.setAttribute('x1', String(config.leftPadding || 20));
        goalLine.setAttribute('x2', String(width - (config.rightPadding || 20)));
        goalLine.setAttribute('y1', String(config.goalY || 0));
        goalLine.setAttribute('y2', String(config.goalY || 0));
        goalLine.setAttribute('class', 'goal-line');
        line.setAttribute('points', polylinePoints);
        line.setAttribute('class', 'weekly-line');
        line.setAttribute('fill', 'none');
        svg.append(goalLine, line);

        points.forEach(point => {
            const circle = documentRef.createElementNS(svgNamespace, 'circle');
            const title = documentRef.createElementNS(svgNamespace, 'title');
            const completed = Number(point.entry && point.entry.completed) || 0;

            circle.setAttribute('cx', String(point.x));
            circle.setAttribute('cy', String(point.y));
            circle.setAttribute('r', String(point.radius || 3.4));
            circle.setAttribute('class', point.goalHit ? 'day-dot goal-hit' : 'day-dot');
            title.textContent = (point.entry && point.entry.dateKey ? point.entry.dateKey : '') + ': ' + completed + ' completada' + (completed === 1 ? '' : 's');
            circle.appendChild(title);
            svg.appendChild(circle);
        });

        axisLabels.forEach(axis => {
            const label = documentRef.createElementNS(svgNamespace, 'text');

            label.setAttribute('x', String(axis.x));
            label.setAttribute('y', String(axis.y));
            label.setAttribute('class', 'weekly-axis-label');
            label.textContent = axis.label || '';
            svg.appendChild(label);
        });

        chart.append(
            svg,
            createElement('p', {
                documentRef,
                className: 'weekly-line-caption',
                text: flow.completed + ' completada' + (flow.completed === 1 ? '' : 's') + ' ' + (flow.captionSuffix || '')
            })
        );

        if (entries.length === 0) {
            chart.dataset.empty = 'true';
        }

        return chart;
    }

    function createFocusFlowChart(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const entries = Array.isArray(config.entries) ? config.entries : [];
        const maximumMinutes = Math.max(
            Number(config.goalMinutes) || 1,
            ...entries.map(entry => Number(entry.minutes) || 0)
        );
        const chart = createElement('div', {
            documentRef,
            className: 'focus-flow-chart',
            attributes: {
                role: 'img',
                'aria-label': config.ariaLabel || 'Minutos de enfoque confirmados por día'
            }
        });

        entries.forEach(entry => {
            const minutes = Math.max(Math.round(Number(entry.minutes) || 0), 0);
            const item = createElement('span', {
                documentRef,
                className: entry.goalHit ? 'focus-flow-day goal-hit' : 'focus-flow-day',
                attributes: {
                    title: (entry.label || entry.dateKey || '') + ': ' + minutes + ' min'
                }
            });
            const bar = createElement('i', {
                documentRef,
                className: 'focus-flow-bar',
                attributes: { 'aria-hidden': 'true' }
            });

            bar.style.setProperty('--focus-bar-height', Math.max((minutes / maximumMinutes) * 100, minutes ? 8 : 3) + '%');
            item.append(
                bar,
                createElement('small', { documentRef, text: entry.label || '' })
            );
            chart.appendChild(item);
        });

        if (!entries.some(entry => Number(entry.minutes) > 0)) {
            chart.dataset.empty = 'true';
        }

        return chart;
    }

    function createPrestigeStep(options) {
        const config = options || {};
        const level = config.level || {};
        const reached = Boolean(config.reached);
        const visualState = config.state || '';
        const quality = Math.min(Math.max(Math.round(Number(config.quality) || 1), 1), 6);
        const unlockText = 'En ' + level.min + ' d\u00edas';
        const step = createElement('span', {
            documentRef: config.documentRef,
            className: [
                'prestige-step',
                level.className,
                reached ? 'reached' : 'locked',
                visualState ? 'is-' + visualState : ''
            ],
            title: reached
                ? (level.rewardTitle || '') + ': ' + (level.rewardMessage || '')
                : 'Completa tareas para desbloquear esta racha.',
            attributes: {
                'aria-label': reached
                    ? level.min + ' d\u00edas, ' + (level.label || '')
                    : unlockText
            }
        });

        if (visualState) {
            const symbol = reached
                ? createElement('span', {
                    documentRef: config.documentRef,
                    className: 'prestige-mini-emblem quality-' + quality,
                    attributes: { 'aria-hidden': 'true' }
                })
                : createElement('span', {
                    documentRef: config.documentRef,
                    className: 'prestige-lock-icon',
                    attributes: { 'aria-hidden': 'true' }
                });
            const copy = createElement('span', {
                documentRef: config.documentRef,
                className: 'prestige-step-copy'
            });

            if (reached) {
                symbol.append(
                    createElement('i', { documentRef: config.documentRef, className: 'prestige-mini-emblem-core' }),
                    createElement('i', { documentRef: config.documentRef, className: 'prestige-mini-emblem-ring' })
                );
                copy.append(
                    createElement('strong', { documentRef: config.documentRef, text: level.min }),
                    createElement('em', { documentRef: config.documentRef, text: level.label || '' })
                );

                if (visualState === 'current') {
                    copy.append(createElement('b', { documentRef: config.documentRef, className: 'prestige-current-label', text: 'Actual' }));
                }
            } else {
                copy.append(createElement('em', { documentRef: config.documentRef, text: unlockText }));
            }

            step.append(symbol, copy);
            return step;
        }

        step.append(
            reached
                ? createElement('strong', { documentRef: config.documentRef, text: level.min })
                : createElement('span', {
                    documentRef: config.documentRef,
                    className: 'prestige-lock-icon',
                    attributes: { 'aria-hidden': 'true' }
                }),
            createElement('em', { documentRef: config.documentRef, text: reached ? level.label || '' : unlockText })
        );

        return step;
    }

    function createPrestigeChapter(options) {
        const config = options || {};
        const chapter = createElement('section', {
            documentRef: config.documentRef,
            className: 'prestige-chapter',
            attributes: { 'aria-label': config.title || 'Etapa de racha' }
        });
        const heading = createElement('header', {
            documentRef: config.documentRef,
            className: 'prestige-chapter-heading'
        });
        const grid = createElement('div', {
            documentRef: config.documentRef,
            className: 'prestige-chapter-grid'
        });

        heading.append(
            createElement('h4', { documentRef: config.documentRef, text: config.title || '' }),
            createElement('small', { documentRef: config.documentRef, text: config.range || '' })
        );
        (Array.isArray(config.steps) ? config.steps : []).forEach(step => grid.appendChild(step));
        chapter.append(heading, grid);

        return chapter;
    }

    function createContributionDay(options) {
        const config = options || {};
        const count = Math.max(Math.round(Number(config.count) || 0), 0);
        const taskText = config.taskText || (count === 1 ? '1 tarea completada' : count + ' tareas completadas');
        const item = createElement('span', {
            documentRef: config.documentRef,
            className: config.isShieldedDate ? 'contribution-day shielded-day' : 'contribution-day level-' + (config.level || 0),
            dataset: {
                date: config.dateKey,
                count
            },
            title: config.isShieldedDate
                ? config.dateKey + ': racha protegida con escudo'
                : config.isFutureDate
                    ? config.dateKey + ': sin datos aún'
                    : config.dateKey + ': ' + taskText,
            attributes: {
                role: 'listitem',
                'aria-label': config.isShieldedDate
                    ? config.dateKey + ', racha protegida con escudo'
                    : config.isFutureDate
                        ? config.dateKey + ', sin datos aún'
                        : config.dateKey + ', ' + taskText
            }
        });

        if (config.isToday) {
            item.classList.add('today');
        }

        if (config.isFutureDate) {
            item.classList.add('future-day');
        }

        return item;
    }

    function renderToast(toastElement, options) {
        const config = options || {};

        if (!toastElement) {
            return;
        }

        toastElement.textContent = config.message || '';
        toastElement.className = config.type ? 'toast show ' + config.type : 'toast show';
    }

    global.TasklyzenUiComponents = {
        classNames,
        createElement,
        createButton,
        createBadge,
        appendSelectOptions,
        createEmptyState,
        createTaskListItem,
        createTaskDisplayContent,
        createTaskEditContent,
        createSubtaskList,
        createCompositeDraftItem,
        createCompositeDraftDiscardPrompt,
        createExpiredTaskItem,
        createOverdueReviewItem,
        createSummaryMetric,
        createAnalyticsMetric,
        createMonthlyMetricCard,
        createMonthlyRecapStat,
        createPerformanceSummary,
        renderPerformanceSummary,
        createMonthlyCompletionDonut,
        renderMonthlyCompletionDonut,
        createWeeklyFlowChart,
        createFocusFlowChart,
        createPrestigeStep,
        createPrestigeChapter,
        createContributionDay,
        renderToast
    };
})(window);
