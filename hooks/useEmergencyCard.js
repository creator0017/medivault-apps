import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { db, storage } from "../firebaseConfig";

export const useEmergencyCard = (userId) => {
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoFillData, setAutoFillData] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);

  // Fetch emergency card data
  const fetchCardData = useCallback(async () => {
    if (!userId) return;

    try {
      const cardRef = doc(db, "users", userId, "emergencyCard", "data");
      const cardSnap = await getDoc(cardRef);

      if (cardSnap.exists()) {
        const data = cardSnap.data();
        setCardData(data);

        // Restore active share URL from emergencyShares collection
        if (data.lastShareToken) {
          try {
            const shareRef = doc(db, "emergencyShares", data.lastShareToken);
            const shareSnap = await getDoc(shareRef);
            if (shareSnap.exists()) {
              const share = shareSnap.data();
              if (share.isActive && share.expiresAt?.toMillis() > Date.now()) {
                setShareUrl(`https://medvault-d2526.web.app/emergency/${data.lastShareToken}`);
                // back-fill pdfUrl if old share stored shareUrl instead
                if (!share.pdfUrl && share.shareUrl) {
                  await updateDoc(shareRef, { pdfUrl: share.shareUrl });
                }
              }
            }
          } catch (_) { /* non-fatal */ }
        }
      } else {
        // Initialize empty card
        const emptyData = {
          bloodGroup: "",
          height: "",
          weight: "",
          pin: Math.floor(1000 + Math.random() * 9000).toString(), // Random 4-digit
          age: "",
          medications: [],
          allergies: [],
          conditions: [],
          contacts: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(cardRef, emptyData);
        setCardData(emptyData);
      }
    } catch (error) {
      console.error("Error fetching card:", error);
      Alert.alert("Error", "Failed to load emergency card");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Auto-fill from lab reports
  const autoFillFromReports = useCallback(async () => {
    if (!userId) return { conditions: [], aiData: {}, hasUploadedReports: false };

    // ── 1. Try latest AI analysis from aiAnalyses collection ──────────────────
    let aiData = {
      bloodGroup: "",
      age: "",
      medications: [],
      allergies: [],
      conditions: [],
    };
    let hasAiAnalysis = false;

    try {
      const aiAnalysisRef = collection(db, "users", userId, "aiAnalyses");
      const aiQuery = query(aiAnalysisRef, orderBy("analyzedAt", "desc"), limit(1));
      const aiSnapshot = await getDocs(aiQuery);
      if (!aiSnapshot.empty) {
        hasAiAnalysis = true;
        const latestAi = aiSnapshot.docs[0].data();

        aiData.bloodGroup = latestAi.bloodGroup || "";
        aiData.age = latestAi.age ? String(latestAi.age).replace(/\D.*/, "") : "";

        if (Array.isArray(latestAi.conditions) && latestAi.conditions.length > 0) {
          aiData.conditions = latestAi.conditions.map((c, idx) => ({
            id: `ai_cond_${idx}`,
            title: c.title || c.name || String(c) || "Condition",
            subtitle: c.subtitle || c.description || "",
            history: c.history || "Detected from uploaded lab report",
            type: "chart-line",
            isAutoFilled: true,
          }));
        }
        if (Array.isArray(latestAi.medications) && latestAi.medications.length > 0) {
          aiData.medications = latestAi.medications.map((med, idx) => ({
            id: `ai_med_${idx}`,
            name: typeof med === "string" ? med : med.name || String(med),
            dose: med.dose || med.dosage || "As prescribed",
          }));
        }
        if (Array.isArray(latestAi.allergies) && latestAi.allergies.length > 0) {
          aiData.allergies = latestAi.allergies.map((a, idx) => ({
            id: `ai_allergy_${idx}`,
            name: typeof a === "string" ? a : a.name || String(a),
            severity: a.severity || "Check with doctor",
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching AI analysis:", error);
    }

    // ── 2. Fallback: check users.emergency.* (written on manual save) ─────────
    if (!hasAiAnalysis) {
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          const em = uData.emergency || {};
          if (em.autoBloodGroup) aiData.bloodGroup = em.autoBloodGroup;
          if (em.autoAge) aiData.age = String(em.autoAge);
          if (Array.isArray(em.autoMedications) && em.autoMedications.length > 0) {
            hasAiAnalysis = true;
            aiData.medications = em.autoMedications;
          }
          if (Array.isArray(em.autoAllergies) && em.autoAllergies.length > 0) {
            hasAiAnalysis = true;
            aiData.allergies = em.autoAllergies;
          }
          if (Array.isArray(em.autoConditions) && em.autoConditions.length > 0) {
            hasAiAnalysis = true;
            aiData.conditions = em.autoConditions;
          }
        }
      } catch (error) {
        console.error("Error fetching emergency user data:", error);
      }
    }

    // ── 3. Check if user has uploaded reports (even if not analyzed yet) ──────
    let hasUploadedReports = false;
    let latestReportUrl = null;
    let latestReportMime = null;
    try {
      const reportsRef = collection(db, "users", userId, "reports");
      const rq = query(reportsRef, orderBy("uploadedAt", "desc"), limit(1));
      const rSnap = await getDocs(rq);
      if (!rSnap.empty) {
        hasUploadedReports = true;
        const r = rSnap.docs[0].data();
        latestReportUrl = r.url || null;
        latestReportMime = r.type === "PDF" ? "application/pdf" : "image/jpeg";
      }
    } catch (error) {
      console.error("Error checking uploaded reports:", error);
    }

    setAutoFillData({ ...aiData });

    return {
      conditions: aiData.conditions,
      aiData,
      hasAiAnalysis,
      hasUploadedReports,
      latestReportUrl,
      latestReportMime,
    };
  }, [userId]);

  // Apply auto-fill to card
  // Returns: "filled" | "no_analysis" | "no_reports" | "already_filled"
  const applyAutoFill = async () => {
    const result = await autoFillFromReports();
    const { aiData = {}, hasAiAnalysis, hasUploadedReports, latestReportUrl, latestReportMime } = result || {};

    // No AI analysis done yet — but tell caller if reports exist so they can guide user
    if (!hasAiAnalysis) {
      return hasUploadedReports
        ? { status: "no_analysis", latestReportUrl, latestReportMime }
        : { status: "no_reports" };
    }

    const aiMedications = Array.isArray(aiData.medications) ? aiData.medications : [];
    const aiAllergies = Array.isArray(aiData.allergies) ? aiData.allergies : [];
    const aiConditions = Array.isArray(aiData.conditions) ? aiData.conditions : [];
    const updates = {};

    if (aiData.bloodGroup && (!cardData?.bloodGroup || cardData.bloodGroup === "")) {
      updates.bloodGroup = aiData.bloodGroup;
    }
    if (aiData.age && (!cardData?.age || cardData.age === "" || cardData.age === 0)) {
      updates.age = aiData.age;
    }
    if (aiMedications.length > 0 && (!cardData?.medications || cardData.medications.length === 0)) {
      updates.medications = aiMedications;
    }
    if (aiAllergies.length > 0 && (!cardData?.allergies || cardData.allergies.length === 0)) {
      updates.allergies = aiAllergies;
    }
    if (aiConditions.length > 0) {
      updates.conditions = [
        ...(cardData?.conditions || []).filter((c) => !c.isAutoFilled),
        ...aiConditions,
      ];
    }

    if (Object.keys(updates).length > 0) {
      const cardRef = doc(db, "users", userId, "emergencyCard", "data");
      await updateDoc(cardRef, {
        ...updates,
        lastAutoFill: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await fetchCardData();
      return { status: "filled" };
    }
    return { status: "already_filled" };
  };

  // Update card data
  const updateCard = async (updates) => {
    try {
      const cardRef = doc(db, "users", userId, "emergencyCard", "data");
      await updateDoc(cardRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await fetchCardData();
    } catch (error) {
      console.error("Update error:", error);
      throw error;
    }
  };

  // Generate local PDF (for preview/download)
  const generateLocalPDF = async (userData) => {
    const html = generatePDFHTML(cardData, userData);
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  };

  // Upload PDF to Firebase Storage and return public URL for QR
  const getPublicPDFUrl = async (userData) => {
    try {
      const uri = await generateLocalPDF(userData);
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `users/${userId}/emergency/LiveCard.pdf`);
      await uploadBytes(storageRef, blob, { contentType: "application/pdf" });
      const publicUrl = await getDownloadURL(storageRef);
      return publicUrl;
    } catch (error) {
      console.error("PDF Upload Error:", error);
      return null;
    }
  };

  // Create secure share link — uploads PDF, returns PIN-protected web URL
  const createShareLink = async (userData, newPin) => {
    try {
      // If a new PIN is provided, update the card PIN first
      if (newPin && newPin !== cardData?.pin) {
        const cardRef = doc(db, "users", userId, "emergencyCard", "data");
        await updateDoc(cardRef, { pin: newPin, updatedAt: serverTimestamp() });
        setCardData((prev) => ({ ...prev, pin: newPin }));
      }

      const activePin = newPin || cardData?.pin;

      // Upload the PDF and get a direct Firebase Storage URL
      const pdfUrl = await getPublicPDFUrl(userData);
      if (!pdfUrl) throw new Error("Failed to upload emergency card PDF");

      // Store the share record in Firestore (PIN is verified by the web page)
      const token = `share_${userId}_${Date.now()}`;
      const shareRef = doc(db, "emergencyShares", token);
      await setDoc(shareRef, {
        userId,
        pdfUrl,
        pin: activePin || "",
        isActive: true,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        accessLog: [],
        accessCount: 0,
      });

      // Save token to user's emergency card
      const cardRef = doc(db, "users", userId, "emergencyCard", "data");
      await updateDoc(cardRef, { lastShareToken: token, updatedAt: serverTimestamp() });

      // Use the PIN-protected web URL — this page asks for PIN before showing the PDF
      const webUrl = `https://medvault-d2526.web.app/emergency/${token}`;
      setShareUrl(webUrl);
      return { shareUrl: webUrl, token, pin: activePin };
    } catch (error) {
      console.error("Share creation error:", error);
      throw error;
    }
  };

  // Share PDF locally
  const sharePDF = async () => {
    const uri = await generateLocalPDF();
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Emergency Medical Record",
      UTI: "com.adobe.pdf",
    });
  };

  useEffect(() => {
    fetchCardData();
  }, [fetchCardData]);

  return {
    cardData,
    loading,
    autoFillData,
    shareUrl,
    fetchCardData,
    autoFillFromReports,
    applyAutoFill,
    updateCard,
    generateLocalPDF,
    getPublicPDFUrl,
    createShareLink,
    sharePDF,
  };
};

// HTML Generator for local PDF
const generatePDFHTML = (cardData, userData) => {
  const conditions = cardData?.conditions || [];
  const meds = cardData?.medications || [];
  const allergies = cardData?.allergies || [];
  const contacts = cardData?.contacts || [];
  const patientName = userData?.fullName || cardData?.name || "Patient";
  const patientId = userData?.patientId || cardData?.patientId || "N/A";
  const phone = userData?.phone || userData?.phoneNumber || "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B; background: #F8FAFC; margin: 0; padding: 20px; }
    .page { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #C54242, #7F1D1D); color: white; padding: 20px; border-radius: 12px; margin: -30px -30px 20px -30px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
    .header p { margin: 5px 0 0; opacity: 0.9; font-size: 12px; }
    .main-card { background: #C54242; color: white; padding: 25px; border-radius: 16px; margin-bottom: 24px; position: relative; }
    .patient-name { font-size: 28px; font-weight: 900; margin-bottom: 15px; }
    .vitals { display: flex; gap: 20px; margin-top: 15px; }
    .vital { text-align: center; }
    .vital-label { font-size: 10px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
    .vital-value { font-size: 18px; font-weight: 900; }
    .blood-badge { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.9); color: #C54242; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14px; font-weight: 900; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; border-bottom: 2px solid #F1F5F9; padding-bottom: 8px; }
    .item { padding: 10px 0; border-bottom: 1px solid #F1F5F9; }
    .item-title { font-weight: 700; color: #1E293B; }
    .item-sub { font-size: 13px; color: #64748B; }
    .item-history { font-size: 11px; color: #94A3B8; font-style: italic; margin-top: 4px; }
    .allergy-tag { display: inline-block; background: #FEE2E2; color: #991B1B; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-right: 8px; margin-bottom: 8px; }
    .contact-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F1F5F9; }
    .contact-name { font-weight: 700; }
    .contact-phone { color: #2E75B6; font-weight: 700; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #F1F5F9; font-size: 10px; color: #94A3B8; text-align: center; }
    .warning { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px; margin-top: 20px; font-size: 11px; color: #991B1B; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>🚨 EMERGENCY MEDICAL RECORD</h1>
      <p>SHARE WITH FIRST RESPONDERS • Arogyasathi</p>
    </div>
    
    <div class="main-card">
      <div class="blood-badge">${cardData?.bloodGroup || "?"}</div>
      <div class="patient-name">${patientName}</div>
      <div style="opacity: 0.9; margin-bottom: 15px;">ID: ${patientId}${phone ? " • " + phone : ""}</div>
      <div class="vitals">
        <div class="vital">
          <div class="vital-label">Age</div>
          <div class="vital-value">${cardData?.age || "--"} Y</div>
        </div>
        <div class="vital">
          <div class="vital-label">Height</div>
          <div class="vital-value">${cardData?.height || "--"} cm</div>
        </div>
        <div class="vital">
          <div class="vital-label">Weight</div>
          <div class="vital-value">${cardData?.weight || "--"} kg</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🩺 Medical Conditions</div>
      ${
        conditions.length
          ? conditions
              .map(
                (c) => `
        <div class="item">
          <div class="item-title">${c.title}</div>
          <div class="item-sub">${c.subtitle}</div>
          <div class="item-history">${c.history}</div>
        </div>
      `,
              )
              .join("")
          : '<div class="item" style="color: #94A3B8;">No conditions recorded</div>'
      }
    </div>

    <div class="section">
      <div class="section-title">💊 Current Medications</div>
      ${
        meds.length
          ? meds
              .map(
                (m) => `
        <div class="item">
          <div class="item-title">${m.name}</div>
          <div class="item-sub">${m.dose}</div>
        </div>
      `,
              )
              .join("")
          : '<div class="item" style="color: #94A3B8;">No medications recorded</div>'
      }
    </div>

    <div class="section">
      <div class="section-title">⚠️ Allergies</div>
      <div>
        ${
          allergies.length
            ? allergies
                .map(
                  (a) => `
          <span class="allergy-tag">${a.name}${a.severity ? ` (${a.severity})` : ""}</span>
        `,
                )
                .join("")
            : '<span style="color: #94A3B8;">No known allergies</span>'
        }
      </div>
    </div>

    <div class="section">
      <div class="section-title">📞 Emergency Contacts</div>
      ${
        contacts.length
          ? contacts
              .map(
                (c) => `
        <div class="contact-row">
          <div>
            <div class="contact-name">${c.name}</div>
            <div style="font-size: 12px; color: #64748B;">${c.relation}</div>
          </div>
          <div class="contact-phone">${c.phone}</div>
        </div>
      `,
              )
              .join("")
          : '<div style="color: #94A3B8; padding: 10px 0;">No contacts recorded</div>'
      }
    </div>

    <div class="footer">
      <div>Generated from Arogyasathi Health Records</div>
      <div>Last updated: ${new Date().toLocaleDateString("en-IN")}</div>
      <div style="margin-top: 8px; font-size: 9px;">Protected by password authentication. For medical emergencies only.</div>
    </div>
    
    <div class="warning">
      <strong>Confidential:</strong> This document contains protected health information (PHI). Authorized personnel only.
    </div>
  </div>
</body>
</html>`;
};
