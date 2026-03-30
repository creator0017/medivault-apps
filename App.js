import { NavigationContainer } from "@react-navigation/native";
import {
  CardStyleInterpolators,
  createStackNavigator,
} from "@react-navigation/stack";
import "react-native-gesture-handler";

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
import WelcomeScreen from "./screens/WelcomeScreen";

// IMPORT THE NEW FAMILY HUB SCREEN
import FamilyScreen from "./screens/FamilyScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          // Premium horizontal slide animation for the whole app
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        {/* --- AUTH & ONBOARDING FLOW --- */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Verification" component={VerificationScreen} />
        <Stack.Screen name="Success" component={SuccessScreen} />

        {/* --- MAIN APP FLOW --- */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />

        {/* REGISTERED FAMILY HUB SCREEN */}
        {/* This name "Family" must match navigation.navigate("Family") exactly */}
        <Stack.Screen
          name="Family"
          component={FamilyScreen}
          options={{
            // Vertial slide-up animation makes the Family Hub feel like a secure vault
            cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
          }}
        />

        {/* --- HEALTH & REPORTS FLOW --- */}
        <Stack.Screen name="AI" component={AIDashboard} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        <Stack.Screen name="UploadReport" component={UploadReportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
