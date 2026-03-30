import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function UploadReportScreen({ navigation }) {
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSecureUpload = () => {
    if (!image) {
      Alert.alert("No Image Selected", "Please select a report to upload.");
      return;
    }
    Alert.alert("Success", "Report uploaded to MediVault securely.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Medical Report</Text>

      <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <View style={{ alignItems: "center" }}>
            <MaterialCommunityIcons
              name="cloud-upload"
              size={50}
              color="#2E75B6"
            />
            <Text style={styles.uploadText}>Select Report (Image/PDF)</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* --- AI ANALYSIS BUTTON (Visible only after image selection) --- */}
      {image && (
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={() =>
            navigation.navigate("AI", {
              latestReport: { title: "New Lab Upload", date: "30 MAR, 2026" },
              reportUri: image,
            })
          }
        >
          <MaterialCommunityIcons name="robot" size={24} color="#FFF" />
          <Text style={styles.aiBtnText}>ANALYZE WITH MEDIVAULT AI</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={handleSecureUpload}>
        <Text style={styles.submitBtnText}>SECURE UPLOAD</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 25,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 30,
    textAlign: "center",
  },
  uploadBox: {
    height: 300,
    backgroundColor: "#FFF",
    borderRadius: 30,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  uploadText: { marginTop: 10, color: "#64748B", fontWeight: "bold" },

  // Style for the new AI button
  aiBtn: {
    backgroundColor: "#8B5CF6", // Purple AI theme
    padding: 18,
    borderRadius: 20,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  aiBtnText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  submitBtn: {
    backgroundColor: "#1E293B",
    padding: 18,
    borderRadius: 20,
    marginTop: 15,
    alignItems: "center",
  },
  submitBtnText: { color: "#FFF", fontWeight: "900", letterSpacing: 1 },

  cancelBtn: {
    marginTop: 20,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 14,
  },
});
