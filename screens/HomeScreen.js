import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { useState, useCallback } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomTabBar from "../components/BottomTabBar";
import SideMenu from "../components/SideMenu";
import { useUser } from "../context/UserContext";

const { width } = Dimensions.get("window");

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

export default function HomeScreen({ route, navigation }) {
  const { userData } = useUser();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const firstName =
    userData?.fullName?.split(" ")[0] ||
    route?.params?.fullName?.split(" ")[0] ||
    "User";
  const healthScore = userData?.healthScore || 72;

  const [recentReports, setRecentReports] = useState([
    {
      id: "1",
      title: "Blood Test",
      date: "15 Mar",
      icon: "water",
      color: "#FEE2E2",
      iconColor: "#EF4444",
    },
    {
      id: "2",
      title: "X-Ray Chest",
      date: "10 Mar",
      icon: "radiology-box",
      color: "#DBEAFE",
      iconColor: "#3B82F6",
    },
    {
      id: "3",
      title: "Prescription",
      date: "8 Mar",
      icon: "pill",
      color: "#D1FAE5",
      iconColor: "#10B981",
    },
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate fetching latest data
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(newRecording);
        setIsRecording(true);
      } else {
        Alert.alert("Permission Denied", "Please allow microphone access.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const newVoiceReport = {
        id: Date.now().toString(),
        title: "Voice Report",
        date: "Today",
        icon: "microphone",
        color: "#FEF3C7",
        iconColor: "#D97706",
      };
      setRecentReports([newVoiceReport, ...recentReports]);
      setRecording(null);
      Alert.alert("Saved", "Voice report added to your list.");
    } catch (error) {
      console.error("Stop error:", error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <SideMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />

      <View style={styles.headerSpacer} />

      {/* --- TOP BAR --- */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
          <MaterialCommunityIcons name="menu" size={30} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>MediVault</Text>
        <View style={styles.navRight}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => Alert.alert("Notifications", "No new alerts")}
          >
            <MaterialCommunityIcons name="bell-outline" size={26} color="#64748B" />
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
        <Text style={styles.greeting}>
          {getGreeting()}, {firstName}! 👋
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
          onPress={() => navigation.navigate("Reports")} 
        >
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>{healthScore}/100</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreLabel}>Your Health Score</Text>
            <Text style={styles.scoreDelta}>↑ Improved by 5 points! 🎉</Text>
            <View style={styles.scoreLinkRow}>
              <Text style={styles.scoreLinkText}>View Detailed Analysis</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#2E75B6" />
            </View>
          </View>
        </TouchableOpacity>

        {/* --- QUICK STATS GRID --- */}
        <View style={styles.quickStatsRow}>
          <TouchableOpacity style={styles.quickStatBox} onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.qsTitle}>Last HbA1c</Text>
            <Text style={styles.qsValue}>6.8%</Text>
            <Text style={[styles.qsStatus, { color: "#EF4444" }]}>⚠️ High</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickStatBox} onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.qsTitle}>Last BP</Text>
            <Text style={styles.qsValue}>130/85</Text>
            <Text style={[styles.qsStatus, { color: "#10B981" }]}>✓ Normal</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickStatsRow}>
          <TouchableOpacity style={styles.quickStatBox} onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.qsTitle}>Medications</Text>
            <Text style={styles.qsValueBlue}>3 Active</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickStatBox} onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.qsTitle}>Reports</Text>
            <Text style={styles.qsValueBlue}>12 Total</Text>
          </TouchableOpacity>
        </View>

        {/* --- AI INSIGHTS CARD --- */}
        <TouchableOpacity style={styles.aiCard} onPress={() => navigation.navigate("AI")}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="robot-outline" size={24} color="#8B5CF6" />
            <Text style={styles.aiTitle}>AI Health Insights</Text>
          </View>
          <Text style={styles.aiDescription}>
            "Your blood sugar has been stable this week. Great job! Keep taking medications on time."
          </Text>
          <View style={styles.aiLinkRow}>
            <Text style={styles.aiLinkText}>Ask AI a Question</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#8B5CF6" />
          </View>
        </TouchableOpacity>

        {/* --- RECENT REPORTS --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT REPORTS</Text>
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
              style={styles.reportCard}
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

        {/* --- QUICK ACTIONS GRID --- */}
        <Text style={styles.sectionTitleAlt}>QUICK ACTIONS</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.actionBtn}
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
            style={styles.actionBtn}
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
            style={[styles.actionBtn, isRecording && styles.recordingActive]}
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
            style={styles.actionBtn}
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
  notifBtn: { padding: 5 },
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
  scoreLinkText: { color: "#2E75B6", fontSize: 12, fontWeight: "700", marginRight: 4 },
  
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
