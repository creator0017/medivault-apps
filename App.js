import { NavigationContainer } from "@react-navigation/native";
import {
  CardStyleInterpolators,
  createStackNavigator,
} from "@react-navigation/stack";
import { ActivityIndicator, View } from "react-native";
import "react-native-gesture-handler";

import { ThemeProvider } from "./context/ThemeContext";
import { UserProvider, useUser } from "./context/UserContext";

// --- IMPORT ALL SCREENS ---
import AIDashboard from "./screens/AIDashboard";
import EmergencyScreen from "./screens/EmergencyScreen";
import FamilyScreen from "./screens/FamilyScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ReportsScreen from "./screens/ReportsScreen";
import ReportViewerScreen from "./screens/ReportViewerScreen";
import SplashScreen from "./screens/SplashScreen";
import SuccessScreen from "./screens/SuccessScreen";
import UploadReportScreen from "./screens/UploadReportScreen";
import VerificationScreen from "./screens/VerificationScreen";

import AIChatScreen from "./screens/AIChartsScreen"; const AIChartsScreen = AIChatScreen;
import AIHistoryScreen from "./screens/AIHistoryScreen";
import EmergencyCardSettings from "./screens/EmergencyCardSettings";
import EmergencyCardView from "./screens/EmergencyCardView";
import HealthDashboard from "./screens/HealthDashboard";

const Stack = createStackNavigator();

function AppNavigator() {
  const { user, userData, loading } = useUser();

  // Show a loading screen while Firebase checks auth state
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
        {!user || !userData?.phoneVerified ? (
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
            <Stack.Screen name="ReportViewer" component={ReportViewerScreen} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen name="AICharts" component={AIChartsScreen} />
            <Stack.Screen name="AIHistory" component={AIHistoryScreen} />
            <Stack.Screen name="HealthDashboard" component={HealthDashboard} />
            <Stack.Screen name="EmergencyCardSettings" component={EmergencyCardSettings} />
            <Stack.Screen name="EmergencyCardView" component={EmergencyCardView} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <AppNavigator />
      </UserProvider>
    </ThemeProvider>
  );
}
