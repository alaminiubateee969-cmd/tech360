import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signPortalToken, PORTAL_COOKIE, PORTAL_TTL_HOURS, normalizeContact, portalGate } from "@/lib/portal"
import { readJson, sanitizeText, rateLimit, clientIp, audit } from '@/lib/security'
import { channelConfigured, sendCommunication, escapeHtml } from '@/lib/comms'
import { issueOtp, readChallenge, verifyOtp, maskContact, OTP_MAX_ATTEMPTS, type OtpChannel } from '@/lib/otp'
import { portalSecret } from '@/lib/portal'

export const dynamic = 'force-dynamic'

// Client portal login — two steps, all self-hosted:
//   1. { clientId, contact }  -> matches the record, e-mails / WhatsApps / SMSes a
//      6-digit one-time code to the contact ON FILE and returns a signed challenge.
//   2. { challenge, code }    -> verifies the code and sets the session cookie.
// Client ID + e-mail alone is guessable (IDs are sequential), so the OTP proves the
// person controls the inbox/phone. If NO delivery channel is configured the portal
// falls back to the legacy single step (PORTAL_OTP=required refuses instead;
// PORTAL_OTP=off forces the legacy step).
// Rate limited, audit logged. Never reveals which field failed.

const usedChallenges = new Map<string, number>() // nonce -> expiry (single-use, per process)

function otpMode(): 'off' | 'required' | 'auto' {
  const m = (process.env.PORTAL_OTP ?? '').toLowerCase()
  return m === 'off' || m === 'required' ? m : 'auto'
}

function pickChannel(client: { email: string | null; whatsapp: string | null; phone: string | null }): { ch: OtpChannel; to: string } | null {
  const phone = client.whatsapp || client.phone
  const candidates: Array<{ ch: OtpChannel; to: string | null }> = [
    { ch: 'EMAIL', to: client.email },
    { ch: 'WHATSAPP', to: phone },
    { ch: 'SMS', to: client.phone || client.whatsapp },
  ]
  // PORTAL_OTP_CHANNEL=sms|email|whatsapp moves that channel to the front (e.g. free SMS via httpSMS)
  const pref = (process.env.PORTAL_OTP_CHANNEL ?? '').toUpperCase()
  candidates.sort((x, y) => Number(y.ch === pref) - Number(x.ch === pref))
  for (const c of candidates) if (c.to && channelConfigured(c.ch)) return { ch: c.ch, to: c.to }
  return null
}

function sessionResponse(client: { clientId: string; name: string }) {
  const token = signPortalToken(client.clientId)
  const res = Response.json({ ok: true, clientId: client.clientId, name: client.name })
  const secure = process.env.NODE_ENV === 'production'
  res.headers.append('Set-Cookie', `${PORTAL_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${PORTAL_TTL_HOURS * 3600}`)
  return res
}

export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-login:${ip}`, 10, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })

  const raw = await readJson(req)

  // ---------------- Step 2: verify the one-time code ----------------
  if (raw.challenge !== undefined) {
    const secret = portalSecret()
    const p = readChallenge(secret, raw.challenge)
    if (!p) return Response.json({ error: 'This code has expired. Please start again.', restart: true }, { status: 401 })
    const attempts = rateLimit(`portal-otp:${p.n}`, OTP_MAX_ATTEMPTS, 10 * 60_000)
    if (!attempts.ok) {
      await audit({ actor: `portal:${p.sub}`, action: 'PORTAL_OTP_LOCKED', ip })
      return Response.json({ error: 'Too many wrong codes. Please start again.', restart: true }, { status: 429 })
    }
    if (usedChallenges.has(p.n) || !verifyOtp(secret, raw.challenge, raw.code)) {
      await audit({ actor: `portal:${p.sub}`, action: 'PORTAL_OTP_FAILED', clientId: p.sub, ip })
      return Response.json({ error: 'That code is not correct. Check the latest message and try again.' }, { status: 401 })
    }
    usedChallenges.set(p.n, p.exp)
    for (const [k, exp] of usedChallenges) if (exp < Date.now()) usedChallenges.delete(k)
    const client = await db.client.findFirst({ where: { clientId: p.sub, deletedAt: null } })
    if (!client) return Response.json({ error: 'Account not found.' }, { status: 401 })
    await audit({ actor: `client:${client.clientId}`, action: 'PORTAL_LOGIN', clientId: client.clientId, ip, details: { method: `otp:${p.ch}` } })
    return sessionResponse(client)
  }

  // ---------------- Step 1: match the record ----------------
  const clientId = sanitizeText(raw.clientId, 40).toUpperCase()
  const contact = sanitizeText(raw.contact, 320)
  if (!clientId || !contact) return Response.json({ error: 'Client ID and your registered contact (email or phone) are required' }, { status: 400 })

  const client = await db.client.findFirst({
    where: { clientId, deletedAt: null },
    include: { lead: true },
  })
  const norm = normalizeContact(contact)
  const emailMatch = norm.email && client?.email?.toLowerCase() === norm.email
  const phoneMatch = norm.phone && (client?.whatsapp?.replace(/[^\d]/g, '') === norm.phone || client?.phone?.replace(/[^\d]/g, '') === norm.phone)

  if (!client || (!emailMatch && !phoneMatch)) {
    await audit({ actor: `portal:${clientId || 'unknown'}`, action: 'PORTAL_LOGIN_FAILED', ip, details: { reason: 'no matching record' } })
    return Response.json({ error: 'We could not match those details. Check your Client ID (e.g. TECH-2026-000001) and the email or phone number you used when you contacted us.' }, { status: 401 })
  }

  const mode = otpMode()
  const target = mode === 'off' ? null : pickChannel(client)
  if (!target) {
    if (mode === 'required') {
      return Response.json({ error: 'Sign-in codes cannot be delivered right now. Please contact support.' }, { status: 503 })
    }
    // legacy single-step sign-in (no delivery channel configured)
    await audit({ actor: `client:${client.clientId}`, action: 'PORTAL_LOGIN', clientId: client.clientId, ip, details: { method: 'contact-match' } })
    return sessionResponse(client)
  }

  // Anti-bombing: max 3 codes per client per 10 minutes
  const issue = rateLimit(`portal-otp-issue:${client.clientId}`, 3, 10 * 60_000)
  if (!issue.ok) return Response.json({ error: 'A code was already sent recently. Please wait a few minutes before requesting another.' }, { status: 429 })

  const { code, challenge } = issueOtp(portalSecret(), client.clientId, target.ch)
  const text = `Your Tech360 portal sign-in code is ${code}. It expires in 10 minutes. Never share this code — Tech360 staff will never ask for it.`
  const { result } = await sendCommunication({
    clientId: client.clientId,
    channel: target.ch,
    to: target.to,
    subject: 'Your Tech360 sign-in code',
    body: target.ch === 'EMAIL'
      ? `<p>Your sign-in code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#063B8F">${escapeHtml(code)}</p><p>It expires in 10 minutes. If you did not try to sign in, you can ignore this message. Never share this code.</p>`
      : text,
    storedBody: '[one-time sign-in code — not stored]',
    templateName: 'PORTAL_OTP',
    messageType: 'OTP',
  })
  if (!result.ok) {
    await audit({ actor: `portal:${client.clientId}`, action: 'PORTAL_OTP_SEND_FAILED', clientId: client.clientId, ip, details: { channel: target.ch, status: result.status } })
    return Response.json({ error: 'We could not deliver your sign-in code. Please try again shortly or contact support.' }, { status: 502 })
  }
  await audit({ actor: `portal:${client.clientId}`, action: 'PORTAL_OTP_SENT', clientId: client.clientId, ip, details: { channel: target.ch } })
  return Response.json({ ok: true, otpRequired: true, challenge, channel: target.ch, sentTo: maskContact(target.to) })
}

export async function DELETE(req: NextRequest) {
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return res
}
