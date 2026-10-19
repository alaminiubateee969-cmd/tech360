// ============================================================
// TECH360 — Tool Registry
// ============================================================
// ONE secure tool registry.
//
// The platform already had a list of tool NAMES in
// `src/lib/ai-workforce-policy.ts` (`AGENT_TOOLS`, 51 entries) and a
// privileged subset. This module EXTENDS that list into a real
// registry: every tool now declares its input schema, its output
// schema, its permission, its risk level, its authentication, its rate
// limit, whether it needs an approval, and whether it must be audited.
//
// It does NOT replace the policy module. `AGENT_TOOLS` remains the
// authority for WHICH tools exist; this module describes them, and
// `validateToolRegistry()` proves the two agree.
// ============================================================

import { AGENT_TOOLS, PRIVILEGED_AGENT_TOOLS, type AgentTool } from '@/lib/ai-workforce-policy'
import type { JsonSchema } from '@/lib/skills/types'

export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ToolAuth = 'AGENT_GRANT' | 'HUMAN_APPROVAL' | 'SERVICE_ACCOUNT'

export type ToolDefinition = {
  id: AgentTool
  name: string
  description: string
  category: 'CRM' | 'COMMS' | 'CONTENT' | 'FINANCE' | 'DELIVERY' | 'KNOWLEDGE' | 'MEMORY' | 'SECURITY' | 'OPS' | 'AGENCY' | 'MEETING' | 'TASK'
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  permission: string
  riskLevel: ToolRiskLevel
  auth: ToolAuth
  /** Requests per minute per agent. */
  rateLimitPerMinute: number
  requiresApproval: boolean
  auditRequired: boolean
  /** True when the tool reads or writes customer data. */
  touchesCustomerData: boolean
  /** True when the tool can be called without a human in the loop. */
  autonomous: boolean
}

const objectSchema = (properties: Record<string, JsonSchema> = {}, required: string[] = []): JsonSchema => ({
  type: 'object',
  required,
  properties,
})

const str = { type: 'string' } as JsonSchema
const num = { type: 'number' } as JsonSchema
const bool = { type: 'boolean' } as JsonSchema
const obj = { type: 'object' } as JsonSchema
const arr = { type: 'array' } as JsonSchema

type ToolSpec = {
  category: ToolDefinition['category']
  description: string
  permission: string
  riskLevel?: ToolRiskLevel
  auth?: ToolAuth
  rateLimitPerMinute?: number
  touchesCustomerData?: boolean
  autonomous?: boolean
  inputs?: Record<string, JsonSchema>
  requiredInputs?: string[]
  outputs?: Record<string, JsonSchema>
  requiredOutputs?: string[]
}

const SPECS: Record<string, ToolSpec> = {
  // --- CRM ---
  'crm.query': { category: 'CRM', description: 'Read a client, project or lead record.', permission: 'crm.read', riskLevel: 'LOW', touchesCustomerData: true, inputs: { entity: str, id: str }, requiredInputs: ['entity'] },
  'crm.createLead': { category: 'CRM', description: 'Create a lead record from a qualified enquiry.', permission: 'crm.create', riskLevel: 'MEDIUM', touchesCustomerData: true, inputs: { name: str, source: str }, requiredInputs: ['name'] },
  'crm.update': { category: 'CRM', description: 'Update fields on an existing client or project.', permission: 'crm.update', riskLevel: 'MEDIUM', touchesCustomerData: true, inputs: { entity: str, id: str, fields: obj }, requiredInputs: ['entity', 'id'] },
  // --- COMMS ---
  'email.send': { category: 'COMMS', description: 'Send an email to a client.', permission: 'comms.email.send', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 10, touchesCustomerData: true, autonomous: false, inputs: { to: str, subject: str, body: str }, requiredInputs: ['to', 'body'] },
  'sms.send': { category: 'COMMS', description: 'Send an SMS to a client.', permission: 'comms.sms.send', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 10, touchesCustomerData: true, autonomous: false, inputs: { to: str, body: str }, requiredInputs: ['to', 'body'] },
  'whatsapp.send': { category: 'COMMS', description: 'Send a WhatsApp message to a client.', permission: 'comms.whatsapp.send', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 10, touchesCustomerData: true, autonomous: false, inputs: { to: str, body: str }, requiredInputs: ['to', 'body'] },
  'whatsapp.status': { category: 'COMMS', description: 'Read the delivery status of a WhatsApp message.', permission: 'comms.whatsapp.read', riskLevel: 'LOW', touchesCustomerData: true, inputs: { messageId: str }, requiredInputs: ['messageId'] },
  'comm.link': { category: 'COMMS', description: 'Create a tracked link for a campaign or message.', permission: 'comms.link.create', riskLevel: 'LOW', inputs: { url: str, label: str }, requiredInputs: ['url'] },
  'social.publish': { category: 'COMMS', description: 'Publish a post to a social channel.', permission: 'comms.social.publish', riskLevel: 'CRITICAL', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 5, autonomous: false, inputs: { channel: str, body: str }, requiredInputs: ['channel', 'body'] },
  'social.receive': { category: 'COMMS', description: 'Read inbound social messages.', permission: 'comms.social.read', riskLevel: 'LOW', touchesCustomerData: true },
  // --- FINANCE ---
  'payment.prepare': { category: 'FINANCE', description: 'Prepare a payment instruction for verification.', permission: 'finance.payment.prepare', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 10, touchesCustomerData: true, autonomous: false, inputs: { clientId: str, amount: num, currency: str }, requiredInputs: ['clientId', 'amount'] },
  'payment.verify': { category: 'FINANCE', description: 'Mark a payment as verified against a bank reference.', permission: 'finance.payment.verify', riskLevel: 'CRITICAL', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 10, touchesCustomerData: true, autonomous: false, inputs: { paymentId: str, reference: str }, requiredInputs: ['paymentId'] },
  'invoice.generate': { category: 'FINANCE', description: 'Generate an invoice for a client.', permission: 'finance.invoice.generate', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 10, touchesCustomerData: true, autonomous: false, inputs: { clientId: str, amount: num }, requiredInputs: ['clientId'] },
  // --- DELIVERY ---
  'project.create': { category: 'DELIVERY', description: 'Create a delivery project.', permission: 'delivery.project.create', riskLevel: 'MEDIUM', touchesCustomerData: true, inputs: { clientId: str, name: str }, requiredInputs: ['name'] },
  'scope.revise': { category: 'DELIVERY', description: 'Revise a scope of work.', permission: 'delivery.scope.revise', riskLevel: 'MEDIUM', touchesCustomerData: true, inputs: { scopeId: str, revision: str }, requiredInputs: ['scopeId'] },
  'handover.prepare': { category: 'DELIVERY', description: 'Assemble a handover package for review.', permission: 'delivery.handover.prepare', riskLevel: 'HIGH', touchesCustomerData: true, inputs: { handoverId: str }, requiredInputs: ['handoverId'] },
  'handover.release': { category: 'DELIVERY', description: 'Release an approved handover package.', permission: 'delivery.handover.release', riskLevel: 'CRITICAL', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 5, touchesCustomerData: true, autonomous: false, inputs: { handoverId: str }, requiredInputs: ['handoverId'] },
  'delivery.confirm': { category: 'DELIVERY', description: 'Confirm a delivery milestone.', permission: 'delivery.confirm', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', touchesCustomerData: true, inputs: { deliveryId: str }, requiredInputs: ['deliveryId'] },
  'delivery.prepare': { category: 'DELIVERY', description: 'Prepare a delivery package for review.', permission: 'delivery.prepare', riskLevel: 'MEDIUM', touchesCustomerData: true, inputs: { projectId: str }, requiredInputs: ['projectId'] },
  // --- KNOWLEDGE ---
  'knowledge.search': { category: 'KNOWLEDGE', description: 'Search the enterprise knowledge system.', permission: 'knowledge.read', riskLevel: 'LOW', inputs: { query: str, limit: num }, requiredInputs: ['query'] },
  'knowledge.index': { category: 'KNOWLEDGE', description: 'Index a document into the knowledge system.', permission: 'knowledge.write', riskLevel: 'MEDIUM', inputs: { documentId: str }, requiredInputs: ['documentId'] },
  // --- MEMORY ---
  'memory.search': { category: 'MEMORY', description: 'Read the relevant memory for a scope.', permission: 'memory.read', riskLevel: 'LOW', inputs: { scope: str, query: str }, requiredInputs: ['query'] },
  'memory.write': { category: 'MEMORY', description: 'Write an approved lesson to the memory system.', permission: 'memory.write', riskLevel: 'MEDIUM', inputs: { scope: str, key: str, content: str }, requiredInputs: ['key', 'content'] },
  // --- SECURITY ---
  'security.scan': { category: 'SECURITY', description: 'Scan a file or payload for threats.', permission: 'security.scan', riskLevel: 'LOW', inputs: { target: str }, requiredInputs: ['target'] },
  'file.scan': { category: 'SECURITY', description: 'Scan an uploaded file before it is stored.', permission: 'files.scan', riskLevel: 'LOW', inputs: { filename: str, bytes: str }, requiredInputs: ['filename'] },
  'file.classify': { category: 'SECURITY', description: 'Classify an uploaded document.', permission: 'files.classify', riskLevel: 'LOW', inputs: { filename: str }, requiredInputs: ['filename'] },
  // --- OPS ---
  'automation.run': { category: 'OPS', description: 'Run an automation workflow.', permission: 'ops.automation.run', riskLevel: 'MEDIUM', inputs: { workflow: str }, requiredInputs: ['workflow'] },
  'automation.retry': { category: 'OPS', description: 'Retry a failed automation, bounded and audited.', permission: 'ops.automation.retry', riskLevel: 'MEDIUM', inputs: { jobId: str }, requiredInputs: ['jobId'] },
  'error.log': { category: 'OPS', description: 'Record an error with its diagnosis.', permission: 'ops.error.log', riskLevel: 'LOW', inputs: { code: str, message: str }, requiredInputs: ['message'] },
  'error.escalate': { category: 'OPS', description: 'Escalate a case to a human with its full history.', permission: 'ops.error.escalate', riskLevel: 'MEDIUM', inputs: { code: str, message: str }, requiredInputs: ['message'] },
  // --- AGENCY ---
  'agent.dispatch': { category: 'AGENCY', description: 'Hand a task to another employee in the workforce.', permission: 'agency.dispatch', riskLevel: 'MEDIUM', inputs: { agentCode: str, task: str }, requiredInputs: ['agentCode', 'task'] },
  'agent.create': { category: 'AGENCY', description: 'Propose a new employee definition for approval.', permission: 'agency.agent.create', riskLevel: 'HIGH', auth: 'HUMAN_APPROVAL', rateLimitPerMinute: 5, autonomous: false, inputs: { code: str, name: str, role: str }, requiredInputs: ['code', 'name'] },
  'approval.queue': { category: 'AGENCY', description: 'Read the pending approval queue.', permission: 'agency.approval.read', riskLevel: 'LOW' },
  'approval.record': { category: 'AGENCY', description: 'Raise an approval request for a sensitive action.', permission: 'agency.approval.record', riskLevel: 'MEDIUM', inputs: { type: str, payload: obj }, requiredInputs: ['type'] },
  // --- MEETING / TASK ---
  'meeting.schedule': { category: 'MEETING', description: 'Schedule a client meeting.', permission: 'meeting.schedule', riskLevel: 'MEDIUM', touchesCustomerData: true, inputs: { clientId: str, when: str }, requiredInputs: ['clientId', 'when'] },
  'task.create': { category: 'TASK', description: 'Create a follow-up task.', permission: 'task.create', riskLevel: 'LOW', touchesCustomerData: true, inputs: { title: str }, requiredInputs: ['title'] },
  'task.update': { category: 'TASK', description: 'Update a task’s status or owner.', permission: 'task.update', riskLevel: 'LOW', touchesCustomerData: true, inputs: { taskId: str }, requiredInputs: ['taskId'] },
  // --- CONTENT / GROWTH ---
  'content.create': { category: 'CONTENT', description: 'Create a content draft for review.', permission: 'content.create', riskLevel: 'LOW', inputs: { title: str, body: str }, requiredInputs: ['title'] },
  'campaign.update': { category: 'CONTENT', description: 'Update a campaign record.', permission: 'campaign.update', riskLevel: 'MEDIUM', inputs: { campaignId: str }, requiredInputs: ['campaignId'] },
  'report.generate': { category: 'CONTENT', description: 'Generate a report from live figures.', permission: 'report.generate', riskLevel: 'LOW', inputs: { kind: str }, requiredInputs: ['kind'] },
  'qa.plan': { category: 'DELIVERY', description: 'Produce a test plan for a delivery.', permission: 'delivery.qa.plan', riskLevel: 'LOW', inputs: { projectId: str }, requiredInputs: ['projectId'] },
  'review.request': { category: 'DELIVERY', description: 'Request a human review of a piece of work.', permission: 'review.request', riskLevel: 'LOW', inputs: { target: str }, requiredInputs: ['target'] },
  'referral.request': { category: 'CRM', description: 'Request a referral from a satisfied client.', permission: 'crm.referral.request', riskLevel: 'LOW', touchesCustomerData: true, inputs: { clientId: str }, requiredInputs: ['clientId'] },
  'image.prompt': { category: 'CONTENT', description: 'Produce an image generation prompt.', permission: 'content.image.prompt', riskLevel: 'LOW', inputs: { scene: str }, requiredInputs: ['scene'] },
  'video.plan': { category: 'CONTENT', description: 'Plan a video production.', permission: 'content.video.plan', riskLevel: 'LOW', inputs: { brief: str }, requiredInputs: ['brief'] },
  'tts.plan': { category: 'CONTENT', description: 'Plan a text-to-speech asset.', permission: 'content.tts.plan', riskLevel: 'LOW', inputs: { script: str }, requiredInputs: ['script'] },
  'evidence.record': { category: 'KNOWLEDGE', description: 'Record evidence against a case.', permission: 'knowledge.evidence.record', riskLevel: 'LOW', inputs: { ref: str }, requiredInputs: ['ref'] },
}

/**
 * `capability:all` is a CAPABILITY MARKER, not a tool. It appears in
 * `AGENT_TOOLS` because the policy module lists every capability the
 * platform recognises, but it is never invoked. It is excluded from
 * the registry, and `validateToolRegistry()` proves that every other
 * entry has full metadata.
 */
export const CAPABILITY_MARKER = 'capability:all'

/** The tool names the registry describes — every real tool, no markers. */
export const REGISTRY_TOOL_IDS: readonly AgentTool[] = AGENT_TOOLS.filter(
  (id): id is AgentTool => id !== CAPABILITY_MARKER,
)

/** The registry: every tool in `AGENT_TOOLS` with its full metadata. */
export const TOOL_REGISTRY: ToolDefinition[] = REGISTRY_TOOL_IDS.map((id) => {
  const spec = SPECS[id]
  const privileged = (PRIVILEGED_AGENT_TOOLS as readonly string[]).includes(id)
  return {
    id,
    name: id,
    description: spec?.description ?? 'Undocumented tool — it is registered but has no metadata.',
    category: spec?.category ?? 'OPS',
    inputSchema: objectSchema(spec?.inputs ?? {}, spec?.requiredInputs ?? []),
    outputSchema: objectSchema(spec?.outputs ?? { ok: bool }, ['ok']),
    permission: spec?.permission ?? `tool.${id}`,
    riskLevel: spec?.riskLevel ?? (privileged ? 'HIGH' : 'LOW'),
    auth: spec?.auth ?? (privileged ? 'HUMAN_APPROVAL' : 'AGENT_GRANT'),
    rateLimitPerMinute: spec?.rateLimitPerMinute ?? 60,
    requiresApproval: privileged || spec?.auth === 'HUMAN_APPROVAL',
    auditRequired: true,
    touchesCustomerData: spec?.touchesCustomerData ?? false,
    autonomous: spec?.autonomous ?? !privileged,
  }
})

const BY_ID = new Map(TOOL_REGISTRY.map((tool) => [tool.id, tool]))

export function getTool(id: string): ToolDefinition | undefined {
  return BY_ID.get(id as AgentTool)
}

/**
 * Check whether an agent may call a tool.
 *
 * The privilege rule already exists in `ai-workforce-policy.ts`. This
 * adds the registry's own constraints: a tool that is not autonomous
 * requires an approval, and a tool that touches customer data requires
 * a matching grant.
 */
export function checkToolUse(
  toolId: string,
  grantedPermissions: string[],
): { allowed: boolean; code?: 'UNKNOWN_TOOL' | 'TOOL_NOT_GRANTED' | 'APPROVAL_REQUIRED'; tool?: ToolDefinition } {
  const tool = getTool(toolId)
  if (!tool) return { allowed: false, code: 'UNKNOWN_TOOL' }
  if (!grantedPermissions.includes(tool.permission)) {
    return { allowed: false, code: 'TOOL_NOT_GRANTED', tool }
  }
  if (tool.requiresApproval && !tool.autonomous) {
    return { allowed: false, code: 'APPROVAL_REQUIRED', tool }
  }
  return { allowed: true, tool }
}

/** The tools an agent may call autonomously, filtered by its grants. */
export function availableTools(grantedPermissions: string[]): ToolDefinition[] {
  return TOOL_REGISTRY.filter((tool) => {
    if (!grantedPermissions.includes(tool.permission)) return false
    if (tool.requiresApproval && !tool.autonomous) return false
    return true
  })
}

export type ToolRegistryIssue = { code: string; message: string; toolId: string }

/** Prove the registry and the policy module agree. */
export function validateToolRegistry(): { valid: boolean; issues: ToolRegistryIssue[] } {
  const issues: ToolRegistryIssue[] = []
  for (const tool of TOOL_REGISTRY) {
    if (!tool.description || tool.description.startsWith('Undocumented tool')) {
      issues.push({ code: 'NO_DESCRIPTION', message: `tool "${tool.id}" has no documented description`, toolId: tool.id })
    }
    if (!tool.permission) {
      issues.push({ code: 'NO_PERMISSION', message: `tool "${tool.id}" has no permission`, toolId: tool.id })
    }
    if (tool.riskLevel === 'CRITICAL' && !tool.requiresApproval) {
      issues.push({ code: 'CRITICAL_WITHOUT_APPROVAL', message: `tool "${tool.id}" is CRITICAL but does not require approval`, toolId: tool.id })
    }
    if (tool.touchesCustomerData && !tool.auditRequired) {
      issues.push({ code: 'CUSTOMER_DATA_WITHOUT_AUDIT', message: `tool "${tool.id}" touches customer data but does not require an audit`, toolId: tool.id })
    }
    if (tool.rateLimitPerMinute <= 0) {
      issues.push({ code: 'NO_RATE_LIMIT', message: `tool "${tool.id}" has no rate limit`, toolId: tool.id })
    }
  }
  const privilegedWithoutMetadata = (PRIVILEGED_AGENT_TOOLS as readonly string[]).filter((id) => {
    const tool = getTool(id)
    return !tool || tool.riskLevel === 'LOW'
  })
  for (const id of privilegedWithoutMetadata) {
    issues.push({ code: 'PRIVILEGED_RISK_TOO_LOW', message: `privileged tool "${id}" is not marked as risky`, toolId: id })
  }
  return { valid: issues.length === 0, issues }
}
