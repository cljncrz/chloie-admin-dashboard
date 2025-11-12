const sampleAppointments = [];

const sampleTodos = [
    { id: 'todo-1', text: 'Follow up with customer #CUST-JOH4567', completed: true, createdAt: '2023-10-27T10:00:00Z' }
];

const sampleWalkins = [];

const sampleReviews = [
    { reviewId: "REV-001", transactionId: "TRN-231001", customer: "Angelo Reyes", service: "Ceramic Coating", rating: 5, comment: "Fantastic job! My car looks brand new. The attention to detail was impeccable.", date: "Oct 28, 2025", mediaUrl: "https://images.pexels.com/photos/2127740/pexels-photo-2127740.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", mediaType: "image", reply: "Thank you, Angelo! We're thrilled you're happy with the ceramic coating. We look forward to seeing you again!", amount: 18000, paymentMethod: "GCash" }
];

const servicesAndPricing = [];

const samplePromotions = [
    {
        promoId: "PROMO-001",
        title: "Ultimate Shine Package",
        description: "Get a complete exterior refresh with our most popular services bundled together.",
        services: ["Carwash (wash + armor all)", "Meguiar's Carnauba Wax w/ FREE Carwash"],
        originalPrice: 790, // 140 (small) + 650 (medium) - example
        promoPrice: 650,
        expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 10 days
        imageUrl: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", // Shiny red car exterior
        status: "Active"
    }
];

// --- Sample Media for Media Manager ---
const sampleMedia = [
    { id: "media-001", name: "shiny-red-car.jpeg", type: "image", url: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", size: "2.1 MB", dimensions: "1260x750" }
];

// --- Sample Notifications ---
const sampleNotifications = [
    {
        id: 'notif-001',
        type: 'New Booking',
        message: '<b>Angelo Reyes</b> just booked a <b>Ceramic Coating</b> service.',
        timestamp: '15 minutes ago',
        isUnread: true,
        link: 'appointment.html'
    },
];

// --- Sample Reschedule Requests from Mobile App ---
const sampleRescheduleRequests = [
    { requestId: "REQ-001", serviceId: "KC-231001", customer: "Angelo Reyes", service: "Ceramic Coating", originalDatetime: "Oct 28, 2025 - 2:00 PM", reason: "Unexpected work meeting." }
];

// --- Sample Technicians ---
const sampleTechnicians = [
    { id: 'TCH-000', name: 'Unassigned', status: 'System', tasks: 0, rating: 0, role: 'System' }
];

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