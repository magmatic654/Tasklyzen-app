/*
 * Modulo: interfaz de tareas
 * Proposito:
 * - Renderizar lista, filtros, contadores, foco principal y tareas vencidas.
 * Entradas:
 * - DOM de tareas, predicados de TaskState/TasklyzenTasks y callbacks del runtime.
 * Salidas:
 * - window.TasklyzenTaskUi con createTaskUiController.
 * Dependencias:
 * - TasklyzenUiComponents por inyeccion o global; el resto llega por callbacks.
 */
(function exposeTasklyzenTaskUi(global) {
    const FILTERS = ['all', 'pending', 'completed'];
    const PRIORITIES = [
        { value: 'normal', label: 'Normal' },
        { value: 'important', label: 'Importante' },
        { value: 'urgent', label: 'Urgente' }
    ];

    function createTaskUiController(options) {
        const config = options || {};
        const dom = config.dom || {};
        const documentRef = config.documentRef || global.document;
        const ui = config.uiController || createFallbackUi();
        const components = config.components || global.TasklyzenUiComponents;
        const compositeTasks = config.compositeTasks || global.TasklyzenCompositeTasks;
        const taskTitleMaxLength = Math.max(Math.round(Number(config.taskTitleMaxLength) || 96), 1);
        const getTodos = typeof config.getTodos === 'function' ? config.getTodos : () => [];
        const getDailyGoal = typeof config.getDailyGoal === 'function' ? config.getDailyGoal : () => 1;
        const getTodayKey = typeof config.getTodayKey === 'function' ? config.getTodayKey : () => '';
        const getHistoryCount = typeof config.getHistoryCount === 'function' ? config.getHistoryCount : () => 0;
        const getTopPriorityTodo = typeof config.getTopPriorityTodo === 'function' ? config.getTopPriorityTodo : () => null;
        const getDateLabel = typeof config.getDateLabel === 'function' ? config.getDateLabel : dateKey => dateKey || '';
        const getStartOfDay = typeof config.getStartOfDay === 'function' ? config.getStartOfDay : value => value;
        const formatDateKey = typeof config.formatDateKey === 'function' ? config.formatDateKey : value => value;
        const getTaskDueDate = typeof config.getTaskDueDate === 'function' ? config.getTaskDueDate : todo => todo && todo.dueDate ? todo.dueDate : null;
        const getTodoDeadlineInfo = typeof config.getTodoDeadlineInfo === 'function' ? config.getTodoDeadlineInfo : () => ({ hasDeadline: false, dueDate: null, deadlineAt: null, limitDays: null });
        const getTodoUrgencyState = typeof config.getTodoUrgencyState === 'function' ? config.getTodoUrgencyState : () => null;
        const isTodoSnoozedForToday = typeof config.isTodoSnoozedForToday === 'function' ? config.isTodoSnoozedForToday : () => false;
        const isTodoDeadlineLate = typeof config.isTodoDeadlineLate === 'function' ? config.isTodoDeadlineLate : () => false;
        const isTodoAvailableToday = typeof config.isTodoAvailableToday === 'function' ? config.isTodoAvailableToday : todo => Boolean(todo && !todo.completed);
        const isCompletedTodoCleanable = typeof config.isCompletedTodoCleanable === 'function' ? config.isCompletedTodoCleanable : todo => Boolean(todo && todo.completed);
        const onToggleTodo = typeof config.onToggleTodo === 'function' ? config.onToggleTodo : () => {};
        const onEditTodo = typeof config.onEditTodo === 'function' ? config.onEditTodo : () => {};
        const onSaveEdit = typeof config.onSaveEdit === 'function' ? config.onSaveEdit : () => {};
        const onCancelEdit = typeof config.onCancelEdit === 'function' ? config.onCancelEdit : () => {};
        const onDeleteTodo = typeof config.onDeleteTodo === 'function' ? config.onDeleteTodo : () => {};
        const onClearCompleted = typeof config.onClearCompleted === 'function' ? config.onClearCompleted : () => {};
        const onCompositeInfo = typeof config.onCompositeInfo === 'function' ? config.onCompositeInfo : () => {};
        const onAddSubtask = typeof config.onAddSubtask === 'function' ? config.onAddSubtask : () => {};
        const onToggleSubtask = typeof config.onToggleSubtask === 'function' ? config.onToggleSubtask : () => {};
        const onSaveSubtaskEdit = typeof config.onSaveSubtaskEdit === 'function' ? config.onSaveSubtaskEdit : () => {};
        const onRequestSubtaskDelete = typeof config.onRequestSubtaskDelete === 'function' ? config.onRequestSubtaskDelete : () => null;
        const onDeleteSubtask = typeof config.onDeleteSubtask === 'function' ? config.onDeleteSubtask : () => {};
        const onMoveSubtask = typeof config.onMoveSubtask === 'function' ? config.onMoveSubtask : () => {};
        const onConvertToNormal = typeof config.onConvertToNormal === 'function' ? config.onConvertToNormal : () => {};
        const showCriticalError = typeof config.showCriticalError === 'function' ? config.showCriticalError : () => {};
        const scheduleRefresh = typeof config.scheduleRefresh === 'function' ? config.scheduleRefresh : () => {};
        let activeFilter = normalizeFilter(config.initialFilter || 'pending');
        let editingTodoId = null;
        let nextActionTodoId = null;
        let actionMenuTodoId = null;
        const expandedTodoIds = new Set();
        const addingSubtaskTodoIds = new Set();
        let editingSubtask = null;
        let compositeConfirmation = null;

        function normalizeFilter(filter) {
            return FILTERS.includes(filter) ? filter : 'pending';
        }

        function getPriorityLabel(priority) {
            const match = PRIORITIES.find(item => item.value === priority);

            return match ? match.label : 'Normal';
        }

        function getStats() {
            const todos = getTodos();
            const completed = todos.filter(todo => todo.completed).length;
            const pending = todos.length - completed;
            const available = todos.filter(isTodoAvailableToday).length;
            const completedToday = todos.filter(isTodoCompletedToday).length;
            const snoozed = todos.filter(isTodoSnoozedForToday).length;
            const late = todos.filter(isTodoDeadlineLate).length;
            const habits = todos.filter(todo => todo.habit && !todo.completed).length;

            return {
                completed,
                completedToday,
                pending,
                available,
                snoozed,
                late,
                habits,
                total: todos.length
            };
        }

        function getDateKeyFromValue(value) {
            const text = typeof value === 'string' ? value : '';

            return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
        }

        function getTodoCompletedDateKey(todo) {
            if (!todo || !todo.completed) {
                return '';
            }

            return getDateKeyFromValue(todo.completedOn) || getDateKeyFromValue(todo.completedAt);
        }

        function isTodoCompletedToday(todo) {
            return Boolean(todo && todo.completed && getTodoCompletedDateKey(todo) === getTodayKey());
        }

        function isTodoPending(todo) {
            return Boolean(todo && !todo.completed);
        }

        function getVisibleTodos() {
            const todos = getTodos();

            if (activeFilter === 'pending') {
                return todos.filter(isTodoPending);
            }

            if (activeFilter === 'completed') {
                return todos.filter(todo => todo.completed);
            }

            return todos;
        }

        function getEmptyStateMessage() {
            if (activeFilter === 'pending') {
                return 'No hay tareas pendientes. Crea una nueva para mantener el ritmo.';
            }

            if (activeFilter === 'completed') {
                return 'Aún no hay tareas completadas en esta vista.';
            }

            return 'Aún no hay tareas. Agrega la primera.';
        }

        function updateTaskCount() {
            if (!dom.taskCount) {
                return;
            }

            const availableTasks = getTodos().filter(isTodoAvailableToday).length;
            dom.taskCount.textContent = availableTasks === 1 ? '1 para hoy' : availableTasks + ' para hoy';
        }

        function updateTaskSummary() {
            if (!dom.taskSummary) {
                return;
            }

            const stats = getStats();
            const taskWord = stats.total === 1 ? 'tarea' : 'tareas';
            const pendingWord = stats.pending === 1 ? 'pendiente' : 'pendientes';
            const completedWord = stats.completed === 1 ? 'completada' : 'completadas';

            if (activeFilter === 'pending') {
                const lateText = stats.late
                    ? ' - ' + stats.late + (stats.late === 1 ? ' vencida' : ' vencidas')
                    : '';
                dom.taskSummary.textContent = stats.pending + ' ' + pendingWord + lateText;
                return;
            }

            if (activeFilter === 'completed') {
                dom.taskSummary.textContent = stats.completed + ' ' + completedWord;
                return;
            }

            dom.taskSummary.textContent = stats.total + ' ' + taskWord + ': ' + stats.pending + ' ' + pendingWord + ', ' + stats.completed + ' ' + completedWord;
        }

        function updateFilterButtons() {
            const filterButtons = dom.taskFilterButtons && dom.taskFilterButtons.length
                ? dom.taskFilterButtons
                : dom.taskToolbar ? dom.taskToolbar.querySelectorAll('.filter-button') : [];

            if (!filterButtons.length) {
                return;
            }

            filterButtons.forEach(button => {
                const isActive = button.dataset.filter === activeFilter;

                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', isActive.toString());
            });
        }

        function getExpiredTaskRecords(limit) {
            const maxItems = Math.max(Math.round(Number(limit) || 6), 1);

            return getTodos()
                .filter(isTodoDeadlineLate)
                .sort((first, second) => {
                    const firstDeadline = getTodoDeadlineInfo(first);
                    const secondDeadline = getTodoDeadlineInfo(second);

                    return (firstDeadline.deadlineAt || new Date()).getTime() - (secondDeadline.deadlineAt || new Date()).getTime();
                })
                .map(todo => {
                    const deadline = getTodoDeadlineInfo(todo);
                    const deadlineKey = deadline.dueDate || (deadline.deadlineAt ? formatDateKey(getStartOfDay(deadline.deadlineAt)) : '');

                    return {
                        todoId: todo.id,
                        text: todo.text,
                        priority: todo.priority,
                        dateKey: deadlineKey,
                        statusLabel: 'Vencida',
                        detail: 'Venció el ' + getDateLabel(deadlineKey, { day: 'numeric', month: 'short' }),
                        active: true
                    };
                })
                .slice(0, maxItems);
        }

        function renderExpiredTasksPanel() {
            if (!dom.expiredTasksPanel || !dom.expiredTaskCount || !dom.expiredTaskSummary || !dom.expiredTaskList) {
                return;
            }

            const expiredRecords = getExpiredTaskRecords(6);

            ui.clear(dom.expiredTaskList);
            ui.setText(dom.expiredTaskCount, expiredRecords.length);
            ui.toggleClass(dom.expiredTasksPanel, 'empty', expiredRecords.length === 0);
            ui.setHidden(dom.expiredTasksPanel, expiredRecords.length === 0);

            if (expiredRecords.length === 0) {
                dom.expiredTaskSummary.textContent = 'Sin tareas vencidas por ahora. Tu lista está respirando bien.';
                return;
            }

            dom.expiredTaskSummary.textContent = 'Estas tareas superaron su fecha límite. Ciérralas, edítalas o elimínalas para limpiar el foco.';
            expiredRecords.forEach(record => {
                dom.expiredTaskList.appendChild(components.createExpiredTaskItem({
                    documentRef,
                    record,
                    meta: record.detail || (getDateLabel(record.dateKey, { day: 'numeric', month: 'short' }) + ' · ' + getPriorityLabel(record.priority || 'normal'))
                }));
            });
        }

        function updateTaskMaintenanceControls() {
            if (!dom.clearCompletedTasksButton) {
                return;
            }

            const cleanableCount = getTodos().filter(isCompletedTodoCleanable).length;

            ui.setButtonDisabled(dom.clearCompletedTasksButton, cleanableCount === 0);
            ui.setText(dom.clearCompletedTasksButton, cleanableCount > 0 ? 'Limpiar hechas' : 'Sin hechas listas');
        }

        function getNextActionReason(todo) {
            if (!todo) {
                return 'Cuando tengas pendientes, aquí aparecerá la tarea más conveniente para avanzar.';
            }

            if (todo.priority === 'urgent') {
                return 'Es urgente y está disponible hoy. Completarla baja fricción y empuja tu racha.';
            }

            if (todo.priority === 'important') {
                return 'Es importante: buen avance sin esperar a que se vuelva urgente.';
            }

            if (todo.habit) {
                return 'Es un hábito diario. Mantenerlo pequeño ayuda a sostener el ritmo.';
            }

            return 'Es una tarea clara para sumar progreso sin saturarte.';
        }

        function renderNextAction() {
            if (!dom.nextActionCard || !dom.nextActionTitle || !dom.nextActionReason) {
                return;
            }

            const todo = getTopPriorityTodo();
            const urgencyState = todo ? getTodoUrgencyState(todo) : null;
            nextActionTodoId = todo ? todo.id : null;
            dom.nextActionCard.className = [
                'next-action-card',
                !todo ? 'empty' : '',
                todo ? 'priority-' + todo.priority : '',
                urgencyState ? 'urgency-' + urgencyState.level : ''
            ].filter(Boolean).join(' ');

            if (!todo) {
                dom.nextActionTitle.textContent = 'No hay tareas listas para hoy';
                dom.nextActionReason.textContent = 'Agrega una tarea clara para empezar con impulso.';
            } else {
                dom.nextActionTitle.textContent = todo.text;
                dom.nextActionReason.textContent = getNextActionReason(todo);
            }

            [dom.nextActionCompleteButton, dom.nextActionEditButton].forEach(button => {
                if (button) {
                    button.disabled = !todo;
                }
            });

            if (dom.nextActionCompleteButton) {
                dom.nextActionCompleteButton.textContent = todo && compositeTasks && compositeTasks.isCompositeTask(todo)
                    ? 'Ver pasos'
                    : 'Completar';
                dom.nextActionCompleteButton.setAttribute('aria-label', todo && compositeTasks && compositeTasks.isCompositeTask(todo)
                    ? 'Ver subtareas de la siguiente acción'
                    : 'Completar la siguiente acción');
            }
        }

        function getPriorityOptions(selectedPriority) {
            return PRIORITIES.map(priority => ({
                value: priority.value,
                label: priority.label,
                selected: priority.value === selectedPriority
            }));
        }

        function getCreatedDateBadge(todo) {
            const createdDateKey = todo.createdOn || (todo.createdAt ? String(todo.createdAt).slice(0, 10) : '');

            if (!createdDateKey) {
                return null;
            }

            return {
                className: 'date-badge detail-meta-text',
                text: 'Creada ' + getDateLabel(createdDateKey, { day: 'numeric', month: 'short' })
            };
        }

        function getDueDateBadge(todo, includeEmpty) {
            const dueDate = getTaskDueDate(todo);

            if (!dueDate) {
                return includeEmpty ? {
                    className: 'due-date-badge no-deadline-badge detail-meta-text',
                    text: 'Sin vencimiento'
                } : null;
            }

            return {
                className: 'due-date-badge detail-meta-text',
                text: 'Vence ' + getDateLabel(dueDate, { day: 'numeric', month: 'short' })
            };
        }

        function getTaskSecondaryMeta(todo, urgencyState) {
            const context = [];

            if (todo.priority && todo.priority !== 'normal') {
                context.push({
                    className: 'task-meta-priority task-meta-priority-' + todo.priority,
                    text: getPriorityLabel(todo.priority)
                });
            }

            if (urgencyState && urgencyState.label) {
                context.push({
                    className: 'task-meta-urgency task-meta-urgency-' + urgencyState.level,
                    text: urgencyState.label,
                    title: urgencyState.message
                });
            }

            return context;
        }

        function getCompositeProgressVisual(todo) {
            if (!compositeTasks || !compositeTasks.isCompositeTask(todo)) {
                return null;
            }

            const progress = compositeTasks.getCompositeTaskProgress(todo);
            const requiredTotal = Math.max(Number(progress.requiredTotal) || 0, 1);
            const requiredCompleted = Math.min(Math.max(Number(progress.requiredCompleted) || 0, 0), requiredTotal);

            return {
                completed: requiredCompleted,
                total: requiredTotal,
                label: 'Hito · ' + requiredCompleted + '/' + requiredTotal + ' pasos',
                ariaLabel: compositeTasks.getCompositeProgressLabel(todo)
            };
        }

        function renderEditItem(item, todo) {
            const editContent = components.createTaskEditContent({
                documentRef,
                todo,
                priorityOptions: getPriorityOptions(todo.priority),
                titleMaxLength: taskTitleMaxLength
            });

            item.append(editContent.content);
            return editContent.editInput;
        }

        function renderDisplayItem(item, todo, urgencyState) {
            const isComposite = compositeTasks && compositeTasks.isCompositeTask(todo);
            const isExpanded = expandedTodoIds.has(todo.id);
            const dateBadge = getCreatedDateBadge(todo);
            const dueDateBadge = getDueDateBadge(todo, true);
            const badges = [];

            if (dueDateBadge) {
                badges.push(dueDateBadge);
            }

            if (dateBadge) {
                badges.push(dateBadge);
            }

            if (todo.habit) {
                badges.push({
                    className: 'habit-badge',
                    text: 'Hábito'
                });
            }

            if (isTodoSnoozedForToday(todo)) {
                badges.push({
                    className: 'snooze-badge',
                    text: 'Programada'
                });
            }

            const displayContent = components.createTaskDisplayContent({
                documentRef,
                todo,
                badges,
                compactMeta: getTaskSecondaryMeta(todo, urgencyState),
                composite: isComposite,
                compositeStatus: isComposite ? compositeTasks.getCompositeTaskStatus(todo) : '',
                compositeStatusLabel: isComposite
                    ? (todo.completed
                        ? (compositeTasks.getCompositeTaskStatus(todo) === 'fully-completed' ? 'Tarea completada totalmente' : 'Tarea completada con subtareas opcionales pendientes')
                        : 'Completa las subtareas obligatorias para terminar esta tarea')
                    : '',
                compositeProgress: getCompositeProgressVisual(todo),
                compositeDetails: (isComposite || isExpanded)
                    ? components.createSubtaskList({
                        documentRef,
                        subtasks: isComposite && typeof compositeTasks.getDisplaySubtasks === 'function'
                            ? compositeTasks.getDisplaySubtasks(todo.subtasks)
                            : (isComposite ? todo.subtasks : []),
                        progressLabel: isComposite ? 'Pasos del hito' : 'Subtareas',
                        composite: isComposite,
                        adding: addingSubtaskTodoIds.has(todo.id),
                        editingSubtaskId: editingSubtask && editingSubtask.todoId === todo.id ? editingSubtask.subtaskId : '',
                        confirmation: compositeConfirmation && compositeConfirmation.todoId === todo.id ? compositeConfirmation : null,
                        titleMaxLength: taskTitleMaxLength
                    })
                    : null,
                expanded: isExpanded,
                actionsOpen: actionMenuTodoId === todo.id
            });

            item.append(displayContent.content, displayContent.details);
        }

        function getListPresentation() {
            const visibleTodos = getVisibleTodos();
            const focusTodo = getTopPriorityTodo();
            const shouldUseTaskFocus = Boolean(focusTodo && (activeFilter === 'pending' || activeFilter === 'all'));

            dom.todoList.classList.toggle('has-focused-task', shouldUseTaskFocus);

            return {
                visibleTodos,
                focusTodo,
                shouldUseTaskFocus
            };
        }

        function createRenderedTodoItem(todo, presentation) {
            const urgencyState = getTodoUrgencyState(todo);
            const isFocusTask = presentation.shouldUseTaskFocus && todo.id === presentation.focusTodo.id;
            const isSecondaryTask = presentation.shouldUseTaskFocus && !isFocusTask && isTodoAvailableToday(todo);
            const item = components.createTaskListItem({
                documentRef,
                todo,
                urgencyLevel: urgencyState ? urgencyState.level : '',
                focused: isFocusTask,
                secondary: isSecondaryTask,
                expanded: expandedTodoIds.has(todo.id),
                actionsOpen: actionMenuTodoId === todo.id,
                editing: editingTodoId === todo.id
            });

            if (editingTodoId === todo.id) {
                return {
                    item,
                    editInput: renderEditItem(item, todo)
                };
            }

            renderDisplayItem(item, todo, urgencyState);
            return { item, editInput: null };
        }

        function updateTaskListSupportingUi() {
            updateTaskCount();
            updateTaskSummary();
            updateTaskMaintenanceControls();
            renderExpiredTasksPanel();
            scheduleRefresh();
        }

        function focusEditInput(input) {
            if (!input || typeof input.focus !== 'function') {
                return;
            }

            input.focus();
            if (typeof input.select === 'function') {
                input.select();
            }
        }

        function getDocumentScrollPosition() {
            const documentNode = documentRef;
            const root = documentNode && documentNode.documentElement;
            const body = documentNode && documentNode.body;

            return {
                left: Number(global.scrollX) || (root && root.scrollLeft) || (body && body.scrollLeft) || 0,
                top: Number(global.scrollY) || (root && root.scrollTop) || (body && body.scrollTop) || 0
            };
        }

        function restoreDocumentScrollPosition(position) {
            if (!position) {
                return;
            }

            const restore = () => {
                if (typeof global.scrollTo === 'function') {
                    global.scrollTo(position.left, position.top);
                    return;
                }

                if (documentRef && documentRef.documentElement) {
                    documentRef.documentElement.scrollLeft = position.left;
                    documentRef.documentElement.scrollTop = position.top;
                }

                if (documentRef && documentRef.body) {
                    documentRef.body.scrollLeft = position.left;
                    documentRef.body.scrollTop = position.top;
                }
            };

            restore();
            if (typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(() => {
                    restore();
                    if (typeof global.setTimeout === 'function') {
                        global.setTimeout(restore, 0);
                    }
                });
            }
        }

        function captureViewportAnchor(excludedTodoId) {
            if (!dom.todoList || typeof dom.todoList.querySelectorAll !== 'function') {
                return null;
            }

            const candidates = Array.from(dom.todoList.querySelectorAll('.todo-item'));
            const anchor = candidates.find(item => {
                if (item.dataset.id === excludedTodoId || typeof item.getBoundingClientRect !== 'function') {
                    return false;
                }

                const bounds = item.getBoundingClientRect();
                return bounds.bottom > 0 && bounds.top < (global.innerHeight || Number.MAX_SAFE_INTEGER);
            });

            if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
                return null;
            }

            return {
                id: anchor.dataset.id,
                top: anchor.getBoundingClientRect().top
            };
        }

        function restoreViewportAnchor(anchor) {
            if (!anchor || !anchor.id || !dom.todoList || typeof dom.todoList.querySelectorAll !== 'function') {
                return;
            }

            const restore = () => {
                const item = Array.from(dom.todoList.querySelectorAll('.todo-item')).find(candidate => candidate.dataset.id === anchor.id);
                if (!item || typeof item.getBoundingClientRect !== 'function') {
                    return;
                }

                const delta = item.getBoundingClientRect().top - anchor.top;
                if (Math.abs(delta) < 1) {
                    return;
                }

                if (typeof global.scrollBy === 'function') {
                    global.scrollBy(0, delta);
                    return;
                }

                if (typeof global.scrollTo === 'function') {
                    const position = getDocumentScrollPosition();
                    global.scrollTo(position.left, position.top + delta);
                }
            };

            restore();
            if (typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(restore);
            }
        }

        function canPatchTaskStateChange(presentation, changedTodoId) {
            if (!changedTodoId || editingTodoId || !dom.todoList || typeof dom.todoList.querySelectorAll !== 'function') {
                return false;
            }

            const existingIds = Array.from(dom.todoList.querySelectorAll('.todo-item'))
                .map(item => item.dataset.id)
                .filter(Boolean);
            const expectedIds = presentation.visibleTodos.map(todo => todo.id);
            const currentWithoutChanged = existingIds.filter(id => id !== changedTodoId);
            const expectedWithoutChanged = expectedIds.filter(id => id !== changedTodoId);

            return currentWithoutChanged.length === expectedWithoutChanged.length
                && currentWithoutChanged.every((id, index) => id === expectedWithoutChanged[index]);
        }

        function patchTaskStateChange(presentation, changedTodoId, scrollPosition) {
            if (!canPatchTaskStateChange(presentation, changedTodoId)) {
                return false;
            }

            const viewportAnchor = captureViewportAnchor(changedTodoId);
            const currentItem = Array.from(dom.todoList.querySelectorAll('.todo-item'))
                .find(item => item.dataset.id === changedTodoId);
            const changedTodo = presentation.visibleTodos.find(todo => todo.id === changedTodoId);

            if (changedTodo) {
                const rendered = createRenderedTodoItem(changedTodo, presentation);

                if (currentItem && typeof currentItem.replaceWith === 'function') {
                    currentItem.replaceWith(rendered.item);
                } else {
                    dom.todoList.appendChild(rendered.item);
                }
            } else if (currentItem && typeof currentItem.remove === 'function') {
                currentItem.remove();
            }

            if (presentation.visibleTodos.length === 0) {
                ui.clear(dom.todoList);
                dom.todoList.appendChild(components.createEmptyState({
                    documentRef,
                    message: getEmptyStateMessage()
                }));
            }

            updateTaskListSupportingUi();
            restoreDocumentScrollPosition(scrollPosition);
            restoreViewportAnchor(viewportAnchor);
            return true;
        }

        function syncTaskFocusPresentation(presentation) {
            if (!dom.todoList || typeof dom.todoList.querySelectorAll !== 'function') {
                return;
            }

            const visibleTodoIds = new Set(presentation.visibleTodos.map(todo => todo.id));
            const focusedTodoId = presentation.focusTodo && presentation.focusTodo.id;

            Array.from(dom.todoList.querySelectorAll('.todo-item')).forEach(item => {
                const todoId = item.dataset.id;
                if (!visibleTodoIds.has(todoId)) {
                    return;
                }

                const todo = presentation.visibleTodos.find(candidate => candidate.id === todoId);
                const focused = presentation.shouldUseTaskFocus && todoId === focusedTodoId;
                const secondary = presentation.shouldUseTaskFocus && !focused && isTodoAvailableToday(todo);

                item.classList.toggle('focus-task', focused);
                item.classList.toggle('secondary-task', secondary);

                if (focused) {
                    item.setAttribute('aria-current', 'true');
                } else {
                    item.removeAttribute('aria-current');
                }
            });
        }

        function updateCompositeHeader(todoItem, todo) {
            const checkButton = todoItem.querySelector('.task-check-button.composite-indicator');
            const progress = getCompositeProgressVisual(todo);
            const status = compositeTasks.getCompositeTaskStatus(todo);

            todoItem.classList.toggle('completed', Boolean(todo.completed));

            if (checkButton) {
                checkButton.classList.toggle('checked', Boolean(todo.completed));
                checkButton.dataset.compositeStatus = status || 'in-progress';
                checkButton.textContent = todo.completed ? '\u2713' : '';
                checkButton.setAttribute('aria-pressed', Boolean(todo.completed).toString());
                checkButton.setAttribute('aria-label', todo.completed
                    ? (status === 'fully-completed' ? 'Tarea completada totalmente' : 'Tarea completada con subtareas opcionales pendientes')
                    : 'Completa las subtareas obligatorias para terminar esta tarea');
            }

            const progressElement = todoItem.querySelector('.task-composite-progress');
            if (!progress || !progressElement) {
                return;
            }

            const total = Math.max(Number(progress.total) || 0, 1);
            const completed = Math.min(Math.max(Number(progress.completed) || 0, 0), total);
            const label = progressElement.querySelector('span');
            const fill = progressElement.querySelector('.task-composite-progress-fill');

            progressElement.setAttribute('aria-label', progress.ariaLabel || progress.label);
            progressElement.setAttribute('aria-valuemax', String(total));
            progressElement.setAttribute('aria-valuenow', String(completed));

            if (label) {
                label.textContent = progress.label;
            }

            if (fill) {
                fill.style.width = Math.round((completed / total) * 100) + '%';
            }
        }

        function syncSubtaskRowState(row, subtask) {
            const checkButton = row.querySelector('.subtask-check');

            row.classList.toggle('completed', Boolean(subtask.completed));

            if (!checkButton) {
                return;
            }

            checkButton.classList.toggle('checked', Boolean(subtask.completed));
            checkButton.textContent = subtask.completed ? '\u2713' : '';
            checkButton.setAttribute('aria-pressed', Boolean(subtask.completed).toString());
            checkButton.setAttribute('aria-label', (subtask.completed ? 'Reactivar subtarea: ' : 'Completar subtarea: ') + subtask.title);
        }

        function syncSubtaskOrder(list, orderedSubtasks, changedSubtaskId) {
            const rowsById = new Map(Array.from(list.querySelectorAll('.subtask-item')).map(row => [row.dataset.subtaskId, row]));

            if (rowsById.size !== orderedSubtasks.length || orderedSubtasks.some(subtask => !rowsById.has(subtask.id))) {
                return false;
            }

            const changedIndex = orderedSubtasks.findIndex(subtask => subtask.id === changedSubtaskId);
            const changedRow = rowsById.get(changedSubtaskId);

            if (changedIndex < 0 || !changedRow) {
                return false;
            }

            // Solo movemos el paso modificado. Reanexar toda la lista reinicia su layout y desplaza el scroll.
            const nextSubtask = orderedSubtasks[changedIndex + 1];
            const nextRow = nextSubtask ? rowsById.get(nextSubtask.id) : null;

            if (nextRow) {
                list.insertBefore(changedRow, nextRow);
            } else if (list.lastElementChild !== changedRow) {
                list.appendChild(changedRow);
            }

            orderedSubtasks.forEach((subtask, index) => {
                const row = rowsById.get(subtask.id);
                const previous = orderedSubtasks[index - 1];
                const next = orderedSubtasks[index + 1];
                const moveUp = row.querySelector('.subtask-action.move-up');
                const moveDown = row.querySelector('.subtask-action.move-down');

                if (moveUp) {
                    moveUp.disabled = !(previous && Boolean(previous.completed) === Boolean(subtask.completed));
                }

                if (moveDown) {
                    moveDown.disabled = !(next && Boolean(next.completed) === Boolean(subtask.completed));
                }
            });

            return true;
        }

        function restoreSubtaskListScroll(list, position) {
            if (!list || !Number.isFinite(position)) {
                return;
            }

            const restore = () => {
                list.scrollTop = position;
            };

            restore();
            if (typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(restore);
            }
        }

        function refreshSubtaskState(todoId, subtaskId) {
            if (!todoId || !subtaskId || !compositeTasks || !dom.todoList) {
                return false;
            }

            const presentation = getListPresentation();
            const todo = presentation.visibleTodos.find(item => item.id === todoId);
            const subtask = todo && Array.isArray(todo.subtasks) ? todo.subtasks.find(item => item.id === subtaskId) : null;
            const todoItem = Array.from(dom.todoList.querySelectorAll('.todo-item')).find(item => item.dataset.id === todoId);
            const subtaskList = todoItem && todoItem.querySelector('.subtask-list');
            const subtaskRow = subtaskList && Array.from(subtaskList.querySelectorAll('.subtask-item')).find(item => item.dataset.subtaskId === subtaskId);

            if (!todo || !subtask || !todoItem || !subtaskList || !subtaskRow) {
                return false;
            }

            const documentScroll = getDocumentScrollPosition();
            const subtaskScrollTop = Number(subtaskList.scrollTop) || 0;
            const orderedSubtasks = typeof compositeTasks.getDisplaySubtasks === 'function'
                ? compositeTasks.getDisplaySubtasks(todo.subtasks)
                : todo.subtasks.slice();

            syncSubtaskRowState(subtaskRow, subtask);

            if (!syncSubtaskOrder(subtaskList, orderedSubtasks, subtaskId)) {
                return false;
            }

            updateCompositeHeader(todoItem, todo);
            syncTaskFocusPresentation(presentation);
            updateTaskListSupportingUi();
            restoreSubtaskListScroll(subtaskList, subtaskScrollTop);
            restoreDocumentScrollPosition(documentScroll);
            return true;
        }

        function renderTodoList(options) {
            if (!dom.todoList) {
                return;
            }

            const config = options || {};
            const scrollPosition = config.preserveScroll ? getDocumentScrollPosition() : null;
            updateFilterButtons();
            const presentation = getListPresentation();

            if (config.changedTodoId && patchTaskStateChange(presentation, config.changedTodoId, scrollPosition)) {
                return;
            }

            ui.clear(dom.todoList);

            if (presentation.visibleTodos.length === 0) {
                dom.todoList.appendChild(components.createEmptyState({
                    documentRef,
                    message: getEmptyStateMessage()
                }));
                updateTaskListSupportingUi();
                restoreDocumentScrollPosition(scrollPosition);
                return;
            }

            let editInput = null;

            presentation.visibleTodos.forEach(todo => {
                const rendered = createRenderedTodoItem(todo, presentation);
                dom.todoList.appendChild(rendered.item);
                editInput = editInput || rendered.editInput;
            });

            updateTaskListSupportingUi();
            restoreDocumentScrollPosition(scrollPosition);
            focusEditInput(editInput);
        }

        function renderTaskSurface() {
            renderTodoList();
            renderNextAction();
        }

        function setFilter(filter, shouldRender) {
            activeFilter = normalizeFilter(filter);
            actionMenuTodoId = null;

            if (shouldRender !== false) {
                renderTodoList();
            }

            return activeFilter;
        }

        function setEditingTodoId(id, shouldRender) {
            editingTodoId = id || null;
            actionMenuTodoId = null;

            if (shouldRender !== false) {
                renderTodoList();
            }
        }

        function clearEditingTodo(shouldRender) {
            setEditingTodoId(null, shouldRender);
        }

        function toggleExpandedTodo(id, shouldRender) {
            if (!id) {
                return;
            }

            setExpandedTodo(id, !expandedTodoIds.has(id), shouldRender);
        }

        function setExpandedTodo(id, expanded, shouldRender) {
            if (!id) {
                return;
            }

            actionMenuTodoId = null;

            if (expanded) {
                expandedTodoIds.add(id);
            } else {
                expandedTodoIds.delete(id);
            }

            if (shouldRender !== false) {
                renderTodoList();
            }
        }

        function toggleTaskActionMenu(id, shouldRender) {
            if (!id) {
                return;
            }

            const willOpen = actionMenuTodoId !== id;
            actionMenuTodoId = willOpen ? id : null;

            if (shouldRender !== false) {
                renderTodoList();
                focusTaskElement(id, willOpen ? '.task-menu-action' : '.task-more-button');
            }
        }

        function runTodoToggle(todoItem, todoId) {
            try {
                onToggleTodo(todoId);
            } catch (error) {
                todoItem.querySelectorAll('[data-action="toggle"]').forEach(button => {
                    button.disabled = false;
                });
                showCriticalError('No se pudo actualizar la tarea. Intenta de nuevo.');
            }
        }

        function toggleTodoFromList(todoItem, todoId) {
            const activeElement = documentRef && documentRef.activeElement;
            if (activeElement && typeof todoItem.contains === 'function' && todoItem.contains(activeElement) && typeof activeElement.blur === 'function') {
                activeElement.blur();
            }

            todoItem.querySelectorAll('[data-action="toggle"]').forEach(button => {
                button.disabled = true;
            });

            runTodoToggle(todoItem, todoId);
        }

        function findEditItem(id) {
            if (!dom.todoList) {
                return null;
            }

            return Array.from(dom.todoList.querySelectorAll('.todo-item')).find(item => item.dataset.id === id) || null;
        }

        function focusTaskElement(id, selector) {
            if (!dom.todoList || !id || !selector) {
                return;
            }

            const focusTarget = () => {
                const item = Array.from(dom.todoList.querySelectorAll('.todo-item')).find(todoItem => todoItem.dataset.id === id);
                const target = item ? item.querySelector(selector) : null;

                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            };

            if (typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(focusTarget);
                return;
            }

            if (typeof global.setTimeout === 'function') {
                global.setTimeout(focusTarget, 0);
                return;
            }

            focusTarget();
        }

        function getEditDraft(id) {
            const editItem = findEditItem(id);
            const editInput = editItem ? editItem.querySelector('.edit-input') : null;
            const editPriority = editItem ? editItem.querySelector('.edit-priority-input') : null;
            const editTimeLimit = editItem ? editItem.querySelector('.edit-time-limit-input') : null;

            return {
                item: editItem,
                input: editInput,
                priorityInput: editPriority,
                timeLimitInput: editTimeLimit,
                text: editInput ? editInput.value.trim() : '',
                priority: editPriority ? editPriority.value : 'normal',
                dueDate: editTimeLimit ? editTimeLimit.value : ''
            };
        }

        function handleFilterClick(event) {
            const filterButton = event.target.closest('[data-filter]');

            if (!filterButton) {
                return;
            }

            setFilter(filterButton.dataset.filter, true);
        }

        function handleNextActionComplete() {
            if (nextActionTodoId) {
                onToggleTodo(nextActionTodoId);
            }
        }

        function handleNextActionEdit() {
            if (nextActionTodoId) {
                onEditTodo(nextActionTodoId);
            }
        }

        function handleClearCompletedTasksClick() {
            onClearCompleted();
        }

        function handleTodoAction(event) {
            const actionButton = event.target.closest('[data-action]');
            const todoItem = event.target.closest('.todo-item');

            if (!todoItem) {
                return;
            }

            const todoId = todoItem.dataset.id;

            if (!actionButton) {
                const clickedControl = event.target.closest('button, input, select, textarea, a, label');
                const clickedActionZone = event.target.closest('.task-quick-actions');
                const clickedCompositeDetails = event.target.closest('.composite-details');

                if (!clickedControl && !clickedActionZone && !clickedCompositeDetails) {
                    actionMenuTodoId = null;
                    toggleExpandedTodo(todoId, true);
                }

                return;
            }

            const action = actionButton.dataset.action;

            event.preventDefault();
            event.stopPropagation();

            if (action === 'menu') {
                toggleTaskActionMenu(todoId, true);
                return;
            }

            if (action === 'expand') {
                toggleExpandedTodo(todoId, true);
                return;
            }

            if (action === 'toggle') {
                actionMenuTodoId = null;

                if (!todoItem.classList.contains('completed')) {
                    toggleTodoFromList(todoItem, todoId);
                    return;
                }

                toggleTodoFromList(todoItem, todoId);
                return;
            }

            if (action === 'composite-info') {
                onCompositeInfo(todoId);
                return;
            }

            if (action === 'add-subtask-form') {
                addingSubtaskTodoIds.add(todoId);
                expandedTodoIds.add(todoId);
                renderTodoList();
                focusTaskElement(todoId, '.inline-subtask-input');
                return;
            }

            if (action === 'cancel-subtask-form') {
                addingSubtaskTodoIds.delete(todoId);
                compositeConfirmation = null;
                renderTodoList();
                return;
            }

            if (action === 'save-subtask') {
                const input = todoItem.querySelector('.inline-subtask-input');
                const optional = todoItem.querySelector('.inline-subtask-optional');
                const created = onAddSubtask(todoId, input ? input.value : '', Boolean(optional && optional.checked));
                if (created && created.requiresConfirmation) {
                    compositeConfirmation = {
                        todoId,
                        kind: 'add-subtask-to-completed',
                        title: 'Reactivar y dividir la tarea',
                        message: created.message,
                        confirmLabel: 'Convertir',
                        titleValue: input ? input.value : '',
                        optional: Boolean(optional && optional.checked)
                    };
                    renderTodoList();
                    return;
                }
                if (created !== false) {
                    addingSubtaskTodoIds.add(todoId);
                }
                return;
            }

            if (action === 'toggle-subtask') {
                if (typeof actionButton.blur === 'function') {
                    actionButton.blur();
                }
                onToggleSubtask(todoId, actionButton.dataset.subtaskId);
                return;
            }

            if (action === 'edit-subtask') {
                editingSubtask = { todoId, subtaskId: actionButton.dataset.subtaskId };
                compositeConfirmation = null;
                renderTodoList();
                focusTaskElement(todoId, '.subtask-edit-input');
                return;
            }

            if (action === 'save-subtask-edit') {
                const input = todoItem.querySelector('.subtask-edit-input');
                const optional = todoItem.querySelector('.subtask-edit-optional input');
                const saved = onSaveSubtaskEdit(todoId, actionButton.dataset.subtaskId, input ? input.value : '', Boolean(optional && optional.checked));
                if (saved !== false) {
                    editingSubtask = null;
                    renderTodoList();
                }
                return;
            }

            if (action === 'cancel-subtask-edit') {
                editingSubtask = null;
                renderTodoList();
                return;
            }

            if (action === 'delete-subtask') {
                const request = onRequestSubtaskDelete(todoId, actionButton.dataset.subtaskId);
                if (request) {
                    onDeleteSubtask(todoId, actionButton.dataset.subtaskId, request.strategy || 'remove');
                    compositeConfirmation = null;
                    editingSubtask = null;
                }
                return;
            }

            if (action === 'move-subtask-up' || action === 'move-subtask-down') {
                onMoveSubtask(todoId, actionButton.dataset.subtaskId, action === 'move-subtask-up' ? -1 : 1);
                return;
            }

            if (action === 'convert-to-normal') {
                compositeConfirmation = {
                    todoId,
                    kind: 'convert-to-normal',
                    title: 'Convertir en tarea simple',
                    message: 'Las subtareas se eliminarán y esta tarea volverá a comportarse como tarea simple.',
                    confirmLabel: 'Convertir'
                };
                renderTodoList();
                return;
            }

            if (action === 'cancel-composite-confirmation') {
                compositeConfirmation = null;
                renderTodoList();
                return;
            }

            if (action === 'approve-composite-confirmation') {
                const pending = compositeConfirmation;
                compositeConfirmation = null;
                if (!pending) return;
                if (pending.kind === 'add-subtask-to-completed') {
                    onAddSubtask(todoId, pending.titleValue, pending.optional, { confirmed: true });
                    return;
                }
                if (pending.kind === 'convert-to-normal') {
                    onConvertToNormal(todoId);
                }
                return;
            }

            if (action === 'edit') {
                actionMenuTodoId = null;
                onEditTodo(todoId);
                return;
            }

            if (action === 'save') {
                actionMenuTodoId = null;
                onSaveEdit(todoId);
                return;
            }

            if (action === 'cancel') {
                actionMenuTodoId = null;
                onCancelEdit();
                return;
            }

            if (action === 'delete') {
                actionMenuTodoId = null;
                onDeleteTodo(todoId);
                return;
            }
        }

        function handleTodoKeydown(event) {
            if (event.key === 'Escape' && actionMenuTodoId) {
                const closingTodoId = actionMenuTodoId;
                actionMenuTodoId = null;
                renderTodoList();
                focusTaskElement(closingTodoId, '.task-more-button');
                return;
            }

            if (!event.target.classList.contains('edit-input')) {
                return;
            }

            const todoItem = event.target.closest('.todo-item');

            if (!todoItem) {
                return;
            }

            if (event.key === 'Enter') {
                onSaveEdit(todoItem.dataset.id);
            }

            if (event.key === 'Escape') {
                onCancelEdit();
            }
        }

        return {
            getFilter: () => activeFilter,
            setFilter,
            getEditingTodoId: () => editingTodoId,
            setEditingTodoId,
            clearEditingTodo,
            toggleExpandedTodo,
            setExpandedTodo,
            getNextActionTodoId: () => nextActionTodoId,
            getPriorityLabel,
            getStats,
            getVisibleTodos,
            getEmptyStateMessage,
            getExpiredTaskRecords,
            getNextActionReason,
            getEditDraft,
            updateTaskCount,
            updateTaskSummary,
            updateFilterButtons,
            updateTaskMaintenanceControls,
            renderExpiredTasksPanel,
            renderNextAction,
            renderTodoList,
            refreshSubtaskState,
            renderTaskSurface,
            handleFilterClick,
            handleNextActionComplete,
            handleNextActionEdit,
            handleClearCompletedTasksClick,
            handleTodoAction,
            handleTodoKeydown
        };
    }

    function createFallbackUi() {
        return {
            clear(element) {
                if (element) {
                    element.innerHTML = '';
                }
            },
            setText(element, value) {
                if (element) {
                    element.textContent = String(value);
                }
            },
            setHidden(element, hidden) {
                if (element) {
                    element.hidden = Boolean(hidden);
                }
            },
            toggleClass(element, className, enabled) {
                if (element && element.classList) {
                    element.classList.toggle(className, Boolean(enabled));
                }
            },
            setButtonDisabled(button, disabled) {
                if (button) {
                    button.disabled = Boolean(disabled);
                }
            }
        };
    }

    global.TasklyzenTaskUi = {
        createTaskUiController
    };
})(window);
