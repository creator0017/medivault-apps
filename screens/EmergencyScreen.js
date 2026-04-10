import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    Alert,
    Dimensions,
    Linking,
    Platform,
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
import { useEmergencyCard } from "../hooks/useEmergencyCard";

const { width } = Dimensions.get("window");

export default function EmergencyScreen({ navigation }) {
  const { userData } = useUser();
  const { shareUrl, cardData: secureCardData } = useEmergencyCard(userData?.uid);
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
  const [aiSynced, setAiSynced] = useState(false); // true when data came from AI

  // ── Helper: merge AI analysis into emergency state ──────────────────────────
  const applyAiAnalysis = (analysis, em, clinical) => {
    // Age: manual > AI patient field > blank
    const rawAge = String(analysis.age || "").replace(/\D.*/, "");
    const resolvedAge = (em.age && em.age !== "—") ? em.age : (rawAge || "");

    // Blood group: manual > AI field ("—" default is not a real value)
    const resolvedBloodGroup =
      (em.bloodGroup && em.bloodGroup !== "—")
        ? em.bloodGroup
        : (analysis.bloodGroup || "—");

    setMedicalInfo((prev) => ({
      ...prev,
      bloodGroup: resolvedBloodGroup,
      age: resolvedAge,
    }));

    // Conditions: manual always wins; otherwise build from AI
    if ((em.conditions || []).length === 0) {
      const aiConds = (analysis.conditions || []).map((c, i) => ({
        id: `ai_cond_${i}`,
        title: c.title || c.name || "Condition",
        subtitle: c.subtitle || c.description || "",
        history: c.history || "Detected from uploaded lab report",
        type: "chart-line",
      }));

      // Fallback: derive conditions from abnormal metrics
      if (aiConds.length === 0) {
        (analysis.metrics || [])
          .filter((m) => {
            const s = String(m.status || "").toLowerCase();
            return s === "high" || s === "borderline" || s === "abnormal" || s === "low";
          })
          .slice(0, 5)
          .forEach((m, i) => {
            aiConds.push({
              id: `ai_m_${i}`,
              title: m.name,
              subtitle: `Value: ${m.value} ${m.unit || ""} | Normal: ${m.normalRange || "N/A"}`,
              history: String(m.status).toLowerCase() === "high" ? "Abnormal — consult your doctor" : "Borderline — monitor closely",
              type: "chart-line",
            });
          });
      }
      if (aiConds.length > 0) setConditions(aiConds);
    }

    // Medications: manual > AI > clinical text
    if ((em.medications || []).length === 0) {
      const aiMeds = (analysis.medications || []).map((med, i) => ({
        id: `ai_med_${i}`,
        name: typeof med === "string" ? med : med.name || String(med),
        dose: med?.dose || med?.dosage || "As prescribed",
      })).filter((m) => m.name);

      if (aiMeds.length > 0) {
        setMedications(aiMeds);
      } else if (clinical.meds) {
        setMedications(
          clinical.meds.split(",").map((m, i) => ({
            id: `cm_${i}`, name: m.trim(), dose: "As prescribed",
          })).filter((m) => m.name)
        );
      }
    }

    // Allergies: manual > AI > clinical text
    if ((em.allergies || []).length === 0) {
      const aiAllergies = (analysis.allergies || []).map((a, i) => ({
        id: `ai_alg_${i}`,
        name: typeof a === "string" ? a : a.name || String(a),
        severity: a?.severity || "Check with doctor",
      })).filter((a) => a.name);

      if (aiAllergies.length > 0) {
        setAllergies(aiAllergies);
      } else if (clinical.allergies) {
        setAllergies(
          clinical.allergies.split(",").map((a, i) => ({
            id: `c_${i}`, name: a.trim(), severity: "Check with doctor",
          })).filter((a) => a.name)
        );
      }
    }

    setAiSynced(true);
  };

  // ── Load user doc (manual emergency fields) ─────────────────────────────────
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(doc(db, "users", userData.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const em = d.emergency || {};
      const clinical = d.clinical || {};

      setMedicalInfo({
        name: d.fullName || "User",
        bloodGroup: em.bloodGroup || "—",
        age: em.age || "",
        weight: em.weight || "",
        patientId: d.patientId || "MV-000000",
        emergencyPin: em.emergencyPin || "1234",
      });

      // Use manual conditions if set
      if ((em.conditions || []).length > 0) setConditions(em.conditions);
      if ((em.medications || []).length > 0) setMedications(em.medications);
      if ((em.allergies || []).length > 0) setAllergies(em.allergies);
      setContacts(em.contacts || []);

      // Now fetch latest AI analysis to fill any empty fields
      fetchLatestAiAnalysis(em, clinical);
    });
    return unsub;
  }, [userData?.uid]);

  // ── Fetch latest AI analysis and auto-fill empty fields ─────────────────────
  const fetchLatestAiAnalysis = async (em, clinical) => {
    if (!userData?.uid) return;
    try {
      const q = query(
        collection(db, "users", userData.uid, "aiAnalyses"),
        orderBy("analyzedAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return;
      const latest = snap.docs[0].data();
      applyAiAnalysis(latest, em, clinical);
    } catch (e) {
      console.log("AI analysis fetch error:", e);
    }
  };

  // Persist emergency data to Firestore
  const saveToFirestore = async (
    updatedInfo,
    updatedConditions,
    updatedMedications,
    updatedAllergies,
    updatedContacts,
  ) => {
    if (!userData?.uid) return;
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        "emergency.bloodGroup": updatedInfo.bloodGroup,
        "emergency.age": updatedInfo.age,
        "emergency.weight": updatedInfo.weight,
        "emergency.emergencyPin": updatedInfo.emergencyPin,
        "emergency.conditions": updatedConditions ?? conditions,
        "emergency.medications": updatedMedications ?? medications,
        "emergency.allergies": updatedAllergies ?? allergies,
        "emergency.contacts": updatedContacts ?? contacts,
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

  // ── Add item modal ───────────────────────────────────────────────────────────
  const [addModal, setAddModal] = useState({ visible: false, type: "", step: 1, partial: {} });

  const openAddModal = (type) => setAddModal({ visible: true, type, step: 1, partial: {} });

  const handleAddSave = (value) => {
    if (addModal.type === "medication") {
      // Format: "Name — Dose" or just "Name"
      const parts = value.split(/[—\-–]/);
      const name = parts[0].trim();
      const dose = parts[1] ? parts[1].trim() : "As prescribed";
      if (!name) { setAddModal({ ...addModal, visible: false }); return; }
      const newMeds = [...medications, { id: `med_${Date.now()}`, name, dose }];
      setMedications(newMeds);
      saveToFirestore(medicalInfo, conditions, newMeds, allergies, contacts);
    } else if (addModal.type === "allergy") {
      if (!value.trim()) { setAddModal({ ...addModal, visible: false }); return; }
      const newAllergies = [...allergies, { id: `alg_${Date.now()}`, name: value.trim(), severity: "Check with doctor" }];
      setAllergies(newAllergies);
      saveToFirestore(medicalInfo, conditions, medications, newAllergies, contacts);
    } else if (addModal.type === "contact_name") {
      // Step 1: name — go to step 2 for phone
      setAddModal({ ...addModal, type: "contact_phone", step: 2, partial: { name: value.trim() }, visible: true });
      return;
    } else if (addModal.type === "contact_phone") {
      const name = addModal.partial.name;
      const phone = value.trim();
      if (!name || !phone) { setAddModal({ ...addModal, visible: false }); return; }
      const newContacts = [...contacts, { id: `con_${Date.now()}`, name, phone, relation: "Family" }];
      setContacts(newContacts);
      saveToFirestore(medicalInfo, conditions, medications, allergies, newContacts);
    }
    setAddModal({ ...addModal, visible: false });
  };

  const deleteMedication = (id) => {
    const newMeds = medications.filter((m) => m.id !== id);
    setMedications(newMeds);
    saveToFirestore(medicalInfo, conditions, newMeds, allergies, contacts);
  };

  const deleteAllergy = (id) => {
    const newAllergies = allergies.filter((a) => a.id !== id);
    setAllergies(newAllergies);
    saveToFirestore(medicalInfo, conditions, medications, newAllergies, contacts);
  };

  const deleteContact = (id) => {
    const newContacts = contacts.filter((c) => c.id !== id);
    setContacts(newContacts);
    saveToFirestore(medicalInfo, conditions, medications, allergies, newContacts);
  };

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
    saveToFirestore(newInfo, newConditions, medications, allergies, contacts);
    setEditModal({ ...editModal, visible: false });
  };

  // --- PDF GENERATION ---
  const generatePDF = async () => {
    try {
      const conditionsHtml = conditions.length
        ? conditions.map((c) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-weight:700;">${c.title}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#64748B;">${c.subtitle || "—"}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#94A3B8;font-size:11px;">${c.history || "—"}</td>
          </tr>`).join("")
        : `<tr><td colspan="3" style="padding:12px;color:#94A3B8;text-align:center;">No conditions recorded</td></tr>`;

      const allergiesHtml = allergies.length
        ? allergies.map((a) => `
          <span style="display:inline-block;background:#FEF3C7;color:#92400E;border-radius:20px;padding:4px 12px;margin:3px;font-size:12px;font-weight:700;">
            ⚠️ ${a.name}${a.severity ? ` — ${a.severity}` : ""}
          </span>`).join("")
        : `<span style="color:#94A3B8;">No known allergies</span>`;

      const medsHtml = medications.length
        ? medications.map((m) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-weight:700;">${m.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#64748B;">${m.dose || "As prescribed"}</td>
          </tr>`).join("")
        : `<tr><td colspan="2" style="padding:12px;color:#94A3B8;text-align:center;">No medications recorded</td></tr>`;

      const contactsHtml = contacts.length
        ? contacts.map((c) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-weight:700;">${c.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#64748B;">${c.relation || "Contact"}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#2E75B6;font-weight:700;">${c.phone}</td>
          </tr>`).join("")
        : `<tr><td colspan="3" style="padding:12px;color:#94A3B8;text-align:center;">No emergency contacts recorded</td></tr>`;

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1E293B; background: #F8FAFC; }
    .page { max-width: 700px; margin: 0 auto; padding: 32px; }
    .header { background: linear-gradient(135deg, #C54242, #7F1D1D); color: white; border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
    .header p { font-size: 12px; opacity: 0.8; }
    .id-row { display: flex; gap: 16px; margin-top: 12px; }
    .id-chip { background: rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; }
    .patient-name { font-size: 26px; font-weight: 900; margin: 4px 0; }
    .vitals-row { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .vital-chip { background: rgba(255,255,255,0.15); border-radius: 12px; padding: 8px 16px; text-align: center; }
    .vital-label { font-size: 9px; opacity: 0.7; letter-spacing: 1px; text-transform: uppercase; }
    .vital-value { font-size: 18px; font-weight: 900; }
    .section { background: white; border-radius: 14px; margin-bottom: 16px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .section-title { padding: 14px 16px; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #64748B; background: #F8FAFC; border-bottom: 1px solid #F1F5F9; }
    table { width: 100%; border-collapse: collapse; }
    .allergies-box { padding: 14px 12px; }
    .footer { text-align: center; color: #94A3B8; font-size: 10px; margin-top: 24px; }
    .emergency-strip { background: #FEF2F2; border: 2px solid #FECACA; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; text-align: center; color: #B91C1C; font-weight: 900; font-size: 13px; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="emergency-strip">🚨 EMERGENCY MEDICAL RECORD — SHARE WITH FIRST RESPONDERS</div>

    <div class="header">
      <h1>Arogyasathi</h1>
      <p>AI-Powered Personal Health Record</p>
      <p class="patient-name">${medicalInfo.name.toUpperCase()}</p>
      <div class="id-row">
        <span class="id-chip">ID: ${medicalInfo.patientId}</span>
        <span class="id-chip">Generated: ${new Date().toLocaleDateString("en-IN")}</span>
      </div>
      <div class="vitals-row">
        <div class="vital-chip"><div class="vital-label">Blood Group</div><div class="vital-value">${medicalInfo.bloodGroup || "—"}</div></div>
        <div class="vital-chip"><div class="vital-label">Age</div><div class="vital-value">${medicalInfo.age || "—"}</div></div>
        <div class="vital-chip"><div class="vital-label">Weight</div><div class="vital-value">${medicalInfo.weight ? medicalInfo.weight + " kg" : "—"}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🫀 Medical Conditions</div>
      <table>
        <thead><tr style="background:#F8FAFC;font-size:10px;color:#94A3B8;font-weight:700;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Condition</th>
          <th style="padding:8px 12px;text-align:left;">Details</th>
          <th style="padding:8px 12px;text-align:left;">History</th>
        </tr></thead>
        <tbody>${conditionsHtml}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">💊 Current Medications</div>
      <table>
        <thead><tr style="background:#F8FAFC;font-size:10px;color:#94A3B8;font-weight:700;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Medication</th>
          <th style="padding:8px 12px;text-align:left;">Dosage</th>
        </tr></thead>
        <tbody>${medsHtml}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">⚠️ Allergies</div>
      <div class="allergies-box">${allergiesHtml}</div>
    </div>

    <div class="section">
      <div class="section-title">📞 Emergency Contacts</div>
      <table>
        <thead><tr style="background:#F8FAFC;font-size:10px;color:#94A3B8;font-weight:700;text-transform:uppercase;">
          <th style="padding:8px 12px;text-align:left;">Name</th>
          <th style="padding:8px 12px;text-align:left;">Relation</th>
          <th style="padding:8px 12px;text-align:left;">Phone</th>
        </tr></thead>
        <tbody>${contactsHtml}</tbody>
      </table>
    </div>

    <div class="footer">
      Generated by Arogyasathi • ${new Date().toLocaleString("en-IN")} • For medical emergencies only
    </div>
  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Emergency Medical Record",
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      Alert.alert("PDF Error", "Could not generate PDF: " + err.message);
    }
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
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {isEditing && (
            <TouchableOpacity onPress={() => { saveToFirestore(medicalInfo, conditions, medications, allergies, contacts); setIsEditing(false); }}>
              <MaterialCommunityIcons name="check-circle" size={28} color="#10B981" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => isEditing ? setIsEditing(false) : setIsEditing(true)}>
            <MaterialCommunityIcons name={isEditing ? "close-circle-outline" : "pencil-outline"} size={26} color="#2E75B6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("EmergencyCardSettings")}>
            <MaterialCommunityIcons name="shield-lock-outline" size={26} color="#C54242" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* --- AI AUTO-FILL BANNER --- */}
        {aiSynced && (
          <View style={styles.aiBanner}>
            <MaterialCommunityIcons name="robot-outline" size={16} color="#8B5CF6" />
            <Text style={styles.aiBannerText}>
              Auto-filled from your latest AI report scan. Tap ⚙️ to edit or correct any field.
            </Text>
          </View>
        )}

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
            <MaterialCommunityIcons name="alert-circle" size={20} color="#D14343" />
            <Text style={styles.allergyTitle}>SEVERE ALLERGIES</Text>
            {isEditing && (
              <TouchableOpacity
                onPress={() => openAddModal("allergy")}
                style={[styles.editChip, { marginLeft: "auto" }]}
              >
                <MaterialCommunityIcons name="plus" size={14} color="#2E75B6" />
                <Text style={styles.editChipText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.tagRow}>
            {allergies.map((a) => (
              <View key={a.id} style={[styles.tag, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Text style={styles.tagText}>{a.name} - {a.severity}</Text>
                {isEditing && (
                  <TouchableOpacity onPress={() => deleteAllergy(a.id)}>
                    <MaterialCommunityIcons name="close-circle" size={16} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* --- MEDICATIONS --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleAlt}>CURRENT MEDICATIONS</Text>
          {isEditing && (
            <TouchableOpacity
              onPress={() => openAddModal("medication")}
              style={styles.editChip}
            >
              <MaterialCommunityIcons name="plus" size={14} color="#2E75B6" />
              <Text style={styles.editChipText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.medBox}>
          {medications.map((m) => (
            <View key={m.id} style={styles.medRow}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <MaterialCommunityIcons name="pill" size={20} color="#2E75B6" />
                <Text style={styles.medName}>{m.name}</Text>
              </View>
              <Text style={styles.medDose}>{m.dose}</Text>
              {isEditing && (
                <TouchableOpacity onPress={() => deleteMedication(m.id)} style={{ marginLeft: 8 }}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {medications.length === 0 && (
            <View style={styles.medRow}>
              <Text style={{ color: "#94A3B8", fontSize: 13, padding: 4 }}>No medications recorded</Text>
            </View>
          )}
        </View>

        {/* --- EMERGENCY CONTACTS --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleAlt}>EMERGENCY CONTACTS</Text>
          {isEditing && (
            <TouchableOpacity
              onPress={() => openAddModal("contact_name")}
              style={styles.editChip}
            >
              <MaterialCommunityIcons name="plus" size={14} color="#2E75B6" />
              <Text style={styles.editChipText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {contacts.map((con) => (
          <View key={con.id} style={styles.contactCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={24} color="#64748B" />
              </View>
              <View>
                <Text style={styles.contactName}>{con.name}</Text>
                <Text style={styles.contactPhone}>{con.phone}</Text>
              </View>
            </View>
            {isEditing ? (
              <TouchableOpacity onPress={() => deleteContact(con.id)} style={{ padding: 8 }}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.callBtn} onPress={() => makeCall(con.phone)}>
                <MaterialCommunityIcons name="phone" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {contacts.length === 0 && !isEditing && (
          <Text style={{ color: "#94A3B8", fontSize: 13, marginBottom: 8 }}>No emergency contacts added</Text>
        )}

        {/* --- QR / SECURE CARD SECTION --- */}
        <View style={styles.qrCard}>
          {shareUrl ? (
            <>
              <View style={styles.securebadge}>
                <MaterialCommunityIcons name="shield-check" size={14} color="#059669" />
                <Text style={styles.secureBadgeText}>PASSWORD-PROTECTED LINK ACTIVE</Text>
              </View>
              <Text style={styles.qrLabel}>SCAN FOR EMERGENCY ACCESS</Text>
              <View style={styles.qrContainer}>
                <QRCode value={shareUrl} size={150} backgroundColor="white" color="#1E293B" />
              </View>
              <Text style={styles.qrFooter}>Password required to view records.</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={styles.qrActionBtn}
                  onPress={() => navigation.navigate("EmergencyCardView", { shareUrl })}
                >
                  <MaterialCommunityIcons name="qrcode" size={16} color="#2E75B6" />
                  <Text style={styles.qrActionText}>View Card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.qrActionBtn}
                  onPress={() => navigation.navigate("EmergencyCardSettings")}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color="#2E75B6" />
                  <Text style={styles.qrActionText}>Regenerate</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.qrLabel}>SECURE EMERGENCY CARD</Text>
              <MaterialCommunityIcons name="qrcode-plus" size={80} color="#CBD5E1" style={{ marginVertical: 16 }} />
              <Text style={[styles.qrFooter, { textAlign: "center", marginBottom: 12 }]}>
                Generate a password-protected QR link{"\n"}that first responders can scan.
              </Text>
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={() => navigation.navigate("EmergencyCardSettings")}
              >
                <MaterialCommunityIcons name="shield-lock" size={18} color="white" />
                <Text style={styles.generateBtnText}>Generate Secure Card</Text>
              </TouchableOpacity>
            </>
          )}
          <Text style={[styles.qrFooter, { marginTop: 10 }]}>
            Authorized medical personnel only • Secured by Arogyasathi
          </Text>
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

      {/* Add item modal */}
      <EditModal
        visible={addModal.visible}
        title={
          addModal.type === "medication" ? "Add Medication" :
          addModal.type === "allergy" ? "Add Allergy" :
          addModal.type === "contact_name" ? "Contact Name" :
          "Contact Phone Number"
        }
        initialValue=""
        placeholder={
          addModal.type === "medication" ? "e.g. Metformin — 500mg" :
          addModal.type === "allergy" ? "e.g. Penicillin" :
          addModal.type === "contact_name" ? "e.g. Ramesh Kumar" :
          "e.g. +91 98765 43210"
        }
        keyboardType={addModal.type === "contact_phone" ? "phone-pad" : "default"}
        onCancel={() => setAddModal({ ...addModal, visible: false })}
        onSave={handleAddSave}
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
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F3FF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
  },
  aiBannerText: { flex: 1, fontSize: 12, color: "#6D28D9", fontWeight: "600" },
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
  securebadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  secureBadgeText: { fontSize: 9, fontWeight: "900", color: "#059669", letterSpacing: 0.5 },
  qrActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingVertical: 10,
    borderRadius: 12,
  },
  qrActionText: { color: "#2E75B6", fontWeight: "700", fontSize: 13 },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#C54242",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  generateBtnText: { color: "white", fontWeight: "900", fontSize: 14 },
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
