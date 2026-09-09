import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

// ------------------------------------------------------------
// Rate limiting — in-memory sliding window per IP + bucket
// ------------------------------------------------------------
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }
  b.count++
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// ------------------------------------------------------------
// Input sanitization / validation helpers
// ------------------------------------------------------------
export function sanitizeText(input: unknown, maxLength = 5000): string {
  if (typeof input !== 'string') return ''
  // strip control chars & null bytes; trim; cap length
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeEmail(input: unknown): string {
  const s = sanitizeText(input, 320).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ''
}

export function sanitizePhone(input: unknown): string {
  const s = sanitizeText(input, 32)
  const cleaned = s.replace(/[^\d+]/g, '')
  return cleaned.startsWith('+') ? cleaned : cleaned ? `+${cleaned.replace(/^\+/, '')}` : ''
}

export function isSafeJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function newCorrelationId(): string {
  return randomBytes(12).toString('hex')
}

// ------------------------------------------------------------
// Logging — audit trail + error log with correlation
// ------------------------------------------------------------
export async function audit(entry: {
  actor: string
  action: string
  entityType?: string
  entityId?: string
  clientId?: string
  projectId?: string
  details?: unknown
  ip?: string
  userAgent?: string
  userId?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        clientId: entry.clientId ?? null,
        projectId: entry.projectId ?? null,
        details: entry.details ? JSON.stringify(entry.details).slice(0, 8000) : null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        userId: entry.userId ?? null,
      },
    })
  } catch (e) {
    console.error('[audit] failed to write audit log', e)
  }
}

export async function logError(entry: {
  source: string
  code?: string
  message: string
  stack?: string
  correlationId?: string
  clientId?: string
  projectId?: string
  workflow?: string
}) {
  try {
    await db.errorLog.create({
      data: {
        source: entry.source,
        code: entry.code ?? null,
        message: entry.message.slice(0, 2000),
        stack: entry.stack ? entry.stack.slice(0, 8000) : null,
        correlationId: entry.correlationId ?? null,
        clientId: entry.clientId ?? null,
        projectId: entry.projectId ?? null,
        workflow: entry.workflow ?? null,
      },
    })
    await db.notification.create({
      data: {
        type: 'ERROR',
        title: `Error: ${entry.source}`,
        body: entry.message.slice(0, 300),
        severity: 'WARNING',
      },
    }).catch(() => null)
  } catch (e) {
    console.error('[errorlog] failed', e)
  }
}

// ------------------------------------------------------------
// API helpers
// ------------------------------------------------------------
export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(data as Record<string, unknown>, { status, headers })
}

export function apiError(message: string, status = 400, code?: string) {
  return Response.json({ error: message, code: code ?? null }, { status })
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}
