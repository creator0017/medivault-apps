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
        from: `"MediVault" <${gmailUser}>`,
        to: email,
        subject: "Your MediVault Verification Codes",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #E2E8F0;border-radius:12px;">
            <h2 style="color:#2E75B6;margin-bottom:4px;">MediVault</h2>
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
        from: `"MediVault" <${gmailUser}>`,
        to: email,
        subject: "MediVault — Phone Verification Code",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
            <h2 style="color:#2E75B6;">MediVault</h2>
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
        from: `"MediVault" <${gmailUser}>`,
        to: email,
        subject: "MediVault — Email Verification Code",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
            <h2 style="color:#2E75B6;">MediVault</h2>
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
