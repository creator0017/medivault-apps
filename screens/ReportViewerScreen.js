import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";

export default function ReportViewerScreen({ route, navigation }) {
  const { url, title, type } = route.params;

  const viewUrl =
    type === "PDF"
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
      : url;

  const handleDownload = async () => {
    try {
      const ext = type === "PDF" ? "pdf" : "jpg";
      const localUri =
        FileSystem.cacheDirectory +
        `${(title || "report").replace(/\s/g, "_")}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      await Sharing.shareAsync(uri, {
        mimeType: type === "PDF" ? "application/pdf" : "image/jpeg",
        dialogTitle: title || "MediVault Report",
      });
    } catch {
      Alert.alert("Error", "Could not download this file.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title || "Report"}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleDownload} style={styles.iconBtn}>
            <MaterialCommunityIcons name="download" size={22} color="#2E75B6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* In-app viewer */}
      <WebView
        source={{ uri: viewUrl }}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2E75B6" />
            <Text style={styles.loadingText}>Loading report...</Text>
          </View>
        )}
        onError={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginHorizontal: 10,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 6 },
  doneBtnText: { color: "#2E75B6", fontWeight: "800", fontSize: 15 },
  webview: { flex: 1 },
  loadingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: { marginTop: 12, color: "#64748B", fontWeight: "600" },
});
