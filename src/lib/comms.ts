import { db } from '@/lib/db'
import { COMPANY } from '@/lib/constants'

// ============================================================
// TECH360 COMMUNICATIONS — real adapters, honest statuses
// WhatsApp Cloud API · SMTP Email · SMS provider · Social
// Credentials ONLY from environment variables (never hardcoded).
// When not configured → status NOT_CONFIGURED (never fake SENT).
// ============================================================

export type SendResult = {
  ok: boolean
  status: 'SENT' | 'FAILED' | 'NOT_CONFIGURED' | 'DISABLED_BY_ADMIN' | 'SENT_PLATFORM'
  providerMessageId?: string
  error?: string
}

export function channelConfigured(channel: string): boolean {
  switch (channel) {
    case 'WHATSAPP':
      return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
    case 'EMAIL':
      return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM)
    case 'SMS':
      return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY)
    default:
      return false
  }
}

export function channelStatuses() {
  return {
    WHATSAPP: channelConfigured('WHATSAPP'),
    EMAIL: channelConfigured('EMAIL'),
    SMS: channelConfigured('SMS'),
    FACEBOOK: Boolean(process.env.FACEBOOK_PAGE_TOKEN),
    INSTAGRAM: Boolean(process.env.INSTAGRAM_TOKEN),
    LINKEDIN: Boolean(process.env.LINKEDIN_TOKEN),
    X: Boolean(process.env.X_TOKEN),
    N8N: Boolean(process.env.N8N_WEBHOOK_BASE),
  }
}

// ------------------------------------------------------------
// WhatsApp Cloud API (Graph v21)
// ------------------------------------------------------------
async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  if (!channelConfigured('WHATSAPP')) {
    return { ok: false, status: 'NOT_CONFIGURED', error: 'WhatsApp Cloud API credentials not configured' }
  }
  try {
    const phone = to.replace(/[^\d]/g, '')
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { preview_url: true, body } }),
      signal: AbortSignal.timeout(15000),
    })
    const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } }
    if (!res.ok) {
      return { ok: false, status: 'FAILED', error: data?.error?.message ?? `WhatsApp API HTTP ${res.status}` }
    }
    return { ok: true, status: 'SENT', providerMessageId: data?.messages?.[0]?.id }
  } catch (e) {
    return { ok: false, status: 'FAILED', error: e instanceof Error ? e.message : String(e) }
  }
}

// ------------------------------------------------------------
// Email (SMTP via nodemailer)
// ------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!channelConfigured('EMAIL')) {
    return { ok: false, status: 'NOT_CONFIGURED', error: 'SMTP credentials not configured' }
  }
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    })
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM!,
      to,
      subject,
      html,
    })
    return { ok: true, status: 'SENT', providerMessageId: info.messageId }
  } catch (e) {
    return { ok: false, status: 'FAILED', error: e instanceof Error ? e.message : String(e) }
  }
}

// ------------------------------------------------------------
// SMS (generic provider via SMS_API_URL + SMS_API_KEY)
// ------------------------------------------------------------
async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!channelConfigured('SMS')) {
    return { ok: false, status: 'NOT_CONFIGURED', error: 'SMS provider not configured' }
  }
  try {
    const res = await fetch(process.env.SMS_API_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: to.replace(/[^\d+]/g, ''), message: body, sender: process.env.SMS_SENDER ?? 'Tech360' }),
      signal: AbortSignal.timeout(15000),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) return { ok: false, status: 'FAILED', error: data?.message ?? `SMS API HTTP ${res.status}` }
    return { ok: true, status: 'SENT', providerMessageId: data?.id }
  } catch (e) {
    return { ok: false, status: 'FAILED', error: e instanceof Error ? e.message : String(e) }
  }
}

// ------------------------------------------------------------
// Persist + dispatch — every message is recorded against Client ID
// ------------------------------------------------------------
export async function sendCommunication(entry: {
  clientId?: string
  channel: string
  to?: string
  subject?: string
  body: string
  agentCode?: string
  workflowId?: string
  approvalId?: string
  templateName?: string
  messageType?: string
}): Promise<{ communicationId: string; result: SendResult }> {
  const comm = await db.communication.create({
    data: {
      clientId: entry.clientId ?? null,
      channel: entry.channel,
      direction: 'OUT',
      recipient: entry.to ?? null,
      subject: entry.subject ?? null,
      body: entry.body.slice(0, 20000),
      agentCode: entry.agentCode ?? null,
      workflowId: entry.workflowId ?? null,
      approvalId: entry.approvalId ?? null,
      templateName: entry.templateName ?? null,
      messageType: entry.messageType ?? 'TEXT',
      status: 'QUEUED',
    },
  })

  // ---- Super Admin channel switches (REAL backend enforcement) ----
  // When a channel is switched OFF, the send attempt is refused honestly
  // (the Communication record is still kept, status DISABLED_BY_ADMIN) —
  // records stay for the audit trail, but nothing is ever sent.
  const channelFlag: Record<string, 'whatsapp' | 'email' | 'sms'> = { WHATSAPP: 'whatsapp', EMAIL: 'email', SMS: 'sms' }
  const flag = channelFlag[entry.channel]
  if (flag) {
    const { featureEnabled } = await import('@/lib/features')
    if (!(await featureEnabled(flag))) {
      const disabled: SendResult = { ok: false, status: 'DISABLED_BY_ADMIN', error: entry.channel + ' channel is switched OFF by Super Admin — send refused (record kept)' }
      await db.communication.update({ where: { id: comm.id }, data: { status: disabled.status, error: disabled.error ?? null, sentAt: null } })
      return { communicationId: comm.id, result: disabled }
    }
  }

  let result: SendResult
  switch (entry.channel) {
    case 'WHATSAPP':
      result = await sendWhatsApp(entry.to ?? '', entry.body)
      break
    case 'EMAIL':
      result = await sendEmail(entry.to ?? '', entry.subject ?? 'Tech360', wrapEmailHtml(entry.subject ?? 'Tech360', entry.body))
      break
    case 'SMS':
      result = await sendSms(entry.to ?? '', entry.body)
      break
    default:
      // Social outbound publishing is approval-gated and provider-specific.
      result = { ok: false, status: 'NOT_CONFIGURED', error: `${entry.channel} outbound not connected` }
  }

  await db.communication.update({
    where: { id: comm.id },
    data: {
      status: result.status,
      error: result.error ?? null,
      providerMessageId: result.providerMessageId ?? null,
      sentAt: result.status === 'SENT' ? new Date() : null,
    },
  })

  if (result.status === 'FAILED') {
    const { logError } = await import('@/lib/security')
    await logError({
      source: 'COMMS', code: `SEND_FAILED_${entry.channel}`,
      message: `To ${entry.to ?? 'unknown'}: ${result.error ?? 'unknown error'}`,
      clientId: entry.clientId, workflow: entry.workflowId ?? undefined,
    })
  }

  return { communicationId: comm.id, result }
}

// ------------------------------------------------------------
// Email template wrapper (professional signature)
// ------------------------------------------------------------
export function wrapEmailHtml(subject: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="background:#0f172a;padding:20px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Tech<span style="color:#22c55e;">360</span></span>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Strategy · Software · Automation · Growth</div>
      </td></tr>
      <tr><td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.7;">
        <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:14px;">${escapeHtml(subject)}</div>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;line-height:1.6;">
        ${COMPANY.legalName} · ${COMPANY.address}<br/>
        ${COMPANY.email} · ${COMPANY.url}<br/>
        This message contains confidential business information intended for the addressed recipient.
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

// Standard email templates (brand-consistent)
export function emailTemplate(type: string, vars: { name?: string; link?: string; extra?: string }): { subject: string; body: string } {
  const n = vars.name ?? 'there'
  const linkBtn = vars.link ? `<p style="margin:18px 0;"><a href="${vars.link}" style="background:#16a34a;color:#ffffff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Open Link</a></p><p style="color:#64748b;font-size:13px;">Or copy this link: ${vars.link}</p>` : ''
  const map: Record<string, { subject: string; body: string }> = {
    WELCOME: { subject: 'Welcome to Tech360 — we received your request', body: `<p>Hi ${n},</p><p>Thank you for reaching out to Tech360. Your request has been registered and our team is reviewing your requirements right now.</p><p>Your reference: <strong>{{clientId}}</strong>. Please keep it for future communication.${vars.extra ?? ''}</p>${linkBtn}<p>We will be in touch shortly.</p><p>— Team Tech360</p>` },
    SCOPE_QUESTIONS: { subject: 'A few questions about your project', body: `<p>Hi ${n},</p><p>To prepare the right solution for your business, we need a few details:${vars.extra ?? ''}</p>${linkBtn}<p>— Team Tech360</p>` },
    FINAL_SCOPE: { subject: 'Your Final Scope of Work — Tech360', body: `<p>Hi ${n},</p><p>Please find your Final Scope of Work attached below. It includes deliverables, timeline and our payment policy.</p><p>Reply to this email or start a chat with our AI assistant at bdtech360.com with <strong>APPROVED</strong> or any revision notes.${vars.extra ?? ''}</p>${linkBtn}<p>— Team Tech360</p>` },
    REVISION: { subject: 'Updated scope — revision ready for your review', body: `<p>Hi ${n},</p><p>We have updated the scope based on your feedback. Please review the revised version.${vars.extra ?? ''}</p>${linkBtn}<p>— Team Tech360</p>` },
    PREVIEW: { subject: 'Your project preview is ready', body: `<p>Hi ${n},</p><p>Your HTML preview is ready. You can review it before any payment is due — we build trust first.</p>${linkBtn}<p>After reviewing, reply APPROVED or let us know your change requests.</p><p>— Team Tech360</p>` },
    PAYMENT: { subject: 'Payment instructions for your project', body: `<p>Hi ${n},</p><p>Thank you for approving the preview. Here are the payment details for your project milestones.${vars.extra ?? ''}</p><p>Work begins immediately after payment confirmation.</p><p>— Team Tech360</p>` },
    PAYMENT_CONFIRMED: { subject: 'Payment received — your project is now active', body: `<p>Hi ${n},</p><p>We have confirmed your payment. Your project is now active and our delivery team has started. You will receive progress updates at every milestone.${vars.extra ?? ''}</p><p>— Team Tech360</p>` },
    DELIVERY: { subject: 'Your project has been delivered', body: `<p>Hi ${n},</p><p>Your project is complete and delivered. Please confirm everything works as approved, and remember to change any temporary passwords we shared.${vars.extra ?? ''}</p>${linkBtn}<p>— Team Tech360</p>` },
    HANDOVER: { subject: 'Source code handover — secure download', body: `<p>Hi ${n},</p><p>Your final source package is ready for secure download following full payment verification.</p>${linkBtn}<p>— Team Tech360</p>` },
    PASSWORD_CHANGE: { subject: 'Please confirm you changed your passwords', body: `<p>Hi ${n},</p><p>For your security, please confirm that you have changed all temporary passwords provided during handover.${vars.extra ?? ''}</p><p>— Team Tech360</p>` },
    REVIEW_REQUEST: { subject: 'How was your experience with Tech360?', body: `<p>Hi ${n},</p><p>We would genuinely appreciate your feedback on working with Tech360. A short review helps us improve.${vars.extra ?? ''}</p><p>— Team Tech360</p>` },
    REFERRAL_REQUEST: { subject: 'Know a business that needs software?', body: `<p>Hi ${n},</p><p>If you know a business that could benefit from what we built for you, we would be glad to help them too.${vars.extra ?? ''}</p><p>— Team Tech360</p>` },
    PROJECT_UPDATE: { subject: 'Progress update on your project', body: `<p>Hi ${n},</p><p>Here is the latest progress on your project:${vars.extra ?? ''}</p><p>— Team Tech360</p>` },
    MEETING: { subject: 'Meeting confirmation — Tech360', body: `<p>Hi ${n},</p><p>Here are the proposed times for our call.${vars.extra ?? ''}</p>${linkBtn}<p>— Team Tech360</p>` },
  }
  return map[type] ?? { subject: 'Tech360 update', body: `<p>Hi ${n},</p><p>${vars.extra ?? ''}</p>${linkBtn}<p>— Team Tech360</p>` }
}
