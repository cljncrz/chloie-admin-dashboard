document.addEventListener('DOMContentLoaded', () => {
    // Only run this script on the todo-lists.html page
    const todoPageContainer = document.querySelector('.todo-list-page-container');
    if (!todoPageContainer) {
        return;
    }

    // --- DOM Elements ---
    const listContainer = document.getElementById('full-todo-list');
    const filterButtons = document.getElementById('todo-filter-buttons');
    const noResultsMessage = listContainer.querySelector('.no-results-row');
    const addToDoForm = document.getElementById('add-todo-form');
    const archiveCompletedBtn = document.getElementById('archive-completed-btn');

    // --- State ---
    let todos = window.appData.todos || [];
    let currentFilter = 'all';
    let todoIdToDelete = null; // To store the ID of the item to be deleted

    // --- Functions ---

    /**
     * Renders the to-do items based on the current filter.
     */
    const renderTodos = () => {
        // Clear existing items but not the 'no results' message
        listContainer.querySelectorAll('.todo-item').forEach(item => item.remove());

        // Show/hide the archive button based on whether there are completable tasks
        const hasCompletedTasks = todos.some(t => t.completed && !t.archived);
        archiveCompletedBtn.style.display = hasCompletedTasks ? 'inline-flex' : 'none';

        let filteredTodos = todos.filter(todo => {
            if (currentFilter === 'completed') return todo.completed && !todo.archived;
            if (currentFilter === 'active') return !todo.completed && !todo.archived;
            if (currentFilter === 'archived') return todo.archived;
            return !todo.archived; // 'all' filter now shows active and completed, but not archived
        });

        // Sort todos: completed items go to the bottom
        filteredTodos.sort((a, b) => {
            // In archived view, sort by newest first
            if (currentFilter === 'archived') return new Date(b.createdAt) - new Date(a.createdAt);
            if (a.completed === b.completed) {
                // If both have the same status, sort by creation date (newest first)
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
            return a.completed ? 1 : -1; // Incomplete (false) items first, then completed (true)
        });

        const getDueDateHTML = (dueDate, dueTime) => {
            if (!dueDate) return '';

            // Combine date and time for accurate comparison
            const dueDateTimeString = dueTime ? `${dueDate}T${dueTime}` : dueDate;
            const due = new Date(dueDateTimeString);
            const today = new Date();

            const isOverdue = due < today;

            // Format the date and time for display
            const dateOptions = { month: 'short', day: 'numeric' };
            const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
            
            let formattedDate = due.toLocaleDateString('en-US', dateOptions);
            if (dueTime) {
                // If there's a time, format it and append it
                formattedDate += `, ${due.toLocaleTimeString('en-US', timeOptions)}`;
            }

            return `<small class="todo-due-date ${isOverdue ? 'overdue' : ''}"><span class="material-symbols-outlined">event</span>${formattedDate}</small>`;
        };

        if (filteredTodos.length === 0) {
            noResultsMessage.style.display = 'block';
            if (currentFilter === 'completed') {
                noResultsMessage.querySelector('p').textContent = 'No completed tasks found.';
            } else if (currentFilter === 'active') {
                noResultsMessage.querySelector('p').textContent = 'All tasks completed! Great job!';
            } else if (currentFilter === 'archived') {
                noResultsMessage.querySelector('p').textContent = 'No archived tasks found.';
            } else {
                noResultsMessage.querySelector('p').textContent = 'You have no tasks. Add one to get started!';
            }
        } else {
            noResultsMessage.style.display = 'none';
            const fragment = document.createDocumentFragment();
            filteredTodos.forEach(todo => {
                const itemEl = document.createElement('div');
                let itemClass = 'todo-item';
                if (todo.archived) {
                    itemClass += ' archived';
                } else if (todo.completed) {
                    itemClass += ' completed';
                }
                itemEl.className = itemClass;
                itemEl.dataset.id = todo.id;
                itemEl.dataset.priority = todo.priority || 'medium';

                // Determine which icons/actions to show
                const isArchived = todo.archived;
                const completionIconHTML = isArchived ? '' : `<div class="icon-container" title="${todo.completed ? 'Mark as active' : 'Mark as complete'}"><span class="material-symbols-outlined icon-incomplete">radio_button_unchecked</span><span class="material-symbols-outlined icon-complete">check_circle</span></div>`;
                const priorityIndicatorHTML = isArchived ? '' : `<div class="priority-menu-container"><div class="priority-indicator" title="Change Priority"></div><div class="priority-menu"><div class="priority-option" data-priority-value="high">High</div><div class="priority-option" data-priority-value="medium">Medium</div><div class="priority-option" data-priority-value="low">Low</div></div></div>`;
                const unarchiveButtonHTML = isArchived ? `<button class="unarchive-todo-btn action-icon-btn" title="Unarchive Task"><span class="material-symbols-outlined">unarchive</span></button>` : '';

                // Use the new, redesigned HTML structure
                itemEl.innerHTML = `
                    ${completionIconHTML}
                    ${priorityIndicatorHTML}
                    <div class="details">
                        <h3>${todo.text}</h3>
                        <div class="todo-meta">
                            ${getDueDateHTML(todo.dueDate, todo.dueTime)}
                            <small class="text-muted">Created: ${new Date(todo.createdAt).toLocaleDateString()}</small>
                        </div>
                    </div>
                    ${unarchiveButtonHTML}
                    <button type="button" class="delete-todo-btn action-icon-btn" title="Delete Task">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                `;
                fragment.appendChild(itemEl);
            });
            listContainer.prepend(fragment);
        }
    };

    /**
     * Adds a new to-do item.
     * @param {string} text - The text of the to-do item.
     * @param {string|null} dueDate - The optional due date.
     * @param {string|null} dueTime - The optional due time.
     * @param {string} priority - The priority of the task ('low', 'medium', 'high').
     */
    window.addTodoItem = (text, dueDate, dueTime, priority) => {
        const newTodo = {
            id: `todo-${Date.now()}`,
            text: text,
            completed: false,
            dueDate: dueDate || null,
            dueTime: dueTime || null,
            archived: false,
            priority: priority || 'medium',
            createdAt: new Date().toISOString(),
        };
        todos.unshift(newTodo); // Add to the beginning of the array
        renderTodos();
    };

    /**
     * Puts a to-do item into edit mode.
     * @param {HTMLElement} todoItemEl - The .todo-item element to edit.
     */
    const editTodo = (todoItemEl) => {
        const h3 = todoItemEl.querySelector('h3');
        if (!h3) return; // Already in edit mode or something is wrong
        const detailsDiv = h3.parentElement;

        const currentText = h3.textContent;
        const todoId = todoItemEl.dataset.id;

        // Create an input field
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'todo-edit-input';
        input.value = currentText;

        // Replace the paragraph with the input
        detailsDiv.replaceChild(input, h3);
        input.focus();
        input.select(); // Select the text for easy replacement

        // Add a class to the parent to prevent other actions
        todoItemEl.classList.add('editing');

        const saveChanges = () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                const todo = todos.find(t => t.id === todoId);
                if (todo) {
                    todo.text = newText;
                }
            }
            // Always re-render to exit edit mode and reflect changes
            renderTodos();
        };

        // Event listener for when the input loses focus
        input.addEventListener('blur', saveChanges);

        // Event listener for Enter or Escape keys
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveChanges();
            } else if (e.key === 'Escape') {
                renderTodos(); // Just re-render to cancel, no data change
            }
        });
    };

    /**
     * Toggles the completed state of a to-do item.
     * @param {string} id - The ID of the to-do item.
     */
    const toggleTodo = (id) => {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            renderTodos();
        }
    };

    /**
     * Deletes a to-do item.
     * @param {string} id - The ID of the to-do item.
     */
    const deleteTodo = (id) => {
        todos = todos.filter(t => t.id !== id);
        renderTodos();
    };

    /**
     * Changes the priority of a to-do item.
     * @param {string} id - The ID of the to-do item.
     * @param {string} newPriority - The new priority value ('high', 'medium', 'low').
     */
    const changePriority = (id, newPriority) => {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            todo.priority = newPriority;
            renderTodos(); // Re-render to show the change
        }
    };

    /**
     * Archives all completed (but not yet archived) tasks.
     */
    const archiveCompletedTodos = () => {
        todos.forEach(todo => {
            if (todo.completed && !todo.archived) {
                todo.archived = true;
            }
        });
        renderTodos();
    };

    /**
     * Unarchives a single task, setting it back to 'completed'.
     * @param {string} id - The ID of the to-do item.
     */
    const unarchiveTodo = (id) => {
        const todo = todos.find(t => t.id === id);
        if (todo && todo.archived) {
            todo.archived = false;
            renderTodos();
        }
    };
    // --- Event Listeners ---

    // Filter button clicks
    if (filterButtons) {
        filterButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.status-filter-btn');
            if (button) {
                filterButtons.querySelectorAll('.status-filter-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.filter;
                renderTodos();
            }
        });
    }

    // To-do item clicks (toggle complete or delete)
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const todoItem = e.target.closest('.todo-item');
            if (!todoItem) return;
            
            // If an item is already being edited, do nothing until that edit is complete.
            if (listContainer.querySelector('.todo-item.editing')) {
                return;
            }

            const todoId = todoItem.dataset.id;

            // Prioritize specific button clicks first to prevent unintended actions.
            if (e.target.closest('.delete-todo-btn')) {
                e.preventDefault();
                deleteTodo(todoId);
            } else if (e.target.closest('.icon-container')) { // Corrected to use the new class name for the checkbox area
                toggleTodo(todoId);
            } else if (e.target.closest('h3')) { // Check if the text itself (or its container) was clicked
                editTodo(todoItem);
            } else if (e.target.closest('.priority-indicator')) {
                // Toggle the priority menu for this specific item
                const menu = todoItem.querySelector('.priority-menu');
                if (menu) menu.classList.toggle('show');
            } else if (e.target.closest('.priority-option')) {
                const newPriority = e.target.dataset.priorityValue;
                changePriority(todoId, newPriority);
                // The menu will be hidden by the re-render
            }
        });
    }



    // Archive button listener
    if (archiveCompletedBtn) {
        archiveCompletedBtn.addEventListener('click', archiveCompletedTodos);
    }

    // --- Initialization ---
    renderTodos();
});