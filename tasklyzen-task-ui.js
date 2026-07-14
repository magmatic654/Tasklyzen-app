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
                className: 'date-badge',
                text: 'Creada ' + getDateLabel(createdDateKey, { day: 'numeric', month: 'short' })
            };
        }

        function getDueDateBadge(todo) {
            const dueDate = getTaskDueDate(todo);

            if (!dueDate) {
                return {
                    className: 'due-date-badge no-deadline-badge',
                    text: 'Sin vencimiento'
                };
            }

            return {
                className: 'due-date-badge',
                text: 'Límite ' + getDateLabel(dueDate, { day: 'numeric', month: 'short' })
            };
        }

        function getEssentialBadge(todo, urgencyState) {
            if (urgencyState && urgencyState.level && urgencyState.level !== 'on-time') {
                return {
                    className: 'urgency-badge urgency-badge-' + urgencyState.level,
                    text: urgencyState.label,
                    title: urgencyState.message
                };
            }

            return null;
        }

        function renderEditItem(item, todo) {
            const editContent = components.createTaskEditContent({
                documentRef,
                todo,
                priorityOptions: getPriorityOptions(todo.priority)
            });

            item.append(editContent.content);
            dom.todoList.appendChild(item);
            editContent.editInput.focus();
            editContent.editInput.select();
        }

        function renderDisplayItem(item, todo, urgencyState) {
            const isComposite = compositeTasks && compositeTasks.isCompositeTask(todo);
            const dateBadge = getCreatedDateBadge(todo);
            const dueDateBadge = getDueDateBadge(todo);
            const essentialBadge = getEssentialBadge(todo, urgencyState);
            const badges = [
                {
                    className: 'priority-badge priority-badge-' + todo.priority,
                    text: getPriorityLabel(todo.priority)
                }
            ];

            badges.push(dueDateBadge);

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

            if (urgencyState) {
                badges.push({
                    className: 'urgency-badge urgency-badge-' + urgencyState.level,
                    text: urgencyState.label,
                    title: urgencyState.message
                });
            }

            const displayContent = components.createTaskDisplayContent({
                documentRef,
                todo,
                badges,
                essentialBadge: isComposite ? null : essentialBadge,
                composite: isComposite,
                compositeStatus: isComposite ? compositeTasks.getCompositeTaskStatus(todo) : '',
                compositeStatusLabel: isComposite
                    ? (todo.completed
                        ? (compositeTasks.getCompositeTaskStatus(todo) === 'fully-completed' ? 'Tarea completada totalmente' : 'Tarea completada con subtareas opcionales pendientes')
                        : 'Completa las subtareas obligatorias para terminar esta tarea')
                    : '',
                progressLabel: isComposite ? compositeTasks.getCompositeProgressLabel(todo) : '',
                compositeDetails: (isComposite || expandedTodoIds.has(todo.id))
                    ? components.createSubtaskList({
                        documentRef,
                        subtasks: isComposite ? todo.subtasks : [],
                        progressLabel: isComposite ? compositeTasks.getCompositeProgressLabel(todo) : 'Subtareas',
                        composite: isComposite,
                        adding: addingSubtaskTodoIds.has(todo.id),
                        editingSubtaskId: editingSubtask && editingSubtask.todoId === todo.id ? editingSubtask.subtaskId : '',
                        confirmation: compositeConfirmation && compositeConfirmation.todoId === todo.id ? compositeConfirmation : null
                    })
                    : null,
                expanded: expandedTodoIds.has(todo.id),
                actionsOpen: actionMenuTodoId === todo.id
            });

            item.append(displayContent.content, displayContent.details);
            dom.todoList.appendChild(item);
        }

        function renderTodoList() {
            if (!dom.todoList) {
                return;
            }

            ui.clear(dom.todoList);
            updateFilterButtons();

            const visibleTodos = getVisibleTodos();
            const focusTodo = getTopPriorityTodo();
            const shouldUseTaskFocus = Boolean(focusTodo && (activeFilter === 'pending' || activeFilter === 'all'));
            dom.todoList.classList.toggle('has-focused-task', shouldUseTaskFocus);

            if (visibleTodos.length === 0) {
                dom.todoList.appendChild(components.createEmptyState({
                    documentRef,
                    message: getEmptyStateMessage()
                }));
                updateTaskCount();
                updateTaskSummary();
                updateTaskMaintenanceControls();
                renderExpiredTasksPanel();
                scheduleRefresh();
                return;
            }

            visibleTodos.forEach(todo => {
                const urgencyState = getTodoUrgencyState(todo);
                const isFocusTask = shouldUseTaskFocus && todo.id === focusTodo.id;
                const isSecondaryTask = shouldUseTaskFocus && !isFocusTask && isTodoAvailableToday(todo);
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
                    renderEditItem(item, todo);
                    return;
                }

                renderDisplayItem(item, todo, urgencyState);
            });

            updateTaskCount();
            updateTaskSummary();
            updateTaskMaintenanceControls();
            renderExpiredTasksPanel();
            scheduleRefresh();
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
                todoItem.classList.remove('local-complete-feedback', 'local-reactivate-feedback');
                todoItem.querySelectorAll('[data-action="toggle"]').forEach(button => {
                    button.disabled = false;
                });
                showCriticalError('No se pudo actualizar la tarea. Intenta de nuevo.');
            }
        }

        function toggleTodoWithFeedback(todoItem, todoId, feedbackClass, delay) {
            todoItem.classList.add(feedbackClass);
            todoItem.querySelectorAll('[data-action="toggle"]').forEach(button => {
                button.disabled = true;
            });

            if (typeof global.setTimeout === 'function') {
                global.setTimeout(() => runTodoToggle(todoItem, todoId), delay);
            } else {
                runTodoToggle(todoItem, todoId);
            }
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
                    toggleTodoWithFeedback(todoItem, todoId, 'local-complete-feedback', 140);
                    return;
                }

                toggleTodoWithFeedback(todoItem, todoId, 'local-reactivate-feedback', 120);
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
