/**
 * Downloadable, self-hosted DEDICATED deployment package.
 *
 * Authoritative authorization: an ADMIN session AND an explicit, active
 * company grant. The package never contains credentials or tenant secrets.
 */
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { peekCompanyAccess, writeFactoryAudit } from '@/lib/factory/control/access'
import { bad, guardFailed, noStore, requireActor } from '@/lib/factory/control/http'
import { buildDeploymentPackage, serializeDeploymentPackage } from '@/lib/factory/control/deploy-package'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ applicationId: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const { applicationId } = await params
  const app = await db.factoryApplication.findUnique({ where: { id: applicationId } })
  if (!app) return bad('Application not found', 404)
  const allowed = await peekCompanyAccess(g.actor, app.companyId, 'read')
  if (!allowed) {
    await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_DEPLOYMENT_PACKAGE', targetType: 'APPLICATION', targetId: applicationId, companyId: app.companyId, decision: 'DENY', detail: { reason: 'no explicit company grant' } })
    return bad('An explicit company grant is required to export a deployment package', 403)
  }
  const pkg = await buildDeploymentPackage(applicationId)
  await writeFactoryAudit({ actor: g.actor, action: 'FACTORY_DEPLOYMENT_PACKAGE', targetType: 'APPLICATION', targetId: applicationId, companyId: app.companyId, detail: { checksum: pkg.packageChecksum, deploymentModel: app.deploymentModel } })
  const body = serializeDeploymentPackage(pkg)
  const download = new URL(req.url).searchParams.get('download')
  return download
    ? new Response(body, { headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${app.code}-self-hosted-deployment.json"`,
      'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
    } })
    : noStore(pkg as unknown as Record<string, unknown>)
}
