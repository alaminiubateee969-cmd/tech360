import { db } from '@/lib/db'
import { executeOpsAction } from '@/lib/ops-actions'
import { generateCeoReport } from '@/lib/reports'
import { logError } from '@/lib/security'

// ============================================================
// TECH360 AUTONOMOUS OPERATIONS LOOP — the production engine.
//
// DETECT (opsScan) → UNDERSTAND/DECIDE (deterministic governance
// rules + platform agents) → EXECUTE (real actions) → VERIFY →
// LOG (automation trail + audit) → LEARN (persistent lessons).
//
// Runs in-process so production (Cloud Run) needs no sidecar:
// Cloud Scheduler POSTs /api/ops/cycle with the OPS_SECRET header
// every minute; the endpoint throttles to one cycle per interval.
// The dev mini-service (mini-services/ai-ops) calls the same
// endpoint, so dev and prod run the exact same loop.
// ============================================================

const TZ = 'Asia/Dhaka'
export const MIN_CYCLE_INTERVAL_MS = 45_000

export type OpsScan = {
  ts: string
  unscoredLeads: Array<{ id: string; clientId: string; name: string; businessName: string | null; businessType: string | null; source: string; lead: { requirements: string | null; budgetRange: string | null; projectType: string | null } | null }>
  overdueLeads: Array<{ id: string; clientId: string; name: string; whatsapp: string | null; email: string | null; pipelineStage: string; updatedAt: Date }>
  retryableComms: Array<{ id: string; clientId: string | null; channel: string; recipient: string | null; body: string; subject: string | null; error: string | null }>
  failedAutomations: Array<{ id: string; workflow: string; error: string | null; correlationId: string | null; clientId: string | null }>
  unresolvedErrors: Array<{ id: string; source: string; code: string | null; message: string; correlationId: string | null }>
  staleApprovals: Array<{ id: string; type: string; title: string; clientId: string | null; createdAt: Date }>
  expiredPreviews: Array<{ id: string; token: string; clientId: string | null; status: string; expiresAt: Date | null; version: number }>
  quarantinedDocs: Array<{ id: string; originalName: string; scanStatus: string; createdAt: Date; client: { clientId: string; name: string } | null }>
  context: { agentExecutions24h: number; agents: number; totalExecutions: number; totalSuccesses: number; totalFailures: number }
}

export type CycleSummary = {
  cycle: number
  trigger: string
  startedAt: string
  finishedAt: string
  ok: boolean
  performed: string[]
  scanned: { unscored: number; overdue: number; failedComms: number; errors: number; staleApprovals: number; failedAutomations: number; expiredPreviews: number; quarantinedDocs: number }
  ceoReport?: { id: string } | { skipped: string } | null
  error?: string
}

// ---------- DETECT ----------
export async function opsScan(): Promise<OpsScan> {
  const now = Date.now()
  const overdueMs = 48 * 3600 * 1000 // 48h without activity before CLIENT_APPROVAL
  const dayAgo = new Date(now - 24 * 3600 * 1000)

  const [unscoredLeads, activeClients, retryableComms, failedAutomations, unresolvedErrors, staleApprovals, expiringPreviews, quarantinedDocs, execToday, agentStats] = await Promise.all([
    db.client.findMany({ where: { score: 0, deletedAt: null }, select: { id: true, clientId: true, name: true, businessName: true, businessType: true, source: true, lead: { select: { requirements: true, budgetRange: true, projectType: true } } }, take: 10 }),
    db.client.findMany({
      where: { deletedAt: null, pipelineStage: { in: ['NEW', 'CONTACTED', 'BUSINESS_IDENTIFIED', 'PLAN_RECOMMENDED', 'SCOPE_COLLECTION', 'SCOPE_REVIEW', 'FINAL_SCOPE'] }, updatedAt: { lt: new Date(now - overdueMs) } },
      select: { id: true, clientId: true, name: true, whatsapp: true, email: true, pipelineStage: true, updatedAt: true },
      take: 10,
    }),
    db.communication.findMany({ where: { status: 'FAILED', direction: 'OUT', createdAt: { gte: new Date(now - 7 * 24 * 3600 * 1000) } }, orderBy: { createdAt: 'asc' }, take: 10, select: { id: true, clientId: true, channel: true, recipient: true, body: true, subject: true, error: true } }),
    db.automationLog.findMany({ where: { status: 'FAILED', startedAt: { gte: new Date(now - 24 * 3600 * 1000) } }, orderBy: { startedAt: 'desc' }, take: 10, select: { id: true, workflow: true, error: true, correlationId: true, clientId: true } }),
    db.errorLog.findMany({ where: { resolved: false, createdAt: { gte: new Date(now - 24 * 3600 * 1000) } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, source: true, code: true, message: true, correlationId: true } }),
    db.approvalRequest.findMany({ where: { status: 'PENDING', createdAt: { lt: new Date(now - 12 * 3600 * 1000) } }, take: 10, select: { id: true, type: true, title: true, clientId: true, createdAt: true } }),
    // security: previews past expiry that are still active → must be marked EXPIRED + alert
    db.preview.findMany({ where: { status: { in: ['GENERATED', 'SENT', 'VIEWED'] }, expiresAt: { lt: new Date(now) } }, take: 10, select: { id: true, token: true, clientId: true, status: true, expiresAt: true, version: true } }),
    // documents hub: quarantined client uploads pending human review for >24h → escalate
    db.fileRecord.findMany({
      where: { scanStatus: 'QUARANTINED', relatedType: 'CLIENT_UPLOAD', createdAt: { lt: new Date(now - 24 * 3600 * 1000) } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true, originalName: true, scanStatus: true, createdAt: true, client: { select: { clientId: true, name: true } } },
    }),
    db.aiAgentExecution.count({ where: { createdAt: { gte: dayAgo } } }),
    db.aiAgent.aggregate({ _count: true, _sum: { executionCount: true, successCount: true, failureCount: true } }),
  ])

  return {
    ts: new Date().toISOString(),
    unscoredLeads,
    overdueLeads: activeClients,
    retryableComms,
    failedAutomations,
    unresolvedErrors,
    staleApprovals,
    expiredPreviews: expiringPreviews,
    quarantinedDocs,
    context: {
      agentExecutions24h: execToday,
      agents: agentStats._count,
      totalExecutions: agentStats._sum.executionCount ?? 0,
      totalSuccesses: agentStats._sum.successCount ?? 0,
      totalFailures: agentStats._sum.failureCount ?? 0,
    },
  }
}

// ---------- heartbeat (settings key kept identical to the old format) ----------
export async function recordHeartbeat(): Promise<number> {
  const existing = await db.setting.findUnique({ where: { key: 'ops.heartbeat' } })
  let cycles = 1
  if (existing) {
    try {
      const parsed = JSON.parse(existing.value) as { cycles?: number }
      cycles = (parsed.cycles ?? 0) + 1
    } catch {
      cycles = 1
    }
  }
  const value = JSON.stringify({ at: new Date().toISOString(), cycles, service: 'tech360-ai-ops' })
  if (existing) await db.setting.update({ where: { key: 'ops.heartbeat' }, data: { value } })
  else await db.setting.create({ data: { key: 'ops.heartbeat', value } })
  return cycles
}

// ---------- throttle guard for the scheduler endpoint ----------
export async function cycleThrottled(minIntervalMs = MIN_CYCLE_INTERVAL_MS): Promise<{ throttled: boolean; lastRunAt: string | null }> {
  const row = await db.setting.findUnique({ where: { key: 'ops.cycle.lastRun' } })
  if (!row) return { throttled: false, lastRunAt: null }
  const at = new Date(row.value)
  if (Number.isNaN(at.getTime())) return { throttled: false, lastRunAt: null }
  return { throttled: Date.now() - at.getTime() < minIntervalMs, lastRunAt: row.value }
}

async function markCycleRun(): Promise<void> {
  const value = new Date().toISOString()
  const existing = await db.setting.findUnique({ where: { key: 'ops.cycle.lastRun' } })
  if (existing) await db.setting.update({ where: { key: 'ops.cycle.lastRun' }, data: { value } })
  else await db.setting.create({ data: { key: 'ops.cycle.lastRun', value } })
}

// ---------- the daily CEO report guard (idempotent per Asia/Dhaka day) ----------
async function ceoReportDue(): Promise<boolean> {
  const dhaka = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, dateStyle: 'short' }).format(new Date()) // YYYY-MM-DD
  const startOfDay = new Date(`${dhaka}T00:00:00+06:00`) // Dhaka is UTC+6, no DST
  const dhakaHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()))
  if (dhakaHour < 8) return false // not yet 08:00 local
  const existing = await db.ceoReport.count({ where: { trigger: 'SCHEDULED', createdAt: { gte: startOfDay } } })
  return existing === 0
}

// ---------- THE AUTONOMOUS LOOP ----------
export async function runOpsCycle(trigger: 'SERVICE' | 'SCHEDULER' | 'MANUAL' = 'SCHEDULER'): Promise<CycleSummary> {
  const startedAt = new Date().toISOString()
  const cycle = await recordHeartbeat()
  const performed: string[] = []
  const scanned: CycleSummary['scanned'] = { unscored: 0, overdue: 0, failedComms: 0, errors: 0, staleApprovals: 0, failedAutomations: 0, expiredPreviews: 0, quarantinedDocs: 0 }
  let ceoReport: CycleSummary['ceoReport'] = null
  let ok = true
  let error: string | undefined

  await markCycleRun()

  try {
    const data = await opsScan()
    scanned.unscored = data.unscoredLeads.length
    scanned.overdue = data.overdueLeads.length
    scanned.failedComms = data.retryableComms.length
    scanned.errors = data.unresolvedErrors.length
    scanned.staleApprovals = data.staleApprovals.length
    scanned.failedAutomations = data.failedAutomations.length
    scanned.expiredPreviews = data.expiredPreviews.length
    scanned.quarantinedDocs = data.quarantinedDocs.length

    // 1) LEAD SCORING — Sentry agent scores every unscored lead
    for (const lead of data.unscoredLeads.slice(0, 5)) {
      const r = await executeOpsAction('SCORE_LEAD', { clientId: lead.id })
      if (r.ok) performed.push(`scored ${lead.clientId}`)
    }

    // 2) OVERDUE LEAD FOLLOW-UP — Echo agent drafts, channels attempted honestly
    for (const lead of data.overdueLeads.slice(0, 3)) {
      const r = await executeOpsAction('FOLLOWUP_LEAD', { clientId: lead.id })
      performed.push(`followup ${lead.clientId} → ${String(r.data.sendStatus ?? r.data.error ?? '?')}`)
    }

    // 3) FAILED COMM RETRY — safe re-attempt with backoff
    for (const comm of data.retryableComms.slice(0, 3)) {
      const r = await executeOpsAction('RETRY_COMM', { commId: comm.id })
      performed.push(`retry ${comm.channel} → ${String(r.data.status ?? 'failed')}`)
    }

    // 4) ERROR TRIAGE — Sentinel agent classifies + proposes remediation
    for (const err of data.unresolvedErrors.slice(0, 3)) {
      const r = await executeOpsAction('TRIAGE_ERROR', { errorId: err.id })
      performed.push(`triaged ${err.source} → ${String(r.data.severity ?? '?')}`)
    }

    // 5) STALE APPROVAL ALERTS — escalate to humans (their role: approvals)
    for (const appr of data.staleApprovals.slice(0, 3)) {
      await executeOpsAction('ALERT', { type: 'APPROVAL', title: `Approval pending >12h: ${appr.title}`, body: `Type ${appr.type} — Super Admin decision required.`, severity: 'WARNING' })
      performed.push(`approval-alert ${appr.type}`)
    }

    // 6) FAILED AUTOMATION ALERTS
    for (const auto of data.failedAutomations.slice(0, 3)) {
      await executeOpsAction('ALERT', { type: 'SYSTEM', title: `Failed automation: ${auto.workflow}`, body: (auto.error ?? '').slice(0, 300), severity: 'WARNING' })
      performed.push(`automation-alert ${auto.workflow}`)
    }

    // 6b) PREVIEW EXPIRY — security enforcement: kill stale tokenized links
    if (data.expiredPreviews.length) {
      const r = await executeOpsAction('EXPIRE_PREVIEWS', { previewIds: data.expiredPreviews.map((p) => p.id) })
      performed.push(`expired ${String(r.data.expired ?? 0)} preview link(s)`)
    }

    // 6c) SCHEDULED CONTENT — publish blog posts that reached their time
    const blog = await executeOpsAction('PUBLISH_DUE_BLOG_POSTS', {})
    if (Number(blog.data.published ?? 0) > 0) performed.push(`published ${blog.data.published} scheduled post(s)`)

    // 6d) DOCUMENTS HUB — quarantined uploads pending human review >24h get escalated
    for (const doc of data.quarantinedDocs.slice(0, 5)) {
      await executeOpsAction('ALERT', {
        type: 'CLIENT_DOC',
        title: `Quarantined document awaiting review: ${doc.originalName}`,
        body: `${doc.client?.clientId ?? 'unknown client'} · ${doc.client?.name ?? ''} uploaded "${doc.originalName}" — locked by the content scan for over 24h. A human must RELEASE or REJECT it in the client's Documents tab.`,
        severity: 'WARNING',
      })
      performed.push(`doc-escalation ${doc.client?.clientId ?? doc.id}`)
    }

    // 7) DAILY CEO REPORT (08:00+ Asia/Dhaka, idempotent per day) — persisted to the archive
    if (await ceoReportDue()) {
      const report = await generateCeoReport('ops:ai-operations', 'SCHEDULED')
      ceoReport = { id: report.id }
      performed.push('ceo-report (scheduled, archived)')
    } else {
      ceoReport = { skipped: 'not due yet or already generated today' }
    }

    // 8) LEARN — persistent lesson from this cycle (self-improvement trail)
    const lesson = `Cycle #${cycle}: scanned unscored=${data.unscoredLeads.length}, overdue=${data.overdueLeads.length}, failedComms=${data.retryableComms.length}, unresolvedErrors=${data.unresolvedErrors.length}, expiredPreviews=${data.expiredPreviews.length}, quarantinedDocs=${data.quarantinedDocs.length}; executed ${performed.length} actions; agents 24h=${data.context.agentExecutions24h} (total ${data.context.totalExecutions}, failures ${data.context.totalFailures}).`
    await executeOpsAction('LEARN', { insight: lesson })

    // 9) LOG the cycle into the automation trail + audit
    await executeOpsAction('LOG_CYCLE', {
      cycle, trigger, correlationId: `ops-${cycle}`,
      summary: { ok: true, scanned: { unscored: data.unscoredLeads.length, overdue: data.overdueLeads.length, failedComms: data.retryableComms.length, errors: data.unresolvedErrors.length }, performed: performed.length },
      actions: performed.slice(0, 40),
    })
  } catch (e) {
    ok = false
    error = e instanceof Error ? e.message : String(e)
    await logError({ source: 'AUTOMATION', code: 'OPS_CYCLE_FAILED', message: error, workflow: 'AI_OPS_LOOP' })
    await executeOpsAction('LOG_CYCLE', {
      cycle, trigger, correlationId: `ops-${cycle}`,
      summary: { ok: false, error }, actions: performed,
    }).catch(() => null)
  }

  return {
    cycle, trigger, startedAt,
    finishedAt: new Date().toISOString(),
    ok, performed, error,
    scanned,
    ceoReport,
  }
}
