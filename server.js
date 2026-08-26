const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON & Form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper delay function (1 second per mail to avoid spam trigger)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 1. Direct Frontend Form Route (GET /)
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Sender</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 20px auto; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #333; }
        label { font-weight: bold; display: block; margin-top: 12px; margin-bottom: 5px; }
        input, textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { margin-top: 15px; width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #0056b3; }
        #status { margin-top: 15px; font-weight: bold; }
        .success { color: green; }
        .error { color: red; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Send Email API</h2>
        <form id="mailForm">
          <label>Sender Name</label>
          <input type="text" id="senderName" placeholder="John Doe">

          <label>Sender Email (Gmail)</label>
          <input type="email" id="senderEmail" required placeholder="your.email@gmail.com">

          <label>Gmail App Password (16 digits)</label>
          <input type="password" id="appPassword" required placeholder="xxxx xxxx xxxx xxxx">

          <label>To Emails (Comma or Line separated)</label>
          <textarea id="toEmail" rows="3" required placeholder="user1@gmail.com, user2@gmail.com"></textarea>

          <label>Subject</label>
          <input type="text" id="subject" required placeholder="Subject here">

          <label>Message</label>
          <textarea id="message" rows="4" required placeholder="Your message here..."></textarea>

          <button type="submit" id="btn">Send Mails</button>
        </form>
        <div id="status"></div>
      </div>

      <script>
        document.getElementById("mailForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = document.getElementById("btn");
          const statusDiv = document.getElementById("status");

          btn.disabled = true;
          statusDiv.className = "";
          statusDiv.innerText = "Sending emails... please wait.";

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
            if (res.ok && data.success) {
              statusDiv.className = "success";
              statusDiv.innerText = data.message;
            } else {
              statusDiv.className = "error";
              statusDiv.innerText = data.error || "Failed to send emails.";
            }
          } catch (err) {
            statusDiv.className = "error";
            statusDiv.innerText = "Network Error: " + err.message;
          } finally {
            btn.disabled = false;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// 2. Backend Mail Send Route (POST /send-mail)
app.post("/send-mail", async (req, res) => {
  const { senderName, senderEmail, appPassword, toEmail, subject, message } = req.body;

  if (!senderEmail || !appPassword || !toEmail || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields.",
    });
  }

  const recipients = toEmail
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const invalidEmails = recipients.filter((e) => !isValidEmail(e));
  if (invalidEmails.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid email addresses: ${invalidEmails.join(", ")}`,
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword.replace(/\s+/g, ""), // spaces remove kar deta hai
      },
    });

    const results = [];

    for (const recipient of recipients) {
      try {
        const info = await transporter.sendMail({
          from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
          to: recipient,
          subject: subject,
          text: message,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>${message.replace(/\n/g, "<br/>")}</p></div>`,
          headers: {
            "X-Priority": "3",
            "X-Mailer": "Nodemailer",
          },
        });

        results.push({ email: recipient, success: true, messageId: info.messageId });
      } catch (err) {
        results.push({ email: recipient, success: false, error: err.message });
      }

      await sleep(1000); // 1-second delay per mail
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return res.json({
      success: successCount > 0,
      totalSent: successCount,
      totalFailed: failedCount,
      details: results,
      message: `${successCount} email(s) sent successfully,${failedCount} failed.`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at: http://localhost:${PORT}`);
});
