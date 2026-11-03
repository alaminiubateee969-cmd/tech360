/**
 * Software Factory Control Center — shared vocabulary.
 *
 * These are the only statuses the control plane is allowed to display. A
 * status is written only after the corresponding real work has completed and
 * been verified (see provision.ts / health.ts / releases.ts / backup.ts).
 */

export const COMPANY_KINDS = ['PARENT', 'SISTER', 'CLIENT', 'BUSINESS_UNIT'] as const
export type CompanyKind = (typeof COMPANY_KINDS)[number]

export const ISOLATION_MODELS = ['SHARED_TENANT', 'DEDICATED'] as const
export type IsolationModel = (typeof ISOLATION_MODELS)[number]

export const ENVIRONMENTS = ['DEV', 'STAGING', 'PRODUCTION'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export const APP_STATUSES = [
  'DRAFT', 'VALIDATED', 'PROVISIONING', 'TEST_FAILED', 'STAGING',
  'AWAITING_APPROVAL', 'LIVE', 'DEGRADED', 'ROLLED_BACK', 'RETIRED',
] as const
export type AppStatus = (typeof APP_STATUSES)[number]

export const TEMPLATE_STATUSES = ['DRAFT', 'VALIDATED', 'PRODUCTION_READY', 'RETIRED'] as const
export const VERSION_STATUSES = ['DRAFT', 'VALIDATED', 'APPROVED', 'SUPERSEDED'] as const
export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'AWAITING_APPROVAL', 'CANCELLED'] as const
export const RELEASE_STATUSES = ['DRAFT', 'STAGING', 'APPROVED', 'DEPLOYED', 'ROLLED_BACK', 'FAILED'] as const
export const HEALTH_STATUSES = ['UNKNOWN', 'HEALTHY', 'DEGRADED', 'DOWN'] as const
export const INTEGRATION_STATUSES = ['DISABLED', 'NOT_CONFIGURED', 'AVAILABLE', 'UNAVAILABLE', 'ERROR'] as const

export const COMPANY_ROLES = ['COMPANY_ADMIN', 'COMPANY_USER', 'COMPANY_AUDITOR', 'FACTORY_OPERATOR'] as const
export type CompanyRole = (typeof COMPANY_ROLES)[number]

/** Roles that may write a company's private business data. */
// FACTORY_OPERATOR is a privileged, time-limited, explicitly granted and fully
// audited support membership. It is not an automatic entitlement: without a
// matching FactoryCompanyMember row (grantor + reason + expiry) a factory
// SUPER_ADMIN has no access to a company's private business data at all.
export const WRITE_ROLES: readonly CompanyRole[] = ['COMPANY_ADMIN', 'COMPANY_USER', 'FACTORY_OPERATOR'] as const
/** Roles that may read a company's private business data. */
export const READ_ROLES: readonly CompanyRole[] = ['COMPANY_ADMIN', 'COMPANY_USER', 'COMPANY_AUDITOR', 'FACTORY_OPERATOR'] as const

/**
 * Capabilities that are REALLY implemented by this control plane. A template
 * may only become production-ready when every required module names one of
 * these; an unknown capability can never be approved as working software.
 */
export const IMPLEMENTED_CAPABILITIES = [
  'identity', 'contacts', 'workflow', 'documents', 'audit',
  'notifications', 'reporting', 'integration_hub',
] as const
export type Capability = (typeof IMPLEMENTED_CAPABILITIES)[number]

export const CHANGE_DISPOSITIONS = ['PENDING_TRIAGE', 'CORE', 'MODULE', 'CONFIG', 'CLIENT_EXTENSION', 'REJECTED'] as const

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export interface ModuleEntityField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'email' | 'textarea'
  required?: boolean
}

export interface ModuleEntity {
  key: string
  label: string
  fields: ModuleEntityField[]
}

/** A shared module version's manifest. One capability, implemented once. */
export interface ModuleManifest {
  schemaVersion: 1
  capability: Capability
  dependencies: string[] // module codes
  permissions: string[] // e.g. contacts.read, contacts.write
  configKeys: string[]
  entities: ModuleEntity[]
  migrations: string[]
  testDefinitions: string[]
  acceptanceCriteria: string[]
}

/** A versioned private application template. */
export interface TemplateDefinition {
  schemaVersion: 1
  category: string
  description: string
  modules: Array<{ code: string; required: boolean; config?: Record<string, unknown> }>
  roles: Array<{ key: string; label: string; permissions: string[] }>
  navigation: string[]
  defaults: Record<string, unknown>
  workflows: Array<{ key: string; label: string; steps: string[] }>
  notifications: Array<{ key: string; event: string; template: string }>
  security: { requireExplicitGrants: boolean; secretRefs: string[]; notes: string }
  dataModel: string[]
  businessRules: string[]
  integrationAdapters: string[]
  testDefinitions: string[]
  acceptanceCriteria: string[]
  setupProcedure: string[]
  upgradeProcedure: string[]
  backupProcedure: string[]
  rollbackProcedure: string[]
}

export interface CompanyDefinition {
  schemaVersion: 1
  identity: {
    name: string
    legalName?: string
    slug: string
    kind: CompanyKind
    industry?: string
    domain?: string
    isolationModel: IsolationModel
    environment: Environment
    deploymentModel: IsolationModel
  }
  template: { code: string; version: number }
  modules: Array<{ code: string; version: number; enabled: boolean; config?: Record<string, unknown> }>
  branding: {
    primaryColor?: string
    accentColor?: string
    logoText?: string
    productName?: string
  }
  organization: {
    departments: string[]
    teams: string[]
    users: Array<{ email: string; role: CompanyRole }>
  }
  workflows: {
    pipelines: string[]
    approvalChains: string[]
    slaHours: number
    rules: Array<{ key: string; trigger: string; action: string }>
  }
  policies: { retentionDays: number; backupPolicy: string; dataResidency?: string }
  integrations: string[]
  navigation: string[]
  customFields: Array<{ module: string; entity: string; key: string; label: string; type: string }>
  extensions: Array<{ kind: 'CONFIG' | 'ENGINEERING'; note: string }>
}

/** The configuration actually applied to one application instance. */
/**
 * Design tokens and runtime pages are part of the VERSIONED CONFIGURATION.
 * The runtime renderer reads them from the application's config; changing a
 * company's theme or pages is a configuration-only change, not a code change.
 * They are optional because applications provisioned before this capability
 * still have valid, checksummed configurations.
 */
export interface ThemeTokens {
  primary: string
  accent: string
  surface: string
  background: string
  text: string
  muted: string
  motif?: string
  radius?: 'soft' | 'sharp'
  density?: 'comfortable' | 'compact'
}

export interface RuntimePage {
  key: string
  label: string
  kind: 'dashboard' | 'list' | 'board' | 'gallery' | 'report' | 'form' | 'timeline'
  module?: string
  entityType?: string
  description: string
  metrics?: string[]
}

export interface ApplicationConfig {
  schemaVersion: 1
  companySlug: string
  branding: CompanyDefinition['branding']
  departments: string[]
  teams: string[]
  roles: Array<{ email: string; role: CompanyRole }>
  navigation: string[]
  modules: Array<{ code: string; capability: Capability; version: number; semver: string; enabled: boolean; config: Record<string, unknown> }>
  fields: Record<string, unknown>
  workflows: CompanyDefinition['workflows']
  notifications: Array<{ key: string; event: string; template: string }>
  reports: string[]
  integrations: string[]
  retention: { days: number; backupPolicy: string; dataResidency?: string }
  extensions: Array<{ kind: 'CONFIG' | 'ENGINEERING'; note: string }>
  automatedSteps: string[]
  manualSteps: string[]
  theme?: ThemeTokens
  pages?: RuntimePage[]
}

export interface StepResult {
  key: string
  label: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  detail: string
}

export interface CheckResult {
  key: string
  label: string
  ok: boolean
  detail: string
}
