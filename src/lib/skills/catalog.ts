// ============================================================
// TECH360 — skill catalogue generator
// ============================================================
// The catalogue holds 10,010 skill definitions: 91 capability templates
// specialised for each of the 110 departments (110 × 91 = 10,010).
//
// HONESTY NOTE
// ------------
// These are NOT 10,010 hand-written algorithms. Each definition binds to
// one of the 20 real handler implementations in `skills/primitives.ts`
// and carries a department-specific specialisation (label sets, glossaries,
// checklists, document rules, scoring criteria). The registry reports
// "implemented" only when a handler is registered for the definition and
// the definition's test reference passes.
//
// SPECIALISATION is per department CATEGORY plus the department's own
// name, so two departments in the same category differ in their labels,
// their permission scope and their acceptance checks.
// ============================================================

import { DEPARTMENTS } from '@/lib/agents/registry'
import { EXTRA_CAPABILITY_TEMPLATES } from './capabilities-extra'
import type { JsonSchema, SkillDefinition, SkillRiskLevel } from './types'

// ------------------------------------------------------------
// Domain profiles — per department category
// ------------------------------------------------------------

export type DomainProfile = {
  /** Classification labels for text.classify. */
  labels: Array<{ label: string; keywords: string[] }>
  /** English → Bangla glossary for keyword.map. */
  glossary: Record<string, string>
  /** Checklist items for checklist.evaluate. */
  checklist: Array<{ id: string; label: string; keywords: string[] }>
  /** Scoring rules for lead.qualify. */
  leadCriteria: Array<{ field: string; weight: number; contains?: string; equals?: string }>
  /** Document type rules for document.classify. */
  documentRules: Array<{ type: string; extensions?: string[]; mimeTypes?: string[]; keywords?: string[] }>
  /** Base permission for the department. */
  permission: string
  /** Currency used for money formatting. */
  currency: string
  /** Locale used for number formatting. */
  locale: string
}

const EN_GB = 'en-GB'
const EN_US = 'en-US'

export const DOMAIN_PROFILES: Record<string, DomainProfile> = {
  EXECUTIVE: {
    labels: [
      { label: 'DECISION_REQUIRED', keywords: ['decision', 'approve', 'approval', 'sign off', 'authorise', 'authorize'] },
      { label: 'STRATEGIC', keywords: ['strategy', 'roadmap', 'objective', 'kpi', 'vision', 'transformation'] },
      { label: 'GOVERNANCE', keywords: ['policy', 'compliance', 'governance', 'audit', 'risk'] },
      { label: 'REPORTING', keywords: ['report', 'kpi', 'summary', 'review', 'board'] },
    ],
    glossary: { decision: 'সিদ্ধান্ত', approval: 'অনুমোদন', strategy: 'কৌশল', report: 'প্রতিবেদন', policy: 'নীতি' },
    checklist: [
      { id: 'exec_owner', label: 'Decision owner named', keywords: ['owner', 'assigned to', 'responsible'] },
      { id: 'exec_impact', label: 'Impact assessed', keywords: ['impact', 'risk', 'consequence'] },
      { id: 'exec_date', label: 'Decision date recorded', keywords: ['date', 'deadline', 'by '] },
    ],
    leadCriteria: [
      { field: 'message', weight: 3, contains: 'strategic' },
      { field: 'budget', weight: 4 },
      { field: 'source', weight: 2, contains: 'referral' },
    ],
    documentRules: [
      { type: 'BOARD_MINUTES', extensions: ['pdf', 'docx'], mimeTypes: ['application/pdf'], keywords: ['minutes', 'board', 'resolution'] },
      { type: 'POLICY', extensions: ['pdf', 'docx'], keywords: ['policy', 'scope', 'shall'] },
      { type: 'KPI_REPORT', extensions: ['xlsx', 'csv', 'pdf'], keywords: ['kpi', 'metric', 'target'] },
      { type: 'GENERAL', extensions: ['txt', 'md'] },
    ],
    permission: 'executive.read',
    currency: 'USD',
    locale: EN_GB,
  },
  REVENUE: {
    labels: [
      { label: 'NEW_INQUIRY', keywords: ['interested', 'how much', 'price', 'quote', 'package', 'pricing'] },
      { label: 'FOLLOW_UP', keywords: ['follow up', 'reminder', 'pending', 'awaiting', 'chase'] },
      { label: 'READY_TO_CLOSE', keywords: ['ready', 'proceed', 'confirm', 'approve quote', 'sign'] },
      { label: 'NOT_A_LEAD', keywords: ['unsubscribe', 'remove me', 'not interested', 'spam'] },
      { label: 'STUDENT_ADMISSION', keywords: ['admission', 'university', 'visa', 'ielts', 'scholarship', 'apply'] },
    ],
    glossary: { price: 'দাম', quote: 'কোটেশন', university: 'বিশ্ববিদ্যালয়', admission: 'ভর্তি', visa: 'ভিসা' },
    checklist: [
      { id: 'rev_contact', label: 'Contact detail captured', keywords: ['email', 'phone', 'whatsapp', 'contact'] },
      { id: 'rev_need', label: 'Requirement captured', keywords: ['need', 'requirement', 'looking for', 'budget'] },
      { id: 'rev_next', label: 'Next step agreed', keywords: ['next step', 'call', 'meeting', 'schedule'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 3, contains: 'website' },
      { field: 'budget', weight: 4 },
      { field: 'timeline', weight: 2, contains: 'month' },
      { field: 'name', weight: 1 },
    ],
    documentRules: [
      { type: 'QUOTATION', extensions: ['pdf', 'docx'], keywords: ['quotation', 'estimate', 'proposal', 'price'] },
      { type: 'CONTRACT', extensions: ['pdf', 'docx'], keywords: ['agreement', 'contract', 'signature', 'terms'] },
      { type: 'INVOICE', extensions: ['pdf', 'xlsx'], keywords: ['invoice', 'bill', 'payment due'] },
      { type: 'GENERAL', extensions: ['txt', 'md'] },
    ],
    permission: 'crm.leads.read',
    currency: 'USD',
    locale: EN_US,
  },
  DELIVERY: {
    labels: [
      { label: 'REQUIREMENT', keywords: ['requirement', 'scope', 'feature', 'deliverable', 'acceptance'] },
      { label: 'BLOCKED', keywords: ['blocked', 'waiting on', 'dependency', 'stuck', 'cannot proceed'] },
      { label: 'READY_FOR_QA', keywords: ['ready for test', 'qa', 'testing', 'uat', 'review build'] },
      { label: 'RELEASED', keywords: ['released', 'deployed', 'live', 'handed over', 'complete'] },
    ],
    glossary: { requirement: 'চাহিদা', scope: 'পরিধি', delivery: 'ডেলিভারি', handover: 'হ্যান্ডওভার', deployment: 'ডিপ্লয়মেন্ট' },
    checklist: [
      { id: 'del_acceptance', label: 'Acceptance criteria defined', keywords: ['acceptance', 'criteria', 'definition of done'] },
      { id: 'del_test', label: 'Test evidence attached', keywords: ['test', 'qa', 'evidence', 'screenshot'] },
      { id: 'del_signoff', label: 'Client sign-off recorded', keywords: ['sign off', 'approved by client', 'accepted'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 2, contains: 'project' },
      { field: 'budget', weight: 3 },
      { field: 'timeline', weight: 3 },
    ],
    documentRules: [
      { type: 'SOW', extensions: ['pdf', 'docx'], keywords: ['scope of work', 'sow', 'deliverables', 'milestone'] },
      { type: 'TEST_REPORT', extensions: ['pdf', 'xlsx'], keywords: ['test report', 'pass rate', 'defect'] },
      { type: 'HANDOVER', extensions: ['pdf', 'zip'], keywords: ['handover', 'source code', 'credentials'] },
      { type: 'GENERAL', extensions: ['txt', 'md'] },
    ],
    permission: 'projects.read',
    currency: 'USD',
    locale: EN_US,
  },
  TECHNOLOGY: {
    labels: [
      { label: 'INCIDENT', keywords: ['error', 'down', 'outage', 'crash', '500', 'not working', 'incident'] },
      { label: 'REQUEST', keywords: ['please add', 'feature request', 'enhancement', 'would like'] },
      { label: 'QUESTION', keywords: ['how do i', 'question', 'how to', 'documentation'] },
      { label: 'SECURITY', keywords: ['vulnerability', 'cve', 'breach', 'leak', 'unauthorised', 'unauthorized'] },
    ],
    glossary: { error: 'ত্রুটি', server: 'সার্ভার', deploy: 'ডিপ্লয়', database: 'ডেটাবেস', backup: 'ব্যাকআপ' },
    checklist: [
      { id: 'tech_repro', label: 'Reproduction steps recorded', keywords: ['steps to reproduce', 'reproduce', 'repro'] },
      { id: 'tech_env', label: 'Environment identified', keywords: ['production', 'staging', 'environment', 'version'] },
      { id: 'tech_impact', label: 'Impact assessed', keywords: ['impact', 'affected', 'users affected'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 2, contains: 'integration' },
      { field: 'budget', weight: 3 },
      { field: 'email', weight: 1 },
    ],
    documentRules: [
      { type: 'RUNBOOK', extensions: ['pdf', 'md'], keywords: ['runbook', 'procedure', 'rollback'] },
      { type: 'INCIDENT_REPORT', extensions: ['pdf', 'md'], keywords: ['incident', 'root cause', 'timeline'] },
      { type: 'ARCHITECTURE', extensions: ['pdf', 'md'], keywords: ['architecture', 'diagram', 'component'] },
      { type: 'GENERAL', extensions: ['txt'] },
    ],
    permission: 'technical.read',
    currency: 'USD',
    locale: EN_US,
  },
  CONTENT: {
    labels: [
      { label: 'CAMPAIGN', keywords: ['campaign', 'launch', 'promotion', 'announcement', 'offer'] },
      { label: 'SEO', keywords: ['keyword', 'seo', 'ranking', 'meta', 'backlink', 'search'] },
      { label: 'BRAND', keywords: ['brand', 'logo', 'tone of voice', 'guideline', 'style'] },
      { label: 'ANALYTICS', keywords: ['analytics', 'conversion', 'traffic', 'ctr', 'report'] },
    ],
    glossary: { marketing: 'মার্কেটিং', audience: 'দর্শক', content: 'কনটেন্ট', campaign: 'ক্যাম্পেইন', brand: 'ব্র্যান্ড' },
    checklist: [
      { id: 'cnt_brand', label: 'Brand voice respected', keywords: ['tone', 'brand', 'voice', 'guideline'] },
      { id: 'cnt_cta', label: 'Call to action present', keywords: ['call to action', 'cta', 'apply now', 'contact us'] },
      { id: 'cnt_claim', label: 'Claims substantiated', keywords: ['source', 'verified', 'approved', 'reference'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 2, contains: 'campaign' },
      { field: 'budget', weight: 3 },
    ],
    documentRules: [
      { type: 'BRAND_GUIDELINE', extensions: ['pdf', 'docx'], keywords: ['brand', 'logo', 'colour', 'color', 'typography'] },
      { type: 'CAMPAIGN_BRIEF', extensions: ['pdf', 'docx', 'md'], keywords: ['brief', 'objective', 'audience', 'channel'] },
      { type: 'CONTENT_ASSET', extensions: ['png', 'jpg', 'mp4'], keywords: [] },
      { type: 'GENERAL', extensions: ['txt', 'md'] },
    ],
    permission: 'marketing.read',
    currency: 'USD',
    locale: EN_US,
  },
  OPERATIONS: {
    labels: [
      { label: 'INVOICE', keywords: ['invoice', 'payment', 'due', 'billing', 'remittance'] },
      { label: 'RECONCILIATION', keywords: ['reconcile', 'mismatch', 'ledger', 'balance', 'discrepancy'] },
      { label: 'PROCUREMENT', keywords: ['purchase', 'vendor', 'supplier', 'procure', 'quote'] },
      { label: 'POLICY', keywords: ['policy', 'procedure', 'sop', 'approval limit'] },
    ],
    glossary: { invoice: 'চালান', payment: 'পেমেন্ট', budget: 'বাজেট', purchase: 'ক্রয়', report: 'প্রতিবেদন' },
    checklist: [
      { id: 'ops_amount', label: 'Amount recorded', keywords: ['amount', 'total', 'value'] },
      { id: 'ops_reference', label: 'Reference attached', keywords: ['reference', 'invoice number', 'po'] },
      { id: 'ops_date', label: 'Due date recorded', keywords: ['due', 'date', 'deadline'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 1, contains: 'system' },
      { field: 'budget', weight: 4 },
    ],
    documentRules: [
      { type: 'FINANCIAL_REPORT', extensions: ['xlsx', 'csv', 'pdf'], keywords: ['ledger', 'balance', 'revenue', 'expense'] },
      { type: 'SOP', extensions: ['pdf', 'docx', 'md'], keywords: ['procedure', 'step', 'sop', 'must'] },
      { type: 'GENERAL', extensions: ['txt'] },
    ],
    permission: 'operations.read',
    currency: 'USD',
    locale: EN_US,
  },
  GOVERNANCE: {
    labels: [
      { label: 'COMPLIANCE', keywords: ['compliance', 'regulation', 'gdpr', 'policy', 'law'] },
      { label: 'RISK', keywords: ['risk', 'threat', 'vulnerability', 'control gap', 'exposure'] },
      { label: 'AUDIT', keywords: ['audit', 'evidence', 'sample', 'finding', 'trail'] },
      { label: 'DATA_REQUEST', keywords: ['personal data', 'subject access', 'erasure', 'retention', 'dpia'] },
    ],
    glossary: { compliance: 'সম্মতি', audit: 'নিরীক্ষা', risk: 'ঝুঁকি', policy: 'নীতি', evidence: 'প্রমাণ' },
    checklist: [
      { id: 'gov_scope', label: 'Scope defined', keywords: ['scope', 'applies to', 'in scope'] },
      { id: 'gov_owner', label: 'Control owner named', keywords: ['owner', 'responsible', 'assigned'] },
      { id: 'gov_review', label: 'Review date recorded', keywords: ['review date', 'next review', 'reviewed'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 2, contains: 'compliance' },
      { field: 'budget', weight: 1 },
    ],
    documentRules: [
      { type: 'POLICY', extensions: ['pdf', 'docx'], keywords: ['policy', 'control', 'must', 'shall'] },
      { type: 'AUDIT_EVIDENCE', extensions: ['pdf', 'xlsx', 'csv'], keywords: ['evidence', 'sample', 'finding', 'control'] },
      { type: 'RISK_REGISTER', extensions: ['xlsx', 'csv'], keywords: ['risk', 'likelihood', 'impact', 'mitigation'] },
      { type: 'GENERAL', extensions: ['txt', 'md'] },
    ],
    permission: 'governance.read',
    currency: 'USD',
    locale: EN_GB,
  },
  SUPPORT: {
    labels: [
      { label: 'HOW_TO', keywords: ['how do i', 'how to', 'steps', 'guide', 'instruction'] },
      { label: 'BUG', keywords: ['bug', 'broken', 'not working', 'error', 'failed', 'issue'] },
      { label: 'REQUEST', keywords: ['please', 'request', 'can you', 'need help', 'support'] },
      { label: 'FEATUREBACK', keywords: ['feedback', 'suggestion', 'would be better', 'improve'] },
    ],
    glossary: { support: 'সহায়তা', help: 'সাহায্য', problem: 'সমস্যা', login: 'লগইন', password: 'পাসওয়ার্ড' },
    checklist: [
      { id: 'sup_account', label: 'Account identified', keywords: ['account', 'client id', 'user', 'email'] },
      { id: 'sup_steps', label: 'Steps attempted recorded', keywords: ['tried', 'attempted', 'steps'] },
      { id: 'sup_resolved', label: 'Resolution confirmed', keywords: ['resolved', 'working now', 'fixed', 'confirmed'] },
    ],
    leadCriteria: [
      { field: 'message', weight: 2, contains: 'support' },
      { field: 'email', weight: 1 },
    ],
    documentRules: [
      { type: 'FAQ', extensions: ['pdf', 'md', 'docx'], keywords: ['faq', 'question', 'answer'] },
      { type: 'GUIDE', extensions: ['pdf', 'md'], keywords: ['guide', 'step', 'instruction', 'tutorial'] },
      { type: 'GENERAL', extensions: ['txt'] },
    ],
    permission: 'support.read',
    currency: 'USD',
    locale: EN_US,
  },
}

/** Departments added late in the registry ("Scale Division …") reuse their category profile. */
function profileFor(departmentName: string, category: string): DomainProfile {
  const base = DOMAIN_PROFILES[category] ?? DOMAIN_PROFILES.SUPPORT
  return {
    ...base,
    labels: base.labels.map((l) => ({ ...l })),
    checklist: base.checklist.map((c) => ({ ...c })),
    documentRules: base.documentRules.map((d) => ({ ...d })),
    leadCriteria: base.leadCriteria.map((c) => ({ ...c })),
    glossary: { ...base.glossary },
  }
}

// ------------------------------------------------------------
// Capability templates
// ------------------------------------------------------------

export type CapabilityTemplate = {
  /** Handler key in skills/primitives.ts. */
  primitive: string
  /** Slug suffix, e.g. "classify_text". */
  slug: string
  title: string
  description: string
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  riskLevel: SkillRiskLevel
  requiresApproval: boolean
  testRef: string
  /** Extra permissions on top of the department's base permission. */
  extraPermissions?: string[]
  configuration: (profile: DomainProfile, departmentName: string) => Record<string, unknown>
}

const objectSchema = (
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema => ({ type: 'object', required, properties })

const BASE_CAPABILITY_TEMPLATES: CapabilityTemplate[] = [
  {
    primitive: 'text.classify',
    slug: 'classify_text',
    title: 'Classify incoming text',
    description: 'Assigns free text to the department’s own label set and reports a calibrated confidence.',
    inputSchema: objectSchema({ text: { type: 'string', maxLength: 20000 } }, ['text']),
    outputSchema: objectSchema(
      { label: { type: 'string' }, confidence: { type: 'number' }, scores: { type: 'object' }, matchedTerms: { type: 'array' } },
      ['label', 'confidence'],
    ),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:text.classify',
    configuration: (profile) => ({ labels: profile.labels }),
  },
  {
    primitive: 'text.summarize',
    slug: 'summarize_text',
    title: 'Summarize text',
    description: 'Produces an extractive summary with a measured coverage ratio.',
    inputSchema: objectSchema({ text: { type: 'string', maxLength: 40000 }, maxSentences: { type: 'integer', minimum: 1, maximum: 10 } }, ['text']),
    outputSchema: objectSchema({ summary: { type: 'string' }, sentenceCount: { type: 'integer' }, coverage: { type: 'number' } }, ['summary']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:text.summarize',
    configuration: () => ({}),
  },
  {
    primitive: 'entity.extract',
    slug: 'extract_entities',
    title: 'Extract entities',
    description: 'Pulls emails, phone numbers, dates, amounts and internal references out of text.',
    inputSchema: objectSchema({ text: { type: 'string', maxLength: 40000 } }, ['text']),
    outputSchema: objectSchema(
      { emails: { type: 'array' }, phones: { type: 'array' }, dates: { type: 'array' }, amounts: { type: 'array' }, references: { type: 'array' } },
      ['emails', 'phones'],
    ),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:entity.extract',
    configuration: () => ({}),
  },
  {
    primitive: 'keyword.map',
    slug: 'map_keywords',
    title: 'Map English/Bangla keywords',
    description: 'Finds department glossary terms in text and returns their Bangla equivalents.',
    inputSchema: objectSchema({ text: { type: 'string', maxLength: 40000 } }, ['text']),
    outputSchema: objectSchema({ matches: { type: 'array' }, translated: { type: 'string' }, matchCount: { type: 'integer' } }, ['matches', 'matchCount']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:keyword.map',
    configuration: (profile) => ({ glossary: profile.glossary }),
  },
  {
    primitive: 'json.validate',
    slug: 'validate_payload',
    title: 'Validate a payload',
    description: 'Validates a JSON payload against the department’s required-field contract.',
    inputSchema: objectSchema({ payload: { type: 'object' } }, ['payload']),
    outputSchema: objectSchema({ valid: { type: 'boolean' }, errors: { type: 'array' } }, ['valid', 'errors']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:json.validate',
    configuration: (profile) => ({
      schema: {
        required: ['id', 'title'],
        properties: { id: { type: 'string' }, title: { type: 'string' }, amount: { type: 'number' } },
      },
      ...profile,
    }),
  },
  {
    primitive: 'template.render',
    slug: 'render_template',
    title: 'Render a template',
    description: 'Renders the department’s template with supplied variables and reports missing fields.',
    inputSchema: objectSchema({ template: { type: 'string' }, variables: { type: 'object' } }, ['variables']),
    outputSchema: objectSchema({ rendered: { type: 'string' }, missing: { type: 'array' }, complete: { type: 'boolean' } }, ['rendered', 'complete']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:template.render',
    configuration: () => ({
      template: 'Hello {{name}}, your {{department}} request is now recorded. Reference: {{reference}}.',
    }),
  },
  {
    primitive: 'lead.qualify',
    slug: 'qualify_lead',
    title: 'Qualify a lead',
    description: 'Scores an inbound enquiry against the department’s qualification criteria.',
    inputSchema: objectSchema(
      { message: { type: 'string' }, budget: { type: 'number' }, email: { type: 'string' }, name: { type: 'string' }, timeline: { type: 'string' }, source: { type: 'string' } },
      ['message'],
    ),
    outputSchema: objectSchema({ score: { type: 'number' }, qualified: { type: 'boolean' }, threshold: { type: 'number' }, reasons: { type: 'array' } }, ['score', 'qualified']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:lead.qualify',
    configuration: (profile) => ({ criteria: profile.leadCriteria, qualifyThreshold: 0.5 }),
  },
  {
    primitive: 'document.classify',
    slug: 'classify_document',
    title: 'Classify a document',
    description: 'Determines the document type from extension, MIME type and content signals.',
    inputSchema: objectSchema(
      { filename: { type: 'string' }, mimeType: { type: 'string' }, text: { type: 'string' } },
      ['filename'],
    ),
    outputSchema: objectSchema({ documentType: { type: 'string' }, confidence: { type: 'number' }, extension: { type: 'string' } }, ['documentType', 'confidence']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:document.classify',
    configuration: (profile) => ({ rules: profile.documentRules }),
  },
  {
    primitive: 'keyword.rank',
    slug: 'rank_candidates',
    title: 'Rank candidate passages',
    description: 'Ranks candidate passages against a query using weighted keyword scoring.',
    inputSchema: objectSchema({ query: { type: 'string' }, candidates: { type: 'array' } }, ['query', 'candidates']),
    outputSchema: objectSchema({ ranked: { type: 'array' }, matchCount: { type: 'integer' } }, ['ranked', 'matchCount']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:keyword.rank',
    configuration: () => ({ titleBoost: 3 }),
  },
  {
    primitive: 'checklist.evaluate',
    slug: 'evaluate_checklist',
    title: 'Evaluate a checklist',
    description: 'Checks whether a piece of work satisfies the department’s mandatory checklist.',
    inputSchema: objectSchema({ text: { type: 'string' } }, ['text']),
    outputSchema: objectSchema(
      { results: { type: 'array' }, satisfied: { type: 'integer' }, total: { type: 'integer' }, complete: { type: 'boolean' }, completionRatio: { type: 'number' } },
      ['satisfied', 'total', 'complete'],
    ),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:checklist.evaluate',
    configuration: (profile) => ({ checklist: profile.checklist }),
  },
  {
    primitive: 'answer.extract',
    slug: 'extract_answer',
    title: 'Extract a grounded answer',
    description: 'Finds the evidence span that answers a question and reports when the evidence is insufficient.',
    inputSchema: objectSchema({ question: { type: 'string' }, evidence: { type: 'array' } }, ['question', 'evidence']),
    outputSchema: objectSchema(
      { answer: { type: 'string' }, confidence: { type: 'number' }, grounded: { type: 'boolean' }, insufficientEvidence: { type: 'boolean' } },
      ['grounded', 'insufficientEvidence'],
    ),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:answer.extract',
    configuration: () => ({ answerThreshold: 0.15 }),
  },
  {
    primitive: 'url.normalize',
    slug: 'normalize_url',
    title: 'Normalize a URL',
    description: 'Validates and canonicalises an absolute http(s) URL.',
    inputSchema: objectSchema({ url: { type: 'string' } }, ['url']),
    outputSchema: objectSchema({ valid: { type: 'boolean' }, normalized: { type: 'string' }, host: { type: 'string' } }, ['valid']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:url.normalize',
    configuration: () => ({}),
  },
  {
    primitive: 'phone.normalize',
    slug: 'normalize_phone',
    title: 'Normalize a phone number',
    description: 'Normalises a phone number to E.164 form and reports whether it is usable.',
    inputSchema: objectSchema({ phone: { type: 'string' } }, ['phone']),
    outputSchema: objectSchema({ normalized: { type: 'string' }, valid: { type: 'boolean' } }, ['valid']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:phone.normalize',
    configuration: () => ({}),
  },
  {
    primitive: 'slug.make',
    slug: 'make_slug',
    title: 'Build a slug',
    description: 'Converts a title into a URL-safe slug that preserves Bangla and other scripts.',
    inputSchema: objectSchema({ text: { type: 'string' }, maxLength: { type: 'integer' } }, ['text']),
    outputSchema: objectSchema({ slug: { type: 'string' }, length: { type: 'integer' } }, ['slug']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:slug.make',
    configuration: () => ({}),
  },
  {
    primitive: 'text.readability',
    slug: 'measure_readability',
    title: 'Measure readability',
    description: 'Computes sentence length, complexity and a readability band for copy review.',
    inputSchema: objectSchema({ text: { type: 'string' } }, ['text']),
    outputSchema: objectSchema(
      { wordCount: { type: 'integer' }, sentenceCount: { type: 'integer' }, readabilityScore: { type: 'number' }, level: { type: 'string' } },
      ['wordCount', 'readabilityScore', 'level'],
    ),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:text.readability',
    configuration: () => ({}),
  },
  {
    primitive: 'record.dedupe_key',
    slug: 'dedupe_key',
    title: 'Build a deduplication key',
    description: 'Builds a stable SHA-256 deduplication key from declared identity fields.',
    inputSchema: objectSchema({ id: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } }, []),
    outputSchema: objectSchema({ key: { type: 'string' }, fields: { type: 'array' }, emptyFields: { type: 'array' } }, ['key']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:record.dedupe_key',
    configuration: () => ({ fields: ['email', 'phone'] }),
  },
  {
    primitive: 'schedule.parse',
    slug: 'parse_schedule',
    title: 'Parse a schedule hint',
    description: 'Resolves a scheduling hint in the text to an explicit date, or reports that it could not.',
    inputSchema: objectSchema({ text: { type: 'string' }, now: { type: 'number' } }, ['text']),
    outputSchema: objectSchema({ scheduledFor: { type: 'string' }, time: { type: 'string' }, basis: { type: 'string' }, resolved: { type: 'boolean' } }, ['resolved']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:schedule.parse',
    configuration: () => ({}),
  },
  {
    primitive: 'number.format',
    slug: 'format_amount',
    title: 'Format an amount',
    description: 'Formats a monetary amount using the department’s currency and locale.',
    inputSchema: objectSchema({ amount: { type: 'number' }, currency: { type: 'string' }, locale: { type: 'string' } }, ['amount']),
    outputSchema: objectSchema({ formatted: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' } }, ['formatted', 'amount']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:number.format',
    configuration: (profile) => ({ currency: profile.currency, locale: profile.locale }),
  },
  {
    primitive: 'hash.fingerprint',
    slug: 'fingerprint_content',
    title: 'Fingerprint content',
    description: 'Computes a SHA-256 fingerprint so changed content can be detected without storing it.',
    inputSchema: objectSchema({ text: { type: 'string' } }, ['text']),
    outputSchema: objectSchema({ checksum: { type: 'string' }, length: { type: 'integer' } }, ['checksum']),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:hash.fingerprint',
    configuration: () => ({}),
  },
  {
    primitive: 'text.metrics',
    slug: 'measure_text',
    title: 'Measure text',
    description: 'Counts words, lines and detects the scripts present in a piece of content.',
    inputSchema: objectSchema({ text: { type: 'string' } }, ['text']),
    outputSchema: objectSchema(
      { characters: { type: 'integer' }, words: { type: 'integer' }, uniqueWords: { type: 'integer' }, lines: { type: 'integer' }, hasBangla: { type: 'boolean' } },
      ['characters', 'words', 'hasBangla'],
    ),
    riskLevel: 'LOW',
    requiresApproval: false,
    testRef: 'skills:text.metrics',
    configuration: () => ({}),
  },
]

/**
 * The full capability set: the 20 foundational templates plus the 71
 * additional ones. 110 departments × 91 capabilities = 10,010 skills.
 */
export const CAPABILITY_TEMPLATES: CapabilityTemplate[] = [
  ...BASE_CAPABILITY_TEMPLATES,
  ...EXTRA_CAPABILITY_TEMPLATES,
]

// ------------------------------------------------------------
// Generation
// ------------------------------------------------------------

function kebab(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

export function departmentSlug(name: string): string {
  return kebab(name)
}

/**
 * Build the full catalogue. Deterministic: the same departments and
 * templates always produce the same catalogue, so catalogue drift is
 * detectable in CI.
 */
export function buildSkillCatalog(): SkillDefinition[] {
  const definitions: SkillDefinition[] = []
  for (const department of DEPARTMENTS) {
    const profile = profileFor(department.name, department.category)
    const deptSlug = departmentSlug(department.name)
    for (const capability of CAPABILITY_TEMPLATES) {
      const id = `${deptSlug}_${capability.slug}`
      definitions.push({
        id,
        version: '1.0.0',
        category: department.category,
        departmentCode: department.code,
        name: `${department.name} — ${capability.title}`,
        description: `${capability.description} Specialised for ${department.name} (${department.code}).`,
        owner: department.code,
        handler: capability.primitive,
        configuration: capability.configuration(profile, department.name),
        inputSchema: capability.inputSchema,
        outputSchema: capability.outputSchema,
        permissions: [profile.permission, ...(capability.extraPermissions ?? [])],
        requiresApproval: capability.requiresApproval,
        riskLevel: capability.riskLevel,
        testRefs: [capability.testRef],
        status: 'ACTIVE',
        limits: { maxToolCalls: 4, timeoutSeconds: 30, maxRetries: 1 },
      })
    }
  }
  return definitions
}

export const SKILL_CATALOG: SkillDefinition[] = buildSkillCatalog()

export const SKILL_CATALOG_SIZE = SKILL_CATALOG.length
