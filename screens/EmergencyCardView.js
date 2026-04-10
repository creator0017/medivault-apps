import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useUser } from "../context/UserContext";
import { useEmergencyCard } from "../hooks/useEmergencyCard";

export default function EmergencyCardView({ route, navigation }) {
  const { userData } = useUser();
  const { cardData, loading, shareUrl, generateLocalPDF, getPublicPDFUrl } = useEmergencyCard(
    userData?.uid,
  );
  const [qrValue, setQrValue] = useState(route.params?.shareUrl || "");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // Automatically upload the latest PDF to storage and embed the direct link in the QR code.
    const setupQR = async () => {
      const url = await getPublicPDFUrl();
      if (url) setQrValue(url);
    };
    if (userData?.uid && qrValue === "") { // Or re-check if we need it
      setupQR();
    }
  }, [userData?.uid]);

  const handleCopyLink = () => {
    if (qrValue) {
      Clipboard.setString(qrValue);
      Alert.alert("Copied", "Emergency link copied to clipboard");
    }
  };

  const handleShareLink = async () => {
    if (qrValue) {
      try {
        await Share.share({
          message: `My Emergency Medical Record (Password protected): ${qrValue}`,
          title: "Emergency Medical Record",
        });
      } catch (error) {
        Alert.alert("Error", "Could not share link");
      }
    }
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const uri = await generateLocalPDF();
      Alert.alert("PDF Generated", "What would you like to do?", [
        { text: "Share", onPress: () => Share.share({ url: uri }) },
        { text: "OK", style: "cancel" },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#C54242" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#2E75B6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMERGENCY CARD</Text>
        <TouchableOpacity onPress={handleDownloadPDF}>
          <MaterialCommunityIcons name="download" size={28} color="#2E75B6" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Warning Card */}
        <View style={styles.warningCard}>
          <MaterialCommunityIcons
            name="shield-check"
            size={24}
            color="#059669"
          />
          <Text style={styles.warningText}>
            This card is password-protected. Only authorized medical personnel
            can access your full records.
          </Text>
        </View>

        {/* QR Code Section */}
        {qrValue ? (
          <View style={styles.qrSection}>
            <Text style={styles.qrTitle}>Scan for Emergency Access</Text>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={200}
                backgroundColor="white"
                color="#1E293B"
              />
            </View>
            <Text style={styles.qrInstructions}>
              Scan this QR code in case of emergency.{"\n"}
              Password required to view records.
            </Text>

            <View style={styles.qrActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCopyLink}
              >
                <MaterialCommunityIcons
                  name="content-copy"
                  size={20}
                  color="#2E75B6"
                />
                <Text style={styles.actionText}>Copy Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleShareLink}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={20}
                  color="#2E75B6"
                />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="qrcode-off"
              size={64}
              color="#CBD5E1"
            />
            <Text style={styles.emptyText}>No active emergency link</Text>
            <Text style={styles.emptySub}>
              Go to Settings to generate a secure emergency card
            </Text>
          </View>
        )}

        {/* Preview Card */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Card Preview</Text>

          <View style={styles.cardPreview}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons
                name="medical-bag"
                size={32}
                color="white"
              />
              <Text style={styles.cardHeaderText}>Arogyasathi Emergency</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.previewName}>
                {userData?.fullName?.toUpperCase() || "PATIENT"}
              </Text>
              <Text style={styles.previewId}>
                ID: {userData?.patientId || "N/A"} • PIN:{" "}
                {cardData?.pin || "----"}
              </Text>

              <View style={styles.previewVitals}>
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalLabel}>Blood</Text>
                  <Text style={styles.vitalValue}>
                    {cardData?.bloodGroup || "?"}
                  </Text>
                </View>
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalLabel}>Age</Text>
                  <Text style={styles.vitalValue}>{cardData?.age || "--"}</Text>
                </View>
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalLabel}>Weight</Text>
                  <Text style={styles.vitalValue}>
                    {cardData?.weight ? `${cardData.weight}kg` : "--"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <MaterialCommunityIcons name="lock" size={20} color="#64748B" />
          <Text style={styles.securityText}>
            • Link expires in 30 days{"\n"}• Password required for access{"\n"}•
            Access attempts are logged{"\n"}• No password stored in PDF
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  content: { padding: 20 },
  warningCard: {
    flexDirection: "row",
    backgroundColor: "#ECFDF5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#065F46",
    lineHeight: 20,
  },
  qrSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 16,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  qrInstructions: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  qrActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionText: { color: "#2E75B6", fontWeight: "700", fontSize: 14 },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 8,
    textAlign: "center",
  },
  previewSection: { marginBottom: 20 },
  previewTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardPreview: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    backgroundColor: "#C54242",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  cardHeaderText: {
    color: "white",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1,
  },
  cardBody: { padding: 20 },
  previewName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 4,
  },
  previewId: { fontSize: 12, color: "#64748B", marginBottom: 16 },
  previewVitals: { flexDirection: "row", gap: 20 },
  vitalItem: { alignItems: "center" },
  vitalLabel: {
    fontSize: 10,
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  vitalValue: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
  securityInfo: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  securityText: { flex: 1, fontSize: 13, color: "#64748B", lineHeight: 20 },
});
