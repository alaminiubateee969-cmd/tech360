/**
 * Company definitions, template/module manifests and configuration assembly.
 *
 * Pure functions: no database, no network, no hidden defaults. Every rule
 * here is exercised by tests/factory-control-policy.test.ts. The DB layer
 * calls these before it writes anything.
 */
import {
  COMPANY_KINDS, COMPANY_ROLES, ENVIRONMENTS, IMPLEMENTED_CAPABILITIES, ISOLATION_MODELS,
  type ApplicationConfig, type Capability, type CompanyDefinition, type CompanyKind,
  type CompanyRole, type Environment, type IsolationModel, type ModuleManifest,
  type TemplateDefinition, type ThemeTokens, type RuntimePage,
} from './types'
import { asRecord, asStringArray, isSafeObject, mergeConfig, secretLikeReason, slugify } from './util'

export interface ModuleRef {
  id: string
  code: string
  version: number
  semver: string
  status: string
  capability: Capability
  manifest: ModuleManifest
}

export interface TemplateRef {
  code: string
  version: number
  semver: string
  status: string
  definition: TemplateDefinition
}

export interface ValidationContext {
  template: TemplateRef
  modules: Map<string, ModuleRef>
  existingSlugs: string[]
  existingDomains: string[]
  /** Whether the caller is allowed to request the DEDICATED deployment model. */
  allowDedicated: boolean
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  manualSteps: string[]
  automatedSteps: string[]
  requiresEngineering: boolean
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const HEX = /^#[0-9a-fA-F]{6}$/

export function normalizeDefinition(input: unknown): CompanyDefinition {
  const r = asRecord(input)
  const identity = asRecord(r.identity)
  const template = asRecord(r.template)
  const branding = asRecord(r.branding)
  const organization = asRecord(r.organization)
  const workflows = asRecord(r.workflows)
  const policies = asRecord(r.policies)
  const kind = COMPANY_KINDS.includes(identity.kind as CompanyKind) ? (identity.kind as CompanyKind) : 'CLIENT'
  const environment = ENVIRONMENTS.includes(identity.environment as Environment) ? (identity.environment as Environment) : 'STAGING'
  const iso = ISOLATION_MODELS.includes(identity.isolationModel as IsolationModel) ? (identity.isolationModel as IsolationModel) : 'SHARED_TENANT'
  const deploymentModel = ISOLATION_MODELS.includes(identity.deploymentModel as IsolationModel) ? (identity.deploymentModel as IsolationModel) : iso
  return {
    schemaVersion: 1,
    identity: {
      name: String(identity.name ?? '').trim().slice(0, 120),
      legalName: identity.legalName ? String(identity.legalName).trim().slice(0, 160) : undefined,
      slug: slugify(String(identity.slug ?? identity.name ?? '')),
      kind,
      industry: identity.industry ? String(identity.industry).trim().slice(0, 80) : undefined,
      domain: identity.domain ? String(identity.domain).trim().toLowerCase().slice(0, 160) : undefined,
      isolationModel: iso,
      environment,
      deploymentModel,
    },
    template: { code: String(template.code ?? '').trim(), version: Number(template.version ?? 0) | 0 },
    modules: (Array.isArray(r.modules) ? r.modules : []).map((m) => {
      const x = asRecord(m)
      return {
        code: String(x.code ?? '').trim(),
        version: Number(x.version ?? 0) | 0,
        enabled: x.enabled !== false,
        config: asRecord(x.config),
      }
    }),
    branding: {
      primaryColor: branding.primaryColor ? String(branding.primaryColor) : undefined,
      accentColor: branding.accentColor ? String(branding.accentColor) : undefined,
      logoText: branding.logoText ? String(branding.logoText).slice(0, 80) : undefined,
      productName: branding.productName ? String(branding.productName).slice(0, 120) : undefined,
    },
    organization: {
      departments: asStringArray(organization.departments).map((s) => s.slice(0, 80)),
      teams: asStringArray(organization.teams).map((s) => s.slice(0, 80)),
      users: (Array.isArray(organization.users) ? organization.users : []).map((u) => {
        const x = asRecord(u)
        const role = x.role as CompanyRole
        return { email: String(x.email ?? '').toLowerCase().trim(), role: COMPANY_ROLES.includes(role) ? role : 'COMPANY_USER' }
      }),
    },
    workflows: {
      pipelines: asStringArray(workflows.pipelines),
      approvalChains: asStringArray(workflows.approvalChains),
      slaHours: Number(workflows.slaHours ?? 48) | 0,
      rules: (Array.isArray(workflows.rules) ? workflows.rules : []).map((x) => {
        const y = asRecord(x)
        return { key: String(y.key ?? ''), trigger: String(y.trigger ?? ''), action: String(y.action ?? '') }
      }),
    },
    policies: {
      retentionDays: Number(policies.retentionDays ?? 365) | 0,
      backupPolicy: String(policies.backupPolicy ?? 'DAILY'),
      dataResidency: policies.dataResidency ? String(policies.dataResidency) : undefined,
    },
    integrations: asStringArray(r.integrations),
    navigation: asStringArray(r.navigation),
    customFields: (Array.isArray(r.customFields) ? r.customFields : []).map((x) => {
      const y = asRecord(x)
      return { module: String(y.module ?? ''), entity: String(y.entity ?? ''), key: String(y.key ?? ''), label: String(y.label ?? ''), type: String(y.type ?? 'text') }
    }),
    extensions: (Array.isArray(r.extensions) ? r.extensions : []).map((x) => {
      const y = asRecord(x)
      return { kind: y.kind === 'ENGINEERING' ? 'ENGINEERING' as const : 'CONFIG' as const, note: String(y.note ?? '').slice(0, 500) }
    }),
  }
}

export function validateModuleManifest(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const m = asRecord(value)
  if (m.schemaVersion !== 1) errors.push('manifest.schemaVersion must be 1')
  const capability = String(m.capability ?? '')
  if (!IMPLEMENTED_CAPABILITIES.includes(capability as Capability)) {
    errors.push(`capability "${capability}" is not implemented by this control plane`)
  }
  const deps = asStringArray(m.dependencies)
  if (deps.some((d) => !/^[a-z0-9-]+$/.test(d))) errors.push('dependencies must be module codes')
  const permissions = asStringArray(m.permissions)
  if (permissions.length === 0) errors.push('module must declare permissions')
  const entities = Array.isArray(m.entities) ? m.entities : []
  if (entities.length === 0 && capability !== 'audit' && capability !== 'integration_hub' && capability !== 'reporting') {
    errors.push('module must declare at least one entity')
  }
  for (const raw of entities) {
    const e = asRecord(raw)
    if (!/^[A-Z][A-Z0-9_]{1,40}$/.test(String(e.key ?? ''))) errors.push(`invalid entity key "${String(e.key)}"`)
    const fields = Array.isArray(e.fields) ? e.fields : []
    for (const f of fields) {
      const field = asRecord(f)
      if (!/^[a-z][a-zA-Z0-9_]{0,40}$/.test(String(field.key ?? ''))) errors.push(`invalid field key "${String(field.key)}"`)
      if (!['text', 'number', 'date', 'boolean', 'email', 'textarea'].includes(String(field.type))) {
        errors.push(`unsupported field type "${String(field.type)}"`)
      }
    }
  }
  if (!Array.isArray(m.testDefinitions) || (m.testDefinitions as unknown[]).length === 0) errors.push('module must declare test definitions')
  if (!Array.isArray(m.acceptanceCriteria) || (m.acceptanceCriteria as unknown[]).length === 0) errors.push('module must declare acceptance criteria')
  return { ok: errors.length === 0, errors }
}

/** A template is only valid when every required module is an approved, implemented capability. */
export function validateTemplateDefinition(value: unknown, modules: Map<string, ModuleRef>): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const t = asRecord(value)
  if (t.schemaVersion !== 1) errors.push('definition.schemaVersion must be 1')
  if (!String(t.category ?? '').trim()) errors.push('category is required')
  if (!String(t.description ?? '').trim()) errors.push('description is required')
  const listed = Array.isArray(t.modules) ? t.modules : []
  if (listed.length === 0) errors.push('template must compose at least one module')
  const required: string[] = []
  for (const raw of listed) {
    const x = asRecord(raw)
    const code = String(x.code ?? '')
    const mod = modules.get(code)
    if (!mod) { errors.push(`unknown module "${code}"`); continue }
    if (mod.status !== 'APPROVED') { errors.push(`module ${code} v${mod.version} is not approved`); continue }
    const mCheck = validateModuleManifest(mod.manifest)
    if (!mCheck.ok) errors.push(...mCheck.errors.map((e) => `${code}: ${e}`))
    if (x.required !== false) required.push(code)
  }
  for (const code of required) {
    for (const dep of modules.get(code)?.manifest.dependencies ?? []) {
      if (!listed.some((raw) => String(asRecord(raw).code) === dep)) {
        errors.push(`module ${code} requires dependency "${dep}" which the template does not include`)
      }
    }
  }
  if (!Array.isArray(t.roles) || (t.roles as unknown[]).length === 0) errors.push('roles are required')
  if (!Array.isArray(t.navigation) || (t.navigation as unknown[]).length === 0) errors.push('navigation is required')
  const security = asRecord(t.security)
  if (security.requireExplicitGrants !== true) errors.push('security.requireExplicitGrants must be true')
  for (const key of ['testDefinitions', 'acceptanceCriteria', 'setupProcedure', 'upgradeProcedure', 'backupProcedure', 'rollbackProcedure']) {
    if (!Array.isArray(t[key]) || (t[key] as unknown[]).length === 0) errors.push(`${key} must be a non-empty list`)
  }
  return { ok: errors.length === 0, errors }
}

/** Full company-definition validation. No database writes happen before this passes. */
export function validateDefinition(def: CompanyDefinition, ctx: ValidationContext): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const manualSteps: string[] = []
  const automatedSteps: string[] = []
  const i = def.identity

  if (!isSafeObject(def)) errors.push('definition contains unsafe object keys')
  if (i.name.length < 2) errors.push('company name must be at least 2 characters')
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(i.slug)) errors.push('slug must be 3–60 lowercase letters, digits or hyphens')
  if (ctx.existingSlugs.includes(i.slug)) errors.push(`slug "${i.slug}" is already in use`)
  if (i.domain) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(i.domain)) errors.push('domain is not valid')
    if (ctx.existingDomains.includes(i.domain)) errors.push(`domain "${i.domain}" is already assigned to another company`)
  }
  if (!COMPANY_KINDS.includes(i.kind)) errors.push('invalid company kind')
  if (!ISOLATION_MODELS.includes(i.isolationModel)) errors.push('invalid isolation model')
  if (i.deploymentModel === 'DEDICATED') {
    if (!ctx.allowDedicated) errors.push('dedicated deployment requires an authorized factory administrator')
    warnings.push('Dedicated instances require separate infrastructure; the control plane records the requirement but does not create it.')
    manualSteps.push('Provision a separate database, storage bucket, credentials and domain for this company.')
    manualSteps.push('Deploy the generated deployment specification from the release record and verify TLS/DNS.')
    manualSteps.push('Record deployment evidence before activation; the factory will not mark it LIVE without it.')
  }
  const secret = secretLikeReason(def)
  if (secret) errors.push(`definition contains secret-like content (${secret}); store credential references, never values`)

  if (ctx.template.code !== def.template.code) errors.push('template code does not match the selected template')
  if (ctx.template.version !== def.template.version) errors.push('template version does not match the selected version')
  if (ctx.template.status !== 'APPROVED' && ctx.template.status !== 'PRODUCTION_READY') {
    errors.push('selected template version is not approved for production')
  }
  const tCheck = validateTemplateDefinition(ctx.template.definition, ctx.modules)
  if (!tCheck.ok) errors.push(...tCheck.errors.map((e) => `template: ${e}`))

  const selected = new Set(def.modules.filter((m) => m.enabled).map((m) => m.code))
  if (selected.size !== def.modules.filter((m) => m.enabled).length) errors.push('duplicate module selection')
  for (const m of def.modules.filter((x) => x.enabled)) {
    const ref = ctx.modules.get(m.code)
    if (!ref) { errors.push(`unknown module "${m.code}"`); continue }
    if (m.version !== ref.version) errors.push(`${m.code}: requested version ${m.version}, approved version is ${ref.version}`)
    if (ref.status !== 'APPROVED') errors.push(`${m.code} version is not approved`)
    const composed = ctx.template.definition.modules.find((x) => x.code === m.code)
    if (!composed) errors.push(`${m.code} is not part of template ${ctx.template.code}`)
  }
  for (const t of ctx.template.definition.modules.filter((x) => x.required)) {
    if (!selected.has(t.code)) errors.push(`required module "${t.code}" is not selected`)
  }
  for (const m of def.modules.filter((x) => x.enabled)) {
    for (const dep of ctx.modules.get(m.code)?.manifest.dependencies ?? []) {
      if (!selected.has(dep)) errors.push(`${m.code} requires module "${dep}"`)
    }
  }
  for (const f of def.customFields) {
    const ref = ctx.modules.get(f.module)
    if (!ref || !selected.has(f.module)) { errors.push(`custom field refers to unselected module ${f.module}`); continue }
    const entity = ref.manifest.entities.find((e) => e.key === f.entity)
    if (!entity) errors.push(`custom field refers to unknown entity ${f.module}/${f.entity}`)
    if (!/^[a-z][a-zA-Z0-9_]{0,40}$/.test(f.key)) errors.push(`invalid custom field key ${f.key}`)
    if (entity?.fields.some((x) => x.key === f.key)) errors.push(`custom field ${f.key} duplicates a core field`)
  }

  if (def.branding.primaryColor && !HEX.test(def.branding.primaryColor)) errors.push('primaryColor must be a #RRGGBB hex value')
  if (def.branding.accentColor && !HEX.test(def.branding.accentColor)) errors.push('accentColor must be a #RRGGBB hex value')
  const emails = def.organization.users.map((u) => u.email)
  if (emails.some((e) => !EMAIL.test(e))) errors.push('one or more user emails are invalid')
  if (new Set(emails).size !== emails.length) errors.push('duplicate user email in the company definition')
  if (!def.organization.users.some((u) => u.role === 'COMPANY_ADMIN')) {
    errors.push('at least one COMPANY_ADMIN must be assigned before provisioning')
  }
  if (def.policies.retentionDays < 1 || def.policies.retentionDays > 3650) errors.push('retentionDays must be between 1 and 3650')
  if (!/^[A-Z_]+$/.test(def.policies.backupPolicy)) errors.push('backupPolicy must be an uppercase policy name')
  if (def.workflows.slaHours < 1) errors.push('slaHours must be positive')
  for (const provider of def.integrations) {
    if (!/^[a-z0-9_-]+$/.test(provider)) errors.push(`invalid integration key "${provider}"`)
  }
  const requiresEngineering = def.extensions.some((x) => x.kind === 'ENGINEERING')
  if (requiresEngineering) {
    warnings.push('This definition declares ENGINEERING extensions. They are NOT implemented by configuration and must be built, reviewed and released separately.')
    manualSteps.push('Implement, test and approve the declared ENGINEERING extensions through the Engineering Workspace before go-live.')
  }

  automatedSteps.push('Validate company definition, template version and module compatibility')
  automatedSteps.push('Create isolated company identity, tenant key and versioned company definition')
  automatedSteps.push('Pin approved module versions and generate company-specific configuration')
  automatedSteps.push('Initialize roles, permissions, module entities, navigation and workflows')
  automatedSteps.push('Register integration adapters with honest status')
  automatedSteps.push('Run automated setup and acceptance checks, then record a real health check')
  automatedSteps.push('Create a pre-activation backup and an approval-gated release')
  manualSteps.push('Review the provisioning result and approve activation')
  if (i.deploymentModel !== 'DEDICATED') manualSteps.push('Verify the company domain/route from the customer administration panel')

  return { ok: errors.length === 0, errors, warnings, manualSteps, automatedSteps, requiresEngineering }
}

/** Build the concrete configuration for one application from an approved template. */
/** Derive a meaningful, module-backed page from a navigation label when an
 * older approved template version does not declare explicit pages. This keeps
 * the four original core templates fully operational in the shared runtime. */
function fallbackPage(label: string, index: number, def: CompanyDefinition): RuntimePage {
  const lower = label.toLowerCase()
  const has = (code: string) => def.modules.some((m) => m.enabled && m.code === code)
  const kind: RuntimePage['kind'] = index === 0 ? 'dashboard'
    : /report|analytic|insight|finance|quality|statistic|progress/.test(lower) ? 'report'
    : /board|pipeline|order|lead|booking|appointment|task|assessment|production|approval|viewing/.test(lower) ? 'board'
    : /gallery|catalog|product|listing|program|course|campus|destination|gear|service|workout|specialist/.test(lower) ? 'gallery'
    : /timeline|itinerar|schedule|delivery|message|campaign|history|activity/.test(lower) ? 'timeline'
    : /form|inquiry|admission|intake|new |create|submit/.test(lower) ? 'form'
    : 'list'
  let moduleCode: string | undefined
  let entityType: string | undefined
  if (kind === 'report' && has('reporting')) moduleCode = 'reporting'
  else if (/contact|client|customer|member|patient|student|traveller|user|people/.test(lower) && has('contacts')) { moduleCode = 'contacts'; entityType = 'CONTACT' }
  else if (/lead|inquiry|admission/.test(lower) && has('contacts')) { moduleCode = 'contacts'; entityType = 'LEAD' }
  else if (/document|file|certificate|attachment/.test(lower) && has('documents')) { moduleCode = 'documents'; entityType = 'DOCUMENT_META' }
  else if (/notif|message|campaign|announcement/.test(lower) && has('notifications')) { moduleCode = 'notifications'; entityType = 'NOTIFICATION' }
  else if (has('workflow') && ['board', 'timeline', 'form'].includes(kind)) { moduleCode = 'workflow'; entityType = 'TASK' }
  else if (has('contacts') && kind !== 'report') { moduleCode = 'contacts'; entityType = 'ORGANIZATION' }
  return {
    key: `page-${index + 1}`, label, kind, module: moduleCode, entityType,
    description: `${label} for ${def.identity.name}, composed from approved shared modules.`,
    metrics: kind === 'dashboard' ? ['Records', 'Modules', 'Pages', 'Files'] : undefined,
  }
}

export function buildApplicationConfig(def: CompanyDefinition, template: TemplateDefinition, modules: Map<string, ModuleRef>): ApplicationConfig {
  const defaults = asRecord(template.defaults)
  const overrides: Record<string, unknown> = {
    branding: def.branding,
    departments: def.organization.departments,
    teams: def.organization.teams,
    navigation: def.navigation.length ? def.navigation : template.navigation,
    workflows: def.workflows,
    fields: Object.fromEntries(def.customFields.map((f) => [`${f.module}.${f.entity}.${f.key}`, { label: f.label, type: f.type }])),
    integrations: def.integrations,
    retention: { days: def.policies.retentionDays, backupPolicy: def.policies.backupPolicy, dataResidency: def.policies.dataResidency },
  }
  const merged = mergeConfig(defaults, overrides)
  // ---- configuration-driven presentation -------------------------------
  // Theme tokens and page definitions come from the APPROVED template, are
  // overridden by company branding, and are stored in the checksummed config.
  // One runtime renderer serves every company; nothing here is code per app.
  const rawTheme = asRecord(defaults.theme)
  const hex = (v: unknown, fallback: string) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback
  const theme: ThemeTokens = {
    primary: hex(def.branding.primaryColor, hex(rawTheme.primary, '#063B8F')),
    accent: hex(def.branding.accentColor, hex(rawTheme.accent, '#009FE3')),
    surface: hex(rawTheme.surface, '#FFFFFF'),
    background: hex(rawTheme.background, '#F4FAFF'),
    text: hex(rawTheme.text, '#0B1F33'),
    muted: hex(rawTheme.muted, '#526173'),
    motif: typeof rawTheme.motif === 'string' ? rawTheme.motif.slice(0, 60) : 'grid',
    radius: rawTheme.radius === 'sharp' ? 'sharp' : 'soft',
    density: rawTheme.density === 'compact' ? 'compact' : 'comfortable',
  }
  const rawPages = Array.isArray(defaults.pages) ? defaults.pages : []
  const nav = merged.navigation ? asStringArray(merged.navigation) : template.navigation
  const pages: RuntimePage[] = rawPages.length
    ? rawPages.map((raw, i) => {
        const p = asRecord(raw)
        const kind = String(p.kind ?? 'list')
        return {
          key: String(p.key ?? `page-${i + 1}`).slice(0, 60),
          label: String(p.label ?? `Page ${i + 1}`).slice(0, 80),
          kind: (['dashboard', 'list', 'board', 'gallery', 'report', 'form', 'timeline'] as const).includes(kind as RuntimePage['kind']) ? kind as RuntimePage['kind'] : 'list',
          module: p.module ? String(p.module).slice(0, 60) : undefined,
          entityType: p.entityType ? String(p.entityType).slice(0, 60) : undefined,
          description: String(p.description ?? '').slice(0, 300),
          metrics: Array.isArray(p.metrics) ? p.metrics.map((m) => String(m).slice(0, 80)).slice(0, 8) : undefined,
        }
      })
    : nav.map((label, i) => fallbackPage(label, i, def))
  return {
    schemaVersion: 1,
    companySlug: def.identity.slug,
    branding: def.branding,
    departments: def.organization.departments,
    teams: def.organization.teams,
    roles: def.organization.users,
    navigation: merged.navigation ? asStringArray(merged.navigation) : template.navigation,
    modules: def.modules.filter((m) => m.enabled).map((m) => {
      const ref = modules.get(m.code)!
      const composed = template.modules.find((x) => x.code === m.code)
      return {
        code: m.code,
        capability: ref.capability,
        version: ref.version,
        semver: ref.semver,
        enabled: true,
        config: { ...(composed?.config ?? {}), ...(m.config ?? {}) },
      }
    }),
    fields: Object.fromEntries(def.customFields.map((f) => [`${f.module}.${f.entity}.${f.key}`, { label: f.label, type: f.type }])),
    workflows: def.workflows,
    notifications: template.notifications,
    reports: asStringArray(merged.reports),
    integrations: def.integrations,
    retention: { days: def.policies.retentionDays, backupPolicy: def.policies.backupPolicy, dataResidency: def.policies.dataResidency },
    extensions: def.extensions,
    automatedSteps: [],
    manualSteps: [],
    theme,
    pages,
  }
}

/** Validate a business record against a module's declared entity schema. */
export function validateModuleRecord(manifest: ModuleManifest, entityType: string, value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!isSafeObject(value)) errors.push('record contains unsafe object keys')
  const data = asRecord(value)
  const entity = manifest.entities.find((e) => e.key === entityType)
  if (!entity) return { ok: false, errors: [`entity "${entityType}" is not declared by this module`] }
  const allowed = new Set(entity.fields.map((f) => f.key))
  for (const key of Object.keys(data)) if (!allowed.has(key)) errors.push(`field "${key}" is not declared for ${entityType}`)
  for (const field of entity.fields) {
    const v = data[field.key]
    if (field.required && (v === undefined || v === null || v === '')) { errors.push(`${field.key} is required`); continue }
    if (v === undefined || v === null) continue
    switch (field.type) {
      case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${field.key} must be a number`); break
      case 'boolean': if (typeof v !== 'boolean') errors.push(`${field.key} must be a boolean`); break
      case 'email': if (typeof v !== 'string' || !EMAIL.test(v)) errors.push(`${field.key} must be an email`); break
      case 'date': if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) errors.push(`${field.key} must be an ISO date`); break
      default: if (typeof v !== 'string') errors.push(`${field.key} must be text`)
    }
    if (typeof v === 'string' && v.length > 4000) errors.push(`${field.key} is too long`)
  }
  const secret = secretLikeReason(data)
  if (secret) errors.push(`record contains secret-like content (${secret})`)
  return { ok: errors.length === 0, errors }
}
