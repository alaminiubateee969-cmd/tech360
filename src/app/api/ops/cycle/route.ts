import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { runOpsCycle, cycleThrottled, MIN_CYCLE_INTERVAL_MS } from '@/lib/ops-loop'
import { readJson, rateLimit, clientIp, constantTimeEquals } from '@/lib/security'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  // already fails closed on an unset secret; compare in constant time so the
  // value cannot be recovered byte-by-byte through response timing
  return constantTimeEquals(req.headers.get('x-ops-secret'), secret)
}

// ============================================================
// AI OPERATIONS CYCLE — the production autonomy endpoint.
//
// Cloud Scheduler (or any external scheduler / n8n / cron) POSTs
// this with header `x-ops-secret: $OPS_SECRET` every minute; the
// endpoint throttles to one real cycle per MIN_CYCLE_INTERVAL_MS
// so 1-minute schedulers never stack cycles. Every cycle is the
// full loop: detect → decide → execute → verify → log → learn,
// with the daily CEO report archived automatically.
// GET returns the last cycle state (read-only, no secrets leaked).
// ============================================================
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-cycle:${clientIp(req)}`, 60, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const [lastRun, heartbeat, lastCycle] = await Promise.all([
    db.setting.findUnique({ where: { key: 'ops.cycle.lastRun' } }),
    db.setting.findUnique({ where: { key: 'ops.heartbeat' } }),
    db.automationLog.findFirst({ where: { workflow: 'AI_OPS_LOOP' }, orderBy: { startedAt: 'desc' } }),
  ])
  const throttled = lastRun ? Date.now() - new Date(lastRun.value).getTime() < MIN_CYCLE_INTERVAL_MS : false

  return Response.json({
    endpoint: '/api/ops/cycle',
    method: 'POST',
    auth: 'header x-ops-secret',
    minIntervalMs: MIN_CYCLE_INTERVAL_MS,
    lastRunAt: lastRun?.value ?? null,
    currentlyThrottled: throttled,
    heartbeat: heartbeat?.value ?? null,
    lastCycle: lastCycle ? { correlationId: lastCycle.correlationId, status: lastCycle.status, finishedAt: lastCycle.finishedAt, output: lastCycle.output } : null,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-cycle:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const raw = await readJson(req).catch(() => ({}) as Record<string, unknown>)
  const force = raw.force === true

  if (!force) {
    const { throttled, lastRunAt } = await cycleThrottled()
    if (throttled) {
      return Response.json({ ok: true, throttled: true, lastRunAt, message: `Last cycle ran less than ${MIN_CYCLE_INTERVAL_MS / 1000}s ago — skipping (send { force: true } to override).` })
    }
  }

  const summary = await runOpsCycle(force ? 'MANUAL' : 'SCHEDULER')
  return Response.json({ ok: summary.ok, throttled: false, summary })
}
