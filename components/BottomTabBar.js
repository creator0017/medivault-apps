import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const TABS = [
  { name: "Home", icon: "home-variant-outline", activeIcon: "home-variant" },
  {
    name: "Reports",
    icon: "file-document-outline",
    activeIcon: "file-document",
  },
  { name: "FAB", icon: "plus", isFab: true },
  {
    name: "Family",
    icon: "account-group-outline",
    activeIcon: "account-group",
  },
  { name: "Profile", icon: "account-outline", activeIcon: "account" },
];

export default function BottomTabBar({ navigation, activeTab = "Home" }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        if (tab.isFab) {
          return (
            <TouchableOpacity
              key="fab"
              style={styles.fab}
              onPress={() => navigation.navigate("UploadReport")}
            >
              <MaterialCommunityIcons name="plus" size={35} color="#FFF" />
            </TouchableOpacity>
          );
        }

        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => navigation.navigate(tab.name)}
          >
            <MaterialCommunityIcons
              name={isActive ? tab.activeIcon : tab.icon}
              size={28}
              color={isActive ? "#2E75B6" : "#CBD5E1"}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.name.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 20,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: -5 },
  },
  tabItem: { alignItems: "center" },
  tabText: { fontSize: 10, fontWeight: "900", marginTop: 4, color: "#CBD5E1" },
  tabTextActive: { color: "#2E75B6" },
  fab: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#2E75B6",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -55,
    elevation: 8,
    shadowColor: "#2E75B6",
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
