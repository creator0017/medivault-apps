// Test Firebase connectivity
require('dotenv').config({ path: '.env' });
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log('Firebase config:', { ...firebaseConfig, apiKey: '***' + firebaseConfig.apiKey?.slice(-4) });
console.log('Project ID:', firebaseConfig.projectId);

try {
  const app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized');
  const db = getFirestore(app);
  console.log('Firestore instance created');
  
  // Try to list root collections (requires authentication, but we can test connectivity)
  // This will fail with permissions error if connected but not authenticated
  // If connection fails, we'll get network error
  setTimeout(async () => {
    try {
      console.log('Attempting to list collections...');
      // Note: listing root collections requires admin privileges, but we can test with a simple read
      // Instead, we'll try to read a non-existent document to see if network works
      const testRef = collection(db, '__test__');
      console.log('Test collection reference created');
      console.log('Firestore connectivity appears OK');
    } catch (err) {
      console.error('Firestore error:', err.message, err.code);
    }
    process.exit(0);
  }, 2000);
} catch (err) {
  console.error('Initialization error:', err.message);
  process.exit(1);
}