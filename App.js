import { NavigationContainer } from "@react-navigation/native";
import {
  CardStyleInterpolators,
  createStackNavigator,
} from "@react-navigation/stack";
import "react-native-gesture-handler";
import { ActivityIndicator, View } from "react-native";

import { UserProvider, useUser } from "./context/UserContext";

// --- IMPORT ALL SCREENS ---
import AIDashboard from "./screens/AIDashboard";
import EmergencyScreen from "./screens/EmergencyScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ReportsScreen from "./screens/ReportsScreen";
import SplashScreen from "./screens/SplashScreen";
import SuccessScreen from "./screens/SuccessScreen";
import UploadReportScreen from "./screens/UploadReportScreen";
import VerificationScreen from "./screens/VerificationScreen";
import FamilyScreen from "./screens/FamilyScreen";

const Stack = createStackNavigator();

function AppNavigator() {
  const { user, loading } = useUser();

  // Show a loading screen while Firebase checks if the user is already logged in
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#2E75B6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        {!user ? (
          // --- AUTH & ONBOARDING FLOW ---
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Verification" component={VerificationScreen} />
            <Stack.Screen name="Success" component={SuccessScreen} />
          </>
        ) : (
          // --- MAIN APP FLOW ---
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen
              name="Family"
              component={FamilyScreen}
              options={{
                cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
              }}
            />
            <Stack.Screen name="AI" component={AIDashboard} />
            <Stack.Screen name="Emergency" component={EmergencyScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="UploadReport" component={UploadReportScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppNavigator />
    </UserProvider>
  );
}
