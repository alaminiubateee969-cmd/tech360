import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { peekCompanyAccess } from '@/lib/factory/control/access'
import { loadModuleRefs } from '@/lib/factory/control/catalog'
import { previewDefinition, provisionCompany, reuseCompanyDefinition } from '@/lib/factory/control/provision'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const companies = await db.factoryCompany.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  const apps = await db.factoryApplication.findMany({ select: { id: true, companyId: true, code: true, status: true, healthStatus: true, environment: true, deploymentModel: true } })
  // The registry itself is control-plane metadata, so authorized factory staff
  // may list companies. Private business data still requires an explicit,
  // audited company grant; `dataAccess` tells the UI which it has. tenantKey
  // is an identity secret and is never returned.
  const visible: Array<Record<string, unknown>> = []
  for (const c of companies) {
    const { tenantKey: _hidden, ...safe } = c
    visible.push({
      ...safe,
      dataAccess: await peekCompanyAccess(g.actor, c.id, 'audit'),
      applications: apps.filter((a) => a.companyId === c.id),
    })
  }
  return noStore({ companies: visible, total: visible.length, note: 'Registry metadata only; private business data requires an explicit company grant' })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  if (action === 'preview') return noStore(await previewDefinition(body.definition ?? body, g.actor))
  if (action === 'provision' || (!action && body.identity)) {
    const result = await provisionCompany(body.definition ?? body, g.actor)
    return noStore(result, result.ok ? 201 : 400)
  }
  if (action === 'reuse') {
    const source = text(body.sourceCompanyId, 60)
    if (!source) return bad('sourceCompanyId is required')
    const result = await reuseCompanyDefinition(source, (body.overrides ?? {}) as Record<string, unknown>, g.actor)
    return noStore(result, result.ok ? 201 : 400)
  }
  if (action === 'catalog') {
    const [templates, modules] = await Promise.all([
      db.factoryTemplate.findMany({ where: { status: 'PRODUCTION_READY' }, orderBy: { code: 'asc' } }),
      loadModuleRefs(),
    ])
    return noStore({
      templates: await Promise.all(templates.map(async (t) => ({
        ...t,
        version: await db.factoryTemplateVersion.findFirst({ where: { templateId: t.id, status: 'APPROVED' }, orderBy: { version: 'desc' } }),
        modules: await db.factoryTemplateModule.findMany({ where: { templateVersionId: { in: (await db.factoryTemplateVersion.findMany({ where: { templateId: t.id }, select: { id: true } })).map((v) => v.id) } } }),
      }))),
      modules: [...modules.values()],
    })
  }
  return bad(`Unknown action "${action}"`)
}
