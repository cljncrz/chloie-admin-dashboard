#!/usr/bin/env node

/**
 * Test Script: Admin Notification Cloud Functions
 * 
 * This script tests the three Cloud Functions that create admin notifications:
 * 1. onNewPendingBooking
 * 2. onNewRescheduleRequest
 * 3. onBookingCancelled
 * 
 * Run this after deploying Cloud Functions to verify they work correctly.
 * 
 * Usage:
 *   node test-cloud-functions.js
 * 
 * Prerequisites:
 *   - Firebase project initialized
 *   - Firestore security rules allow test writes
 *   - Cloud Functions deployed
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let serviceAccount = null;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
        serviceAccount = require(serviceAccountPath);
    }
} catch (e) {
    console.error('❌ Cannot initialize Firebase. Please ensure firebase-service-account.json exists or FIREBASE_SERVICE_ACCOUNT env var is set');
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPendingBooking() {
    console.log('\n📅 TEST 1: Pending Booking Notification');
    console.log('─'.repeat(60));

    try {
        const bookingId = `test-pending-booking-${timestamp}`;
        const bookingData = {
            status: 'Pending',
            customer: 'Test Customer 1',
            customerName: 'Test Customer 1',
            service: 'Premium Wash',
            serviceNames: 'Premium Wash',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        };

        console.log(`➕ Creating pending booking: ${bookingId}`);
        console.log('   Data:', JSON.stringify(bookingData, null, 2));

        await db.collection('bookings').doc(bookingId).set(bookingData);
        console.log('✅ Booking created');

        // Wait for Cloud Function to process
        console.log('⏳ Waiting 5 seconds for Cloud Function to process...');
        await delay(5000);

        // Check for notification
        const notifications = await db.collection('notifications')
            .where('data.action', '==', 'pending_booking')
            .where('data.itemId', '==', bookingId)
            .get();

        if (!notifications.empty) {
            console.log('✅ Admin notification created successfully!');
            const notif = notifications.docs[0].data();
            console.log('   Title:', notif.title);
            console.log('   Message:', notif.body);
            console.log('   Read:', notif.read);
            return true;
        } else {
            console.log('⚠️  No notification found. Cloud Function may not have triggered.');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testRescheduleRequest() {
    console.log('\n🔄 TEST 2: Reschedule Request Notification');
    console.log('─'.repeat(60));

    try {
        const requestId = `test-reschedule-${timestamp}`;
        const requestData = {
            status: 'Pending',
            customerName: 'Test Customer 2',
            customer: 'Test Customer 2',
            serviceName: 'Interior Detailing',
            service: 'Interior Detailing',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        };

        console.log(`➕ Creating reschedule request: ${requestId}`);
        console.log('   Data:', JSON.stringify(requestData, null, 2));

        await db.collection('rescheduleRequests').doc(requestId).set(requestData);
        console.log('✅ Reschedule request created');

        // Wait for Cloud Function to process
        console.log('⏳ Waiting 5 seconds for Cloud Function to process...');
        await delay(5000);

        // Check for notification
        const notifications = await db.collection('notifications')
            .where('data.action', '==', 'reschedule_request')
            .where('data.itemId', '==', requestId)
            .get();

        if (!notifications.empty) {
            console.log('✅ Admin notification created successfully!');
            const notif = notifications.docs[0].data();
            console.log('   Title:', notif.title);
            console.log('   Message:', notif.body);
            console.log('   Read:', notif.read);
            return true;
        } else {
            console.log('⚠️  No notification found. Cloud Function may not have triggered.');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testCancellation() {
    console.log('\n❌ TEST 3: Booking Cancellation Notification');
    console.log('─'.repeat(60));

    try {
        const bookingId = `test-cancel-booking-${timestamp}`;
        
        // First create a confirmed booking
        console.log(`➕ Creating confirmed booking: ${bookingId}`);
        await db.collection('bookings').doc(bookingId).set({
            status: 'Confirmed',
            customer: 'Test Customer 3',
            customerName: 'Test Customer 3',
            service: 'Full Detail',
            serviceNames: 'Full Detail',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        });
        console.log('✅ Booking created');

        // Wait a moment
        await delay(2000);

        // Now cancel it
        console.log(`🔴 Cancelling booking: ${bookingId}`);
        await db.collection('bookings').doc(bookingId).update({
            status: 'Cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Booking cancelled');

        // Wait for Cloud Function to process
        console.log('⏳ Waiting 5 seconds for Cloud Function to process...');
        await delay(5000);

        // Check for notification
        const notifications = await db.collection('notifications')
            .where('data.action', '==', 'appointment_cancelled')
            .where('data.itemId', '==', bookingId)
            .get();

        if (!notifications.empty) {
            console.log('✅ Admin notification created successfully!');
            const notif = notifications.docs[0].data();
            console.log('   Title:', notif.title);
            console.log('   Message:', notif.body);
            console.log('   Read:', notif.read);
            return true;
        } else {
            console.log('⚠️  No notification found. Cloud Function may not have triggered.');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testDeduplication() {
    console.log('\n🔀 TEST 4: Deduplication Check');
    console.log('─'.repeat(60));

    try {
        const bookingId = `test-dedup-booking-${timestamp}`;

        // Create first booking
        console.log(`➕ Creating first pending booking: ${bookingId}`);
        await db.collection('bookings').doc(bookingId).set({
            status: 'Pending',
            customer: 'Test Customer 4',
            customerName: 'Test Customer 4',
            service: 'Standard Wash',
            serviceNames: 'Standard Wash',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        });

        // Wait for first notification
        console.log('⏳ Waiting 5 seconds for first notification...');
        await delay(5000);

        let notifs = await db.collection('notifications')
            .where('data.action', '==', 'pending_booking')
            .where('data.itemId', '==', bookingId)
            .get();

        const firstNotifCount = notifs.size;
        console.log(`✅ First notification created: ${firstNotifCount} notification(s)`);

        // Update booking (trigger listener again)
        console.log(`🔄 Updating booking (minor change)...`);
        await db.collection('bookings').doc(bookingId).update({
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Wait again
        console.log('⏳ Waiting 5 seconds to check for duplicate...');
        await delay(5000);

        notifs = await db.collection('notifications')
            .where('data.action', '==', 'pending_booking')
            .where('data.itemId', '==', bookingId)
            .get();

        const finalNotifCount = notifs.size;

        if (firstNotifCount === finalNotifCount) {
            console.log(`✅ Deduplication working! Notification count stayed at: ${finalNotifCount}`);
            return true;
        } else {
            console.log(`⚠️  Possible duplicate! Notification count changed from ${firstNotifCount} to ${finalNotifCount}`);
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('═'.repeat(60));
    console.log('🧪 CLOUD FUNCTIONS TEST SUITE');
    console.log('═'.repeat(60));

    const results = [];

    results.push(await testPendingBooking());
    results.push(await testRescheduleRequest());
    results.push(await testCancellation());
    results.push(await testDeduplication());

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(60));

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    if (passed === total) {
        console.log('\n🎉 All tests passed! Cloud Functions are working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check Cloud Functions logs:');
        console.log('   firebase functions:log --follow');
    }

    process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
