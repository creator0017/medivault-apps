import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
    Alert,
    Dimensions,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

const { width } = Dimensions.get("window");

export default function EmergencyScreen({ navigation }) {
  // --- EMERGENCY LOGIC: SECURITY ---
  const [isAuthorized, setIsAuthorized] = useState(true); // Set to true for user view
  const [isEditing, setIsEditing] = useState(false);

  // --- DATA STATE (Exactly matching your Web Code) ---
  const [medicalInfo, setMedicalInfo] = useState({
    name: "Ramesh Kumar",
    bloodGroup: "O+",
    age: "55",
    weight: "96",
    patientId: "MV-9921",
    emergencyPin: "1234",
  });

  const [conditions, setConditions] = useState([
    {
      id: "1",
      title: "Hypertension",
      subtitle: "Chronic Condition",
      history: "Diagnosed in 2015, managed with daily medication.",
      type: "heart",
    },
    {
      id: "2",
      title: "Type 2 Diabetes",
      subtitle: "Insulin Dependent",
      history: "Diagnosed in 2018, requires regular monitoring.",
      type: "drop",
    },
  ]);

  const [allergies] = useState([
    { id: "1", name: "Penicillin", severity: "SEVERE" },
    { id: "2", name: "Aspirin", severity: "MODERATE" },
  ]);

  const [medications] = useState([
    { id: "1", name: "Metformin", dose: "500mg" },
    { id: "2", name: "Glimepiride", dose: "1mg" },
    { id: "3", name: "Amlodipine", dose: "5mg" },
  ]);

  const [contacts] = useState([
    { id: "1", name: "Rajesh (Son)", phone: "9876543210" },
  ]);

  // --- PDF GENERATION (Pro Web Formatting) ---
  const generatePDF = async () => {
    const htmlContent = `
      <html>
        <body style="font-family: Helvetica; padding: 30px; color: #1E293B;">
          <div style="background: #C54242; padding: 20px; color: white; border-radius: 10px;">
            <h1 style="margin:0;">EMERGENCY MEDICAL RECORD</h1>
            <p>ID: ${medicalInfo.patientId} | PIN: ${medicalInfo.emergencyPin}</p>
          </div>
          <h2 style="margin-top:30px;">${medicalInfo.name.toUpperCase()}</h2>
          <p><b>Blood:</b> ${medicalInfo.bloodGroup} | <b>Age:</b> ${medicalInfo.age} | <b>Weight:</b> ${medicalInfo.weight}kg</p>
          <hr/>
          <h3>MEDICAL CONDITIONS</h3>
          ${conditions.map((c) => `<p><b>• ${c.title}</b>: ${c.subtitle}<br/><i>History: ${c.history}</i></p>`).join("")}
          <h3>ALLERGIES</h3>
          <p>${allergies.map((a) => `${a.name} (${a.severity})`).join(", ")}</p>
          <h3>MEDICATIONS</h3>
          ${medications.map((m) => `• ${m.name} (${m.dose})<br/>`).join("")}
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri);
  };

  const makeCall = (phone) => Linking.openURL(`tel:${phone}`);

  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#2E75B6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMERGENCY CARD</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <MaterialCommunityIcons
            name={isEditing ? "check-circle" : "cog-outline"}
            size={28}
            color="#2E75B6"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* --- CRITICAL INFO CARD --- */}
        <View style={styles.criticalCard}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.critLabel}>CRITICAL INFORMATION</Text>
              <Text style={styles.critId}>
                ID: {medicalInfo.patientId} • PIN: {medicalInfo.emergencyPin}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="medical-bag"
              size={32}
              color="rgba(255,255,255,0.3)"
            />
          </View>

          <Text style={styles.patientName}>
            {medicalInfo.name.toUpperCase()}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>BLOOD GROUP</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{medicalInfo.bloodGroup}</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>AGE</Text>
              <Text style={styles.statVal}>{medicalInfo.age} Years</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>WEIGHT</Text>
              <Text style={styles.statVal}>{medicalInfo.weight} kg</Text>
            </View>
          </View>
        </View>

        {/* --- MEDICAL CONDITIONS (WITH HISTORY) --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MEDICAL CONDITIONS ⚠️</Text>
          {isEditing && (
            <MaterialCommunityIcons name="pencil" size={16} color="#64748B" />
          )}
        </View>

        {conditions.map((c) => (
          <View key={c.id} style={styles.conditionCard}>
            <View style={styles.condMain}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name={c.type === "heart" ? "heart-pulse" : "water"}
                  size={24}
                  color="#D14343"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.condTitle}>{c.title}</Text>
                <Text style={styles.condSub}>{c.subtitle}</Text>
              </View>
            </View>
            <View style={styles.historyBox}>
              <Text style={styles.historyText}>
                <Text style={{ fontWeight: "900", color: "#94A3B8" }}>
                  HISTORY:{" "}
                </Text>
                {c.history}
              </Text>
            </View>
          </View>
        ))}

        {/* --- ALLERGIES --- */}
        <View style={styles.allergySection}>
          <View style={styles.allergyHeader}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color="#D14343"
            />
            <Text style={styles.allergyTitle}>SEVERE ALLERGIES</Text>
          </View>
          <View style={styles.tagRow}>
            {allergies.map((a) => (
              <View key={a.id} style={styles.tag}>
                <Text style={styles.tagText}>
                  {a.name} - {a.severity}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* --- MEDICATIONS --- */}
        <Text style={styles.sectionTitleAlt}>CURRENT MEDICATIONS</Text>
        <View style={styles.medBox}>
          {medications.map((m) => (
            <View key={m.id} style={styles.medRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="pill" size={20} color="#2E75B6" />
                <Text style={styles.medName}>{m.name}</Text>
              </View>
              <Text style={styles.medDose}>{m.dose}</Text>
            </View>
          ))}
        </View>

        {/* --- EMERGENCY CONTACTS --- */}
        <Text style={styles.sectionTitleAlt}>EMERGENCY CONTACTS</Text>
        {contacts.map((con) => (
          <View key={con.id} style={styles.contactCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons
                  name="account"
                  size={24}
                  color="#64748B"
                />
              </View>
              <View>
                <Text style={styles.contactName}>{con.name}</Text>
                <Text style={styles.contactPhone}>{con.phone}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => makeCall(con.phone)}
            >
              <MaterialCommunityIcons name="phone" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}

        {/* --- QR SCAN --- */}
        <View style={styles.qrCard}>
          <Text style={styles.qrLabel}>SCAN FOR FULL MEDICAL HISTORY</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={`https://medivault-final.vercel.app/view?id=${medicalInfo.patientId}`}
              size={150}
            />
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert("Success", "QR Code saved to gallery")}
          >
            <Text style={styles.qrDownload}>Download QR Code</Text>
          </TouchableOpacity>
          <Text style={styles.qrFooter}>
            Authorized medical personnel only.
          </Text>
          <Text style={styles.qrFooter}>Secured by MediVault Encryption</Text>
        </View>

        {/* --- PDF BUTTON --- */}
        <TouchableOpacity style={styles.pdfBtn} onPress={generatePDF}>
          <MaterialCommunityIcons name="file-pdf-box" size={24} color="#FFF" />
          <Text style={styles.pdfText}>SAVE MEDICAL RECORD PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    paddingTop: Platform.OS === "ios" ? 10 : 45,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 1,
  },
  scrollBody: { padding: 20, paddingBottom: 50 },
  criticalCard: {
    backgroundColor: "#C54242",
    borderRadius: 30,
    padding: 25,
    elevation: 10,
    shadowColor: "#C54242",
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  critLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "900",
  },
  critId: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "bold" },
  patientName: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 25,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 5,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: "#FFF", fontWeight: "900", fontSize: 16 },
  statVal: { color: "#FFF", fontSize: 17, fontWeight: "900" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1,
  },
  sectionTitleAlt: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1,
    marginTop: 30,
    marginBottom: 15,
  },
  conditionCard: {
    backgroundColor: "#FFF",
    borderRadius: 25,
    padding: 20,
    marginBottom: 12,
    borderLeftWidth: 6,
    borderLeftColor: "#C54242",
    elevation: 3,
  },
  condMain: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  iconCircle: {
    width: 45,
    height: 45,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  condTitle: { fontSize: 17, fontWeight: "bold", color: "#1E293B" },
  condSub: { fontSize: 13, color: "#64748B" },
  historyBox: { paddingLeft: 60 },
  historyText: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    lineHeight: 16,
  },
  allergySection: {
    backgroundColor: "#FEE2E2",
    borderRadius: 25,
    padding: 20,
    marginTop: 10,
  },
  allergyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  allergyTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1E293B",
    marginLeft: 10,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap" },
  tag: {
    backgroundColor: "#C54242",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  medBox: { backgroundColor: "#FFF", borderRadius: 22, overflow: "hidden" },
  medRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  medName: { fontWeight: "bold", color: "#1E293B", marginLeft: 10 },
  medDose: { color: "#64748B", fontWeight: "900", fontSize: 13 },
  contactCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 45,
    height: 45,
    backgroundColor: "#F1F5F9",
    borderRadius: 22.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  contactName: { fontWeight: "bold", fontSize: 15 },
  contactPhone: { fontSize: 12, color: "#64748B" },
  callBtn: {
    backgroundColor: "#10B981",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  qrCard: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 30,
    padding: 30,
    marginTop: 30,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  qrLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 20,
  },
  qrContainer: { padding: 10, backgroundColor: "#FFF" },
  qrDownload: {
    color: "#2E75B6",
    fontWeight: "900",
    fontSize: 11,
    marginTop: 15,
    textDecorationLine: "underline",
  },
  qrFooter: { fontSize: 9, color: "#94A3B8", marginTop: 5, fontWeight: "bold" },
  pdfBtn: {
    backgroundColor: "#1E293B",
    flexDirection: "row",
    padding: 20,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  pdfText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 13,
    marginLeft: 10,
    letterSpacing: 1,
  },
});
