import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Quick question sets – general + context-aware ones injected after load
const BASE_QUICK_QS = [
  { icon: "test-tube", label: "What do my results mean?", q: "Explain all my blood test results in simple terms." },
  { icon: "alert-circle", label: "What needs attention?", q: "Which of my values are abnormal and what should I do about each?" },
  { icon: "food-apple", label: "Diet advice", q: "Based on my reports, what foods should I eat and avoid?" },
  { icon: "run", label: "Exercise tips", q: "What exercise is safe and beneficial for my current health condition?" },
  { icon: "calendar-clock", label: "When to retest?", q: "Based on my results, when should I get each test done again?" },
  { icon: "pill", label: "Medication questions", q: "Are there any medications or supplements that might help based on my test results?" },
  { icon: "heart-pulse", label: "Heart health", q: "What do my cholesterol and blood pressure values say about my heart health?" },
  { icon: "diabetes", label: "Diabetes control", q: "How is my diabetes management? What should I improve?" },
];

// Format AI response text — handle bold (**text**), bullets (- text)
function FormattedText({ text, style }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 6 }} />;

        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const content = trimmed.replace(/^[-•]\s*/, "");
          return (
            <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={[style, { marginRight: 6, color: "#8B5CF6" }]}>•</Text>
              <Text style={[style, { flex: 1 }]}>{renderBold(content, style)}</Text>
            </View>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={[style, { marginRight: 6, fontWeight: "800", color: "#8B5CF6", minWidth: 18 }]}>{numMatch[1]}.</Text>
              <Text style={[style, { flex: 1 }]}>{renderBold(numMatch[2], style)}</Text>
            </View>
          );
        }

        return <Text key={i} style={[style, { marginBottom: 2 }]}>{renderBold(trimmed, style)}</Text>;
      })}
    </View>
  );
}

function renderBold(text, baseStyle) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={[baseStyle, { fontWeight: "900", color: "#1E293B" }]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

// Animated typing dots
function TypingDots() {
  return (
    <View style={styles.typingRow}>
      <View style={styles.aiAvatar}>
        <MaterialCommunityIcons name="robot" size={18} color="#8B5CF6" />
      </View>
      <View style={styles.typingBubble}>
        <ActivityIndicator size="small" color="#8B5CF6" />
        <Text style={styles.typingText}>Arogyasathi AI is thinking…</Text>
      </View>
    </View>
  );
}

export default function AIChatScreen({ navigation, route }) {
  const { userData } = useUser();
  const isFocused = useIsFocused();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportPicker, setShowReportPicker] = useState(false);
  const [error, setError] = useState("");

  const flatListRef = useRef(null);
  const chatRef = useRef(null);

  const firstName = userData?.fullName?.split(" ")[0] || "there";

  // ── Load context on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (isFocused) {
      loadContext();
    }
  }, [userData?.uid, isFocused]);

  const loadContext = async () => {
    if (!userData?.uid) { setLoadingContext(false); return; }
    try {
      // First try to load AI analyses
      const q = query(
        collection(db, "users", userData.uid, "aiAnalyses"),
        orderBy("analyzedAt", "desc"),
        limit(5)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log("AI Chat: Loaded", data.length, "aiAnalyses documents");

      let latest = data[0] || null;

      // If no AI analyses, try to load health reports as fallback
      if (!latest) {
        console.log("No aiAnalyses found, trying healthReports fallback...");
        const healthReportsQuery = query(
          collection(db, "users", userData.uid, "healthReports"),
          orderBy("testDate", "desc"),
          limit(20)
        );
        const healthReportsSnap = await getDocs(healthReportsQuery);
        const healthReports = healthReportsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (healthReports.length > 0) {
          console.log("Found", healthReports.length, "health reports, creating synthetic analysis");

          // Group by testDate to create a synthetic report
          const latestReportDate = healthReports[0].testDate;
          const sameDateReports = healthReports.filter(r =>
            r.testDate && r.testDate.toDate().toDateString() === latestReportDate.toDate().toDateString()
          );

          // Build metrics array from health reports
          const metrics = sameDateReports.map((hr, idx) => ({
            id: `hr_${idx}`,
            name: hr.testType || "Unknown Test",
            value: String(hr.value || ""),
            unit: hr.unit || "",
            normalRange: hr.normalRange || "",
            status: hr.status || "",
          }));

          // Create synthetic analysis object
          latest = {
            id: "synthetic_from_healthreports",
            lab: sameDateReports[0]?.labName || "Unknown Lab",
            date: latestReportDate.toDate().toLocaleDateString("en-IN"),
            metrics,
            summary: `Based on ${metrics.length} test results from your health reports.`,
            analyzedAt: latestReportDate,
          };
          console.log("Created synthetic analysis:", latest);
        }
      } else {
        console.log("Latest aiAnalysis:", latest);
      }

      // If we have a synthetic report (no AI analyses), use it as the only report
      setReports(latest && latest.id === "synthetic_from_healthreports" ? [latest] : data);
      setSelectedReport(latest);
      initWelcome(latest);
    } catch (e) {
      console.error("AI Chat: Error loading health data:", e);
      setError(e.message);
      initWelcome(null);
    }
    setLoadingContext(false);
  };

  const initWelcome = (report) => {
    const abnormalCount = report
      ? (report.metrics || []).filter(m => String(m.status || "").toLowerCase() !== "normal").length
      : 0;

    let welcomeText = `Hello ${firstName}! 👋 I'm **Arogyasathi AI**, powered by Groq AI.\n\n`;

    if (report) {
      welcomeText += `I've loaded your latest report from **${report.lab || "the lab"}** with **${report.metrics?.length || 0} test results**.`;
      if (abnormalCount > 0) {
        welcomeText += ` I noticed **${abnormalCount} value${abnormalCount > 1 ? "s" : ""} need attention**.\n\nAsk me anything — I'll explain your results in simple terms.`;
      } else {
        welcomeText += `\n\nAll your values look good! Ask me anything about your health.`;
      }
    } else {
      welcomeText += `I can answer general health questions and explain medical terms in simple language.\n\nFor personalized advice based on your lab results, upload a report.`;
    }

    setMessages([{ id: "welcome", role: "ai", text: welcomeText }]);
    chatRef.current = null; // reset chat session
  };

  // ── Build health context for AI ──────────────────────────────────────────────
  const buildHealthContext = (report) => {
    if (!report) return "No lab report data loaded yet. You can answer general health questions, explain medical conditions, provide wellness advice, and clarify medical terminology. Be helpful and informative.";

    const metricsText = (report.metrics || [])
      .map(m => `  - ${m.name}: ${m.value} ${m.unit || ""} [${m.status || "unknown"}, normal: ${m.normalRange || "N/A"}]`)
      .join("\n");

    const condText = (report.conditions || []).map(c => `  - ${c.title || c.name}: ${c.subtitle || ""}`).join("\n");
    const medText = (report.medications || []).map(m => `  - ${typeof m === "string" ? m : m.name}`).join("\n");
    const algText = (report.allergies || []).map(a => `  - ${typeof a === "string" ? a : a.name}`).join("\n");

    return `PATIENT: ${report.patient || userData?.fullName || "Unknown"} | Age: ${report.age || "?"} | Gender: ${report.gender || "?"} | Blood Group: ${report.bloodGroup || "?"}
LAB: ${report.lab || "?"} | DATE: ${report.date || "?"}

BLOOD TEST RESULTS:
${metricsText || "  (none)"}

AI SUMMARY: ${report.summary || "N/A"}

DETECTED CONDITIONS:
${condText || "  (none)"}

MEDICATIONS FOUND:
${medText || "  (none)"}

ALLERGIES:
${algText || "  (none)"}`;
  };

  // ── Build Gemini chat client (No longer using Groq) ──────────────────────

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    setError("");

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      if (!GEMINI_API_KEY) throw new Error("Gemini API key is missing. Check your setup.");
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

      // Build system message with health context
      const systemPrompt = `You are Arogyasathi AI — a friendly, expert medical assistant for Indian patients.
Rules:
- Always answer in simple, clear English suitable for all ages including elderly patients
- Use bullet points and numbered lists for clarity
- Always mention normal ranges when discussing test values
- End each response with a brief reminder to consult their doctor for treatment decisions
- Never give specific medication dosage advice
- Be warm, reassuring, and practical
- Answer the user's question directly and completely. Do not give generic responses or ask them to upload reports.
- If you don't have specific patient data, provide general health information based on medical knowledge.

Here is the patient's latest health data:\n\n${buildHealthContext(selectedReport)}`;

      let model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt 
      });

      // Include the NEW user message which is not in the 'messages' closure yet
      const allMsgs = [...messages, { role: "user", text: userText }];
      
      const history = allMsgs
        .filter(msg => (msg.role === "user" || msg.role === "ai") && msg.text)
        .slice(-10); // Keep last 10 messages for context

      const contents = history.map(msg => ({
        role: msg.role === "ai" ? "model" : "user",
        parts: [{ text: msg.text }]
      }));

      let response;
      try {
        response = await model.generateContent({
          contents: contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        });
      } catch (primaryErr) {
        if (primaryErr?.message?.includes("503") || primaryErr?.message?.includes("demand") || primaryErr?.message?.includes("404")) {
          console.warn("Gemini 2.5 is congested or unavailable. Falling back to gemini-1.5-flash...");
          model = genAI.getGenerativeModel({
             model: "gemini-1.5-flash",
             systemInstruction: systemPrompt
          });
          response = await model.generateContent({
            contents: contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          });
        } else {
          throw primaryErr;
        }
      }

      const aiText = response.response.text();
      setMessages(prev => [...prev, { id: Date.now().toString() + "_ai", role: "ai", text: aiText }]);
    } catch (err) {
      console.error("AI Chat: Gemini API error:", err);
      const msg = err?.message || "Could not connect to Gemini AI. Check your internet and try again.";
      setError(msg);
      setMessages(prev => [...prev, {
        id: Date.now().toString() + "_err",
        role: "error",
        text: `⚠️ ${msg}`,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── Switch report ────────────────────────────────────────────────────────────
  const switchReport = (report) => {
    setSelectedReport(report);
    chatRef.current = null;
    setShowReportPicker(false);
    const abnormal = (report.metrics || []).filter(m => String(m.status || "").toLowerCase() !== "normal").length;
    const switchMsg = `Switched to **${report.lab || "Lab"} report** (${report.analyzedAt?.toDate
      ? report.analyzedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : report.date || "?"
      }).\n\n${report.metrics?.length || 0} metrics loaded${abnormal > 0 ? `, ${abnormal} need attention` : " — all normal"}. Ask me anything!`;
    setMessages(prev => [...prev, { id: "switch_" + report.id, role: "ai", text: switchMsg }]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isAI = item.role === "ai";
    const isError = item.role === "error";

    if (isError) {
      return (
        <View style={styles.errorBubble}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorBubbleText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, isAI ? styles.msgRowAI : styles.msgRowUser]}>
        {isAI && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="robot" size={16} color="#8B5CF6" />
          </View>
        )}
        <View style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleUser]}>
          {isAI
            ? <FormattedText text={item.text} style={styles.bubbleTextAI} />
            : <Text style={styles.bubbleTextUser}>{item.text}</Text>
          }
          <Text style={[styles.timeText, { color: isAI ? "#94A3B8" : "rgba(255,255,255,0.6)" }]}>
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  if (loadingContext) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{ marginTop: 12, color: "#64748B", fontWeight: "600" }}>Loading your health data…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerTitle}>Arogyasathi AI</Text>
          </View>
          <Text style={styles.headerSub}>
            {selectedReport
              ? `Context: ${selectedReport.lab || "Lab"} · ${selectedReport.metrics?.length || 0} metrics`
              : "No report loaded · general mode"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: "#F5F3FF" }]}
          onPress={() => setShowReportPicker(!showReportPicker)}
        >
          <MaterialCommunityIcons name="swap-horizontal" size={20} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {/* ── Report context picker ── */}
      {showReportPicker && (
        <View style={styles.pickerPanel}>
          <Text style={styles.pickerTitle}>SWITCH REPORT CONTEXT</Text>
          {reports.length === 0 ? (
            <TouchableOpacity
              style={styles.uploadPrompt}
              onPress={() => { setShowReportPicker(false); navigation.navigate("UploadReport"); }}
            >
              <MaterialCommunityIcons name="upload" size={18} color="#8B5CF6" />
              <Text style={styles.uploadPromptText}>Upload a report to get personalised answers</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {reports.map((r) => {
                const selected = selectedReport?.id === r.id;
                const abnormal = (r.metrics || []).filter(m => String(m.status || "").toLowerCase() !== "normal").length;
                const date = r.analyzedAt?.toDate
                  ? r.analyzedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : r.date || "?";
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.reportChip, selected && styles.reportChipActive]}
                    onPress={() => switchReport(r)}
                  >
                    <Text style={[styles.reportChipText, selected && { color: "#FFF" }]}>
                      {r.lab || "Lab"} · {date}
                    </Text>
                    {abnormal > 0 && (
                      <View style={[styles.reportChipBadge, selected && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: selected ? "#FFF" : "#EF4444" }}>
                          {abnormal}⚠
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Context summary strip (when report loaded) ── */}
      {selectedReport && !showReportPicker && (
        <View style={styles.contextStrip}>
          <MaterialCommunityIcons name="hospital-building" size={13} color="#8B5CF6" />
          <Text style={styles.contextStripText} numberOfLines={1}>
            {selectedReport.lab || "Lab"} ·{" "}
            {selectedReport.date || "?"} ·{" "}
            {selectedReport.metrics?.length || 0} tests ·{" "}
            {(selectedReport.metrics || []).filter(m => String(m.status || "").toLowerCase() !== "normal").length} abnormal
          </Text>
          <TouchableOpacity onPress={() => setShowReportPicker(true)}>
            <Text style={{ fontSize: 11, color: "#8B5CF6", fontWeight: "700" }}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={loading ? <TypingDots /> : null}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Quick questions (shown on first load & when chat is fresh) ── */}
      {messages.length <= 1 && !loading && (
        <View style={styles.quickSection}>
          <Text style={styles.quickLabel}>QUICK QUESTIONS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {BASE_QUICK_QS.map((item) => (
              <TouchableOpacity
                key={item.q}
                style={styles.quickChip}
                onPress={() => sendMessage(item.q)}
              >
                <MaterialCommunityIcons name={item.icon} size={14} color="#7C3AED" />
                <Text style={styles.quickChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Input bar ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 10}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your health report…"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={600}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#FFF" />
              : <MaterialCommunityIcons name="send" size={18} color="#FFF" />
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>AI responses are for information only · Always consult your doctor</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 10,
  },
  headerBtn: { padding: 8, borderRadius: 12 },
  headerCenter: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 11, color: "#64748B", fontWeight: "600", marginTop: 1 },

  // ── Context strip ──
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9FE",
  },
  contextStripText: { flex: 1, fontSize: 11, color: "#6D28D9", fontWeight: "600" },

  // ── Report picker panel ──
  pickerPanel: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    padding: 14,
  },
  pickerTitle: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1 },
  reportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  reportChipActive: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  reportChipText: { fontSize: 12, fontWeight: "700", color: "#8B5CF6" },
  reportChipBadge: { backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  uploadPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F3FF",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  uploadPromptText: { fontSize: 13, color: "#8B5CF6", fontWeight: "700" },

  // ── Chat ──
  chatList: { padding: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 14 },
  msgRowAI: { flexDirection: "row", alignItems: "flex-end" },
  msgRowUser: { flexDirection: "row-reverse", alignItems: "flex-end" },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAI: {
    backgroundColor: "#FFF",
    borderBottomLeftRadius: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleUser: {
    backgroundColor: "#7C3AED",
    borderBottomRightRadius: 4,
    elevation: 2,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  bubbleTextAI: { fontSize: 14, lineHeight: 21, color: "#1E293B", fontWeight: "500" },
  bubbleTextUser: { fontSize: 14, lineHeight: 21, color: "#FFF", fontWeight: "500" },
  timeText: { fontSize: 10, marginTop: 5, textAlign: "right" },

  // ── Typing ──
  typingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 1,
  },
  typingText: { color: "#8B5CF6", fontWeight: "600", fontSize: 13 },

  // ── Error bubble ──
  errorBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBubbleText: { flex: 1, fontSize: 13, color: "#B91C1C", fontWeight: "600", lineHeight: 18 },

  // ── Quick questions ──
  quickSection: { backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingVertical: 12 },
  quickLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, marginLeft: 16, marginBottom: 8 },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  quickChipText: { fontSize: 12, color: "#7C3AED", fontWeight: "700" },

  // ── Input bar ──
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  sendBtnDisabled: { backgroundColor: "#CBD5E1", elevation: 0, shadowOpacity: 0 },
  disclaimer: { fontSize: 10, color: "#94A3B8", textAlign: "center", paddingBottom: 8, backgroundColor: "#FFF" },
});
