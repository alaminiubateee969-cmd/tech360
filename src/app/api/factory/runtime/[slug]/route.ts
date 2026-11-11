/**
 * PRIVATE, CONFIG-DRIVEN APPLICATION RUNTIME API.
 *
 * GET  → the live state of the company application (real DB rows only).
 * POST → an authenticated action against that application (records, files,
 *        workflows, reports, executable tests, health). Every request is
 *        re-authorized against an explicit company grant; the companyId is
 *        resolved server-side from the private slug, never trusted from the
 *        client.
 */
import { NextRequest } from 'next/server'
import { guardFailed, noStore, readBody, requireActor } from '@/lib/factory/control/http'
import { resolveRuntime, runtimeAction, runtimeState } from '@/lib/factory/control/runtime'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const { slug } = await params
  const resolved = await resolveRuntime(g.actor, slug, 'read')
  if (!resolved.ok || !resolved.data) return noStore({ ok: false, code: resolved.code, reason: resolved.reason }, resolved.status ?? 403)
  return noStore(await runtimeState(resolved.data))
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const { slug } = await params
  const body = await readBody(req)
  const action = typeof body.action === 'string' ? body.action.slice(0, 60) : ''
  const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown> : {}
  const result = await runtimeAction(g.actor, slug, action, payload)
  return noStore(result as unknown as Record<string, unknown>, result.status ?? (result.ok ? 200 : 403))
}
