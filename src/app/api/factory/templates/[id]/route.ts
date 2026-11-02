import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { bad, guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const { id } = await params
  const template = await db.factoryTemplate.findUnique({ where: { id } })
  if (!template) return bad('Template not found', 404)
  const [versions, links] = await Promise.all([
    db.factoryTemplateVersion.findMany({ where: { templateId: id }, orderBy: { version: 'desc' } }),
    db.factoryTemplateModule.findMany({ where: { templateVersionId: { in: (await db.factoryTemplateVersion.findMany({ where: { templateId: id }, select: { id: true } })).map((v) => v.id) } } }),
  ])
  const applications = await db.factoryApplication.count({ where: { templateId: id } })
  return noStore({ template, versions, links, applicationCount: applications })
}
