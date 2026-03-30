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
import SideMenu from "../components/SideMenu";

const { width } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

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

  // --- VOICE RECORDING LOGIC ---
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
        type: "image/*",
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
          <TouchableOpacity style={styles.notifBtn}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={26}
              color="#64748B"
            />
            <View style={styles.notifDot} />
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
        <Text style={styles.greeting}>Good Morning, Ramesh! 👋</Text>

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

        {/* --- HEALTH SCORE --- */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>72</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreLabel}>Your Health Score</Text>
            <Text style={styles.scoreDelta}>📈 Improved by 5 points! 🥳</Text>
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

          {/* CONNECTED FAMILY HUB HERE */}
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

      {/* --- BOTTOM TAB BAR --- */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Home")}
        >
          <MaterialCommunityIcons
            name="home-variant"
            size={28}
            color="#2E75B6"
          />
          <Text style={[styles.tabText, { color: "#2E75B6" }]}>HOME</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Reports")}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={28}
            color="#CBD5E1"
          />
          <Text style={styles.tabText}>REPORTS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("UploadReport")}
        >
          <MaterialCommunityIcons name="plus" size={35} color="#FFF" />
        </TouchableOpacity>

        {/* CONNECTED FAMILY TAB HERE */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Family")}
        >
          <MaterialCommunityIcons
            name="account-group-outline"
            size={28}
            color="#CBD5E1"
          />
          <Text style={styles.tabText}>FAMILY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={28}
            color="#CBD5E1"
          />
          <Text style={styles.tabText}>PROFILE</Text>
        </TouchableOpacity>
      </View>
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
  notifDot: {
    position: "absolute",
    top: 5,
    right: 8,
    width: 7,
    height: 7,
    backgroundColor: "#3B82F6",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFF",
  },
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
  },
  tabItem: { alignItems: "center" },
  tabText: { fontSize: 10, fontWeight: "900", marginTop: 4, color: "#CBD5E1" },
  fab: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#2E75B6",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -55,
    elevation: 8,
  },
});
