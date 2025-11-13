const sampleAppointments = [];

const sampleTodos = [
    { id: 'todo-1', text: 'Follow up with customer #CUST-JOH4567', completed: true, createdAt: '2023-10-27T10:00:00Z' }
];

const sampleWalkins = [];

const sampleReviews = [
    { reviewId: "REV-001", transactionId: "TRN-231001", customer: "Angelo Reyes", service: "Ceramic Coating", rating: 5, comment: "Fantastic job! My car looks brand new. The attention to detail was impeccable.", date: "Oct 28, 2025", mediaUrl: "https://images.pexels.com/photos/2127740/pexels-photo-2127740.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", mediaType: "image", reply: "Thank you, Angelo! We're thrilled you're happy with the ceramic coating. We look forward to seeing you again!", amount: 18000, paymentMethod: "GCash" }
];

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