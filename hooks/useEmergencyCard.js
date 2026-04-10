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
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { db, functions, storage } from "../firebaseConfig";

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
    if (!userId) return;

    try {
      const reportsRef = collection(db, "users", userId, "healthReports");
      const q = query(reportsRef, orderBy("testDate", "desc"), limit(10));
      const snapshot = await getDocs(q);

      const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const latestHbA1c = reports.find((r) => r.testType === "HbA1c");
      const latestFBS = reports.find((r) => r.testType === "FBS");
      const latestPPBS = reports.find((r) => r.testType === "PPBS");

      const newConditions = [];

      if (latestHbA1c) {
        const value = parseFloat(latestHbA1c.value);
        const severity =
          value >= 7.0 ? "Type 2 Diabetes (Active)" : "Pre-diabetes";
        newConditions.push({
          id: `auto_hba1c_${latestHbA1c.id}`,
          title: severity,
          subtitle: `HbA1c: ${latestHbA1c.value}%`,
          history: `Last tested: ${latestHbA1c.testDate?.toDate().toLocaleDateString("en-IN") || "Unknown"}`,
          type: "chart-line",
          isAutoFilled: true,
          sourceReportId: latestHbA1c.id,
        });
      }

      if (latestFBS) {
        newConditions.push({
          id: `auto_fbs_${latestFBS.id}`,
          title: "Fasting Blood Sugar",
          subtitle: `${latestFBS.value} mg/dL`,
          history: `Normal range: 70-100 mg/dL`,
          type: "water",
          isAutoFilled: true,
          sourceReportId: latestFBS.id,
        });
      }

      if (latestPPBS) {
        newConditions.push({
          id: `auto_ppbs_${latestPPBS.id}`,
          title: "Post-Meal Blood Sugar",
          subtitle: `${latestPPBS.value} mg/dL`,
          history: `Normal range: <140 mg/dL`,
          type: "water",
          isAutoFilled: true,
          sourceReportId: latestPPBS.id,
        });
      }

      // Fetch AI analysis data from user document
      let aiData = {};
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          aiData = {
            bloodGroup: userData.emergency?.autoBloodGroup || "",
            age: userData.emergency?.autoAge || "",
            medications: userData.emergency?.autoMedications || [],
            allergies: userData.emergency?.autoAllergies || [],
            conditions: userData.emergency?.autoConditions || [],
          };
        }
      } catch (error) {
        console.error("Error fetching AI data:", error);
      }

      // Fetch latest AI analysis from aiAnalyses collection
      try {
        const aiAnalysisRef = collection(db, "users", userId, "aiAnalyses");
        const aiQuery = query(aiAnalysisRef, orderBy("analyzedAt", "desc"), limit(1));
        const aiSnapshot = await getDocs(aiQuery);
        if (!aiSnapshot.empty) {
          const latestAi = aiSnapshot.docs[0].data();
          // Merge AI analysis data into aiData, preferring existing aiData fields
          if (!aiData.bloodGroup && latestAi.bloodGroup) aiData.bloodGroup = latestAi.bloodGroup;
          if (!aiData.age && latestAi.age) aiData.age = latestAi.age;
          // Transform conditions
          if (aiData.conditions.length === 0 && latestAi.conditions && latestAi.conditions.length > 0) {
            aiData.conditions = latestAi.conditions.map((c, idx) => ({
              id: `ai_cond_${idx}`,
              title: c.title || c.name || "Condition",
              subtitle: c.subtitle || c.description || "",
              history: c.history || "Detected from uploaded lab report",
              type: "chart-line",
            }));
          }
          // Transform medications
          if (aiData.medications.length === 0 && latestAi.medications && latestAi.medications.length > 0) {
            aiData.medications = latestAi.medications.map((med, idx) => ({
              id: `ai_med_${idx}`,
              name: typeof med === "string" ? med : med.name || med,
              dose: med.dose || med.dosage || "As prescribed",
            }));
          }
          // Transform allergies
          if (aiData.allergies.length === 0 && latestAi.allergies && latestAi.allergies.length > 0) {
            aiData.allergies = latestAi.allergies.map((a, idx) => ({
              id: `ai_allergy_${idx}`,
              name: typeof a === "string" ? a : a.name || a,
              severity: a.severity || "Check with doctor",
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching AI analysis:", error);
      }

      // Prepare autoFillData without overriding conditions
      const { conditions: aiConditions, ...aiDataWithoutConditions } = aiData;
      setAutoFillData({
        conditions: newConditions,
        lastCheckup: latestHbA1c?.testDate,
        lastLab: latestHbA1c?.labName,
        ...aiDataWithoutConditions,
      });

      return {
        conditions: newConditions,
        aiData,
        lastCheckup: latestHbA1c?.testDate,
        lastLab: latestHbA1c?.labName,
      };
    } catch (error) {
      console.error("Auto-fill error:", error);
      return { conditions: [], aiData: {} };
    }
  }, [userId]);

  // Apply auto-fill to card
  const applyAutoFill = async () => {
    const { conditions, aiData } = await autoFillFromReports();
    const updates = {};
    
    // Update conditions (merge with existing, replace auto-filled ones)
    if (conditions.length > 0) {
      updates.conditions = [
        ...(cardData?.conditions || []).filter((c) => !c.isAutoFilled),
        ...conditions,
      ];
    }
    
    // Update blood group if empty
    if (aiData.bloodGroup && (!cardData?.bloodGroup || cardData.bloodGroup === "")) {
      updates.bloodGroup = aiData.bloodGroup;
    }
    
    // Update age if empty
    if (aiData.age && (!cardData?.age || cardData.age === "")) {
      updates.age = aiData.age;
    }
    
    // Update medications if empty
    if (aiData.medications.length > 0 && (!cardData?.medications || cardData.medications.length === 0)) {
      updates.medications = aiData.medications;
    }
    
    // Update allergies if empty
    if (aiData.allergies.length > 0 && (!cardData?.allergies || cardData.allergies.length === 0)) {
      updates.allergies = aiData.allergies;
    }
    
    // Also update with AI conditions if no conditions from lab reports
    if (aiData.conditions.length > 0 && conditions.length === 0) {
      updates.conditions = [
        ...(cardData?.conditions || []).filter((c) => !c.isAutoFilled),
        ...aiData.conditions.map((cond, idx) => ({
          ...cond,
          id: `ai_cond_${idx}`,
          isAutoFilled: true,
        })),
      ];
    }
    
    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      const cardRef = doc(db, "users", userId, "emergencyCard", "data");
      await updateDoc(cardRef, {
        ...updates,
        lastAutoFill: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await fetchCardData();
      return true;
    }
    return false;
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
  const generateLocalPDF = async () => {
    const html = generatePDFHTML(cardData, autoFillData);
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  };

  // Upload PDF to Firebase Storage and return public URL for QR
  const getPublicPDFUrl = async () => {
    try {
      const uri = await generateLocalPDF();
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

  // Create secure share link
  const createShareLink = async (password) => {
    try {
      const createShare = httpsCallable(functions, "createEmergencyShare");
      const result = await createShare({ password });
      setShareUrl(result.data.shareUrl);
      return result.data;
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
const generatePDFHTML = (cardData, autoFillData) => {
  const conditions = cardData?.conditions || [];
  const meds = cardData?.medications || [];
  const allergies = cardData?.allergies || [];
  const contacts = cardData?.contacts || [];

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
      <div class="patient-name">${cardData?.name || "Patient"}</div>
      <div style="opacity: 0.9; margin-bottom: 15px;">ID: ${cardData?.patientId || "N/A"}</div>
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
