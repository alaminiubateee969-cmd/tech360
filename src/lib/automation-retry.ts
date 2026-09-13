import { db } from '@/lib/db'
import { audit, sanitizeText } from '@/lib/security'
import { finalizeScopeAndSend, generatePreview } from '@/lib/journey'
import { runOpsCycle } from '@/lib/ops-loop'
import { createNotification } from '@/lib/notify'

// ============================================================
// FAILED AUTOMATION RETRY — real replay through the same engine
// functions that produced the original run. Only workflows with
// a SAFE replay routine are retryable; everything else is
// refused with an honest reason (never a fake success).
//
// Provenance: the original log keeps its history — attempts++,
// status RETRYING → SUCCESS/FAILED, a "retried" step records
// who retried and what happened. The replay itself creates its
// own fresh AutomationLog (trigger ADMIN_RETRY) because it runs
// the real journey function. Every retry is audited and the ops
// notification feed is informed.
// ============================================================

export type RetryOutcome = {
  ok: boolean
  retryable: boolean
  message: string
  newStatus?: string
  attempts?: number
}

const MAX_ATTEMPTS = 5

// Workflows that have a safe replay routine. Everything not
// listed here is refused honestly.
const RETRYABLE: Record<string, string> = {
  FINAL_SCOPE: 'Re-send the approved Final Scope of Work to the client',
  PREVIEW_REFRESH_REQUEST: 'Regenerate a fresh tokenized preview link for the client',
  AI_OPS_LOOP: 'Run one autonomous operations cycle now',
}

export function retryPolicy(workflow: string): { retryable: boolean; description?: string } {
  const description = RETRYABLE[workflow]
  return description ? { retryable: true, description } : { retryable: false }
}

async function appendStep(logId: string, step: string, detail: unknown) {
  const log = await db.automationLog.findUnique({ where: { id: logId } })
  if (!log) return
  let steps: unknown[] = []
  try { steps = log.steps ? (JSON.parse(log.steps) as unknown[]) : [] } catch { steps = [] }
  steps.push({ step, detail, at: new Date().toISOString() })
  await db.automationLog.update({
    where: { id: logId },
    data: { steps: JSON.stringify(steps).slice(0, 12000) },
  })
}

export async function retryAutomationLog(logId: string, admin: { id: string; email: string }): Promise<RetryOutcome> {
  const log = await db.automationLog.findUnique({ where: { id: sanitizeText(logId, 40) } })
  if (!log) return { ok: false, retryable: true, message: 'Automation run not found.' }

  if (log.status !== 'FAILED') {
    return { ok: false, retryable: true, message: `Only FAILED runs can be retried — this one is ${log.status}.` }
  }
  const policy = retryPolicy(log.workflow)
  if (!policy.retryable) {
    return {
      ok: false,
      retryable: false,
      message: `${log.workflow} has no safe replay routine — re-trigger it from its source. Refusing to fake a retry.`,
    }
  }
  if (log.attempts >= MAX_ATTEMPTS) {
    return { ok: false, retryable: true, message: `Retry limit reached (${log.attempts} attempts). Engineering review required.` }
  }

  // Mark the original as retrying, with provenance.
  await db.automationLog.update({ where: { id: log.id }, data: { status: 'RETRYING', attempts: log.attempts + 1 } })
  await appendStep(log.id, 'retry', { by: admin.email, at: new Date().toISOString() })

  const input = (() => {
    try { return log.input ? (JSON.parse(log.input) as Record<string, unknown>) : {} } catch { return {} }
  })()

  try {
    let result: unknown = null
    switch (log.workflow) {
      case 'FINAL_SCOPE': {
        const scopeId = typeof input.scopeId === 'string' ? input.scopeId : null
        if (!scopeId) throw new Error('Original run did not record a scopeId — cannot replay.')
        const scope = await db.scopeOfWork.findUnique({ where: { id: scopeId } })
        if (!scope) throw new Error('Scope no longer exists.')
        if (scope.status !== 'FINAL') {
          throw new Error(`Scope is now ${scope.status} (not FINAL) — re-send would bypass approval. Refused.`)
        }
        result = await finalizeScopeAndSend(scopeId, admin.id)
        break
      }
      case 'PREVIEW_REFRESH_REQUEST': {
        if (!log.clientId) throw new Error('Original run has no client attached — cannot replay.')
        result = await generatePreview(log.clientId)
        break
      }
      case 'AI_OPS_LOOP': {
        const cycle = await runOpsCycle('MANUAL')
        result = { cycle: cycle.cycle, ok: cycle.ok, performed: cycle.performed.length }
        if (!cycle.ok) throw new Error(cycle.error ?? 'Ops cycle failed')
        break
      }
      default:
        throw new Error('No replay routine')
    }

    // Success — the original failure stays visible in steps, status clears.
    await db.automationLog.update({ where: { id: log.id }, data: { status: 'SUCCESS', error: null } })
    await appendStep(log.id, 'retry-ok', { outcome: result, note: 'Recovered by manual retry' })
    await audit({
      actor: admin.email, action: 'AUTOMATION_RETRIED', userId: admin.id, entityId: log.id,
      details: { workflow: log.workflow, outcome: 'SUCCESS', attempt: log.attempts + 1 },
    })
    await createNotification({
      type: 'SYSTEM',
      title: `Automation recovered: ${log.workflow}`,
      body: `Admin ${admin.email} retried the failed ${log.workflow} run — replay succeeded. Original failure is preserved in the run's step history.`,
      severity: 'INFO',
    })
    return { ok: true, retryable: true, message: `${log.workflow} replayed successfully — the original failure is preserved in the run history.`, newStatus: 'SUCCESS', attempts: log.attempts + 1 }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db.automationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: `Retry #${log.attempts + 1}: ${message}`.slice(0, 2000) } })
    await appendStep(log.id, 'retry-failed', { error: message })
    await audit({
      actor: admin.email, action: 'AUTOMATION_RETRY_FAILED', userId: admin.id, entityId: log.id,
      details: { workflow: log.workflow, error: message.slice(0, 300) },
    })
    await createNotification({
      type: 'SYSTEM',
      title: `Automation retry failed: ${log.workflow}`,
      body: `Admin ${admin.email} retried the failed ${log.workflow} run — the replay itself failed: ${message.slice(0, 220)}`,
      severity: 'WARNING',
    })
    return { ok: false, retryable: true, message: `Retry failed: ${message}`, newStatus: 'FAILED', attempts: log.attempts + 1 }
  }
}
