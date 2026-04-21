import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import useSarvamTTS from "../hooks/useSarvamTTS";

const screenWidth = Dimensions.get("window").width;

// ─── Reference ranges for common Indian lab tests ────────────────────────────
const REFERENCE_RANGES = {
  "HbA1c":           { min: 4.0,  max: 5.7,  unit: "%",     label: "HbA1c (Glycated Hb)" },
  "Fasting Sugar":   { min: 70,   max: 100,  unit: "mg/dL", label: "Fasting Blood Sugar" },
  "Post Prandial":   { min: 70,   max: 140,  unit: "mg/dL", label: "Post Prandial Sugar" },
  "Cholesterol":     { min: 0,    max: 200,  unit: "mg/dL", label: "Total Cholesterol" },
  "LDL":             { min: 0,    max: 100,  unit: "mg/dL", label: "LDL Cholesterol" },
  "HDL":             { min: 40,   max: 999,  unit: "mg/dL", label: "HDL Cholesterol" },
  "Triglycerides":   { min: 0,    max: 150,  unit: "mg/dL", label: "Triglycerides" },
  "Haemoglobin":     { min: 12,   max: 17,   unit: "g/dL",  label: "Haemoglobin" },
  "TSH":             { min: 0.4,  max: 4.0,  unit: "mIU/L", label: "Thyroid (TSH)" },
  "Creatinine":      { min: 0.6,  max: 1.2,  unit: "mg/dL", label: "Creatinine" },
};

const getStatusColor = (value, ref) => {
  if (!ref || value === null || value === undefined) return "#2E75B6";
  if (value > ref.max) return "#EF4444";
  if (value < ref.min) return "#3B82F6";
  if (value > ref.max * 0.9) return "#F59E0B";
  return "#22C55E";
};

/**
 * TrendChart
 * Props:
 *  reports — array of Firestore aiAnalyses docs, each with:
 *    { metrics: [{name, value, unit}], analyzedAt: Timestamp }
 */
const TTS_LANGS = [
  { code: "en-IN", label: "EN",     speaker: "tanya" },
  { code: "hi-IN", label: "हिंदी",   speaker: "anand" },
  { code: "ta-IN", label: "தமிழ்",  speaker: "anand" },
  { code: "te-IN", label: "తెలుగు",  speaker: "anand" },
  { code: "kn-IN", label: "ಕನ್ನಡ",  speaker: "anand" },
  { code: "ml-IN", label: "മലയാളം", speaker: "anand" },
  { code: "mr-IN", label: "मराठी",  speaker: "anand" },
  { code: "gu-IN", label: "ગુજ",    speaker: "anand" },
  { code: "bn-IN", label: "বাংলা",  speaker: "anand" },
];

export default function TrendChart({ reports = [] }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const [ttsLang, setTtsLang] = useState(TTS_LANGS[0]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const { speak, stop, speaking } = useSarvamTTS({
    cacheFile: "trend_voice.wav",
    languageCode: ttsLang.code,
    speaker: ttsLang.speaker,
  });

  // ── Derive available test types from saved AI analyses ─────────────────────
  const availableTests = (() => {
    const nameSet = new Set();
    reports.forEach((r) => {
      (r.metrics || []).forEach((m) => {
        if (typeof m.value === "number") nameSet.add(m.name);
      });
    });
    return [...nameSet];
  })();

  const activeTest = selectedTest || availableTests[0] || null;

  // ── Build data points for the selected test ────────────────────────────────
  const dataPoints = reports
    .map((r) => {
      const metric = (r.metrics || []).find((m) => m.name === activeTest);
      if (!metric || typeof metric.value !== "number") return null;
      const dateObj = r.analyzedAt?.seconds
        ? new Date(r.analyzedAt.seconds * 1000)
        : new Date();
      return { value: metric.value, date: dateObj };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

  // ── Build the trend explanation text ──────────────────────────────────────
  const buildTrendScript = () => {
    if (!activeTest || dataPoints.length < 2) {
      return "Not enough data to show a trend yet. Upload more lab reports and run AI analysis to start tracking changes over time.";
    }

    const ref    = REFERENCE_RANGES[activeTest];
    const latest = dataPoints[dataPoints.length - 1].value;
    const prev   = dataPoints[dataPoints.length - 2].value;
    const unit   = ref?.unit || "";
    const improved = ref ? (latest < prev && activeTest !== "HDL") || (latest > prev && activeTest === "HDL") : latest < prev;
    const lines  = [];

    // Status against normal range
    if (ref) {
      if (latest > ref.max) {
        lines.push(`Your latest ${activeTest} is ${latest} ${unit}, which is above the normal range. The normal maximum is ${ref.max} ${unit}.`);
        lines.push(`This means your ${activeTest} needs attention. Please speak to your doctor about what steps to take.`);
      } else if (latest < ref.min) {
        lines.push(`Your latest ${activeTest} is ${latest} ${unit}, which is below the normal range. The normal minimum is ${ref.min} ${unit}.`);
        lines.push(`A low ${activeTest} can also be a concern. Your doctor can advise you on how to bring it back to a healthy level.`);
      } else {
        lines.push(`Your latest ${activeTest} is ${latest} ${unit}, which is within the normal range — between ${ref.min} and ${ref.max} ${unit}. That is great news!`);
      }
    } else {
      lines.push(`Your latest ${activeTest} reading is ${latest} ${unit}.`);
    }

    // Trend direction — explain what movement means
    if (improved) {
      lines.push(`Compared to your previous reading of ${prev} ${unit}, this has improved. Your trend is moving in the right direction — keep following your current routine.`);
    } else if (latest === prev) {
      lines.push(`Your ${activeTest} has stayed the same as your previous reading of ${prev} ${unit}. Consistency is good, but aim to bring it closer to the ideal range if it is outside normal.`);
    } else {
      lines.push(`Compared to your previous reading of ${prev} ${unit}, this has gone up. That is a sign to pay closer attention to your diet, medications, or lifestyle habits.`);
    }

    // Extra context for key tests
    if (activeTest === "HbA1c") {
      lines.push("Remember, HbA1c reflects your average blood sugar over the past 3 months — so changes take time to show.");
    } else if (activeTest === "Fasting Sugar") {
      lines.push("For best results, always take your fasting sugar test after at least 8 hours without eating.");
    } else if (activeTest === "Cholesterol" || activeTest === "LDL") {
      lines.push("Reducing oily and processed foods and increasing physical activity can help bring cholesterol down.");
    }

    lines.push("Always consult your doctor before making changes to your treatment based on these trends.");
    return lines.join(" ");
  };

  const handleSpeak = () => {
    if (speaking) { stop(); return; }
    speak(buildTrendScript());
  };

  // Stop voice when switching test
  const handleSelectTest = (name) => {
    if (speaking) stop();
    setSelectedTest(name);
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (availableTests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="chart-line" size={40} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No trend data yet</Text>
        <Text style={styles.emptyText}>
          Upload lab reports and tap "Analyze with AI" to start tracking your health trends.
        </Text>
      </View>
    );
  }

  const ref = REFERENCE_RANGES[activeTest];

  return (
    <View style={styles.container}>
      {/* Title + voice + language buttons */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Health Trend</Text>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <TouchableOpacity
            style={[styles.voiceBtn, speaking && styles.voiceBtnActive]}
            onPress={handleSpeak}
          >
            <MaterialCommunityIcons
              name={speaking ? "stop-circle" : "volume-high"}
              size={16}
              color={speaking ? "#7C3AED" : "#8B5CF6"}
            />
            <Text style={[styles.voiceBtnText, speaking && { color: "#7C3AED" }]}>
              {speaking ? "Stop" : "Listen"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voiceBtn, { paddingHorizontal: 8 }]}
            onPress={() => setShowLangPicker(v => !v)}
          >
            <MaterialCommunityIcons name="translate" size={14} color="#8B5CF6" />
            <Text style={styles.voiceBtnText}>{ttsLang.label}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {showLangPicker && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
          {TTS_LANGS.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langChip, ttsLang.code === lang.code && styles.langChipActive]}
              onPress={() => { setTtsLang(lang); setShowLangPicker(false); if (speaking) stop(); }}
            >
              <Text style={[styles.langChipText, ttsLang.code === lang.code && { color: "#FFF" }]}>{lang.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Test selector pills ─────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
      >
        {availableTests.map((name) => (
          <TouchableOpacity
            key={name}
            style={[styles.pill, activeTest === name && styles.pillActive]}
            onPress={() => handleSelectTest(name)}
          >
            <Text style={[styles.pillText, activeTest === name && styles.pillTextActive]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Normal range label ──────────────────────────────────── */}
      {ref && (
        <Text style={styles.rangeLabel}>
          Normal range: {ref.min} – {ref.max} {ref.unit}
        </Text>
      )}

      {/* ── Chart or insufficient data message ─────────────────── */}
      {dataPoints.length < 2 ? (
        <View style={styles.notEnoughData}>
          <Text style={styles.notEnoughText}>
            Need at least 2 "{activeTest}" readings to show a trend.
          </Text>
        </View>
      ) : (
        <>
          <LineChart
            data={{
              labels: dataPoints.map((p) =>
                p.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              ),
              datasets: [
                {
                  data: dataPoints.map((p) => p.value),
                  color: (opacity = 1) => {
                    const latest = dataPoints[dataPoints.length - 1].value;
                    const c = getStatusColor(latest, ref);
                    return c + Math.round(opacity * 255).toString(16).padStart(2, "0");
                  },
                  strokeWidth: 3,
                },
              ],
            }}
            width={screenWidth - 72}
            height={200}
            chartConfig={{
              backgroundColor: "#1E293B",
              backgroundGradientFrom: "#1E293B",
              backgroundGradientTo: "#334155",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
              labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: "5", strokeWidth: "2", stroke: "#FFF" },
            }}
            bezier
            style={styles.chart}
          />

          {/* Trend alert */}
          {(() => {
            const latest = dataPoints[dataPoints.length - 1].value;
            const prev   = dataPoints[dataPoints.length - 2].value;
            const up = latest > prev;
            const isGoodUp = activeTest === "HDL";
            const isGood = isGoodUp ? up : !up;
            return (
              <View style={[styles.alertBox, { backgroundColor: isGood ? "#DCFCE7" : "#FEF3C7" }]}>
                <Text style={styles.alertText}>
                  {isGood
                    ? `✅ ${activeTest} is improving — keep it up`
                    : `⚠️ ${activeTest} is ${up ? "increasing" : "decreasing"} — monitor closely`}
                </Text>
              </View>
            );
          })()}
        </>
      )}

      {/* Speaking indicator */}
      {speaking && (
        <View style={styles.speakingBar}>
          <MaterialCommunityIcons name="waveform" size={16} color="#7C3AED" />
          <Text style={styles.speakingText}>Arogyasathi AI is speaking…</Text>
          <TouchableOpacity onPress={stop}>
            <Text style={styles.stopLink}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginVertical: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "900", color: "#1E293B" },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
  },
  voiceBtnActive: { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" },
  voiceBtnText: { color: "#8B5CF6", fontWeight: "700", fontSize: 12 },
  langChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.5, borderColor: "#C4B5FD", backgroundColor: "#F5F3FF" },
  langChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  langChipText: { fontSize: 11, fontWeight: "700", color: "#7C3AED" },
  pillScroll: { marginBottom: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F1F5F9" },
  pillActive: { backgroundColor: "#8B5CF6" },
  pillText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  pillTextActive: { color: "#FFF" },
  rangeLabel: { fontSize: 11, color: "#64748B", fontWeight: "500", marginBottom: 8 },
  chart: { borderRadius: 16, marginBottom: 10 },
  alertBox: { padding: 12, borderRadius: 12, marginBottom: 12 },
  alertText: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  notEnoughData: { padding: 30, alignItems: "center" },
  notEnoughText: { color: "#94A3B8", textAlign: "center", fontWeight: "500", fontSize: 13 },
  speakingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F3FF",
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  speakingText: { flex: 1, fontSize: 13, color: "#7C3AED", fontWeight: "600" },
  stopLink: { fontSize: 13, color: "#EF4444", fontWeight: "700" },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    marginVertical: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B", marginTop: 10, marginBottom: 6 },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center", fontWeight: "500", lineHeight: 20 },
});
