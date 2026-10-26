// GET /api/ai-gateway/health — process liveness only. A running
// HTTP server is NOT proof of readiness; see /ready.
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'tech360-shared-ai-gateway', at: new Date().toISOString() })
}
