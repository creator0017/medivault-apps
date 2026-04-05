import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomTabBar from "../components/BottomTabBar";
import { useUser } from "../context/UserContext";
import { db, storage } from "../firebaseConfig";

export default function ReportsScreen({ navigation }) {
  const { userData } = useUser();
  const [activeFilter, setActiveFilter] = useState("All");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.uid) { setLoading(false); return; }

    const q = query(
      collection(db, "users", userData.uid, "reports"),
      orderBy("uploadedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((d) => {
        const data = d.data();
        const dateObj = data.uploadedAt ? data.uploadedAt.toDate() : new Date();
        const dateStr = dateObj.toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        }).toUpperCase();
        const isPdf = data.type === "PDF" || data.url?.includes(".pdf");
        return {
          id: d.id,
          title: data.title || "Medical Report",
          date: dateStr,
          type: isPdf ? "Prescription" : "Lab",
          color: isPdf ? "#FEF3C7" : "#DBEAFE",
          icon: isPdf ? "pill" : "water",
          url: data.url,
          storagePath: data.storagePath || null,
          fileType: data.type,
        };
      }));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [userData]);

  const filteredReports =
    activeFilter === "All" ? reports : reports.filter((r) => r.type === activeFilter);

  const TABS = [
    { label: "All Reports", filter: "All" },
    { label: "Prescriptions", filter: "Prescription" },
    { label: "Lab Results", filter: "Lab" },
  ];

  const handleOpenReport = (item) => {
    navigation.navigate("ReportViewer", {
      url: item.url,
      title: item.title,
      type: item.fileType,
    });
  };

  const handleDelete = (item) => {
    Alert.alert(
      "Delete Report",
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", userData.uid, "reports", item.id));
              if (item.storagePath) {
                await deleteObject(ref(storage, item.storagePath)).catch(() => {});
              }
            } catch {
              Alert.alert("Error", "Could not delete report.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY VAULT</Text>
        <TouchableOpacity onPress={() => navigation.navigate("UploadReport")}>
          <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#2E75B6" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab.filter} onPress={() => setActiveFilter(tab.filter)}>
            <Text style={activeFilter === tab.filter ? styles.tabActive : styles.tabInactive}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E75B6" />
          <Text style={styles.loadingText}>Fetching Reports...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-document-outline" size={50} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} reports found
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => handleOpenReport(item)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                <MaterialCommunityIcons name={item.icon} size={24} color="#1E293B" />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.reportTitle}>{item.title}</Text>
                <Text style={styles.reportDate}>{item.date} • {item.type}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

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
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B", letterSpacing: 1 },
  tabContainer: { flexDirection: "row", paddingHorizontal: 20, marginTop: 15, gap: 10 },
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
  tabInactive: { color: "#64748B", paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: "bold" },
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
  iconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  reportTitle: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  reportDate: { fontSize: 11, color: "#94A3B8", marginTop: 3, fontWeight: "600" },
  deleteBtn: { padding: 6 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#94A3B8", fontSize: 14, fontWeight: "600", marginTop: 15 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748B", fontSize: 16, fontWeight: "600" },
});
