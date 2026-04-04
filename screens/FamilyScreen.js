import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Note: If you are using standard React Native, replace motion with View/Animated
// Below I use standard View with conditional rendering for maximum compatibility.

import Svg, { Circle, Line, Path } from "react-native-svg";
import { useUser } from "../context/UserContext";

const { width } = Dimensions.get("window");

export default function FamilyScreen({ navigation }) {
  const { userData } = useUser();
  const [view, setView] = useState("DASHBOARD"); // DASHBOARD, ADD, PROFILE
  const [addStep, setAddStep] = useState(1); // 1: Search, 2: Details
  const [patientIdInput, setPatientIdInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // --- MOCK DATA ---
  const [invitations, setInvitations] = useState([
    { id: "inv-1", fromName: "Anjali Sharma", relationship: "Sister" },
  ]);

  const [household, setHousehold] = useState([
    {
      id: "mem-1",
      name: "Rajesh Kumar",
      patientId: "MV-482910",
      role: "Father",
      status: "Warning",
      hba1c: "7.8%",
      isAuthorized: true,
    },
    {
      id: "mem-2",
      name: "Sunita Devi",
      patientId: "MV-552109",
      role: "Mother",
      hba1c: "6.5%",
      status: "Stable",
      isAuthorized: false,
    },
  ]);

  // --- HANDLERS ---
  const handleVerify = () => {
    if (!patientIdInput.trim()) return;
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setAddStep(2);
    }, 1500);
  };

  const handleSendInvite = () => {
    Alert.alert("Success", "Permission request sent!");
    setView("DASHBOARD");
    setAddStep(1);
    setPatientIdInput("");
  };

  const handleBack = () => {
    if (view === "ADD" && addStep === 2) {
      setAddStep(1);
    } else if (view !== "DASHBOARD") {
      setView("DASHBOARD");
    } else {
      navigation.goBack();
    }
  };

  // --- SUB-VIEWS ---

  const renderDashboard = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollBody}
    >
      {/* My ID Card */}
      <View style={styles.idCard}>
        <View style={styles.idHeader}>
          <MaterialCommunityIcons
            name="shield-check"
            size={20}
            color="#10B981"
          />
          <Text style={styles.idLabel}>MY MEDIVAULT ID</Text>
        </View>
        <Text style={styles.idText}>{userData?.patientId || "MV-000000"}</Text>
        <Text style={styles.idSub}>Share this with family members</Text>
      </View>

      {/* Incoming Requests */}
      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GRANT AUTHORIZATION</Text>
          {invitations.map((inv) => (
            <View key={inv.id} style={styles.requestCard}>
              <View>
                <Text style={styles.reqName}>{inv.fromName}</Text>
                <Text style={styles.reqSub}>Wants to monitor you</Text>
              </View>
              <View style={styles.reqActions}>
                <TouchableOpacity
                  style={styles.btnAccept}
                  onPress={() => {
                    setHousehold([
                      ...household,
                      {
                        id: Date.now(),
                        name: inv.fromName,
                        isAuthorized: true,
                        role: "Family",
                        status: "Stable",
                        hba1c: "--",
                      },
                    ]);
                    setInvitations([]);
                  }}
                >
                  <MaterialCommunityIcons name="check" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Circle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MONITORING CIRCLE</Text>
        {household.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.memberCard}
            onPress={() => {
              setSelectedMember(member);
              setView("PROFILE");
            }}
          >
            <View style={styles.memLeft}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons
                  name="account"
                  size={24}
                  color="#2E75B6"
                />
              </View>
              <View>
                <Text style={styles.memName}>
                  {member.name} {!member.isAuthorized && "🔒"}
                </Text>
                <Text style={styles.memRole}>
                  {member.role} •{" "}
                  {member.isAuthorized ? member.hba1c : "Pending"}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#CBD5E1"
            />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setView("ADD")}>
        <MaterialCommunityIcons
          name="plus-circle-outline"
          size={24}
          color="#64748B"
        />
        <Text style={styles.addBtnText}>ADD FAMILY MEMBER</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAddMember = () => (
    <View style={styles.fullView}>
      {addStep === 1 ? (
        <View style={styles.glassCard}>
          <Text style={styles.viewTitle}>Identify Patient</Text>
          <Text style={styles.viewSub}>
            Enter Patient ID to verify connection
          </Text>
          <TextInput
            style={styles.input}
            placeholder="MV-XXXXXX"
            value={patientIdInput}
            onChangeText={(t) => setPatientIdInput(t.toUpperCase())}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify}>
            {isVerifying ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>Verify Patient ID</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.glassCard}>
          <View style={styles.verifiedBadge}>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color="#10B981"
            />
            <Text style={styles.verifiedText}>Verified: Ramesh Kumar</Text>
          </View>
          <Text style={styles.viewSub}>
            Choose access level for this connection
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSendInvite}
          >
            <Text style={styles.btnText}>Send Permission Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderProfile = () => (
    <ScrollView style={styles.fullView}>
      <View style={styles.profileHeader}>
        <View style={styles.bigAvatar}>
          <MaterialCommunityIcons name="account" size={50} color="#2E75B6" />
        </View>
        <Text style={styles.profileName}>{selectedMember.name}</Text>
        <Text style={styles.profileId}>{selectedMember.patientId}</Text>
      </View>

      {!selectedMember.isAuthorized ? (
        <View style={styles.lockBox}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={60}
            color="#CBD5E1"
          />
          <Text style={styles.lockTitle}>Access Restricted</Text>
          <Text style={styles.lockSub}>
            Data is encrypted until they approve your request.
          </Text>
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>LATEST HBA1C</Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    selectedMember.status === "Warning" ? "#EF4444" : "#10B981",
                },
              ]}
            >
              {selectedMember.hba1c}
            </Text>
          </View>
          <View style={styles.graphBox}>
            <Svg height="120" width="100%" viewBox="0 0 300 100">
              <Line
                x1="0"
                y1="50"
                x2="300"
                y2="50"
                stroke="#E2E8F0"
                strokeDasharray="5"
              />
              <Path
                d="M0,80 Q50,75 100,60 T200,45 T300,25"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="4"
              />
              <Circle cx="300" cy="25" r="5" fill="#EF4444" />
            </Svg>
          </View>
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={30}
            color="#1E293B"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family Hub</Text>
        <View style={{ width: 30 }} />
      </View>

      {view === "DASHBOARD" && renderDashboard()}
      {view === "ADD" && renderAddMember()}
      {view === "PROFILE" && renderProfile()}
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
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  scrollBody: { padding: 20 },
  idCard: {
    backgroundColor: "#1E293B",
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
  },
  idHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  idLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "900" },
  idText: { color: "#FFF", fontSize: 32, fontWeight: "bold", letterSpacing: 2 },
  idSub: { color: "#64748B", fontSize: 11, marginTop: 5 },
  section: { marginTop: 30 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 15,
    letterSpacing: 1,
  },
  memberCard: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    elevation: 2,
  },
  memLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  avatar: {
    width: 45,
    height: 45,
    backgroundColor: "#F1F5F9",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  memName: { fontSize: 16, fontWeight: "bold", color: "#1E293B" },
  memRole: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  addBtn: {
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    padding: 25,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  addBtnText: { fontWeight: "900", color: "#64748B", fontSize: 13 },
  fullView: { flex: 1, padding: 20 },
  glassCard: {
    backgroundColor: "#FFF",
    padding: 30,
    borderRadius: 35,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  viewTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
  },
  viewSub: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 25,
  },
  input: {
    backgroundColor: "#F1F5F9",
    padding: 20,
    borderRadius: 20,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1E293B",
  },
  primaryBtn: {
    backgroundColor: "#2E75B6",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 20,
  },
  btnText: { color: "#FFF", fontWeight: "900", fontSize: 16 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    padding: 15,
    borderRadius: 20,
  },
  verifiedText: { color: "#059669", fontWeight: "bold" },
  profileHeader: { alignItems: "center", marginTop: 20 },
  bigAvatar: {
    width: 100,
    height: 100,
    backgroundColor: "#DBEAFE",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  profileName: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  profileId: { fontSize: 14, color: "#94A3B8", fontWeight: "bold" },
  lockBox: {
    alignItems: "center",
    marginTop: 50,
    padding: 40,
    backgroundColor: "#FFF",
    borderRadius: 30,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 15,
  },
  lockSub: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 10,
  },
  statsContainer: { marginTop: 30 },
  statCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 25,
    alignItems: "center",
  },
  statLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8" },
  statValue: { fontSize: 32, fontWeight: "bold", marginTop: 5 },
  graphBox: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 25,
    marginTop: 15,
  },
  requestCard: {
    backgroundColor: "#FEF3C7",
    padding: 20,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 5,
    borderLeftColor: "#F59E0B",
  },
  reqName: { fontSize: 15, fontWeight: "bold", color: "#92400E" },
  reqSub: { fontSize: 11, color: "#B45309" },
  btnAccept: { backgroundColor: "#10B981", padding: 10, borderRadius: 12 },
});
