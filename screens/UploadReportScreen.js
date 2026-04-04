import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useUser } from "../context/UserContext";
import { db, storage } from "../firebaseConfig";

export default function UploadReportScreen({ navigation }) {
  const { userData } = useUser();
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileUri, setFileUri] = useState(null);
  const [fileMime, setFileMime] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setFileUri(result.assets[0].uri);
      setFileMime("image/jpeg");
      setFileName(null);
    }
  };

  // M-8 Fix: PDF/Document picker
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        if (asset.mimeType?.startsWith("image/")) {
          setImage(asset.uri);
          setFileName(null);
        } else {
          setImage(null);
          setFileName(asset.name);
        }
        setFileUri(asset.uri);
        setFileMime(asset.mimeType || "application/pdf");
      }
    } catch (err) {
      Alert.alert("Error", "Could not pick document.");
    }
  };

  // H-4 Fix: Actual Firebase Storage upload + Firestore persistence
  const handleSecureUpload = async () => {
    if (!fileUri) {
      Alert.alert("No File Selected", "Please select a report to upload.");
      return;
    }
    if (!userData?.uid) {
      Alert.alert("Not Signed In", "Please sign in to upload reports.");
      return;
    }

    setUploading(true);
    try {
      // Convert URI to blob (works in React Native, unlike FileReader)
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Upload to Firebase Storage under users/{uid}/reports/
      const ext = fileMime?.includes("pdf") ? "pdf" : "jpg";
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `users/${userData.uid}/reports/${timestamp}.${ext}`
      );
      await uploadBytes(storageRef, blob, { contentType: fileMime });
      const downloadURL = await getDownloadURL(storageRef);

      // Save report metadata to Firestore
      await addDoc(collection(db, "users", userData.uid, "reports"), {
        title: fileName || "Medical Report",
        url: downloadURL,
        type: fileMime?.includes("pdf") ? "PDF" : "Image",
        uploadedAt: serverTimestamp(),
        uid: userData.uid,
      });

      Alert.alert(
        "Uploaded",
        "Report saved to MediVault securely.",
        [{ text: "OK", onPress: () => navigation.navigate("Reports") }]
      );
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", "Could not upload report. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const hasFile = image || fileName;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Medical Report</Text>

      {/* Image preview or file name */}
      <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : fileName ? (
          <View style={{ alignItems: "center" }}>
            <MaterialCommunityIcons
              name="file-pdf-box"
              size={50}
              color="#EF4444"
            />
            <Text style={styles.fileNameText} numberOfLines={2}>
              {fileName}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <MaterialCommunityIcons
              name="cloud-upload"
              size={50}
              color="#2E75B6"
            />
            <Text style={styles.uploadText}>Tap to select image</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* M-8 Fix: PDF picker button */}
      <TouchableOpacity style={styles.docBtn} onPress={pickDocument}>
        <MaterialCommunityIcons
          name="file-document-outline"
          size={22}
          color="#2E75B6"
        />
        <Text style={styles.docBtnText}>Or pick PDF / Document</Text>
      </TouchableOpacity>

      {/* AI Analysis Button (visible after file selection) */}
      {hasFile && (
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={() =>
            navigation.navigate("AI", {
              latestReport: { title: "New Lab Upload", date: "Today" },
              reportUri: image || null,
            })
          }
        >
          <MaterialCommunityIcons name="robot" size={24} color="#FFF" />
          <Text style={styles.aiBtnText}>ANALYZE WITH MEDIVAULT AI</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, uploading && { opacity: 0.7 }]}
        onPress={handleSecureUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitBtnText}>SECURE UPLOAD</Text>
        )}
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
    height: 280,
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
  fileNameText: {
    marginTop: 10,
    color: "#1E293B",
    fontWeight: "bold",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  docBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFF",
  },
  docBtnText: {
    color: "#2E75B6",
    fontWeight: "700",
    fontSize: 14,
  },
  aiBtn: {
    backgroundColor: "#8B5CF6",
    padding: 18,
    borderRadius: 20,
    marginTop: 15,
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
