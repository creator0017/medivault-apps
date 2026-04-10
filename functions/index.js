const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const nodemailer = require("nodemailer");

const gmailUser = process.env.GMAIL_USER || functions.config().gmail?.user;
const gmailPass = process.env.GMAIL_PASS || functions.config().gmail?.pass;

if (!gmailUser || !gmailPass) {
  console.error("FATAL: GMAIL_USER or GMAIL_PASS not configured.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: gmailUser, pass: gmailPass },
});

// Single function that generates both OTPs and sends ONE combined email
exports.sendBothOTPs = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { phone, uid, email, fullName } = data;
    if (!email || !uid) {
      throw new functions.https.HttpsError("invalid-argument", "Email and UID required");
    }

    try {
      const phoneOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

      await admin.firestore().collection("users").doc(uid).set(
        {
          phoneOtp,
          phoneOtpExpires: expiry,
          emailOtp,
          emailOtpExpires: expiry,
        },
        { merge: true }
      );

      await transporter.sendMail({
        from: `"Arogyasathi" <${gmailUser}>`,
        to: email,
        subject: "Your Arogyasathi Verification Codes",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #E2E8F0;border-radius:12px;">
            <h2 style="color:#2E75B6;margin-bottom:4px;">Arogyasathi</h2>
            <p style="color:#64748B;margin-top:0;">Your Health, Securely Managed</p>
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:16px 0;" />
            <p>Hello <strong>${fullName || "there"}</strong>,</p>
            <p>Here are your two verification codes. Enter each in the correct box.</p>

            <div style="background:#F0F7FF;border-radius:10px;padding:16px;margin:16px 0;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748B;font-weight:600;letter-spacing:1px;">PHONE VERIFICATION CODE</p>
              <h1 style="margin:0;letter-spacing:12px;color:#2E75B6;font-size:36px;">${phoneOtp}</h1>
              <p style="margin:8px 0 0;font-size:12px;color:#94A3B8;">Enter this in the <strong>Phone Verification</strong> box</p>
            </div>

            <div style="background:#F0FFF4;border-radius:10px;padding:16px;margin:16px 0;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748B;font-weight:600;letter-spacing:1px;">EMAIL VERIFICATION CODE</p>
              <h1 style="margin:0;letter-spacing:12px;color:#10B981;font-size:36px;">${emailOtp}</h1>
              <p style="margin:8px 0 0;font-size:12px;color:#94A3B8;">Enter this in the <strong>Email Verification</strong> box</p>
            </div>

            <p style="color:#94A3B8;font-size:12px;">Both codes are valid for <strong>10 minutes</strong>. Do not share them with anyone.</p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error("sendBothOTPs error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// Keep old functions for resend (individual resend still needs separate calls)
exports.sendPhoneOTP = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { phone, uid, email, fullName } = data;
    if (!phone || !email) {
      throw new functions.https.HttpsError("invalid-argument", "Phone and email required");
    }

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await admin.firestore().collection("users").doc(uid).set(
        {
          phoneOtp: otp,
          phoneOtpExpires: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
        },
        { merge: true }
      );

      await transporter.sendMail({
        from: `"Arogyasathi" <${gmailUser}>`,
        to: email,
        subject: "Arogyasathi — Phone Verification Code",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
            <h2 style="color:#2E75B6;">Arogyasathi</h2>
            <p>Hello ${fullName || ""},</p>
            <p>Your <strong>Phone Verification Code</strong> is:</p>
            <div style="background:#F0F7FF;border-radius:10px;padding:16px;margin:16px 0;text-align:center;">
              <h1 style="letter-spacing:12px;color:#2E75B6;font-size:36px;margin:0;">${otp}</h1>
            </div>
            <p>Enter this in the <strong>Phone Verification</strong> box.</p>
            <p style="color:#94A3B8;font-size:12px;">Valid for 10 minutes.</p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error("sendPhoneOTP error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// ─── EMERGENCY CARD FUNCTIONS ────────────────────────────────────────────────

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const cors = require("cors")({ origin: true });

// Create a secure, password-protected emergency share link (30-day expiry)
exports.createEmergencyShare = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const { password } = data;
  const userId = context.auth.uid;

  const token = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);

  const now = admin.firestore.Timestamp.now();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await admin.firestore().collection("emergencyShares").doc(token).set({
    userId,
    createdAt: now,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    accessCount: 0,
    accessLog: [],
    passwordHash,
    isActive: true,
  });

  await admin.firestore().collection("users").doc(userId).update({
    "emergencyCard.lastShareToken": token,
    "emergencyCard.lastShareCreated": now,
  });

  return {
    token,
    shareUrl: `https://medvault-d2526.web.app/emergency/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
});

// Verify the share password and return a 5-minute signed PDF URL
exports.verifyEmergencyAccess = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { token, password } = req.body;

    try {
      const shareDoc = await admin.firestore().collection("emergencyShares").doc(token).get();

      if (!shareDoc.exists) {
        return res.status(404).json({ error: "Invalid or expired link" });
      }

      const shareData = shareDoc.data();

      if (shareData.expiresAt.toMillis() < Date.now() || !shareData.isActive) {
        return res.status(403).json({ error: "Link has expired" });
      }

      // Rate-limit: max 3 failed attempts per 15 minutes
      const recentFailed = shareData.accessLog.filter(
        (log) => log.timestamp.toMillis() > Date.now() - 15 * 60 * 1000 && !log.success
      );
      if (recentFailed.length >= 3) {
        return res.status(429).json({ error: "Too many failed attempts. Please try again later." });
      }

      const isValid = await bcrypt.compare(password, shareData.passwordHash);

      const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];

      await shareDoc.ref.update({
        accessLog: admin.firestore.FieldValue.arrayUnion({
          timestamp: admin.firestore.Timestamp.now(),
          ipAddress,
          userAgent,
          success: isValid,
        }),
        accessCount: admin.firestore.FieldValue.increment(1),
      });

      if (!isValid) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      const pdfToken = crypto.randomBytes(16).toString("hex");
      const pdfUrl = await generateAndStorePDF(shareData.userId, pdfToken);

      await sendAccessNotification(shareData.userId, ipAddress);

      return res.json({ success: true, pdfUrl, expiresIn: "5 minutes" });
    } catch (error) {
      console.error("Verification error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Build a PDF from Firestore data, upload to Storage with a 5-min signed URL
async function generateAndStorePDF(userId, tempToken) {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  const cardDoc = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("emergencyCard")
    .doc("data")
    .get();

  if (!userDoc.exists) throw new Error("User not found");

  const userData = userDoc.data();
  const cardData = cardDoc.exists ? cardDoc.data() : {};

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Header banner
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.77, 0.26, 0.26) });
  page.drawText("EMERGENCY MEDICAL RECORD", { x: 50, y: height - 45, size: 18, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("SHARE WITH FIRST RESPONDERS", { x: 50, y: height - 65, size: 10, font: regularFont, color: rgb(1, 0.9, 0.9) });

  // Main card background
  page.drawRectangle({ x: 40, y: height - 280, width: width - 80, height: 180, color: rgb(0.85, 0.35, 0.35) });

  page.drawText("Arogyasathi", { x: 60, y: height - 115, size: 12, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText((userData.fullName || "UNKNOWN").toUpperCase(), { x: 60, y: height - 160, size: 24, font: boldFont, color: rgb(1, 1, 1) });

  let yPos = height - 200;
  page.drawText(`Age: ${cardData.age || "--"} years`, { x: 60, y: yPos, size: 11, font: regularFont, color: rgb(1, 1, 1) });
  page.drawText(`PIN: ${cardData.pin || "----"}`, { x: 200, y: yPos, size: 11, font: regularFont, color: rgb(1, 1, 1) });
  yPos -= 20;
  page.drawText(`Height: ${cardData.height || "--"} cm`, { x: 60, y: yPos, size: 11, font: regularFont, color: rgb(1, 1, 1) });
  page.drawText(`Weight: ${cardData.weight || "--"} kg`, { x: 200, y: yPos, size: 11, font: regularFont, color: rgb(1, 1, 1) });

  // Blood group badge
  page.drawCircle({ x: width - 100, y: height - 190, radius: 35, color: rgb(1, 0.95, 0.95) });
  page.drawText(cardData.bloodGroup || "N/A", { x: width - 125, y: height - 198, size: 20, font: boldFont, color: rgb(0.77, 0.26, 0.26) });
  page.drawText("BLOOD GROUP", { x: width - 130, y: height - 165, size: 8, font: regularFont, color: rgb(1, 1, 1) });

  // Sections helper
  const drawSection = (title, contentLines, startY) => {
    page.drawText(title, { x: 50, y: startY, size: 14, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    return startY;
  };

  // Medical Conditions
  yPos = height - 310;
  drawSection("MEDICAL CONDITIONS", [], yPos);
  yPos -= 30;
  const conditions = cardData.conditions || [];
  if (conditions.length > 0) {
    page.drawText("Condition", { x: 60, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Details", { x: 250, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("History", { x: 430, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    yPos -= 20;
    conditions.forEach((c) => {
      page.drawText(c.title || "", { x: 60, y: yPos, size: 10, font: regularFont });
      page.drawText(c.subtitle || "", { x: 250, y: yPos, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(c.history || "", { x: 430, y: yPos, size: 9, font: italicFont, color: rgb(0.5, 0.5, 0.5) });
      yPos -= 15;
    });
  } else {
    page.drawText("No conditions recorded", { x: 60, y: yPos, size: 10, font: italicFont, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 20;
  }

  // Medications
  yPos -= 20;
  drawSection("CURRENT MEDICATIONS", [], yPos);
  yPos -= 30;
  const medications = cardData.medications || [];
  if (medications.length > 0) {
    page.drawText("Medication", { x: 60, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Dosage", { x: 300, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    yPos -= 20;
    medications.forEach((m) => {
      page.drawText(m.name || "", { x: 60, y: yPos, size: 10, font: regularFont });
      page.drawText(m.dose || "", { x: 300, y: yPos, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
      yPos -= 15;
    });
  } else {
    page.drawText("No medications recorded", { x: 60, y: yPos, size: 10, font: italicFont, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 20;
  }

  // Allergies
  yPos -= 20;
  drawSection("ALLERGIES", [], yPos);
  yPos -= 25;
  const allergies = cardData.allergies || [];
  if (allergies.length > 0) {
    allergies.forEach((a, idx) => {
      page.drawText(`• ${a.name}${a.severity ? ` (${a.severity})` : ""}`, {
        x: 60 + (idx % 2) * 250,
        y: yPos - Math.floor(idx / 2) * 20,
        size: 10, font: regularFont, color: rgb(0.77, 0.26, 0.26),
      });
    });
    yPos -= Math.ceil(allergies.length / 2) * 20 + 10;
  } else {
    page.drawText("No known allergies", { x: 60, y: yPos, size: 10, font: italicFont, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 20;
  }

  // Emergency Contacts
  yPos -= 20;
  drawSection("EMERGENCY CONTACTS", [], yPos);
  yPos -= 30;
  const contacts = cardData.contacts || [];
  if (contacts.length > 0) {
    page.drawText("Name", { x: 60, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Relation", { x: 200, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Phone", { x: 350, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    yPos -= 20;
    contacts.forEach((c) => {
      page.drawText(c.name || "", { x: 60, y: yPos, size: 10, font: regularFont });
      page.drawText(c.relation || "", { x: 200, y: yPos, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(c.phone || "", { x: 350, y: yPos, size: 10, font: boldFont, color: rgb(0.2, 0.6, 0.9) });
      yPos -= 15;
    });
  } else {
    page.drawText("No emergency contacts recorded", { x: 60, y: yPos, size: 10, font: italicFont, color: rgb(0.5, 0.5, 0.5) });
  }

  // Footer
  page.drawText("Generated from Arogyasathi Health Records", { x: 50, y: 40, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Last updated: ${new Date().toLocaleDateString("en-IN")}`, { x: 50, y: 28, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText("This document contains confidential medical information. Protected by password authentication.", { x: 50, y: 15, size: 7, font: regularFont, color: rgb(0.6, 0.6, 0.6) });

  const pdfBytes = await pdfDoc.save();

  const bucket = admin.storage().bucket();
  const fileName = `emergency/temp_${tempToken}.pdf`;
  const file = bucket.file(fileName);

  await file.save(Buffer.from(pdfBytes), {
    metadata: { contentType: "application/pdf" },
    validation: false,
  });

  // Auto-delete after 5 minutes
  setTimeout(async () => {
    try { await file.delete(); } catch (e) { /* already deleted */ }
  }, 300000);

  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 300000 });
  return url;
}

// Send FCM notification + log to accessLogs when emergency card is viewed
async function sendAccessNotification(userId, ipAddress) {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  const fcmToken = userDoc.data()?.fcmToken;

  if (fcmToken) {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: "Emergency Card Accessed",
        body: `Your emergency medical card was accessed on ${new Date().toLocaleString("en-IN")} from IP: ${ipAddress}`,
      },
      data: { type: "emergency_access", timestamp: new Date().toISOString() },
    });
  }

  await admin.firestore().collection("users").doc(userId).collection("accessLogs").add({
    type: "emergency_card_viewed",
    timestamp: admin.firestore.Timestamp.now(),
    ipAddress,
    userAgent: "Web Browser",
  });
}

// Scheduled daily cleanup of expired share tokens
exports.cleanupExpiredShares = functions.pubsub.schedule("0 0 * * *").onRun(async () => {
  const expired = await admin.firestore()
    .collection("emergencyShares")
    .where("expiresAt", "<", admin.firestore.Timestamp.now())
    .where("isActive", "==", true)
    .get();

  const batch = admin.firestore().batch();
  expired.docs.forEach((doc) => batch.update(doc.ref, { isActive: false }));
  await batch.commit();
  console.log(`Deactivated ${expired.size} expired shares`);
});

// ─── EMAIL OTP FUNCTIONS ──────────────────────────────────────────────────────

exports.sendEmailOTP = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { email, fullName, uid } = data;

    if (!email || !email.includes("@")) {
      throw new functions.https.HttpsError("invalid-argument", "Valid email required");
    }

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await admin.firestore().collection("users").doc(uid).set(
        {
          emailOtp: otp,
          emailOtpExpires: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
        },
        { merge: true }
      );

      await transporter.sendMail({
        from: `"Arogyasathi" <${gmailUser}>`,
        to: email,
        subject: "Arogyasathi — Email Verification Code",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
            <h2 style="color:#2E75B6;">Arogyasathi</h2>
            <p>Hello ${fullName || ""},</p>
            <p>Your <strong>Email Verification Code</strong> is:</p>
            <div style="background:#F0FFF4;border-radius:10px;padding:16px;margin:16px 0;text-align:center;">
              <h1 style="letter-spacing:12px;color:#10B981;font-size:36px;margin:0;">${otp}</h1>
            </div>
            <p>Enter this in the <strong>Email Verification</strong> box.</p>
            <p style="color:#94A3B8;font-size:12px;">Valid for 10 minutes.</p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error("sendEmailOTP error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
