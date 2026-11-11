import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { approveRelease, createUpgradeRelease, deployRelease, impactAnalysis, rollbackRelease, stageUpgradeRelease } from '@/lib/factory/control/releases'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const moduleCode = text(url.searchParams.get('module'), 60)
  const [releases, modules] = await Promise.all([
    db.factoryRelease.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.factoryModule.findMany({ orderBy: { code: 'asc' } }),
  ])
  const impact = moduleCode ? await impactAnalysis(moduleCode, Number(url.searchParams.get('version')) || undefined) : null
  return noStore({ releases, modules, impact })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  if (action === 'create') {
    return noStore(await createUpgradeRelease({
      applicationId: text(body.applicationId, 60),
      moduleCode: text(body.moduleCode, 60) || undefined,
      targetVersion: Number(body.targetVersion) || undefined,
      configPatch: (body.configPatch ?? undefined) as Record<string, unknown> | undefined,
      actor: g.actor,
    }), 201)
  }
  const releaseId = text(body.releaseId, 60)
  if (!releaseId) return bad('releaseId is required')
  if (action === 'stage') return noStore(await stageUpgradeRelease(releaseId, g.actor))
  if (action === 'approve') return noStore(await approveRelease(releaseId, g.actor, text(body.note, 1000)))
  if (action === 'deploy') return noStore(await deployRelease(releaseId, g.actor))
  if (action === 'rollback') return noStore(await rollbackRelease(releaseId, g.actor))
  return bad(`Unknown action "${action}"`)
}
