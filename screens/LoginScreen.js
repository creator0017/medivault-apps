import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";

export default function LoginScreen({ navigation }) {
  const [mode, setMode] = useState("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // L-1 Fix

  const isRepairing = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !isRepairing.current) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().phoneVerified) {
            // Verified user — App.js conditional nav will switch to Home automatically
            // Don't call setIsCheckingAuth(false) so spinner shows until nav switches
            return;
          }
        } catch (error) {
          console.log("Auth check error:", error);
        }
      }
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatPhone = (input) => {
    const cleaned = input.replace(/\D/g, "");
    if (cleaned.length === 10 && !cleaned.startsWith("+"))
      return "+91" + cleaned;
    return cleaned;
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleForgotPassword = async () => {
    if (!resetEmail || !validateEmail(resetEmail)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      Alert.alert(
        "✅ Email Sent",
        "Password reset link sent! Check your inbox.",
        [{ text: "OK", onPress: () => setMode("signin") }],
      );
      setResetEmail("");
    } catch (error) {
      Alert.alert(
        "Error",
        error.code === "auth/user-not-found"
          ? "No account found with this email"
          : "Could not send reset email",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password || password.length !== 6) {
      Alert.alert("Error", "Please enter email and a 6-digit passcode");
      return;
    }
    animateButton();
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Repair: ensure publicProfiles exists (missing for users registered before family feature)
        try {
          const pubRef = doc(db, "publicProfiles", user.uid);
          const pubDoc = await getDoc(pubRef);
          if (!pubDoc.exists() && userData.patientId) {
            await setDoc(pubRef, {
              fullName: userData.fullName,
              patientId: userData.patientId,
              uid: user.uid,
            });
          }
        } catch (_) {}
        if (userData.phoneVerified) {
          // Verified user — keep loading spinner while App.js switches to Home
          return;
        } else {
          navigation.replace("Verification", {
            fullName: userData.fullName,
            email: userData.email,
            phone: userData.phone,
            patientId: userData.patientId,
            uid: user.uid,
          });
          return;
        }
      } else {
        await auth.signOut();
        Alert.alert(
          "Account Incomplete",
          "Please sign up again to restore your profile.",
          [{ text: "Restore", onPress: () => { setMode("signup"); setEmail(cleanEmail); } }],
        );
      }
    } catch (error) {
      Alert.alert("Sign In Failed", "Incorrect email or passcode.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName.trim() || fullName.trim().length < 2)
      return Alert.alert("Error", "Please enter your full name");
    if (!email.trim() || !validateEmail(email.trim()))
      return Alert.alert("Error", "Please enter a valid email address");
    if (!password || password.length !== 6 || !/^\d{6}$/.test(password))
      return Alert.alert("Error", "Passcode must be exactly 6 digits");
    if (!phone || phone.replace(/\D/g, "").length !== 10)
      return Alert.alert("Error", "Please enter a valid 10-digit phone number");

    const formattedPhone = formatPhone(phone);
    const cleanEmail = email.trim().toLowerCase();
    animateButton();
    setIsLoading(true);

    try {
      isRepairing.current = true; // Prevent auto-login listener from interfering during signup
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      const user = userCredential.user;
      const generatedPatientId =
        "MV-" + Math.floor(100000 + Math.random() * 900000);

      // Write private full profile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: formattedPhone,
        patientId: generatedPatientId,
        healthScore: 72,
        phoneVerified: false,
        emailVerified: false,
        createdAt: serverTimestamp(),
      });

      // Write public profile — only name + patientId, used for family member search
      await setDoc(doc(db, "publicProfiles", user.uid), {
        fullName: fullName.trim(),
        patientId: generatedPatientId,
        uid: user.uid,
      });

      navigation.navigate("Verification", {
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: formattedPhone,
        patientId: generatedPatientId,
        uid: user.uid,
      });
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        Alert.alert(
          "Account Exists",
          "This email is already registered. Please sign in.",
          [{ text: "OK", onPress: () => setMode("signin") }],
        );
      } else {
        Alert.alert("Signup Error", error.message);
      }
    } finally {
      isRepairing.current = false;
      setIsLoading(false);
    }
  };

  const switchMode = (newMode) => {
    if (newMode === "signin") {
      setFullName("");
      setPhone("");
    }
    setMode(newMode);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // L-1 Fix: Show loading spinner while checking auth state
  if (isCheckingAuth) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Image source={require("../assets/images/logo.png")} style={styles.logoImage} resizeMode="contain" />
        <Text style={[styles.brandText, { marginTop: 8 }]}>Arogyasathi</Text>
        <ActivityIndicator size="large" color="#2E75B6" style={{ marginTop: 30 }} />
        <Text style={{ color: "#64748B", marginTop: 12, fontWeight: "500" }}>
          Checking your session...
        </Text>
      </SafeAreaView>
    );
  }

  if (mode === "forgot") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.logoContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <View style={styles.iconCircleLarge}>
                <MaterialCommunityIcons
                  name="lock-reset"
                  size={50}
                  color="#FFF"
                />
              </View>
              <Text style={styles.brandText}>Reset Password</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.formContainer,
                { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Text style={styles.subtitle}>
                Enter your email to receive reset instructions
              </Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isLoading}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                onPress={() => switchMode("signin")}
                style={styles.switchButton}
              >
                <Text style={styles.switchText}>Back to Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.logoContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Image source={require("../assets/images/logo.png")} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.brandText}>Arogyasathi</Text>
            <Text style={styles.tagline}>Secure Health Records</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.formContainer,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleTab,
                  mode === "signup" && styles.toggleTabActive,
                ]}
                onPress={() => switchMode("signup")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    mode === "signup" && styles.toggleTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleTab,
                  mode === "signin" && styles.toggleTabActive,
                ]}
                onPress={() => switchMode("signin")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    mode === "signin" && styles.toggleTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              {mode === "signup"
                ? "Create your secure account"
                : "Welcome back!"}
            </Text>

            {mode === "signup" && (
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!isLoading}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            {mode === "signup" && (
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 0 }]}
                  placeholder="10-digit number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!isLoading}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="6-digit passcode"
                value={password}
                onChangeText={(text) =>
                  setPassword(text.replace(/[^0-9]/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry={!showPassword}
                editable={!isLoading}
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            {mode === "signin" && (
              <TouchableOpacity
                onPress={() => setMode("forgot")}
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <Animated.View
              style={{ transform: [{ scale: buttonScale }], marginTop: 20 }}
            >
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={mode === "signup" ? handleSignUp : handleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>
                      {mode === "signup" ? "Create Account" : "Sign In"}
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={20}
                      color="#FFF"
                      style={styles.buttonIcon}
                    />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.bottomTextContainer}>
              <Text style={styles.bottomText}>
                {mode === "signup"
                  ? "Already have an account? "
                  : "Don't have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  switchMode(mode === "signup" ? "signin" : "signup")
                }
              >
                <Text style={styles.bottomLink}>
                  {mode === "signup" ? "Sign In" : "Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: { alignItems: "center", marginBottom: 40 },
  logoImage: {
    width: 110,
    height: 110,
    marginBottom: 8,
  },
  brandText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 1,
  },
  tagline: { fontSize: 14, color: "#64748B", marginTop: 8, fontWeight: "500" },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    elevation: 5,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleTabActive: { backgroundColor: "#FFFFFF", elevation: 3 },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#94A3B8" },
  toggleTextActive: { color: "#2E75B6" },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 24,
    textAlign: "center",
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#1E293B", fontWeight: "500" },
  countryCode: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
    marginRight: 8,
  },
  eyeIcon: { padding: 4 },
  forgotButton: { alignSelf: "flex-end", marginBottom: 8 },
  forgotText: { color: "#2E75B6", fontSize: 14, fontWeight: "600" },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    marginBottom: 16,
  },
  primaryButton: { backgroundColor: "#2E75B6", elevation: 5 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
  buttonIcon: { marginLeft: 4 },
  bottomTextContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  bottomText: { color: "#64748B", fontSize: 14 },
  bottomLink: { color: "#2E75B6", fontSize: 14, fontWeight: "700" },
  switchButton: { marginTop: 16, alignSelf: "center" },
  switchText: { color: "#2E75B6", fontSize: 14, fontWeight: "600" },
});
