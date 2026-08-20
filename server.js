const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Static frontend (form) serve karne ke liye
app.use(express.static(path.join(__dirname, "public")));

/**
 * GET /send-mail
 * Query params:
 *  - senderName   -> Sender ka naam (From name)
 *  - senderEmail  -> Gmail address (jisse mail jayega)
 *  - appPassword  -> Gmail App Password (16 digit, normal password nahi)
 *  - toEmail      -> Receiver ka email
 *  - subject      -> Subject line
 *  - message      -> Mail body
 */
// Basic email format check
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

app.get("/send-mail", async (req, res) => {
  const { senderName, senderEmail, appPassword, toEmail, subject, message } = req.query;

  // Basic validation
  if (!senderEmail || !appPassword || !toEmail || !subject || !message) {
    return res.status(400).json({
      success: false,
      error:
        "Missing fields. Required: senderEmail, appPassword, toEmail, subject, message (senderName optional)",
    });
  }

  // toEmail me ek se zyada emails ho sakte hai, line by line (ya comma se bhi separated).
  // Frontend textarea se newline-separated string aayegi.
  const recipients = toEmail
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (recipients.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Kam se kam ek valid receiver email chahiye.",
    });
  }

  const invalidEmails = recipients.filter((e) => !isValidEmail(e));
  if (invalidEmails.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Ye emails invalid lag rahe hai: ${invalidEmails.join(", ")}`,
    });
  }

  try {
    // Gmail SMTP transporter, App Password ke sath
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword, // yahan normal gmail password nahi, App Password use hoga
      },
    });

    const info = await transporter.sendMail({
      from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
      to: senderEmail, // "to" me sirf sender ka apna email — recipients ek dusre ko nahi dikhenge
      bcc: recipients, // asli receivers yaha hidden rehte hai
      subject: subject,
      text: message,
      html: `<p>${message.replace(/\n/g, "<br/>")}</p>`,
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      totalSent: recipients.length,
      message: `Email successfully sent to ${recipients.length} recipient(s)!`,
    });
  } catch (err) {
    console.error("Mail send error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server chal raha hai: http://localhost:${PORT}`);
});
