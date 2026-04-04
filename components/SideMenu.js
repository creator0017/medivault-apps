import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useUser } from "../context/UserContext";

const { width, height } = Dimensions.get("window");

// Sub-component for Menu Items
const MenuItem = ({ icon, title, active = false, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.menuItem, active && styles.activeItem]}
  >
    <View style={styles.menuLeft}>
      <View
        style={[
          styles.iconBox,
          active ? styles.activeIconBox : styles.inactiveIconBox,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={active ? "#2E75B6" : "#64748B"}
        />
      </View>
      <Text style={[styles.menuText, active && styles.activeMenuText]}>
        {title}
      </Text>
    </View>
    <MaterialCommunityIcons
      name="chevron-right"
      size={18}
      color={active ? "#3B82F6" : "#CBD5E1"}
    />
  </TouchableOpacity>
);

export default function SideMenu({ visible, onClose, navigation }) {
  const { userData, signOut } = useUser();

  const handleNavigation = (routeName) => {
    onClose();
    navigation.navigate(routeName);
  };

  // C-3 Fix: Proper Firebase signOut
  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          onClose();
          try {
            await signOut();
            navigation.replace("Login");
          } catch (error) {
            Alert.alert("Error", "Could not sign out.");
          }
        },
      },
    ]);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Drawer Content */}
        <View style={styles.drawer}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.avatarBox}>
              <MaterialCommunityIcons
                name="account"
                size={45}
                color="#D97706"
              />
            </View>
            <View>
              <Text style={styles.userName}>
                {userData?.fullName || "MediVault User"}
              </Text>
              <Text style={styles.userId}>
                Patient ID: {userData?.patientId || "---"}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Navigation</Text>

            <MenuItem
              icon="home-outline"
              title="Home"
              active={true}
              onPress={onClose}
            />

            <MenuItem
              icon="file-document-outline"
              title="My Reports"
              onPress={() => handleNavigation("Reports")}
            />

            <MenuItem
              icon="robot-outline"
              title="AI Health Assistant"
              onPress={() => handleNavigation("AI")}
            />

            {/* FIXED: Family Monitoring Connection */}
            <MenuItem
              icon="account-group-outline"
              title="Family Hub"
              onPress={() => handleNavigation("Family")}
            />

            <MenuItem
              icon="card-account-details-outline"
              title="Emergency Card"
              onPress={() => handleNavigation("Emergency")}
            />

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Support</Text>

            <MenuItem
              icon="cog-outline"
              title="Settings"
              onPress={() => handleNavigation("Profile")}
            />

            <MenuItem
              icon="logout"
              title="Sign Out"
              onPress={handleSignOut}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.versionText}>MEDIVAULT V2.0</Text>
          </View>
        </View>

        {/* Backdrop Area to close menu when tapping outside */}
        <TouchableOpacity
          style={styles.closeArea}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)", // Darker backdrop for better focus
    flexDirection: "row",
  },
  closeArea: { flex: 1 },
  drawer: {
    width: width * 0.8,
    height: height,
    backgroundColor: "#FFF",
    borderTopRightRadius: 35,
    borderBottomRightRadius: 35,
    padding: 25,
    paddingTop: 50,
    elevation: 25,
    shadowColor: "#000",
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  closeBtn: { alignSelf: "flex-end", padding: 5 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 35 },
  avatarBox: {
    width: 65,
    height: 65,
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userName: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  userId: { fontSize: 12, color: "#94A3B8", fontWeight: "bold", marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#CBD5E1",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 15,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  activeItem: { backgroundColor: "#F0F7FF" },
  iconBox: { padding: 8, borderRadius: 12 },
  inactiveIconBox: { backgroundColor: "#F8FAFC" },
  activeIconBox: { backgroundColor: "#DBEAFE" },
  menuText: {
    marginLeft: 15,
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  activeMenuText: { color: "#2E75B6" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 20 },
  footer: {
    marginTop: "auto",
    paddingBottom: 20,
    alignItems: "center",
  },
  versionText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#E2E8F0",
    letterSpacing: 2,
  },
});
