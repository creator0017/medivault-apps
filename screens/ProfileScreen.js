import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import BottomTabBar from "../components/BottomTabBar";
import EditModal from "../components/EditModal";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";

export default function ProfileScreen({ navigation }) {
  const { userData, signOut } = useUser();
  const { isDark, toggleDark, theme, fontScale, changeFontScale, fm } = useTheme();

  // H-1 Fix: Use real data from Firestore via UserContext
  const [profile, setProfile] = useState({
    avatar: null,
  });

  const [clinical, setClinical] = useState({
    condition: "",
    meds: "",
    allergies: "",
  });

  // Load clinical data from Firestore in real-time
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(doc(db, "users", userData.uid), (snap) => {
      if (!snap.exists()) return;
      const c = snap.data().clinical || {};
      setClinical({
        condition: c.condition || "",
        meds: c.meds || "",
        allergies: c.allergies || "",
      });
    });
    return unsub;
  }, [userData?.uid]);

  // C-6 Fix: EditModal state (replaces Alert.prompt)
  const [editModal, setEditModal] = useState({
    visible: false,
    title: "",
    field: "",
    initialValue: "",
  });

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfile({ ...profile, avatar: result.assets[0].uri });
    }
  };

  // C-6 Fix: Cross-platform edit handler using EditModal
  const openEdit = (title, field, currentValue) => {
    setEditModal({
      visible: true,
      title: `Edit ${title}`,
      field,
      initialValue: currentValue,
    });
  };

  const handleEditSave = async (value) => {
    const field = editModal.field;
    if (field === "password") {
      Alert.alert("Success", "Password update would require re-authentication.");
    } else {
      setClinical({ ...clinical, [field]: value });
      // Persist to Firestore if user is authenticated
      if (userData?.uid) {
        try {
          await updateDoc(doc(db, "users", userData.uid), {
            [`clinical.${field}`]: value,
          });
        } catch (e) {
          console.log("Update error:", e);
        }
      }
    }
    setEditModal({ ...editModal, visible: false });
  };

  // C-3 Fix: Proper Firebase signOut
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await signOut();
            navigation.replace("Login");
          } catch (error) {
            Alert.alert("Error", "Could not sign out. Please try again.");
          }
        },
      },
    ]);
  };

  // Reusable row component
  const SettingRow = ({
    icon,
    title,
    value,
    color = "#2E75B6",
    onPress,
    isLast,
  }) => (
    <View>
      <TouchableOpacity style={styles.row} onPress={onPress}>
        <View style={[styles.iconBg, { backgroundColor: color + "15" }]}>
          <MaterialCommunityIcons name={icon} size={22} color={color} />
        </View>
        <View style={styles.rowTextContainer}>
          <Text style={styles.rowTitle}>{title}</Text>
          {value && <Text style={styles.rowValue}>{value}</Text>}
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#CBD5E1"
        />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerSpacer} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color="#2E75B6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* AVATAR SECTION — H-1 Fix: Dynamic data */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              {profile.avatar ? (
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatarImg}
                />
              ) : (
                <MaterialCommunityIcons
                  name="account"
                  size={70}
                  color="#CBD5E1"
                />
              )}
            </View>
            <TouchableOpacity style={styles.editIcon} onPress={pickImage}>
              <MaterialCommunityIcons name="camera" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.healthId}>
            {userData?.patientId || "MV-000000"}
          </Text>
          <Text style={styles.userName}>
            {userData?.fullName || "Loading..."}
          </Text>
          <Text style={styles.userStats}>
            {userData?.phone || ""} | {userData?.email || ""}
          </Text>
        </View>

        {/* ACCOUNT SECURITY */}
        <Text style={styles.sectionLabel}>ACCOUNT SECURITY</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SettingRow
            icon="phone"
            title="Phone Number"
            value={userData?.phone || "Not set"}
          />
          <SettingRow
            icon="email"
            title="Email"
            value={userData?.email || "Not set"}
          />
          <SettingRow
            icon="lock-reset"
            title="Change Password"
            onPress={() =>
              openEdit("Password", "password", "")
            }
            isLast
          />
        </View>

        {/* CLINICAL PROFILE */}
        <Text style={styles.sectionLabel}>CLINICAL PROFILE</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SettingRow
            icon="heart-pulse"
            title="Primary Condition"
            value={clinical.condition}
            color="#EF4444"
            onPress={() =>
              openEdit("Condition", "condition", clinical.condition)
            }
          />
          <SettingRow
            icon="pill"
            title="Medications"
            value={clinical.meds}
            color="#10B981"
            onPress={() => openEdit("Medications", "meds", clinical.meds)}
          />
          <SettingRow
            icon="alert-octagon"
            title="Allergies"
            value={clinical.allergies}
            color="#F59E0B"
            onPress={() =>
              openEdit("Allergies", "allergies", clinical.allergies)
            }
            isLast
          />
        </View>

        {/* APP PREFERENCES */}
        <Text style={styles.sectionLabel}>APP PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {/* Dark Mode toggle */}
          <View style={styles.row}>
            <View style={[styles.iconBg, { backgroundColor: "#64748B15" }]}>
              <MaterialCommunityIcons name="theme-light-dark" size={22} color="#64748B" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Dark Mode</Text>
              <Text style={[styles.rowValue, { color: theme.muted }]}>{isDark ? "On" : "Off"}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: "#CBD5E1", true: "#2E75B6" }}
              thumbColor={isDark ? "#FFF" : "#F1F5F9"}
            />
          </View>

          <View style={styles.divider} />

          {/* Font Size */}
          <View style={styles.row}>
            <View style={[styles.iconBg, { backgroundColor: "#64748B15" }]}>
              <MaterialCommunityIcons name="format-size" size={22} color="#64748B" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Font Size</Text>
              <View style={styles.fontBtnRow}>
                {["small", "normal", "large"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.fontBtn, fontScale === s && styles.fontBtnActive]}
                    onPress={() => changeFontScale(s)}
                  >
                    <Text style={[styles.fontBtnText, fontScale === s && styles.fontBtnTextActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Language */}
          <View style={[styles.row]}>
            <View style={[styles.iconBg, { backgroundColor: "#64748B15" }]}>
              <MaterialCommunityIcons name="translate" size={22} color="#64748B" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Language</Text>
              <Text style={[styles.rowValue, { color: theme.muted }]}>English</Text>
            </View>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
          </View>
        </View>

        {/* FAMILY ACCESS */}
        <Text style={styles.sectionLabel}>FAMILY ACCESS</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SettingRow
            icon="account-group"
            title="Manage Family Members"
            value="View Hub"
            onPress={() => navigation.navigate("Family")}
            isLast
          />
        </View>

        {/* DATA & STORAGE */}
        <Text style={styles.sectionLabel}>DATA & STORAGE</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SettingRow
            icon="cloud-download"
            title="Export Health Data"
            color="#64748B"
            onPress={() =>
              Alert.alert(
                "Export",
                "Your medical data is being compiled for download.",
              )
            }
          />
          {/* C-3 Fix: Proper logout */}
          <SettingRow
            icon="logout"
            title="Logout"
            color="#EF4444"
            onPress={handleLogout}
            isLast
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* C-6 Fix: Cross-platform EditModal */}
      <EditModal
        visible={editModal.visible}
        title={editModal.title}
        initialValue={editModal.initialValue}
        placeholder="Enter new value"
        onCancel={() => setEditModal({ ...editModal, visible: false })}
        onSave={handleEditSave}
      />

      {/* M-4 Fix: Shared BottomTabBar */}
      <BottomTabBar navigation={navigation} activeTab="Profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerSpacer: { height: "5%" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#FFF",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  scrollBody: { padding: 20 },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatarContainer: { width: 120, height: 120 },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#FFF",
  },
  avatarImg: { width: "100%", height: "100%" },
  editIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#2E75B6",
    padding: 10,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: "#FFF",
  },
  healthId: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    marginTop: 15,
    letterSpacing: 2,
  },
  userName: { fontSize: 24, fontWeight: "900", color: "#1E293B", marginTop: 5 },
  userStats: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    marginTop: 25,
    marginBottom: 12,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 25,
    padding: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  row: { flexDirection: "row", alignItems: "center", padding: 15 },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rowTextContainer: { flex: 1, marginLeft: 15 },
  rowTitle: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  rowValue: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#F8FAFC", marginLeft: 70 },
  fontBtnRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  fontBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  fontBtnActive: { backgroundColor: "#2E75B6", borderColor: "#2E75B6" },
  fontBtnText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  fontBtnTextActive: { color: "#FFF" },
  muted: { color: "#94A3B8" },
});
