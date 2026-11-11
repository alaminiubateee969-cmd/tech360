/** Private application portal: list the company applications I may operate. */
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const now = new Date()
  const grants = await db.factoryCompanyMember.findMany({
    where: { userEmail: g.actor.email, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: 'asc' },
  })
  const companyIds = [...new Set(grants.map((row) => row.companyId))]
  const companies = companyIds.length ? await db.factoryCompany.findMany({ where: { id: { in: companyIds } } }) : []
  const applications = companyIds.length ? await db.factoryApplication.findMany({
    where: { companyId: { in: companyIds }, status: { notIn: ['RETIRED', 'TEST_FAILED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, code: true, name: true, status: true, environment: true, releaseVersion: true, healthStatus: true, deploymentModel: true, companyId: true, createdAt: true },
  }) : []
  const rows = applications.map((app) => {
    const company = companies.find((c) => c.id === app.companyId)
    const grant = grants.find((row) => row.companyId === app.companyId)
    return { ...app, company: company ? { name: company.name, code: company.code, slug: company.slug, kind: company.kind, industry: company.industry } : null,
      grant: grant ? { role: grant.role, privileged: grant.privileged, expiresAt: grant.expiresAt } : null,
      url: company ? `/factory/apps/${company.slug}` : null }
  })
  return noStore({ ok: true, generatedAt: now.toISOString(), grants: grants.length, companies: companies.length, applications: rows,
    fact: 'Only applications backed by an explicit, active, unexpired company grant are listed.' })
}
