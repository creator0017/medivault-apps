const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const nodemailer = require("nodemailer");

// Read Gmail credentials from Firebase environment config
// Set with: firebase functions:secrets:set GMAIL_USER GMAIL_PASS
const gmailUser = process.env.GMAIL_USER || functions.config().gmail?.user;
const gmailPass = process.env.GMAIL_PASS || functions.config().gmail?.pass;

if (!gmailUser || !gmailPass) {
  console.error("FATAL: GMAIL_USER or GMAIL_PASS not configured. Run: firebase functions:config:set gmail.user=YOU@gmail.com gmail.pass=APP_PASSWORD");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
});

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
        subject: "Your MediVault Phone Verification Code",
        html: `
          <h2 style="color:#2E75B6">MediVault</h2>
          <p>Hello ${fullName || ""},</p>
          <p>Your <strong>Phone Verification Code</strong> is:</p>
          <h1 style="letter-spacing:8px;color:#1E293B">${otp}</h1>
          <p>Enter this code in the <strong>Phone Verification</strong> box.</p>
          <p style="color:#94A3B8">Valid for 10 minutes.</p>
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
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valid email required",
      );
    }

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            emailOtp: otp,
            emailOtpExpires: admin.firestore.Timestamp.fromMillis(
              Date.now() + 10 * 60 * 1000,
            ),
          },
          { merge: true },
        );

      await transporter.sendMail({
        from: `"MediVault" <${gmailUser}>`,
        to: email,
        subject: "Your MediVault Security Code",
        html: `<h2 style="color:#2E75B6">MediVault</h2><p>Hello ${fullName}</p><p>Your code is:</p><h1 style="letter-spacing:5px">${otp}</h1><p>Valid for 10 minutes.</p>`,
      });

      return { success: true };
    } catch (error) {
      console.error("Error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
