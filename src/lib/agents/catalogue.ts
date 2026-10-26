// ============================================================
// TECH360 — logical agent catalogue
// ============================================================
// The registry supports 100+ departments (it has 110) and at least
// 2,000 logical agent definitions. This module generates 2,200
// logical agents: 20 role archetypes specialised for each of the 110
// departments.
//
// HONESTY NOTE
// ------------
// These are LOGICAL agent definitions, not 2,200 separate model
// processes. Each definition declares its model profile, permissions,
// skills, approvals and limits; the runtime executes them through the
// bounded worker pool and the durable task queue. A logical agent is
// "executable" only when every skill it names has a registered handler
// and a passing test.
//
// The declaration format is the one from the specification, so the
// catalogue can be exported as YAML and consumed by other tooling.
// ============================================================

import { DEPARTMENTS } from '@/lib/agents/registry'
import { CAPABILITY_TEMPLATES, departmentSlug } from '@/lib/skills/catalog'
import type { JsonSchema } from '@/lib/skills/types'

export type ModelProfileName = 'cpu_fast' | 'cpu_general' | 'cpu_quality' | 'embedding'

export type LogicalAgentDefinition = {
  id: string
  department: string
  name: string
  model_profile: ModelProfileName
  enabled: boolean
  permissions: string[]
  skills: string[]
  approval_required: string[]
  limits: { max_tool_calls: number; timeout_seconds: number; max_retries: number }
  purpose: string
  status: 'ACTIVE' | 'SUSPENDED' | 'DRAFT'
}

// ------------------------------------------------------------
// Role archetypes — one per skill capability
// ------------------------------------------------------------

export type RoleArchetype = {
  /** Suffix used in the agent id, e.g. "lead_qualification". */
  slug: string
  title: string
  purpose: string
  model_profile: ModelProfileName
  /** Permission suffixes granted on top of the department permission. */
  permissions: string[]
  /** Actions that always require human approval. */
  approval_required: string[]
  limits: { max_tool_calls: number; timeout_seconds: number; max_retries: number }
}

export const ROLE_ARCHETYPES: RoleArchetype[] = [
  {
    slug: 'lead_qualification',
    title: 'Lead Qualification Agent',
    purpose: 'Scores inbound enquiries and proposes a qualification outcome for a human to confirm.',
    model_profile: 'cpu_general',
    permissions: ['leads.read', 'leads.propose_update'],
    approval_required: ['crm.leads.bulk_update', 'messaging.send_external'],
    limits: { max_tool_calls: 8, timeout_seconds: 120, max_retries: 2 },
  },
  {
    slug: 'document_review',
    title: 'Document Review Agent',
    purpose: 'Classifies incoming documents and summarises them for staff review.',
    model_profile: 'cpu_general',
    permissions: ['documents.read', 'documents.propose_status'],
    approval_required: ['documents.delete', 'documents.publish'],
    limits: { max_tool_calls: 6, timeout_seconds: 120, max_retries: 2 },
  },
  {
    slug: 'enquiry_triage',
    title: 'Enquiry Triage Agent',
    purpose: 'Classifies inbound enquiries into the department’s label set and routes them.',
    model_profile: 'cpu_fast',
    permissions: ['inbox.read', 'inbox.propose_label'],
    approval_required: ['messaging.send_external'],
    limits: { max_tool_calls: 6, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'summarisation',
    title: 'Briefing Agent',
    purpose: 'Produces measured, extractive briefings from long documents.',
    model_profile: 'cpu_fast',
    permissions: ['knowledge.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 90, max_retries: 1 },
  },
  {
    slug: 'entity_extraction',
    title: 'Data Capture Agent',
    purpose: 'Extracts contact, reference and amount fields from free text.',
    model_profile: 'cpu_fast',
    permissions: ['records.read', 'records.propose_update'],
    approval_required: ['records.bulk_update'],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'bilingual_review',
    title: 'Bilingual Review Agent',
    purpose: 'Maps English and Bangla terms so both audiences read the same content.',
    model_profile: 'cpu_fast',
    permissions: ['knowledge.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'data_quality',
    title: 'Data Quality Agent',
    purpose: 'Validates payloads against the department’s required-field contract.',
    model_profile: 'cpu_fast',
    permissions: ['records.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'template_composer',
    title: 'Drafting Agent',
    purpose: 'Renders department templates with verified variables; drafts are never auto-sent.',
    model_profile: 'cpu_general',
    permissions: ['content.read', 'content.propose_draft'],
    approval_required: ['content.publish', 'messaging.send_external'],
    limits: { max_tool_calls: 6, timeout_seconds: 90, max_retries: 2 },
  },
  {
    slug: 'retrieval',
    title: 'Knowledge Retrieval Agent',
    purpose: 'Ranks and retrieves internal evidence for a question, with citations.',
    model_profile: 'embedding',
    permissions: ['knowledge.read'],
    approval_required: [],
    limits: { max_tool_calls: 6, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'grounded_qa',
    title: 'Grounded Answer Agent',
    purpose: 'Answers only from supplied evidence and reports insufficiency when it is missing.',
    model_profile: 'cpu_general',
    permissions: ['knowledge.read'],
    approval_required: [],
    limits: { max_tool_calls: 6, timeout_seconds: 90, max_retries: 1 },
  },
  {
    slug: 'compliance_check',
    title: 'Compliance Check Agent',
    purpose: 'Evaluates a work item against the department’s mandatory checklist.',
    model_profile: 'cpu_general',
    permissions: ['governance.read', 'records.read'],
    approval_required: ['compliance.sign_off'],
    limits: { max_tool_calls: 6, timeout_seconds: 90, max_retries: 1 },
  },
  {
    slug: 'record_hygiene',
    title: 'Record Hygiene Agent',
    purpose: 'Builds deduplication keys so repeated records are caught, not merged blindly.',
    model_profile: 'cpu_fast',
    permissions: ['records.read'],
    approval_required: ['records.merge', 'records.delete'],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'scheduling',
    title: 'Scheduling Agent',
    purpose: 'Resolves scheduling hints into explicit dates for human confirmation.',
    model_profile: 'cpu_fast',
    permissions: ['calendar.read', 'calendar.propose_slot'],
    approval_required: ['calendar.send_invite'],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'commercial_summary',
    title: 'Commercial Summary Agent',
    purpose: 'Formats monetary amounts in the company’s currency and locale for proposals.',
    model_profile: 'cpu_fast',
    permissions: ['finance.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'integrity_monitoring',
    title: 'Integrity Monitoring Agent',
    purpose: 'Fingerprints content so unauthorised changes are detectable.',
    model_profile: 'cpu_fast',
    permissions: ['knowledge.read', 'audit.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'content_metrics',
    title: 'Content Metrics Agent',
    purpose: 'Measures copy so readability and script coverage are reported, not assumed.',
    model_profile: 'cpu_fast',
    permissions: ['content.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'reference_normalisation',
    title: 'Reference Normalisation Agent',
    purpose: 'Canonicalises URLs and phone numbers so records deduplicate correctly.',
    model_profile: 'cpu_fast',
    permissions: ['records.read'],
    approval_required: [],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'quality_editor',
    title: 'Quality Editor Agent',
    purpose: 'Measures readability and proposes copy improvements for human approval.',
    model_profile: 'cpu_fast',
    permissions: ['content.read', 'content.propose_draft'],
    approval_required: ['content.publish'],
    limits: { max_tool_calls: 4, timeout_seconds: 60, max_retries: 1 },
  },
  {
    slug: 'evidence_reporting',
    title: 'Evidence Reporting Agent',
    purpose: 'Assembles auditable reports from internal records with source references.',
    model_profile: 'cpu_general',
    permissions: ['audit.read', 'knowledge.read'],
    approval_required: ['report.publish'],
    limits: { max_tool_calls: 8, timeout_seconds: 120, max_retries: 2 },
  },
  {
    slug: 'escalation',
    title: 'Escalation Agent',
    purpose: 'Decides when work needs a human and proposes the escalation with context.',
    model_profile: 'cpu_general',
    permissions: ['inbox.read', 'inbox.propose_escalation'],
    approval_required: ['messaging.send_external', 'approvals.request'],
    limits: { max_tool_calls: 6, timeout_seconds: 90, max_retries: 2 },
  },
]

// ------------------------------------------------------------
// Generation
// ------------------------------------------------------------

/** Permission namespace per department category. */
const CATEGORY_PERMISSION: Record<string, string> = {
  EXECUTIVE: 'executive.read',
  REVENUE: 'crm.leads.read',
  DELIVERY: 'projects.read',
  TECHNOLOGY: 'technical.read',
  CONTENT: 'marketing.read',
  OPERATIONS: 'operations.read',
  GOVERNANCE: 'governance.read',
  SUPPORT: 'support.read',
}

/**
 * The capability templates each role archetype owns.
 *
 * The catalogue has 91 capability templates and 20 role archetypes.
 * The capabilities are dealt out round-robin, so EVERY capability is
 * owned by at least one role, and a role owns four or five of them.
 * A capability that no role owned would be a registered skill that
 * no employee could ever run.
 */
export function capabilitiesForRole(roleIndex: number): typeof CAPABILITY_TEMPLATES {
  return CAPABILITY_TEMPLATES.filter((_, index) => index % ROLE_ARCHETYPES.length === roleIndex)
}

export function buildLogicalAgentCatalogue(): LogicalAgentDefinition[] {
  const agents: LogicalAgentDefinition[] = []
  for (const department of DEPARTMENTS) {
    const deptSlug = departmentSlug(department.name)
    const basePermission = CATEGORY_PERMISSION[department.category] ?? 'internal.read'
    for (let index = 0; index < ROLE_ARCHETYPES.length; index++) {
      const role = ROLE_ARCHETYPES[index]
      const capabilities = capabilitiesForRole(index)
      if (capabilities.length === 0) continue
      const skills = capabilities.map((capability) => `${deptSlug}_${capability.slug}`)
      agents.push({
        id: `tech360.${department.code.toLowerCase()}.${role.slug}`,
        department: department.code,
        name: `${department.name} ${role.title}`,
        model_profile: role.model_profile,
        enabled: true,
        permissions: Array.from(new Set([basePermission, ...role.permissions])),
        skills,
        approval_required: role.approval_required,
        limits: role.limits,
        purpose: `${role.purpose} Owned by ${department.name} (${department.code}).`,
        status: 'ACTIVE',
      })
    }
  }
  return agents
}

export const LOGICAL_AGENT_CATALOGUE: LogicalAgentDefinition[] = buildLogicalAgentCatalogue()

export const LOGICAL_AGENT_COUNT = LOGICAL_AGENT_CATALOGUE.length

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

export type LogicalAgentIssue = { code: string; message: string; agentId: string }

export function validateLogicalAgentCatalogue(
  agents: LogicalAgentDefinition[] = LOGICAL_AGENT_CATALOGUE,
): { valid: boolean; issues: LogicalAgentIssue[] } {
  const issues: LogicalAgentIssue[] = []
  const seen = new Set<string>()
  const departmentCodes = new Set(DEPARTMENTS.map((d) => d.code))
  const knownSkills = new Set(CAPABILITY_TEMPLATES.map((c) => c.slug))

  for (const agent of agents) {
    if (seen.has(agent.id)) {
      issues.push({ code: 'DUPLICATE_ID', message: `agent id "${agent.id}" is registered more than once`, agentId: agent.id })
    }
    seen.add(agent.id)
    if (!departmentCodes.has(agent.department)) {
      issues.push({ code: 'UNKNOWN_DEPARTMENT', message: `agent "${agent.id}" references unknown department "${agent.department}"`, agentId: agent.id })
    }
    if (!agent.name || agent.name.length < 3) {
      issues.push({ code: 'MISSING_NAME', message: `agent "${agent.id}" has no usable name`, agentId: agent.id })
    }
    if (!agent.purpose || agent.purpose.length < 10) {
      issues.push({ code: 'MISSING_PURPOSE', message: `agent "${agent.id}" has no usable purpose`, agentId: agent.id })
    }
    if (!Array.isArray(agent.permissions) || agent.permissions.length === 0) {
      issues.push({ code: 'NO_PERMISSIONS', message: `agent "${agent.id}" declares no permissions`, agentId: agent.id })
    }
    if (!Array.isArray(agent.skills) || agent.skills.length === 0) {
      issues.push({ code: 'NO_SKILLS', message: `agent "${agent.id}" declares no skills`, agentId: agent.id })
    } else {
      for (const skill of agent.skills) {
        // A skill id is `<department slug>_<capability slug>`, and a
        // capability slug can be three words long, so the suffix is
        // matched against the known capability list rather than
        // guessed from the last two segments.
        const known = knownSkills.has(skill) || [...knownSkills].some((slug) => skill.endsWith(`_${slug}`))
        if (!known) {
          issues.push({ code: 'UNKNOWN_SKILL', message: `agent "${agent.id}" names unknown skill "${skill}"`, agentId: agent.id })
        }
      }
    }
    if (agent.limits.max_tool_calls <= 0 || agent.limits.timeout_seconds <= 0 || agent.limits.max_retries < 0) {
      issues.push({ code: 'INVALID_LIMITS', message: `agent "${agent.id}" declares invalid limits`, agentId: agent.id })
    }
  }
  return { valid: issues.length === 0, issues }
}

// ------------------------------------------------------------
// YAML export (the declaration format from the specification)
// ------------------------------------------------------------

function yamlScalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  const text = String(value ?? '')
  if (text === '' || /[:#\-{}[\],&*?|<>=!%@`"']/.test(text)) return `"${text.replace(/"/g, '\\"')}"`
  return text
}

function yamlList(indent: string, values: string[]): string {
  if (values.length === 0) return `${indent}[]\n`
  return values.map((v) => `${indent}- ${yamlScalar(v)}\n`).join('')
}

/** Serialise one agent to the specification's YAML declaration format. */
export function toAgentYaml(agent: LogicalAgentDefinition): string {
  return [
    `id: ${yamlScalar(agent.id)}\n`,
    `department: ${yamlScalar(agent.department)}\n`,
    `name: ${yamlScalar(agent.name)}\n`,
    `model_profile: ${yamlScalar(agent.model_profile)}\n`,
    `enabled: ${agent.enabled}\n`,
    `permissions:\n`,
    yamlList('  ', agent.permissions),
    `skills:\n`,
    yamlList('  ', agent.skills),
    `approval_required:\n`,
    yamlList('  ', agent.approval_required),
    `limits:\n`,
    `  max_tool_calls: ${agent.limits.max_tool_calls}\n`,
    `  timeout_seconds: ${agent.limits.timeout_seconds}\n`,
    `  max_retries: ${agent.limits.max_retries}\n`,
  ].join('')
}

/** Serialise the whole catalogue as a multi-document YAML stream. */
export function toAgentCatalogueYaml(agents: LogicalAgentDefinition[] = LOGICAL_AGENT_CATALOGUE): string {
  return agents.map((a) => `---\n${toAgentYaml(a)}`).join('')
}

export type { JsonSchema }
