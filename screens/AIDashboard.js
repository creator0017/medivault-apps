import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
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

const screenWidth = Dimensions.get("window").width;

// ─── AI prompt — extracts full blood panel as structured JSON ─────────────
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

// ─── Plain-English metric explanations ───────────────────────────────────────
const METRIC_EXPLAIN = {
  hba1c: {
    what: "Shows your average blood sugar over the past 2–3 months. It's the single most important diabetes marker.",
    normal: "Below 5.7% is normal. 5.7–6.4% is pre-diabetes. 6.5%+ indicates diabetes.",
    highAction: "Schedule a doctor visit soon. Ask about medication or diet adjustments.",
    borderlineAction: "Reduce sugar and refined carbs. Increase walking. Retest in 3 months.",
    lowAction: "Excellent control! Keep your current diet and medication routine.",
    urgency: "high",
  },
  fasting: {
    what: "Blood sugar measured after 8+ hours of fasting. Reflects baseline glucose control.",
    normal: "70–100 mg/dL is normal. 100–125 is pre-diabetes. 126+ indicates diabetes.",
    highAction: "Avoid eating 2+ hours before bed. Consult your doctor about medication.",
    borderlineAction: "Reduce carbohydrates at dinner. Check fasting sugar daily for 1 week.",
    lowAction: "Normal range. Maintain your current diet.",
    urgency: "medium",
  },
  ppbs: {
    what: "Blood sugar measured 2 hours after eating. Shows how your body handles a meal.",
    normal: "Under 140 mg/dL is normal. 140–199 is borderline. 200+ indicates poor control.",
    highAction: "Walk 15–20 minutes after every meal. Talk to your doctor about post-meal medication.",
    borderlineAction: "Avoid large meals. Eat smaller portions more frequently.",
    lowAction: "Good post-meal control. Keep up the healthy eating.",
    urgency: "medium",
  },
  cholesterol: {
    what: "Total fat-like substance in your blood. High levels increase heart disease risk.",
    normal: "Under 200 mg/dL is desirable. 200–239 is borderline. 240+ is high.",
    highAction: "Reduce fried foods, red meat. Increase fibre, omega-3. Consult your doctor.",
    borderlineAction: "Diet changes and 30 minutes of daily walking can help significantly.",
    lowAction: "Healthy cholesterol level. Keep eating heart-healthy foods.",
    urgency: "medium",
  },
  ldl: {
    what: "Bad cholesterol that can build up in arteries and increase heart attack risk.",
    normal: "Under 100 mg/dL is optimal. 100–129 is near-optimal. 160+ is high.",
    highAction: "Discuss statin medication with your doctor. Avoid saturated fats.",
    borderlineAction: "Cut down on butter, cheese, and processed food. Increase plant-based foods.",
    lowAction: "Good LDL level. Continue heart-healthy habits.",
    urgency: "high",
  },
  hdl: {
    what: "Good cholesterol that helps remove bad cholesterol from arteries. Higher is better.",
    normal: "Above 60 mg/dL is protective. Below 40 (men) or 50 (women) is a risk factor.",
    highAction: "Low HDL increases heart risk. Exercise regularly and stop smoking if applicable.",
    borderlineAction: "Increase exercise. Eat more nuts, olive oil, and fatty fish.",
    lowAction: "Good HDL level. Exercise helps keep it elevated.",
    urgency: "medium",
  },
  triglycerides: {
    what: "Type of fat in your blood. High levels often come from excess sugar and refined carbs.",
    normal: "Under 150 mg/dL is normal. 150–199 is borderline. 200+ is high.",
    highAction: "Cut sugary drinks, white bread, and alcohol. Consult your doctor.",
    borderlineAction: "Reduce sugar intake significantly. Increase daily activity.",
    lowAction: "Good triglyceride level.",
    urgency: "medium",
  },
  haemoglobin: {
    what: "Protein in red blood cells that carries oxygen to all organs.",
    normal: "12–17 g/dL is normal (varies by gender). Low = anaemia, High = polycythaemia.",
    highAction: "Very low haemoglobin causes fatigue and breathlessness. See your doctor.",
    borderlineAction: "Eat iron-rich foods: spinach, lentils, pomegranate, jaggery.",
    lowAction: "Haemoglobin is in normal range.",
    urgency: "medium",
  },
  creatinine: {
    what: "Waste product filtered by kidneys. High levels suggest reduced kidney function.",
    normal: "0.6–1.2 mg/dL (varies by age/gender). Elevated values need investigation.",
    highAction: "Kidney function may be affected. Avoid NSAIDs (ibuprofen) and see your doctor.",
    borderlineAction: "Stay well hydrated. Reduce protein-heavy diet. Retest in 1 month.",
    lowAction: "Kidney function appears normal.",
    urgency: "high",
  },
  tsh: {
    what: "Thyroid Stimulating Hormone. Measures thyroid gland function.",
    normal: "0.4–4.0 mIU/L is normal. Low = hyperthyroidism. High = hypothyroidism.",
    highAction: "Hypothyroidism may be present. Consult your doctor about thyroid medication.",
    borderlineAction: "Retest in 6 weeks. Watch for fatigue, weight changes, or hair loss.",
    lowAction: "Thyroid function is normal.",
    urgency: "medium",
  },
  "vitamin d": {
    what: "Essential for bone health, immunity, and muscle function. Very common to be deficient in India.",
    normal: "Above 30 ng/mL is sufficient. 20–29 is insufficient. Below 20 is deficient.",
    highAction: "Severe deficiency. Doctor may prescribe high-dose Vitamin D supplements.",
    borderlineAction: "15 minutes of morning sunlight daily. Vitamin D3 supplement (1000–2000 IU/day).",
    lowAction: "Good Vitamin D level. Maintain sunlight exposure and diet.",
    urgency: "low",
  },
  "vitamin b12": {
    what: "Critical for nerves, brain function, and red blood cell production.",
    normal: "200–900 pg/mL is normal. Below 200 indicates deficiency.",
    highAction: "Deficiency can cause nerve damage. Start B12 injections or supplements as prescribed.",
    borderlineAction: "Eat eggs, dairy, and fish. Consider a B12 supplement.",
    lowAction: "Good B12 level.",
    urgency: "low",
  },
};

function getMetricExplain(metricName) {
  const n = String(metricName || "").toLowerCase();
  for (const [key, val] of Object.entries(METRIC_EXPLAIN)) {
    if (n.includes(key)) return val;
  }
  return null;
}

function getActionForStatus(explain, status) {
  const s = String(status || "").toLowerCase();
  if (s === "high" || s === "abnormal" || s === "low") return explain?.highAction;
  if (s === "borderline") return explain?.borderlineAction;
  return explain?.lowAction;
}

// ─── Action plan generator ────────────────────────────────────────────────────
function buildActionPlan(metrics) {
  const actions = [];
  const abnormal = (metrics || []).filter(m => {
    const s = String(m.status || "").toLowerCase();
    return s === "high" || s === "low" || s === "abnormal";
  });
  const borderline = (metrics || []).filter(m =>
    String(m.status || "").toLowerCase() === "borderline"
  );

  if (abnormal.length > 0) {
    actions.push({
      priority: 1,
      icon: "doctor",
      iconColor: "#EF4444",
      bg: "#FEF2F2",
      title: "Consult Your Doctor",
      desc: `${abnormal.length} test${abnormal.length > 1 ? "s are" : " is"} outside normal range: ${abnormal.slice(0, 2).map(m => m.name).join(", ")}${abnormal.length > 2 ? `, +${abnormal.length - 2} more` : ""}. Schedule an appointment within 2 weeks.`,
    });
  }

  const hasHbA1c = abnormal.some(m => m.name.toLowerCase().includes("hba1c") || m.name.toLowerCase().includes("a1c"));
  const hasPPBS  = (metrics || []).some(m => m.name.toLowerCase().includes("ppbs") || m.name.toLowerCase().includes("post"));
  if (hasHbA1c || hasPPBS) {
    actions.push({
      priority: 2,
      icon: "walk",
      iconColor: "#10B981",
      bg: "#F0FDF4",
      title: "Walk After Every Meal",
      desc: "A 15–20 minute walk after eating reduces post-meal blood sugar by up to 20%. This is one of the most effective lifestyle changes.",
    });
  }

  const hasChol = abnormal.some(m => m.name.toLowerCase().includes("cholesterol") || m.name.toLowerCase().includes("ldl"));
  if (hasChol) {
    actions.push({
      priority: 3,
      icon: "food-apple",
      iconColor: "#F59E0B",
      bg: "#FFFBEB",
      title: "Heart-Healthy Diet",
      desc: "Reduce fried food, red meat, and processed snacks. Add more vegetables, lentils, and omega-3 rich fish.",
    });
  }

  if (borderline.length > 0 && actions.length < 3) {
    actions.push({
      priority: actions.length + 1,
      icon: "calendar-clock",
      iconColor: "#8B5CF6",
      bg: "#F5F3FF",
      title: "Repeat Tests in 3 Months",
      desc: `${borderline.length} value${borderline.length > 1 ? "s are" : " is"} borderline. Regular monitoring helps catch changes early before they become serious.`,
    });
  }

  actions.push({
    priority: actions.length + 1,
    icon: "file-download-outline",
    iconColor: "#2E75B6",
    bg: "#EFF6FF",
    title: "Save & Share with Doctor",
    desc: "Tap the button below to save this analysis and share the PDF with your doctor or family.",
  });

  return actions;
}

// ─── Risk level from all metrics ─────────────────────────────────────────────
function overallRisk(metrics) {
  const abnormal = (metrics || []).filter(m => {
    const s = String(m.status || "").toLowerCase();
    return s === "high" || s === "low" || s === "abnormal";
  });
  const borderline = (metrics || []).filter(m =>
    String(m.status || "").toLowerCase() === "borderline"
  );
  if (abnormal.length >= 3) return { level: "High Risk", color: "#EF4444", bg: "#FEF2F2", icon: "alert-circle" };
  if (abnormal.length >= 1) return { level: "Needs Attention", color: "#F97316", bg: "#FFF7ED", icon: "alert" };
  if (borderline.length >= 2) return { level: "Borderline", color: "#F59E0B", bg: "#FFFBEB", icon: "alert-circle-outline" };
  return { level: "Looking Good", color: "#10B981", bg: "#F0FDF4", icon: "check-circle" };
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  normal:     { color: "#22C55E", bg: "#DCFCE7", label: "Normal",     icon: "check-circle" },
  borderline: { color: "#F59E0B", bg: "#FEF3C7", label: "Borderline", icon: "alert-circle" },
  high:       { color: "#EF4444", bg: "#FEE2E2", label: "High",       icon: "close-circle" },
  abnormal:   { color: "#EF4444", bg: "#FEE2E2", label: "Abnormal",   icon: "close-circle" },
  low:        { color: "#3B82F6", bg: "#DBEAFE", label: "Low",        icon: "arrow-down-circle" },
};
function STATUS_CONFIG(status) {
  return STATUS_MAP[String(status || "").toLowerCase()] || STATUS_MAP.normal;
}

export default function AIDashboard() {
  const route = useRoute();
  const navigation = useNavigation();
  const { userData } = useUser();
  const { reportUri, reportMime, cachedAnalysis } = route.params || {};

  // cachedAnalysis = pre-loaded analysis object from history screen
  const initialStep = cachedAnalysis ? "done" : reportUri ? "scanning" : "history";

  const [step, setStep]           = useState(initialStep);
  const [ocrText, setOcrText]     = useState(cachedAnalysis?.ocrText || "");
  const [analysis, setAnalysis]   = useState(cachedAnalysis || null);
  const [saving, setSaving]       = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [showOcr, setShowOcr]     = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [errorMsg, setErrorMsg]   = useState("");
  const [history, setHistory]     = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (cachedAnalysis) return; // already loaded
    if (reportUri) {
      analyzeReport();
    } else {
      loadHistory();
    }
  }, [reportUri, cachedAnalysis]);

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
      
      // Vision feature is currently disabled. To enable lab report analysis,
      // implement a vision API (e.g., Google Cloud Vision, Azure Computer Vision,
      // or a local OCR library like Tesseract.js).
      
      // For now, return mock data for demonstration
      const mockAnalysis = {
        date: new Date().toLocaleDateString("en-IN"),
        lab: "Demo Lab",
        patient: "Demo Patient",
        age: "45",
        bloodGroup: "O+",
        gender: "Male",
        conditions: [
          { title: "Type 2 Diabetes", subtitle: "HbA1c: 7.2%", history: "Diagnosed 2023" },
          { title: "High Cholesterol", subtitle: "Total: 240 mg/dL", history: "Borderline high" },
        ],
        medications: [
          { name: "Metformin", dose: "500mg", frequency: "Twice daily" },
          { name: "Atorvastatin", dose: "20mg", frequency: "Once daily" },
        ],
        allergies: [
          { name: "Penicillin", severity: "SEVERE" },
        ],
        metrics: [
          { name: "HbA1c", value: 7.2, unit: "%", normalRange: "4.0 - 5.7", status: "high" },
          { name: "Fasting Blood Sugar", value: 110, unit: "mg/dL", normalRange: "70 - 100", status: "borderline" },
          { name: "Total Cholesterol", value: 240, unit: "mg/dL", normalRange: "<200", status: "high" },
          { name: "HDL", value: 45, unit: "mg/dL", normalRange: ">40", status: "normal" },
          { name: "LDL", value: 160, unit: "mg/dL", normalRange: "<100", status: "high" },
        ],
        summary: "Your lab results show elevated HbA1c (7.2%) indicating diabetes, and high total cholesterol (240 mg/dL). Your HDL is within normal range. Please consult your doctor for medication adjustments and lifestyle changes.",
        ocrText: "Mock OCR text for demonstration purposes.",
      };

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!isMounted.current) return;
      setAnalysis(mockAnalysis);
      setOcrText(mockAnalysis.ocrText || "");
      setStep("done");

      // Auto-save silently so Chat can immediately fetch it without manual saving
      if (userData?.uid) {
        addDoc(collection(db, "users", userData.uid, "aiAnalyses"), {
          date: mockAnalysis.date,
          lab: mockAnalysis.lab,
          patient: mockAnalysis.patient,
          age: mockAnalysis.age,
          bloodGroup: mockAnalysis.bloodGroup,
          gender: mockAnalysis.gender,
          conditions: mockAnalysis.conditions,
          medications: mockAnalysis.medications,
          allergies: mockAnalysis.allergies,
          metrics: mockAnalysis.metrics,
          summary: mockAnalysis.summary,
          ocrText: mockAnalysis.ocrText,
          analyzedAt: serverTimestamp(),
        }).catch(err => console.log("Silent auto-save failed", err));
      }
    } catch (err) {
      if (!isMounted.current) return;
      const msg = err?.message || "Analysis failed. Please try again.";
      setErrorMsg(msg);
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
        age: analysis.age || "",
        bloodGroup: analysis.bloodGroup || "",
        gender: analysis.gender || "",
        conditions: analysis.conditions || [],
        medications: analysis.medications || [],
        allergies: analysis.allergies || [],
        metrics: analysis.metrics,
        summary: analysis.summary,
        ocrText: analysis.ocrText,
        analyzedAt: serverTimestamp(),
      });

      // ── Auto-populate healthReports collection from extracted metrics ──────────
      // Normalise metric name → canonical testType used by useHealthScore
      const METRIC_MAP = [
        { keys: ["hba1c", "hb a1c", "glycated", "a1c"],              type: "HbA1c",  unit: "%" },
        { keys: ["fasting", "fbs", "fasting blood sugar", "fasting glucose"], type: "FBS",   unit: "mg/dL" },
        { keys: ["post", "ppbs", "postprandial", "post prandial", "2hr", "2 hr"], type: "PPBS",  unit: "mg/dL" },
        { keys: ["cholesterol", "total cholesterol"],                type: "Cholesterol", unit: "mg/dL" },
        { keys: ["hdl", "hdl cholesterol"],                          type: "HDL", unit: "mg/dL" },
        { keys: ["ldl", "ldl cholesterol"],                          type: "LDL", unit: "mg/dL" },
        { keys: ["triglycerides", "triglyceride"],                   type: "Triglycerides", unit: "mg/dL" },
        { keys: ["creatinine"],                                      type: "Creatinine", unit: "mg/dL" },
        { keys: ["urea", "blood urea"],                              type: "Urea", unit: "mg/dL" },
        { keys: ["bilirubin", "total bilirubin"],                    type: "Bilirubin", unit: "mg/dL" },
        { keys: ["sgot", "ast"],                                    type: "SGOT", unit: "U/L" },
        { keys: ["sgpt", "alt"],                                    type: "SGPT", unit: "U/L" },
        { keys: ["hemoglobin", "hb"],                                type: "Hemoglobin", unit: "g/dL" },
        { keys: ["rbc", "red blood cell"],                           type: "RBC", unit: "million/µL" },
        { keys: ["wbc", "white blood cell"],                         type: "WBC", unit: "cells/µL" },
        { keys: ["platelet", "platelet count"],                      type: "Platelet", unit: "cells/µL" },
        { keys: ["tsh", "thyroid stimulating hormone"],              type: "TSH", unit: "µIU/mL" },
        { keys: ["vitamin d", "vitamin d3"],                         type: "Vitamin D", unit: "ng/mL" },
      ];

      const reportDate = (() => {
        // Try to parse "DD/MM/YYYY" from analysis.date, else use today
        if (analysis.date) {
          const parts = analysis.date.split(/[/\-]/);
          if (parts.length === 3) {
            // DD/MM/YYYY
            const d = new Date(
              parseInt(parts[2], 10),
              parseInt(parts[1], 10) - 1,
              parseInt(parts[0], 10)
            );
            if (!isNaN(d.getTime())) return d;
          }
        }
        return new Date();
      })();

      const healthReportWrites = [];
      for (const metric of (analysis.metrics || [])) {
        const nameLower = String(metric.name || "").toLowerCase();
        const val = parseFloat(metric.value);
        if (isNaN(val)) continue;

        let mapped = false;
        for (const mapping of METRIC_MAP) {
          if (mapping.keys.some((k) => nameLower.includes(k))) {
            healthReportWrites.push(
              addDoc(collection(db, "users", userData.uid, "healthReports"), {
                testType: mapping.type,
                value: val,
                unit: metric.unit || mapping.unit,
                normalRange: metric.normalRange || "",
                status: metric.status || "",
                labName: analysis.lab || "",
                testDate: reportDate,
                source: "ai_scan",
                createdAt: serverTimestamp(),
              })
            );
            mapped = true;
            break; // only write once per metric
          }
        }
        // Fallback: save with original metric name as testType
        if (!mapped) {
          healthReportWrites.push(
            addDoc(collection(db, "users", userData.uid, "healthReports"), {
              testType: metric.name || "Unknown Test",
              value: val,
              unit: metric.unit || "",
              normalRange: metric.normalRange || "",
              status: metric.status || "",
              labName: analysis.lab || "",
              testDate: reportDate,
              source: "ai_scan",
              createdAt: serverTimestamp(),
            })
          );
        }
      }
      if (healthReportWrites.length > 0) {
        await Promise.all(healthReportWrites);
      }

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

      // ── Always write AI data — Emergency screen reads latest aiAnalyses directly ──
      const emergencyUpdate = {
        "emergency.autoConditions": aiConditions,
        "emergency.autoMedications": aiMedications,
        "emergency.autoAllergies": aiAllergies,
      };
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
        { text: "OK", onPress: () => navigation.navigate("HealthDashboard") },
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
            const cfg = STATUS_CONFIG(m.status);
            return () => cfg.color;
          }),
        },
      ],
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — AI Hub Dashboard (no reportUri passed)
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "history") {
    // Compute quick stats
    const totalMetrics = history.reduce((acc, h) => acc + (h.metrics?.length || 0), 0);
    const totalAbnormal = history.reduce(
      (acc, h) =>
        acc +
        (h.metrics || []).filter((m) => {
          const s = String(m.status || "").toLowerCase();
          return s === "high" || s === "low" || s === "abnormal";
        }).length,
      0
    );
    const latestAnalysis = history[0];

    return (
      <View style={[styles.container, { backgroundColor: "#F8FAFC" }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Health Hub</Text>
          <TouchableOpacity onPress={() => navigation.navigate("UploadReport")}>
            <MaterialCommunityIcons name="plus" size={28} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        {historyLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={{ color: "#64748B", marginTop: 12 }}>Loading...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{history.length}</Text>
                <Text style={styles.statLabel}>Analyses</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{totalMetrics}</Text>
                <Text style={styles.statLabel}>Metrics</Text>
              </View>
              <View style={[styles.statCard, totalAbnormal > 0 && { backgroundColor: "#FEF2F2" }]}>
                <Text style={[styles.statNum, totalAbnormal > 0 && { color: "#EF4444" }]}>{totalAbnormal}</Text>
                <Text style={[styles.statLabel, totalAbnormal > 0 && { color: "#EF4444" }]}>Abnormal</Text>
              </View>
            </View>

            {/* Latest analysis preview */}
            {latestAnalysis && (
              <TouchableOpacity
                style={styles.latestCard}
                onPress={() => { setAnalysis(latestAnalysis); setOcrText(latestAnalysis.ocrText || ""); setStep("done"); }}
              >
                <View style={styles.latestCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.latestCardLabel}>LATEST ANALYSIS</Text>
                    <Text style={styles.latestCardLab}>{latestAnalysis.lab || "Lab Report"}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#8B5CF6" />
                </View>
                <Text style={styles.latestCardSummary} numberOfLines={2}>
                  {latestAnalysis.summary || "Tap to view analysis details"}
                </Text>
                <Text style={styles.latestCardDate}>
                  {latestAnalysis.analyzedAt?.toDate
                    ? latestAnalysis.analyzedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : latestAnalysis.date || ""}
                </Text>
              </TouchableOpacity>
            )}

            {history.length === 0 && (
              <View style={[styles.center, { marginVertical: 32 }]}>
                <MaterialCommunityIcons name="robot-outline" size={60} color="#CBD5E1" />
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B", marginTop: 16 }}>No analyses yet</Text>
                <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>
                  Upload a lab report image and tap "Analyze with AI" to get started.
                </Text>
                <TouchableOpacity style={[styles.retryBtn, { marginTop: 24 }]} onPress={() => navigation.navigate("UploadReport")}>
                  <Text style={styles.retryBtnText}>Upload Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Navigation cards */}
            <Text style={styles.navSectionTitle}>AI TOOLS</Text>

            {/* History card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={() => navigation.navigate("AIHistory")}
            >
              <View style={[styles.navCardIcon, { backgroundColor: "#EDE9FE" }]}>
                <MaterialCommunityIcons name="clock-outline" size={26} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navCardTitle}>Analysis History</Text>
                <Text style={styles.navCardSub}>
                  {history.length > 0 ? `${history.length} saved analyses` : "No analyses yet"} · tap to browse
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            {/* Charts card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={() => navigation.navigate("AICharts")}
            >
              <View style={[styles.navCardIcon, { backgroundColor: "#EFF6FF" }]}>
                <MaterialCommunityIcons name="chart-line" size={26} color="#2E75B6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navCardTitle}>Health Trends & Charts</Text>
                <Text style={styles.navCardSub}>
                  {history.length > 0 ? `${history.length} data points` : "No data yet"} · track metrics over time
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            {/* Chat card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={() => navigation.navigate("AIChat")}
            >
              <View style={[styles.navCardIcon, { backgroundColor: "#F0FDF4" }]}>
                <MaterialCommunityIcons name="robot-outline" size={26} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navCardTitle}>Chat with Arogyasathi AI</Text>
                <Text style={styles.navCardSub}>Ask questions about your health reports</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            {/* Upload new report */}
            <TouchableOpacity
              style={[styles.navCard, { borderColor: "#8B5CF6", borderWidth: 1.5 }]}
              onPress={() => navigation.navigate("UploadReport")}
            >
              <View style={[styles.navCardIcon, { backgroundColor: "#8B5CF6" }]}>
                <MaterialCommunityIcons name="upload" size={26} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.navCardTitle, { color: "#8B5CF6" }]}>Analyze New Report</Text>
                <Text style={styles.navCardSub}>Upload a lab report image or PDF</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </ScrollView>
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
          <Text style={styles.scanningTitle}>Arogyasathi AI Scanning</Text>
          <Text style={styles.scanningStep}>Step 1: Reading your report (OCR)...</Text>
          <Text style={styles.scanningStep}>Step 2: Extracting blood test values...</Text>
          <Text style={styles.scanningStep}>Step 3: Analyzing with Groq AI...</Text>
          <Text style={styles.scanningNote}>
            Powered by Groq AI · No extra API key needed
          </Text>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Error state
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "error") {
    const isApiKeyError = errorMsg.toLowerCase().includes("api") || errorMsg.toLowerCase().includes("key") || errorMsg.toLowerCase().includes("auth");
    const isNetworkError = errorMsg.toLowerCase().includes("network") || errorMsg.toLowerCase().includes("fetch") || errorMsg.toLowerCase().includes("connect");
    const isPdfError = errorMsg.toLowerCase().includes("pdf") || errorMsg.toLowerCase().includes("mime");

    return (
      <View style={[styles.center, { backgroundColor: "#F8FAFC" }]}>
        <View style={[styles.retryBtn, { backgroundColor: "#FEE2E2", paddingHorizontal: 20, paddingVertical: 20, borderRadius: 24, marginBottom: 0, alignItems: "center" }]}>
          <MaterialCommunityIcons name="robot-confused-outline" size={52} color="#EF4444" />
        </View>
        <Text style={[styles.errorTitle, { marginTop: 20 }]}>AI Analysis Failed</Text>

        {isApiKeyError ? (
          <Text style={styles.errorSub}>API key issue. Check that your AI API key is set correctly in your .env file.</Text>
        ) : isNetworkError ? (
          <Text style={styles.errorSub}>No internet connection. Connect to Wi-Fi or mobile data and try again.</Text>
        ) : isPdfError ? (
          <Text style={styles.errorSub}>PDF analysis is not supported by this device. Please take a clear photo of your report instead.</Text>
        ) : (
          <Text style={styles.errorSub}>AI could not process this file. Try a clearer, well-lit photo of your lab report.</Text>
        )}

        {!!errorMsg && (
          <View style={{ backgroundColor: "#F1F5F9", borderRadius: 12, padding: 12, marginHorizontal: 20, marginTop: 8, width: "100%" }}>
            <Text style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }} numberOfLines={4}>
              Error: {errorMsg}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: "#8B5CF6" }]}
            onPress={() => { setErrorMsg(""); analyzeReport(); }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: "#E2E8F0" }]}
            onPress={() => navigation.navigate("UploadReport")}
          >
            <Text style={[styles.retryBtnText, { color: "#64748B" }]}>New Upload</Text>
          </TouchableOpacity>
        </View>
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

      {/* ── 3-tab switcher: Summary | Metrics | Details ─────────── */}
      <View style={styles.tabRow}>
        {[
          { id: "summary", label: "Summary",  icon: "clipboard-pulse-outline" },
          { id: "metrics", label: "Metrics",  icon: "test-tube" },
          { id: "details", label: "Details",  icon: "information-outline" },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.tabActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <MaterialCommunityIcons
              name={t.icon}
              size={15}
              color={activeTab === t.id ? "#8B5CF6" : "#94A3B8"}
            />
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════
          TAB 1 — SUMMARY
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (() => {
        const risk = overallRisk(analysis?.metrics);
        const actionPlan = buildActionPlan(analysis?.metrics);
        const abnormal = (analysis?.metrics || []).filter(m => {
          const s = String(m.status || "").toLowerCase();
          return s === "high" || s === "low" || s === "abnormal";
        });
        const normal = (analysis?.metrics || []).filter(m =>
          String(m.status || "").toLowerCase() === "normal"
        );

        return (
          <View style={styles.metricsSection}>
            {/* Risk banner */}
            <View style={[styles.riskBanner, { backgroundColor: risk.bg, borderColor: risk.color + "40" }]}>
              <MaterialCommunityIcons name={risk.icon} size={24} color={risk.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.riskTitle, { color: risk.color }]}>{risk.level}</Text>
                <Text style={styles.riskSub}>
                  {abnormal.length} abnormal · {(analysis?.metrics || []).filter(m => String(m.status || "").toLowerCase() === "borderline").length} borderline · {normal.length} normal
                </Text>
              </View>
            </View>

            {/* Patient info strip */}
            {(analysis?.patient || analysis?.age || analysis?.bloodGroup) && (
              <View style={styles.patientStrip}>
                {analysis.patient ? (
                  <View style={styles.patientChip}>
                    <MaterialCommunityIcons name="account" size={14} color="#8B5CF6" />
                    <Text style={styles.patientChipText}>{analysis.patient}</Text>
                  </View>
                ) : null}
                {analysis.age ? (
                  <View style={styles.patientChip}>
                    <MaterialCommunityIcons name="cake-variant" size={14} color="#2E75B6" />
                    <Text style={styles.patientChipText}>Age {analysis.age}</Text>
                  </View>
                ) : null}
                {analysis.bloodGroup ? (
                  <View style={styles.patientChip}>
                    <MaterialCommunityIcons name="water" size={14} color="#EF4444" />
                    <Text style={styles.patientChipText}>{analysis.bloodGroup}</Text>
                  </View>
                ) : null}
                {analysis.gender ? (
                  <View style={styles.patientChip}>
                    <MaterialCommunityIcons name="gender-male-female" size={14} color="#10B981" />
                    <Text style={styles.patientChipText}>{analysis.gender}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Conditions detected */}
            {(analysis?.conditions?.length > 0) && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <MaterialCommunityIcons name="hospital" size={18} color="#EF4444" />
                  <Text style={styles.sectionCardTitle}>Conditions Detected</Text>
                </View>
                {analysis.conditions.map((c, i) => (
                  <View key={i} style={styles.conditionRow}>
                    <View style={styles.conditionDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.conditionName}>{c.title || c.name}</Text>
                      {(c.subtitle || c.description) ? (
                        <Text style={styles.conditionSub}>{c.subtitle || c.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Abnormal metrics quick view */}
            {abnormal.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#F97316" />
                  <Text style={styles.sectionCardTitle}>Values Needing Attention</Text>
                </View>
                {abnormal.map((m, i) => {
                  const cfg = STATUS_CONFIG(m.status);
                  const explain = getMetricExplain(m.name);
                  const action = getActionForStatus(explain, m.status);
                  return (
                    <View key={i} style={[styles.abnormalRow, { borderLeftColor: cfg.color }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={styles.abnormalName}>{m.name}</Text>
                        <Text style={[styles.abnormalValue, { color: cfg.color }]}>
                          {m.value} {m.unit}
                        </Text>
                      </View>
                      {explain?.what ? (
                        <Text style={styles.abnormalWhat}>{explain.what}</Text>
                      ) : null}
                      {action ? (
                        <View style={styles.actionHint}>
                          <MaterialCommunityIcons name="lightbulb-on" size={13} color="#F59E0B" />
                          <Text style={styles.actionHintText}>{action}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.askAiBtn}
                        onPress={() => navigation.navigate("AIChat")}
                      >
                        <MaterialCommunityIcons name="robot-outline" size={13} color="#8B5CF6" />
                        <Text style={styles.askAiBtnText}>Ask AI about {m.name}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Action plan */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <MaterialCommunityIcons name="format-list-checks" size={18} color="#10B981" />
                <Text style={styles.sectionCardTitle}>Your Action Plan</Text>
              </View>
              {actionPlan.map((step, i) => (
                <View key={i} style={[styles.actionStep, { backgroundColor: step.bg }]}>
                  <View style={styles.actionStepNum}>
                    <Text style={styles.actionStepNumText}>{i + 1}</Text>
                  </View>
                  <MaterialCommunityIcons name={step.icon} size={20} color={step.iconColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionStepTitle}>{step.title}</Text>
                    <Text style={styles.actionStepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Normal metrics reassurance */}
            {normal.length > 0 && (
              <View style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: "#10B981" }]}>
                <View style={styles.sectionCardHeader}>
                  <MaterialCommunityIcons name="check-all" size={18} color="#10B981" />
                  <Text style={[styles.sectionCardTitle, { color: "#10B981" }]}>
                    {normal.length} Test{normal.length > 1 ? "s" : ""} in Normal Range ✓
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {normal.map((m, i) => (
                    <View key={i} style={styles.normalChip}>
                      <Text style={styles.normalChipText}>{m.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════
          TAB 2 — METRICS (enhanced with explanations + chart)
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "metrics" && (
        <View style={styles.metricsSection}>
          {/* Quick chart if data exists */}
          {chartData && (
            <View style={{ marginBottom: 16 }}>
              <BarChart
                data={chartData}
                width={screenWidth - 40}
                height={200}
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
                  barPercentage: 0.65,
                }}
                style={styles.chart}
                fromZero
              />
              <Text style={[styles.chartSubtitle, { textAlign: "center", marginTop: 6 }]}>
                🟢 Normal  🟡 Borderline  🔴 High
              </Text>
            </View>
          )}

          {analysis?.metrics?.length > 0 ? (
            analysis.metrics.map((m, i) => {
              const cfg = STATUS_CONFIG(m.status);
              const explain = getMetricExplain(m.name);
              const isAbnormal = String(m.status || "").toLowerCase() !== "normal";
              return (
                <View key={i} style={[styles.metricCard, { borderLeftColor: cfg.color }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
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
                  {explain?.what ? (
                    <Text style={styles.metricExplain}>{explain.what}</Text>
                  ) : null}
                  {isAbnormal && explain ? (
                    <View style={styles.actionHint}>
                      <MaterialCommunityIcons name="lightbulb-on" size={13} color="#F59E0B" />
                      <Text style={styles.actionHintText}>
                        {getActionForStatus(explain, m.status)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyMetrics}>
              <MaterialCommunityIcons name="robot-confused-outline" size={50} color="#CBD5E1" />
              <Text style={styles.emptyMetricsText}>No structured values extracted.</Text>
            </View>
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 3 — DETAILS (medications, allergies, OCR)
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "details" && (
        <View style={styles.metricsSection}>
          {/* Medications */}
          {analysis?.medications?.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <MaterialCommunityIcons name="pill" size={18} color="#2E75B6" />
                <Text style={styles.sectionCardTitle}>Medications Found in Report</Text>
              </View>
              {analysis.medications.map((med, i) => {
                const name = typeof med === "string" ? med : med.name;
                const dose = med?.dose || med?.dosage;
                return (
                  <View key={i} style={styles.detailRow}>
                    <View style={styles.detailDot} />
                    <View>
                      <Text style={styles.detailName}>{name}</Text>
                      {dose ? <Text style={styles.detailSub}>{dose}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Allergies */}
          {analysis?.allergies?.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <MaterialCommunityIcons name="alert-decagram" size={18} color="#F59E0B" />
                <Text style={styles.sectionCardTitle}>Allergies Found in Report</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {analysis.allergies.map((a, i) => {
                  const name = typeof a === "string" ? a : a.name;
                  return (
                    <View key={i} style={styles.allergyChip}>
                      <Text style={styles.allergyChipText}>⚠️ {name}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Lab info */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <MaterialCommunityIcons name="hospital-building" size={18} color="#64748B" />
              <Text style={styles.sectionCardTitle}>Report Details</Text>
            </View>
            <View style={{ gap: 8 }}>
              {[
                { label: "Lab",     val: analysis?.lab     || "—" },
                { label: "Date",    val: analysis?.date    || "—" },
                { label: "Patient", val: analysis?.patient || "—" },
                { label: "Age",     val: analysis?.age     || "—" },
                { label: "Gender",  val: analysis?.gender  || "—" },
                { label: "Blood Group", val: analysis?.bloodGroup || "—" },
              ].map(({ label, val }) => (
                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: "#94A3B8", fontWeight: "700" }}>{label}</Text>
                  <Text style={{ fontSize: 13, color: "#1E293B", fontWeight: "800" }}>{val}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* OCR text */}
          {!!ocrText && (
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionCardHeader}
                onPress={() => setShowOcr(!showOcr)}
              >
                <MaterialCommunityIcons name="text-box-outline" size={18} color="#64748B" />
                <Text style={styles.sectionCardTitle}>Raw OCR Text</Text>
                <MaterialCommunityIcons
                  name={showOcr ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#94A3B8"
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>
              {showOcr && (
                <Text style={styles.ocrText}>{ocrText}</Text>
              )}
            </View>
          )}

          {/* Disclaimer */}
          <View style={[styles.sectionCard, { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7", borderWidth: 1 }]}>
            <Text style={{ fontSize: 12, color: "#92400E", lineHeight: 18, fontWeight: "500" }}>
              ⚠️ This analysis is AI-generated for informational purposes only. It is not a medical diagnosis. Always consult a qualified doctor before making any health decisions.
            </Text>
          </View>
        </View>
      )}

      {/* ── Action buttons ─────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16 }}>
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

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <TouchableOpacity
            style={[styles.uploadAnotherBtn, { flex: 1, backgroundColor: "#F5F3FF", borderRadius: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "center", gap: 8 }]}
            onPress={() => navigation.navigate("AIChat")}
          >
            <MaterialCommunityIcons name="robot-outline" size={18} color="#8B5CF6" />
            <Text style={[styles.uploadAnotherText, { color: "#8B5CF6" }]}>Ask AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.uploadAnotherBtn, { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "center", gap: 8 }]}
            onPress={() => { Speech.stop(); navigation.navigate("UploadReport"); }}
          >
            <MaterialCommunityIcons name="upload" size={18} color="#64748B" />
            <Text style={[styles.uploadAnotherText, { color: "#64748B" }]}>New Report</Text>
          </TouchableOpacity>
        </View>
      </View>

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

  // AI Hub Dashboard styles
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  statNum: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", marginTop: 2 },

  latestCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  latestCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  latestCardLabel: { fontSize: 10, fontWeight: "800", color: "#8B5CF6", letterSpacing: 0.5, marginBottom: 2 },
  latestCardLab: { fontSize: 15, fontWeight: "900", color: "#1E293B" },
  latestCardSummary: { fontSize: 13, color: "#475569", lineHeight: 20, marginBottom: 8 },
  latestCardDate: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },

  navSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  navCardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  navCardTitle: { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 2 },
  navCardSub: { fontSize: 12, color: "#94A3B8" },

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

  // ── Risk banner ──
  riskBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  riskTitle: { fontSize: 15, fontWeight: "900" },
  riskSub: { fontSize: 12, color: "#64748B", fontWeight: "600", marginTop: 2 },

  // ── Patient strip ──
  patientStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  patientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  patientChipText: { fontSize: 12, fontWeight: "700", color: "#1E293B" },

  // ── Section card ──
  sectionCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  sectionCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionCardTitle: { fontSize: 14, fontWeight: "900", color: "#1E293B" },

  // ── Conditions ──
  conditionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  conditionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", marginTop: 5 },
  conditionName: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  conditionSub: { fontSize: 12, color: "#64748B", fontWeight: "500", marginTop: 2 },

  // ── Abnormal rows ──
  abnormalRow: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  abnormalName: { fontSize: 14, fontWeight: "900", color: "#1E293B" },
  abnormalValue: { fontSize: 16, fontWeight: "900" },
  abnormalWhat: { fontSize: 12, color: "#64748B", fontWeight: "500", marginTop: 5, lineHeight: 18 },

  // ── Action hints ──
  actionHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  actionHintText: { flex: 1, fontSize: 12, color: "#78350F", fontWeight: "600", lineHeight: 18 },

  // ── Ask AI button ──
  askAiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  askAiBtnText: { fontSize: 12, color: "#8B5CF6", fontWeight: "700" },

  // ── Action plan ──
  actionStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  actionStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionStepNumText: { fontSize: 11, fontWeight: "900", color: "#1E293B" },
  actionStepTitle: { fontSize: 14, fontWeight: "900", color: "#1E293B" },
  actionStepDesc: { fontSize: 12, color: "#475569", fontWeight: "500", marginTop: 4, lineHeight: 18 },

  // ── Normal chips ──
  normalChip: { backgroundColor: "#F0FDF4", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  normalChipText: { fontSize: 12, color: "#166534", fontWeight: "700" },

  // ── Detail rows ──
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  detailDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2E75B6", marginTop: 5 },
  detailName: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  detailSub: { fontSize: 12, color: "#64748B", fontWeight: "500", marginTop: 2 },

  // ── Allergy chips ──
  allergyChip: { backgroundColor: "#FEF3C7", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  allergyChipText: { fontSize: 12, color: "#92400E", fontWeight: "700" },

  // ── Metric explanation ──
  metricExplain: { fontSize: 12, color: "#64748B", fontWeight: "500", marginTop: 8, lineHeight: 18 },
});
