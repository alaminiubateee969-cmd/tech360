import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import {
  FEATURE_FLAG_DEFINITIONS,
  GATEWAY_DEFINITIONS,
  getFeatureFlags,
  saveFeatureFlags,
  resetFeatureFlags,
  getPaymentGateways,
  saveGatewayOverrides,
  type FeatureFlag,
  type GatewayCode,
  type GatewayMode,
} from '@/lib/features'

export const dynamic = 'force-dynamic'

// ============================================================
// SUPER ADMIN GOVERNANCE API — real switches, real enforcement.
// GET    → current flags + gateway statuses (+ definitions)
// PUT    → { flags?: {...}, gateways?: { CODE: {enabled?, mode?} } }
// DELETE → reset feature flags to defaults
// Super Admin only — these switches control live platform
// behavior, so they are guarded more tightly than normal admin.
// ============================================================

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const [flags, gateways] = await Promise.all([getFeatureFlags(true), getPaymentGateways(true)])
  return Response.json({
    flags,
    flagDefinitions: FEATURE_FLAG_DEFINITIONS,
    gateways,
    gatewayDefinitions: GATEWAY_DEFINITIONS.map(({ code, name, settlement, credentialEnvVars, supportsWebhook, supportsRefund, instructionsNote, defaultEnabled }) => ({
      code,
      name,
      settlement,
      credentialEnvVars,
      supportsWebhook,
      supportsRefund,
      instructionsNote,
      defaultEnabled,
    })),
  })
}

export async function PUT(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  let body: { flags?: Record<string, unknown>; gateways?: Record<string, { enabled?: unknown; mode?: unknown }> }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validFlagKeys = new Set(FEATURE_FLAG_DEFINITIONS.map((d) => d.key as string))
  const validGatewayCodes = new Set(GATEWAY_DEFINITIONS.map((d) => d.code as string))
  const changes: string[] = []

  // ---- Feature flags ----
  if (body.flags && typeof body.flags === 'object') {
    const overrides: Partial<Record<FeatureFlag, boolean>> = {}
    for (const [k, v] of Object.entries(body.flags)) {
      if (!validFlagKeys.has(k)) continue
      overrides[k as FeatureFlag] = Boolean(v)
    }
    if (Object.keys(overrides).length > 0) {
      await saveFeatureFlags(overrides)
      for (const [k, v] of Object.entries(overrides)) changes.push(`flag ${k}=${v ? 'ON' : 'OFF'}`)
    }
  }

  // ---- Payment gateways ----
  if (body.gateways && typeof body.gateways === 'object') {
    const overrides: Partial<Record<GatewayCode, { enabled?: boolean; mode?: GatewayMode }>> = {}
    for (const [k, v] of Object.entries(body.gateways)) {
      if (!validGatewayCodes.has(k) || !v || typeof v !== 'object') continue
      const o: { enabled?: boolean; mode?: GatewayMode } = {}
      if (v.enabled !== undefined) o.enabled = Boolean(v.enabled)
      if (v.mode === 'SANDBOX' || v.mode === 'PRODUCTION') o.mode = v.mode
      if (Object.keys(o).length > 0) overrides[k as GatewayCode] = o
    }
    if (Object.keys(overrides).length > 0) {
      await saveGatewayOverrides(overrides)
      for (const [code, o] of Object.entries(overrides)) {
        if (o.enabled !== undefined) changes.push(`gateway ${code}=${o.enabled ? 'ON' : 'OFF'}`)
        if (o.mode) changes.push(`gateway ${code} mode=${o.mode}`)
      }
    }
  }

  if (changes.length === 0) {
    return Response.json({ error: 'No valid changes supplied' }, { status: 400 })
  }

  await audit({
    actor: g.user.email,
    action: 'PLATFORM_GOVERNANCE_UPDATED',
    details: { changes },
  })

  const [flags, gateways] = await Promise.all([getFeatureFlags(true), getPaymentGateways(true)])
  return Response.json({ ok: true, changed: changes, flags, gateways })
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const flags = await resetFeatureFlags()
  await audit({ actor: g.user.email, action: 'PLATFORM_GOVERNANCE_RESET', details: { note: 'feature flags reset to defaults' } })
  return Response.json({ ok: true, flags })
}
