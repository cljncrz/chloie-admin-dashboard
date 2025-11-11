/**
 * This script handles global UI updates that need to run on every page,
 * such as updating notification badges.
 */
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Updates the unread message count badge on the header chat icon.
     * This function simulates unread messages based on the customer list for demonstration.
     * In a real application, this data would come from a live data source.
     */
    const updateGlobalChatBadge = () => {
        const customers = window.appData.customers || [];
        // This is a simulation of unread chats. We'll consider a chat "unread"
        // if the customer's phone number ends in an odd digit for this demo.
        const unreadCount = customers.filter(c => parseInt(c.phone.slice(-1)) % 2 !== 0).length;

        const badge = document.getElementById('chat-message-count');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    };

    // Run the function on page load.
    updateGlobalChatBadge();

    /**
     * Automatically updates the "Last Updated" date in the footer.
     */
    const updateFooterDate = () => {
        const footerDateEl = document.querySelector('.footer-last-updated');
        if (footerDateEl) {
            const today = new Date();
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const formattedDate = today.toLocaleDateString('en-US', options);
            footerDateEl.textContent = `Last Updated: ${formattedDate}`;
        }
    };

    // Run the footer date update on page load.
    updateFooterDate();
});