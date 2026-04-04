import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
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
import EditModal from "../components/EditModal";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";

const { width } = Dimensions.get("window");

export default function EmergencyScreen({ navigation }) {
  const { userData } = useUser();
  const [isEditing, setIsEditing] = useState(false);

  const [medicalInfo, setMedicalInfo] = useState({
    name: userData?.fullName || "User",
    bloodGroup: "O+",
    age: "",
    weight: "",
    patientId: userData?.patientId || "MV-000000",
    emergencyPin: "1234",
  });

  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [medications, setMedications] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Load emergency data from Firestore in real-time
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(doc(db, "users", userData.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const em = d.emergency || {};
      setMedicalInfo({
        name: d.fullName || "User",
        bloodGroup: em.bloodGroup || "O+",
        age: em.age || "",
        weight: em.weight || "",
        patientId: d.patientId || "MV-000000",
        emergencyPin: em.emergencyPin || "1234",
      });
      setConditions(em.conditions || []);
      setAllergies(em.allergies || []);
      setMedications(em.medications || []);
      setContacts(em.contacts || []);
    });
    return unsub;
  }, [userData?.uid]);

  // Persist emergency data to Firestore
  const saveToFirestore = async (updatedInfo, updatedConditions) => {
    if (!userData?.uid) return;
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        "emergency.bloodGroup": updatedInfo.bloodGroup,
        "emergency.age": updatedInfo.age,
        "emergency.weight": updatedInfo.weight,
        "emergency.emergencyPin": updatedInfo.emergencyPin,
        "emergency.conditions": updatedConditions,
      });
    } catch (e) {
      Alert.alert("Save Error", "Could not save changes.");
    }
  };

  // M-7 Fix: EditModal state for in-place editing
  const [editModal, setEditModal] = useState({
    visible: false,
    title: "",
    field: "",
    target: null,
    initialValue: "",
  });

  const openInfoEdit = (label, field) => {
    setEditModal({
      visible: true,
      title: `Edit ${label}`,
      field,
      target: "info",
      initialValue: medicalInfo[field],
    });
  };

  const openConditionEdit = (condId, label, field) => {
    const cond = conditions.find((c) => c.id === condId);
    setEditModal({
      visible: true,
      title: `Edit ${label}`,
      field,
      target: condId,
      initialValue: cond?.[field] || "",
    });
  };

  const handleEditSave = (value) => {
    let newInfo = medicalInfo;
    let newConditions = conditions;
    if (editModal.target === "info") {
      newInfo = { ...medicalInfo, [editModal.field]: value };
      setMedicalInfo(newInfo);
    } else {
      newConditions = conditions.map((c) =>
        c.id === editModal.target ? { ...c, [editModal.field]: value } : c,
      );
      setConditions(newConditions);
    }
    saveToFirestore(newInfo, newConditions);
    setEditModal({ ...editModal, visible: false });
  };

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
        <TouchableOpacity onPress={() => { if (isEditing) saveToFirestore(medicalInfo, conditions); setIsEditing(!isEditing); }}>
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
            <TouchableOpacity
              style={styles.statItem}
              disabled={!isEditing}
              onPress={() => openInfoEdit("Blood Group", "bloodGroup")}
            >
              <Text style={styles.statLabel}>BLOOD GROUP</Text>
              <View style={[styles.badge, isEditing && styles.editableBadge]}>
                <Text style={styles.badgeText}>{medicalInfo.bloodGroup}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              disabled={!isEditing}
              onPress={() => openInfoEdit("Age", "age")}
            >
              <Text style={styles.statLabel}>AGE</Text>
              <Text style={[styles.statVal, isEditing && styles.editableVal]}>
                {medicalInfo.age} Years
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              disabled={!isEditing}
              onPress={() => openInfoEdit("Weight (kg)", "weight")}
            >
              <Text style={styles.statLabel}>WEIGHT</Text>
              <Text style={[styles.statVal, isEditing && styles.editableVal]}>
                {medicalInfo.weight} kg
              </Text>
            </TouchableOpacity>
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
              {isEditing && (
                <TouchableOpacity
                  onPress={() => openConditionEdit(c.id, "Condition", "title")}
                  style={styles.editChip}
                >
                  <MaterialCommunityIcons name="pencil" size={14} color="#2E75B6" />
                  <Text style={styles.editChipText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.historyBox}>
              <Text style={styles.historyText}>
                <Text style={{ fontWeight: "900", color: "#94A3B8" }}>
                  HISTORY:{" "}
                </Text>
                {c.history}
              </Text>
              {isEditing && (
                <TouchableOpacity
                  onPress={() => openConditionEdit(c.id, "History", "history")}
                  style={[styles.editChip, { marginTop: 6 }]}
                >
                  <MaterialCommunityIcons name="pencil" size={14} color="#2E75B6" />
                  <Text style={styles.editChipText}>Edit history</Text>
                </TouchableOpacity>
              )}
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
              value={`BEGIN:MEDIVAULT\nNAME:${medicalInfo.name}\nID:${medicalInfo.patientId}\nBLOOD:${medicalInfo.bloodGroup}\nAGE:${medicalInfo.age}\nEND:MEDIVAULT`}
              size={150}
            />
          </View>
          <TouchableOpacity
            onPress={async () => {
              try {
                const { uri } = await Print.printToFileAsync({ html: `<html><body style="text-align:center;padding:50px;"><h2>MediVault Emergency</h2><p>${medicalInfo.name} | ${medicalInfo.patientId}</p><p>Blood: ${medicalInfo.bloodGroup} | Age: ${medicalInfo.age}</p></body></html>` });
                await Sharing.shareAsync(uri);
              } catch (e) { Alert.alert("Error", "Could not share."); }
            }}
          >
            <Text style={styles.qrDownload}>Share Emergency Info</Text>
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

      {/* M-7 Fix: Cross-platform EditModal for in-place editing */}
      <EditModal
        visible={editModal.visible}
        title={editModal.title}
        initialValue={editModal.initialValue}
        placeholder="Enter value"
        onCancel={() => setEditModal({ ...editModal, visible: false })}
        onSave={handleEditSave}
      />
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
  editableBadge: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderStyle: "dashed",
  },
  editableVal: {
    textDecorationLine: "underline",
    textDecorationStyle: "dashed",
    opacity: 0.85,
  },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editChipText: {
    fontSize: 11,
    color: "#2E75B6",
    fontWeight: "700",
  },
});
