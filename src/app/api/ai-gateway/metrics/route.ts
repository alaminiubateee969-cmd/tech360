// GET /api/ai-gateway/metrics — operational counters. This is
// the private metrics surface: it requires a valid gateway
// application token and is never public. In a split deployment
// the same counters must be bound to a loopback/private listener.
import { NextResponse } from 'next/server'
import { loadGatewayConfig } from '@/lib/ai-gateway/config'
import { authenticateApp, gatewayState, parseBearer } from '@/lib/ai-gateway/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { config, errors } = loadGatewayConfig()
  if (errors.length) return NextResponse.json({ error: { code: 'CONFIG_INVALID' } }, { status: 503 })
  const auth = authenticateApp(config, parseBearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: { code: auth.code } }, { status: 401 })
  const state = gatewayState()
  return NextResponse.json({
    metrics: state.metrics,
    concurrent: state.concurrent,
    circuits: Object.fromEntries([...state.circuits.entries()].map(([k, v]) => [k, { failures: v.failures, open: v.openUntil > Date.now() }])),
    // Monthly spend per app in USD for providers with known cost;
    // unknown-cost providers are never represented as zero here.
    monthlySpendUsd: Object.fromEntries(state.monthlySpend.entries()),
  })
}
