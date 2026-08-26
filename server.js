const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Email Sender</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 8px; }
        input, textarea { width: 100%; padding: 10px; margin-top: 8px; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Gmail Inbox Direct Sender</h2>
        <form id="mailForm">
          <label>Sender Name</label>
          <input type="text" id="senderName" placeholder="Your Name">

          <label>Sender Gmail</label>
          <input type="email" id="senderEmail" required placeholder="your.email@gmail.com">

          <label>App Password (16-digits)</label>
          <input type="password" id="appPassword" required placeholder="xxxx xxxx xxxx xxxx">

          <label>To Emails (Comma or Line separated)</label>
          <textarea id="toEmail" rows="3" required placeholder="user@gmail.com"></textarea>

          <label>Subject</label>
          <input type="text" id="subject" required placeholder="Subject">

          <label>Message</label>
          <textarea id="message" rows="4" required placeholder="Message body..."></textarea>

          <button type="submit" id="btn">Send Mails</button>
        </form>
        <p id="status"></p>
      </div>

      <script>
        document.getElementById("mailForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = document.getElementById("btn");
          const status = document.getElementById("status");

          btn.disabled = true;
          status.innerText = "Sending... Please wait (3s delay between mails applied)";

          const payload = {
            senderName: document.getElementById("senderName").value,
            senderEmail: document.getElementById("senderEmail").value,
            appPassword: document.getElementById("appPassword").value,
            toEmail: document.getElementById("toEmail").value,
            subject: document.getElementById("subject").value,
            message: document.getElementById("message").value
          };

          try {
            const res = await fetch("/send-mail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            status.innerText = data.message || data.error;
          } catch (err) {
            status.innerText = "Error sending request.";
          } finally {
            btn.disabled = false;
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.post("/send-mail", async (req, res) => {
  const { senderName, senderEmail, appPassword, toEmail, subject, message } = req.body;

  if (!senderEmail || !appPassword || !toEmail || !subject || !message) {
    return res.status(400).json({ success: false, error: "Missing fields." });
  }

  const recipients = toEmail
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && isValidEmail(e));

  if (recipients.length === 0) {
    return res.status(400).json({ success: false, error: "Valid email enter karein." });
  }

  try {
    // Explicit SMTP configuration with pooling disabled to maintain single-session authenticity
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL
      auth: {
        user: senderEmail,
        pass: appPassword.replace(/\s+/g, ""),
      },
    });

    const results = [];

    for (const recipient of recipients) {
      try {
        const info = await transporter.sendMail({
          // From header format explicitly matched with authenticated sender
          from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
          to: recipient,
          subject: subject,
          text: message, // Mandatory plain text version
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; font-size: 14px; color: #222222; line-height: 1.5;">
              <div>${message.replace(/\n/g, "<br/>")}</div>
            </body>
            </html>
          `,
          headers: {
            "X-Priority": "3",
            "X-MSMail-Priority": "Normal",
            "Importance": "Normal",
          },
        });

        results.push({ email: recipient, success: true, messageId: info.messageId });
      } catch (err) {
        results.push({ email: recipient, success: false, error: err.message });
      }

      // 3-second delay between individual deliveries to avoid rate-limit spam flagging
      await sleep(3000);
    }

    const successCount = results.filter((r) => r.success).length;
    return res.json({
      success: successCount > 0,
      message: `${successCount} mail(s) processed. Check receiving inbox.`,
      details: results,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
