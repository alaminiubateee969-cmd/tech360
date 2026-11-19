import { db } from '@/lib/db'
import packageJson from '../../../../package.json'

export const dynamic = 'force-dynamic'

/**
 * Public liveness/readiness summary.
 *
 * Keep this endpoint intentionally minimal: it is used by external uptime
 * monitors and must not disclose provider configuration, channel wiring,
 * agent counts, internal automation heartbeats, or operational metadata.
 * Detailed subsystem diagnostics are available only from the authenticated
 * /api/health/deep endpoint.
 */
export async function GET() {
  let databaseHealthy = false

  try {
    await db.$queryRaw`SELECT 1`
    await db.user.findFirst({ select: { id: true } })
    databaseHealthy = true
  } catch {
    // Do not return connection details, schema names, or configuration.
  }

  const healthy = databaseHealthy
  const result = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    app: 'tech360-platform',
    version: packageJson.version,
    // Build identity is retained for release traceability; it is not a
    // signed attestation. Detailed runtime state remains behind auth.
    release: {
      commit: process.env.TECH360_BUILD_SHA || 'unknown',
      sourceState: process.env.TECH360_BUILD_SOURCE_STATE || 'unknown',
    },
    checks: {
      database: { status: databaseHealthy ? 'UP' : 'DOWN' },
    },
  }

  return Response.json(result, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
