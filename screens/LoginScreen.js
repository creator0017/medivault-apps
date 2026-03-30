import { MaterialCommunityIcons } from "@expo/vector-icons";
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

export default function LoginScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollGrow}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to MediVault</Text>
            <Text style={styles.subtitle}>
              Sign in to access your health records
            </Text>
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity style={styles.googleBtn} activeOpacity={0.7}>
            <View style={styles.googleIconCircle}>
              <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
            </View>
            <Text style={styles.googleText}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          {/* Input Form */}
          <View style={styles.form}>
            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="account-outline"
                size={22}
                color="#94A3B8"
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#CBD5E1"
              />
            </View>

            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="email-outline"
                size={22}
                color="#94A3B8"
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#CBD5E1"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>PHONE</Text>
            <View style={styles.inputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.codeText}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter 10 digit number"
                placeholderTextColor="#CBD5E1"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Large Blue Arrow Button to navigate to OTP */}
          <TouchableOpacity
            style={styles.submitBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Verification")}
          >
            <MaterialCommunityIcons name="arrow-right" size={32} color="#FFF" />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollGrow: { paddingHorizontal: 30, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 40 },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 16, color: "#64748B", marginTop: 8, fontWeight: "500" },
  googleBtn: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  googleIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  googleText: { fontSize: 16, fontWeight: "bold", color: "#334155" },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 35,
  },
  line: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  orText: {
    marginHorizontal: 15,
    fontSize: 12,
    fontWeight: "900",
    color: "#CBD5E1",
  },
  form: { gap: 15 },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  countryCode: {
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
    paddingRight: 12,
    marginRight: 15,
  },
  codeText: { fontWeight: "900", color: "#1E293B", fontSize: 15 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    fontWeight: "600",
    marginLeft: 10,
  },
  submitBtn: {
    backgroundColor: "#2E75B6",
    width: 70,
    height: 70,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 40,
    shadowColor: "#2E75B6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
});
