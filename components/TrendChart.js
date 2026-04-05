import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
export default function TrendChart({ reports = [] }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      Speech.stop();
    };
  }, []);

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

  // ── Voice explain the trend ────────────────────────────────────────────────
  const handleSpeak = async () => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }

    let text;
    if (!activeTest || dataPoints.length < 2) {
      text =
        "Not enough data to explain a trend yet. Upload more lab reports and use the AI analysis feature.";
    } else {
      const ref = REFERENCE_RANGES[activeTest];
      const latest = dataPoints[dataPoints.length - 1].value;
      const prev = dataPoints[dataPoints.length - 2].value;
      const change = ((latest - prev) / prev) * 100;
      const direction = latest > prev ? "increased" : "decreased";
      const unit = ref?.unit || "";

      let statusComment;
      if (ref) {
        if (latest > ref.max)
          statusComment =
            "which is above the normal range. Please consult your doctor soon.";
        else if (latest < ref.min)
          statusComment =
            "which is below the normal range. Please consult your doctor soon.";
        else statusComment = "which is within the normal range. Great job!";
      } else {
        statusComment = ".";
      }

      text =
        `Your ${activeTest} trend shows ${dataPoints.length} readings. ` +
        `The latest value is ${latest} ${unit}, ${statusComment} ` +
        `Compared to your previous reading, it has ${direction} by ${Math.abs(
          change
        ).toFixed(1)} percent. ` +
        (Math.abs(change) > 10
          ? "This is a significant change. Talk to your doctor."
          : "This is a small change. Keep monitoring regularly.");
    }

    setSpeaking(true);
    Speech.speak(text, {
      language: "en-IN",
      pitch: 1.0,
      rate: 0.85,
      onDone: () => {
        if (isMounted.current) setSpeaking(false);
      },
      onError: () => {
        if (isMounted.current) setSpeaking(false);
      },
    });
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (availableTests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="chart-line" size={40} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No trend data yet</Text>
        <Text style={styles.emptyText}>
          Upload lab reports and tap "Analyze with AI" to start tracking your
          health trends.
        </Text>
      </View>
    );
  }

  const ref = REFERENCE_RANGES[activeTest];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Trend</Text>

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
            onPress={() => {
              Speech.stop();
              setSpeaking(false);
              setSelectedTest(name);
            }}
          >
            <Text
              style={[
                styles.pillText,
                activeTest === name && styles.pillTextActive,
              ]}
            >
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
                p.date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              ),
              datasets: [
                {
                  data: dataPoints.map((p) => p.value),
                  color: (opacity = 1) => {
                    const latest = dataPoints[dataPoints.length - 1].value;
                    const c = getStatusColor(latest, ref);
                    return (
                      c +
                      Math.round(opacity * 255)
                        .toString(16)
                        .padStart(2, "0")
                    );
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
          <View
            style={[
              styles.alertBox,
              {
                backgroundColor:
                  dataPoints[dataPoints.length - 1].value >
                  dataPoints[dataPoints.length - 2].value
                    ? "#FEF3C7"
                    : "#DCFCE7",
              },
            ]}
          >
            <Text style={styles.alertText}>
              {dataPoints[dataPoints.length - 1].value >
              dataPoints[dataPoints.length - 2].value
                ? `⚠️ ${activeTest} is increasing — monitor closely`
                : `✅ ${activeTest} is improving — keep it up`}
            </Text>
          </View>
        </>
      )}

      {/* ── Voice explain button ────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.voiceBtn, speaking && styles.voiceBtnActive]}
        onPress={handleSpeak}
      >
        <MaterialCommunityIcons
          name={speaking ? "stop-circle" : "volume-high"}
          size={18}
          color={speaking ? "#7C3AED" : "#8B5CF6"}
        />
        <Text
          style={[styles.voiceBtnText, speaking && { color: "#7C3AED" }]}
        >
          {speaking ? "Stop Voice" : "Explain this trend aloud"}
        </Text>
      </TouchableOpacity>
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
  title: { fontSize: 17, fontWeight: "900", color: "#1E293B", marginBottom: 12 },
  pillScroll: { marginBottom: 12 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  pillActive: { backgroundColor: "#8B5CF6" },
  pillText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  pillTextActive: { color: "#FFF" },
  rangeLabel: { fontSize: 11, color: "#64748B", fontWeight: "500", marginBottom: 8 },
  chart: { borderRadius: 16, marginBottom: 10 },
  alertBox: { padding: 12, borderRadius: 12, marginBottom: 12 },
  alertText: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  notEnoughData: { padding: 30, alignItems: "center" },
  notEnoughText: {
    color: "#94A3B8",
    textAlign: "center",
    fontWeight: "500",
    fontSize: 13,
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
    alignSelf: "flex-start",
  },
  voiceBtnActive: { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" },
  voiceBtnText: { color: "#8B5CF6", fontWeight: "700", fontSize: 13 },
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 20,
  },
});
