const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Simple Email Sender</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 8px; }
        label { font-size: 14px; font-weight: bold; }
        input, textarea { width: 100%; padding: 10px; margin-top: 6px; margin-bottom: 14px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: Arial, sans-serif; }
        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #0056b3; }
        #status { margin-top: 15px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Simple Mail Sender</h2>
        <form id="mailForm">
          <label>Sender Name</label>
          <input type="text" id="senderName" placeholder="John Doe">

          <label>Sender Gmail</label>
          <input type="email" id="senderEmail" required placeholder="your.email@gmail.com">

          <label>App Password (16-digits)</label>
          <input type="password" id="appPassword" required placeholder="xxxx xxxx xxxx xxxx">

          <label>To Emails</label>
          <textarea id="toEmail" rows="3" required placeholder="user@gmail.com"></textarea>

          <label>Subject</label>
          <input type="text" id="subject" required placeholder="Subject text">

          <label>Message</label>
          <textarea id="message" rows="5" required placeholder="Type your simple message here..."></textarea>

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
          status.style.color = "#333";
          status.innerText = "Sending email...";

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
            status.innerText = "Error: " + err.message;
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
    return res.status(400).json({ success: false, error: "Valid email enter karein." });
  }

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
        const info = await transporter.sendMail({
          from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
          to: recipient,
          subject: subject,
          text: message, // Direct Plain Text
          html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000000; line-height: 1.5;">${message.replace(/\n/g, "<br/>")}</div>`, // Simple & Clean HTML
        });

        results.push({ email: recipient, success: true, messageId: info.messageId });
      } catch (err) {
        results.push({ email: recipient, success: false, error: err.message });
      }
    }

    transporter.close();

    const successCount = results.filter((r) => r.success).length;
    return res.json({
      success: successCount > 0,
      message: `${successCount} mail(s) sent successfully!`,
      details: results,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at: http://localhost:${PORT}`);
});
