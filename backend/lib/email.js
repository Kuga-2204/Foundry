import nodemailer from "nodemailer";

// Email transport. In production, set SMTP_* env vars and mail is sent for
// real. With none set (local dev), we use a JSON transport that never hits
// the network: the message is logged to the server console instead, so the
// password-reset and digest flows are fully testable without an account.
const hasSmtp = !!process.env.SMTP_HOST;

const transport = hasSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

const FROM = process.env.MAIL_FROM || "Solvyard <no-reply@solvyard.local>";

export async function sendMail({ to, subject, text, html }) {
  const info = await transport.sendMail({ from: FROM, to, subject, text, html });
  if (!hasSmtp) {
    // Dev: surface the message (and any reset link inside it) in the console.
    console.log(`\n[email:dev] to=${to} subject="${subject}"\n${text}\n`);
  }
  return info;
}

export function emailConfigured() {
  return hasSmtp;
}
