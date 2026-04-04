import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomTabBar from "../components/BottomTabBar";

export default function ReportsScreen({ navigation }) {
  // M-6 Fix: Active tab state for filtering
  const [activeFilter, setActiveFilter] = useState("All");

  const reports = [
    {
      id: "1",
      title: "Blood Test Results",
      date: "24 MAR, 2026",
      type: "Lab",
      color: "#FEE2E2",
      icon: "water",
    },
    {
      id: "2",
      title: "Chest X-Ray",
      date: "15 MAR, 2026",
      type: "Lab",
      color: "#DBEAFE",
      icon: "skull",
    },
    {
      id: "3",
      title: "Prescription - Cardiologist",
      date: "10 MAR, 2026",
      type: "Prescription",
      color: "#FEF3C7",
      icon: "pill",
    },
  ];

  // M-6 Fix: Filter reports based on active tab
  const filteredReports =
    activeFilter === "All"
      ? reports
      : reports.filter((r) => r.type === activeFilter);

  const TABS = [
    { label: "All Reports", filter: "All" },
    { label: "Prescriptions", filter: "Prescription" },
    { label: "Lab Results", filter: "Lab" },
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

      {/* M-6 Fix: Functional filter tabs */}
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.filter}
            onPress={() => setActiveFilter(tab.filter)}
          >
            <Text
              style={
                activeFilter === tab.filter
                  ? styles.tabActive
                  : styles.tabInactive
              }
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredReports}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={50}
              color="#CBD5E1"
            />
            <Text style={styles.emptyText}>
              No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""}{" "}
              reports found
            </Text>
          </View>
        }
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

      {/* M-4 Fix: Shared BottomTabBar */}
      <BottomTabBar navigation={navigation} activeTab="Reports" />
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
    gap: 10,
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
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 15,
  },
});
