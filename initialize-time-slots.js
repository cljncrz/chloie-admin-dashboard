/**
 * Initialize Time Slots Configuration in Firebase
 * 
 * This script sets up the time_slots_config collection with default time slots.
 * Run this once to initialize the system, or use the Time Slots Settings page in the admin dashboard.
 */

// Initialize Firebase (adjust with your config)
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const defaultTimeSlots = [
  { id: '1', start: "8:20 AM", end: "9:20 AM", isActive: true },
  { id: '2', start: "9:20 AM", end: "10:20 AM", isActive: true },
  { id: '3', start: "10:20 AM", end: "11:20 AM", isActive: true },
  { id: '4', start: "11:20 AM", end: "12:10 PM", isActive: true },
  { id: '5', start: "12:10 PM", end: "1:00 PM", isActive: true },
  { id: '6', start: "1:20 PM", end: "2:20 PM", isActive: true },
  { id: '7', start: "2:20 PM", end: "3:20 PM", isActive: true },
  { id: '8', start: "3:50 PM", end: "4:50 PM", isActive: true },
  { id: '9', start: "4:50 PM", end: "5:50 PM", isActive: true },
  { id: '10', start: "5:50 PM", end: "6:50 PM", isActive: true },
  { id: '11', start: "6:50 PM", end: "7:50 PM", isActive: true },
  { id: '12', start: "7:50 PM", end: "8:50 PM", isActive: true }
];

async function initializeTimeSlots() {
  try {
    console.log('🚀 Initializing time slots configuration...');
    
    await db.collection('time_slots_config').doc('slots').set({
      slots: defaultTimeSlots,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      version: '1.0'
    });
    
    console.log('✅ Time slots initialized successfully!');
    console.log(`📊 Created ${defaultTimeSlots.length} default time slots`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing time slots:', error);
    process.exit(1);
  }
}

initializeTimeSlots();
