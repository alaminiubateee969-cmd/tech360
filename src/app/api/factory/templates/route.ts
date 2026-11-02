import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { canApproveRelease, writeFactoryAudit } from '@/lib/factory/control/access'
import { loadModuleRefs } from '@/lib/factory/control/catalog'
import { validateTemplateDefinition } from '@/lib/factory/control/definition'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'
import type { TemplateDefinition } from '@/lib/factory/control/types'
import { checksum, jsonText, nextCode, parseSemver } from '@/lib/factory/control/util'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const [templates, versions, links, modules] = await Promise.all([
    db.factoryTemplate.findMany({ orderBy: { code: 'asc' } }),
    db.factoryTemplateVersion.findMany({ orderBy: [{ templateId: 'asc' }, { version: 'desc' }] }),
    db.factoryTemplateModule.findMany(),
    db.factoryModule.findMany({ orderBy: { code: 'asc' } }),
  ])
  return noStore({ templates, versions, links, modules, total: templates.length })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  const actor = g.actor

  if (action === 'create') {
    const code = text(body.code, 60).toLowerCase()
    const name = text(body.name, 120)
    const category = text(body.category, 60)
    const description = text(body.description, 1000)
    const definition = (body.definition ?? {}) as TemplateDefinition
    if (!/^[a-z0-9-]{3,60}$/.test(code) || !name || !category) return bad('A code, name and category are required')
    if (await db.factoryTemplate.findUnique({ where: { code } })) return bad('Template code already exists', 409)
    const refs = await loadModuleRefs()
    const check = validateTemplateDefinition(definition, refs)
    if (!check.ok) return bad(`Template definition is not valid: ${check.errors.join('; ')}`)
    const created = await db.factoryTemplate.create({ data: { code, name, category, description, status: 'DRAFT', currentVersion: 0, createdBy: actor.email } })
    const version = await db.factoryTemplateVersion.create({ data: {
      templateId: created.id, version: 1, semver: '1.0.0', definition: jsonText(definition),
      checksum: checksum(definition), status: 'DRAFT', createdBy: actor.email,
    } })
    await db.factoryTemplateModule.createMany({ data: definition.modules.map((m) => ({
      templateVersionId: version.id, moduleId: m.code, required: m.required, config: m.config ? jsonText(m.config) : null,
    })) })
    await writeFactoryAudit({ actor, action: 'FACTORY_TEMPLATE_CREATE', targetType: 'TEMPLATE', targetId: created.id, detail: { code, version: 1 } })
    return noStore({ template: created, version }, 201)
  }

  if (action === 'validate' || action === 'approve' || action === 'new-version') {
    const templateId = text(body.templateId, 60)
    const versionId = text(body.templateVersionId, 60)
    const template = templateId ? await db.factoryTemplate.findUnique({ where: { id: templateId } }) : null
    const version = versionId ? await db.factoryTemplateVersion.findUnique({ where: { id: versionId } }) : null
    if (action === 'new-version' && template) {
      const latest = await db.factoryTemplateVersion.findFirst({ where: { templateId: template.id }, orderBy: { version: 'desc' } })
      if (!latest) return bad('No version to branch from')
      const definition = (body.definition ?? JSON.parse(latest.definition)) as TemplateDefinition
      const refs = await loadModuleRefs()
      const check = validateTemplateDefinition(definition, refs)
      if (!check.ok) return bad(`Template definition is not valid: ${check.errors.join('; ')}`)
      const parts = parseSemver(latest.semver) ?? { major: 1, minor: 0, patch: 0 }
      const semver = `${parts.major}.${parts.minor + 1}.0`
      const created = await db.factoryTemplateVersion.create({ data: {
        templateId: template.id, version: latest.version + 1, semver, definition: jsonText(definition),
        checksum: checksum(definition), status: 'DRAFT', createdBy: actor.email,
        releaseNotes: text(body.releaseNotes, 1000) || null,
      } })
      await db.factoryTemplateModule.createMany({ data: definition.modules.map((m) => ({
        templateVersionId: created.id, moduleId: m.code, required: m.required, config: m.config ? jsonText(m.config) : null,
      })) })
      await writeFactoryAudit({ actor, action: 'FACTORY_TEMPLATE_VERSION', targetType: 'TEMPLATE', targetId: template.id, detail: { version: created.version, semver } })
      return noStore({ version: created }, 201)
    }
    if (!version) return bad('Template version not found', 404)
    const definition = JSON.parse(version.definition) as TemplateDefinition
    const refs = await loadModuleRefs()
    const check = validateTemplateDefinition(definition, refs)
    const links = await db.factoryTemplateModule.count({ where: { templateVersionId: version.id } })
    const passed = check.ok && links === definition.modules.length
    if (action === 'validate') {
      const updated = await db.factoryTemplateVersion.update({ where: { id: version.id }, data: {
        status: passed ? 'VALIDATED' : 'DRAFT',
        testResults: jsonText({ ranAt: new Date().toISOString(), checks: check.errors, linksVerified: links === definition.modules.length, passed }),
      } })
      await db.factoryTemplate.update({ where: { id: version.templateId }, data: { status: passed ? 'VALIDATED' : 'DRAFT' } })
      await writeFactoryAudit({ actor, action: 'FACTORY_TEMPLATE_VALIDATE', targetType: 'TEMPLATE', targetId: version.templateId, decision: passed ? 'ALLOW' : 'DENY', detail: { version: version.version, errors: check.errors } })
      return noStore({ version: updated, passed, errors: check.errors })
    }
    if (!canApproveRelease(actor)) return bad('Template approval requires a SUPER_ADMIN', 403)
    if (!passed) return bad('Template must pass its validation checks first', 409)
    const results = JSON.parse(version.testResults ?? '{}') as { passed?: boolean }
    if (!results.passed && version.status !== 'VALIDATED') return bad('Run the validation action first', 409)
    const updated = await db.factoryTemplateVersion.update({ where: { id: version.id }, data: {
      status: 'APPROVED', approvedBy: actor.email, approvedAt: new Date(),
      testResults: jsonText({ ...results, approvedAt: new Date().toISOString(), checks: check.errors, passed: true }),
    } })
    await db.factoryTemplateVersion.updateMany({ where: { templateId: version.templateId, id: { not: version.id }, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } })
    await db.factoryTemplate.update({ where: { id: version.templateId }, data: { status: 'PRODUCTION_READY', currentVersion: version.version } })
    await writeFactoryAudit({ actor, action: 'FACTORY_TEMPLATE_APPROVE', targetType: 'TEMPLATE', targetId: version.templateId, detail: { version: version.version, semver: version.semver } })
    return noStore({ version: updated, status: 'PRODUCTION_READY' })
  }
  return bad(`Unknown action "${action}"`)
}
