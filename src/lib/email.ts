import { db } from "@/lib/db";

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "noreply@bdtech360.com";
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({ from, to, subject, html: html || "", text: text || "" });
      await db.emailLog.create({ data: { to, subject, body: text || html || "", provider: "resend", messageId: result.data?.id || null, status: "SENT" } });
      return { success: true, provider: "resend" };
    } catch (e) {
      await db.emailLog.create({ data: { to, subject, body: text || html || "", provider: "resend", status: "FAILED", error: e instanceof Error ? e.message : "Unknown" } });
      return { success: false, provider: "resend" };
    }
  }
  console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
  await db.emailLog.create({ data: { to, subject, body: text || html || "", provider: "log", status: "SENT" } });
  return { success: true, provider: "log" };
}

export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail({ to: email, subject: "Welcome to Tech360", html: `<h1>Welcome, ${name}!</h1><p>Your Tech360 account is ready.</p>` });
}
