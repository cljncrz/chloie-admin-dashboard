document.addEventListener('DOMContentLoaded', () => {
    const addToDoForm = document.getElementById('add-todo-form');

    if (addToDoForm) {
        addToDoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const todoTextInput = document.getElementById('todo-text');
            const todoDueDateInput = document.getElementById('todo-due-date');
            const todoDueTimeInput = document.getElementById('todo-due-time');
            const todoPriorityInput = document.getElementById('todo-priority');

            // Validate that task description is not empty
            if (!todoTextInput.value.trim()) {
                if (typeof showToast === 'function') {
                    showToast('Please enter a task description.', 'error');
                } else {
                    alert('Please enter a task description.');
                }
                return;
            }

            try {
                // Add the new to-do item to Firestore
                const newTodo = {
                    text: todoTextInput.value.trim(),
                    dueDate: todoDueDateInput.value || null,
                    dueTime: todoDueTimeInput.value || null,
                    priority: todoPriorityInput.value || 'medium',
                    completed: false,
                    archived: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('todos').add(newTodo);

                // Show success message
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('New to-do item added!');
                } else if (typeof showToast === 'function') {
                    showToast('New to-do item added!', 'success');
                }

                // Redirect back to the to-do list page
                setTimeout(() => {
                    window.location.href = 'todo-lists.html';
                }, 1000);
            } catch (error) {
                console.error('Error adding to-do:', error);
                if (typeof showToast === 'function') {
                    showToast('Error adding to-do item. Please try again.', 'error');
                } else {
                    alert('Error adding to-do item. Please try again.');
                }
            }
        });
    }
});
