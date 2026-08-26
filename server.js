const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser for JSON & URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend serve karne ke liye
app.use(express.static(path.join(__dirname, "public")));

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Helper function to add delay between sends to prevent rate-limit spam flags
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST /send-mail
 * Body params:
 *  - senderName  -> Sender ka naam
 *  - senderEmail -> Gmail address
 *  - appPassword -> Gmail App Password
 *  - toEmail     -> Receivers list (string)
 *  - subject     -> Subject line
 *  - message     -> Body message
 */
app.post("/send-mail", async (req, res) => {
  const { senderName, senderEmail, appPassword, toEmail, subject, message } = req.body;

  if (!senderEmail || !appPassword || !toEmail || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: "Missing fields. Required: senderEmail, appPassword, toEmail, subject, message",
    });
  }

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
      error: `Ye emails invalid lag rahe hain: ${invalidEmails.join(", ")}`,
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword,
      },
    });

    const results = [];

    // Spam filters se bachne ke liye sequential processing with 1-second delay
    for (const recipient of recipients) {
      try {
        const info = await transporter.sendMail({
          from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
          to: recipient,
          subject: subject,
          text: message, // Plain text content for compatibility
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <p>${message.replace(/\n/g, "<br/>")}</p>
            </div>
          `,
          headers: {
            "X-Priority": "3", // Normal Priority
            "X-Mailer": "Nodemailer",
          },
        });

        results.push({ email: recipient, success: true, messageId: info.messageId });
      } catch (err) {
        results.push({ email: recipient, success: false, error: err.message });
      }

      // Spam flags avoid karne ke liye 1 second ka gap
      await sleep(1000);
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return res.json({
      success: successCount > 0,
      totalSent: successCount,
      totalFailed: failedCount,
      details: results,
      message:
        failedCount === 0
          ? `Email successfully sent to ${successCount} recipient(s)!`
          : `${successCount} sent, ${failedCount} failed. Check details.`,
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
