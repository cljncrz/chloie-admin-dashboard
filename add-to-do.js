document.addEventListener('DOMContentLoaded', () => {
    const addToDoForm = document.getElementById('add-todo-form');

    if (addToDoForm) {
        addToDoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const todoTextInput = document.getElementById('todo-text');
            const todoDueDateInput = document.getElementById('todo-due-date');
            const todoDueTimeInput = document.getElementById('todo-due-time');
            const todoPriorityInput = document.getElementById('todo-priority');

            // Validate that task description is not empty
            if (typeof validateForm === 'function' && !validateForm([todoTextInput], 'Please enter a task description.')) {
                return;
            }

            // Add the new to-do item
            if (typeof window.addTodoItem === 'function') {
                window.addTodoItem(
                    todoTextInput.value.trim(),
                    todoDueDateInput.value,
                    todoDueTimeInput.value,
                    todoPriorityInput.value
                );
            }

            // Show success message
            if (typeof showSuccessToast === 'function') {
                showSuccessToast('New to-do item added!');
            }

            // Redirect back to the to-do list page
            setTimeout(() => {
                window.location.href = 'todo-lists.html';
            }, 1000);
        });
    }
});
