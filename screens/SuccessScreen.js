import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SuccessScreen({ route, navigation }) {
  // C-4 Fix: Accept and forward route params
  const { fullName, patientId } = route.params || {};

  const StepCard = ({ icon, title, color }) => (
    <View style={[styles.stepCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name="check-circle" size={22} color={color} />
      <Text style={styles.stepTitle}>{title}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <View style={styles.circleBg}>
            <MaterialCommunityIcons
              name="shield-check"
              size={60}
              color="#4ADE80"
            />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.tag}>REGISTRATION SUCCESSFUL</Text>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.subtitle}>
            Welcome to <Text style={styles.brandText}>Arogyasathi</Text>
            {fullName ? `, ${fullName.split(" ")[0]}` : ""}
          </Text>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listLabel}>SUGGESTED NEXT STEPS</Text>
          <StepCard title="Upload Medical Report" color="#3B82F6" />
          <StepCard title="Complete Medical ID" color="#EF4444" />
          <StepCard title="Add Family Member" color="#10B981" />
        </View>

        <TouchableOpacity
          style={styles.mainBtn}
          activeOpacity={0.8}
          onPress={() => {
            try {
              navigation.replace("Home", { fullName, patientId });
            } catch {
              // App.js conditional nav will switch automatically once phoneVerified is set
            }
          }}
        >
          <Text style={styles.mainBtnText}>Go to Dashboard</Text>
          <MaterialCommunityIcons name="arrow-right" size={22} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.footerText}>SECURE • PRIVATE • ENCRYPTED</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  iconContainer: { marginBottom: 30 },
  circleBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#DCFCE7",
  },
  textContainer: { alignItems: "center", marginBottom: 40 },
  tag: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 2 },
  title: { fontSize: 32, fontWeight: "900", color: "#1E293B", marginTop: 10 },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  brandText: { color: "#2E75B6", fontWeight: "900" },
  listSection: { width: "100%", gap: 12 },
  listLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    marginBottom: 5,
    letterSpacing: 1,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 18,
    borderRadius: 20,
    borderLeftWidth: 5,
  },
  stepTitle: {
    flex: 1,
    marginLeft: 15,
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
  },
  mainBtn: {
    backgroundColor: "#2E75B6",
    width: "100%",
    height: 65,
    borderRadius: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
    gap: 12,
    elevation: 4,
  },
  mainBtnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  footerText: {
    marginTop: 40,
    fontSize: 10,
    fontWeight: "bold",
    color: "#E2E8F0",
    letterSpacing: 2,
  },
});
