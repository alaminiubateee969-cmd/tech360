// GET /api/ai-gateway/ready — fail-closed readiness: valid app
// registry AND a real (non-mock) provider are required. Mock
// mode never satisfies readiness.
import { NextResponse } from 'next/server'
import { loadGatewayConfig, redactedDiagnostics } from '@/lib/ai-gateway/config'
import { readiness } from '@/lib/ai-gateway/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { config, errors } = loadGatewayConfig()
  const result = readiness(config, errors)
  return NextResponse.json(
    { ready: result.ready, failures: result.failures, diagnostics: redactedDiagnostics(config, []) },
    { status: result.ready ? 200 : 503 },
  )
}
