// Test Firebase Password Reset functionality
require('dotenv').config({ path: '.env' });
const { initializeApp } = require('firebase/app');
const { getAuth, sendPasswordResetEmail } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

async function runTest() {
  console.log('Testing Firebase Password Reset...');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Auth Domain:', firebaseConfig.authDomain);

  try {
    const app = initializeApp(firebaseConfig);
    console.log('✓ Firebase app initialized');
    const auth = getAuth(app);
    console.log('✓ Firebase Auth instance created');

    // Use a dummy email that likely doesn't exist
    // Firebase will still attempt to send email if email/password provider is enabled
    const testEmail = 'test-dummy-' + Date.now() + '@example.com';
    
    console.log('\nAttempting to send password reset email to:', testEmail);
    console.log('(This will not actually send since email doesn\'t exist, but tests provider)');
    
    try {
      await sendPasswordResetEmail(auth, testEmail);
      console.log('✓ Password reset email sent (or attempted)');
      console.log('Note: If email doesn\'t exist, Firebase may still return success');
      console.log('Check Firebase Console > Authentication > Templates for email configuration');
    } catch (error) {
      console.log('✗ Password reset failed');
      console.log('  Error code:', error.code);
      console.log('  Error message:', error.message);
      
      if (error.code === 'auth/invalid-email') {
        console.log('  Issue: Invalid email format');
      } else if (error.code === 'auth/user-not-found') {
        console.log('  Note: User not found, but email/password provider is enabled');
        console.log('  This is expected for non-existent email');
      } else if (error.code === 'auth/operation-not-allowed') {
        console.log('  CRITICAL: Email/Password provider is not enabled in Firebase Console');
        console.log('  Please enable Email/Password sign-in in Firebase Console > Authentication > Sign-in method');
      } else if (error.code === 'auth/network-request-failed') {
        console.log('  Network error - check internet connection');
      } else {
        console.log('  Unknown error - check Firebase configuration');
      }
    }

    console.log('\n✅ Password reset test completed');
    return 0;
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
    return 1;
  }
}

runTest().then(code => process.exit(code));