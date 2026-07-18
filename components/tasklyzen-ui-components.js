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
        const taskCopy = createElement('div', { documentRef, className: 'task-copy' });
        const compactMeta = createElement('div', { documentRef, className: 'task-compact-meta' });
        const controls = createElement('div', { documentRef, className: 'task-card-controls' });
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

        (Array.isArray(config.compactMeta) ? config.compactMeta : []).forEach(meta => {
            if (!meta || !meta.text) {
                return;
            }

            compactMeta.appendChild(createElement('span', {
                documentRef,
                className: meta.className || '',
                text: meta.text
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

        taskCopy.appendChild(text);

        if (compactMeta.childElementCount > 0) {
            taskCopy.appendChild(compactMeta);
        }

        if (config.compositeProgress && config.compositeProgress.label) {
            const progress = config.compositeProgress;
            const total = Math.max(Number(progress.total) || 0, 1);
            const completed = Math.min(Math.max(Number(progress.completed) || 0, 0), total);
            const indicator = createElement('div', {
                documentRef,
                className: 'task-composite-progress',
                attributes: {
                    role: 'progressbar',
                    'aria-label': progress.ariaLabel || progress.label,
                    'aria-valuemin': '0',
                    'aria-valuemax': String(total),
                    'aria-valuenow': String(completed)
                }
            });
            const track = createElement('i', { documentRef, className: 'task-composite-progress-track' });
            const fill = createElement('b', { documentRef, className: 'task-composite-progress-fill' });

            fill.style.width = Math.round((completed / total) * 100) + '%';
            track.appendChild(fill);
            indicator.append(
                createElement('span', { documentRef, text: progress.label }),
                track
            );
            taskCopy.appendChild(indicator);
        }

        controls.append(quickActions, expandButton);
        content.append(checkButton, taskCopy, controls);
        details.append(metaBadges);

        if (config.compositeDetails) {
            details.append(config.compositeDetails);
        }

        return { content, details };
    }

    function createSubtaskList(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const section = createElement('section', {
            documentRef,
            className: config.composite ? 'composite-details' : 'composite-details simple-task-subtask-action'
        });
        const heading = createElement('div', { documentRef, className: 'composite-details-heading' });
        const title = createElement('strong', { documentRef, text: config.progressLabel || 'Subtareas' });
        const list = createElement('ol', { documentRef, className: 'subtask-list' });
        const editingSubtaskId = config.editingSubtaskId || '';
        const confirmation = config.confirmation || null;

        const addSubtaskButton = createButton({
            documentRef,
            className: 'subtask-add-trigger',
            text: 'Añadir subtarea',
            dataset: { action: 'add-subtask-form' },
            attributes: {
                'aria-expanded': Boolean(config.adding).toString(),
                'aria-label': config.composite ? 'Añadir subtarea' : 'Añadir subtarea y convertir en hito'
            }
        });

        if (config.composite) {
            heading.appendChild(title);
        }

        if (!config.adding) {
            heading.appendChild(addSubtaskButton);
        }

        (Array.isArray(config.subtasks) ? config.subtasks : []).forEach((subtask, index, source) => {
            const isEditing = editingSubtaskId === subtask.id;
            const previousSubtask = source[index - 1];
            const nextSubtask = source[index + 1];
            const canMoveUp = Boolean(previousSubtask) && Boolean(previousSubtask.completed) === Boolean(subtask.completed);
            const canMoveDown = Boolean(nextSubtask) && Boolean(nextSubtask.completed) === Boolean(subtask.completed);
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
                        maxlength: config.titleMaxLength || 96,
                        'aria-label': 'Editar título de subtarea, máximo ' + (config.titleMaxLength || 96) + ' caracteres'
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
                    createButton({ documentRef, className: 'subtask-action move-up', text: '', title: 'Subir', disabled: !canMoveUp, dataset: { action: 'move-subtask-up', subtaskId: subtask.id }, attributes: { 'aria-label': 'Subir subtarea: ' + subtask.title } }),
                    createButton({ documentRef, className: 'subtask-action move-down', text: '', title: 'Bajar', disabled: !canMoveDown, dataset: { action: 'move-subtask-down', subtaskId: subtask.id }, attributes: { 'aria-label': 'Bajar subtarea: ' + subtask.title } }),
                    createButton({ documentRef, className: 'subtask-action danger delete', text: '', title: 'Eliminar', dataset: { action: 'delete-subtask', subtaskId: subtask.id }, attributes: { 'aria-label': 'Eliminar subtarea: ' + subtask.title } })
                );
            }
            item.append(check, label, meta, actions);
            list.appendChild(item);
        });

        const form = createElement('div', { documentRef, className: 'inline-subtask-form' });
        form.hidden = !config.adding;
        const inlineInput = createElement('input', {
            documentRef,
            className: 'inline-subtask-input',
            attributes: {
                placeholder: 'Nueva subtarea',
                maxlength: config.titleMaxLength || 96,
                'aria-label': 'Título de nueva subtarea, máximo ' + (config.titleMaxLength || 96) + ' caracteres'
            }
        });
        const optionalLabel = createElement('label', { documentRef, className: 'subtask-optional-toggle' });
        form.append(inlineInput, optionalLabel);
        const optionalInput = createElement('input', { documentRef, className: 'inline-subtask-optional', attributes: { type: 'checkbox' } });
        optionalInput.type = 'checkbox';
        optionalLabel.append(optionalInput, createElement('span', { documentRef, text: 'Opcional' }));
        form.append(
            createButton({ documentRef, className: 'subtask-inline-save', text: 'Añadir', dataset: { action: 'save-subtask' } }),
            createButton({ documentRef, className: 'subtask-inline-cancel', text: 'Cancelar', dataset: { action: 'cancel-subtask-form' } })
        );
        if (config.composite || !config.adding) {
            section.appendChild(heading);
        }

        if (config.composite || config.adding) {
            section.append(list, form);
        }

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
            attributes: {
                maxlength: config.titleMaxLength || 96,
                'aria-label': 'Editar texto de la tarea, máximo ' + (config.titleMaxLength || 96) + ' caracteres'
            }
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

    function createWeeklyFlowChart(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const flow = config.flow || {};
        const entries = Array.isArray(config.entries) ? config.entries : [];
        const points = Array.isArray(config.points) ? config.points : [];
        const axisLabels = Array.isArray(config.axisLabels) ? config.axisLabels : [];
        const formatValue = typeof config.formatValue === 'function'
            ? config.formatValue
            : value => value + ' completada' + (value === 1 ? '' : 's');
        const width = Number(config.width) || 360;
        const height = Number(config.height) || 120;
        const chart = createElement('div', {
            documentRef,
            className: 'weekly-flow-chart weekly-line-chart'
        });
        const svg = documentRef.createElementNS(svgNamespace, 'svg');
        const goalLine = documentRef.createElementNS(svgNamespace, 'line');
        const baseline = height - (config.bottomPadding || 20);
        const barWidth = Number(config.barWidth) || 22;

        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', config.ariaLabel || 'Linea de tareas completadas');
        goalLine.setAttribute('x1', String(config.leftPadding || 20));
        goalLine.setAttribute('x2', String(width - (config.rightPadding || 20)));
        goalLine.setAttribute('y1', String(config.goalY || 0));
        goalLine.setAttribute('y2', String(config.goalY || 0));
        goalLine.setAttribute('class', 'goal-line');
        if (config.showGoalLine !== false) {
            svg.appendChild(goalLine);
        }

        points.forEach(point => {
            const bar = documentRef.createElementNS(svgNamespace, 'rect');
            const title = documentRef.createElementNS(svgNamespace, 'title');
            const completed = Number(point.entry && point.entry.completed) || 0;
            const barHeight = Math.max(Number(point.barHeight) || 0, completed > 0 ? 5 : 3);

            bar.setAttribute('x', String(point.x - (barWidth / 2)));
            bar.setAttribute('y', String(baseline - barHeight));
            bar.setAttribute('width', String(barWidth));
            bar.setAttribute('height', String(barHeight));
            bar.setAttribute('rx', String(Math.min(barWidth / 2, 7)));
            bar.setAttribute('class', point.goalHit ? 'weekly-bar goal-hit' : 'weekly-bar');
            title.textContent = (point.entry && point.entry.dateKey ? point.entry.dateKey : '') + ': ' + formatValue(completed);
            bar.appendChild(title);
            svg.appendChild(bar);
        });

        axisLabels.forEach(axis => {
            const label = documentRef.createElementNS(svgNamespace, 'text');

            label.setAttribute('x', String(axis.x));
            label.setAttribute('y', String(axis.y));
            label.setAttribute('class', 'weekly-axis-label');
            label.textContent = axis.label || '';
            svg.appendChild(label);
        });

        chart.appendChild(svg);

        if (config.insight && config.insight.title) {
            const insight = createElement('aside', {
                documentRef,
                className: 'weekly-chart-insight'
            });

            insight.append(
                createElement('strong', { documentRef, text: config.insight.title }),
                createElement('span', { documentRef, text: config.insight.message || '' })
            );
            chart.appendChild(insight);
        }

        chart.appendChild(createElement('p', {
            documentRef,
            className: 'weekly-line-caption',
            text: config.caption || (flow.completed + ' completada' + (flow.completed === 1 ? '' : 's') + ' ' + (flow.captionSuffix || ''))
        }));

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

    /*
     * Proposito: comparar una o dos señales por fecha sin duplicar gráficos.
     * Entradas: entries ya calculadas y series con valueKey, goalKey y formatValue.
     * Salida: gráfico de barras agrupadas, navegable con clic, foco y teclado.
     */
    function createPerformanceBarChart(options) {
        const config = options || {};
        const documentRef = getDocumentRef(config.documentRef);
        const entries = Array.isArray(config.entries) ? config.entries : [];
        const series = (Array.isArray(config.series) ? config.series : []).filter(item => item && item.valueKey);
        const chart = createElement('section', {
            documentRef,
            className: classNames(['performance-bar-chart', config.className]),
            attributes: {
                role: 'region',
                'aria-label': config.ariaLabel || 'Rendimiento del periodo'
            }
        });
        const groups = [];
        const clusters = [];
        const legendButtons = new Map();
        const seriesSlots = new Map();
        const visibleSeriesKeys = new Set(series.map(item => item.key || item.valueKey));
        let selectedEntryIndex = Math.max(entries.length - 1, 0);
        const maxima = new Map(series.map(item => [
            item.key || item.valueKey,
            Math.max(1, ...entries.map(entry => Math.max(Number(entry[item.valueKey]) || 0, Number(entry[item.goalKey]) || 0)))
        ]));
        const legend = createElement('div', {
            documentRef,
            className: 'performance-bar-legend',
            attributes: { role: 'group', 'aria-label': 'Indicadores del gráfico' }
        });
        const stage = createElement('div', { documentRef, className: 'performance-bar-stage' });
        const axis = createElement('div', {
            documentRef,
            className: 'performance-bar-axis',
            attributes: { 'aria-hidden': 'true' }
        });
        const plot = createElement('div', { documentRef, className: 'performance-bar-plot' });
        const selection = createElement('div', {
            documentRef,
            className: 'performance-bar-selection',
            attributes: { 'aria-live': 'polite' }
        });
        const selectionTitle = createElement('strong', { documentRef });
        const selectionValue = createElement('span', { documentRef, className: 'performance-bar-selection-values' });
        const selectionMessage = createElement('small', { documentRef });

        chart.style.setProperty('--performance-bar-columns', String(Math.max(entries.length, 1)));
        chart.dataset.columns = String(entries.length);
        chart.dataset.scale = 'goal';
        plot.style.gridTemplateColumns = 'repeat(' + Math.max(entries.length, 1) + ', minmax(0, 1fr))';

        ['100%', '50%', '0'].forEach(label => {
            axis.appendChild(createElement('span', { documentRef, text: label }));
        });

        series.forEach(item => {
            const key = item.key || item.valueKey;
            const legendItem = createButton({
                documentRef,
                className: classNames(['performance-bar-legend-item', 'tone-' + (item.tone || 'tasks'), 'is-active']),
                attributes: {
                    'aria-pressed': 'true',
                    'data-performance-series': key
                },
                title: 'Mostrar u ocultar ' + (item.label || 'indicador')
            });

            legendItem.append(
                createElement('i', { documentRef, attributes: { 'aria-hidden': 'true' } }),
                createElement('b', { documentRef, text: item.label || '' })
            );
            if (typeof legendItem.addEventListener === 'function') {
                legendItem.addEventListener('click', () => {
                    if (visibleSeriesKeys.has(key)) {
                        visibleSeriesKeys.delete(key);
                    } else {
                        visibleSeriesKeys.add(key);
                    }

                    updateSeriesVisibility();
                });
            }
            legendButtons.set(key, legendItem);
            seriesSlots.set(key, []);
            legend.appendChild(legendItem);
        });

        function formatSeriesValue(item, value) {
            return typeof item.formatValue === 'function'
                ? item.formatValue(value)
                : String(value);
        }

        function getEntryLabel(entry) {
            return entry.detailTitle || entry.label || entry.dateKey || 'Periodo seleccionado';
        }

        function getEntryValues(entry) {
            return series
                .filter(item => visibleSeriesKeys.has(item.key || item.valueKey))
                .map(item => formatSeriesValue(item, Math.max(Number(entry[item.valueKey]) || 0, 0)));
        }

        function selectEntry(index) {
            const entry = entries[index];

            if (!entry) {
                return;
            }

            selectedEntryIndex = index;
            groups.forEach((group, groupIndex) => {
                const isSelected = groupIndex === index;

                group.classList.toggle('is-selected', isSelected);
                group.setAttribute('aria-pressed', isSelected.toString());
            });
            selectionTitle.textContent = getEntryLabel(entry);
            const values = getEntryValues(entry);
            selectionValue.textContent = values.length ? values.join(' · ') : 'Sin indicadores activos';
            selectionMessage.textContent = values.length
                ? entry.summary || config.emptySelectionMessage || 'Sin actividad registrada en este punto del periodo.'
                : 'Activa Tareas o Enfoque para volver a comparar esta fecha.';
        }

        function updateSeriesVisibility() {
            const visibleCount = visibleSeriesKeys.size;

            chart.dataset.visibleSeries = String(visibleCount);
            chart.dataset.seriesEmpty = visibleCount === 0 ? 'true' : 'false';
            legendButtons.forEach((button, key) => {
                const isActive = visibleSeriesKeys.has(key);

                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive.toString());
            });
            seriesSlots.forEach((slots, key) => {
                const isHidden = !visibleSeriesKeys.has(key);

                slots.forEach(slot => slot.classList.toggle('is-series-hidden', isHidden));
            });
            clusters.forEach(cluster => {
                cluster.dataset.visibleSeries = String(visibleCount);
            });
            groups.forEach((group, index) => {
                const entry = entries[index];
                const values = entry ? getEntryValues(entry) : [];

                group.setAttribute('aria-label', getEntryLabel(entry || {}) + ': ' + (values.length ? values.join(', ') : 'sin indicadores activos'));
            });
            if (entries.length) {
                selectEntry(selectedEntryIndex);
            }
        }

        entries.forEach((entry, index) => {
            const group = createButton({
                documentRef,
                className: 'performance-bar-group',
                attributes: {
                    'aria-pressed': 'false',
                    'aria-label': getEntryLabel(entry) + ': ' + getEntryValues(entry).join(', ')
                },
                title: 'Ver detalle de ' + getEntryLabel(entry)
            });
            const cluster = createElement('span', { documentRef, className: 'performance-bar-cluster', attributes: { 'aria-hidden': 'true' } });

            series.forEach(item => {
                const value = Math.max(Number(entry[item.valueKey]) || 0, 0);
                const goal = Math.max(Number(entry[item.goalKey]) || 0, 0);
                const maximum = maxima.get(item.key || item.valueKey) || 1;
                const goalProgress = goal > 0 ? (value / goal) * 100 : (value / maximum) * 100;
                const barHeight = value > 0 ? Math.max(Math.min(goalProgress, 100), 3) : 0;
                const goalHit = value >= goal && goal > 0;
                const slot = createElement('span', {
                    documentRef,
                    className: classNames([
                        'performance-bar-slot',
                        'tone-' + (item.tone || 'tasks'),
                        goalHit ? 'goal-hit' : '',
                        value === 0 ? 'is-empty' : ''
                    ])
                });
                const bar = createElement('i', { documentRef, className: 'performance-bar' });

                bar.style.setProperty('--performance-bar-height', barHeight + '%');
                slot.appendChild(bar);
                seriesSlots.get(item.key || item.valueKey).push(slot);
                cluster.appendChild(slot);
            });

            group.append(
                cluster,
                createElement('small', { documentRef, className: 'performance-bar-label', text: entry.label || '' })
            );
            if (typeof group.addEventListener === 'function') {
                group.addEventListener('click', () => selectEntry(index));
                group.addEventListener('focus', () => selectEntry(index));
            }
            groups.push(group);
            clusters.push(cluster);
            plot.appendChild(group);
        });

        selection.append(selectionTitle, selectionValue, selectionMessage);
        stage.append(axis, plot);
        chart.append(legend, stage, selection);

        const initialIndex = entries.reduce((bestIndex, entry, index) => {
            const score = series.reduce((total, item) => total + Math.max(Number(entry[item.valueKey]) || 0, 0), 0);
            const bestEntry = entries[bestIndex] || {};
            const bestScore = series.reduce((total, item) => total + Math.max(Number(bestEntry[item.valueKey]) || 0, 0), 0);

            return score >= bestScore ? index : bestIndex;
        }, Math.max(entries.length - 1, 0));

        if (entries.length) {
            selectEntry(initialIndex);
        } else {
            chart.dataset.empty = 'true';
        }

        if (!entries.some(entry => series.some(item => (Number(entry[item.valueKey]) || 0) > 0))) {
            chart.dataset.empty = 'true';
        }

        updateSeriesVisibility();

        return chart;
    }

    function createBalancedFlowChart(options) {
        const config = options || {};

        return createPerformanceBarChart({
            ...config,
            className: classNames(['balanced-flow-chart', config.className]),
            series: [
                {
                    key: 'tasks',
                    label: 'Tareas',
                    valueKey: 'taskValue',
                    goalKey: 'taskGoal',
                    tone: 'tasks',
                    formatValue: value => value + ' tarea' + (value === 1 ? '' : 's')
                },
                {
                    key: 'focus',
                    label: 'Enfoque',
                    valueKey: 'focusValue',
                    goalKey: 'focusGoal',
                    tone: 'focus',
                    formatValue: value => value + ' min'
                }
            ]
        });
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
        createWeeklyFlowChart,
        createFocusFlowChart,
        createPerformanceBarChart,
        createBalancedFlowChart,
        createPrestigeStep,
        createPrestigeChapter,
        createContributionDay,
        renderToast
    };
})(window);
