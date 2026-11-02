import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { canApproveRelease, writeFactoryAudit } from '@/lib/factory/control/access'
import { validateModuleManifest } from '@/lib/factory/control/definition'
import { impactAnalysis } from '@/lib/factory/control/releases'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'
import { IMPLEMENTED_CAPABILITIES, type Capability, type ModuleManifest } from '@/lib/factory/control/types'
import { checksum, jsonText, parseSemver } from '@/lib/factory/control/util'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const [modules, versions, links] = await Promise.all([
    db.factoryModule.findMany({ orderBy: { code: 'asc' } }),
    db.factoryModuleVersion.findMany({ orderBy: [{ moduleId: 'asc' }, { version: 'desc' }] }),
    db.factoryTemplateModule.findMany(),
  ])
  return noStore({ modules, versions, links, total: modules.length })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  const actor = g.actor

  if (action === 'create') {
    const code = text(body.code, 60).toLowerCase()
    const capability = text(body.capability, 40) as Capability
    if (!/^[a-z0-9-]{3,60}$/.test(code)) return bad('A valid module code is required')
    if (!IMPLEMENTED_CAPABILITIES.includes(capability)) return bad('Only implemented capabilities can be registered as working modules')
    if (await db.factoryModule.findUnique({ where: { code } })) return bad('Module code already exists', 409)
    const manifest = (body.manifest ?? {}) as ModuleManifest
    const check = validateModuleManifest(manifest)
    if (!check.ok) return bad(`Manifest invalid: ${check.errors.join('; ')}`)
    const mod = await db.factoryModule.create({ data: {
      code, name: text(body.name, 120) || code, category: text(body.category, 60) || 'Extension',
      capability, description: text(body.description, 1000) || null, status: 'DRAFT', currentVersion: 0,
    } })
    const version = await db.factoryModuleVersion.create({ data: {
      moduleId: mod.id, version: 1, semver: '1.0.0', manifest: jsonText(manifest),
      checksum: checksum(manifest), status: 'DRAFT', createdBy: actor.email,
    } })
    await writeFactoryAudit({ actor, action: 'FACTORY_MODULE_CREATE', targetType: 'MODULE', targetId: mod.id, detail: { code, capability } })
    return noStore({ module: mod, version }, 201)
  }

  if (action === 'version') {
    const moduleId = text(body.moduleId, 60)
    const mod = await db.factoryModule.findUnique({ where: { id: moduleId } })
    if (!mod) return bad('Module not found', 404)
    const latest = await db.factoryModuleVersion.findFirst({ where: { moduleId }, orderBy: { version: 'desc' } })
    if (!latest) return bad('No version to branch from', 409)
    const manifest = (body.manifest ?? JSON.parse(latest.manifest)) as ModuleManifest
    const check = validateModuleManifest(manifest)
    if (!check.ok) return bad(`Manifest invalid: ${check.errors.join('; ')}`)
    const parts = parseSemver(latest.semver) ?? { major: 1, minor: 0, patch: 0 }
    const breaking = body.breaking === true
    const semver = text(body.semver, 20) || (breaking ? `${parts.major + 1}.0.0` : `${parts.major}.${parts.minor + 1}.0`)
    if (!parseSemver(semver)) return bad('semver must be X.Y.Z')
    const version = await db.factoryModuleVersion.create({ data: {
      moduleId, version: latest.version + 1, semver, manifest: jsonText(manifest), checksum: checksum(manifest),
      status: 'DRAFT', breaking, releaseNotes: text(body.releaseNotes, 1000) || null, createdBy: actor.email,
    } })
    const impact = await impactAnalysis(mod.code, version.version)
    await writeFactoryAudit({ actor, action: 'FACTORY_MODULE_VERSION', targetType: 'MODULE', targetId: mod.id, detail: { version: version.version, semver, dependentApplications: impact.applications.length, dependentTemplates: impact.templates.length } })
    return noStore({ version, impact }, 201)
  }

  if (action === 'approve') {
    if (!canApproveRelease(actor)) return bad('Module approval requires a SUPER_ADMIN', 403)
    const versionId = text(body.moduleVersionId, 60)
    const version = await db.factoryModuleVersion.findUnique({ where: { id: versionId } })
    if (!version) return bad('Module version not found', 404)
    const mod = await db.factoryModule.findUniqueOrThrow({ where: { id: version.moduleId } })
    const check = validateModuleManifest(JSON.parse(version.manifest))
    if (!check.ok) return bad(`Manifest invalid: ${check.errors.join('; ')}`)
    const updated = await db.factoryModuleVersion.update({ where: { id: version.id }, data: {
      status: 'APPROVED', approvedBy: actor.email, approvedAt: new Date(),
    } })
    await db.factoryModuleVersion.updateMany({ where: { moduleId: mod.id, id: { not: version.id }, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } })
    await db.factoryModule.update({ where: { id: mod.id }, data: { status: 'PRODUCTION_READY', currentVersion: version.version } })
    const impact = await impactAnalysis(mod.code, version.version)
    await writeFactoryAudit({ actor, action: 'FACTORY_MODULE_APPROVE', targetType: 'MODULE', targetId: mod.id, detail: { version: version.version, dependentApplications: impact.applications.length, dependentTemplates: impact.templates.length, compatibility: impact.compatibility.compatible } })
    return noStore({ version: updated, impact })
  }
  return bad(`Unknown action "${action}"`)
}
