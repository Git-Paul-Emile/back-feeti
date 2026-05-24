import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_TO,
  EMAIL_FROM,
  EMAIL_TO,
} = process.env;

const fromAddress = SMTP_FROM || EMAIL_FROM || SMTP_USER;
const toAddress = SMTP_TO || EMAIL_TO || SMTP_USER;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !fromAddress || !toAddress) {
  console.error(
    "Missing required SMTP environment variables. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Optionally set SMTP_FROM or EMAIL_FROM, and SMTP_TO or EMAIL_TO. If SMTP_TO/EMAIL_TO are absent, SMTP_USER is used as recipient."
  );
  process.exit(1);
}

const port = Number(SMTP_PORT);
const secure = SMTP_SECURE === "true" || SMTP_PORT === "465";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function testSmtp() {
  console.log("SMTP test configuration:", {
    host: SMTP_HOST,
    port,
    secure,
    user: SMTP_USER,
    from: fromAddress,
    to: toAddress,
  });

  try {
    console.log("Verifying SMTP connection...");
    await transporter.verify();
    console.log("SMTP connection OK.");
  } catch (error) {
    console.error("SMTP verification failed:", error);
    process.exit(1);
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      subject: `SMTP test ${new Date().toISOString()}`,
      text: `SMTP test from ${fromAddress} to ${toAddress}`,
      html: `<p>SMTP test from <strong>${fromAddress}</strong> to <strong>${toAddress}</strong>.</p><p>Time: ${new Date().toISOString()}</p>`,
    });

    console.log("Message sent successfully.");
    console.log("MessageId:", info.messageId);
    if (info.envelope) console.log("Envelope:", info.envelope);
    if (info.response) console.log("Response:", info.response);
  } catch (error) {
    console.error("SMTP send failed:", error);
    process.exit(1);
  }
}

await testSmtp();
