import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";
import useHealthScore from "../hooks/useHealthScore";
import useSarvamTTS from "../hooks/useSarvamTTS";
import { scoreBarColor, scoreStatus } from "../utils/healthScore";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

// ─── Circular progress ring (SVG-free, pure RN) ──────────────────────────────
function CircularScore({ score, size = 160 }) {
  const status = scoreStatus(score);
  const displayScore = score ?? "--";

  // Build 20 arc segments, colour them up to the score level
  const segments = 20;
  const filled = score != null ? Math.round((score / 100) * segments) : 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Outer ring made from 20 tiny ticks */}
      {Array.from({ length: segments }).map((_, i) => {
        const angle = (i / segments) * 2 * Math.PI - Math.PI / 2;
        const r = size / 2 - 10;
        const x = size / 2 + r * Math.cos(angle) - 5;
        const y = size / 2 + r * Math.sin(angle) - 5;
        const active = i < filled;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: active ? status.color : "#E2E8F0",
            }}
          />
        );
      })}
      {/* Center text */}
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 42, fontWeight: "900", color: status.color, lineHeight: 48 }}>
          {displayScore}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748B" }}>out of 100</Text>
      </View>
    </View>
  );
}

// ─── Score breakdown row ──────────────────────────────────────────────────────
function BreakdownRow({ item }) {
  const color = scoreBarColor(item.score);
  const pct   = item.score != null ? item.score : 0;

  return (
    <View style={styles.bRow}>
      <View style={styles.bLabelCol}>
        <Text style={styles.bLabel}>{item.label}</Text>
        <Text style={styles.bWeight}>{item.weight}</Text>
      </View>
      <View style={styles.bBarWrap}>
        <View style={[styles.bBarTrack]}>
          <View style={[styles.bBarFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.bScore, { color }]}>{item.score ?? "--"}</Text>
      </View>
      <Text style={styles.bValue} numberOfLines={1}>{item.valueLabel}</Text>
    </View>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ icon, iconColor, title, value, sub, onPress }) {
  return (
    <TouchableOpacity style={styles.metricCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.metricIconBox, { backgroundColor: iconColor + "20" }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.metricValue}>{value ?? "--"}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────
function RecCard({ item }) {
  return (
    <View style={styles.recCard}>
      <View style={[styles.recIconBox, { backgroundColor: item.iconColor + "18" }]}>
        <MaterialCommunityIcons name={item.icon} size={22} color={item.iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recTitle}>{item.title}</Text>
        <Text style={styles.recDesc}>{item.description}</Text>
      </View>
    </View>
  );
}

// ─── Badge chip ───────────────────────────────────────────────────────────────
function Badge({ item }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeIcon}>{item.icon}</Text>
      <Text style={styles.badgeTitle}>{item.title}</Text>
      <Text style={styles.badgeSub}>{item.subtitle}</Text>
    </View>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ h = 16, w = "100%", r = 8, mb = 0 }) {
  return (
    <View
      style={{
        height: h,
        width: w,
        borderRadius: r,
        backgroundColor: "#E2E8F0",
        marginBottom: mb,
      }}
    />
  );
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────
const TEST_TYPES = [
  { label: "HbA1c",               type: "HbA1c",         unit: "%",     placeholder: "e.g. 6.8",  min: 3,   max: 20  },
  { label: "Fasting Sugar (FBS)", type: "FBS",            unit: "mg/dL", placeholder: "e.g. 105",  min: 40,  max: 600 },
  { label: "Post-Meal (PPBS)",    type: "PPBS",           unit: "mg/dL", placeholder: "e.g. 145",  min: 40,  max: 700 },
  { label: "Cholesterol",        type: "Cholesterol",    unit: "mg/dL", placeholder: "e.g. 190",  min: 50,  max: 500 },
  { label: "LDL",                type: "LDL",            unit: "mg/dL", placeholder: "e.g. 100",  min: 20,  max: 400 },
  { label: "HDL",                type: "HDL",            unit: "mg/dL", placeholder: "e.g. 55",   min: 10,  max: 150 },
  { label: "Triglycerides",      type: "Triglycerides",  unit: "mg/dL", placeholder: "e.g. 140",  min: 20,  max: 1000 },
  { label: "Haemoglobin",        type: "Hemoglobin",     unit: "g/dL",  placeholder: "e.g. 13.5", min: 3,   max: 25  },
  { label: "Creatinine",         type: "Creatinine",     unit: "mg/dL", placeholder: "e.g. 0.9",  min: 0.1, max: 20  },
  { label: "TSH",                type: "TSH",            unit: "mIU/L", placeholder: "e.g. 2.5",  min: 0.01, max: 100 },
  { label: "Vitamin D",          type: "Vitamin D",      unit: "ng/mL", placeholder: "e.g. 30",   min: 1,   max: 200 },
];

function AddReportModal({ visible, onClose, onSaved }) {
  const { userData } = useUser();
  const [selectedType, setSelectedType] = useState(TEST_TYPES[0]);
  const [value, setValue] = useState("");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState(
    new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
  );
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setValue("");
    setLabName("");
    setTestDate(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }));
    setSelectedType(TEST_TYPES[0]);
  };

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < selectedType.min || num > selectedType.max) {
      Alert.alert("Invalid Value", `Please enter a valid ${selectedType.label} value (${selectedType.min}–${selectedType.max} ${selectedType.unit}).`);
      return;
    }
    if (!userData?.uid) { Alert.alert("Not signed in"); return; }

    setSaving(true);
    try {
      // Parse DD/MM/YYYY
      const parts = testDate.split(/[/\-\.]/);
      let parsedDate = new Date();
      if (parts.length === 3) {
        parsedDate = new Date(
          parseInt(parts[2], 10) < 100 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[0], 10)
        );
        if (isNaN(parsedDate.getTime())) parsedDate = new Date();
      }

      await addDoc(collection(db, "users", userData.uid, "healthReports"), {
        testType: selectedType.type,
        value: num,
        unit: selectedType.unit,
        labName: labName.trim() || "Manual Entry",
        testDate: parsedDate,
        source: "manual",
        createdAt: serverTimestamp(),
      });

      reset();
      onSaved?.();
      onClose();
      Alert.alert("Saved!", `${selectedType.label}: ${num} ${selectedType.unit} added to your records.`);
    } catch (e) {
      Alert.alert("Error", "Could not save. " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View style={modalStyles.sheet}>
          {/* Handle */}
          <View style={modalStyles.handle} />

          <View style={modalStyles.mHeader}>
            <Text style={modalStyles.mTitle}>Add Test Result</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.mClose}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Test type selector */}
          <Text style={modalStyles.mLabel}>Test Type</Text>
          <View style={modalStyles.typeRow}>
            {TEST_TYPES.map((t) => (
              <TouchableOpacity
                key={t.type}
                style={[modalStyles.typeChip, selectedType.type === t.type && modalStyles.typeChipActive]}
                onPress={() => setSelectedType(t)}
              >
                <Text style={[modalStyles.typeChipText, selectedType.type === t.type && modalStyles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Value input */}
          <Text style={modalStyles.mLabel}>Result Value ({selectedType.unit})</Text>
          <View style={modalStyles.inputRow}>
            <TextInput
              style={[modalStyles.input, { flex: 1 }]}
              placeholder={selectedType.placeholder}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              placeholderTextColor="#94A3B8"
            />
            <View style={modalStyles.unitBadge}>
              <Text style={modalStyles.unitText}>{selectedType.unit}</Text>
            </View>
          </View>

          {/* Date input */}
          <Text style={modalStyles.mLabel}>Test Date (DD/MM/YYYY)</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. 05/04/2026"
            value={testDate}
            onChangeText={setTestDate}
            placeholderTextColor="#94A3B8"
          />

          {/* Lab name */}
          <Text style={modalStyles.mLabel}>Lab Name (optional)</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Thyrocare, SRL, Dr. Lal"
            value={labName}
            onChangeText={setLabName}
            placeholderTextColor="#94A3B8"
          />

          <TouchableOpacity
            style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <Text style={modalStyles.saveBtnText}>Save Result</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function HealthDashboard() {
  const navigation = useNavigation();
  const {
    reports,
    loading,
    healthScore,
    breakdown,
    monthlyScores,
    recommendations,
    achievements,
    latestHbA1c,
    latestFBS,
    latestPPBS,
    scoreTrend,
    totalTests,
    thisMonth,
    nextTestDate,
  } = useHealthScore();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showInsightsLangPicker, setShowInsightsLangPicker] = useState(false);
  const [ttsLang, setTtsLang] = useState({ code: "en-IN", label: "English", speaker: "tanya" });
  const [insightsLang, setInsightsLang] = useState({ code: "en-IN", label: "English", speaker: "tanya" });
  const { speak, stop, speaking } = useSarvamTTS({ cacheFile: "health_score_voice.wav", languageCode: ttsLang.code, speaker: ttsLang.speaker });
  const { speak: speakInsights, stop: stopInsights, speaking: speakingInsights } = useSarvamTTS({ cacheFile: "health_insights_voice.wav", languageCode: insightsLang.code, speaker: insightsLang.speaker });

  const TTS_LANGS = [
    { code: "en-IN", label: "English",    speaker: "tanya"  },
    { code: "hi-IN", label: "हिंदी",       speaker: "anand"  },
    { code: "ta-IN", label: "தமிழ்",      speaker: "anand"  },
    { code: "te-IN", label: "తెలుగు",      speaker: "anand"  },
    { code: "kn-IN", label: "ಕನ್ನಡ",      speaker: "anand"  },
    { code: "ml-IN", label: "മലയാളം",    speaker: "anand"  },
    { code: "mr-IN", label: "मराठी",      speaker: "anand"  },
    { code: "gu-IN", label: "ગુજરాતી",    speaker: "anand"  },
    { code: "bn-IN", label: "বাংলা",      speaker: "anand"  },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const status   = scoreStatus(healthScore);
  const trendAbs = scoreTrend != null ? Math.abs(Math.round(scoreTrend)) : null;
  const trendUp  = scoreTrend != null && scoreTrend >= 0;

  // ── Build health score voice summary ────────────────────────────────────────
  const buildScoreScript = () => {
    if (healthScore == null) return "No health data yet. Please upload a lab report and run AI analysis to see your health score.";
    const st = scoreStatus(healthScore);
    const lines = [];

    // Overall score
    if (healthScore >= 80)
      lines.push(`Your overall health score is ${Math.round(healthScore)} out of 100. That is excellent — your blood sugar and overall health are very well managed. Keep it up!`);
    else if (healthScore >= 60)
      lines.push(`Your overall health score is ${Math.round(healthScore)} out of 100. That is good, but there is still some room for improvement in certain areas.`);
    else if (healthScore >= 40)
      lines.push(`Your overall health score is ${Math.round(healthScore)} out of 100. This needs attention. Some of your health markers are outside the healthy range.`);
    else
      lines.push(`Your overall health score is ${Math.round(healthScore)} out of 100. This is in the high risk zone. Please consult your doctor as soon as possible.`);

    // HbA1c explanation
    if (latestHbA1c) {
      const v = latestHbA1c.value;
      if (v < 5.7)
        lines.push(`Your HbA1c is ${v} percent, which is completely normal. HbA1c measures your average blood sugar over the past 3 months, and yours is in the healthy range — below 5.7 percent. This means your body is managing sugar well.`);
      else if (v < 6.5)
        lines.push(`Your HbA1c is ${v} percent, which is in the pre-diabetic range — between 5.7 and 6.4 percent. HbA1c shows your average blood sugar over 3 months. This is a warning sign, and lifestyle changes like diet and exercise can help bring it back to normal.`);
      else if (v < 7.0)
        lines.push(`Your HbA1c is ${v} percent. This indicates diabetes, but it is fairly well controlled. The target for most people with diabetes is below 7 percent. You are close — keep following your treatment plan.`);
      else
        lines.push(`Your HbA1c is ${v} percent, which is above the recommended target of 7 percent. This means your blood sugar has been consistently high over the past 3 months. Please discuss this with your doctor to adjust your management plan.`);
    }

    // Fasting sugar explanation
    if (latestFBS) {
      const v = latestFBS.value;
      if (v >= 70 && v <= 100)
        lines.push(`Your fasting blood sugar is ${v} milligrams per deciliter, which is perfectly normal. A healthy fasting sugar is between 70 and 100.`);
      else if (v <= 125)
        lines.push(`Your fasting blood sugar is ${v} milligrams per deciliter, which is slightly elevated. Normal fasting sugar should be below 100. Avoiding late-night snacks and sugary drinks can help.`);
      else
        lines.push(`Your fasting blood sugar is ${v} milligrams per deciliter, which is high. A reading above 126 is a concern and may indicate poorly controlled blood sugar. Please consult your doctor.`);
    }

    // Post-meal sugar explanation
    if (latestPPBS) {
      const v = latestPPBS.value;
      if (v < 140)
        lines.push(`Your post-meal blood sugar is ${v} milligrams per deciliter — that is normal. Post-meal sugar should stay below 140, and yours is well within range.`);
      else if (v <= 180)
        lines.push(`Your post-meal blood sugar is ${v} milligrams per deciliter, which is mildly elevated. Try taking a short 15-minute walk after meals — it can significantly reduce the spike.`);
      else
        lines.push(`Your post-meal blood sugar is ${v} milligrams per deciliter, which is high. This means your body is struggling to process sugar after meals. Talk to your doctor about dietary changes.`);
    }

    // Trend
    if (trendAbs != null) {
      if (trendUp)
        lines.push(`Good news — compared to last month, your health score has improved by ${trendAbs} points. You are moving in the right direction.`);
      else
        lines.push(`Compared to last month, your score has dropped by ${trendAbs} points. Try to stay consistent with your medications and diet this month.`);
    }

    lines.push("Remember, these numbers are a guide. Always consult your doctor for medical advice.");
    return lines.join(" ");
  };

  const handleVoiceScore = () => {
    if (speaking) { stop(); return; }
    speak(buildScoreScript());
  };

  // ── Build AI insights voice script ──────────────────────────────────────────
  const buildInsightsScript = () => {
    if (!recommendations.length) return "No insights available yet. Upload a lab report and run AI analysis to get personalised health advice.";

    const lines = ["Here are your personalised health insights based on your latest reports."];

    recommendations.forEach((rec) => {
      const title = rec.title || "";
      const desc  = rec.description || "";

      // Make each insight conversational based on the title keyword
      if (title.toLowerCase().includes("hba1c") && title.toLowerCase().includes("normal")) {
        lines.push(`Your HbA1c is in the normal range — that is fantastic. It means your blood sugar has been well controlled over the past 3 months. Keep doing what you are doing.`);
      } else if (title.toLowerCase().includes("hba1c") && title.toLowerCase().includes("elevated")) {
        lines.push(`Your HbA1c is elevated, which means your average blood sugar has been higher than the recommended level over the past 3 months. This is the most important number to bring under control. ${desc}`);
      } else if (title.toLowerCase().includes("post-meal") || title.toLowerCase().includes("ppbs")) {
        lines.push(`Your blood sugar is spiking after meals. ${desc} Even a short walk after eating can make a big difference.`);
      } else if (title.toLowerCase().includes("fasting")) {
        lines.push(`Your fasting blood sugar is above normal. ${desc} Try to eat dinner earlier and avoid sugary drinks before your morning test.`);
      } else if (title.toLowerCase().includes("irregular") || title.toLowerCase().includes("testing")) {
        lines.push(`You have been inconsistent with your health monitoring. Regular testing is very important — it helps you and your doctor catch changes early before they become serious problems.`);
      } else if (title.toLowerCase().includes("progress") || title.toLowerCase().includes("improving")) {
        lines.push(`Great news — your health markers are improving over time. Your efforts with diet, exercise, or medication are clearly working. Keep it up!`);
      } else {
        // Fallback: speak the description naturally
        lines.push(desc);
      }
    });

    lines.push("These are AI-generated insights. Always follow your doctor's guidance for any changes to your treatment.");
    return lines.join(" ");
  };

  const handleVoiceInsights = () => {
    if (speakingInsights) { stopInsights(); return; }
    speakInsights(buildInsightsScript());
  };

  const hasData = reports.length > 0;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartLabels = monthlyScores.map((m) => m.label);
  const chartValues = monthlyScores.map((m) => m.score ?? 0);
  const hasChartData = totalTests > 0 && chartValues.some((v) => v > 0);

  const chartData = {
    labels: chartLabels.length ? chartLabels : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [{ data: chartValues.length ? chartValues : [0, 0, 0, 0, 0, 0] }],
  };

  const nextTestStr = nextTestDate
    ? nextTestDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Upload a report first";

  return (
    <SafeAreaView style={styles.container}>
      <AddReportModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {}}
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Dashboard</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: "#EDE9FE" }]}
            onPress={() => setShowAddModal(true)}
          >
            <MaterialCommunityIcons name="pencil-plus" size={20} color="#7C3AED" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => navigation.navigate("UploadReport")}
          >
            <MaterialCommunityIcons name="upload" size={20} color="#2E75B6" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7C3AED"]} />
        }
      >
        {loading ? (
          /* ── Loading skeletons ── */
          <View style={{ gap: 16 }}>
            <View style={[styles.card, { alignItems: "center", paddingVertical: 40 }]}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={{ marginTop: 12, color: "#64748B", fontWeight: "600" }}>
                Calculating your health score…
              </Text>
            </View>
            {[1, 2, 3].map((k) => (
              <View key={k} style={[styles.card, { gap: 10 }]}>
                <Skeleton h={14} w="40%" mb={6} />
                <Skeleton h={10} />
                <Skeleton h={10} w="80%" />
                <Skeleton h={10} w="60%" />
              </View>
            ))}
          </View>
        ) : !hasData ? (
          /* ── EMPTY STATE (no reports uploaded yet) ── */
          <View style={styles.emptyStateContainer}>
            <MaterialCommunityIcons name="file-chart-outline" size={72} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>No Health Data Yet</Text>
            <Text style={styles.emptyStateSub}>
              Upload a lab report and analyze it with AI to see your health score, metrics, and personalized insights here.
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => navigation.navigate("UploadReport")}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="upload" size={20} color="#FFF" />
              <Text style={styles.ctaText}>Upload Report</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── MAIN SCORE CARD ── */}
            <View style={[styles.card, styles.scoreCard]}>
              {/* Purple-blue gradient background via nested views */}
              <View style={styles.scoreGradient} />

              <Text style={styles.scoreCardTitle}>Overall Health Score</Text>

              <CircularScore score={healthScore} size={170} />

              <View style={[styles.statusChip, { backgroundColor: status.color + "25" }]}>
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>

              {trendAbs != null && (
                <View style={styles.trendRow}>
                  <MaterialCommunityIcons
                    name={trendUp ? "trending-up" : "trending-down"}
                    size={16}
                    color={trendUp ? "#10B981" : "#EF4444"}
                  />
                  <Text style={[styles.trendText, { color: trendUp ? "#10B981" : "#EF4444" }]}>
                    {trendUp ? "+" : "-"}{trendAbs} from last month
                  </Text>
                </View>
              )}

              <Text style={styles.updatedText}>
                Last updated:{" "}
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </Text>

              {/* Voice + Language buttons */}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}>
                <TouchableOpacity
                  style={[hStyles.voiceBtn, speaking && hStyles.voiceBtnActive, { flex: 1 }]}
                  onPress={handleVoiceScore}
                >
                  <MaterialCommunityIcons
                    name={speaking ? "stop-circle" : "volume-high"}
                    size={16}
                    color={speaking ? "#7C3AED" : "#8B5CF6"}
                  />
                  <Text style={[hStyles.voiceBtnText, speaking && { color: "#7C3AED" }]}>
                    {speaking ? "Stop Voice" : "Explain aloud"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[hStyles.voiceBtn, { paddingHorizontal: 10 }]}
                  onPress={() => setShowLangPicker(v => !v)}
                >
                  <MaterialCommunityIcons name="translate" size={16} color="#8B5CF6" />
                  <Text style={hStyles.voiceBtnText}>{ttsLang.label}</Text>
                </TouchableOpacity>
              </View>
              {showLangPicker && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
                  {TTS_LANGS.map(lang => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[hStyles.langChip, ttsLang.code === lang.code && hStyles.langChipActive]}
                      onPress={() => { setTtsLang(lang); setShowLangPicker(false); }}
                    >
                      <Text style={[hStyles.langChipText, ttsLang.code === lang.code && { color: "#FFF" }]}>{lang.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* ── SCORE BREAKDOWN ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Score Breakdown</Text>
              <Text style={styles.cardSub}>How your overall score is calculated</Text>
              <View style={{ marginTop: 14, gap: 14 }}>
                {breakdown.map((item, i) => (
                  <BreakdownRow key={i} item={item} />
                ))}
              </View>
            </View>

            {/* ── TREND CHART ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>6-Month Trend</Text>
              <Text style={styles.cardSub}>Your health score over the last 6 months</Text>
              <View style={{ marginTop: 16 }}>
                {hasChartData ? (
                  <LineChart
                    data={chartData}
                    width={CHART_WIDTH}
                    height={180}
                    chartConfig={{
                      backgroundGradientFrom: "#FFF",
                      backgroundGradientTo: "#FFF",
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(124, 58, 237, ${opacity})`,
                      labelColor: () => "#64748B",
                      propsForDots: { r: "5", strokeWidth: "2", stroke: "#7C3AED" },
                      propsForBackgroundLines: { stroke: "#F1F5F9" },
                    }}
                    bezier
                    style={{ borderRadius: 12, marginLeft: -16 }}
                    fromZero
                    yAxisSuffix=""
                  />
                ) : (
                  <View style={styles.noDataBox}>
                    <MaterialCommunityIcons name="chart-line" size={40} color="#CBD5E1" />
                    <Text style={styles.noDataText}>Upload reports to see your trend</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── QUICK METRICS GRID ── */}
            <Text style={styles.sectionTitle}>Key Metrics</Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="diabetes"
                iconColor="#7C3AED"
                title="Avg HbA1c"
                value={latestHbA1c ? `${latestHbA1c.value}%` : "--"}
                sub={latestHbA1c ? (latestHbA1c.value < 5.7 ? "Normal" : latestHbA1c.value < 6.5 ? "Pre-diabetic" : "High") : "No data"}
                onPress={() => navigation.navigate("AI")}
              />
              <MetricCard
                icon="water"
                iconColor="#2E75B6"
                title="Fasting Sugar"
                value={latestFBS ? `${latestFBS.value}` : "--"}
                sub={latestFBS ? "mg/dL" : "No data"}
                onPress={() => navigation.navigate("AI")}
              />
              <MetricCard
                icon="food"
                iconColor="#F59E0B"
                title="Post-Meal"
                value={latestPPBS ? `${latestPPBS.value}` : "--"}
                sub={latestPPBS ? "mg/dL" : "No data"}
                onPress={() => navigation.navigate("AI")}
              />
              <MetricCard
                icon="file-multiple"
                iconColor="#10B981"
                title="Total Tests"
                value={totalTests}
                sub="uploaded"
              />
              <MetricCard
                icon="calendar-today"
                iconColor="#EF4444"
                title="This Month"
                value={thisMonth}
                sub="tests"
              />
              <MetricCard
                icon="calendar-clock"
                iconColor="#8B5CF6"
                title="Next Test"
                value={nextTestDate ? nextTestDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                sub={nextTestDate ? "recommended" : "Upload first"}
              />
            </View>

            {/* ── AI RECOMMENDATIONS ── */}
            <View style={styles.card}>
              <View style={styles.aiHeader}>
                <MaterialCommunityIcons name="robot-outline" size={22} color="#8B5CF6" />
                <Text style={styles.cardTitle}>AI Insights</Text>
              </View>
              <Text style={styles.cardSub}>Personalised recommendations based on your data</Text>
              <View style={{ marginTop: 14, gap: 12 }}>
                {recommendations.map((rec, i) => (
                  <RecCard key={i} item={rec} />
                ))}
              </View>
              {/* Voice controls for AI insights */}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 14 }}>
                <TouchableOpacity
                  style={[hStyles.voiceBtn, speakingInsights && hStyles.voiceBtnActive, { flex: 1 }]}
                  onPress={handleVoiceInsights}
                >
                  <MaterialCommunityIcons
                    name={speakingInsights ? "stop-circle" : "volume-high"}
                    size={16}
                    color={speakingInsights ? "#7C3AED" : "#8B5CF6"}
                  />
                  <Text style={[hStyles.voiceBtnText, speakingInsights && { color: "#7C3AED" }]}>
                    {speakingInsights ? "Stop Voice" : "Explain aloud"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[hStyles.voiceBtn, { paddingHorizontal: 10 }]}
                  onPress={() => setShowInsightsLangPicker(v => !v)}
                >
                  <MaterialCommunityIcons name="translate" size={16} color="#8B5CF6" />
                  <Text style={hStyles.voiceBtnText}>{insightsLang.label}</Text>
                </TouchableOpacity>
              </View>
              {showInsightsLangPicker && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
                  {TTS_LANGS.map(lang => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[hStyles.langChip, insightsLang.code === lang.code && hStyles.langChipActive]}
                      onPress={() => { setInsightsLang(lang); setShowInsightsLangPicker(false); }}
                    >
                      <Text style={[hStyles.langChipText, insightsLang.code === lang.code && { color: "#FFF" }]}>{lang.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* ── ANONYMOUS COMPARISON ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>How You Compare</Text>
              <Text style={styles.cardSub}>Your score vs. estimated population averages</Text>
              <View style={styles.compareRow}>
                <View style={[styles.compareChip, { backgroundColor: "#EDE9FE" }]}>
                  <Text style={styles.compareNum}>
                    {healthScore != null ? `${Math.min(99, Math.round(healthScore))}` : "--"}
                  </Text>
                  <Text style={styles.compareLabel}>Your Score</Text>
                </View>
                <View style={[styles.compareChip, { backgroundColor: "#DBEAFE" }]}>
                  <Text style={styles.compareNum}>
                    {healthScore != null ? Math.max(40, Math.min(75, Math.round(healthScore * 0.85))) : "65"}
                  </Text>
                  <Text style={styles.compareLabel}>Avg (similar age)</Text>
                </View>
                <View style={[styles.compareChip, { backgroundColor: "#D1FAE5" }]}>
                  <Text style={styles.compareNum}>
                    {healthScore != null ? Math.max(50, Math.min(80, Math.round(healthScore * 0.9))) : "72"}
                  </Text>
                  <Text style={styles.compareLabel}>National avg</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, color: "#94A3B8", marginTop: 8, textAlign: "center" }}>
                * Averages are estimates based on typical population health data
              </Text>
            </View>

            {/* ── ACHIEVEMENT BADGES ── */}
            {achievements.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Achievements</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }}>
                  <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 24 }}>
                    {achievements.map((b) => (
                      <Badge key={b.id} item={b} />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* ── UPLOAD CTA ── */}
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => navigation.navigate("UploadReport")}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="upload" size={20} color="#FFF" />
              <Text style={styles.ctaText}>Upload New Report</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },

  body: { padding: 24, paddingBottom: 60, gap: 16 },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B", marginLeft: 8 },
  cardSub: { fontSize: 12, color: "#64748B", fontWeight: "600", marginTop: 4 },

  // ── Score card ──
  scoreCard: { alignItems: "center", paddingVertical: 32, overflow: "hidden" },
  scoreGradient: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "60%",
    backgroundColor: "#7C3AED",
    opacity: 0.07,
    borderRadius: 20,
  },
  scoreCardTitle: { fontSize: 13, fontWeight: "800", color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 },
  statusChip: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20 },
  statusLabel: { fontSize: 14, fontWeight: "900" },
  trendRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 5 },
  trendText: { fontSize: 13, fontWeight: "700" },
  updatedText: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 10 },

  // ── Breakdown ──
  bRow: { gap: 6 },
  bLabelCol: { flexDirection: "row", justifyContent: "space-between" },
  bLabel: { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  bWeight: { fontSize: 11, fontWeight: "700", color: "#94A3B8" },
  bBarWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  bBarTrack: { flex: 1, height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  bBarFill: { height: "100%", borderRadius: 4 },
  bScore: { fontSize: 14, fontWeight: "900", width: 28, textAlign: "right" },
  bValue: { fontSize: 11, color: "#64748B", fontWeight: "600" },

  // ── Metrics grid ──
  sectionTitle: { fontSize: 13, fontWeight: "900", color: "#64748B", letterSpacing: 1, textTransform: "uppercase" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    width: (width - 48 - 24) / 3,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  metricIconBox: { padding: 10, borderRadius: 12, marginBottom: 8 },
  metricValue: { fontSize: 18, fontWeight: "900", color: "#1E293B", textAlign: "center" },
  metricTitle: { fontSize: 11, fontWeight: "800", color: "#64748B", textAlign: "center", marginTop: 2 },
  metricSub: { fontSize: 10, color: "#94A3B8", fontWeight: "600", textAlign: "center", marginTop: 2 },

  // ── Recommendations ──
  aiHeader: { flexDirection: "row", alignItems: "center" },
  recCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  recIconBox: { padding: 10, borderRadius: 12, marginTop: 1 },
  recTitle: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  recDesc: { fontSize: 13, color: "#475569", fontWeight: "500", marginTop: 4, lineHeight: 20 },

  // ── Comparison ──
  compareRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  compareChip: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  compareNum: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  compareLabel: { fontSize: 10, fontWeight: "700", color: "#64748B", marginTop: 4, textAlign: "center" },

  // ── Badges ──
  badge: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    width: 120,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeTitle: { fontSize: 12, fontWeight: "900", color: "#1E293B", textAlign: "center" },
  badgeSub: { fontSize: 10, color: "#94A3B8", fontWeight: "600", marginTop: 3, textAlign: "center" },

  // ── CTA ──
  ctaBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 3,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  ctaText: { color: "#FFF", fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },

  // ── Empty state ──
  noDataBox: { alignItems: "center", paddingVertical: 30, gap: 10 },
  noDataText: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  emptyStateContainer: { alignItems: "center", paddingVertical: 60, gap: 16, paddingHorizontal: 16 },
  emptyStateTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  emptyStateSub: { fontSize: 14, color: "#64748B", fontWeight: "600", textAlign: "center", lineHeight: 22 },

  uploadBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 20,
  },
  mHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  mTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  mClose: { padding: 4 },
  mLabel: { fontSize: 12, fontWeight: "800", color: "#64748B", marginBottom: 8, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  typeChipActive: { borderColor: "#7C3AED", backgroundColor: "#EDE9FE" },
  typeChipText: { fontSize: 11, fontWeight: "800", color: "#64748B", textAlign: "center" },
  typeChipTextActive: { color: "#7C3AED" },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "700",
    backgroundColor: "#F8FAFC",
  },
  unitBadge: {
    backgroundColor: "#EDE9FE",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  unitText: { fontSize: 13, fontWeight: "900", color: "#7C3AED" },
  saveBtn: {
    marginTop: 24,
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  saveBtnText: { color: "#FFF", fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
});

// ── Voice button styles (separate to avoid conflicts) ─────────────────────────
const hStyles = StyleSheet.create({
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  voiceBtnActive: { borderColor: "#7C3AED", backgroundColor: "#EDE9FE" },
  voiceBtnText: { color: "#8B5CF6", fontWeight: "700", fontSize: 13 },
  langChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    backgroundColor: "#F5F3FF",
  },
  langChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  langChipText: { fontSize: 12, fontWeight: "700", color: "#7C3AED" },
});
