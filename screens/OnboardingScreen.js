import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { useUser } from "../context/UserContext";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PagerView from "react-native-pager-view";

export default function OnboardingScreen({ navigation }) {
  const [activePage, setActivePage] = useState(0);
  const pagerRef = useRef(null);
  const { user, userData } = useUser();

  const handleSkip = () => {
    if (user && userData?.phoneVerified) {
      navigation.replace("Home");
    } else if (user && !userData?.phoneVerified) {
      // Signed in but not verified — go to Login which handles routing
      navigation.replace("Login");
    } else {
      navigation.replace("Login");
    }
  };

  const step1Img = require("../assets/images/step1.png");
  // Temporary fix: Pointing to step1.png because step3.png is corrupted and causing Android builds to fail
  const step3Img = require("../assets/images/step1.png");

  const HealthTrackingItem = ({
    iconName,
    iconColor,
    title,
    description,
    borderSideColor,
  }) => (
    <View style={[styles.trackingCard, { borderLeftColor: borderSideColor }]}>
      <View
        style={[styles.iconContainer, { backgroundColor: iconColor + "15" }]}
      >
        <MaterialCommunityIcons name={iconName} size={28} color={iconColor} />
      </View>
      <View style={styles.trackingText}>
        <Text style={styles.trackingTitle}>{title}</Text>
        <Text style={styles.trackingDesc}>{description}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {activePage < 2 ? (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ height: 20 }} />
        )}
      </View>

      <PagerView
        style={styles.pager}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        {/* PAGE 1 */}
        <View style={styles.page} key="1">
          <Image
            source={step1Img}
            style={styles.mainIllustration}
            resizeMode="contain"
          />
          <Text style={styles.stepTag}>STEP 01</Text>
          <Text style={styles.title}>Your Health Records, Always With You</Text>
          <Text style={styles.desc}>
            Store, track, and share your medical history securely
          </Text>
        </View>

        {/* PAGE 2 */}
        <View style={styles.page} key="2">
          <Text style={styles.stepTag}>ONBOARDING 2 OF 3</Text>
          <Text style={styles.title}>Smart Health Tracking</Text>
          <View style={styles.trackingList}>
            <HealthTrackingItem
              iconName="file-upload"
              iconColor="#2E75B6"
              borderSideColor="#3B82F6"
              title="Upload Reports"
              description="Capture or upload medical reports instantly."
            />
            <HealthTrackingItem
              iconName="robot"
              iconColor="#10B981"
              borderSideColor="#10B981"
              title="AI Health Insights"
              description="Get smart analysis in your language."
            />
            <HealthTrackingItem
              iconName="shield-account"
              iconColor="#EF4444"
              borderSideColor="#F87171"
              title="Emergency Access"
              description="Critical info accessible when locked."
            />
          </View>
        </View>

        {/* PAGE 3 */}
        <View style={styles.page} key="3">
          <View style={styles.lockScreenMock}>
            <View style={styles.lockScreenTop}>
              <Text style={styles.lockTime}>10:42</Text>
              <MaterialCommunityIcons name="lock" size={18} color="#FFF" />
            </View>
            <View style={styles.emergencyCard}>
              <View style={styles.emergencyAvatar} />
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyLabel}>EMERGENCY ID</Text>
                <Text style={styles.emergencyName}>Rajesh Kumar • B+</Text>
              </View>
              <MaterialCommunityIcons name="shield-check" size={28} color="#2E75B6" />
            </View>
          </View>
          <Text style={styles.stepTag}>SAFETY SHIELD</Text>
          <Text style={styles.title}>Always Prepared for Emergencies</Text>
          <Text style={styles.desc}>
            Access critical info even when your phone is locked.
          </Text>
        </View>
      </PagerView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.dot, activePage === i && styles.activeDot]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() =>
            activePage < 2
              ? pagerRef.current.setPage(activePage + 1)
              : navigation.replace("Login")
          }
        >
          <Text style={styles.nextBtnText}>
            {activePage === 2 ? "Get Started" : "Next"}
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  topBar: { alignItems: "flex-end", paddingHorizontal: 20, paddingTop: "9%" },
  skipText: { color: "#2E75B6", fontWeight: "bold", fontSize: 16 },
  pager: { flex: 1 },
  page: {
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  mainIllustration: { width: 280, height: 280, marginBottom: 20 },
  stepTag: {
    color: "#1E293B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1E293B",
    lineHeight: 30,
  },
  desc: { fontSize: 14, textAlign: "center", color: "#64748B", marginTop: 10 },
  trackingList: { width: "100%", gap: 12, marginTop: 20 },
  trackingCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 15,
    borderLeftWidth: 6,
    padding: 15,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  trackingText: { flex: 1, marginLeft: 15 },
  trackingTitle: { fontWeight: "bold", color: "#1E293B", fontSize: 14 },
  trackingDesc: { fontSize: 11, color: "#64748B", marginTop: 2 },
  footer: { paddingHorizontal: 40, paddingBottom: 40, alignItems: "center" },
  dots: { flexDirection: "row", justifyContent: "center", marginBottom: 20 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 4,
  },
  activeDot: { backgroundColor: "#2E75B6", width: 24 },
  nextBtn: {
    backgroundColor: "#2E75B6",
    height: 56,
    width: "100%",
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    elevation: 4,
  },
  nextBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 18 },
  lockScreenMock: {
    width: 280,
    height: 200,
    backgroundColor: "#1a2535",
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    justifyContent: "space-between",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  lockScreenTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lockTime: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  emergencyAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E2E8F0",
  },
  emergencyInfo: { flex: 1 },
  emergencyLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: 1,
    marginBottom: 4,
  },
  emergencyName: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
});
