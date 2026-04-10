import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
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
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";

const { width } = Dimensions.get("window");

export default function FamilyScreen({ navigation }) {
  const { userData } = useUser();
  const [view, setView] = useState("DASHBOARD"); // DASHBOARD, ADD, PROFILE
  const [addStep, setAddStep] = useState(1); // 1: Search, 2: Details
  const [patientIdInput, setPatientIdInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const [invitations, setInvitations] = useState([]);
  const [household, setHousehold] = useState([]);
  const [foundPatient, setFoundPatient] = useState(null);

  // Load incoming invites (requests where target = current user's patientId)
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, "familyRequests"),
      where("toUid", "==", userData.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, (snap) => {
      setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [userData?.uid]);

  // Load approved family members (both directions)
  useEffect(() => {
    if (!userData?.uid) return;
    // People I sent requests to and were approved
    const qSent = query(
      collection(db, "familyRequests"),
      where("fromUid", "==", userData.uid),
      where("status", "==", "approved")
    );
    const unsubSent = onSnapshot(qSent, (snap) => {
      const sent = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().toName,
        patientId: d.data().toPatientId,
        role: "Family",
        isAuthorized: true,
        hba1c: "--",
        status: "Stable",
        ...d.data(),
      }));
      setHousehold((prev) => {
        const others = prev.filter((m) => m._direction === "received");
        return [...others, ...sent.map((s) => ({ ...s, _direction: "sent" }))];
      });
    });
    // People who sent requests to me and I approved (they can see my data)
    const qReceived = query(
      collection(db, "familyRequests"),
      where("toUid", "==", userData.uid),
      where("status", "==", "approved")
    );
    const unsubReceived = onSnapshot(qReceived, (snap) => {
      const received = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().fromName,
        patientId: "--",
        role: "Monitoring me",
        isAuthorized: true,
        hba1c: "--",
        status: "Stable",
        ...d.data(),
        _direction: "received",
      }));
      setHousehold((prev) => {
        const others = prev.filter((m) => m._direction === "sent");
        return [...others, ...received];
      });
    });
    return () => { unsubSent(); unsubReceived(); };
  }, [userData?.uid]);

  // --- HANDLERS ---
  const handleVerify = async () => {
    const trimmed = patientIdInput.trim().toUpperCase();
    if (!trimmed) return;
    if (trimmed === userData?.patientId) {
      Alert.alert("Invalid", "You cannot add yourself as a family member.");
      return;
    }
    setIsVerifying(true);
    try {
      // Search publicProfiles — safe, no private health data exposed
      const snap = await getDocs(
        query(collection(db, "publicProfiles"), where("patientId", "==", trimmed))
      );
      if (snap.empty) {
        Alert.alert("Not Found", "No Arogyasathi user found with Patient ID: " + trimmed);
      } else {
        const data = snap.docs[0].data();
        // Check if request already exists
        const existing = await getDocs(
          query(
            collection(db, "familyRequests"),
            where("fromUid", "==", userData.uid),
            where("toUid", "==", data.uid)
          )
        );
        if (!existing.empty) {
          Alert.alert("Already Sent", "You already sent a request to this person.");
          return;
        }
        setFoundPatient(data);
        setAddStep(2);
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendInvite = async () => {
    if (!foundPatient) return;
    try {
      await addDoc(collection(db, "familyRequests"), {
        fromUid: userData.uid,
        fromName: userData.fullName,
        toUid: foundPatient.uid,
        toName: foundPatient.fullName,
        toPatientId: foundPatient.patientId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      Alert.alert("Sent!", "Permission request sent to " + foundPatient.fullName);
      setView("DASHBOARD");
      setAddStep(1);
      setPatientIdInput("");
      setFoundPatient(null);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleAcceptInvite = async (inv) => {
    try {
      await updateDoc(doc(db, "familyRequests", inv.id), { status: "approved" });
      // Grant fromUid read access to this user's health data
      await updateDoc(doc(db, "users", userData.uid), {
        authorizedViewers: arrayUnion(inv.fromUid),
      });
    } catch (e) {
      Alert.alert("Error", e.message);
    }
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
              <View style={{ flex: 1 }}>
                <Text style={styles.reqName}>{inv.fromName}</Text>
                <Text style={styles.reqSub}>Wants to view your health data</Text>
              </View>
              <View style={styles.reqActions}>
                <TouchableOpacity
                  style={styles.btnReject}
                  onPress={async () => {
                    await updateDoc(doc(db, "familyRequests", inv.id), { status: "rejected" });
                  }}
                >
                  <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAccept}
                  onPress={() => handleAcceptInvite(inv)}
                >
                  <MaterialCommunityIcons name="check" size={18} color="#FFF" />
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
            <Text style={styles.verifiedText}>Verified: {foundPatient?.fullName || ""}</Text>
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

  const MemberProfile = ({ member }) => {
    const [memberAnalyses, setMemberAnalyses] = useState([]);
    const [loadingMember, setLoadingMember] = useState(true);

    useEffect(() => {
      if (!member.isAuthorized || member._direction !== "sent") {
        setLoadingMember(false);
        return;
      }
      const targetUid = member.toUid;
      if (!targetUid) { setLoadingMember(false); return; }
      const q = query(
        collection(db, "users", targetUid, "aiAnalyses"),
        orderBy("analyzedAt", "desc"),
        limit(5)
      );
      getDocs(q)
        .then((snap) => setMemberAnalyses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
        .catch(() => {})
        .finally(() => setLoadingMember(false));
    }, [member]);

    const latestHba1c = memberAnalyses
      .flatMap((a) => a.metrics || [])
      .find((m) => m.name?.toLowerCase().includes("hba1c") || m.name?.toLowerCase().includes("a1c"));

    const latestSummary = memberAnalyses[0]?.summary;
    const abnormalCount = memberAnalyses[0]
      ? (memberAnalyses[0].metrics || []).filter((m) => m.status !== "normal" && m.status !== "Normal").length
      : 0;

    return (
      <ScrollView style={styles.fullView}>
        <View style={styles.profileHeader}>
          <View style={styles.bigAvatar}>
            <MaterialCommunityIcons name="account" size={50} color="#2E75B6" />
          </View>
          <Text style={styles.profileName}>{member.name}</Text>
          <Text style={styles.profileId}>{member.patientId || member.toPatientId || "--"}</Text>
        </View>

        {!member.isAuthorized ? (
          <View style={styles.lockBox}>
            <MaterialCommunityIcons name="lock-outline" size={60} color="#CBD5E1" />
            <Text style={styles.lockTitle}>Access Restricted</Text>
            <Text style={styles.lockSub}>Data is encrypted until they approve your request.</Text>
          </View>
        ) : loadingMember ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <ActivityIndicator size="large" color="#2E75B6" />
          </View>
        ) : (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>LATEST HBA1C</Text>
              <Text style={[styles.statValue, { color: latestHba1c ? (latestHba1c.status === "normal" ? "#10B981" : "#EF4444") : "#94A3B8" }]}>
                {latestHba1c ? `${latestHba1c.value}${latestHba1c.unit || "%"}` : "No data"}
              </Text>
              {abnormalCount > 0 && (
                <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 12, marginTop: 4 }}>
                  ⚠️ {abnormalCount} metric{abnormalCount > 1 ? "s" : ""} need attention
                </Text>
              )}
            </View>
            {latestSummary ? (
              <View style={[styles.graphBox, { backgroundColor: "#F5F3FF" }]}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#8B5CF6", marginBottom: 6 }}>LATEST AI SUMMARY</Text>
                <Text style={{ color: "#4C1D95", fontSize: 13, lineHeight: 20 }}>{latestSummary}</Text>
              </View>
            ) : (
              <View style={styles.graphBox}>
                <Text style={{ color: "#94A3B8", textAlign: "center", fontSize: 13 }}>No AI analyses found for this member yet.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderProfile = () => <MemberProfile member={selectedMember} />;

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
  reqActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  btnReject: { backgroundColor: "#FEE2E2", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#FECACA" },
  btnAccept: { backgroundColor: "#10B981", padding: 10, borderRadius: 12 },
});
