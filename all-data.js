const sampleAppointments = [];

const sampleTodos = [
    { id: 'todo-1', text: 'Follow up with customer #CUST-JOH4567', completed: true, createdAt: '2023-10-27T10:00:00Z' },
    { id: 'todo-2', text: 'Finish the design for the new promo banner', completed: false, createdAt: '2023-10-28T14:30:00Z' },
    { id: 'todo-3', text: 'Order more microfiber towels from supplier', completed: false, createdAt: '2023-10-28T16:00:00Z' },
    { id: 'todo-4', text: 'Review monthly sales report', completed: false, createdAt: '2023-10-28T09:00:00Z' },
];

const sampleWalkins = [
    { plate: "PWD 123", phone: "09175550001", carName: "Toyota Avanza", carType: "MPV", service: "Carwash (wash + armor all)", technician: "Mike Perez", status: "Completed", paymentStatus: "Paid", datetime: "Oct 28, 2025 - 10:00 AM", customerName: "Juan Dela Cruz" },
];

const sampleReviews = [
    // Reviews for Bisu Go
    { reviewId: "REV-001", transactionId: "TRN-231001", customer: "Angelo Reyes", service: "Ceramic Coating", rating: 5, comment: "Fantastic job! My car looks brand new. The attention to detail was impeccable.", date: "Oct 28, 2025", mediaUrl: "https://images.pexels.com/photos/2127740/pexels-photo-2127740.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", mediaType: "image", reply: "Thank you, Angelo! We're thrilled you're happy with the ceramic coating. We look forward to seeing you again!", amount: 18000, paymentMethod: "GCash" },
    { reviewId: "REV-002", transactionId: "TRN-231009", customer: "Liam Bautista", service: "Interior Detail (Standard)", rating: 4.5, comment: "Interior is clean and fresh. Great service.", date: "Oct 29, 2025", mediaUrl: null, mediaType: null, reply: null, amount: 5000, paymentMethod: "Cash" },
    // Reviews for Rey Ignacio
    { reviewId: "REV-003", transactionId: "TRN-231002", customer: "Bea Gonzales", service: "Interior Detail (Standard)", rating: 4, comment: "Very satisfied with the interior cleaning. Missed a small spot under the seat, but overall great work.", date: "Oct 28, 2025", mediaUrl: "https://images.pexels.com/photos/8987333/pexels-photo-8987333.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", mediaType: "image", reply: null, amount: 5500, paymentMethod: "PayMaya" },
    { reviewId: "REV-004", transactionId: "TRN-231010", customer: "Andrea Torres", service: "Carwash (wash + armor all)", rating: 5, comment: "Excellent and fast service. My car is sparkling.", date: "Oct 27, 2025", mediaUrl: null, mediaType: null, reply: null, amount: 180, paymentMethod: "Cash" },
    // Reviews for Robert Guerrero
    { reviewId: "REV-005", transactionId: "TRN-231003", customer: "Carlos Mercado", service: "Meguiar's Carnauba Wax w/ FREE Carwash", rating: 5, comment: "Quick, efficient, and a perfect wash. Will definitely be back.", date: "Oct 28, 2025", mediaUrl: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", mediaType: "video", reply: null, amount: 600, paymentMethod: "GCash" },
    // Reviews for Mike Perez
    { reviewId: "REV-006", transactionId: "TRN-231004", customer: "Sofia Navarro", service: "Carwash (wash + armor all)", rating: 4, comment: "Good wash for the price. The team was friendly.", date: "Oct 28, 2025", mediaUrl: null, mediaType: null, reply: null, amount: 250, paymentMethod: "Cash" },
    // Reviews for JP Gilbuena
    { reviewId: "REV-007", transactionId: "TRN-231005", customer: "David Lim", service: "Engine Wash", rating: 5, comment: "The engine bay is spotless. The technicians were very professional and careful.", date: "Oct 28, 2025", mediaUrl: "https://images.pexels.com/photos/457418/pexels-photo-457418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", mediaType: "image", reply: null, amount: 800, paymentMethod: "PayMaya" },
    // Reviews for Yuan Castillo
    { reviewId: "REV-008", transactionId: "TRN-231006", customer: "Isabella Garcia", service: "Full Package Detailing", rating: 4.5, comment: "My car feels like it just came out of the showroom. Amazing work!", date: "Oct 28, 2025", mediaUrl: null, mediaType: null, reply: null, amount: 12500, paymentMethod: "GCash" },
];

const servicesAndPricing = [
    { serviceId: "SVC-002", category: "Wash Services", service: "Carwash (wash + armor all)", small: 140, medium: 180,  notes: null, availability: "Available", visibility: "Visible", featured: true, imageUrl: "./banners/carwash.jpg", availed: 120 },
];

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
    },
    {
        promoId: "PROMO-002",
        title: "Interior Revival",
        description: "Deep clean and sanitize your car's interior for a fresh, like-new feel.",
        services: ["Interior Detail (Standard)", "MICROTEX BAC TO ZERO (anti-bacterial treatment)"],
        promoPrice: 4800,
        expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Expired 2 days ago
        imageUrl: "https://images.pexels.com/photos/709143/pexels-photo-709143.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", // Clean car interior
        status: "Expired"
    }
];

// --- Sample Media for Media Manager ---
const sampleMedia = [
    { id: "media-001", name: "shiny-red-car.jpeg", type: "image", url: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", size: "2.1 MB", dimensions: "1260x750" },
    { id: "media-002", name: "clean-interior.jpeg", type: "image", url: "https://images.pexels.com/photos/709143/pexels-photo-709143.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", size: "1.8 MB", dimensions: "1260x750" },
    { id: "media-003", name: "engine-bay.jpeg", type: "image", url: "https://images.pexels.com/photos/457418/pexels-photo-457418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", size: "1.5 MB", dimensions: "1260x750" },
    { id: "media-004", name: "ceramic-coating-apply.jpeg", type: "image", url: "https://images.pexels.com/photos/2127740/pexels-photo-2127740.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", size: "2.5 MB", dimensions: "1260x750" },
    { id: "media-005", name: "washing-process.mp4", type: "video", url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", size: "1.0 MB", dimensions: "1280x720" },
    { id: "media-006", name: "interior-vacuum.jpeg", type: "image", url: "https://images.pexels.com/photos/8987333/pexels-photo-8987333.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", size: "1.9 MB", dimensions: "1260x750" },
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
    {
        id: 'notif-002',
        type: 'New Review',
        message: 'You received a new <b>5-star review</b> from <b>Bea Gonzales</b>.',
        timestamp: '1 hour ago',
        isUnread: true,
        link: 'reviews.html'
    },
    {
        id: 'notif-003',
        type: 'Service Completed',
        message: 'Service for <b>Carlos Mercado</b> (Plate: PQR 9101) is now complete.',
        timestamp: '3 hours ago',
        isUnread: true,
        link: 'appointment.html'
    },
    {
        id: 'notif-004',
        type: 'Payment Received',
        message: 'Payment of <b>₱1,800</b> received from <b>Sofia Navarro</b> via GCash.',
        timestamp: 'Yesterday',
        isUnread: true,
        link: 'payment-monitoring.html'
    },
    {
        id: 'notif-005',
        type: 'New Booking',
        message: '<b>David Lim</b> booked an <b>Engine Wash</b>.',
        timestamp: 'Yesterday',
        isUnread: true,
        link: 'appointment.html'
    },
    {
        id: 'notif-006',
        type: 'Service Completed',
        message: 'Service for <b>Chloe Villanueva</b> is now complete.',
        timestamp: '2 days ago',
        isUnread: false,
        link: 'appointment.html'
    },
];

// --- Sample Reschedule Requests from Mobile App ---
const sampleRescheduleRequests = [
    { requestId: "REQ-001", serviceId: "KC-231001", customer: "Angelo Reyes", service: "Ceramic Coating", originalDatetime: "Oct 28, 2025 - 2:00 PM", reason: "Unexpected work meeting." },
    { requestId: "REQ-002", serviceId: "KC-231009", customer: "Liam Bautista", service: "Interior Detail (Standard)", originalDatetime: "Oct 29, 2025 - 9:30 AM", reason: "Family emergency." },
];

// --- Sample Technicians ---
const sampleTechnicians = [
    { id: 'TCH-000', name: 'Unassigned', status: 'System', tasks: 0, rating: 0, role: 'System' },
    { id: 'TCH-001', name: 'Bisu Go', status: 'Active', tasks: 3, rating: 4.8, role: 'Senior Technician' },
    { id: 'TCH-002', name: 'Rey Ignacio', status: 'Active', tasks: 5, rating: 4.9, role: 'Team Lead' },
    { id: 'TCH-003', name: 'Robert Guerrero', status: 'Active', tasks: 2, rating: 4.5, role: 'Detailing Technician' },
    { id: 'TCH-004', name: 'Mike Perez', status: 'Active', tasks: 4, rating: 4.7, role: 'Detailing Technician' },
    { id: 'TCH-005', name: 'Michael Domingo', status: 'On Leave', tasks: 0, rating: 4.2, role: 'Detailing Technician' },
    { id: 'TCH-006', name: 'JP Gilbuena', status: 'Active', tasks: 3, rating: 4.6, role: 'Senior Technician' },
    { id: 'TCH-007', name: 'Yuan Castillo', status: 'Active', tasks: 1, rating: 4.3, role: 'Trainee' },
    { id: 'TCH-008', name: 'Jay Ramirez', status: 'Active', tasks: 5, rating: 4.9, role: 'Team Lead' },
    { id: 'TCH-009', name: 'Ernest Del Mundo', status: 'Active', tasks: 2, rating: 4.8, role: 'Senior Technician' },
    { id: 'TCH-010', name: 'James Mendoza', status: 'Active', tasks: 4, rating: 4.7, role: 'Detailing Technician' }
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