import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, clientIp } from '@/lib/security'
import { verifyUnsubToken } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /api/newsletter/unsubscribe?token=…
// Standalone (no-app) HTML page so a subscriber can leave without
// loading the SPA. The token is an HMAC over
// purpose:email:expiry (see lib/newsletter.ts) — ~30 day life.
// ------------------------------------------------------------
function page(opts: { ok: boolean; title: string; headline: string; body: string; token?: string; resubscribe?: boolean; note?: string; status?: number }) {
  const brand = '#009FE3'
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${opts.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f6f8fa; color: #0b1f33; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: #ffffff; max-width: 460px; width: 100%; border: 1px solid #e2e8f0; border-radius: 14px; padding: 40px 36px; box-shadow: 0 8px 30px rgba(6,59,143,.06); }
  .logo { font-size: 21px; font-weight: 800; letter-spacing: .3px; color: #0b1f33; margin-bottom: 22px; }
  .logo span { color: ${brand}; }
  .tag { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
  h1 { font-size: 21px; line-height: 1.35; margin-bottom: 12px; font-weight: 700; }
  p { font-size: 14.5px; line-height: 1.65; color: #33475b; margin-bottom: 12px; }
  .note { font-size: 12.5px; color: #64748b; }
  form { margin-top: 20px; }
  button { background: ${brand}; color: #fff; border: 0; border-radius: 8px; padding: 12px 22px; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 44px; }
  button:hover { background: #063B8F; }
  .foot { margin-top: 28px; padding-top: 16px; border-top: 1px solid #eef2f6; font-size: 11.5px; color: #94a3b8; line-height: 1.6; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:9999px; background:${opts.ok ? '#18B83A' : '#F59E0B'}; margin-right:8px; vertical-align:1px; }
</style>
</head>
<body>
  <main class="card">
    <div class="logo">Tech<span>360</span></div>
    <div class="tag">${opts.ok ? 'Subscription updated' : 'Link problem'}</div>
    <h1><span class="dot" aria-hidden="true"></span>${opts.headline}</h1>
    <p>${opts.body}</p>
    ${opts.note ? `<p class="note">${opts.note}</p>` : ''}
    ${
      opts.resubscribe && opts.token
        ? `<form method="POST" action="/api/newsletter/unsubscribe">
             <input type="hidden" name="token" value="${opts.token.replace(/"/g, '&quot;')}">
             <input type="hidden" name="action" value="resubscribe">
             <button type="submit">Resubscribe</button>
           </form>`
        : ''
    }
    <div class="foot">TECH360 LLC · Strategy · Software · Automation · Growth<br><a href="/" style="color:${brand};">bdtech360.com</a></div>
  </main>
</body>
</html>`
  return new Response(html, {
    status: opts.status ?? 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}

const INVALID_PAGE = () =>
  page({
    ok: false,
    title: 'Invalid link — TECH360',
    headline: 'This unsubscribe link is invalid or has expired.',
    body: 'Unsubscribe links are signed and expire after 30 days. If you still want to leave the list, reply to any email we sent you and ask to be removed — a human will handle it.',
    status: 400,
  })

export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`unsub-get:${ip}`, 30, 10 * 60_000)
  if (!rl.ok) return page({ ok: false, title: 'Too many requests — TECH360', headline: 'Too many requests.', body: 'Please wait a few minutes and try again.', status: 429 })

  const token = new URL(req.url).searchParams.get('token') ?? ''
  const email = verifyUnsubToken(token)
  if (!email) return INVALID_PAGE()

  const subscriber = await db.newsletterSubscriber.findUnique({ where: { email } })
  if (!subscriber) {
    // Valid token, but no subscriber row exists (e.g. removed by an admin).
    return page({
      ok: true,
      title: 'Unsubscribed — TECH360',
      headline: "You're unsubscribed from TECH360 insights.",
      body: "We're sorry to see you go — you can resubscribe anytime.",
      note: 'No active subscription was found for this address — nothing further to change.',
      token,
      resubscribe: true,
    })
  }
  if (subscriber.status !== 'UNSUBSCRIBED') {
    // Never delete rows — honest accounting keeps the history.
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    })
    await db.trackingEvent.create({ data: { name: 'conversion', path: '/newsletter/unsubscribe', consent: true, meta: '{"form":"NEWSLETTER_UNSUBSCRIBE"}' } }).catch(() => null)
  }
  return page({
    ok: true,
    title: 'Unsubscribed — TECH360',
    headline: "You're unsubscribed from TECH360 insights.",
    body: "We're sorry to see you go — you can resubscribe anytime.",
    token,
    resubscribe: true,
  })
}

// ------------------------------------------------------------
// POST /api/newsletter/unsubscribe
//   {token}                          → unsubscribe (never delete)
//   {token, action: 'resubscribe'}   → back to ACTIVE
// Accepts JSON (API clients) and form-encoded (the HTML page's form).
// ------------------------------------------------------------
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const text = await req.text().catch(() => '')
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    // fall through to form-encoded
  }
  try {
    return Object.fromEntries(new URLSearchParams(text))
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`unsub-post:${ip}`, 30, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const body = await readBody(req)
  const token = typeof body.token === 'string' ? body.token : ''
  const action = typeof body.action === 'string' ? body.action.toLowerCase() : ''
  const email = verifyUnsubToken(token)
  if (!email) return Response.json({ error: 'This unsubscribe link is invalid or has expired.' }, { status: 400 })

  const subscriber = await db.newsletterSubscriber.findUnique({ where: { email } })
  if (!subscriber) {
    return Response.json({ error: 'No newsletter subscription exists for this address. Nothing to change.' }, { status: 404 })
  }

  if (action === 'resubscribe') {
    if (subscriber.status === 'ACTIVE') {
      return Response.json({ ok: true, status: 'ACTIVE', message: 'This address is already subscribed.' })
    }
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: 'ACTIVE', unsubscribedAt: null },
    })
    return Response.json({ ok: true, status: 'ACTIVE', message: "You're back on the list — expect occasional engineering insights, no spam." })
  }

  if (subscriber.status === 'UNSUBSCRIBED') {
    return Response.json({ ok: true, status: 'UNSUBSCRIBED', message: 'This address is already unsubscribed.' })
  }
  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
  })
  return Response.json({ ok: true, status: 'UNSUBSCRIBED', message: "You're unsubscribed from TECH360 insights." })
}
