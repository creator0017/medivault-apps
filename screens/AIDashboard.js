import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

const API_KEY = "AIzaSyBXwBc_Aj9CAuGU-QcwaWgEobruBIaaa4Q";
const genAI = new GoogleGenerativeAI(API_KEY);

export default function AIDashboard() {
  const route = useRoute();
  const navigation = useNavigation();

  // Get image from UploadReportScreen
  const { reportUri } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (reportUri) {
      analyzeReport();
    } else {
      setLoading(false); // If no image, don't stay in loading
    }
  }, [reportUri]);

  const analyzeReport = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const response = await fetch(reportUri);
      const blob = await response.blob();
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });

      const prompt =
        'Extract data from this Indian lab report. Focus on HbA1c, Fasting, or Post Prandial sugar. Return ONLY JSON: {"testType": "HbA1c", "value": 7.2, "date": "DD/MM/YYYY", "lab": "Lab Name", "insight": "short health tip"}';

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
      ]);

      const text = result.response.text();
      const cleanJson = text.replace(/```json|```/g, "");
      setAnalysis(JSON.parse(cleanJson));
      setLoading(false);
    } catch (error) {
      console.error("AI Error:", error);
      Alert.alert(
        "Analysis Error",
        "MediVault AI couldn't read the image. Please try again.",
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
      <Text style={styles.headerTitle}>AI Insights</Text>

      {analysis ? (
        <View style={styles.resultCard}>
          <Text style={styles.testType}>{analysis.testType} Results</Text>

          <View style={styles.dataBox}>
            <Text style={styles.valueText}>{analysis.value}%</Text>
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
        <Text style={styles.errorText}>
          No report data found. Please upload a report first.
        </Text>
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
  actionBtn: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 20,
    marginTop: 30,
    alignItems: "center",
  },
  actionBtnText: { color: "#FFF", fontWeight: "900", letterSpacing: 1 },
  errorText: { textAlign: "center", color: "#EF4444", fontWeight: "700" },
});
