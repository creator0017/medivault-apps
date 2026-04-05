import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_CONTEXT = `You are MediVault AI, a helpful medical assistant for Indian patients.
You have access to the patient's uploaded lab reports and health data.
Speak in simple, clear English suitable for all ages.
Always remind users to consult their doctor for medical decisions.
When answering about health metrics, mention the normal ranges.`;

const QUICK_QUESTIONS = [
  "What does my HbA1c mean?",
  "Is my blood sugar normal?",
  "Explain my cholesterol levels",
  "What are my abnormal values?",
  "Give me a health summary",
  "What should I watch out for?",
];

export default function AIChatScreen({ navigation }) {
  const { userData } = useUser();
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "ai",
      text: `Hello ${userData?.fullName?.split(" ")[0] || ""}! 👋 I'm MediVault AI.\n\nI can answer questions about your uploaded lab reports and health data. Ask me anything!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]); // recent AI analyses
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReports, setShowReports] = useState(false);
  const flatListRef = useRef(null);
  const chatRef = useRef(null); // Gemini chat session

  // Load recent AI analyses as context
  useEffect(() => {
    loadReportContext();
  }, [userData?.uid]);

  const loadReportContext = async () => {
    if (!userData?.uid) return;
    try {
      const q = query(
        collection(db, "users", userData.uid, "aiAnalyses"),
        orderBy("analyzedAt", "desc"),
        limit(5)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReports(data);
      // Auto-select latest
      if (data.length > 0) setSelectedReport(data[0]);
    } catch {}
  };

  // Build health context string from selected report
  const buildContext = (report) => {
    if (!report) return "No lab report data available yet.";
    const metrics = (report.metrics || [])
      .map((m) => `${m.name}: ${m.value} ${m.unit || ""} (${m.status}, normal: ${m.normalRange || "N/A"})`)
      .join("\n");
    const date = report.analyzedAt?.toDate
      ? report.analyzedAt.toDate().toLocaleDateString("en-IN")
      : report.date || "Unknown date";
    return `Lab Report from ${report.lab || "Lab"} on ${date}:\n${metrics}\nSummary: ${report.summary || ""}`;
  };

  // Init or reset chat session with system context
  const getChat = () => {
    if (!chatRef.current) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      chatRef.current = model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: SYSTEM_CONTEXT + "\n\nPatient health data:\n" + buildContext(selectedReport) }],
          },
          {
            role: "model",
            parts: [{ text: "I have reviewed the patient's health data and I'm ready to answer questions." }],
          },
        ],
      });
    }
    return chatRef.current;
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;

    const userMsg = { id: Date.now().toString(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const chat = getChat();
      const result = await chat.sendMessage(userText);
      const aiText = result.response.text();
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "_ai", role: "ai", text: aiText },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "ai",
          text: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // When user switches report, reset chat
  const selectReport = (report) => {
    setSelectedReport(report);
    chatRef.current = null;
    setShowReports(false);
    setMessages([
      {
        id: "switch_" + report.id,
        role: "ai",
        text: `Switched to report from **${report.lab || "Lab"}** (${
          report.analyzedAt?.toDate
            ? report.analyzedAt.toDate().toLocaleDateString("en-IN")
            : report.date || "Unknown"
        }).\n\nI now have ${report.metrics?.length || 0} metrics loaded. Ask me anything!`,
      },
    ]);
  };

  const renderMessage = ({ item }) => {
    const isAI = item.role === "ai";
    return (
      <View style={[styles.msgRow, isAI ? styles.msgRowAI : styles.msgRowUser]}>
        {isAI && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="robot" size={18} color="#8B5CF6" />
          </View>
        )}
        <View style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleUser]}>
          <Text style={[styles.bubbleText, isAI ? styles.bubbleTextAI : styles.bubbleTextUser]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Health Chat</Text>
          <Text style={styles.headerSub}>Powered by Gemini</Text>
        </View>
        <TouchableOpacity
          style={styles.reportSwitchBtn}
          onPress={() => setShowReports(!showReports)}
        >
          <MaterialCommunityIcons name="file-chart" size={22} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {/* Report selector panel */}
      {showReports && (
        <View style={styles.reportPanel}>
          <Text style={styles.reportPanelTitle}>Select Report Context</Text>
          {reports.length === 0 ? (
            <Text style={styles.reportPanelEmpty}>
              No AI analyses yet. Upload a report and analyze it first.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {reports.map((r) => {
                const date = r.analyzedAt?.toDate
                  ? r.analyzedAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : r.date || "—";
                const isSelected = selectedReport?.id === r.id;
                const abnormal = (r.metrics || []).filter(
                  (m) => String(m.status).toLowerCase() !== "normal"
                ).length;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.reportChip, isSelected && styles.reportChipSelected]}
                    onPress={() => selectReport(r)}
                  >
                    <MaterialCommunityIcons
                      name="hospital-building"
                      size={14}
                      color={isSelected ? "#FFF" : "#8B5CF6"}
                    />
                    <Text style={[styles.reportChipText, isSelected && styles.reportChipTextSelected]}>
                      {r.lab || "Lab"} · {date}
                    </Text>
                    {abnormal > 0 && (
                      <View style={[styles.reportChipBadge, isSelected && styles.reportChipBadgeSelected]}>
                        <Text style={styles.reportChipBadgeText}>{abnormal}⚠</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {selectedReport && (
            <View style={styles.contextPreview}>
              <Text style={styles.contextPreviewLabel}>
                {selectedReport.metrics?.length || 0} metrics loaded •{" "}
                {(selectedReport.metrics || []).filter((m) => String(m.status).toLowerCase() !== "normal").length} need attention
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Chat messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={styles.aiAvatar}>
                <MaterialCommunityIcons name="robot" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.typingText}>Analyzing...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick question chips */}
      {messages.length <= 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickScrollContent}
        >
          {QUICK_QUESTIONS.map((q) => (
            <TouchableOpacity
              key={q}
              style={styles.quickChip}
              onPress={() => sendMessage(q)}
            >
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={10}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your health report..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 11, color: "#8B5CF6", fontWeight: "600" },
  reportSwitchBtn: {
    backgroundColor: "#F5F3FF",
    padding: 8,
    borderRadius: 12,
  },

  // Report panel
  reportPanel: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    padding: 14,
  },
  reportPanelTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1,
    marginBottom: 10,
  },
  reportPanelEmpty: { fontSize: 13, color: "#94A3B8" },
  reportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  reportChipSelected: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  reportChipText: { fontSize: 12, fontWeight: "700", color: "#8B5CF6" },
  reportChipTextSelected: { color: "#FFF" },
  reportChipBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  reportChipBadgeSelected: { backgroundColor: "rgba(255,255,255,0.3)" },
  reportChipBadgeText: { fontSize: 10, fontWeight: "700", color: "#EF4444" },
  contextPreview: { marginTop: 10 },
  contextPreviewLabel: { fontSize: 11, color: "#64748B", fontWeight: "600" },

  // Chat
  chatList: { padding: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 12 },
  msgRowAI: { flexDirection: "row", alignItems: "flex-end" },
  msgRowUser: { flexDirection: "row-reverse", alignItems: "flex-end" },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAI: {
    backgroundColor: "#FFF",
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bubbleUser: {
    backgroundColor: "#8B5CF6",
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextAI: { color: "#1E293B" },
  bubbleTextUser: { color: "#FFF" },
  typingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 1,
  },
  typingText: { color: "#8B5CF6", fontWeight: "600", fontSize: 13 },

  // Quick chips
  quickScroll: { maxHeight: 50 },
  quickScrollContent: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  quickChip: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  quickChipText: { color: "#7C3AED", fontSize: 12, fontWeight: "700" },

  // Input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#CBD5E1" },
});
