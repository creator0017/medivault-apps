import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
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
  const [generating, setGenerating] = useState(false);

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
    const success = await applyAutoFill();
    if (success) {
      Alert.alert("Success", "Auto-filled from latest lab reports");
    } else {
      Alert.alert("Info", "No recent lab reports found");
    }
  };

  const generateSecureCard = async () => {
    if (!password) {
      Alert.alert("Error", "Please enter your account password");
      return;
    }

    setGenerating(true);
    try {
      const result = await createShareLink(password);
      setShowPasswordModal(false);
      navigation.navigate("EmergencyCardView", { shareUrl: result.shareUrl });
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to generate secure card");
    } finally {
      setGenerating(false);
      setPassword("");
    }
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
            <TouchableOpacity
              onPress={() => {
                Alert.prompt(
                  "Add Medication",
                  "Enter medication name and dosage",
                  (text) => {
                    if (text) {
                      const [name, ...doseParts] = text.split(" - ");
                      addItem("medications", {
                        name: name || text,
                        dose: doseParts.join(" - ") || "As prescribed",
                      });
                    }
                  },
                );
              }}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={24}
                color="#2E75B6"
              />
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
            <TouchableOpacity
              onPress={() => {
                Alert.prompt("Add Allergy", "Enter allergen name", (text) => {
                  if (text)
                    addItem("allergies", { name: text, severity: "Severe" });
                });
              }}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={24}
                color="#2E75B6"
              />
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
              <TouchableOpacity
                onPress={() => {
                  if (formData.contacts.length >= 3) {
                    Alert.alert("Limit reached", "Maximum 3 contacts allowed");
                    return;
                  }
                  Alert.prompt("Contact Name", "Enter name", (name) => {
                    if (name) {
                      Alert.prompt("Phone Number", "Enter phone", (phone) => {
                        if (phone) {
                          Alert.prompt(
                            "Relation",
                            "e.g., Son, Doctor",
                            (relation) => {
                              addItem("contacts", {
                                name,
                                phone,
                                relation: relation || "Family",
                              });
                            },
                          );
                        }
                      });
                    }
                  });
                }}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={24}
                  color="#2E75B6"
                />
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
          onPress={() => setShowPasswordModal(true)}
        >
          <MaterialCommunityIcons name="qrcode" size={24} color="white" />
          <Text style={styles.generateBtnText}>
            Generate Secure Emergency Card
          </Text>
        </TouchableOpacity>
      </View>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Identity</Text>
            <Text style={styles.modalText}>
              Enter your account password to generate a secure shareable
              emergency card.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter password"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={generateSecureCard}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.confirmBtnText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
});
