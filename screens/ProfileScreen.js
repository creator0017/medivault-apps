import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function ProfileScreen({ navigation }) {
  // --- STATE MANAGEMENT ---
  const [profile, setProfile] = useState({
    name: "Ramesh Kumar",
    id: "MV-882910",
    age: "55",
    bloodGroup: "O+",
    phone: "+91 98765 43210",
    email: "ramesh.k@medivault.in",
    avatar: null,
  });

  const [clinical, setClinical] = useState({
    condition: "Type 2 Diabetes",
    meds: "3 Active",
    allergies: "Penicillin",
  });

  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- LOGIC HANDLERS ---
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

  const handleChangePassword = () => {
    Alert.prompt("Change Password", "Enter your new password", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Update",
        onPress: () => Alert.alert("Success", "Password updated!"),
      },
    ]);
  };

  const handleEditClinical = (field, currentVal) => {
    Alert.prompt(
      `Edit ${field}`,
      `Update your ${field}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: (text) => {
            const key = field.toLowerCase().includes("condition")
              ? "condition"
              : field.toLowerCase().includes("meds")
                ? "meds"
                : "allergies";
            setClinical({ ...clinical, [key]: text });
          },
        },
      ],
      "plain-text",
      currentVal,
    );
  };

  // --- REUSABLE ROW COMPONENT ---
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
    <SafeAreaView style={styles.container}>
      {/* HEADER: Moved down 5% via spacer */}
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
        {/* AVATAR SECTION */}
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
          <Text style={styles.healthId}>{profile.id}</Text>
          <Text style={styles.userName}>{profile.name}</Text>
          <Text style={styles.userStats}>
            Age {profile.age} | {profile.bloodGroup} | Male
          </Text>
        </View>

        {/* ACCOUNT SECURITY */}
        <Text style={styles.sectionLabel}>ACCOUNT SECURITY</Text>
        <View style={styles.card}>
          <SettingRow
            icon="phone"
            title="Phone Number"
            value={profile.phone}
            onPress={() => Alert.alert("Phone", profile.phone)}
          />
          <SettingRow
            icon="email"
            title="Email"
            value={profile.email}
            onPress={() => Alert.alert("Email", profile.email)}
          />
          <SettingRow
            icon="lock-reset"
            title="Change Password"
            onPress={handleChangePassword}
            isLast
          />
        </View>

        {/* CLINICAL PROFILE */}
        <Text style={styles.sectionLabel}>CLINICAL PROFILE</Text>
        <View style={styles.card}>
          <SettingRow
            icon="heart-pulse"
            title="Primary Condition"
            value={clinical.condition}
            color="#EF4444"
            onPress={() => handleEditClinical("Condition", clinical.condition)}
          />
          <SettingRow
            icon="pill"
            title="Medications"
            value={clinical.meds}
            color="#10B981"
            onPress={() => handleEditClinical("Meds", clinical.meds)}
          />
          <SettingRow
            icon="alert-octagon"
            title="Allergies"
            value={clinical.allergies}
            color="#F59E0B"
            onPress={() => handleEditClinical("Allergies", clinical.allergies)}
            isLast
          />
        </View>

        {/* APP PREFERENCES */}
        <Text style={styles.sectionLabel}>APP PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBg, { backgroundColor: "#64748B15" }]}>
              <MaterialCommunityIcons
                name="theme-light-dark"
                size={22}
                color="#64748B"
              />
            </View>
            <Text style={[styles.rowTitle, { flex: 1 }]}>Dark Mode</Text>
            <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
          </View>
          <View style={styles.divider} />
          <SettingRow
            icon="translate"
            title="Language"
            value="English"
            color="#64748B"
            onPress={() =>
              Alert.alert("Language", "Select: English, Hindi, or Spanish")
            }
            isLast
          />
        </View>

        {/* FAMILY ACCESS */}
        <Text style={styles.sectionLabel}>FAMILY ACCESS</Text>
        <View style={styles.card}>
          <SettingRow
            icon="account-group"
            title="Manage Family Members"
            value="2 Active"
            onPress={() =>
              Alert.alert("Family", "Managing Rajesh and Priya's access.")
            }
            isLast
          />
        </View>

        {/* DATA & STORAGE */}
        <Text style={styles.sectionLabel}>DATA & STORAGE</Text>
        <View style={styles.card}>
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
          <SettingRow
            icon="logout"
            title="Logout"
            color="#EF4444"
            onPress={() =>
              Alert.alert("Logout", "Are you sure?", [
                { text: "Cancel" },
                { text: "Logout", onPress: () => navigation.replace("Login") },
              ])
            }
            isLast
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* --- TAB BAR --- */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Home")}
        >
          <MaterialCommunityIcons
            name="home-variant-outline"
            size={28}
            color="#CBD5E1"
          />
          <Text style={styles.tabText}>HOME</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={28}
            color="#CBD5E1"
          />
          <Text style={styles.tabText}>REPORTS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="account" size={28} color="#2E75B6" />
          <Text style={[styles.tabText, { color: "#2E75B6" }]}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerSpacer: { height: "5%" }, // Moves everything down 5%
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
  userStats: { fontSize: 14, color: "#64748B", marginTop: 5 },
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
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "#FFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  tabItem: { alignItems: "center" },
  tabText: { fontSize: 10, fontWeight: "900", marginTop: 4, color: "#CBD5E1" },
});
