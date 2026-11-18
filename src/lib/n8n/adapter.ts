// ============================================================
// TECH360 — n8n adapter (TECH360 is the control plane)
// ============================================================
// Outbound:  requestN8nExecution() signs a JSON request with HMAC-SHA256 and
//            POSTs it to the registered webhook path of an ENABLED workflow.
//            Every request is recorded as an N8nExecution row with a unique
//            correlation id before the network call is made.
// Inbound:   handleN8nCallback() is called by /api/webhooks/n8n/callback after
//            verifyN8nCallbackSignature() has accepted the timestamped HMAC.
//            Callbacks are idempotent per correlation id and resume the
//            automation run that requested the execution.
//
// Secrets stay server-side: the console only ever receives booleans, the host
// name and credential NAMES. Without configuration nothing is sent and the
// execution is recorded as NOT_CONFIGURED — never as a success.
// ============================================================

import { createHmac, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { constantTimeEquals } from '@/lib/security'
import { DEFAULT_TENANT_ID } from '@/lib/tenancy'
import { SITE_URL } from '@/lib/site-contact'

export const N8N_EXPECTED_VERSION = '2.20.7'
export const N8N_SIGNATURE_HEADER = 'x-tech360-signature'
export const N8N_TIMESTAMP_HEADER = 'x-tech360-timestamp'
export const N8N_CORRELATION_HEADER = 'x-tech360-correlation-id'
export const N8N_CALLBACK_MAX_SKEW_MS = 5 * 60 * 1000
const MIN_SECRET_LENGTH = 32

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type N8nConfig = {
  configured: boolean
  webhookBase: string | null
  healthUrl: string | null
  host: string | null
  outboundSecret: string | null
  callbackSecret: string | null
  missing: string[]
}

function cleanUrl(v: string | undefined): string | null {
  const s = (v ?? '').trim().replace(/\/+$/, '')
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return null
    return s
  } catch {
    return null
  }
}

/** Read configuration from the environment. Never returned to a browser as-is. */
export function readN8nConfig(env: Record<string, string | undefined> = process.env): N8nConfig {
  const base = cleanUrl(env.N8N_BASE_URL)
  const legacyWebhookBase = cleanUrl(env.N8N_WEBHOOK_BASE)
  const webhookBase = base ? `${base}/webhook` : legacyWebhookBase
  const origin = base ?? (legacyWebhookBase ? new URL(legacyWebhookBase).origin : null)
  const outbound = (env.N8N_OUTBOUND_SECRET || env.N8N_WEBHOOK_SECRET || '').trim()
  const callback = (env.N8N_CALLBACK_SECRET || env.N8N_WEBHOOK_SECRET || '').trim()
  const missing: string[] = []
  if (!webhookBase) missing.push('N8N_BASE_URL')
  if (outbound.length < MIN_SECRET_LENGTH) missing.push('N8N_OUTBOUND_SECRET (32+ chars)')
  if (callback.length < MIN_SECRET_LENGTH) missing.push('N8N_CALLBACK_SECRET (32+ chars)')
  return {
    configured: missing.length === 0,
    webhookBase,
    healthUrl: origin ? `${origin}/healthz` : null,
    host: origin ? new URL(origin).host : null,
    outboundSecret: outbound.length >= MIN_SECRET_LENGTH ? outbound : null,
    callbackSecret: callback.length >= MIN_SECRET_LENGTH ? callback : null,
    missing,
  }
}

export function signN8nBody(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export type CallbackVerdict = { ok: true } | { ok: false; status: number; code: string; error: string }

/** Verify a callback: secret configured, fresh timestamp, constant-time HMAC match. */
export function verifyN8nCallbackSignature(input: {
  rawBody: string
  signature: string | null
  timestamp: string | null
  now?: number
  config?: N8nConfig
}): CallbackVerdict {
  const config = input.config ?? readN8nConfig()
  if (!config.callbackSecret) return { ok: false, status: 503, code: 'N8N_NOT_CONFIGURED', error: 'n8n callback secret is not configured' }
  const ts = Number(input.timestamp)
  if (!input.timestamp || !Number.isFinite(ts)) return { ok: false, status: 401, code: 'BAD_TIMESTAMP', error: 'Missing or invalid timestamp' }
  const now = input.now ?? Date.now()
  if (Math.abs(now - ts) > N8N_CALLBACK_MAX_SKEW_MS) return { ok: false, status: 401, code: 'STALE_TIMESTAMP', error: 'Timestamp outside the allowed window' }
  const expected = signN8nBody(config.callbackSecret, input.timestamp, input.rawBody)
  if (!input.signature || !constantTimeEquals(input.signature.replace(/^sha256=/, ''), expected)) {
    return { ok: false, status: 401, code: 'BAD_SIGNATURE', error: 'Signature mismatch' }
  }
  return { ok: true }
}

/** Public status for the console — booleans, host and missing variable NAMES only. */
export async function n8nPublicStatus() {
  const config = readN8nConfig()
  const lastTest = await db.setting.findUnique({ where: { key: 'integration.connection.N8N' } }).catch(() => null)
  let test: { ok: boolean; testedAt: string; detail: string; httpStatus?: number | null } | null = null
  try { test = lastTest ? JSON.parse(lastTest.value) : null } catch { test = null }
  const state = !config.configured
    ? 'NOT_CONFIGURED'
    : !test
      ? 'CONFIGURED_UNTESTED'
      : test.ok ? 'CONNECTED' : 'CONNECTION_FAILED'
  return {
    state,
    configured: config.configured,
    host: config.host,
    expectedVersion: N8N_EXPECTED_VERSION,
    missing: config.missing,
    callbackUrl: `${SITE_URL}/api/webhooks/n8n/callback`,
    lastTest: test,
  }
}

/** Real connection test against the n8n /healthz endpoint. The result is persisted. */
export async function testN8nConnection(deps: { fetch?: FetchLike; config?: N8nConfig } = {}) {
  const config = deps.config ?? readN8nConfig()
  const doFetch = deps.fetch ?? (fetch as FetchLike)
  let result: { ok: boolean; testedAt: string; detail: string; httpStatus: number | null }
  if (!config.healthUrl) {
    result = { ok: false, testedAt: new Date().toISOString(), detail: 'NOT CONFIGURED: N8N_BASE_URL is not set', httpStatus: null }
  } else {
    try {
      const res = await doFetch(config.healthUrl, { method: 'GET', signal: AbortSignal.timeout(8000) })
      result = { ok: res.ok, testedAt: new Date().toISOString(), detail: res.ok ? `n8n health endpoint answered HTTP ${res.status}` : `n8n health endpoint answered HTTP ${res.status}`, httpStatus: res.status }
    } catch (e) {
      result = { ok: false, testedAt: new Date().toISOString(), detail: `Network error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), httpStatus: null }
    }
  }
  await db.setting.upsert({
    where: { key: 'integration.connection.N8N' },
    create: { key: 'integration.connection.N8N', value: JSON.stringify(result) },
    update: { value: JSON.stringify(result) },
  }).catch(() => null)
  return result
}

export type N8nExecutionRow = Awaited<ReturnType<typeof db.n8nExecution.create>>

export class N8nWorkflowNotFoundError extends Error {
  constructor(code: string) { super(`n8n workflow ${code} is not in the registry for this tenant`); this.name = 'N8nWorkflowNotFoundError' }
}

/**
 * Request an execution. Always persists an N8nExecution row and returns it.
 * Status meanings: ACCEPTED = n8n answered 2xx (the workflow has NOT finished;
 * completion arrives via callback), NOT_CONFIGURED / DISABLED = nothing was
 * sent, FAILED = n8n refused or the network failed after retries.
 */
export async function requestN8nExecution(input: {
  tenantId?: string
  workflowCode: string
  payload: Record<string, unknown>
  automationRunId?: string | null
  requestedBy?: string | null
  correlationId?: string
}, deps: { fetch?: FetchLike; config?: N8nConfig; maxAttempts?: number } = {}): Promise<N8nExecutionRow> {
  const tenantId = input.tenantId || DEFAULT_TENANT_ID
  const workflow = await db.n8nWorkflow.findFirst({ where: { code: input.workflowCode, tenantId } })
  if (!workflow) throw new N8nWorkflowNotFoundError(input.workflowCode)
  const config = deps.config ?? readN8nConfig()
  const correlationId = input.correlationId ?? `n8n_${randomUUID()}`
  const callbackUrl = `${SITE_URL}/api/webhooks/n8n/callback`
  const envelope = { correlationId, workflowCode: workflow.code, tenantId, callbackUrl, payload: input.payload }
  const requestPayload = JSON.stringify(envelope)

  const blocked = !workflow.enabled
    ? { status: 'DISABLED', error: 'Workflow is disabled in the TECH360 registry; nothing was sent.' }
    : !config.configured || !config.webhookBase || !config.outboundSecret
      ? { status: 'NOT_CONFIGURED', error: `n8n is NOT CONFIGURED (${config.missing.join(', ')}); nothing was sent.` }
      : !workflow.webhookPath
        ? { status: 'NOT_CONFIGURED', error: 'The workflow has no webhook path registered; nothing was sent.' }
        : null

  const execution = await db.n8nExecution.create({
    data: {
      tenantId,
      workflowCode: workflow.code,
      correlationId,
      status: blocked ? blocked.status : 'REQUESTED',
      requestPayload: requestPayload.slice(0, 60_000),
      error: blocked?.error ?? null,
      automationRunId: input.automationRunId ?? null,
      requestedBy: input.requestedBy ?? null,
      finishedAt: blocked ? new Date() : null,
    },
  })
  if (blocked) return execution

  const doFetch = deps.fetch ?? (fetch as FetchLike)
  const url = `${config.webhookBase}/${String(workflow.webhookPath).replace(/^\/+/, '')}`
  const maxAttempts = Math.max(1, Math.min(deps.maxAttempts ?? 2, 3))
  let attempts = 0
  let lastError = ''
  let httpStatus: number | null = null
  let responseBody = ''
  while (attempts < maxAttempts) {
    attempts += 1
    const timestamp = String(Date.now())
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [N8N_TIMESTAMP_HEADER]: timestamp,
          [N8N_SIGNATURE_HEADER]: `sha256=${signN8nBody(config.outboundSecret as string, timestamp, requestPayload)}`,
          [N8N_CORRELATION_HEADER]: correlationId,
        },
        body: requestPayload,
        signal: AbortSignal.timeout(workflow.timeoutMs || 15_000),
      })
      httpStatus = res.status
      responseBody = (await res.text().catch(() => '')).slice(0, 2000)
      if (res.ok) {
        lastError = ''
        break
      }
      lastError = `n8n answered HTTP ${res.status}`
      if (res.status < 500 && res.status !== 429) break // client errors are not retried
    } catch (e) {
      lastError = `Network error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500)
    }
  }
  const accepted = !lastError
  const updated = await db.n8nExecution.update({
    where: { id: execution.id },
    data: {
      status: accepted ? 'ACCEPTED' : 'FAILED',
      attempts,
      httpStatus,
      responseBody: responseBody || null,
      error: accepted ? null : lastError,
      finishedAt: accepted ? null : new Date(),
    },
  })
  await db.n8nWorkflow.update({
    where: { id: workflow.id },
    data: { lastRunAt: new Date(), lastRunStatus: accepted ? 'ACCEPTED' : 'FAILED', status: accepted ? 'RUNNING' : 'ERROR' },
  }).catch(() => null)
  return updated
}

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'NOT_CONFIGURED', 'DISABLED'])

/** Apply a verified callback. Returns `duplicate: true` when the execution was already terminal. */
export async function handleN8nCallback(input: {
  correlationId: string
  status: string
  output?: unknown
  error?: string | null
}): Promise<{ ok: true; duplicate: boolean; execution: N8nExecutionRow } | { ok: false; code: 'UNKNOWN_CORRELATION' | 'BAD_STATUS' }> {
  const status = input.status.toUpperCase()
  if (!['RUNNING', 'SUCCEEDED', 'FAILED'].includes(status)) return { ok: false, code: 'BAD_STATUS' }
  const execution = await db.n8nExecution.findUnique({ where: { correlationId: input.correlationId } })
  if (!execution) return { ok: false, code: 'UNKNOWN_CORRELATION' }
  if (TERMINAL.has(execution.status)) return { ok: true, duplicate: true, execution }
  const terminal = status !== 'RUNNING'
  // Conditional update: only one concurrent callback can move it to a terminal state.
  const claimed = await db.n8nExecution.updateMany({
    where: { id: execution.id, status: { notIn: [...TERMINAL] } },
    data: {
      status,
      callbackReceivedAt: new Date(),
      responseBody: input.output !== undefined ? JSON.stringify(input.output).slice(0, 4000) : execution.responseBody,
      error: status === 'FAILED' ? (input.error || 'n8n reported a failure').slice(0, 2000) : null,
      finishedAt: terminal ? new Date() : null,
    },
  })
  const fresh = await db.n8nExecution.findUniqueOrThrow({ where: { id: execution.id } })
  if (claimed.count === 0) return { ok: true, duplicate: true, execution: fresh }
  await db.n8nWorkflow.updateMany({
    where: { code: execution.workflowCode, tenantId: execution.tenantId },
    data: { lastRunStatus: status, status: status === 'FAILED' ? 'ERROR' : status === 'SUCCEEDED' ? 'IMPORTED' : 'RUNNING' },
  }).catch(() => null)
  if (terminal && execution.automationRunId) {
    const { resumeRunAfterExternal } = await import('@/lib/automation/engine')
    await resumeRunAfterExternal(execution.automationRunId, {
      correlationId: execution.correlationId,
      ok: status === 'SUCCEEDED',
      detail: status === 'SUCCEEDED' ? 'n8n reported success' : (input.error || 'n8n reported a failure'),
    }).catch(() => null)
  }
  // Run-owned executions report failure through the run itself (no self-retriggering loop).
  if (status === 'FAILED' && !execution.automationRunId) {
    const { emitAutomationEvent } = await import('@/lib/automation/engine')
    await emitAutomationEvent({
      tenantId: execution.tenantId,
      type: 'INTEGRATION_FAILED',
      source: 'N8N',
      subjectType: 'N8nExecution',
      subjectId: execution.id,
      payload: { integration: 'N8N', workflowCode: execution.workflowCode, error: (input.error || '').slice(0, 300) },
      dedupeKey: `integration_failed:n8n:${execution.id}`,
    }).catch(() => null)
  }
  return { ok: true, duplicate: false, execution: fresh }
}
