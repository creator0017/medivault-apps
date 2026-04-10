// Test Firebase Authentication connectivity
require('dotenv').config({ path: '.env' });
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

async function runTests() {
  console.log('Testing Firebase Authentication configuration...');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Auth Domain:', firebaseConfig.authDomain);
  console.log('API Key (last 4):', '***' + (firebaseConfig.apiKey?.slice(-4) || ''));

  try {
    const app = initializeApp(firebaseConfig);
    console.log('✓ Firebase app initialized');
    const auth = getAuth(app);
    console.log('✓ Firebase Auth instance created');

    // Test 1: Try to sign in with a non-existent user
    // This should fail with "auth/user-not-found" if API key is valid
    const testEmail = 'test-nonexistent-user@example.com';
    const testPassword = 'wrongpassword123';
    
    console.log('\nTest 1: Testing sign-in with non-existent user...');
    try {
      await signInWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✗ Unexpected: Sign-in succeeded (should have failed)');
    } catch (error) {
      console.log('✓ Sign-in failed as expected');
      console.log('  Error code:', error.code);
      console.log('  Error message:', error.message);
      
      // Check if error indicates valid Firebase Auth connectivity
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        console.log('✓ Firebase Auth is reachable and API key is valid');
      } else if (error.code === 'auth/invalid-api-key') {
        console.log('✗ ERROR: Invalid API key');
        return 1;
      } else if (error.code === 'auth/network-request-failed') {
        console.log('✗ ERROR: Network request failed - check internet connection');
        return 1;
      } else {
        console.log('⚠ Unexpected error:', error.code);
      }
    }

    // Test 2: Test password reset email (commented out to avoid sending emails)
    // Uncomment to test password reset functionality
    /*
    console.log('\nTest 2: Testing password reset email...');
    try {
      await sendPasswordResetEmail(auth, testEmail);
      console.log('✓ Password reset email sent (check spam folder)');
    } catch (error) {
      console.log('✗ Password reset failed');
      console.log('  Error code:', error.code);
      console.log('  Error message:', error.message);
    }
    */

    console.log('\n✅ Firebase Authentication connectivity test completed');
    console.log('\nNext steps:');
    console.log('1. Ensure Email/Password provider is enabled in Firebase Console');
    console.log('2. Check that the sender email is verified in Firebase Console > Authentication > Templates');
    console.log('3. Verify API key restrictions in Google Cloud Console');
    
    return 0;
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
    console.error('Full error:', error);
    return 1;
  }
}

runTests().then(code => process.exit(code));