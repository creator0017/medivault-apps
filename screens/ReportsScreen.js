import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReportsScreen({ navigation }) {
  // Mock data to show what it looks like
  const reports = [
    {
      id: "1",
      title: "Blood Test Results",
      date: "24 MAR, 2026",
      type: "PDF",
      color: "#FEE2E2",
      icon: "water",
    },
    {
      id: "2",
      title: "Chest X-Ray",
      date: "15 MAR, 2026",
      type: "Image",
      color: "#DBEAFE",
      icon: "skull",
    },
    {
      id: "3",
      title: "Prescription - Cardiologist",
      date: "10 MAR, 2026",
      type: "PDF",
      color: "#FEF3C7",
      icon: "pill",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY VAULT</Text>
        <TouchableOpacity onPress={() => navigation.navigate("UploadReport")}>
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={28}
            color="#2E75B6"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <Text style={styles.tabActive}>All Reports</Text>
        <Text style={styles.tabInactive}>Prescriptions</Text>
        <Text style={styles.tabInactive}>Lab Results</Text>
      </View>

      <FlatList
        data={reports}
        contentContainerStyle={{ padding: 20 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.reportCard}>
            <View style={[styles.iconBox, { backgroundColor: item.color }]}>
              <MaterialCommunityIcons
                name={item.icon}
                size={24}
                color="#1E293B"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.reportTitle}>{item.title}</Text>
              <Text style={styles.reportDate}>
                {item.date} • {item.type}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#CBD5E1"
            />
          </TouchableOpacity>
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 1,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 15,
    gap: 15,
  },
  tabActive: {
    backgroundColor: "#2E75B6",
    color: "#FFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: "bold",
    overflow: "hidden",
  },
  tabInactive: {
    color: "#64748B",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "bold",
  },
  reportCard: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  reportTitle: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  reportDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 3,
    fontWeight: "600",
  },
});
