import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// Your provided API Key
const API_KEY = "AIzaSyBXwBc_Aj9CAuGU-QcwaWgEobruBIaaa4Q";
const genAI = new GoogleGenerativeAI(API_KEY);

export default function AIScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { reportUri } = route.params;

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (reportUri) {
      analyzeReport();
    }
  }, [reportUri]);

  const analyzeReport = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convert image to base64
      const response = await fetch(reportUri);
      const blob = await response.blob();
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });

      // Optimized prompt for MediVault
      const prompt =
        'Analyze this HbA1c report. Extract: 1. HbA1c value (number only), 2. Date of test, 3. Lab Name. Return ONLY a JSON object: {"hba1c": 7.2, "date": "DD/MM/YYYY", "lab": "Lab Name"}';

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
        "Failed to extract data. Ensure the photo is clear.",
      );
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>MediVault AI Scanning...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.resultCard}>
        <MaterialCommunityIcons
          name="check-circle"
          size={50}
          color="#10B981"
          style={{ alignSelf: "center" }}
        />
        <Text style={styles.successTitle}>Data Extracted</Text>

        <View style={styles.dataRow}>
          <Text style={styles.label}>HbA1c Level:</Text>
          <Text style={styles.value}>{analysis?.hba1c}%</Text>
        </View>

        <View style={styles.dataRow}>
          <Text style={styles.label}>Test Date:</Text>
          <Text style={styles.subValue}>{analysis?.date}</Text>
        </View>

        <View style={styles.dataRow}>
          <Text style={styles.label}>Laboratory:</Text>
          <Text style={styles.subValue}>{analysis?.lab}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => navigation.navigate("Home")}
      >
        <Text style={styles.doneBtnText}>CONFIRM & SAVE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
    justifyContent: "center",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#8B5CF6",
    fontWeight: "700",
  },
  resultCard: {
    backgroundColor: "#FFF",
    padding: 30,
    borderRadius: 30,
    elevation: 5,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginVertical: 20,
    color: "#1E293B",
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  label: { color: "#64748B", fontWeight: "600" },
  value: { fontSize: 24, fontWeight: "900", color: "#8B5CF6" },
  subValue: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  doneBtn: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 20,
    marginTop: 25,
    alignItems: "center",
  },
  doneBtnText: { color: "#FFF", fontWeight: "900" },
});
