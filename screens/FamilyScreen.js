import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import useSarvamTTS from "../hooks/useSarvamTTS";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";

// Permission level options shown when accepting a request
const PERMISSION_OPTIONS = [
  {
    key: "full",
    label: "Full Access",
    icon: "shield-check",
    color: "#10B981",
    desc: "Reports, AI summaries, emergency card",
  },
  {
    key: "reports",
    label: "Reports & AI only",
    icon: "file-chart",
    color: "#2E75B6",
    desc: "Lab reports and AI analyses only",
  },
  {
    key: "emergency",
    label: "Emergency Card only",
    icon: "card-account-details",
    color: "#F59E0B",
    desc: "Only the emergency card is visible",
  },
];

export default function FamilyScreen({ navigation }) {
  const { userData } = useUser();
  const [view, setView] = useState("DASHBOARD"); // DASHBOARD | ADD | PROFILE
  const [addStep, setAddStep] = useState(1); // 1: Search, 2: Confirm
  const [patientIdInput, setPatientIdInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [foundPatient, setFoundPatient] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [household, setHousehold] = useState([]);

  // Permission modal state (shown when accepting a request)
  const [permModal, setPermModal] = useState(false);
  const [pendingInv, setPendingInv] = useState(null);
  const [chosenPerm, setChosenPerm] = useState("full");

  // ── Load incoming pending requests ─────────────────────────────────────────
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, "familyRequests"),
      where("toUid", "==", userData.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
      setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [userData?.uid]);

  // ── Load approved family members (both directions) ─────────────────────────
  useEffect(() => {
    if (!userData?.uid) return;

    // Requests I sent → I'm monitoring them
    const qSent = query(
      collection(db, "familyRequests"),
      where("fromUid", "==", userData.uid),
      where("status", "==", "approved")
    );
    const unsubSent = onSnapshot(qSent, async (snap) => {
      const enriched = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          let hba1c = "--";
          let healthStatus = "No data";
          try {
            const q2 = query(
              collection(db, "users", data.toUid, "aiAnalyses"),
              orderBy("analyzedAt", "desc"),
              limit(1)
            );
            const aSnap = await getDocs(q2);
            if (!aSnap.empty) {
              const m = (aSnap.docs[0].data().metrics || []).find(
                (x) => x.name?.toLowerCase().includes("hba1c") || x.name?.toLowerCase().includes("a1c")
              );
              if (m) {
                hba1c = `${m.value}${m.unit || "%"}`;
                healthStatus = m.status === "normal" ? "Normal" : m.status === "high" ? "High" : "Borderline";
              }
            }
          } catch (_) {}
          return {
            id: d.id, ...data,
            name: data.toName,
            patientId: data.toPatientId,
            role: "I monitor",
            hba1c, healthStatus,
            _direction: "sent",
          };
        })
      );
      setHousehold((prev) => [...prev.filter((m) => m._direction !== "sent"), ...enriched]);
    });

    // Requests I received & approved → they monitor me
    const qReceived = query(
      collection(db, "familyRequests"),
      where("toUid", "==", userData.uid),
      where("status", "==", "approved")
    );
    const unsubReceived = onSnapshot(qReceived, (snap) => {
      const received = snap.docs.map((d) => ({
        id: d.id, ...d.data(),
        name: d.data().fromName,
        patientId: "--",
        role: "Monitoring me",
        hba1c: "--",
        healthStatus: "--",
        _direction: "received",
      }));
      setHousehold((prev) => [...prev.filter((m) => m._direction !== "received"), ...received]);
    });

    return () => { unsubSent(); unsubReceived(); };
  }, [userData?.uid]);

  // ── Verify patient ID ───────────────────────────────────────────────────────
  const handleVerify = async () => {
    const trimmed = patientIdInput.trim().toUpperCase();
    if (!trimmed) return;
    if (trimmed === userData?.patientId) {
      Alert.alert("Invalid", "You cannot add yourself.");
      return;
    }
    setIsVerifying(true);
    try {
      // Primary: search publicProfiles (created at signup & repaired at login)
      let snap = await getDocs(
        query(collection(db, "publicProfiles"), where("patientId", "==", trimmed))
      );

      if (snap.empty) {
        Alert.alert(
          "Not Found",
          `No user found with Patient ID: ${trimmed}\n\nAsk them to open the Arogyasathi app and sign in once so their ID gets registered.`
        );
        return;
      }

      const profile = snap.docs[0].data();

      // Check if an active (pending or approved) request already exists
      const existing = await getDocs(
        query(
          collection(db, "familyRequests"),
          where("fromUid", "==", userData.uid),
          where("toUid", "==", profile.uid),
          where("status", "in", ["pending", "approved"])
        )
      );
      if (!existing.empty) {
        const status = existing.docs[0].data().status;
        Alert.alert(
          "Already Connected",
          status === "approved"
            ? "You already have access to this person."
            : "A pending request to this person already exists."
        );
        return;
      }
      setFoundPatient(profile);
      setAddStep(2);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Send invite ─────────────────────────────────────────────────────────────
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
        permission: "full", // requester asks for full; receiver can downgrade on accept
        createdAt: serverTimestamp(),
      });
      Alert.alert("Request Sent!", `Permission request sent to ${foundPatient.fullName}.`);
      setView("DASHBOARD");
      setAddStep(1);
      setPatientIdInput("");
      setFoundPatient(null);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  // ── Accept with permission level ────────────────────────────────────────────
  const openAcceptModal = (inv) => {
    setPendingInv(inv);
    setChosenPerm("full");
    setPermModal(true);
  };

  const handleAcceptInvite = async () => {
    if (!pendingInv) return;
    setPermModal(false);
    try {
      await updateDoc(doc(db, "familyRequests", pendingInv.id), {
        status: "approved",
        permission: chosenPerm,
        approvedAt: serverTimestamp(),
      });
      // Grant access in the user's profile
      await updateDoc(doc(db, "users", userData.uid), {
        authorizedViewers: arrayUnion(pendingInv.fromUid),
      });
      Alert.alert(
        "Access Granted",
        `${pendingInv.fromName} can now ${
          chosenPerm === "full"
            ? "see all your reports, AI summaries and emergency card"
            : chosenPerm === "reports"
            ? "see your reports and AI summaries"
            : "see only your emergency card"
        }.`
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleRejectInvite = async (inv) => {
    await updateDoc(doc(db, "familyRequests", inv.id), { status: "rejected" });
  };

  const handleBack = () => {
    if (view === "ADD" && addStep === 2) { setAddStep(1); }
    else if (view !== "DASHBOARD") { setView("DASHBOARD"); }
    else { navigation.goBack(); }
  };

  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
      {/* My ID */}
      <View style={styles.idCard}>
        <View style={styles.idHeader}>
          <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
          <Text style={styles.idLabel}>MY PATIENT ID</Text>
        </View>
        <Text style={styles.idText}>{userData?.patientId || "MV-000000"}</Text>
        <Text style={styles.idSub}>Share this ID with family members to connect</Text>
      </View>

      {/* Incoming Requests */}
      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INCOMING REQUESTS</Text>
          {invitations.map((inv) => (
            <View key={inv.id} style={styles.requestCard}>
              <View style={styles.reqInfo}>
                <View style={styles.reqAvatar}>
                  <MaterialCommunityIcons name="account" size={22} color="#92400E" />
                </View>
                <View>
                  <Text style={styles.reqName}>{inv.fromName}</Text>
                  <Text style={styles.reqSub}>Wants to monitor your health</Text>
                </View>
              </View>
              <View style={styles.reqActions}>
                <TouchableOpacity style={styles.btnReject} onPress={() => handleRejectInvite(inv)}>
                  <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnAccept} onPress={() => openAcceptModal(inv)}>
                  <Text style={styles.btnAcceptText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Monitoring Circle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MONITORING CIRCLE</Text>
        {household.length === 0 && (
          <View style={styles.emptyCircle}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No connections yet</Text>
          </View>
        )}
        {household.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.memberCard}
            onPress={() => { setSelectedMember(member); setView("PROFILE"); }}
          >
            <View style={styles.memLeft}>
              <View style={[styles.avatar, member._direction === "received" && { backgroundColor: "#F3F4F6" }]}>
                <MaterialCommunityIcons name="account" size={24} color="#2E75B6" />
              </View>
              <View>
                <Text style={styles.memName}>{member.name}</Text>
                <Text style={styles.memRole}>
                  {member.role} • {member._direction === "sent" ? member.hba1c : "—"}
                </Text>
              </View>
            </View>
            <View style={styles.memRight}>
              {member._direction === "sent" && member.healthStatus !== "No data" && (
                <View style={[styles.statusBadge, {
                  backgroundColor: member.healthStatus === "Normal" ? "#ECFDF5" : member.healthStatus === "High" ? "#FEF2F2" : "#FFFBEB"
                }]}>
                  <Text style={[styles.statusText, {
                    color: member.healthStatus === "Normal" ? "#10B981" : member.healthStatus === "High" ? "#EF4444" : "#F59E0B"
                  }]}>{member.healthStatus}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="chevron-right" size={22} color="#CBD5E1" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setView("ADD")}>
        <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#64748B" />
        <Text style={styles.addBtnText}>ADD FAMILY MEMBER</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── ADD MEMBER ──────────────────────────────────────────────────────────────
  const renderAddMember = () => (
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <View style={styles.glassCard}>
        {addStep === 1 ? (
          <>
            <View style={styles.stepIcon}>
              <MaterialCommunityIcons name="card-search-outline" size={36} color="#2E75B6" />
            </View>
            <Text style={styles.viewTitle}>Find by Patient ID</Text>
            <Text style={styles.viewSub}>
              Ask the person to share their Patient ID from the app
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. MV-123456"
              placeholderTextColor="#94A3B8"
              value={patientIdInput}
              onChangeText={(t) => setPatientIdInput(t.toUpperCase())}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={isVerifying}>
              {isVerifying
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.btnText}>Search & Verify</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="check-circle" size={28} color="#10B981" />
              <View>
                <Text style={styles.verifiedName}>{foundPatient?.fullName}</Text>
                <Text style={styles.verifiedId}>{foundPatient?.patientId}</Text>
              </View>
            </View>
            <Text style={styles.viewSub}>
              A request will be sent. They choose what data to share with you.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendInvite}>
              <Text style={styles.btnText}>Send Monitoring Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAddStep(1)}>
              <Text style={styles.secondaryBtnText}>Search Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );

  // ── MEMBER PROFILE ──────────────────────────────────────────────────────────
  const MemberProfile = ({ member }) => {
    const [analyses, setAnalyses] = useState([]);
    const [reports, setReports] = useState([]);
    const [emergencyCard, setEmergencyCard] = useState(null);
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState("summary"); // summary | reports | emergency
    const [notifModal, setNotifModal] = useState(false);
    const [notifMsg, setNotifMsg] = useState("");
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [voiceSpeaker, setVoiceSpeaker] = useState("tanya");
    const [voiceLanguage, setVoiceLanguage] = useState("en-IN");

    const SPEAKERS = [
      { key: "tanya",    label: "Tanya",    desc: "Warm female voice" },
      { key: "meera",    label: "Meera",    desc: "Calm female voice" },
      { key: "maitreyi",label: "Maitreyi", desc: "Soft female voice" },
      { key: "anand",   label: "Anand",    desc: "Friendly male voice" },
      { key: "neel",    label: "Neel",     desc: "Clear male voice" },
    ];

    const LANGUAGES = [
      { code: "en-IN", label: "English",    flag: "🇬🇧" },
      { code: "hi-IN", label: "Hindi",      flag: "🇮🇳" },
      { code: "ta-IN", label: "Tamil",      flag: "🇮🇳" },
      { code: "te-IN", label: "Telugu",     flag: "🇮🇳" },
      { code: "kn-IN", label: "Kannada",    flag: "🇮🇳" },
      { code: "ml-IN", label: "Malayalam",  flag: "🇮🇳" },
      { code: "mr-IN", label: "Marathi",    flag: "🇮🇳" },
      { code: "bn-IN", label: "Bengali",    flag: "🇮🇳" },
      { code: "gu-IN", label: "Gujarati",   flag: "🇮🇳" },
      { code: "pa-IN", label: "Punjabi",    flag: "🇮🇳" },
    ];

    const { speak, stop, speaking } = useSarvamTTS({
      languageCode: voiceLanguage,
      speaker: voiceSpeaker,
      cacheFile: "family_summary_tts.wav",
    });

    const permission = member.permission || "full";
    const canSeeReports = permission === "full" || permission === "reports";
    const canSeeEmergency = permission === "full" || permission === "emergency";
    const isMonitoring = member._direction === "sent"; // I sent the request = I'm monitoring them

    useEffect(() => {
      if (!isMonitoring) { setLoadingData(false); return; }
      const targetUid = member.toUid;
      if (!targetUid) { setLoadingData(false); return; }

      const fetches = [];

      if (canSeeReports) {
        fetches.push(
          getDocs(query(collection(db, "users", targetUid, "aiAnalyses"), orderBy("analyzedAt", "desc"), limit(5)))
            .then((s) => setAnalyses(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
            .catch(() => {})
        );
        fetches.push(
          getDocs(query(collection(db, "users", targetUid, "reports"), orderBy("uploadedAt", "desc"), limit(10)))
            .then((s) => setReports(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
            .catch(() => {})
        );
      }

      if (canSeeEmergency) {
        fetches.push(
          getDoc(doc(db, "users", targetUid, "emergencyCard", "data"))
            .then((d) => { if (d.exists()) setEmergencyCard(d.data()); })
            .catch(() => {})
        );
      }

      Promise.all(fetches).finally(() => setLoadingData(false));
    }, []);

    const latestAnalysis = analyses[0];
    const abnormal = latestAnalysis
      ? (latestAnalysis.metrics || []).filter((m) => m.status !== "normal" && m.status !== "Normal")
      : [];

    const buildVoiceScript = () => {
      if (!latestAnalysis) return `No health data is available for ${member.name.split(" ")[0]} yet.`;
      const name = member.name.split(" ")[0];
      const metrics = latestAnalysis.metrics || [];
      const badMetrics = metrics.filter((m) => m.status !== "normal" && m.status !== "Normal");
      const goodCount = metrics.length - badMetrics.length;
      const conditions = latestAnalysis.conditions || [];

      let script = `Here is a simple health summary for ${name}. `;

      if (metrics.length === 0) {
        return script + "No test results are available from the latest report.";
      }

      if (badMetrics.length === 0) {
        script += `Great news! All ${goodCount} health markers in the latest report are within the normal range. ${name} looks healthy based on these results. `;
      } else {
        script += `Out of ${metrics.length} health markers checked, ${badMetrics.length} ${badMetrics.length === 1 ? "needs" : "need"} attention. `;
        badMetrics.slice(0, 3).forEach((m) => {
          const dir = m.status === "high" ? "higher than normal" : m.status === "low" ? "lower than normal" : "slightly outside normal";
          script += `${m.name} is ${dir}, showing a value of ${m.value}${m.unit || ""}. `;
        });
        if (badMetrics.length > 3) {
          script += `There are also ${badMetrics.length - 3} more markers that need attention. `;
        }
        if (goodCount > 0) {
          script += `The remaining ${goodCount} markers are all normal. `;
        }
      }

      if (conditions.length > 0) {
        const cNames = conditions.map((c) => c.title || c.name).join(", ");
        script += `The AI has flagged the following conditions: ${cNames}. Please consult a doctor for proper advice.`;
      }

      return script.trim();
    };

    const sendNotification = async () => {
      if (!notifMsg.trim()) return;
      try {
        // Save notification to member's notifications subcollection
        await addDoc(collection(db, "users", member.toUid, "notifications"), {
          from: userData.fullName,
          fromUid: userData.uid,
          message: notifMsg.trim(),
          type: "family_alert",
          read: false,
          createdAt: serverTimestamp(),
        });
        setNotifModal(false);
        setNotifMsg("");
        Alert.alert("Sent!", "Notification sent to " + member.name);
      } catch (e) {
        Alert.alert("Error", "Could not send notification.");
      }
    };

    if (!isMonitoring) {
      return (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <View style={styles.profileHeader}>
            <View style={styles.bigAvatar}>
              <MaterialCommunityIcons name="account" size={50} color="#2E75B6" />
            </View>
            <Text style={styles.profileName}>{member.name}</Text>
            <View style={styles.permBadge}>
              <MaterialCommunityIcons name="eye" size={14} color="#64748B" />
              <Text style={styles.permBadgeText}>They monitor you</Text>
            </View>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {member.name} has access to your health data. You accepted their request.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={() => Alert.alert(
                "Revoke Access",
                `Remove ${member.name}'s monitoring access?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Revoke", style: "destructive", onPress: async () => {
                    await updateDoc(doc(db, "familyRequests", member.id), { status: "revoked" });
                    setView("DASHBOARD");
                  }},
                ]
              )}
            >
              <Text style={styles.btnText}>Revoke Access</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollBody}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.bigAvatar}>
            <MaterialCommunityIcons name="account" size={50} color="#2E75B6" />
          </View>
          <Text style={styles.profileName}>{member.name}</Text>
          <Text style={styles.profileId}>{member.patientId || member.toPatientId || "—"}</Text>
          <View style={styles.permBadge}>
            <MaterialCommunityIcons name="shield-half-full" size={14} color="#2E75B6" />
            <Text style={[styles.permBadgeText, { color: "#2E75B6" }]}>
              {PERMISSION_OPTIONS.find((p) => p.key === permission)?.label || "Full Access"}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionChip} onPress={() => setNotifModal(true)}>
            <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#2E75B6" />
            <Text style={styles.actionChipText}>Notify</Text>
          </TouchableOpacity>
        </View>

        {loadingData ? (
          <ActivityIndicator size="large" color="#2E75B6" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Tab bar */}
            {(canSeeReports || canSeeEmergency) && (
              <View style={styles.tabBar}>
                {canSeeReports && (
                  <TouchableOpacity
                    style={[styles.tab, activeTab === "summary" && styles.tabActive]}
                    onPress={() => setActiveTab("summary")}
                  >
                    <Text style={[styles.tabText, activeTab === "summary" && styles.tabTextActive]}>Summary</Text>
                  </TouchableOpacity>
                )}
                {canSeeReports && (
                  <TouchableOpacity
                    style={[styles.tab, activeTab === "reports" && styles.tabActive]}
                    onPress={() => setActiveTab("reports")}
                  >
                    <Text style={[styles.tabText, activeTab === "reports" && styles.tabTextActive]}>Reports</Text>
                  </TouchableOpacity>
                )}
                {canSeeEmergency && (
                  <TouchableOpacity
                    style={[styles.tab, activeTab === "emergency" && styles.tabActive]}
                    onPress={() => setActiveTab("emergency")}
                  >
                    <Text style={[styles.tabText, activeTab === "emergency" && styles.tabTextActive]}>Emergency</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Summary Tab */}
            {activeTab === "summary" && canSeeReports && (
              <View>
                {/* Voice Summary Card */}
                <View style={styles.voiceCard}>
                  <View style={styles.voiceCardHeader}>
                    <View style={styles.voiceIconWrap}>
                      <MaterialCommunityIcons name="account-voice" size={22} color="#2E75B6" />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.voiceCardTitle}>Voice Summary</Text>
                      <Text style={styles.voiceCardSub}>
                        {SPEAKERS.find((s) => s.key === voiceSpeaker)?.label} ·{" "}
                        {LANGUAGES.find((l) => l.code === voiceLanguage)?.flag}{" "}
                        {LANGUAGES.find((l) => l.code === voiceLanguage)?.label}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.changeVoiceBtn} onPress={() => { if (speaking) stop(); setShowVoiceSettings(true); }}>
                      <MaterialCommunityIcons name="tune-variant" size={14} color="#2E75B6" />
                      <Text style={styles.changeVoiceText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.voicePlayBtn, speaking && styles.voicePlayBtnStop]}
                    onPress={() => speaking ? stop() : speak(buildVoiceScript())}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name={speaking ? "stop-circle-outline" : "play-circle-outline"}
                      size={26}
                      color="#FFF"
                    />
                    <Text style={styles.voicePlayText}>{speaking ? "Stop" : "Play Summary"}</Text>
                    {speaking && <View style={styles.voiceLiveDot} />}
                  </TouchableOpacity>
                </View>

                {/* Voice Settings Modal — Speaker + Language */}
                <Modal visible={showVoiceSettings} transparent animationType="slide">
                  <View style={styles.modalOverlay}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
                      <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Voice Settings</Text>
                        <Text style={styles.modalSub}>Choose voice and language for the summary</Text>

                        {/* Speaker section */}
                        <Text style={styles.voiceSettingSection}>VOICE</Text>
                        <View style={styles.voiceChipsRow}>
                          {SPEAKERS.map((s) => (
                            <TouchableOpacity
                              key={s.key}
                              style={[styles.voiceChip, voiceSpeaker === s.key && styles.voiceChipActive]}
                              onPress={() => setVoiceSpeaker(s.key)}
                            >
                              <MaterialCommunityIcons name="account-voice" size={16} color={voiceSpeaker === s.key ? "#FFF" : "#64748B"} />
                              <Text style={[styles.voiceChipText, voiceSpeaker === s.key && styles.voiceChipTextActive]}>{s.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Language section */}
                        <Text style={[styles.voiceSettingSection, { marginTop: 18 }]}>LANGUAGE</Text>
                        <View style={styles.langGrid}>
                          {LANGUAGES.map((l) => (
                            <TouchableOpacity
                              key={l.code}
                              style={[styles.langChip, voiceLanguage === l.code && styles.langChipActive]}
                              onPress={() => setVoiceLanguage(l.code)}
                            >
                              <Text style={styles.langFlag}>{l.flag}</Text>
                              <Text style={[styles.langChipText, voiceLanguage === l.code && styles.langChipTextActive]}>{l.label}</Text>
                              {voiceLanguage === l.code && (
                                <MaterialCommunityIcons name="check-circle" size={14} color="#2E75B6" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TouchableOpacity
                          style={[styles.modalSend, { marginTop: 20 }]}
                          onPress={() => setShowVoiceSettings(false)}
                        >
                          <Text style={styles.modalSendText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  </View>
                </Modal>

                {/* Health snapshot */}
                {latestAnalysis ? (
                  <>
                    {abnormal.length > 0 && (
                      <View style={styles.alertBox}>
                        <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
                        <Text style={styles.alertText}>
                          {abnormal.length} abnormal metric{abnormal.length > 1 ? "s" : ""} in latest report
                        </Text>
                      </View>
                    )}
                    <View style={styles.metricsGrid}>
                      {(latestAnalysis.metrics || []).slice(0, 6).map((m, i) => (
                        <View key={i} style={[styles.metricTile, {
                          borderColor: m.status === "normal" ? "#D1FAE5" : m.status === "high" ? "#FEE2E2" : "#FEF3C7"
                        }]}>
                          <Text style={styles.metricName}>{m.name}</Text>
                          <Text style={[styles.metricValue, {
                            color: m.status === "normal" ? "#10B981" : m.status === "high" ? "#EF4444" : "#F59E0B"
                          }]}>{m.value}{m.unit || ""}</Text>
                          <Text style={styles.metricRange}>Normal: {m.normalRange || "—"}</Text>
                        </View>
                      ))}
                    </View>

                    {latestAnalysis.summary && (
                      <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>AI SUMMARY</Text>
                        <Text style={styles.summaryText}>{latestAnalysis.summary}</Text>
                      </View>
                    )}

                    {(latestAnalysis.conditions || []).length > 0 && (
                      <View style={styles.condBox}>
                        <Text style={styles.condLabel}>DETECTED CONDITIONS</Text>
                        {(latestAnalysis.conditions || []).map((c, i) => (
                          <View key={i} style={styles.condRow}>
                            <MaterialCommunityIcons name="circle-small" size={20} color="#EF4444" />
                            <Text style={styles.condText}>{c.title || c.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="file-search-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyBoxText}>No analyses found yet</Text>
                  </View>
                )}
              </View>
            )}

            {/* Reports Tab */}
            {activeTab === "reports" && canSeeReports && (
              <View>
                {reports.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="file-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyBoxText}>No reports uploaded yet</Text>
                  </View>
                ) : (
                  reports.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.reportRow}
                      onPress={() => r.url && navigation.navigate("ReportViewer", { url: r.url, title: r.name || "Lab Report", type: r.fileType })}
                    >
                      <View style={styles.reportIcon}>
                        <MaterialCommunityIcons
                          name={r.fileType === "PDF" ? "file-pdf-box" : "file-image"}
                          size={26}
                          color="#2E75B6"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reportName} numberOfLines={1}>{r.name || "Lab Report"}</Text>
                        <Text style={styles.reportDate}>
                          {r.uploadedAt?.toDate
                            ? r.uploadedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </Text>
                      </View>
                      <View style={[styles.reportTypeBadge, { backgroundColor: r.fileType === "PDF" ? "#FEF3C7" : "#EFF6FF" }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: r.fileType === "PDF" ? "#92400E" : "#1D4ED8" }}>
                          {r.fileType || "FILE"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Emergency Card Tab */}
            {activeTab === "emergency" && canSeeEmergency && (
              <View>
                {!emergencyCard ? (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="card-off-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyBoxText}>No emergency card set up</Text>
                  </View>
                ) : (
                  <View style={styles.emergencyCard}>
                    <View style={styles.emergencyHeader}>
                      <MaterialCommunityIcons name="medical-bag" size={24} color="white" />
                      <Text style={styles.emergencyTitle}>EMERGENCY CARD</Text>
                    </View>
                    {[
                      ["Blood Group", emergencyCard.bloodGroup],
                      ["Age", emergencyCard.age ? `${emergencyCard.age} yrs` : null],
                      ["Height", emergencyCard.height ? `${emergencyCard.height} cm` : null],
                      ["Weight", emergencyCard.weight ? `${emergencyCard.weight} kg` : null],
                      ["Allergies", (emergencyCard.allergies || []).map(a => a.name || a).filter(Boolean).join(", ")],
                      ["Conditions", (emergencyCard.conditions || []).map(c => c.title || c.name || c).filter(Boolean).join(", ")],
                      ["Medications", (emergencyCard.medications || []).map(m => m.name || m).filter(Boolean).join(", ")],
                      ["Emergency Contact", (emergencyCard.contacts || []).map(c => `${c.name} (${c.phone})`).join(", ")],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <View key={label} style={styles.ecRow}>
                        <Text style={styles.ecLabel}>{label}</Text>
                        <Text style={styles.ecValue}>{value}</Text>
                      </View>
                    ))}
                    {[
                      emergencyCard.bloodGroup,
                      emergencyCard.age,
                      ...(emergencyCard.allergies || []),
                      ...(emergencyCard.conditions || []),
                      ...(emergencyCard.medications || []),
                      ...(emergencyCard.contacts || []),
                    ].every(v => !v) && (
                      <Text style={{ color: "#CBD5E1", textAlign: "center", marginTop: 16 }}>
                        No emergency data filled in yet
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Notification Modal */}
        <Modal visible={notifModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Send Health Alert</Text>
              <Text style={styles.modalSub}>Send a message to {member.name}</Text>
              <TextInput
                style={styles.notifInput}
                placeholder="e.g. Please check your sugar levels today"
                placeholderTextColor="#94A3B8"
                value={notifMsg}
                onChangeText={setNotifMsg}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setNotifModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSend} onPress={sendNotification}>
                  <Text style={styles.modalSendText}>Send Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  };

  // ── Permission Level Modal ──────────────────────────────────────────────────
  const renderPermModal = () => (
    <Modal visible={permModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Grant Access Level</Text>
          <Text style={styles.modalSub}>
            Choose what {pendingInv?.fromName} can see
          </Text>
          {PERMISSION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.permOption, chosenPerm === opt.key && styles.permOptionActive]}
              onPress={() => setChosenPerm(opt.key)}
            >
              <View style={[styles.permOptionIcon, { backgroundColor: opt.color + "20" }]}>
                <MaterialCommunityIcons name={opt.icon} size={22} color={opt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permOptionLabel}>{opt.label}</Text>
                <Text style={styles.permOptionDesc}>{opt.desc}</Text>
              </View>
              {chosenPerm === opt.key && (
                <MaterialCommunityIcons name="check-circle" size={22} color="#2E75B6" />
              )}
            </TouchableOpacity>
          ))}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setPermModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSend} onPress={handleAcceptInvite}>
              <Text style={styles.modalSendText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <MaterialCommunityIcons name="chevron-left" size={30} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family Hub</Text>
        <View style={{ width: 30 }} />
      </View>

      {view === "DASHBOARD" && renderDashboard()}
      {view === "ADD" && renderAddMember()}
      {view === "PROFILE" && <MemberProfile member={selectedMember} />}

      {renderPermModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  scrollBody: { padding: 20, paddingBottom: 40 },

  // ID Card
  idCard: {
    backgroundColor: "#1E293B", padding: 25,
    borderRadius: 30, alignItems: "center",
  },
  idHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  idLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  idText: { color: "#FFF", fontSize: 30, fontWeight: "bold", letterSpacing: 3 },
  idSub: { color: "#64748B", fontSize: 11, marginTop: 6 },

  // Section
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: "#94A3B8", marginBottom: 14, letterSpacing: 1 },

  // Request Card
  requestCard: {
    backgroundColor: "#FEF3C7", padding: 16, borderRadius: 20,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: "#F59E0B",
  },
  reqInfo: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  reqAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#FDE68A", justifyContent: "center", alignItems: "center",
  },
  reqName: { fontSize: 15, fontWeight: "bold", color: "#92400E" },
  reqSub: { fontSize: 11, color: "#B45309" },
  reqActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  btnReject: {
    backgroundColor: "#FEE2E2", paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#FECACA",
  },
  btnAccept: {
    backgroundColor: "#10B981", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  btnAcceptText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  // Member Card
  memberCard: {
    backgroundColor: "#FFF", padding: 16, borderRadius: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12, elevation: 2,
  },
  memLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  memRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 44, height: 44, backgroundColor: "#EFF6FF",
    borderRadius: 14, justifyContent: "center", alignItems: "center",
  },
  memName: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  memRole: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Add button
  emptyCircle: { alignItems: "center", paddingVertical: 30 },
  emptyText: { color: "#94A3B8", marginTop: 10, fontSize: 13 },
  addBtn: {
    borderStyle: "dashed", borderWidth: 2, borderColor: "#CBD5E1",
    padding: 22, borderRadius: 22, alignItems: "center",
    marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 10,
  },
  addBtnText: { fontWeight: "900", color: "#64748B", fontSize: 13 },

  // Add member form
  glassCard: {
    backgroundColor: "#FFF", padding: 28, borderRadius: 30,
    elevation: 4, shadowColor: "#000", shadowOpacity: 0.08,
  },
  stepIcon: { alignItems: "center", marginBottom: 16 },
  viewTitle: { fontSize: 22, fontWeight: "900", color: "#1E293B", textAlign: "center" },
  viewSub: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 8, marginBottom: 22, lineHeight: 20 },
  input: {
    backgroundColor: "#F1F5F9", padding: 18, borderRadius: 16,
    fontSize: 18, fontWeight: "bold", textAlign: "center", color: "#1E293B",
  },
  primaryBtn: {
    backgroundColor: "#2E75B6", padding: 18, borderRadius: 16,
    alignItems: "center", marginTop: 16,
  },
  btnText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  secondaryBtn: {
    padding: 14, borderRadius: 16, alignItems: "center", marginTop: 10,
    borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  secondaryBtnText: { color: "#64748B", fontWeight: "700" },
  verifiedBadge: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ECFDF5", padding: 16, borderRadius: 16, marginBottom: 4,
  },
  verifiedName: { fontSize: 16, fontWeight: "bold", color: "#065F46" },
  verifiedId: { fontSize: 12, color: "#6EE7B7", fontWeight: "600" },

  // Profile
  profileHeader: { alignItems: "center", marginBottom: 16 },
  bigAvatar: {
    width: 90, height: 90, backgroundColor: "#DBEAFE",
    borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  profileName: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
  profileId: { fontSize: 13, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
  permBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#EFF6FF", paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginTop: 8,
  },
  permBadgeText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 },
  actionChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EFF6FF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  actionChipText: { color: "#2E75B6", fontWeight: "700", fontSize: 13 },
  infoBox: { backgroundColor: "#FFF", padding: 24, borderRadius: 20, elevation: 2 },
  infoText: { color: "#64748B", fontSize: 14, lineHeight: 22, textAlign: "center" },

  // Tabs
  tabBar: {
    flexDirection: "row", backgroundColor: "#F1F5F9",
    borderRadius: 16, padding: 4, marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 13, alignItems: "center" },
  tabActive: { backgroundColor: "#FFF", elevation: 2 },
  tabText: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  tabTextActive: { color: "#1E293B", fontWeight: "800" },

  // Metrics
  alertBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FEF2F2", padding: 14, borderRadius: 14, marginBottom: 14,
  },
  alertText: { color: "#EF4444", fontWeight: "700", fontSize: 13 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  metricTile: {
    width: "47%", backgroundColor: "#FFF", padding: 14, borderRadius: 16,
    borderWidth: 1.5, elevation: 1,
  },
  metricName: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  metricValue: { fontSize: 20, fontWeight: "900", marginTop: 4 },
  metricRange: { fontSize: 10, color: "#94A3B8", marginTop: 4 },
  // Voice Summary
  voiceCard: {
    backgroundColor: "#FFF", borderRadius: 20, padding: 18,
    marginBottom: 16, elevation: 2,
    borderWidth: 1, borderColor: "#E0EEFF",
  },
  voiceCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  voiceCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  voiceIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center",
  },
  voiceCardTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  voiceCardSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  changeVoiceBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EFF6FF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
  },
  changeVoiceText: { fontSize: 12, fontWeight: "700", color: "#2E75B6" },
  voicePlayBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#2E75B6", paddingVertical: 14, borderRadius: 16,
  },
  voicePlayBtnStop: { backgroundColor: "#1E293B" },
  voicePlayText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  voiceLiveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444",
    marginLeft: 2,
  },
  // Voice settings modal
  voiceSettingSection: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.2, marginBottom: 10 },
  voiceChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  voiceChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC",
  },
  voiceChipActive: { backgroundColor: "#2E75B6", borderColor: "#2E75B6" },
  voiceChipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  voiceChipTextActive: { color: "#FFF" },
  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16,
    borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC",
  },
  langChipActive: { borderColor: "#2E75B6", backgroundColor: "#EFF6FF" },
  langFlag: { fontSize: 16 },
  langChipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  langChipTextActive: { color: "#2E75B6" },

  summaryBox: { backgroundColor: "#F5F3FF", padding: 18, borderRadius: 18, marginBottom: 14 },
  summaryLabel: { fontSize: 10, fontWeight: "900", color: "#8B5CF6", letterSpacing: 1, marginBottom: 6 },
  summaryText: { color: "#4C1D95", fontSize: 13, lineHeight: 20 },
  condBox: { backgroundColor: "#FFF", padding: 18, borderRadius: 18, elevation: 1 },
  condLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, marginBottom: 10 },
  condRow: { flexDirection: "row", alignItems: "center" },
  condText: { fontSize: 14, color: "#1E293B", fontWeight: "600" },

  // Reports
  reportRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#FFF", padding: 16, borderRadius: 16, marginBottom: 10, elevation: 1,
  },
  reportIcon: {
    width: 44, height: 44, backgroundColor: "#EFF6FF",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  reportName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  reportDate: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  reportTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  // Emergency card
  emergencyCard: { backgroundColor: "#FFF", borderRadius: 20, overflow: "hidden", elevation: 3 },
  emergencyHeader: {
    backgroundColor: "#C54242", padding: 20, flexDirection: "row",
    alignItems: "center", gap: 10,
  },
  emergencyTitle: { color: "#FFF", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  ecRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  ecLabel: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  ecValue: { fontSize: 14, fontWeight: "700", color: "#1E293B", maxWidth: "60%", textAlign: "right" },

  // Empty states
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyBoxText: { color: "#94A3B8", fontSize: 14, marginTop: 12 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFF", borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: 28, paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#64748B", marginBottom: 20 },
  permOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 10,
  },
  permOptionActive: { borderColor: "#2E75B6", backgroundColor: "#EFF6FF" },
  permOptionIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  permOptionLabel: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  permOptionDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  notifInput: {
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0",
    borderRadius: 16, padding: 16, fontSize: 14, color: "#1E293B",
    minHeight: 90, textAlignVertical: "top", marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, padding: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center",
  },
  modalCancelText: { fontWeight: "700", color: "#64748B" },
  modalSend: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: "#2E75B6", alignItems: "center" },
  modalSendText: { fontWeight: "900", color: "#FFF" },
});
