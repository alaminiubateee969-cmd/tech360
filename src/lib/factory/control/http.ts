/** Shared HTTP plumbing for the control-plane API routes. */
import { guard, isResponse } from '@/lib/api-guard'
import { apiError } from '@/lib/security'
import type { Actor } from './access'

export async function requireActor(req: Request, minRole = 'SUPER_ADMIN'): Promise<{ actor: Actor } | Response> {
  const g = await guard(req, { minRole })
  if (isResponse(g)) return g
  return { actor: { email: g.user.email, role: g.user.role, userId: g.user.id, ip: g.ip } }
}

export function guardFailed(result: { actor: Actor } | Response): result is Response {
  return isResponse(result)
}

export function bad(message: string, status = 400, code?: string): Response {
  return apiError(message, status, code)
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const value: unknown = await req.json().catch(() => ({}))
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function text(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function noStore(data: unknown, status = 200): Response {
  return Response.json(data as Record<string, unknown>, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
