const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const randomDelay = () => {
  const ms = Math.floor(Math.random() * 2000) + 1000; // 1s to 3s delay
  return new Promise((resolve) => setTimeout(resolve, ms));
};

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
        button { width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Updated Gmail Direct Sender</h2>
        <form id="mailForm">
          <label>Sender Name</label>
          <input type="text" id="senderName" placeholder="Your Name">

          <label>Sender Gmail</label>
          <input type="email" id="senderEmail" required placeholder="your.email@gmail.com">

          <label>App Password (16-digits)</label>
          <input type="password" id="appPassword" required placeholder="xxxx xxxx xxxx xxxx">

          <label>To Emails (Comma or Line separated)</label>
          <textarea id="toEmail" rows="3" required placeholder="user1@gmail.com"></textarea>

          <label>Subject</label>
          <input type="text" id="subject" required placeholder="Subject">

          <label>Message</label>
          <textarea id="message" rows="4" required placeholder="Message body..."></textarea>

          <button type="submit" id="btn">Send Email</button>
        </form>
        <p id="status"></p>
      </div>

      <script>
        document.getElementById("mailForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = document.getElementById("btn");
          const status = document.getElementById("status");
          btn.disabled = true;
          status.innerText = "Sending with Header Manipulation...";

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

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword.replace(/\s+/g, ""),
      },
    });

    const results = [];

    for (const recipient of recipients) {
      try {
        const uniqueId = crypto.randomBytes(4).toString("hex");

        const info = await transporter.sendMail({
          from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
          to: recipient,
          replyTo: senderEmail,
          subject: `${subject}`,
          text: `${message}\n\nRef ID: ${uniqueId}`,
          html: `
            <div style="font-family: Helvetica, Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.5;">
              <p>${message.replace(/\n/g, "<br/>")}</p>
              <br/>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 11px; color: #999;">
                This email was sent to ${recipient}. 
                <a href="mailto:${senderEmail}?subject=Unsubscribe" style="color: #999;">Unsubscribe</a>
              </p>
            </div>
          `,
          headers: {
            "List-Unsubscribe": `<mailto:${senderEmail}?subject=unsubscribe>`,
            "Precedence": "bulk",
            "X-Report-Abuse-To": senderEmail
          }
        });

        results.push({ email: recipient, success: true, messageId: info.messageId });
      } catch (err) {
        results.push({ email: recipient, success: false, error: err.message });
      }

      await randomDelay();
    }

    transporter.close();

    const successCount = results.filter((r) => r.success).length;
    return res.json({
      success: successCount > 0,
      message: `${successCount} mail(s) processed.`,
      details: results,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
