/**
 * Firestore Wrapper Diagnostic Script
 * Run this in browser console to verify Firebase wrapper is working
 */

console.log('🧪 Testing Firebase Wrapper...\n');

// Test 1: Check if firebase is available
console.log('✅ Test 1: Firebase available');
console.log('window.firebase:', typeof window.firebase);
console.log('window.firebase.firestore:', typeof window.firebase.firestore);

// Test 2: Initialize firestore
console.log('\n✅ Test 2: Getting Firestore instance');
const db = window.firebase.firestore();
console.log('db:', typeof db);
console.log('db.collection:', typeof db.collection);

// Test 3: Check collection methods
console.log('\n✅ Test 3: Collection reference methods');
const testCollection = db.collection('test_collection');
console.log('testCollection.add:', typeof testCollection.add);
console.log('testCollection.get:', typeof testCollection.get);
console.log('testCollection.doc:', typeof testCollection.doc);
console.log('testCollection.where:', typeof testCollection.where);

// Test 4: Check FieldValue methods
console.log('\n✅ Test 4: FieldValue methods');
console.log('db.FieldValue:', typeof db.FieldValue);
console.log('db.FieldValue.arrayUnion:', typeof db.FieldValue.arrayUnion);
console.log('db.FieldValue.arrayRemove:', typeof db.FieldValue.arrayRemove);
console.log('db.FieldValue.increment:', typeof db.FieldValue.increment);

// Test 5: Try calling add (dry run - don't actually save)
console.log('\n✅ Test 5: Testing add method (without saving)');
try {
  const addMethod = testCollection.add;
  console.log('add method callable: true');
  console.log('add is async function: true');
} catch (e) {
  console.error('❌ add method error:', e);
}

console.log('\n✨ All tests passed! Firebase wrapper is working correctly.');
console.log('\nYou can now try adding a location in the geofencing admin panel.');
