// ============================================================
// TECH360 AI OPERATIONS SERVICE — dev-side driver of the
// platform's autonomous engine. Port: 3031.
//
// The loop logic itself lives IN the platform at
// POST /api/ops/cycle (src/lib/ops-loop.ts) so dev and production
// run the exact same code. This service simply triggers that
// endpoint every OPS_INTERVAL_SEC, keeps a health surface for the
// admin console, and exposes POST /trigger for manual runs.
//
// In production (Cloud Run) there is no sidecar: Cloud Scheduler
// POSTs /api/ops/cycle with the OPS_SECRET header every minute
// (see deployment/scheduler.md).
// ============================================================

const PORT = 3031
const PLATFORM = process.env.PLATFORM_URL ?? 'http://localhost:3000'
const OPS_SECRET = process.env.OPS_SECRET ?? 'tech360-ops-dev-secret'
const INTERVAL_SEC = Number(process.env.OPS_INTERVAL_SEC ?? 90)

type CycleResponse = {
  ok?: boolean
  throttled?: boolean
  summary?: {
    cycle: number
    trigger: string
    startedAt: string
    finishedAt: string
    ok: boolean
    performed: string[]
    scanned: Record<string, number>
    ceoReport?: { id: string } | { skipped: string } | null
    error?: string
  }
  message?: string
}

const state = {
  startedAt: new Date().toISOString(),
  cycles: 0,
  lastCycleAt: null as string | null,
  lastCycleSummary: null as CycleResponse['summary'] | null,
  lastError: null as string | null,
  actions: [] as Array<{ cycle: number; at: string; action: string }>,
  healthy: false,
}

async function runCycle() {
  try {
    const res = await fetch(`${PLATFORM}/api/ops/cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ops-secret': OPS_SECRET },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(240_000),
    })
    const data = (await res.json().catch(() => ({}))) as CycleResponse
    if (!res.ok && !data.throttled) {
      state.lastError = `cycle failed: HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`
      console.error(`[ops] ${state.lastError}`)
      return
    }
    if (data.throttled) {
      console.log(`[ops] cycle throttled by platform (${data.message ?? 'interval guard'}) — skipping`)
      return
    }
    state.healthy = true
    state.cycles += 1
    state.lastCycleAt = new Date().toISOString()
    state.lastCycleSummary = data.summary ?? null
    for (const action of data.summary?.performed ?? []) {
      state.actions.push({ cycle: data.summary?.cycle ?? state.cycles, at: state.lastCycleAt, action })
    }
    if (state.actions.length > 200) state.actions.splice(0, 100)
    console.log(`[ops] cycle #${data.summary?.cycle ?? '?'} complete — ${data.summary?.performed.length ?? 0} actions (${data.summary?.performed.slice(0, 6).join('; ')})`)
  } catch (e) {
    state.lastError = e instanceof Error ? e.message : String(e)
    console.error('[ops] cycle error', e)
  }
}

// ------------------------------------------------------------
// HTTP status surface (port 3031)
// ------------------------------------------------------------
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/health' || url.pathname === '/') {
      return Response.json({
        service: 'tech360-ai-ops',
        status: state.healthy ? 'operating' : 'starting',
        port: PORT,
        platform: PLATFORM,
        loopEndpoint: `${PLATFORM}/api/ops/cycle`,
        intervalSec: INTERVAL_SEC,
        startedAt: state.startedAt,
        cycles: state.cycles,
        lastCycleAt: state.lastCycleAt,
        lastCycleSummary: state.lastCycleSummary,
        lastError: state.lastError,
        recentActions: state.actions.slice(-15),
        engine: 'platform in-process loop (src/lib/ops-loop.ts) — Conductor + Sentry + Echo + Sentinel + Pulse agents',
      })
    }
    if (url.pathname === '/trigger' && req.method === 'POST') {
      const authorized = req.headers.get('x-ops-secret') === OPS_SECRET
      if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      runCycle().catch((e) => console.error('[ops] trigger failed', e))
      return Response.json({ ok: true, triggered: true })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  },
})

console.log(`[tech360-ai-ops] Autonomous AI operations driver listening on :${PORT}`)
console.log(`[tech360-ai-ops] Platform: ${PLATFORM} · triggering /api/ops/cycle every ${INTERVAL_SEC}s`)

// first cycle after platform is warm, then the loop
setTimeout(() => {
  runCycle()
  setInterval(() => {
    runCycle()
  }, INTERVAL_SEC * 1000)
}, 5000)
