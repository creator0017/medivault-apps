import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useUser } from "../context/UserContext";
import { useEmergencyCard } from "../hooks/useEmergencyCard";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function EmergencyCardSettings({ navigation }) {
  const { userData } = useUser();
  const { cardData, loading, applyAutoFill, updateCard, createShareLink } =
    useEmergencyCard(userData?.uid);

  const [formData, setFormData] = useState({
    bloodGroup: "",
    height: "",
    weight: "",
    age: "",
    pin: "",
    medications: [],
    allergies: [],
    contacts: [],
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Cross-platform add-item modals (replaces iOS-only Alert.prompt) ────────
  // Medication modal
  const [showMedModal, setShowMedModal] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedDose, setNewMedDose] = useState("");

  // Allergy modal
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [newAllergyName, setNewAllergyName] = useState("");

  // Contact modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRelation, setNewContactRelation] = useState("");

  const handleAddMedication = () => {
    if (!newMedName.trim()) return;
    addItem("medications", {
      name: newMedName.trim(),
      dose: newMedDose.trim() || "As prescribed",
    });
    setNewMedName("");
    setNewMedDose("");
    setShowMedModal(false);
  };

  const handleAddAllergy = () => {
    if (!newAllergyName.trim()) return;
    addItem("allergies", { name: newAllergyName.trim(), severity: "Severe" });
    setNewAllergyName("");
    setShowAllergyModal(false);
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert("Required", "Name and phone number are required.");
      return;
    }
    addItem("contacts", {
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relation: newContactRelation.trim() || "Family",
    });
    setNewContactName("");
    setNewContactPhone("");
    setNewContactRelation("");
    setShowContactModal(false);
  };

  useEffect(() => {
    if (cardData) {
      setFormData({
        bloodGroup: cardData.bloodGroup || "",
        height: cardData.height?.toString() || "",
        weight: cardData.weight?.toString() || "",
        age: cardData.age?.toString() || "",
        pin: cardData.pin || "",
        medications: cardData.medications || [],
        allergies: cardData.allergies || [],
        contacts: cardData.contacts || [],
      });

      // Auto-fill silently on first load if card is empty and AI data is available
      const isEmpty =
        !cardData.bloodGroup &&
        (!cardData.age || cardData.age === 0) &&
        (!cardData.medications || cardData.medications.length === 0) &&
        (!cardData.allergies || cardData.allergies.length === 0) &&
        (!cardData.conditions || cardData.conditions.length === 0);
      if (isEmpty && !cardData.lastAutoFill) {
        applyAutoFill().catch(() => {});
      }
    }
  }, [cardData]);

  const handleSave = async () => {
    try {
      await updateCard({
        bloodGroup: formData.bloodGroup,
        height: parseInt(formData.height) || 0,
        weight: parseInt(formData.weight) || 0,
        age: parseInt(formData.age) || 0,
        pin: formData.pin,
        medications: formData.medications,
        allergies: formData.allergies,
        contacts: formData.contacts,
      });
      Alert.alert("Success", "Emergency card updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to save changes");
    }
  };

  const handleAutoFill = async () => {
    try {
      const result = await applyAutoFill();
      const status = result?.status;

      if (status === "filled") {
        Alert.alert("Success", "Emergency card auto-filled from your AI analysis.");
      } else if (status === "already_filled") {
        Alert.alert("Up to Date", "Your card already has all the available data from your reports.");
      } else if (status === "no_analysis") {
        Alert.alert(
          "Analyze Report First",
          "You have uploaded reports but haven't analyzed them with AI yet. Please go to your Reports and tap 'Analyze with AI' to extract your health data.",
          [
            { text: "OK" },
            {
              text: "Go to Reports",
              onPress: () => navigation.navigate("Reports"),
            },
          ]
        );
      } else {
        Alert.alert(
          "No Reports Found",
          "Please upload a lab report first, then analyze it with AI so your health data can be extracted.",
          [
            { text: "OK" },
            {
              text: "Upload Report",
              onPress: () => navigation.navigate("Upload"),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to auto-fill. Please try again.");
    }
  };

  const generateSecureCard = async () => {
    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
      Alert.alert("Invalid PIN", "Please enter exactly 4 digits (numbers only)");
      return;
    }

    setGenerating(true);
    try {
      // Pass the new PIN — hook will update it if different from existing
      const result = await createShareLink(userData, password);
      setShowPasswordModal(false);
      setIsChangingPin(false);
      Alert.alert(
        "Card Generated!",
        `Your emergency card is ready.\n\n🔑 PIN: ${password}\n\nAnyone who opens the link will need this PIN to view your records. Keep this PIN safe!`,
        [{ text: "View Card", onPress: () => navigation.navigate("EmergencyCardView", { shareUrl: result.shareUrl }) }],
      );
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to generate secure card");
    } finally {
      setGenerating(false);
      setPassword("");
    }
  };

  const generateSecureCardWithPin = async (pin) => {
    setGenerating(true);
    try {
      const result = await createShareLink(userData, pin);
      setShowPasswordModal(false);
      setIsChangingPin(false);
      Alert.alert(
        "Card Generated!",
        `Your emergency card is ready.\n\n🔑 PIN: ${pin}\n\nAnyone who opens the link will need this PIN to view your records.`,
        [{ text: "View Card", onPress: () => navigation.navigate("EmergencyCardView", { shareUrl: result.shareUrl }) }],
      );
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to generate secure card");
    } finally {
      setGenerating(false);
    }
  };

  const openPinModal = () => {
    setIsChangingPin(false);
    setPassword(cardData?.pin || "");
    setShowPasswordModal(true);
  };

  const addItem = (type, item) => {
    setFormData((prev) => ({
      ...prev,
      [type]: [...prev[type], { ...item, id: `${type}_${Date.now()}` }],
    }));
  };

  const removeItem = (type, id) => {
    setFormData((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== id),
    }));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#C54242" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#2E75B6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMERGENCY CARD SETTINGS</Text>
        <TouchableOpacity onPress={handleSave}>
          <MaterialCommunityIcons name="check" size={28} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Auto-fill Button */}
        <TouchableOpacity style={styles.autoFillBtn} onPress={handleAutoFill}>
          <MaterialCommunityIcons name="robot" size={24} color="#8B5CF6" />
          <Text style={styles.autoFillText}>Auto-fill from Lab Reports</Text>
        </TouchableOpacity>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Blood Group</Text>
          <View style={styles.bloodGroupRow}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[
                  styles.bloodGroupChip,
                  formData.bloodGroup === bg && styles.bloodGroupChipActive,
                ]}
                onPress={() => setFormData({ ...formData, bloodGroup: bg })}
              >
                <Text
                  style={[
                    styles.bloodGroupChipText,
                    formData.bloodGroup === bg && styles.bloodGroupChipTextActive,
                  ]}
                >
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.halfColumn}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={formData.height}
                onChangeText={(text) =>
                  setFormData({ ...formData, height: text })
                }
                keyboardType="numeric"
                placeholder="170"
              />
            </View>
            <View style={styles.halfColumn}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={formData.weight}
                onChangeText={(text) =>
                  setFormData({ ...formData, weight: text })
                }
                keyboardType="numeric"
                placeholder="75"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfColumn}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={formData.age}
                onChangeText={(text) => setFormData({ ...formData, age: text })}
                keyboardType="numeric"
                placeholder="45"
              />
            </View>
            <View style={styles.halfColumn}>
              <Text style={styles.label}>Emergency PIN</Text>
              <TextInput
                style={styles.input}
                value={formData.pin}
                onChangeText={(text) => setFormData({ ...formData, pin: text })}
                keyboardType="numeric"
                maxLength={4}
                placeholder="4-digit PIN"
              />
            </View>
          </View>
        </View>

        {/* Medications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Current Medications</Text>
            <TouchableOpacity onPress={() => setShowMedModal(true)}>
              <MaterialCommunityIcons name="plus-circle" size={24} color="#2E75B6" />
            </TouchableOpacity>
          </View>
          {formData.medications.map((med) => (
            <View key={med.id} style={styles.listItem}>
              <View>
                <Text style={styles.itemTitle}>{med.name}</Text>
                <Text style={styles.itemSub}>{med.dose}</Text>
              </View>
              <TouchableOpacity
                onPress={() => removeItem("medications", med.id)}
              >
                <MaterialCommunityIcons
                  name="delete"
                  size={20}
                  color="#EF4444"
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Allergies */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Allergies</Text>
            <TouchableOpacity onPress={() => setShowAllergyModal(true)}>
              <MaterialCommunityIcons name="plus-circle" size={24} color="#2E75B6" />
            </TouchableOpacity>
          </View>
          <View style={styles.tagsContainer}>
            {formData.allergies.map((alg) => (
              <View key={alg.id} style={styles.tag}>
                <Text style={styles.tagText}>{alg.name}</Text>
                <TouchableOpacity
                  onPress={() => removeItem("allergies", alg.id)}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={16}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts (Max 3)</Text>
            {formData.contacts.length < 3 && (
              <TouchableOpacity onPress={() => setShowContactModal(true)}>
                <MaterialCommunityIcons name="plus-circle" size={24} color="#2E75B6" />
              </TouchableOpacity>
            )}
          </View>
          {formData.contacts.map((con) => (
            <View key={con.id} style={styles.contactItem}>
              <View>
                <Text style={styles.itemTitle}>{con.name}</Text>
                <Text style={styles.itemSub}>
                  {con.relation} • {con.phone}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeItem("contacts", con.id)}>
                <MaterialCommunityIcons
                  name="delete"
                  size={20}
                  color="#EF4444"
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={openPinModal}
        >
          <MaterialCommunityIcons name="qrcode" size={24} color="white" />
          <Text style={styles.generateBtnText}>
            Generate Secure Emergency Card
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── PIN Modal (Generate Secure Card) ── */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {cardData?.pin && !isChangingPin ? "🔒 PIN Already Set" : "🔑 Set Emergency PIN"}
            </Text>

            {cardData?.pin && !isChangingPin ? (
              /* Existing PIN — offer to use it or change */
              <>
                <View style={styles.existingPinBox}>
                  <Text style={styles.existingPinLabel}>Your current PIN</Text>
                  <Text style={styles.existingPinValue}>{cardData.pin}</Text>
                </View>
                <Text style={styles.modalText}>
                  This PIN is required to open your shared emergency card. Keep it safe and share it separately with trusted people.
                </Text>
                <TouchableOpacity
                  style={styles.changePinLink}
                  onPress={() => { setIsChangingPin(true); setPassword(""); }}
                >
                  <MaterialCommunityIcons name="pencil" size={16} color="#2E75B6" />
                  <Text style={styles.changePinLinkText}>Set a different PIN</Text>
                </TouchableOpacity>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => { setShowPasswordModal(false); setPassword(""); setIsChangingPin(false); }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.confirmBtn]}
                    onPress={() => generateSecureCardWithPin(cardData.pin)}
                    disabled={generating}
                  >
                    {generating ? <ActivityIndicator color="white" /> : <Text style={styles.confirmBtnText}>Use This PIN</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* No PIN or changing PIN */
              <>
                <Text style={styles.modalText}>
                  {isChangingPin
                    ? "Enter a new 4-digit PIN. This will replace your old PIN on the shared card."
                    : "Choose any 4-digit number as your PIN. Anyone who opens the shared link will need to enter this PIN."}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={password}
                  onChangeText={(t) => setPassword(t.replace(/\D/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry={false}
                  placeholder="Enter any 4-digit PIN (e.g. 4821)"
                  autoFocus
                />
                <Text style={styles.pinHint}>e.g. 1234, 9087, 4512 — any 4 numbers you can remember</Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => {
                      if (isChangingPin && cardData?.pin) {
                        setIsChangingPin(false);
                        setPassword(cardData.pin);
                      } else {
                        setShowPasswordModal(false);
                        setPassword("");
                        setIsChangingPin(false);
                      }
                    }}
                  >
                    <Text style={styles.cancelBtnText}>{isChangingPin ? "Back" : "Cancel"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.confirmBtn]}
                    onPress={generateSecureCard}
                    disabled={generating || password.length !== 4}
                  >
                    {generating ? <ActivityIndicator color="white" /> : <Text style={styles.confirmBtnText}>Set PIN & Generate</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Medication Modal (Cross-platform, replaces Alert.prompt) ── */}
      <Modal visible={showMedModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Medication</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Medication name (e.g. Metformin)"
              value={newMedName}
              onChangeText={setNewMedName}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Dose (e.g. 500mg twice daily)"
              value={newMedDose}
              onChangeText={setNewMedDose}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => { setShowMedModal(false); setNewMedName(""); setNewMedDose(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleAddMedication}>
                <Text style={styles.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Allergy Modal (Cross-platform, replaces Alert.prompt) ── */}
      <Modal visible={showAllergyModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Allergy</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Allergen name (e.g. Penicillin)"
              value={newAllergyName}
              onChangeText={setNewAllergyName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => { setShowAllergyModal(false); setNewAllergyName(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleAddAllergy}>
                <Text style={styles.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Contact Modal (Cross-platform, replaces 3 nested Alert.prompts) ── */}
      <Modal visible={showContactModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Full name *"
              value={newContactName}
              onChangeText={setNewContactName}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone number * (e.g. +91 98765 43210)"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Relation (e.g. Son, Doctor, Spouse)"
              value={newContactRelation}
              onChangeText={setNewContactRelation}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => { setShowContactModal(false); setNewContactName(""); setNewContactPhone(""); setNewContactRelation(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleAddContact}>
                <Text style={styles.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  content: { padding: 20 },
  autoFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
  },
  autoFillText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#6D28D9",
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    marginBottom: 12,
  },
  bloodGroupRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  bloodGroupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  bloodGroupChipActive: {
    borderColor: "#C54242",
    backgroundColor: "#FEE2E2",
  },
  bloodGroupChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  bloodGroupChipTextActive: {
    color: "#C54242",
  },
  row: { flexDirection: "row", gap: 12 },
  halfColumn: { flex: 1 },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  itemTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  itemSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C54242",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: { color: "white", fontWeight: "700", fontSize: 13 },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  generateBtn: {
    backgroundColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  generateBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 8,
  },
  modalText: { fontSize: 14, color: "#64748B", marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  cancelBtn: { backgroundColor: "#F1F5F9" },
  cancelBtnText: { color: "#64748B", fontWeight: "700" },
  confirmBtn: { backgroundColor: "#C54242" },
  confirmBtnText: { color: "white", fontWeight: "700" },
  existingPinBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#BFDBFE",
  },
  existingPinLabel: { fontSize: 12, color: "#3B82F6", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  existingPinValue: { fontSize: 36, fontWeight: "900", color: "#1E40AF", letterSpacing: 8, marginTop: 4 },
  changePinLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    marginBottom: 16,
  },
  changePinLinkText: { color: "#2E75B6", fontWeight: "700", fontSize: 14 },
  pinHint: { fontSize: 12, color: "#94A3B8", marginTop: -8, marginBottom: 16 },
});
