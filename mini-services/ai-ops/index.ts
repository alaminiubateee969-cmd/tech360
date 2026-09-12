// ============================================================
// TECH360 AI OPERATIONS SERVICE — the autonomous operating engine
// Port: 3031 (via gateway: /?XTransformPort=3031)
//
// Loop: DETECT → UNDERSTAND (Conductor agent) → DECIDE →
//       EXECUTE (real platform actions) → VERIFY → LOG → LEARN.
// Escalates to humans (notifications/tasks) when blocked.
// Never fabricates: channels without credentials return
// NOT_CONFIGURED and the service surfaces CONFIGURATION REQUIRED.
// ============================================================

const PORT = 3031
const PLATFORM = process.env.PLATFORM_URL ?? 'http://localhost:3000'
const OPS_SECRET = process.env.OPS_SECRET ?? 'tech360-ops-dev-secret'
const INTERVAL_SEC = Number(process.env.OPS_INTERVAL_SEC ?? 90)
const TZ = 'Asia/Dhaka'

type Scan = {
  ts: string
  unscoredLeads: Array<{ id: string; clientId: string; name: string; businessName: string | null; businessType: string | null; source: string; lead: { requirements: string | null; budgetRange: string | null; projectType: string | null } | null }>
  overdueLeads: Array<{ id: string; clientId: string; name: string; whatsapp: string | null; email: string | null; pipelineStage: string; updatedAt: string }>
  retryableComms: Array<{ id: string; clientId: string | null; channel: string; recipient: string | null; body: string; subject: string | null; error: string | null }>
  failedAutomations: Array<{ id: string; workflow: string; error: string | null; correlationId: string | null; clientId: string | null }>
  unresolvedErrors: Array<{ id: string; source: string; code: string | null; message: string; correlationId: string | null }>
  staleApprovals: Array<{ id: string; type: string; title: string; clientId: string | null; createdAt: string }>
  context: { agentExecutions24h: number; agents: number; totalExecutions: number; totalSuccesses: number; totalFailures: number }
}

type ActionResult = { ok: boolean; status?: number; data: Record<string, unknown> }

async function platform(path: string, method: 'GET' | 'POST', body?: unknown): Promise<ActionResult> {
  try {
    const res = await fetch(`${PLATFORM}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ops-secret': OPS_SECRET },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(120_000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) } }
  }
}

const state = {
  startedAt: new Date().toISOString(),
  cycles: 0,
  lastCycleAt: null as string | null,
  lastCycleSummary: null as Record<string, unknown> | null,
  lastError: null as string | null,
  actions: [] as Array<{ cycle: number; at: string; action: string; result: string }>,
  healthy: false,
}

async function heartbeat() {
  await platform('/api/ops/heartbeat', 'POST')
}

async function scan(): Promise<Scan | null> {
  const res = await platform('/api/ops/scan', 'GET')
  if (!res.ok) {
    state.lastError = `scan failed: HTTP ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`
    return null
  }
  return res.data as unknown as Scan
}

async function act(action: string, payload: Record<string, unknown>): Promise<ActionResult> {
  const res = await platform('/api/ops/act', 'POST', { action, payload })
  const summary = res.ok ? JSON.stringify(res.data).slice(0, 180) : `FAILED ${res.status}: ${JSON.stringify(res.data).slice(0, 120)}`
  state.actions.push({ cycle: state.cycles, at: new Date().toISOString(), action, result: summary })
  if (state.actions.length > 200) state.actions.splice(0, 100)
  console.log(`[act] ${action} → ${summary}`)
  return res
}

// ------------------------------------------------------------
// THE AUTONOMOUS LOOP
// ------------------------------------------------------------
async function runCycle() {
  state.cycles += 1
  const cycle = state.cycles
  console.log(`\n=== AI OPS CYCLE #${cycle} @ ${new Date().toISOString()} ===`)
  const performed: string[] = []

  await heartbeat()
  const data = await scan()
  if (!data) {
    console.log(`[ops] ${state.lastError}`)
    await act('LOG_CYCLE', { cycle, correlationId: `ops-${cycle}`, summary: { ok: false, error: state.lastError }, actions: performed })
    return
  }

  state.healthy = true

  // 1) LEAD SCORING — Sentry agent scores every unscored lead
  for (const lead of data.unscoredLeads.slice(0, 5)) {
    const r = await act('SCORE_LEAD', { clientId: lead.id })
    if (r.ok) performed.push(`scored ${lead.clientId}`)
  }

  // 2) OVERDUE LEAD FOLLOW-UP — Echo agent drafts, channels attempted honestly
  for (const lead of data.overdueLeads.slice(0, 3)) {
    const r = await act('FOLLOWUP_LEAD', { clientId: lead.id })
    performed.push(`followup ${lead.clientId} → ${String(r.data.sendStatus ?? r.data.error ?? '?')}`)
  }

  // 3) FAILED COMM RETRY — safe re-attempt with backoff
  for (const comm of data.retryableComms.slice(0, 3)) {
    const r = await act('RETRY_COMM', { commId: comm.id })
    performed.push(`retry ${comm.channel} → ${String(r.data.status ?? 'failed')}`)
  }

  // 4) ERROR TRIAGE — Sentinel agent classifies + remediation
  for (const err of data.unresolvedErrors.slice(0, 3)) {
    const r = await act('TRIAGE_ERROR', { errorId: err.id })
    performed.push(`triaged ${err.source} → ${String(r.data.severity ?? '?')}`)
  }

  // 5) STALE APPROVAL ALERTS — escalate to humans (their role: approvals)
  for (const appr of data.staleApprovals.slice(0, 3)) {
    await act('ALERT', { type: 'APPROVAL', title: `Approval pending >12h: ${appr.title}`, body: `Type ${appr.type} — Super Admin decision required.`, severity: 'WARNING' })
    performed.push(`approval-alert ${appr.type}`)
  }

  // 6) FAILED AUTOMATION ALERTS
  for (const auto of data.failedAutomations.slice(0, 3)) {
    await act('ALERT', { type: 'SYSTEM', title: `Failed automation: ${auto.workflow}`, body: (auto.error ?? '').slice(0, 300), severity: 'WARNING' })
    performed.push(`automation-alert ${auto.workflow}`)
  }

  // 7) LEARN — persistent lesson from this cycle (self-improvement trail)
  const lesson = `Cycle #${cycle}: scanned unscored=${data.unscoredLeads.length}, overdue=${data.overdueLeads.length}, failedComms=${data.retryableComms.length}, unresolvedErrors=${data.unresolvedErrors.length}; executed ${performed.length} actions; agents 24h=${data.context.agentExecutions24h} (total ${data.context.totalExecutions}, failures ${data.context.totalFailures}).`
  await act('LEARN', { insight: lesson })

  // 8) LOG the cycle into automation trail
  await act('LOG_CYCLE', {
    cycle, correlationId: `ops-${cycle}`,
    summary: { ok: true, scanned: { unscored: data.unscoredLeads.length, overdue: data.overdueLeads.length, failedComms: data.retryableComms.length, errors: data.unresolvedErrors.length }, performed: performed.length },
    actions: performed.slice(0, 40),
  })

  state.lastCycleAt = new Date().toISOString()
  state.lastCycleSummary = { cycle, performed: performed.length, scanned: { unscored: data.unscoredLeads.length, overdue: data.overdueLeads.length } }
  console.log(`[ops] cycle #${cycle} complete — ${performed.length} actions`)

  // Daily CEO report at 08:00 Asia/Dhaka
  const now = new Date()
  const dhaka = new Date(now.toLocaleString('en-US', { timeZone: TZ }))
  if (dhaka.getHours() === 8 && dhaka.getMinutes() < 2 && cycle > 1) {
    await act('RUN_AGENT', { code: 'RPT-039', input: `Generate today's CEO daily report. Use the live context: ${lesson}`, expectJson: false })
    performed.push('ceo-report')
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
        intervalSec: INTERVAL_SEC,
        startedAt: state.startedAt,
        cycles: state.cycles,
        lastCycleAt: state.lastCycleAt,
        lastCycleSummary: state.lastCycleSummary,
        lastError: state.lastError,
        recentActions: state.actions.slice(-15),
        engine: 'Conductor (OPS-044) + Sentry + Echo + Sentinel + Pulse agents via platform execution API',
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

console.log(`[tech360-ai-ops] Autonomous AI operations service listening on :${PORT}`)
console.log(`[tech360-ai-ops] Platform: ${PLATFORM} · loop every ${INTERVAL_SEC}s`)

// first cycle after platform is warm, then the loop
setTimeout(() => {
  runCycle().catch((e) => { state.lastError = String(e); console.error('[ops] cycle error', e) })
  setInterval(() => {
    runCycle().catch((e) => { state.lastError = String(e); console.error('[ops] cycle error', e) })
  }, INTERVAL_SEC * 1000)
}, 5000)
