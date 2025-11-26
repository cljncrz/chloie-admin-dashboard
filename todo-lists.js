document.addEventListener('DOMContentLoaded', () => {
    // Only run this script on the todo-lists.html page
    const todoPageContainer = document.querySelector('.todo-list-page-container');
    if (!todoPageContainer) {
        return;
    }

    // Wait for Firebase to be ready and get db
    const waitForFirebase = async () => {
        if (window.firebaseInitPromise) await window.firebaseInitPromise;
        if (!window.firebase || !window.firebase.firestore) throw new Error('Firebase not loaded');
        return window.firebase.firestore();
    };

    (async () => {
        const db = await waitForFirebase();

        // --- DOM Elements ---
        const listContainer = document.getElementById('full-todo-list');
        const filterButtons = document.getElementById('todo-filter-buttons');
        const noResultsMessage = listContainer.querySelector('.no-results-row');
        const archiveCompletedBtn = document.getElementById('archive-completed-btn');

        // --- State ---
        let todos = [];
        let currentFilter = 'all';
        let unsubscribe = null; // For Firestore listener cleanup

        // --- Firebase Reference ---
        const todosCollection = db.collection('todos');

        // --- Functions ---
        // Admin/debug: Render all todos in a table
        const renderAdminTable = () => {
            const tableBody = document.getElementById('todo-admin-table-body');
            if (!tableBody) return;
            if (!todos.length) {
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No to-dos found.</td></tr>';
                return;
            }
            tableBody.innerHTML = todos.map(todo => {
                const createdAt = todo.createdAt && todo.createdAt.toDate ? todo.createdAt.toDate() : todo.createdAt;
                const createdAtStr = createdAt ? new Date(createdAt).toLocaleString() : '';
                return `<tr>
                    <td>${todo.id || ''}</td>
                    <td>${todo.text || ''}</td>
                    <td>${todo.dueDate || ''}</td>
                    <td>${todo.dueTime || ''}</td>
                    <td>${todo.priority || ''}</td>
                    <td>${todo.completed ? 'Yes' : 'No'}</td>
                    <td>${todo.archived ? 'Yes' : 'No'}</td>
                    <td>${createdAtStr}</td>
                </tr>`;
            }).join('');
        };

        // Render a single to-do by ID
        const renderSingleTodo = (todo) => {
            const tableBody = document.getElementById('single-todo-table-body');
            if (!tableBody) return;
            if (!todo) {
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Not found.</td></tr>';
                return;
            }
            const createdAt = todo.createdAt && todo.createdAt.toDate ? todo.createdAt.toDate() : todo.createdAt;
            const createdAtStr = createdAt ? new Date(createdAt).toLocaleString() : '';
            tableBody.innerHTML = `<tr>
                <td>${todo.id || ''}</td>
                <td>${todo.text || ''}</td>
                <td>${todo.dueDate || ''}</td>
                <td>${todo.dueTime || ''}</td>
                <td>${todo.priority || ''}</td>
                <td>${todo.completed ? 'Yes' : 'No'}</td>
                <td>${todo.archived ? 'Yes' : 'No'}</td>
                <td>${createdAtStr}</td>
            </tr>`;
        };

        const renderTodos = () => {
            // ...existing code...
        };

        const loadTodos = () => {
            // Set up real-time listener for all todos
            unsubscribe = todosCollection.onSnapshot((snapshot) => {
                todos = [];
                snapshot.forEach((doc) => {
                    todos.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                renderTodos();
                renderAdminTable();
            }, (error) => {
                console.error('Error loading todos:', error);
                if (typeof showToast === 'function') {
                    showToast('Error loading to-do items', 'error');
                }
            });

            // Load single to-do by ID
            todosCollection.doc('qIshukpehkObhzgsemRQ').get().then(doc => {
                if (doc.exists) {
                    renderSingleTodo({ id: doc.id, ...doc.data() });
                } else {
                    renderSingleTodo(null);
                }
            }).catch(() => renderSingleTodo(null));
        };

        // ...other functions (editTodo, toggleTodo, deleteTodo, changePriority, archiveCompletedTodos, unarchiveTodo)...

        // --- Event Listeners ---
        if (filterButtons) {
            filterButtons.addEventListener('click', (e) => {
                // Only run this script on the todo-lists.html page
                const todoPageContainer = document.querySelector('.todo-list-page-container');
                if (!todoPageContainer) {
                    return;
                }

                // Wait for Firebase to be ready and get db
                const waitForFirebase = async () => {
                    if (window.firebaseInitPromise) await window.firebaseInitPromise;
                    if (!window.firebase || !window.firebase.firestore) throw new Error('Firebase not loaded');
                    return window.firebase.firestore();
                };

                (async () => {
                    const db = await waitForFirebase();

                    // --- DOM Elements ---
                    const listContainer = document.getElementById('full-todo-list');
                    const filterButtons = document.getElementById('todo-filter-buttons');
                    const noResultsMessage = listContainer.querySelector('.no-results-row');
                    const archiveCompletedBtn = document.getElementById('archive-completed-btn');

                    // --- State ---
                    let todos = [];
                    let currentFilter = 'all';
                    let unsubscribe = null; // For Firestore listener cleanup

                    // --- Firebase Reference ---
                    const todosCollection = db.collection('todos');

                    // --- Functions ---
                    // ...existing code...

                    // --- Event Listeners ---
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
                    if (listContainer) {
                        listContainer.addEventListener('click', (e) => {
                            const todoItem = e.target.closest('.todo-item');
                            if (!todoItem) return;
                            if (listContainer.querySelector('.todo-item.editing')) {
                                return;
                            }
                            const todoId = todoItem.dataset.id;
                            if (e.target.closest('.delete-todo-btn')) {
                                e.preventDefault();
                                deleteTodo(todoId);
                            } else if (e.target.closest('.unarchive-todo-btn')) {
                                e.preventDefault();
                                unarchiveTodo(todoId);
                            } else if (e.target.closest('.icon-container')) {
                                toggleTodo(todoId);
                            } else if (e.target.closest('h3')) {
                                editTodo(todoItem);
                            } else if (e.target.closest('.priority-indicator')) {
                                const menu = todoItem.querySelector('.priority-menu');
                                if (menu) menu.classList.toggle('show');
                            } else if (e.target.closest('.priority-option')) {
                                const newPriority = e.target.dataset.priorityValue;
                                changePriority(todoId, newPriority);
                            }
                        });
                    }
                    if (archiveCompletedBtn) {
                        archiveCompletedBtn.addEventListener('click', archiveCompletedTodos);
                    }
                    window.addEventListener('beforeunload', () => {
                        if (unsubscribe) {
                            unsubscribe();
                        }
                    });
                    loadTodos();
                })();

    /**
     * Loads todos from Firestore with real-time updates
     */
    const loadTodos = () => {
        // Set up real-time listener
        unsubscribe = todosCollection.onSnapshot((snapshot) => {
            todos = [];
            snapshot.forEach((doc) => {
                todos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            renderTodos();
            renderAdminTable();
        }, (error) => {
            console.error('Error loading todos:', error);
            if (typeof showToast === 'function') {
                showToast('Error loading to-do items', 'error');
            }
        });
    };

    /**
     * Adds a new to-do item to Firestore.
     * @param {string} text - The text of the to-do item.
     * @param {string|null} dueDate - The optional due date.
     * @param {string|null} dueTime - The optional due time.
     * @param {string} priority - The priority of the task ('low', 'medium', 'high').
     */
    window.addTodoItem = async (text, dueDate, dueTime, priority) => {
        try {
            const newTodo = {
                text: text,
                completed: false,
                dueDate: dueDate || null,
                dueTime: dueTime || null,
                archived: false,
                priority: priority || 'medium',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            await todosCollection.add(newTodo);
            console.log('Todo added successfully');
        } catch (error) {
            console.error('Error adding todo:', error);
            if (typeof showToast === 'function') {
                showToast('Error adding to-do item', 'error');
            }
            throw error;
        }
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

        const saveChanges = async () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                try {
                    await todosCollection.doc(todoId).update({
                        text: newText
                    });
                } catch (error) {
                    console.error('Error updating todo:', error);
                    if (typeof showToast === 'function') {
                        showToast('Error updating to-do item', 'error');
                    }
                }
            }
            // Remove editing class
            todoItemEl.classList.remove('editing');
        };

        // Event listener for when the input loses focus
        input.addEventListener('blur', saveChanges);

        // Event listener for Enter or Escape keys
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveChanges();
            } else if (e.key === 'Escape') {
                todoItemEl.classList.remove('editing');
                renderTodos(); // Just re-render to cancel, no data change
            }
        });
    };

    /**
     * Toggles the completed state of a to-do item in Firestore.
     * @param {string} id - The ID of the to-do item.
     */
    const toggleTodo = async (id) => {
        try {
            const todo = todos.find(t => t.id === id);
            if (todo) {
                await todosCollection.doc(id).update({
                    completed: !todo.completed
                });
            }
        } catch (error) {
            console.error('Error toggling todo:', error);
            if (typeof showToast === 'function') {
                showToast('Error updating to-do item', 'error');
            }
        }
    };

    /**
     * Deletes a to-do item from Firestore.
     * @param {string} id - The ID of the to-do item.
     */
    const deleteTodo = async (id) => {
        try {
            await todosCollection.doc(id).delete();
            if (typeof showToast === 'function') {
                showToast('To-do item deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting todo:', error);
            if (typeof showToast === 'function') {
                showToast('Error deleting to-do item', 'error');
            }
        }
    };

    /**
     * Changes the priority of a to-do item in Firestore.
     * @param {string} id - The ID of the to-do item.
     * @param {string} newPriority - The new priority value ('high', 'medium', 'low').
     */
    const changePriority = async (id, newPriority) => {
        try {
            await todosCollection.doc(id).update({
                priority: newPriority
            });
        } catch (error) {
            console.error('Error changing priority:', error);
            if (typeof showToast === 'function') {
                showToast('Error updating priority', 'error');
            }
        }
    };

    /**
     * Archives all completed (but not yet archived) tasks in Firestore.
     */
    const archiveCompletedTodos = async () => {
        try {
            const batch = db.batch();
            todos.forEach(todo => {
                if (todo.completed && !todo.archived) {
                    const todoRef = todosCollection.doc(todo.id);
                    batch.update(todoRef, { archived: true });
                }
            });
            await batch.commit();
            if (typeof showToast === 'function') {
                showToast('Completed tasks archived', 'success');
            }
        } catch (error) {
            console.error('Error archiving todos:', error);
            if (typeof showToast === 'function') {
                showToast('Error archiving tasks', 'error');
            }
        }
    };

    /**
     * Unarchives a single task, setting it back to 'completed' in Firestore.
     * @param {string} id - The ID of the to-do item.
     */
    const unarchiveTodo = async (id) => {
        try {
            await todosCollection.doc(id).update({
                archived: false
            });
            if (typeof showToast === 'function') {
                showToast('Task unarchived', 'success');
            }
        } catch (error) {
            console.error('Error unarchiving todo:', error);
            if (typeof showToast === 'function') {
                showToast('Error unarchiving task', 'error');
            }
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

    // To-do item clicks (toggle complete, delete, edit, etc.)
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
            } else if (e.target.closest('.unarchive-todo-btn')) {
                e.preventDefault();
                unarchiveTodo(todoId);
            } else if (e.target.closest('.icon-container')) {
                toggleTodo(todoId);
            } else if (e.target.closest('h3')) {
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

    // --- Cleanup on page unload ---
    window.addEventListener('beforeunload', () => {
        if (unsubscribe) {
            unsubscribe();
        }
    });

    // --- Initialization ---
    loadTodos();
    }); // End async IIFE
}); // End DOMContentLoaded