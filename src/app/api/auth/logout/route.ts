import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { destroySession } from '@/lib/auth'
import { SESSION_COOKIE, CSRF_COOKIE } from '@/lib/constants'
import { rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`logout:${ip}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const store = await cookies()
  await destroySession(store.get(SESSION_COOKIE)?.value)
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.headers.append('Set-Cookie', `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`)
  return res
}
