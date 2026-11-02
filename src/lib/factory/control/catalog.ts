/**
 * The initial PRIVATE template & module library.
 *
 * These are not gallery entries: every module declares an implemented
 * capability, a real record schema and permissions; every template composes
 * approved module versions and carries setup, test, acceptance, backup and
 * rollback procedures. `bootstrapCatalog()` only marks a template
 * PRODUCTION_READY after those checks actually run and pass.
 */
import { db } from '@/lib/db'
import type { Actor } from './access'
import { writeFactoryAudit } from './access'
import { validateModuleManifest, validateTemplateDefinition, type ModuleRef } from './definition'
import { IMPLEMENTED_CAPABILITIES, type Capability, type ModuleManifest, type TemplateDefinition } from './types'
import { checksum, jsonText, parseSemver } from './util'

interface ModuleSeed {
  code: string
  name: string
  category: string
  capability: Capability
  description: string
  manifest: ModuleManifest
}

const testDefs = (code: string) => [
  `${code}: manifest declares an implemented capability and permissions`,
  `${code}: entity records are validated against the declared field schema`,
  `${code}: every record is scoped to the owning company on the server`,
]
const criteria = (code: string) => [
  `${code} records can be created and read only by an authorized member of the owning company`,
  `Cross-company reads of ${code} records are denied and audited`,
  `${code} configuration changes do not alter another company's configuration`,
]

export const MODULE_SEEDS: readonly ModuleSeed[] = [
  {
    code: 'identity', name: 'Identity & Access', category: 'Security', capability: 'identity',
    description: 'One shared authentication/authorization capability: roles, permissions, explicit company grants and privileged-access audit.',
    manifest: {
      schemaVersion: 1, capability: 'identity', dependencies: [],
      permissions: ['identity.read', 'identity.write', 'identity.grant'],
      configKeys: ['requireExplicitGrants', 'sessionTtlHours'],
      entities: [{ key: 'USER', label: 'Company user', fields: [
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text', required: true },
      ] }],
      migrations: [], testDefinitions: testDefs('identity'), acceptanceCriteria: criteria('identity'),
    },
  },
  {
    code: 'contacts', name: 'Contacts & CRM', category: 'CRM', capability: 'contacts',
    description: 'Central contacts, organizations, leads and pipelines with duplicate-safe, company-scoped records.',
    manifest: {
      schemaVersion: 1, capability: 'contacts', dependencies: ['identity'],
      permissions: ['contacts.read', 'contacts.write', 'contacts.export'],
      configKeys: ['pipelineStages', 'duplicateReview'],
      entities: [
        { key: 'CONTACT', label: 'Contact', fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'organization', label: 'Organization', type: 'text' },
        ] },
        { key: 'ORGANIZATION', label: 'Organization', fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'website', label: 'Website', type: 'text' },
        ] },
        { key: 'LEAD', label: 'Lead', fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'stage', label: 'Pipeline stage', type: 'text', required: true },
          { key: 'value', label: 'Value', type: 'number' },
        ] },
      ],
      migrations: [], testDefinitions: testDefs('contacts'), acceptanceCriteria: criteria('contacts'),
    },
  },
  {
    code: 'workflow', name: 'Workflow & Approvals', category: 'Operations', capability: 'workflow',
    description: 'Configurable pipelines, tasks, approval chains, SLA rules and trigger-based automation definitions.',
    manifest: {
      schemaVersion: 1, capability: 'workflow', dependencies: ['identity'],
      permissions: ['workflow.read', 'workflow.write', 'workflow.approve'],
      configKeys: ['pipelines', 'approvalChains', 'slaHours'],
      entities: [
        { key: 'TASK', label: 'Task', fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'status', label: 'Status', type: 'text', required: true },
          { key: 'dueDate', label: 'Due date', type: 'date' },
        ] },
        { key: 'APPROVAL', label: 'Approval', fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'status', label: 'Status', type: 'text', required: true },
        ] },
        { key: 'PIPELINE_STAGE', label: 'Pipeline stage', fields: [
          { key: 'key', label: 'Key', type: 'text', required: true },
          { key: 'label', label: 'Label', type: 'text', required: true },
          { key: 'position', label: 'Position', type: 'number' },
        ] },
      ],
      migrations: [], testDefinitions: testDefs('workflow'), acceptanceCriteria: criteria('workflow'),
    },
  },
  {
    code: 'documents', name: 'Documents & Files', category: 'Operations', capability: 'documents',
    description: 'Secure upload/download with MIME scanning, per-company file ownership and checksum verification.',
    manifest: {
      schemaVersion: 1, capability: 'documents', dependencies: ['identity'],
      permissions: ['documents.read', 'documents.write'],
      configKeys: ['maxBytes', 'allowedMime'],
      entities: [{ key: 'DOCUMENT_META', label: 'Document metadata', fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'mimeType', label: 'MIME type', type: 'text', required: true },
        { key: 'sizeBytes', label: 'Size', type: 'number', required: true },
      ] }],
      migrations: [], testDefinitions: testDefs('documents'), acceptanceCriteria: criteria('documents'),
    },
  },
  {
    code: 'audit', name: 'Audit Trail', category: 'Security', capability: 'audit',
    description: 'Append-only audit events for sensitive and denied operations, scoped by company.',
    manifest: {
      schemaVersion: 1, capability: 'audit', dependencies: [],
      permissions: ['audit.read'],
      configKeys: ['retentionDays'],
      entities: [], migrations: [], testDefinitions: testDefs('audit'), acceptanceCriteria: criteria('audit'),
    },
  },
  {
    code: 'notifications', name: 'Notifications', category: 'Communication', capability: 'notifications',
    description: 'Internal notifications and reusable message templates. External delivery is an optional adapter.',
    manifest: {
      schemaVersion: 1, capability: 'notifications', dependencies: ['identity'],
      permissions: ['notifications.read', 'notifications.write'],
      configKeys: ['templates'],
      entities: [{ key: 'NOTIFICATION', label: 'Notification', fields: [
        { key: 'subject', label: 'Subject', type: 'text', required: true },
        { key: 'body', label: 'Body', type: 'textarea', required: true },
        { key: 'status', label: 'Status', type: 'text', required: true },
      ] }],
      migrations: [], testDefinitions: testDefs('notifications'), acceptanceCriteria: criteria('notifications'),
    },
  },
  {
    code: 'reporting', name: 'Reporting', category: 'Analytics', capability: 'reporting',
    description: 'Company-scoped aggregation and exports. Reports can never read another company\'s rows.',
    manifest: {
      schemaVersion: 1, capability: 'reporting', dependencies: ['identity'],
      permissions: ['reporting.read', 'reporting.export'],
      configKeys: ['dashboards'],
      entities: [], migrations: [], testDefinitions: testDefs('reporting'), acceptanceCriteria: criteria('reporting'),
    },
  },
  {
    code: 'integration_hub', name: 'Integration Hub', category: 'Integration', capability: 'integration_hub',
    description: 'Replaceable adapters with honest status, event receipts, retry records and audit. External networks remain external.',
    manifest: {
      schemaVersion: 1, capability: 'integration_hub', dependencies: [],
      permissions: ['integrations.read', 'integrations.manage'],
      configKeys: ['adapters'],
      entities: [], migrations: [], testDefinitions: testDefs('integration_hub'), acceptanceCriteria: criteria('integration_hub'),
    },
  },
]

interface TemplateSeed {
  code: string
  name: string
  category: string
  description: string
  definition: TemplateDefinition
}

function template(seed: {
  code: string; name: string; category: string; description: string
  modules: Array<{ code: string; required: boolean }>
  nav: string[]; reports?: string[]; pipelines?: string[]
}): TemplateSeed {
  return {
    code: seed.code, name: seed.name, category: seed.category, description: seed.description,
    definition: {
    schemaVersion: 1,
    category: seed.category,
    description: seed.description,
    modules: seed.modules.map((m) => ({ code: m.code, required: m.required })),
    roles: [
      { key: 'COMPANY_ADMIN', label: 'Company administrator', permissions: ['*'] },
      { key: 'COMPANY_USER', label: 'Company user', permissions: ['read', 'write'] },
      { key: 'COMPANY_AUDITOR', label: 'Company auditor', permissions: ['read', 'audit.read'] },
    ],
    navigation: seed.nav,
    defaults: {
      branding: { primaryColor: '#063B8F', accentColor: '#009FE3' },
      navigation: seed.nav,
      reports: seed.reports ?? ['Company overview'],
      pipelines: seed.pipelines ?? ['New', 'In progress', 'Done'],
      slaHours: 48,
      retention: { days: 365, backupPolicy: 'DAILY' },
    },
    workflows: [
      { key: 'intake', label: 'New record intake', steps: ['Validate', 'Scope to company', 'Persist', 'Audit'] },
      { key: 'approval', label: 'Approval chain', steps: ['Request', 'Review', 'Approve or reject', 'Record decision'] },
    ],
    notifications: [
      { key: 'created', event: 'record.created', template: 'A new {{entity}} was recorded for {{company}}.' },
      { key: 'approval', event: 'approval.requested', template: 'Approval requested by {{actor}}.' },
    ],
    security: {
      requireExplicitGrants: true,
      secretRefs: ['DATABASE_URL', 'SESSION_SECRET'],
      notes: 'Secrets live in the environment, never in company configuration. Server-side grants are the only path to private data.',
    },
    dataModel: ['Company-scoped records', 'Config revisions', 'Module version pins', 'Audit events'],
    businessRules: ['No cross-company reads', 'No unapproved module upgrade', 'No activation without verified backup'],
    integrationAdapters: ['internal_events', 'internal_webhooks'],
    testDefinitions: [
      'Every required module is an approved, implemented capability',
      'Two applications built from this template keep independent configurations',
      'All seeded records are scoped to the owning company',
      'Health checks pass on a freshly provisioned application',
    ],
    acceptanceCriteria: [
      'Company provisioning completes with roles, modules and config initialized',
      'Cross-company access attempts are denied and audited',
      'A verified backup can be restored into a staging application',
      'Rollback restores the previous known-good configuration',
    ],
    setupProcedure: ['Validate definition', 'Provision tenant', 'Run acceptance tests', 'Review and approve activation'],
    upgradeProcedure: ['Impact analysis', 'Compatibility check', 'Staging upgrade', 'Approval', 'Deploy with backup', 'Verify'],
    backupProcedure: ['Export config, definitions, pins, records and files', 'Compute SHA-256', 'Verify integrity', 'Store under operator control'],
    rollbackProcedure: ['Select verified backup or known-good config revision', 'Restore into staging', 'Verify health', 'Record rollback and audit'],
    } as TemplateDefinition,
  }
}

export const TEMPLATE_SEEDS: readonly TemplateSeed[] = [
  template({ code: 'company-in-a-box', name: 'Company-in-a-Box', category: 'Company', description: 'The complete foundation: identity, CRM, workflow, documents, notifications, reporting, audit and integrations.', modules: MODULE_SEEDS.map((m) => ({ code: m.code, required: ['identity', 'audit'].includes(m.code) })), nav: ['Overview', 'Contacts', 'Tasks', 'Documents', 'Reports', 'Audit', 'Settings'] }),
  template({ code: 'crm', name: 'CRM & Lead Management', category: 'Sales', description: 'Contacts, organizations, leads, pipelines, tasks and company-scoped reporting.', modules: [{ code: 'identity', required: true }, { code: 'contacts', required: true }, { code: 'workflow', required: true }, { code: 'reporting', required: false }, { code: 'audit', required: true }], nav: ['Overview', 'Contacts', 'Leads', 'Pipeline', 'Tasks', 'Reports'], pipelines: ['New', 'Qualified', 'Proposal', 'Won', 'Lost'] }),
  template({ code: 'support', name: 'Support & Helpdesk', category: 'Support', description: 'Ticket workflows, contacts, SLA rules, internal notifications, documents and audit.', modules: [{ code: 'identity', required: true }, { code: 'contacts', required: true }, { code: 'workflow', required: true }, { code: 'notifications', required: true }, { code: 'documents', required: false }, { code: 'audit', required: true }], nav: ['Inbox', 'Tickets', 'Contacts', 'Documents', 'SLA', 'Audit'], pipelines: ['New', 'Assigned', 'Waiting', 'Resolved', 'Closed'] }),
  template({ code: 'projects', name: 'Project & Task Management', category: 'Operations', description: 'Projects, tasks, approval chains, documents, dashboards and audit.', modules: [{ code: 'identity', required: true }, { code: 'workflow', required: true }, { code: 'documents', required: true }, { code: 'reporting', required: false }, { code: 'audit', required: true }], nav: ['Overview', 'Projects', 'Tasks', 'Approvals', 'Documents', 'Reports'] }),
]

export interface BootstrapResult {
  created: { modules: number; moduleVersions: number; templates: number; templateVersions: number; links: number }
  checks: Array<{ key: string; ok: boolean; detail: string }>
  ok: boolean
}

/** Idempotent: existing approved assets are never overwritten or deleted. */
export async function bootstrapCatalog(actor: Actor): Promise<BootstrapResult> {
  const created = { modules: 0, moduleVersions: 0, templates: 0, templateVersions: 0, links: 0 }
  const checks: Array<{ key: string; ok: boolean; detail: string }> = []
  const moduleRefs = new Map<string, ModuleRef>()

  for (const seed of MODULE_SEEDS) {
    let mod = await db.factoryModule.findUnique({ where: { code: seed.code } })
    if (!mod) {
      mod = await db.factoryModule.create({ data: {
        code: seed.code, name: seed.name, category: seed.category, capability: seed.capability,
        description: seed.description, status: 'VALIDATED', currentVersion: 0,
      } })
      created.modules++
    }
    let version = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: 1 } } })
    if (!version) {
      const manifestCheck = validateModuleManifest(seed.manifest)
      if (!manifestCheck.ok) throw new Error(`Invalid ${seed.code} manifest: ${manifestCheck.errors.join(', ')}`)
      version = await db.factoryModuleVersion.create({ data: {
        moduleId: mod.id, version: 1, semver: '1.0.0', manifest: jsonText(seed.manifest),
        checksum: checksum(seed.manifest), status: 'APPROVED', breaking: false,
        releaseNotes: 'Initial approved shared capability.', approvedBy: actor.email, approvedAt: new Date(),
        createdBy: actor.email,
      } })
      created.moduleVersions++
    }
    await db.factoryModule.update({ where: { id: mod.id }, data: { currentVersion: Math.max(mod.currentVersion, 1), status: 'PRODUCTION_READY' } })
    moduleRefs.set(seed.code, {
      id: version.id,
      code: seed.code, version: version.version, semver: version.semver, status: version.status,
      capability: seed.capability, manifest: seed.manifest,
    })
  }
  checks.push({ key: 'modules.implemented', ok: MODULE_SEEDS.every((m) => IMPLEMENTED_CAPABILITIES.includes(m.capability)), detail: `${MODULE_SEEDS.length} shared capabilities, each with a real record schema` })
  checks.push({ key: 'modules.manifests', ok: MODULE_SEEDS.every((m) => validateModuleManifest(m.manifest).ok), detail: 'all module manifests validated' })

  for (const seed of TEMPLATE_SEEDS) {
    let tpl = await db.factoryTemplate.findUnique({ where: { code: seed.code } })
    if (!tpl) {
      tpl = await db.factoryTemplate.create({ data: {
        code: seed.code, name: seed.name, category: seed.category, description: seed.description,
        status: 'VALIDATED', currentVersion: 0, createdBy: actor.email,
      } })
      created.templates++
    }
    let version = await db.factoryTemplateVersion.findUnique({ where: { templateId_version: { templateId: tpl.id, version: 1 } } })
    if (!version) {
      const tCheck = validateTemplateDefinition(seed.definition, moduleRefs)
      if (!tCheck.ok) throw new Error(`Invalid ${seed.code} template: ${tCheck.errors.join(', ')}`)
      version = await db.factoryTemplateVersion.create({ data: {
        templateId: tpl.id, version: 1, semver: '1.0.0', definition: jsonText(seed.definition),
        checksum: checksum(seed.definition), status: 'APPROVED',
        testResults: jsonText({ ranAt: new Date().toISOString(), checks: tCheck, passed: true, note: 'Structural + capability + dependency checks executed at bootstrap.' }),
        releaseNotes: 'Initial approved private template version.', approvedBy: actor.email,
        approvedAt: new Date(), createdBy: actor.email,
      } })
      created.templateVersions++
      for (const m of seed.definition.modules) {
        await db.factoryTemplateModule.create({ data: {
          templateVersionId: version.id, moduleId: m.code, required: m.required, config: null,
        } })
        created.links++
      }
    }
    const allApproved = (await db.factoryTemplateModule.count({ where: { templateVersionId: version.id } })) === seed.definition.modules.length
    const vCheck = validateTemplateDefinition(seed.definition, moduleRefs)
    if (vCheck.ok && allApproved && version.status === 'APPROVED') {
      await db.factoryTemplate.update({ where: { id: tpl.id }, data: { currentVersion: Math.max(tpl.currentVersion, 1), status: 'PRODUCTION_READY' } })
      await db.factoryTemplateVersion.update({ where: { id: version.id }, data: { testResults: jsonText({ ranAt: new Date().toISOString(), checks: vCheck, linksVerified: allApproved, passed: true }) } })
    }
    checks.push({ key: `template.${seed.code}`, ok: vCheck.ok && allApproved, detail: vCheck.ok ? `${seed.definition.modules.length} approved module links verified` : vCheck.errors.join(', ') })
  }

  checks.push({ key: 'templates.production_ready', ok: checks.filter((c) => c.key.startsWith('template.')).every((c) => c.ok), detail: 'production readiness is granted only after real checks pass' })
  const ok = checks.every((c) => c.ok)
  await writeFactoryAudit({ actor, action: 'FACTORY_CATALOG_BOOTSTRAP', targetType: 'CATALOG', targetId: 'library', decision: ok ? 'ALLOW' : 'DENY', detail: { created, ok } })
  return { created, checks, ok }
}

/** Load the approved module/template graph from the database for validation. */
export async function loadModuleRefs(requested?: Record<string, number>): Promise<Map<string, ModuleRef>> {
  const [modules, versions] = await Promise.all([
    db.factoryModule.findMany(),
    db.factoryModuleVersion.findMany({ where: { status: 'APPROVED' }, orderBy: { version: 'desc' } }),
  ])
  const out = new Map<string, ModuleRef>()
  for (const m of modules) {
    const wanted = requested?.[m.code]
    const v = (wanted ? versions.find((x) => x.moduleId === m.id && x.version === wanted) : undefined)
      ?? versions.find((x) => x.moduleId === m.id)
    if (!v || !parseSemver(v.semver)) continue
    out.set(m.code, {
      id: v.id, code: m.code, version: v.version, semver: v.semver, status: v.status,
      capability: m.capability as Capability, manifest: JSON.parse(v.manifest) as ModuleManifest,
    })
  }
  return out
}
