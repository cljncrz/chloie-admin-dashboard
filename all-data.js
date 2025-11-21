const sampleAppointments = [];

const sampleTodos = [];

const sampleWalkins = [];

const sampleReviews = [];

const servicesAndPricing = [];

const samplePromotions = [];

// --- Sample Media for Media Manager ---
const sampleMedia = [];

// --- Sample Notifications ---
const sampleNotifications = [];

// --- Sample Reschedule Requests from Mobile App ---
const sampleRescheduleRequests = [];

// --- Sample Technicians ---
const sampleTechnicians = [];

// Expose data globally through the appData object for consistent access
window.appData = window.appData || {}; // This line is already here, just for context
window.appData.appointments = sampleAppointments;
window.appData.walkins = sampleWalkins;
window.appData.reviews = sampleReviews;
window.appData.services = servicesAndPricing;
window.appData.promotions = samplePromotions;
window.appData.media = sampleMedia;
window.appData.notifications = sampleNotifications;
window.appData.rescheduleRequests = sampleRescheduleRequests;
window.appData.customers = window.mobileCustomers || []; // Use the globally defined mobileCustomers from customer-data.js
window.appData.technicians = sampleTechnicians;
window.appData.todos = sampleTodos;

// --- Helper function to create technician dropdowns ---
window.appData.createTechnicianDropdown = (selectedTechnician) => {
    const technicians = window.appData.technicians || [];
    let options = technicians.map(tech => 
        `<option value="${tech.name}" ${tech.name === selectedTechnician ? 'selected' : ''}>${tech.name}</option>`
    ).join('');
    return `<select class="technician-select">${options}</select>`;
};

/**
 * Robustly parses the custom datetime string from your data file.
 * Format: "Oct 28, 2025 - 2:00 PM"
 * @param {string} dateTimeString - The date string to parse.
 * @returns {Date|null} A Date object or null if parsing fails.
 */
window.appData.parseCustomDate = (dateTimeString) => {
    if (!dateTimeString) return null;
    const date = new Date(dateTimeString.replace(' - ', ' '));
    return isNaN(date) ? null : date;
};