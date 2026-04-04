import { MaterialCommunityIcons } from "@expo/vector-icons";
import rnAuth from "@react-native-firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { db, functions } from "../firebaseConfig";

export default function VerificationScreen({ route, navigation }) {
  const { fullName, email, phone, patientId, uid } = route.params || {};

  // C-7 Fix: Guard against missing params
  useEffect(() => {
    if (!uid || !email || !phone) {
      Alert.alert(
        "Session Error",
        "Missing verification data. Please sign up again.",
        [{ text: "OK", onPress: () => navigation.replace("Login") }],
      );
    }
  }, []);

  const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  const [confirmation, setConfirmation] = useState(null);

  const [phoneTimer, setPhoneTimer] = useState(45);
  const [emailTimer, setEmailTimer] = useState(80);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingPhone, setSendingPhone] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const phoneRefs = useRef([]);
  const emailRefs = useRef([]);
  const autoSentRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhoneTimer((prev) => (prev > 0 ? prev - 1 : 0));
      setEmailTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Auto-send both OTPs when screen loads
  useEffect(() => {
    if (!uid || !email || !phone || autoSentRef.current) return;

    // Email OTP auto-send (no reCAPTCHA needed)
    const emailTimer = setTimeout(async () => {
      autoSentRef.current = true;
      try {
        setSendingEmail(true);
        const sendEmailOTP = httpsCallable(functions, "sendEmailOTP");
        await sendEmailOTP({ email, fullName, uid });
      } catch (e) {
        Alert.alert("Email Error", e.message || "Failed to send email OTP");
      } finally {
        setSendingEmail(false);
      }
    }, 800);

    // Phone OTP auto-send (needs reCAPTCHA to initialize first)
    const phoneTimer = setTimeout(() => {
      sendPhoneOtp();
    }, 1500);

    return () => {
      clearTimeout(emailTimer);
      clearTimeout(phoneTimer);
    };
  }, [uid, email, phone]);

  const sendPhoneOtp = async () => {
    if (!phone) return Alert.alert("Error", "No phone number found.");
    try {
      setSendingPhone(true);
      // Normalize phone: strip non-digits, then ensure single +91 prefix
      const digits = phone.replace(/\D/g, "");
      let phoneNumber;
      if (phone.startsWith("+")) {
        phoneNumber = "+" + digits;
      } else if (digits.startsWith("91") && digits.length === 12) {
        phoneNumber = "+" + digits;
      } else {
        phoneNumber = "+91" + digits;
      }

      // Uses @react-native-firebase/auth — no reCAPTCHA modal needed on Android
      const confirmationResult = await rnAuth().signInWithPhoneNumber(phoneNumber);

      setConfirmation(confirmationResult);
      setPhoneTimer(45);
      setPhoneOtp(["", "", "", "", "", ""]);
      setTimeout(() => phoneRefs.current[0]?.focus(), 100);
    } catch (error) {
      let message = error.message;
      if (error.code === "auth/invalid-phone-number")
        message = "Invalid phone number format (+91XXXXXXXXXX)";
      else if (error.code === "auth/too-many-requests")
        message = "Too many requests. Please wait before retrying.";
      Alert.alert("SMS Error", message);
    } finally {
      setSendingPhone(false);
    }
  };

  const sendEmailOtp = async () => {
    if (!email) return Alert.alert("Error", "No email address found.");
    try {
      setSendingEmail(true);
      const sendEmailOTP = httpsCallable(functions, "sendEmailOTP");
      await sendEmailOTP({ email, fullName, uid });
      setEmailTimer(80);
      setEmailOtp(["", "", "", "", "", ""]);
      Alert.alert("Sent", "Email OTP resent successfully.");
    } catch (error) {
      Alert.alert("Email Error", error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOtpChange = (value, index, type) => {
    const numeric = value.replace(/[^0-9]/g, "");

    if (type === "phone") {
      const newOtp = [...phoneOtp];
      newOtp[index] = numeric;
      setPhoneOtp(newOtp);
      if (numeric && index < 5) {
        setTimeout(() => phoneRefs.current[index + 1]?.focus(), 50);
      }
    } else {
      const newOtp = [...emailOtp];
      newOtp[index] = numeric;
      setEmailOtp(newOtp);
      if (numeric && index < 5) {
        setTimeout(() => emailRefs.current[index + 1]?.focus(), 50);
      }
    }
  };

  const handleKeyPress = (e, index, type) => {
    if (e.nativeEvent.key === "Backspace") {
      if (type === "phone" && !phoneOtp[index] && index > 0) {
        phoneRefs.current[index - 1]?.focus();
      } else if (type === "email" && !emailOtp[index] && index > 0) {
        emailRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerify = async () => {
    const phoneCode = phoneOtp.join("");
    const emailCode = emailOtp.join("");

    if (phoneCode.length !== 6 || emailCode.length !== 6) {
      Alert.alert("Incomplete", "Please enter both 6-digit codes");
      return;
    }

    setIsLoading(true);
    try {
      if (!confirmation)
        throw new Error(
          "Phone verification not initialized. Please click 'Send SMS' first.",
        );
      await confirmation.confirm(phoneCode);

      const userDoc = await getDoc(doc(db, "users", uid));
      const userData = userDoc.data();
      if (userData.emailOtp !== emailCode)
        throw new Error("Invalid email code");

      const expiryTime = userData.emailOtpExpires?.toDate
        ? userData.emailOtpExpires.toDate()
        : new Date(userData.emailOtpExpires);
      if (expiryTime < new Date()) throw new Error("Email code expired");

      await updateDoc(doc(db, "users", uid), {
        phoneVerified: true,
        emailVerified: true,
        verifiedAt: serverTimestamp(),
        phoneOtp: null,
        emailOtp: null,
      });

      navigation.replace("Success", { fullName, patientId });
    } catch (error) {
      let message = error.message;
      if (error.code === "auth/invalid-verification-code")
        message = "Invalid SMS code";
      Alert.alert("Verification Failed", message);
    } finally {
      setIsLoading(false);
    }
  };

  // If params are missing, don't render the form
  if (!uid || !email || !phone) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="shield-check"
                size={40}
                color="#FFF"
              />
            </View>

            <Text style={styles.tagText}>DUAL-CHANNEL VERIFICATION</Text>
            <Text style={styles.title}>
              Hello, {fullName?.split(" ")[0]}! 👋
            </Text>
            <Text style={styles.subtitle}>
              We've sent secure codes to your phone and email
            </Text>

            {/* Phone Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.labelRow}>
                  <MaterialCommunityIcons
                    name="cellphone-check"
                    size={18}
                    color="#2E75B6"
                  />
                  <Text style={styles.sectionTitle}>Phone Verification</Text>
                </View>
                <Text style={styles.maskedText}>
                  {phone?.replace(/(\+\d{2})\d{8}/, "$1********")}
                </Text>
              </View>

              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={`phone-${i}`}
                    style={[
                      styles.otpBox,
                      phoneOtp[i] ? styles.otpBoxFilled : null,
                    ]}
                  >
                    <TextInput
                      ref={(el) => (phoneRefs.current[i] = el)}
                      style={styles.otpDigit}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={phoneOtp[i]}
                      onChangeText={(text) => handleOtpChange(text, i, "phone")}
                      onKeyPress={(e) => handleKeyPress(e, i, "phone")}
                      editable={!isLoading}
                      blurOnSubmit={false}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                    />
                  </View>
                ))}
              </View>

              <View style={styles.resendRow}>
                <View style={styles.timerBadge}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color="#64748B"
                  />
                  <Text style={styles.timerText}>
                    {phoneTimer > 0 ? formatTime(phoneTimer) : "Expired"}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={phoneTimer > 0 || sendingPhone || isLoading}
                  onPress={sendPhoneOtp}
                  style={
                    phoneTimer > 0 ? styles.resendDisabled : styles.resendActive
                  }
                >
                  {sendingPhone ? (
                    <ActivityIndicator size="small" color="#2E75B6" />
                  ) : (
                    <Text
                      style={
                        phoneTimer > 0
                          ? styles.resendTextDisabled
                          : styles.resendText
                      }
                    >
                      Resend SMS
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Email Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.labelRow}>
                  <MaterialCommunityIcons
                    name="email-check"
                    size={18}
                    color="#2E75B6"
                  />
                  <Text style={styles.sectionTitle}>Email Verification</Text>
                </View>
                <Text style={styles.maskedText}>
                  {email?.replace(/(.{2})(.*)(@.*)/, "$1***$3")}
                </Text>
              </View>

              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={`email-${i}`}
                    style={[
                      styles.otpBox,
                      emailOtp[i] ? styles.otpBoxFilled : null,
                    ]}
                  >
                    <TextInput
                      ref={(el) => (emailRefs.current[i] = el)}
                      style={styles.otpDigit}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={emailOtp[i]}
                      onChangeText={(text) => handleOtpChange(text, i, "email")}
                      onKeyPress={(e) => handleKeyPress(e, i, "email")}
                      editable={!isLoading}
                      blurOnSubmit={false}
                      textContentType="oneTimeCode"
                    />
                  </View>
                ))}
              </View>

              <View style={styles.resendRow}>
                <View style={styles.timerBadge}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color="#64748B"
                  />
                  <Text style={styles.timerText}>
                    {emailTimer > 0 ? formatTime(emailTimer) : "Expired"}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={emailTimer > 0 || sendingEmail || isLoading}
                  onPress={sendEmailOtp}
                  style={
                    emailTimer > 0 ? styles.resendDisabled : styles.resendActive
                  }
                >
                  {sendingEmail ? (
                    <ActivityIndicator size="small" color="#2E75B6" />
                  ) : (
                    <Text
                      style={
                        emailTimer > 0
                          ? styles.resendTextDisabled
                          : styles.resendText
                      }
                    >
                      Resend Email
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                isLoading && styles.verifyButtonDisabled,
              ]}
              onPress={handleVerify}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.verifyButtonText}>Verify Identity</Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#FFF"
                  />
                </>
              )}
            </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  content: { alignItems: "center" },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: "#2E75B6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    elevation: 10,
  },
  tagText: {
    color: "#2E75B6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#1E293B", marginBottom: 8 },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 32,
    fontWeight: "500",
    lineHeight: 22,
  },
  section: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  maskedText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  otpBox: {
    width: 48,
    height: 56,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxFilled: { borderColor: "#2E75B6", backgroundColor: "#E0F2FE" },
  otpDigit: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    width: "100%",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  resendActive: { paddingHorizontal: 12, paddingVertical: 6 },
  resendDisabled: { opacity: 0.5, paddingHorizontal: 12, paddingVertical: 6 },
  resendText: { fontSize: 13, color: "#2E75B6", fontWeight: "700" },
  resendTextDisabled: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
  verifyButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#2E75B6",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    elevation: 5,
  },
  verifyButtonDisabled: { opacity: 0.7 },
  verifyButtonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
    marginRight: 8,
  },
});
