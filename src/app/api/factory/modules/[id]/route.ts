import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { impactAnalysis } from '@/lib/factory/control/releases'
import { bad, guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const { id } = await params
  const mod = await db.factoryModule.findFirst({ where: { OR: [{ id }, { code: id }] } })
  if (!mod) return bad('Module not found', 404)
  const url = new URL(req.url)
  const version = Number(url.searchParams.get('version') ?? 0) || undefined
  const [versions, links, impact] = await Promise.all([
    db.factoryModuleVersion.findMany({ where: { moduleId: mod.id }, orderBy: { version: 'desc' } }),
    db.factoryTemplateModule.findMany({ where: { moduleId: mod.code } }),
    impactAnalysis(mod.code, version),
  ])
  return noStore({ module: mod, versions, links, impact })
}
