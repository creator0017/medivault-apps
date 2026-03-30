import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function VerificationScreen({ navigation }) {
  // Separate timers for Phone and Email resend
  const [phoneTimer, setPhoneTimer] = useState(45);
  const [emailTimer, setEmailTimer] = useState(80);

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

  // Reusable 6-digit OTP input row
  const OtpInputRow = () => (
    <View style={styles.otpRow}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.otpBox}>
          <TextInput
            style={styles.otpDigit}
            keyboardType="number-pad"
            maxLength={1}
            placeholder="•"
            placeholderTextColor="#CBD5E1"
          />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={28}
              color="#1E293B"
            />
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="shield-check"
                size={40}
                color="#2E75B6"
              />
            </View>

            <Text style={styles.tagText}>DUAL-CHANNEL VERIFICATION</Text>
            <Text style={styles.title}>Security Check</Text>
            <Text style={styles.subtitle}>
              Enter the codes sent to your registered devices
            </Text>

            {/* Phone Verification Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Phone OTP</Text>
                <Text style={styles.userValue}>+91 ••••• ••429</Text>
              </View>
              <OtpInputRow />
              <View style={styles.resendContainer}>
                <View style={styles.timerBox}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color="#94A3B8"
                  />
                  <Text style={styles.timerText}>
                    Resend in {formatTime(phoneTimer)}
                  </Text>
                </View>
                <TouchableOpacity disabled={phoneTimer > 0}>
                  <Text
                    style={[
                      styles.resendBtn,
                      phoneTimer > 0 && { opacity: 0.3 },
                    ]}
                  >
                    Resend SMS
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Email Verification Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Email OTP</Text>
                <Text style={styles.userValue}>ramesh.k••••@gmail.com</Text>
              </View>
              <OtpInputRow />
              <View style={styles.resendContainer}>
                <View style={styles.timerBox}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color="#94A3B8"
                  />
                  <Text style={styles.timerText}>
                    Resend in {formatTime(emailTimer)}
                  </Text>
                </View>
                <TouchableOpacity disabled={emailTimer > 0}>
                  <Text
                    style={[
                      styles.resendBtn,
                      emailTimer > 0 && { opacity: 0.3 },
                    ]}
                  >
                    Resend Email
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.mainBtn}
              onPress={() => navigation.navigate("Success")}
              activeOpacity={0.8}
            >
              <Text style={styles.mainBtnText}>Verify Identity</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingBottom: 40 },
  backBtn: { padding: 20 },
  content: { paddingHorizontal: 30, alignItems: "center" },
  iconCircle: {
    width: 80,
    height: 80,
    backgroundColor: "#E0F2FE",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  tagText: {
    color: "#2E75B6",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: { fontSize: 28, fontWeight: "900", color: "#1E293B", marginTop: 10 },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
  },
  section: { width: "100%", marginTop: 30 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  userValue: { fontSize: 12, color: "#94A3B8" },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  otpBox: {
    width: "14%",
    aspectRatio: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  otpDigit: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    width: "100%",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerBox: { flexDirection: "row", alignItems: "center", gap: 5 },
  timerText: { fontSize: 12, color: "#94A3B8", fontWeight: "bold" },
  resendBtn: {
    fontSize: 12,
    color: "#2E75B6",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  mainBtn: {
    backgroundColor: "#2E75B6",
    width: "100%",
    height: 60,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
    gap: 10,
    elevation: 4,
  },
  mainBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});
