import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { useNavigation, useRoute } from "@react-navigation/native";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const screenWidth = Dimensions.get("window").width;

// ─── Gemini prompt — extracts full blood panel as structured JSON ─────────────
const EXTRACTION_PROMPT = `You are an expert medical OCR system. Analyze this Indian lab report image carefully.

Step 1 — OCR: Read ALL text visible in the image including patient header info.
Step 2 — Extract patient details: name, age, gender, blood group (if shown).
Step 3 — Extract every blood test metric (HbA1c, Fasting Sugar, Post Prandial Sugar, Total Cholesterol, LDL, HDL, Triglycerides, Haemoglobin, Creatinine, TSH, Vitamin D, Vitamin B12, WBC, RBC, Platelets, etc.)
Step 4 — Classify each metric status as exactly: "normal", "borderline", or "high"
Step 5 — From abnormal metrics, derive likely medical conditions (e.g. high HbA1c → Diabetes, low Haemoglobin → Anaemia, high Cholesterol → Dyslipidaemia).
Step 6 — Extract any medications or allergies mentioned in the report.
Step 7 — Write a plain-English voice summary (2-3 sentences, suitable for an elderly person).

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "date": "DD/MM/YYYY",
  "lab": "Lab name from report",
  "patient": "Patient full name if visible",
  "age": "52",
  "gender": "Female",
  "bloodGroup": "O+",
  "metrics": [
    {
      "name": "HbA1c",
      "value": 7.2,
      "unit": "%",
      "normalRange": "4.0 - 5.7",
      "status": "high"
    }
  ],
  "conditions": [
    { "title": "Diabetes Mellitus", "subtitle": "HbA1c elevated at 7.2%", "history": "Detected from latest lab report" }
  ],
  "medications": [],
  "allergies": [],
  "ocrText": "First 300 characters of raw OCR text from report",
  "summary": "Your blood test results show your HbA1c is 7.2 percent which is high, suggesting elevated blood sugar over the past 3 months. I recommend consulting your doctor about diabetes management."
}`;

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  normal:     { color: "#22C55E", bg: "#DCFCE7", label: "Normal",     icon: "check-circle" },
  borderline: { color: "#F59E0B", bg: "#FEF3C7", label: "Borderline", icon: "alert-circle" },
  high:       { color: "#EF4444", bg: "#FEE2E2", label: "High",       icon: "close-circle" },
  abnormal:   { color: "#EF4444", bg: "#FEE2E2", label: "Abnormal",   icon: "close-circle" },
  low:        { color: "#3B82F6", bg: "#DBEAFE", label: "Low",        icon: "arrow-down-circle" },
};
const STATUS_CONFIG = new Proxy(STATUS_MAP, {
  get: (target, key) =>
    target[String(key).toLowerCase()] || target.normal,
});

export default function AIDashboard() {
  const route = useRoute();
  const navigation = useNavigation();
  const { userData } = useUser();
  const { reportUri } = route.params || {};

  const [step, setStep]           = useState(reportUri ? "scanning" : "history");
  const [ocrText, setOcrText]     = useState("");
  const [analysis, setAnalysis]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [showOcr, setShowOcr]     = useState(false);
  const [activeTab, setActiveTab] = useState("metrics");
  const [history, setHistory]     = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histDashTab, setHistDashTab] = useState("History");

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (reportUri) {
      analyzeReport();
    } else {
      loadHistory();
    }
  }, [reportUri]);

  const loadHistory = async () => {
    if (!userData?.uid) return;
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, "users", userData.uid, "aiAnalyses"),
        orderBy("analyzedAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {}
    setHistoryLoading(false);
  };

  // ─── OCR + AI extraction ────────────────────────────────────────────────────
  const analyzeReport = async () => {
    try {
      setStep("scanning");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // If it's a remote Firebase Storage URL, download to cache first
      let localUri = reportUri;
      if (typeof reportUri === "string" && reportUri.startsWith("http")) {
        const cacheUri =
          FileSystem.cacheDirectory + `report_${Date.now()}.jpg`;
        const { uri } = await FileSystem.downloadAsync(reportUri, cacheUri);
        localUri = uri;
      }

      const base64Data = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
      ]);

      const raw = result.response.text().replace(/```json|```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Gemini returned prose instead of JSON — build a fallback
        parsed = {
          date: new Date().toLocaleDateString("en-GB"),
          lab: "Unknown",
          patient: "",
          metrics: [],
          ocrText: raw.slice(0, 300),
          summary:
            "I could not extract structured data from this image. Please try with a clearer photo of your lab report.",
        };
      }

      if (!isMounted.current) return;
      setAnalysis(parsed);
      setOcrText(parsed.ocrText || "");
      setStep("done");
    } catch (err) {
      if (!isMounted.current) return;
      setStep("error");
    }
  };

  // ─── Voice explanation ──────────────────────────────────────────────────────
  const handleSpeak = async () => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }

    const text = analysis?.summary ||
      "No analysis available yet. Please upload a lab report first.";

    setSpeaking(true);
    Speech.speak(text, {
      language: "en-IN",   // Indian English accent
      pitch: 1.0,
      rate: 0.85,          // Slightly slower for elderly users
      onDone: () => { if (isMounted.current) setSpeaking(false); },
      onError: () => { if (isMounted.current) setSpeaking(false); },
    });
  };

  // ─── Save to Firestore ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!analysis || !userData?.uid) {
      navigation.navigate("Home");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "users", userData.uid, "aiAnalyses"), {
        date: analysis.date,
        lab: analysis.lab,
        patient: analysis.patient,
        metrics: analysis.metrics,
        summary: analysis.summary,
        ocrText: analysis.ocrText,
        analyzedAt: serverTimestamp(),
      });

      // ── Build conditions from AI-extracted conditions + high metrics fallback ──
      const aiConditions = (analysis.conditions || []).map((c, i) => ({
        id: `ai_cond_${i}`,
        title: c.title || c.name || "Condition",
        subtitle: c.subtitle || c.description || "",
        history: c.history || "Detected from uploaded lab report",
        type: "chart-line",
      }));

      if (aiConditions.length === 0) {
        // fallback: derive from high metrics
        const highMetrics = (analysis.metrics || []).filter((m) => {
          const s = String(m.status || "").toLowerCase();
          return s === "high" || s === "borderline" || s === "abnormal";
        });
        highMetrics.slice(0, 5).forEach((m, i) => {
          aiConditions.push({
            id: `ai_metric_${i}`,
            title: m.name,
            subtitle: `${m.value} ${m.unit || ""} — Ref: ${m.normalRange || "N/A"}`,
            history: String(m.status).toLowerCase() === "high" ? "Abnormal — consult your doctor" : "Borderline — monitor closely",
            type: "chart-line",
          });
        });
      }

      // ── Build medications from AI extraction ──
      const aiMedications = (analysis.medications || []).map((med, i) => ({
        id: `ai_med_${i}`,
        name: typeof med === "string" ? med : med.name || med,
        dose: med.dose || med.dosage || "As prescribed",
      }));

      // ── Build allergies from AI extraction ──
      const aiAllergies = (analysis.allergies || []).map((a, i) => ({
        id: `ai_allergy_${i}`,
        name: typeof a === "string" ? a : a.name || a,
        severity: a.severity || "Check with doctor",
      }));

      // ── Build update payload — only overwrite fields that are currently empty ──
      const emergencyUpdate = {};
      if (aiConditions.length > 0) {
        emergencyUpdate["emergency.autoConditions"] = aiConditions;
      }
      if (aiMedications.length > 0) {
        emergencyUpdate["emergency.autoMedications"] = aiMedications;
      }
      if (aiAllergies.length > 0) {
        emergencyUpdate["emergency.autoAllergies"] = aiAllergies;
      }
      // Age and blood group — only set if not already manually set
      if (analysis.age) emergencyUpdate["emergency.autoAge"] = String(analysis.age).replace(/\D.*/, "");
      if (analysis.bloodGroup) emergencyUpdate["emergency.autoBloodGroup"] = analysis.bloodGroup;
      if (analysis.gender) emergencyUpdate["emergency.autoGender"] = analysis.gender;

      await updateDoc(doc(db, "users", userData.uid), {
        "healthSummary.lastAnalyzedAt": serverTimestamp(),
        "healthSummary.metrics": analysis.metrics || [],
        "healthSummary.summary": analysis.summary || "",
        "healthSummary.lab": analysis.lab || "",
        ...emergencyUpdate,
      });

      Alert.alert("Saved!", "AI analysis saved to your health records.", [
        { text: "OK", onPress: () => navigation.navigate("Home") },
      ]);
    } catch (e) {
      Alert.alert("Save Error", "Could not save. " + e.message);
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  // ─── Chart data ─────────────────────────────────────────────────────────────
  const buildChartData = () => {
    const chartable = (analysis?.metrics || [])
      .map((m) => ({ ...m, value: parseFloat(m.value) }))
      .filter((m) => !isNaN(m.value) && m.value > 0)
      .slice(0, 6);

    if (chartable.length === 0) return null;

    return {
      labels: chartable.map((m) =>
        m.name.length > 6 ? m.name.slice(0, 5) + "…" : m.name
      ),
      datasets: [
        {
          data: chartable.map((m) => m.value),
          colors: chartable.map((m) => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.normal;
            return () => cfg.color;
          }),
        },
      ],
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — History / Dashboard (no reportUri passed)
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "history") {
    // Build trend chart from all history
    const buildTrendChart = () => {
      if (history.length === 0) return null;
      // Collect unique metric names that have numeric values across all analyses
      const nameSet = new Set();
      history.forEach((h) =>
        (h.metrics || []).forEach((m) => {
          if (!isNaN(parseFloat(m.value))) nameSet.add(m.name);
        })
      );
      const metricNames = Array.from(nameSet).slice(0, 4);
      if (metricNames.length === 0) return null;

      // For each metric, get the latest 5 values in chronological order
      const sliced = history.slice(0, 5).reverse();
      const labels = sliced.map((h) => {
        if (h.analyzedAt?.toDate) {
          const d = h.analyzedAt.toDate();
          return `${d.getDate()}/${d.getMonth() + 1}`;
        }
        return h.date?.slice(0, 5) || "—";
      });

      const datasets = metricNames.map((name, idx) => {
        const COLORS = ["#8B5CF6", "#2E75B6", "#10B981", "#F59E0B"];
        const vals = sliced.map((h) => {
          const m = (h.metrics || []).find((x) => x.name === name);
          return m ? parseFloat(m.value) || 0 : 0;
        });
        return { data: vals, color: () => COLORS[idx % 4], strokeWidth: 2 };
      });

      return { labels, datasets, legend: metricNames };
    };

    const trendData = buildTrendChart();

    return (
      <View style={[styles.container, { backgroundColor: "#F8FAFC" }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Dashboard</Text>
          <TouchableOpacity onPress={() => navigation.navigate("UploadReport")}>
            <MaterialCommunityIcons name="plus" size={28} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.dashTabRow}>
          {["History", "Trends", "Chat"].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.dashTab, histDashTab === t && styles.dashTabActive]}
              onPress={() => setHistDashTab(t)}
            >
              <MaterialCommunityIcons
                name={t === "History" ? "clock-outline" : t === "Trends" ? "chart-line" : "robot-outline"}
                size={16}
                color={histDashTab === t ? "#8B5CF6" : "#94A3B8"}
              />
              <Text style={[styles.dashTabText, histDashTab === t && styles.dashTabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {historyLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={{ color: "#64748B", marginTop: 12 }}>Loading...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="robot-outline" size={60} color="#CBD5E1" />
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B", marginTop: 16 }}>No analyses yet</Text>
            <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>
              Upload a lab report image and tap "Analyze with AI" to get started.
            </Text>
            <TouchableOpacity style={[styles.retryBtn, { marginTop: 24 }]} onPress={() => navigation.navigate("UploadReport")}>
              <Text style={styles.retryBtnText}>Upload Report</Text>
            </TouchableOpacity>
          </View>
        ) : histDashTab === "History" ? (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {history.map((item) => {
              const abnormal = (item.metrics || []).filter(
                (m) => String(m.status).toLowerCase() !== "normal"
              );
              const date = item.analyzedAt?.toDate
                ? item.analyzedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : item.date || "—";
              return (
                <View key={item.id} style={styles.historyCard}>
                  <TouchableOpacity
                    onPress={() => { setAnalysis(item); setOcrText(item.ocrText || ""); setStep("done"); }}
                  >
                    <View style={styles.historyCardTop}>
                      <View style={styles.historyLabBadge}>
                        <MaterialCommunityIcons name="hospital-building" size={14} color="#8B5CF6" />
                        <Text style={styles.historyLabText}>{item.lab || "Lab Report"}</Text>
                      </View>
                      <Text style={styles.historyDate}>{date}</Text>
                    </View>
                    <Text style={styles.historySummary} numberOfLines={2}>{item.summary || "No summary"}</Text>
                    <View style={styles.historyMeta}>
                      <Text style={styles.historyMetrics}>{item.metrics?.length || 0} metrics</Text>
                      {abnormal.length > 0 && (
                        <View style={styles.historyWarnBadge}>
                          <Text style={styles.historyWarnText}>{abnormal.length} need attention</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  {/* Chat button per report */}
                  <TouchableOpacity
                    style={styles.historyChatBtn}
                    onPress={() => navigation.navigate("AIChat")}
                  >
                    <MaterialCommunityIcons name="robot-outline" size={15} color="#8B5CF6" />
                    <Text style={styles.historyChatBtnText}>Ask AI about this</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : histDashTab === "Trends" ? (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.trendTitle}>Health Metric Trends</Text>
            <Text style={styles.trendSub}>Across your last {Math.min(history.length, 5)} analyses</Text>
            {trendData ? (
              <>
                <LineChart
                  data={trendData}
                  width={screenWidth - 32}
                  height={240}
                  chartConfig={{
                    backgroundColor: "#1E293B",
                    backgroundGradientFrom: "#1E293B",
                    backgroundGradientTo: "#334155",
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                    style: { borderRadius: 16 },
                  }}
                  bezier
                  style={{ borderRadius: 16, marginBottom: 16 }}
                  legend={trendData.legend}
                />
                {/* Per-metric summary cards */}
                {trendData.legend.map((name, idx) => {
                  const COLORS = ["#8B5CF6", "#2E75B6", "#10B981", "#F59E0B"];
                  const latest = history[0]?.metrics?.find((m) => m.name === name);
                  if (!latest) return null;
                  const cfg = STATUS_CONFIG[latest.status] || STATUS_CONFIG.normal;
                  return (
                    <View key={name} style={[styles.trendMetricCard, { borderLeftColor: COLORS[idx % 4] }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trendMetricName}>{name}</Text>
                        <Text style={styles.trendMetricRange}>Normal: {latest.normalRange || "—"}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.trendMetricVal, { color: cfg.color }]}>
                          {latest.value} {latest.unit}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.center}>
                <MaterialCommunityIcons name="chart-line" size={50} color="#CBD5E1" />
                <Text style={{ color: "#94A3B8", marginTop: 12, textAlign: "center" }}>
                  Not enough numeric data to draw trends yet.
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Chat tab — navigate directly */
          <View style={styles.center}>
            <MaterialCommunityIcons name="robot" size={60} color="#8B5CF6" />
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B", marginTop: 16 }}>
              Chat with MediVault AI
            </Text>
            <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8, paddingHorizontal: 30 }}>
              Ask questions about your health reports. AI has access to all your {history.length} analyses.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { marginTop: 24, backgroundColor: "#8B5CF6" }]}
              onPress={() => navigation.navigate("AIChat")}
            >
              <Text style={styles.retryBtnText}>Start Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Scanning state
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "scanning") {
    return (
      <View style={styles.center}>
        <View style={styles.scanningCard}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.scanningTitle}>MediVault AI Scanning</Text>
          <Text style={styles.scanningStep}>Step 1: Reading your report (OCR)...</Text>
          <Text style={styles.scanningStep}>Step 2: Extracting blood test values...</Text>
          <Text style={styles.scanningStep}>Step 3: Analyzing with Gemini AI...</Text>
          <Text style={styles.scanningNote}>
            Powered by Google Gemini · No extra API key needed
          </Text>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Error state
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "error") {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="image-broken" size={60} color="#EF4444" />
        <Text style={styles.errorTitle}>Could not read report</Text>
        <Text style={styles.errorSub}>
          Try a clearer, well-lit photo of your lab report.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => navigation.navigate("UploadReport")}
        >
          <Text style={styles.retryBtnText}>Upload Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Results
  // ═══════════════════════════════════════════════════════════════════════════
  const chartData = buildChartData();

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Speech.stop(); navigation.goBack(); }}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Analysis</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* ── Report meta ────────────────────────────────────────── */}
      {analysis && (
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="hospital-building" size={18} color="#8B5CF6" />
            <Text style={styles.metaText}>{analysis.lab || "Lab"}</Text>
          </View>
          {!!analysis.patient && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="account" size={18} color="#8B5CF6" />
              <Text style={styles.metaText}>{analysis.patient}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="calendar" size={18} color="#8B5CF6" />
            <Text style={styles.metaText}>{analysis.date || "Date unknown"}</Text>
          </View>
          <View style={styles.metricsCountBadge}>
            <Text style={styles.metricsCountText}>
              {analysis.metrics?.length || 0} metrics extracted
            </Text>
          </View>
        </View>
      )}

      {/* ── Voice Explain Button ────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.voiceBtn, speaking && styles.voiceBtnActive]}
        onPress={handleSpeak}
      >
        <MaterialCommunityIcons
          name={speaking ? "stop-circle" : "volume-high"}
          size={24}
          color="#FFF"
        />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.voiceBtnTitle}>
            {speaking ? "Tap to Stop" : "Voice Explain"}
          </Text>
          <Text style={styles.voiceBtnSub}>
            {speaking ? "Speaking in English..." : "AI reads your results aloud"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── AI Summary Box ──────────────────────────────────────── */}
      {!!analysis?.summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>AI Summary</Text>
          <Text style={styles.summaryText}>{analysis.summary}</Text>
          <Text style={styles.disclaimer}>
            For informational purposes only. Always consult your doctor.
          </Text>
        </View>
      )}

      {/* ── Tab switcher (Metrics | Chart) ─────────────────────── */}
      {analysis?.metrics?.length > 0 && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "metrics" && styles.tabActive]}
            onPress={() => setActiveTab("metrics")}
          >
            <Text style={[styles.tabText, activeTab === "metrics" && styles.tabTextActive]}>
              Metrics
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "chart" && styles.tabActive]}
            onPress={() => setActiveTab("chart")}
          >
            <Text style={[styles.tabText, activeTab === "chart" && styles.tabTextActive]}>
              Chart
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Metrics list ───────────────────────────────────────── */}
      {activeTab === "metrics" && (
        <View style={styles.metricsSection}>
          {analysis?.metrics?.length > 0 ? (
            analysis.metrics.map((m, i) => {
              const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.normal;
              return (
                <View key={i} style={[styles.metricCard, { borderLeftColor: cfg.color }]}>
                  <View style={styles.metricLeft}>
                    <Text style={styles.metricName}>{m.name}</Text>
                    <Text style={styles.metricRange}>Normal: {m.normalRange || "—"}</Text>
                  </View>
                  <View style={styles.metricRight}>
                    <Text style={[styles.metricValue, { color: cfg.color }]}>
                      {m.value}
                      <Text style={styles.metricUnit}> {m.unit}</Text>
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <MaterialCommunityIcons name={cfg.icon} size={12} color={cfg.color} />
                      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyMetrics}>
              <MaterialCommunityIcons name="robot-confused-outline" size={50} color="#CBD5E1" />
              <Text style={styles.emptyMetricsText}>
                No structured values extracted. Try uploading a clearer image.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Bar Chart ──────────────────────────────────────────── */}
      {activeTab === "chart" && (
        <View style={styles.chartSection}>
          {chartData ? (
            <>
              <Text style={styles.chartTitle}>Your Values at a Glance</Text>
              <Text style={styles.chartSubtitle}>
                Colors: Green = Normal · Yellow = Borderline · Red = High
              </Text>
              <BarChart
                data={chartData}
                width={screenWidth - 40}
                height={240}
                withCustomBarColorFromData
                flatColor
                showValuesOnTopOfBars
                chartConfig={{
                  backgroundColor: "#1E293B",
                  backgroundGradientFrom: "#1E293B",
                  backgroundGradientTo: "#334155",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                  barPercentage: 0.7,
                  style: { borderRadius: 16 },
                }}
                style={styles.chart}
                fromZero
              />
              <View style={styles.chartLegend}>
                {analysis.metrics
                  .map((m) => ({ ...m, value: parseFloat(m.value) }))
                  .filter((m) => !isNaN(m.value) && m.value > 0)
                  .slice(0, 6)
                  .map((m, i) => {
                    const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.normal;
                    return (
                      <View key={i} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                        <Text style={styles.legendText}>
                          {m.name}: {m.value} {m.unit}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </>
          ) : (
            <View style={styles.emptyMetrics}>
              <MaterialCommunityIcons name="chart-bar" size={50} color="#CBD5E1" />
              <Text style={styles.emptyMetricsText}>
                No numeric values to chart. Metrics need numeric values.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── OCR Raw Text (collapsible) ──────────────────────────── */}
      {!!ocrText && (
        <TouchableOpacity
          style={styles.ocrToggle}
          onPress={() => setShowOcr(!showOcr)}
        >
          <MaterialCommunityIcons
            name={showOcr ? "chevron-up" : "chevron-down"}
            size={18}
            color="#64748B"
          />
          <Text style={styles.ocrToggleText}>
            {showOcr ? "Hide" : "Show"} extracted OCR text
          </Text>
        </TouchableOpacity>
      )}
      {showOcr && (
        <View style={styles.ocrBox}>
          <Text style={styles.ocrLabel}>Raw OCR Output (Gemini)</Text>
          <Text style={styles.ocrText}>{ocrText}</Text>
        </View>
      )}

      {/* ── Action buttons ─────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <MaterialCommunityIcons name="content-save" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>SAVE TO HEALTH RECORDS</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.uploadAnotherBtn}
        onPress={() => { Speech.stop(); navigation.navigate("UploadReport"); }}
      >
        <Text style={styles.uploadAnotherText}>Upload Another Report</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 30,
  },

  // Scanning
  scanningCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    elevation: 4,
    width: "100%",
  },
  scanningTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#8B5CF6",
    marginTop: 20,
    marginBottom: 20,
  },
  scanningStep: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
  },
  scanningNote: {
    marginTop: 20,
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },

  // Error
  errorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E293B",
    marginTop: 16,
  },
  errorSub: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
  },
  retryBtnText: { color: "#FFF", fontWeight: "700" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 0.5,
  },

  // Meta card
  metaCard: {
    backgroundColor: "#FFF",
    margin: 16,
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  metaText: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  metricsCountBadge: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  metricsCountText: { color: "#8B5CF6", fontWeight: "700", fontSize: 12 },

  // Voice button
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 18,
    elevation: 4,
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  voiceBtnActive: { backgroundColor: "#7C3AED" },
  voiceBtnTitle: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  voiceBtnSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },

  // Summary
  summaryBox: {
    backgroundColor: "#F5F3FF",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
  },
  summaryLabel: { fontWeight: "900", color: "#8B5CF6", marginBottom: 8, fontSize: 12 },
  summaryText: { color: "#4C1D95", lineHeight: 22, fontSize: 14, fontWeight: "500" },
  disclaimer: {
    marginTop: 10,
    fontSize: 10,
    color: "#94A3B8",
    fontStyle: "italic",
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  tabActive: { backgroundColor: "#FFF", elevation: 2 },
  tabText: { fontWeight: "700", color: "#94A3B8", fontSize: 13 },
  tabTextActive: { color: "#1E293B" },

  // Metrics
  metricsSection: { paddingHorizontal: 16 },
  metricCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  metricLeft: { flex: 1 },
  metricName: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  metricRange: { fontSize: 11, color: "#94A3B8", marginTop: 3, fontWeight: "500" },
  metricRight: { alignItems: "flex-end" },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricUnit: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  emptyMetrics: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFF",
    borderRadius: 20,
  },
  emptyMetricsText: {
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 12,
    fontWeight: "500",
  },

  // Chart
  chartSection: { paddingHorizontal: 16 },
  chartTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 4,
  },
  chartSubtitle: { fontSize: 11, color: "#64748B", marginBottom: 12 },
  chart: { borderRadius: 16, marginBottom: 12 },
  chartLegend: { backgroundColor: "#FFF", borderRadius: 16, padding: 16 },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#1E293B", fontWeight: "600" },

  // OCR
  ocrToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  ocrToggleText: { color: "#64748B", fontWeight: "600", fontSize: 13 },
  ocrBox: {
    marginHorizontal: 16,
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  ocrLabel: { fontSize: 11, fontWeight: "700", color: "#8B5CF6", marginBottom: 6 },
  ocrText: { fontSize: 12, color: "#475569", lineHeight: 18 },

  // Action buttons
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1E293B",
    marginHorizontal: 16,
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    elevation: 3,
  },
  saveBtnText: { color: "#FFF", fontWeight: "900", letterSpacing: 0.5 },
  uploadAnotherBtn: { alignItems: "center", marginTop: 16, marginBottom: 8 },
  uploadAnotherText: { color: "#8B5CF6", fontWeight: "700", fontSize: 14 },

  // Dashboard tabs
  dashTabRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dashTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  dashTabActive: { borderBottomColor: "#8B5CF6" },
  dashTabText: { fontSize: 13, fontWeight: "700", color: "#94A3B8" },
  dashTabTextActive: { color: "#8B5CF6" },

  // Trend
  trendTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginBottom: 4 },
  trendSub: { fontSize: 12, color: "#64748B", marginBottom: 16 },
  trendMetricCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  trendMetricName: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  trendMetricRange: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  trendMetricVal: { fontSize: 20, fontWeight: "900" },

  // History chat button
  historyChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  historyChatBtnText: { fontSize: 12, fontWeight: "700", color: "#8B5CF6" },

  // History styles
  historyCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  historyCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  historyLabBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F5F3FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  historyLabText: { color: "#8B5CF6", fontSize: 12, fontWeight: "700" },
  historyDate: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  historySummary: { fontSize: 13, color: "#475569", lineHeight: 20, marginBottom: 10 },
  historyMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyMetrics: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  historyWarnBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  historyWarnText: { color: "#EF4444", fontSize: 11, fontWeight: "700" },
});
