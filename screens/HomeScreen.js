import { MaterialCommunityIcons } from "@expo/vector-icons";
import { requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets, AudioModule } from 'expo-audio';
import { collection, onSnapshot, orderBy, query, limit, getCountFromServer, addDoc, serverTimestamp, updateDoc, doc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomTabBar from "../components/BottomTabBar";
import SideMenu from "../components/SideMenu";
import TrendChart from "../components/TrendChart";
import { useUser } from "../context/UserContext";
import { db, storage } from "../firebaseConfig";

const { width } = Dimensions.get("window");

const computeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

export default function HomeScreen({ route, navigation }) {
  const { userData } = useUser();
  const { theme, fm } = useTheme();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [greeting, setGreeting] = useState(computeGreeting());
  const recorderRef = useRef(null);

  // Update greeting every minute so it matches current time
  useEffect(() => {
    setGreeting(computeGreeting());
    const id = setInterval(() => setGreeting(computeGreeting()), 60000);
    return () => clearInterval(id);
  }, []);

  const firstName =
    userData?.fullName?.split(" ")[0] ||
    route?.params?.fullName?.split(" ")[0] ||
    "User";

  const [recentReports, setRecentReports] = useState([]);
  const [aiAnalyses, setAiAnalyses] = useState([]);
  const [totalReports, setTotalReports] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Listen for family notifications
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, "users", userData.uid, "notifications"),
      where("read", "==", false),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setNotifications(docs);
    });
    return unsub;
  }, [userData?.uid]);

  const openNotifications = async () => {
    if (notifications.length === 0) {
      Alert.alert("Notifications", "No new alerts from family members.");
      return;
    }
    const messages = notifications
      .map((n) => `From ${n.from}:\n${n.message}`)
      .join("\n\n");
    Alert.alert(`Alerts (${notifications.length})`, messages, [
      {
        text: "Mark All Read",
        onPress: async () => {
          await Promise.all(
            notifications.map((n) =>
              updateDoc(doc(db, "users", userData.uid, "notifications", n.id), { read: true })
            )
          );
        },
      },
      { text: "Close", style: "cancel" },
    ]);
  };

  // Fetch AI analyses for TrendChart
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, "users", userData.uid, "aiAnalyses"),
      orderBy("analyzedAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAiAnalyses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [userData?.uid]);

  // Fetch real reports from Firestore
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, "users", userData.uid, "reports"),
      orderBy("uploadedAt", "desc"),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      const iconMap = { PDF: { icon: "file-pdf-box", color: "#FEE2E2", iconColor: "#EF4444" }, Image: { icon: "image", color: "#DBEAFE", iconColor: "#3B82F6" } };
      setRecentReports(
        snap.docs.map((d) => {
          const data = d.data();
          const style = iconMap[data.type] || { icon: "file-document", color: "#D1FAE5", iconColor: "#10B981" };
          return {
            id: d.id,
            title: data.title || "Report",
            date: data.uploadedAt?.toDate
              ? data.uploadedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "Recent",
            ...style,
          };
        })
      );
    });
    return unsub;
  }, [userData?.uid]);

  // Fetch total report count
  useEffect(() => {
    if (!userData?.uid) return;
    getCountFromServer(collection(db, "users", userData.uid, "reports"))
      .then((snap) => setTotalReports(snap.data().count))
      .catch(() => {});
  }, [userData?.uid, recentReports]);

  // Derive real stats from AI analyses
  const findMetric = (keywords) => {
    for (const analysis of aiAnalyses) {
      const found = analysis.metrics?.find((m) =>
        keywords.some((k) => m.name?.toLowerCase().includes(k))
      );
      if (found) return found;
    }
    return null;
  };

  const hba1cMetric = findMetric(["hba1c", "hb a1c", "glycated", "a1c"]);
  const bpMetric = findMetric(["blood pressure", "systolic", "bp"]);
  const medicationCount = userData?.clinical?.meds
    ? userData.clinical.meds.split(",").filter((s) => s.trim().length > 0).length
    : null;

  const calcHealthScore = () => {
    if (!aiAnalyses.length) return userData?.healthScore || null;
    let total = 0, score = 0;
    aiAnalyses.slice(0, 5).forEach((a) => {
      a.metrics?.forEach((m) => {
        const s = String(m.status || "").toLowerCase();
        total++;
        if (s === "normal") score += 100;
        else if (s === "borderline") score += 60;
        else score += 20;
      });
    });
    return total > 0 ? Math.round(score / total) : userData?.healthScore || null;
  };

  const healthScore = calcHealthScore();

  const getAiInsight = () => {
    const latest = aiAnalyses[0];
    if (!latest) return "Upload a lab report to get your first AI health insight.";
    const abnormal = latest.metrics?.filter((m) => m.status !== "Normal") || [];
    if (abnormal.length === 0)
      return `All metrics in your latest report look normal. Keep it up! 🎉`;
    const names = abnormal.slice(0, 2).map((m) => m.name).join(", ");
    return `${abnormal.length} metric${abnormal.length > 1 ? "s" : ""} need attention: ${names}. Tap to view details.`;
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  async function startRecording() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status === "granted") {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
        await recorder.prepareToRecordAsync();
        recorder.record();
        recorderRef.current = recorder;
        setIsRecording(true);
      } else {
        Alert.alert("Permission Denied", "Please allow microphone access.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;
    try {
      setIsRecording(false);
      await recorderRef.current.stop();
      const localUri = recorderRef.current.uri;
      recorderRef.current = null;
      setRecording(null);

      // BUG-02 Fix: Upload audio to Firebase Storage + save Firestore document
      if (localUri && userData?.uid) {
        try {
          const timestamp = Date.now();
          const storagePath = `users/${userData.uid}/voice-reports/${timestamp}.m4a`;
          const storageRef = ref(storage, storagePath);

          // Fetch blob from local file URI
          const response = await fetch(localUri);
          const blob = await response.blob();
          await uploadBytes(storageRef, blob, { contentType: "audio/m4a" });
          const downloadURL = await getDownloadURL(storageRef);

          // Save to Firestore so it appears in Reports screen
          await addDoc(collection(db, "users", userData.uid, "reports"), {
            title: `Voice Report — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
            url: downloadURL,
            storagePath,
            type: "Voice",
            uploadedAt: serverTimestamp(),
            uid: userData.uid,
          });

          Alert.alert("Saved", "Voice report saved to your health records.");
        } catch (uploadErr) {
          console.error("Voice upload error:", uploadErr);
          Alert.alert("Upload Failed", "Could not save voice report. Please check your connection.");
        }
      } else {
        Alert.alert("Saved", "Voice report recorded.");
      }
    } catch (error) {
      console.error("Stop error:", error);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <SideMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />

      <View style={styles.headerSpacer} />

      {/* --- TOP BAR --- */}
      <View style={[styles.topNav, { backgroundColor: theme.navBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
          <MaterialCommunityIcons name="menu" size={30} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={openNotifications}
          >
            <MaterialCommunityIcons name="bell-outline" size={26} color="#64748B" />
            {notifications.length > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifications.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate("Profile")}
          >
            <MaterialCommunityIcons name="account" size={24} color="#2E75B6" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E75B6"]} />
        }
      >
        {/* --- GREETING --- */}
        <Text style={[styles.greeting, { color: theme.text, fontSize: 26 * fm }]}>
          {greeting}, {firstName}! 👋
        </Text>

        {/* --- EMERGENCY BANNER --- */}
        <TouchableOpacity
          style={styles.emergencyCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("Emergency")}
        >
          <View style={styles.emLeft}>
            <View style={styles.emIconContainer}>
              <MaterialCommunityIcons name="alert-plus" size={28} color="#FFF" />
            </View>
            <View>
              <Text style={styles.emTitle}>🚨 EMERGENCY CARD</Text>
              <Text style={styles.emSub}>Tap for quick info</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* --- HEALTH SCORE CARD --- */}
        <TouchableOpacity
          style={styles.scoreCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("HealthDashboard")}
        >
          <View style={[
            styles.scoreCircle,
            healthScore != null && healthScore >= 80 && { borderTopColor: "#10B981", borderRightColor: "#10B981" },
            healthScore != null && healthScore >= 60 && healthScore < 80 && { borderTopColor: "#F59E0B", borderRightColor: "#F59E0B" },
            healthScore != null && healthScore < 60 && { borderTopColor: "#EF4444", borderRightColor: "#EF4444" },
          ]}>
            <Text style={styles.scoreNum}>{healthScore != null ? `${healthScore}/100` : "--"}</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreLabel}>Your Health Score</Text>
            <Text style={[
              styles.scoreDelta,
              healthScore != null && healthScore >= 80 && { color: "#10B981" },
              healthScore != null && healthScore >= 60 && healthScore < 80 && { color: "#F59E0B" },
              healthScore != null && healthScore < 60 && { color: "#EF4444" },
            ]}>
              {healthScore != null
                ? healthScore >= 80 ? "✅ Excellent"
                : healthScore >= 60 ? "⚠️ Needs attention"
                : "❗ Take action"
                : "Upload reports to calculate"}
            </Text>
            <View style={styles.scoreLinkRow}>
              <Text style={styles.scoreLinkText}>View Full Dashboard</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#7C3AED" />
            </View>
          </View>
          <View style={styles.dashBadge}>
            <MaterialCommunityIcons name="chart-arc" size={18} color="#7C3AED" />
          </View>
        </TouchableOpacity>

        {/* --- QUICK STATS GRID --- */}
        <View style={styles.quickStatsRow}>
          <TouchableOpacity style={[styles.quickStatBox, { backgroundColor: theme.card }]} onPress={() => navigation.navigate("AI")}>
            <Text style={[styles.qsTitle, { color: theme.subText }]}>Last HbA1c</Text>
            <Text style={styles.qsValue}>{hba1cMetric ? `${hba1cMetric.value}${hba1cMetric.unit || "%"}` : "--"}</Text>
            {hba1cMetric && (
              <Text style={[styles.qsStatus, { color: hba1cMetric.status === "Normal" ? "#10B981" : "#EF4444" }]}>
                {hba1cMetric.status === "Normal" ? "✓ Normal" : `⚠️ ${hba1cMetric.status}`}
              </Text>
            )}
            {!hba1cMetric && <Text style={styles.qsStatus}>No data yet</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickStatBox, { backgroundColor: theme.card }]} onPress={() => navigation.navigate("AI")}>
            <Text style={[styles.qsTitle, { color: theme.subText }]}>Last BP</Text>
            <Text style={styles.qsValue}>{bpMetric ? `${bpMetric.value}${bpMetric.unit || ""}` : "--"}</Text>
            {bpMetric && (
              <Text style={[styles.qsStatus, { color: bpMetric.status === "Normal" ? "#10B981" : "#EF4444" }]}>
                {bpMetric.status === "Normal" ? "✓ Normal" : `⚠️ ${bpMetric.status}`}
              </Text>
            )}
            {!bpMetric && <Text style={styles.qsStatus}>No data yet</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.quickStatsRow}>
          <TouchableOpacity style={[styles.quickStatBox, { backgroundColor: theme.card }]} onPress={() => navigation.navigate("Profile")}>
            <Text style={[styles.qsTitle, { color: theme.subText }]}>Medications</Text>
            <Text style={styles.qsValueBlue}>
              {medicationCount != null ? `${medicationCount} Active` : "Not set"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickStatBox, { backgroundColor: theme.card }]} onPress={() => navigation.navigate("Reports")}>
            <Text style={[styles.qsTitle, { color: theme.subText }]}>Reports</Text>
            <Text style={styles.qsValueBlue}>
              {totalReports != null ? `${totalReports} Total` : `${recentReports.length}+`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- AI INSIGHTS CARD --- */}
        <TouchableOpacity style={[styles.aiCard, { backgroundColor: theme.card }]} onPress={() => navigation.navigate("AI")}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="robot-outline" size={24} color="#8B5CF6" />
            <Text style={styles.aiTitle}>AI Health Insights</Text>
          </View>
          <Text style={styles.aiDescription}>"{getAiInsight()}"</Text>
          <View style={styles.aiLinkRow}>
            <Text style={styles.aiLinkText}>Ask AI a Question</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#8B5CF6" />
          </View>
        </TouchableOpacity>

        {/* --- RECENT REPORTS --- */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>RECENT REPORTS</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.reportScroll}
        >
          {recentReports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={[styles.reportCard, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("Reports")}
            >
              <View
                style={[
                  styles.reportIconBox,
                  { backgroundColor: report.color },
                ]}
              >
                <MaterialCommunityIcons
                  name={report.icon}
                  size={28}
                  color={report.iconColor}
                />
              </View>
              <Text style={styles.reportName} numberOfLines={1}>
                {report.title}
              </Text>
              <Text style={styles.reportDate}>{report.date}</Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
              style={[styles.reportCard, styles.viewAllCard]}
              onPress={() => navigation.navigate("Reports")}
            >
              <View style={styles.viewAllIconBox}>
                <MaterialCommunityIcons name="arrow-right" size={28} color="#2E75B6" />
              </View>
              <Text style={styles.viewAllCardText}>View All</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* --- HEALTH TREND CHART --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HEALTH TRENDS</Text>
          <TouchableOpacity onPress={() => navigation.navigate("AI", { reportUri: null })}>
            <Text style={styles.viewAllText}>AI Analysis</Text>
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <TrendChart reports={aiAnalyses} />
        </View>

        {/* --- QUICK ACTIONS GRID --- */}
        <Text style={[styles.sectionTitleAlt, { color: theme.subText }]}>QUICK ACTIONS</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate("UploadReport")}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={24}
              color="#2E75B6"
            />
            <Text style={styles.actionText}>Upload Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate("Family")}
          >
            <MaterialCommunityIcons
              name="account-group-outline"
              size={24}
              color="#10B981"
            />
            <Text style={styles.actionText}>Family Health</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.card }, isRecording && styles.recordingActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <MaterialCommunityIcons
              name={isRecording ? "stop-circle" : "microphone-outline"}
              size={24}
              color={isRecording ? "#EF4444" : "#F59E0B"}
            />
            <Text
              style={[styles.actionText, isRecording && { color: "#EF4444" }]}
            >
              {isRecording ? "Recording..." : "Voice Assist"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate("Profile")}
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={24}
              color="#64748B"
            />
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* --- BOTTOM NAVIGATION --- */}
      <BottomTabBar navigation={navigation} activeTab="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerSpacer: { height: 10 },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingBottom: 10,
    backgroundColor: "#F8FAFC",
  },
  topNavTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2E75B6",
  },
  navRight: { flexDirection: "row", alignItems: "center", gap: 15 },
  notifBtn: { padding: 5, position: "relative" },
  notifBadge: { position: "absolute", top: 0, right: 0, backgroundColor: "#EF4444", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  notifBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollBody: { paddingHorizontal: 25, paddingBottom: 120 },
  greeting: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
    marginTop: 10,
  },
  emergencyCard: {
    backgroundColor: "#EF4444",
    padding: 20,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    elevation: 4,
    shadowColor: "#EF4444",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  emLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  emIconContainer: {
    backgroundColor: "rgba(255,255,255,0.25)",
    padding: 10,
    borderRadius: 14,
  },
  emTitle: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  emSub: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "600", marginTop: 2 },
  scoreCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 20,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 6,
    borderLeftColor: "#10B981",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  scoreCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: "#E2E8F0",
    borderTopColor: "#10B981",
    borderRightColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNum: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  scoreInfo: { marginLeft: 15, flex: 1 },
  scoreLabel: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  scoreDelta: { color: "#10B981", fontSize: 13, fontWeight: "700", marginTop: 4 },
  scoreLinkRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  scoreLinkText: { color: "#7C3AED", fontSize: 12, fontWeight: "700", marginRight: 4 },
  dashBadge: {
    position: "absolute",
    top: 12,
    right: 14,
    backgroundColor: "#EDE9FE",
    borderRadius: 20,
    padding: 6,
  },
  
  quickStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  quickStatBox: {
    backgroundColor: "#FFF",
    width: "48%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
  },
  qsTitle: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  qsValue: { color: "#1E293B", fontSize: 20, fontWeight: "900", marginTop: 5 },
  qsValueBlue: { color: "#2E75B6", fontSize: 20, fontWeight: "900", marginTop: 5 },
  qsStatus: { fontSize: 12, fontWeight: "800", marginTop: 5 },

  aiCard: {
    backgroundColor: "#F3E8FF",
    padding: 20,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  aiHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  aiTitle: { fontSize: 16, fontWeight: "900", color: "#6B21A8", marginLeft: 8 },
  aiDescription: { fontSize: 14, color: "#581C87", fontWeight: "600", lineHeight: 22 },
  aiLinkRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  aiLinkText: { color: "#8B5CF6", fontSize: 13, fontWeight: "800", marginRight: 4 },

  sectionHeader: { 
    marginTop: 30, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: "#1E293B", letterSpacing: 0.5 },
  viewAllText: { fontSize: 13, fontWeight: "800", color: "#2E75B6" },
  reportScroll: { marginTop: 15, paddingBottom: 5 },
  reportCard: {
    backgroundColor: "#FFF",
    width: 110,
    padding: 15,
    borderRadius: 20,
    marginRight: 15,
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  reportIconBox: { padding: 15, borderRadius: 16, marginBottom: 12 },
  reportName: { fontSize: 13, fontWeight: "800", color: "#1E293B", textAlign: "center" },
  reportDate: { fontSize: 11, color: "#94A3B8", fontWeight: "700", marginTop: 4 },
  
  viewAllCard: { justifyContent: "center", backgroundColor: "#F8FAFC", borderWidth: 2, borderStyle: "dashed", borderColor: "#CBD5E1" },
  viewAllIconBox: { padding: 10, borderRadius: 20, backgroundColor: "#E0F2FE", marginBottom: 10 },
  viewAllCardText: { fontSize: 13, fontWeight: "800", color: "#2E75B6" },

  sectionTitleAlt: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E293B",
    marginTop: 30,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 15,
  },
  actionBtn: {
    width: "48%",
    backgroundColor: "#FFF",
    height: 90,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  recordingActive: {
    borderColor: "#EF4444",
    borderWidth: 2,
    backgroundColor: "#FEF2F2",
  },
  actionText: {
    fontWeight: "800",
    color: "#475569",
    fontSize: 13,
    marginTop: 10,
  },
});
