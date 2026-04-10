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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import { db, storage } from "../firebaseConfig";

const MAX_FILES = 5;

export default function UploadReportScreen({ navigation }) {
  const { userData } = useUser();
  const [files, setFiles] = useState([]); // [{uri, mime, name, isImage}]
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const addFiles = (newFiles) => {
    setFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > MAX_FILES) {
        Alert.alert("Limit Reached", `You can upload up to ${MAX_FILES} files at once.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openCamera = async () => {
    if (files.length >= MAX_FILES) {
      Alert.alert("Limit Reached", `Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled) {
      addFiles([{ uri: result.assets[0].uri, mime: "image/jpeg", name: "Photo", isImage: true }]);
    }
  };

  const pickImages = async () => {
    if (files.length >= MAX_FILES) {
      Alert.alert("Limit Reached", `Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    const remaining = MAX_FILES - files.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (!result.canceled) {
      addFiles(
        result.assets.map((a) => ({
          uri: a.uri,
          mime: a.mimeType || "image/jpeg",
          name: a.fileName || "Image",
          isImage: true,
        }))
      );
    }
  };

  const pickDocument = async () => {
    if (files.length >= MAX_FILES) {
      Alert.alert("Limit Reached", `Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const toAdd = result.assets.slice(0, MAX_FILES - files.length).map((a) => ({
          uri: a.uri,
          mime: a.mimeType || "application/pdf",
          name: a.name || "Document",
          isImage: a.mimeType?.startsWith("image/"),
        }));
        addFiles(toAdd);
      }
    } catch {
      Alert.alert("Error", "Could not pick document.");
    }
  };

  const uploadBlob = (uri) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error("Failed to read file"));
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

  const handleSecureUpload = async () => {
    if (files.length === 0) {
      Alert.alert("No Files Selected", "Please add at least one report.");
      return;
    }
    if (!userData?.uid) {
      Alert.alert("Not Signed In", "Please sign in to upload reports.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const blob = await uploadBlob(file.uri);
        const ext = file.mime?.includes("pdf") ? "pdf" : "jpg";
        const timestamp = Date.now();
        const storagePath = `users/${userData.uid}/reports/${timestamp}_${i}.${ext}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, blob, { contentType: file.mime });
        const downloadURL = await getDownloadURL(storageRef);

        await addDoc(collection(db, "users", userData.uid, "reports"), {
          title: file.name !== "Image" && file.name !== "Photo" ? file.name : "Medical Report",
          url: downloadURL,
          storagePath,
          type: file.mime?.includes("pdf") ? "PDF" : "Image",
          uploadedAt: serverTimestamp(),
          uid: userData.uid,
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Offer AI analysis for any file (image or PDF)
      const firstAnalyzable = files.find((f) => f.isImage || f.mime?.includes("pdf"));
      if (firstAnalyzable) {
        Alert.alert(
          "Upload Complete",
          `${files.length} file${files.length > 1 ? "s" : ""} saved. Analyze with AI to extract health data automatically?`,
          [
            { text: "View Reports", onPress: () => navigation.navigate("Reports") },
            {
              text: "Analyze with AI",
              onPress: () =>
                navigation.navigate("AI", { reportUri: firstAnalyzable.uri, reportMime: firstAnalyzable.mime }),
            },
          ]
        );
      } else {
        Alert.alert(
          "Uploaded",
          `${files.length} file${files.length > 1 ? "s" : ""} saved.`,
          [{ text: "OK", onPress: () => navigation.navigate("Reports") }]
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", "Could not upload. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Reports</Text>
        <Text style={styles.counter}>{files.length}/{MAX_FILES}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Pick options */}
        <View style={styles.optionRow}>
          <TouchableOpacity style={styles.optionBtn} onPress={openCamera}>
            <MaterialCommunityIcons name="camera" size={28} color="#2E75B6" />
            <Text style={styles.optionLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionBtn} onPress={pickImages}>
            <MaterialCommunityIcons name="image-multiple" size={28} color="#10B981" />
            <Text style={styles.optionLabel}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionBtn} onPress={pickDocument}>
            <MaterialCommunityIcons name="file-pdf-box" size={28} color="#EF4444" />
            <Text style={styles.optionLabel}>PDF / Doc</Text>
          </TouchableOpacity>
        </View>

        {/* Selected files preview */}
        {files.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="cloud-upload-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyText}>Add up to 5 reports at once</Text>
            <Text style={styles.emptySubText}>Photos, images, or PDFs</Text>
          </View>
        ) : (
          <View style={styles.fileList}>
            {files.map((file, index) => (
              <View key={index} style={styles.fileCard}>
                {file.isImage ? (
                  <Image source={{ uri: file.uri }} style={styles.fileThumb} />
                ) : (
                  <View style={styles.pdfThumb}>
                    <MaterialCommunityIcons name="file-pdf-box" size={32} color="#EF4444" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileType}>{file.isImage ? "Image" : "PDF"}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFile(index)} style={styles.removeBtn}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Progress bar during upload */}
        {uploading && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Uploading... {uploadProgress}%</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
          </View>
        )}

        {/* Upload button */}
        <TouchableOpacity
          style={[styles.uploadBtn, (uploading || files.length === 0) && { opacity: 0.5 }]}
          onPress={handleSecureUpload}
          disabled={uploading || files.length === 0}
        >
          {uploading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="lock-check" size={20} color="#FFF" />
              <Text style={styles.uploadBtnText}>
                SECURE UPLOAD {files.length > 0 ? `(${files.length})` : ""}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  title: { fontSize: 17, fontWeight: "900", color: "#1E293B" },
  counter: { fontSize: 14, fontWeight: "700", color: "#2E75B6" },
  body: { padding: 20, paddingBottom: 40 },
  optionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  optionBtn: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  optionLabel: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  emptyBox: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    paddingVertical: 50,
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  emptyText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  emptySubText: { fontSize: 12, color: "#94A3B8" },
  fileList: { marginBottom: 20, gap: 10 },
  fileCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  fileThumb: { width: 52, height: 52, borderRadius: 10 },
  pdfThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  fileName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  fileType: { fontSize: 11, color: "#94A3B8", marginTop: 2, fontWeight: "600" },
  removeBtn: { padding: 4 },
  progressContainer: { marginBottom: 16 },
  progressLabel: { fontSize: 13, color: "#2E75B6", fontWeight: "700", marginBottom: 6 },
  progressBar: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#2E75B6", borderRadius: 3 },
  uploadBtn: {
    backgroundColor: "#1E293B",
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  uploadBtnText: { color: "#FFF", fontWeight: "900", letterSpacing: 1, fontSize: 14 },
});
