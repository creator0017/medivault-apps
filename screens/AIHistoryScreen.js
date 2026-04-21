import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, deleteDoc, doc, onSnapshot, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";

export default function AIHistoryScreen({ navigation }) {
  const { userData } = useUser();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener so deletions (from ReportsScreen cascade) reflect immediately
  useEffect(() => {
    if (!userData?.uid) { setLoading(false); return; }

    const q = query(
      collection(db, "users", userData.uid, "aiAnalyses"),
      orderBy("analyzedAt", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [userData?.uid]);

  const handleDeleteAnalysis = (item) => {
    Alert.alert(
      "Delete Analysis",
      "Remove this AI analysis from your history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", userData.uid, "aiAnalyses", item.id));
            } catch {
              Alert.alert("Error", "Could not delete analysis.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis History</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconBox}>
            <MaterialCommunityIcons name="clock-outline" size={56} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>No analyses yet</Text>
          <Text style={styles.emptySub}>
            Upload a lab report image and tap "Analyze with AI" to get started.
          </Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => navigation.navigate("UploadReport")}
          >
            <Text style={styles.uploadBtnText}>Upload Report</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.countLabel}>
            {history.length} saved {history.length === 1 ? "analysis" : "analyses"}
          </Text>

          {history.map((item) => {
            const abnormal = (item.metrics || []).filter(
              (m) => String(m.status || "").toLowerCase() !== "normal"
            );
            const date = item.analyzedAt?.toDate
              ? item.analyzedAt
                  .toDate()
                  .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : item.date || "—";

            return (
              <View key={item.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("AI", {
                      cachedAnalysis: item,
                    })
                  }
                >
                  <View style={styles.cardTop}>
                    <View style={styles.labBadge}>
                      <MaterialCommunityIcons name="hospital-building" size={13} color="#8B5CF6" />
                      <Text style={styles.labText}>{item.lab || "Lab Report"}</Text>
                    </View>
                    <Text style={styles.dateText}>{date}</Text>
                  </View>

                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.summary || "Tap to view analysis details"}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaBadge}>
                      <MaterialCommunityIcons name="test-tube" size={12} color="#2E75B6" />
                      <Text style={styles.metaBadgeText}>{item.metrics?.length || 0} metrics</Text>
                    </View>
                    {abnormal.length > 0 && (
                      <View style={[styles.metaBadge, styles.warnBadge]}>
                        <MaterialCommunityIcons name="alert-circle" size={12} color="#EF4444" />
                        <Text style={[styles.metaBadgeText, { color: "#EF4444" }]}>
                          {abnormal.length} need attention
                        </Text>
                      </View>
                    )}
                    {item.patient ? (
                      <View style={styles.metaBadge}>
                        <MaterialCommunityIcons name="account" size={12} color="#64748B" />
                        <Text style={styles.metaBadgeText}>{item.patient}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Action row */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      navigation.navigate("AI", { cachedAnalysis: item })
                    }
                  >
                    <MaterialCommunityIcons name="eye-outline" size={14} color="#8B5CF6" />
                    <Text style={styles.actionBtnText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate("AIChat", { preloadReport: item })}
                  >
                    <MaterialCommunityIcons name="robot-outline" size={14} color="#10B981" />
                    <Text style={[styles.actionBtnText, { color: "#10B981" }]}>Ask AI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDeleteAnalysis(item)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={14} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: { fontSize: 17, fontWeight: "900", color: "#1E293B" },
  body: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  emptyIconBox: { backgroundColor: "#F1F5F9", borderRadius: 28, padding: 24, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 8 },
  emptySub: { color: "#64748B", textAlign: "center", fontSize: 14, lineHeight: 22, marginBottom: 24 },
  uploadBtn: { backgroundColor: "#8B5CF6", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16 },
  uploadBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  countLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  labBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  labText: { color: "#8B5CF6", fontSize: 12, fontWeight: "700" },
  dateText: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  summaryText: { fontSize: 13, color: "#475569", lineHeight: 20, marginBottom: 10 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  warnBadge: { backgroundColor: "#FEE2E2" },
  metaBadgeText: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  deleteBtn: { backgroundColor: "#FEF2F2", marginLeft: "auto" },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#8B5CF6" },
});
