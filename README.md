# MediVault — Secure Health Records App

A React Native (Expo SDK 54) mobile app for managing medical records securely.

## Features

- 🔐 **Dual-channel verification** (Phone OTP + Email OTP)
- 📋 **Medical report upload** (Image & PDF) with cloud storage
- 🤖 **AI-powered analysis** using Groq (Llama 3.3 70B)
- 🚨 **Emergency card** with QR code, PDF export & one-tap calling
- 👨‍👩‍👧‍👦 **Family Hub** for monitoring family members' health
- 📊 **Health score tracking** with trend analysis

## Tech Stack

- **Frontend:** React Native + Expo SDK 54
- **Backend:** Firebase (Auth, Firestore, Cloud Functions, Storage)
- **AI:** Groq (Llama 3.3 70B)
- **State:** React Context API

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root (see `.env.example`).

3. Start the app:
   ```bash
   npx expo start
   ```

4. Deploy Cloud Functions:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

## Project Structure

```
├── App.js                  # Root navigator
├── context/UserContext.js   # Global auth & user state
├── components/
│   ├── BottomTabBar.js      # Shared bottom navigation
│   ├── EditModal.js         # Cross-platform edit prompt
│   └── SideMenu.js          # Drawer navigation
├── screens/
│   ├── SplashScreen.js      # Animated splash
│   ├── OnboardingScreen.js  # 3-step onboarding
│   ├── LoginScreen.js       # Sign up / Sign in
│   ├── VerificationScreen.js# Dual OTP verification
│   ├── SuccessScreen.js     # Post-verification
│   ├── HomeScreen.js        # Main dashboard
│   ├── ProfileScreen.js     # Profile & settings
│   ├── EmergencyScreen.js   # Emergency medical card
│   ├── FamilyScreen.js      # Family monitoring hub
│   ├── AIDashboard.js       # AI report analysis
│   ├── ReportsScreen.js     # Report vault
│   └── UploadReportScreen.js# Upload reports
├── functions/index.js       # Cloud Functions (email OTP)
└── firebaseConfig.js        # Firebase initialization
```

## Security

- All API keys are stored in environment variables (`.env`)
- Firestore rules enforce user-scoped data access
- Dual-channel verification (phone + email) required for account activation
- Emergency data accessible via encrypted QR code

## License

Private — All rights reserved.
