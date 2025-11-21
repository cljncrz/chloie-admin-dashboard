// Sidebar resizer drag logic
// This script enables drag-to-resize for the sidebar using the .sidebar-resizer handle
(function() {
    const aside = document.querySelector('aside');
    const resizer = document.querySelector('.sidebar-resizer');
    if (!aside || !resizer) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = aside.offsetWidth;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        let newWidth = startWidth + (e.clientX - startX);
        newWidth = Math.max(180, Math.min(350, newWidth)); // Clamp width
        aside.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
        }
    });
})();
