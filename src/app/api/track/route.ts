import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeText, rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

const ALLOWED = ['page_view', 'lead', 'contact', 'whatsapp_click', 'form_submit', 'preview_view', 'approval', 'conversion', 'cta_click']

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`track:${ip}`, 60, 60_000)
  if (!rl.ok) return Response.json({ ok: true }) // silently drop floods
  const raw = await readJson(req)
  const name = sanitizeText(raw.name, 60)
  if (!ALLOWED.includes(name)) return Response.json({ ok: true })
  await db.trackingEvent.create({
    data: {
      name, path: sanitizeText(raw.path, 300) || null, consent: raw.consent === true,
      meta: raw.meta ? JSON.stringify(raw.meta).slice(0, 1000) : null,
    },
  }).catch(() => null)
  return Response.json({ ok: true })
}
