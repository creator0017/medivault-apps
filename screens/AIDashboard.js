import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// C-1 Fix: Use environment variable for API key
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export default function AIDashboard() {
  const route = useRoute();
  const navigation = useNavigation();
  const { reportUri } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (reportUri) {
      analyzeReport();
    } else {
      setLoading(false);
    }
  }, [reportUri]);

  const analyzeReport = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // H-5 Fix: Use expo-file-system instead of web FileReader
      const base64Data = await FileSystem.readAsStringAsync(reportUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const prompt =
        'Extract data from this Indian lab report. Focus on HbA1c, Fasting, or Post Prandial sugar. Return ONLY JSON: {"testType": "HbA1c", "value": 7.2, "date": "DD/MM/YYYY", "lab": "Lab Name", "insight": "short health tip"}';

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
      ]);

      const text = result.response.text();
      const cleanJson = text.replace(/```json|```/g, "").trim();

      // H-6 Fix: Safe JSON parsing with fallback
      try {
        const parsed = JSON.parse(cleanJson);
        if (parsed.testType && parsed.value !== undefined) {
          setAnalysis(parsed);
        } else {
          throw new Error("Missing required fields");
        }
      } catch (parseError) {
        console.warn("JSON parse failed, using fallback:", parseError);
        setAnalysis({
          testType: "Lab Report",
          value: "--",
          date: new Date().toLocaleDateString(),
          lab: "Unknown",
          insight: text.slice(0, 200),
        });
      }
      setLoading(false);
    } catch (error) {
      console.error("AI Error:", error);
      Alert.alert(
        "Analysis Error",
        "MediVault AI couldn't read the image. Please try again with a clearer photo.",
      );
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>
          MediVault AI Analysis in progress...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>AI Insights</Text>

      {analysis ? (
        <View style={styles.resultCard}>
          <Text style={styles.testType}>{analysis.testType} Results</Text>
          <View style={styles.dataBox}>
            <Text style={styles.valueText}>
              {analysis.value}
              {typeof analysis.value === "number" ? "%" : ""}
            </Text>
            <Text style={styles.label}>Detected Value</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar" size={20} color="#64748B" />
            <Text style={styles.infoText}>{analysis.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="hospital-building"
              size={20}
              color="#64748B"
            />
            <Text style={styles.infoText}>{analysis.lab}</Text>
          </View>
          <View style={styles.insightBox}>
            <Text style={styles.insightTitle}>AI Health Tip:</Text>
            <Text style={styles.insightText}>{analysis.insight}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="robot-outline" size={60} color="#CBD5E1" />
          <Text style={styles.errorText}>
            No report data found. Please upload a report first.
          </Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => navigation.navigate("UploadReport")}
          >
            <Text style={styles.uploadBtnText}>Upload Report</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => navigation.navigate("Home")}
      >
        <Text style={styles.actionBtnText}>DONE & SAVE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    padding: 25,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  backBtn: { marginBottom: 15 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 30,
  },
  loadingText: { marginTop: 20, color: "#8B5CF6", fontWeight: "bold" },
  resultCard: {
    backgroundColor: "#FFF",
    borderRadius: 30,
    padding: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  testType: {
    fontSize: 18,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 15,
  },
  dataBox: { alignItems: "center", marginVertical: 20 },
  valueText: { fontSize: 48, fontWeight: "900", color: "#8B5CF6" },
  label: { color: "#94A3B8", fontWeight: "600" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 10,
  },
  infoText: { color: "#1E293B", fontWeight: "700" },
  insightBox: {
    backgroundColor: "#F5F3FF",
    padding: 20,
    borderRadius: 20,
    marginTop: 25,
  },
  insightTitle: { fontWeight: "900", color: "#8B5CF6", marginBottom: 5 },
  insightText: { color: "#4C1D95", lineHeight: 20 },
  emptyCard: {
    backgroundColor: "#FFF",
    borderRadius: 30,
    padding: 40,
    elevation: 3,
    alignItems: "center",
  },
  errorText: {
    textAlign: "center",
    color: "#64748B",
    fontWeight: "600",
    marginTop: 15,
  },
  uploadBtn: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 15,
    marginTop: 20,
  },
  uploadBtnText: { color: "#FFF", fontWeight: "700" },
  actionBtn: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 20,
    marginTop: 30,
    alignItems: "center",
  },
  actionBtnText: { color: "#FFF", fontWeight: "900", letterSpacing: 1 },
});
