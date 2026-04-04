import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomTabBar from "../components/BottomTabBar";
import SideMenu from "../components/SideMenu";
import { useUser } from "../context/UserContext";

const { width } = Dimensions.get("window");

// C-5 Fix: Dynamic time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

export default function HomeScreen({ route, navigation }) {
  const { userData } = useUser();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // C-5 Fix: Use dynamic user data from context, fallback to route params
  const firstName =
    userData?.fullName?.split(" ")[0] ||
    route?.params?.fullName?.split(" ")[0] ||
    "User";
  const healthScore = userData?.healthScore || 72;

  const [recentReports, setRecentReports] = useState([
    {
      id: "1",
      title: "Blood Test",
      date: "24 OCT, 2023",
      icon: "water",
      color: "#FEE2E2",
      iconColor: "#EF4444",
    },
    {
      id: "2",
      title: "X-Ray",
      date: "15 OCT, 2023",
      icon: "skull",
      color: "#DBEAFE",
      iconColor: "#3B82F6",
    },
  ]);

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
        date: "JUST NOW",
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

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: false,
      });
      if (!result.canceled) {
        const newFile = {
          id: Date.now().toString(),
          title: result.assets[0].name,
          date: new Date().toLocaleDateString("en-GB").toUpperCase(),
          icon: "image-outline",
          color: "#F1F5F9",
          iconColor: "#64748B",
        };
        setRecentReports([newFile, ...recentReports]);
        navigation.navigate("Reports");
      }
    } catch (err) {
      console.log("Upload error:", err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <SideMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />

      <View style={styles.headerSpacer} />

      {/* --- TOP NAVIGATION --- */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
          <MaterialCommunityIcons name="menu" size={30} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.navRight}>
          {/* M-1 Fix: Notification bell with handler */}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() =>
              Alert.alert(
                "Notifications",
                "No new notifications at this time.",
                [{ text: "OK" }],
              )
            }
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={26}
              color="#64748B"
            />
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
      >
        {/* C-5 Fix: Dynamic greeting */}
        <Text style={styles.greeting}>
          {getGreeting()}, {firstName}! 👋
        </Text>

        {/* --- EMERGENCY CARD --- */}
        <TouchableOpacity
          style={styles.emergencyCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("Emergency")}
        >
          <View style={styles.emLeft}>
            <View style={styles.emIconContainer}>
              <MaterialCommunityIcons name="plus" size={30} color="#FFF" />
            </View>
            <View>
              <Text style={styles.emTitle}>🚨 EMERGENCY CARD</Text>
              <Text style={styles.emSub}>Tap for quick access</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* L-3 Fix: Dynamic health score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>{healthScore}</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreLabel}>Your Health Score</Text>
            <Text style={styles.scoreDelta}>
              {healthScore >= 70
                ? "📈 Looking good! Keep it up! 🥳"
                : "📊 Room for improvement"}
            </Text>
          </View>
        </View>

        {/* --- QUICK ACTIONS GRID --- */}
        <Text style={styles.sectionTitleAlt}>QUICK ACTIONS</Text>
        <View style={styles.grid}>
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
              {isRecording ? "Recording..." : "Voice Note"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate("UploadReport")}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={24}
              color="#2E75B6"
            />
            <Text style={styles.actionText}>Upload Image</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate("AI", { latestReport: recentReports[0] })
            }
          >
            <MaterialCommunityIcons
              name="robot-outline"
              size={24}
              color="#8B5CF6"
            />
            <Text style={styles.actionText}>AI Analysis</Text>
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
            <Text style={styles.actionText}>Family</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT REPORTS</Text>
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
                  size={22}
                  color={report.iconColor}
                />
              </View>
              <Text style={styles.reportName} numberOfLines={1}>
                {report.title}
              </Text>
              <Text style={styles.reportDate}>{report.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      {/* M-4 Fix: Shared BottomTabBar */}
      <BottomTabBar navigation={navigation} activeTab="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  headerSpacer: { height: 10 },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingBottom: 10,
  },
  navRight: { flexDirection: "row", alignItems: "center", gap: 15 },
  notifBtn: { padding: 5 },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
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
    backgroundColor: "#D14343",
    padding: 20,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  emLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  emIconContainer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
  },
  emTitle: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  emSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  scoreCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 25,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 6,
    borderLeftColor: "#10B981",
    elevation: 2,
  },
  scoreCircle: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 4,
    borderColor: "#F1F5F9",
    borderTopColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNum: { fontSize: 20, fontWeight: "bold" },
  scoreInfo: { marginLeft: 15 },
  scoreLabel: { fontSize: 16, fontWeight: "bold" },
  scoreDelta: { color: "#10B981", fontSize: 12, fontWeight: "bold" },
  sectionHeader: { marginTop: 30 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#1E293B" },
  reportScroll: { marginTop: 15 },
  reportCard: {
    backgroundColor: "#FFF",
    width: 140,
    padding: 18,
    borderRadius: 25,
    marginRight: 15,
    alignItems: "center",
    elevation: 2,
  },
  reportIconBox: { padding: 12, borderRadius: 15, marginBottom: 10 },
  reportName: { fontSize: 14, fontWeight: "bold", color: "#1E293B" },
  reportDate: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "800",
    marginTop: 4,
  },
  sectionTitleAlt: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1E293B",
    marginTop: 30,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  actionBtn: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    height: 90,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  recordingActive: {
    borderColor: "#EF4444",
    borderWidth: 2,
    backgroundColor: "#FEF2F2",
  },
  actionText: {
    fontWeight: "900",
    color: "#64748B",
    fontSize: 12,
    marginTop: 8,
  },
});
