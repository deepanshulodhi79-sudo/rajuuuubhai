const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Human-like natural delay (1.5s to 3s) to bypass rapid trigger limits
const smartDelay = () => {
  const ms = Math.floor(Math.random() * 1500) + 1500;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Anti-Spam Gmail Sender</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        input, textarea { width: 100%; padding: 10px; margin-top: 8px; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #218838; }
        #status { margin-top: 15px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Anti-Spam Inbox Sender</h2>
        <form id="mailForm">
          <label>Sender Name</label>
          <input type="text" id="senderName" placeholder="Your Name">

          <label>Sender Gmail</label>
          <input type="email" id="senderEmail" required placeholder="your.email@gmail.com">

          <label>App Password (16-digits)</label>
          <input type="password" id="appPassword" required placeholder="xxxx xxxx xxxx xxxx">

          <label>To Emails (Comma or Line separated)</label>
          <textarea id="toEmail" rows="3" required placeholder="user1@gmail.com, user2@gmail.com"></textarea>

          <label>Subject</label>
          <input type="text" id="subject" required placeholder="Subject line">

          <label>Message</label>
          <textarea id="message" rows="4" required placeholder="Message content..."></textarea>

          <button type="submit" id="btn">Send to Inbox</button>
        </form>
        <p id="status"></p>
      </div>

      <script>
        document.getElementById("mailForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = document.getElementById("btn");
          const status = document.getElementById("status");

          btn.disabled = true;
          status.style.color = "#333";
          status.innerText = "Processing delivery with Anti-Spam protection...";

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
            if (data.success) {
              status.style.color = "green";
              status.innerText = data.message;
            } else {
              status.style.color = "red";
              status.innerText = data.error || "Failed to send.";
            }
          } catch (err) {
            status.style.color = "red";
            status.innerText = "Network Error: " + err.message;
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
    return res.status(400).json({ success: false, error: "Missing required fields." });
  }

  const recipients = toEmail
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && isValidEmail(e));

  if (recipients.length === 0) {
    return res.status(400).json({ success: false, error: "Valid recipient emails required." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: senderEmail,
        pass: appPassword.replace(/\s+/g, ""),
      },
    });

    const results = [];
    const domain = senderEmail.split("@")[1] || "gmail.com";

    for (const recipient of recipients) {
      try {
        // Generate unique headers to mimic legitimate mail clients
        const uniqueId = crypto.randomBytes(8).toString("hex");
        const customMessageId = `<${Date.now()}.${uniqueId}@${domain}>`;

        const info = await transporter.sendMail({
          from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
          to: recipient,
          replyTo: senderEmail,
          subject: subject,
          text: message,
          // HTML code with zero-width dynamic character token to break spam duplicate detection
          html: `
            <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222222; line-height: 1.6;">
              <p>${message.replace(/\n/g, "<br/>")}</p>
              <!-- ${uniqueId} -->
            </div>
          `,
          headers: {
            "Message-ID": customMessageId,
            "Date": new Date().toUTCString(),
            "X-Mailer": "Microsoft Outlook 16.0",
            "X-Priority": "3",
            "X-MSMail-Priority": "Normal",
          },
        });

        results.push({ email: recipient, success: true, messageId: info.messageId });
      } catch (err) {
        results.push({ email: recipient, success: false, error: err.message });
      }

      // Natural randomized delay
      await smartDelay();
    }

    transporter.close();

    const successCount = results.filter((r) => r.success).length;
    return res.json({
      success: successCount > 0,
      message: `${successCount} email(s) successfully delivered!`,
      details: results,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Anti-Spam Email Server running at: http://localhost:${PORT}`);
});
