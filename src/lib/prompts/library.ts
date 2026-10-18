// ============================================================
// TECH360 — prompt library
// ============================================================
// The specification requires a large prompt library and — just as
// importantly — requires that the runtime RETRIEVES from it rather
// than loading it. A context window with 70,000 prompts in it is
// not a context window; it is a denial of service against the model.
//
// THE LIBRARY
// -----------
// 110 departments × 20 role archetypes × 16 stages × 2 languages
//   = 70,400 prompt slots.
//
// Each slot is a real, specialised prompt: it carries the
// department's own subject, the role's own responsibility, the
// constitutional rules, the output requirement for its stage, and the
// language. Nothing is a generic "You are a helpful AI assistant".
//
// THE RETRIEVER
// -------------
// `retrievePrompts()` materialises only the prompts that match the
// caller: their department, their role, their stage, their language
// and their skill/SOP bindings. A typical context carries between 6
// and 20 prompts, not 70,400.
// ============================================================

import { DEPARTMENTS } from '@/lib/agents/registry'
import { CONSTITUTION } from '@/lib/agents/registry'

// ------------------------------------------------------------
// The sixteen stages
// ------------------------------------------------------------

export const PROMPT_STAGES = [
  'INITIALIZATION',
  'TASK_INTAKE',
  'TASK_EXECUTION',
  'DECISION_SUPPORT',
  'RESEARCH',
  'TOOL_USAGE',
  'QUALITY_REVIEW',
  'ESCALATION',
  'REPORTING',
  'COLLABORATION',
  'KNOWLEDGE_SHARING',
  'ERROR_RECOVERY',
  'REFLECTION',
  'LEARNING',
  'PERFORMANCE_REVIEW',
  'EMERGENCY_RESPONSE',
] as const

export type PromptStage = (typeof PROMPT_STAGES)[number]

export type PromptLanguage = 'en' | 'bn'

export type PromptRecord = {
  code: string
  name: string
  category: string
  stage: PromptStage
  language: PromptLanguage
  role: string
  departmentCode: string
  skillCode: string | null
  sopKey: string | null
  priority: number
  quality: number
  version: string
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED'
  template: string
  variables: string[]
  tags: string[]
}

// ------------------------------------------------------------
// The stage bodies — the instruction for each stage
// ------------------------------------------------------------

const STAGE_BODY: Record<PromptStage, { en: string; bn: string; output: string; variables: string[] }> = {
  INITIALIZATION: {
    en: 'Establish your role, your scope and the rules you operate under before touching the task.',
    bn: 'কাজ শুরু করার আগে আপনার ভূমিকা, কাজের সীমা এবং যে নিয়মে কাজ করবেন তা নির্ধারণ করুন।',
    output: 'A one-paragraph statement of role, scope, tools and limits.',
    variables: ['employeeName', 'role', 'departmentName', 'mission'],
  },
  TASK_INTAKE: {
    en: 'Understand the request, identify what is actually being asked, and list what is missing.',
    bn: 'অনুরোধটি বুঝুন, আসলে কী চাওয়া হচ্ছে তা নির্ধারণ করুন, এবং কী অনুপস্থিত তা তালিকাভুক্ত করুন।',
    output: 'A restatement of the task, its objective, and its missing inputs.',
    variables: ['task', 'objective'],
  },
  TASK_EXECUTION: {
    en: 'Execute the task using the selected skills and SOP, one step at a time, and record what you did.',
    bn: 'নির্বাচিত দক্ষতা ও পদ্ধতি ব্যবহার করে কাজটি ধাপে ধাপে সম্পাদনা করুন এবং প্রতিটি ধাপ লিখে রাখুন।',
    output: 'The completed work with the steps taken and the evidence for each.',
    variables: ['task', 'skills', 'sop'],
  },
  DECISION_SUPPORT: {
    en: 'Present the decision, the options, the evidence for each, and your recommendation. The decision is not yours to make unless it is inside your authority.',
    bn: 'সিদ্ধান্ত, বিকল্প, প্রতিটির জন্য প্রমাণ এবং আপনার সুপারিশ উপস্থাপন করুন। আপনার কর্তৃত্বের বাইরে সিদ্ধান্ত আপনার নয়।',
    output: 'A decision brief with options, evidence, a recommendation and the escalation path.',
    variables: ['decision', 'options', 'evidence'],
  },
  RESEARCH: {
    en: 'Gather what is needed, cite the source of every claim, and say plainly what you could not find.',
    bn: 'প্রয়োজনীয় তথ্য সংগ্রহ করুন, প্রতিটি দাবির উৎস উল্লেখ করুন, এবং যা পাননি তা স্পষ্ট বলুন।',
    output: 'A finding with citations and an explicit list of what remains unknown.',
    variables: ['question', 'sources'],
  },
  TOOL_USAGE: {
    en: 'Call only the tools you are granted, with arguments that match the tool schema. Never fabricate a tool result.',
    bn: 'শুধু অনুমোদিত টুল ব্যবহার করুন, আর্গুমেন্ট টুলের স্কিমার সঙ্গে মেলান। কখনোই বানানো ফলাফল দেবেন না।',
    output: 'A tool call with schema-valid arguments, or a refusal with a reason.',
    variables: ['tool', 'arguments'],
  },
  QUALITY_REVIEW: {
    en: 'Check the work for accuracy, completeness, evidence, format and policy compliance. Name every defect you find.',
    bn: 'কাজটি নির্ভুলতা, সম্পূর্ণতা, প্রমাণ, বিন্যাস ও নীতির সঙ্গে মিলের জন্য যাচাই করুন। প্রতিটি ত্রুটি উল্লেখ করুন।',
    output: 'A review with a pass or fail verdict and the defects found.',
    variables: ['work', 'criteria'],
  },
  ESCALATION: {
    en: 'State what happened, what you tried, what is blocked and who must decide. Do not decide beyond your authority.',
    bn: 'কী ঘটেছে, আপনি কী চেষ্টা করেছেন, কোথায় আটকে গেছে এবং কে সিদ্ধান্ত নিতে হবে তা উল্লেখ করুন। কর্তৃত্বের বাইরে সিদ্ধান্ত নেবেন না।',
    output: 'An escalation note with the situation, the attempts and the decision needed.',
    variables: ['situation', 'attempts', 'decisionNeeded'],
  },
  REPORTING: {
    en: 'Report only figures that are in the record. No estimate, no placeholder, no extrapolation.',
    bn: 'কেবল রেকর্ডে থাকা সংখ্যা জানান। কোনো অনুমান, প্লেসহোল্ডার বা বহির্ভূত প্রাক্কলন নয়।',
    output: 'A report whose every figure can be traced to a record.',
    variables: ['period', 'figures'],
  },
  COLLABORATION: {
    en: 'State the objective, the context, the permissions and the expected output so the other employee can act without asking.',
    bn: 'উদ্দেশ্য, প্রসঙ্গ, অনুমতি ও প্রত্যাশিত ফলাফল উল্লেখ করুন যাতে অপর কর্মী প্রশ্ন না করে কাজ করতে পারে।',
    output: 'A delegation or consultation request with a complete contract.',
    variables: ['objective', 'context', 'expectedOutput'],
  },
  KNOWLEDGE_SHARING: {
    en: 'Share the approved conclusion, not the raw source material. Remove anything that is confidential to another team.',
    bn: 'অনুমোদিত সিদ্ধান্ত ভাগ করুন, কাঁচা উৎস নয়। অন্য দলের গোপন তথ্য সরিয়ে নিন।',
    output: 'A shareable, sanitised conclusion.',
    variables: ['conclusion', 'audience'],
  },
  ERROR_RECOVERY: {
    en: 'Diagnose the failure from the evidence, attempt at most one bounded remediation, and escalate if it does not work.',
    bn: 'প্রমাণ থেকে ব্যর্থতা নির্ণয় করুন, সর্বোচ্চ একটি সীমিত সমাধান চেষ্টা করুন, ব্যর্থ হলে ঊর্ধ্বমুখী করুন।',
    output: 'A diagnosis, one bounded remediation attempt, and an escalation if needed.',
    variables: ['error', 'evidence'],
  },
  REFLECTION: {
    en: 'Review what worked, what failed, why, and what would change next time. Keep it short and specific.',
    bn: 'কী কাজ করেছে, কী ব্যর্থ হয়েছে, কেন, এবং পরেরবার কী বদলাবে তা পর্যালোচনা করুন। সংক্ষিপ্ত ও নির্দিষ্ট রাখুন।',
    output: 'A short reflection with one concrete change.',
    variables: ['objective', 'result'],
  },
  LEARNING: {
    en: 'Propose the lesson worth keeping. It must be validated, general enough to help another employee, and safe to apply.',
    bn: 'সংরক্ষণযোগ্য শিক্ষা প্রস্তাব করুন। এটি যাচাইকৃত, অন্য কর্মীর কাজে আসে এবং নিরাপদে প্রয়োগযোগ্য হতে হবে।',
    output: 'A validated lesson with its evidence and the scope it applies to.',
    variables: ['lesson', 'evidence', 'scope'],
  },
  PERFORMANCE_REVIEW: {
    en: 'Review the record of work, the errors and the improvements, and produce an honest assessment.',
    bn: 'কাজের রেকর্ড, ভুল ও উন্নতি পর্যালোচনা করে সৎ মূল্যায়ন দিন।',
    output: 'An evidence-based performance assessment.',
    variables: ['period', 'record'],
  },
  EMERGENCY_RESPONSE: {
    en: 'Act on the safety-critical facts first, escalate immediately, and record the timeline as it happens.',
    bn: 'প্রথমে নিরাপত্তা-সংক্রান্ত তথ্য অনুসরণ করুন, সঙ্গে সঙ্গে ঊর্ধ্বমুখী করুন, এবং ঘটনার সময়সূচি লিখে রাখুন।',
    output: 'An immediate action record with an escalation raised.',
    variables: ['incident', 'facts'],
  },
}

const OUTPUT_REQUIREMENTS: Record<PromptLanguage, string> = {
  en: 'Output only the deliverable. No preamble, no self-description, no invented figures. If the information is missing, say exactly what is missing.',
  bn: 'কেবল প্রতিদেয় লিখুন। কোনো ভূমিকা বা পরিচিতি নয়, কোনো বানানো সংখ্যা নয়। তথ্য অনুপস্থিত থাকলে ঠিক কী অনুপস্থিত তা লিখুন।',
}

const CONSTITUTION_BLOCK = CONSTITUTION.map((rule, index) => `${index + 1}. ${rule}`).join('\n')

// ------------------------------------------------------------
// The library
// ------------------------------------------------------------

export type PromptLibraryIndex = {
  size: number
  departments: number
  roles: number
  stages: number
  languages: number
}

export function promptLibraryIndex(roleCount: number): PromptLibraryIndex {
  return {
    size: DEPARTMENTS.length * roleCount * PROMPT_STAGES.length * 2,
    departments: DEPARTMENTS.length,
    roles: roleCount,
    stages: PROMPT_STAGES.length,
    languages: 2,
  }
}

/**
 * Materialise the prompts for ONE binding. This is the unit the
 * retriever works with: it never materialises the whole library.
 */
export function buildPromptsForBinding(input: {
  departmentCode: string
  roleSlug: string
  roleTitle: string
  skillSlug?: string | null
  sopKey?: string | null
}): PromptRecord[] {
  const department = DEPARTMENTS.find((d) => d.code === input.departmentCode)
  const departmentName = department?.name ?? input.departmentCode
  const records: PromptRecord[] = []

  for (const stage of PROMPT_STAGES) {
    const body = STAGE_BODY[stage]
    for (const language of ['en', 'bn'] as PromptLanguage[]) {
      const instruction = language === 'bn' ? body.bn : body.en
      const template = [
        `ROLE: You are the ${input.roleTitle} of ${departmentName} (${input.departmentCode}).`,
        '',
        'GLOBAL CONSTITUTION (non-negotiable):',
        CONSTITUTION_BLOCK,
        '',
        `STAGE: ${stage}`,
        instruction,
        '',
        `OUTPUT REQUIREMENT: ${body.output}`,
        OUTPUT_REQUIREMENTS[language],
        ...(input.skillSlug ? [`AVAILABLE SKILL: ${input.skillSlug}`] : []),
        ...(input.sopKey ? [`ACTIVE PROCEDURE: ${input.sopKey}`] : []),
        '',
        'CONTEXT:',
        ...body.variables.map((variable) => `{{${variable}}}`),
      ].join('\n')

      records.push({
        code: `PR-${input.departmentCode}-${input.roleSlug}-${stage}-${language}`.toUpperCase(),
        name: `${input.roleTitle} — ${stage} (${language})`,
        category: department?.category ?? 'GENERAL',
        stage,
        language,
        role: input.roleSlug,
        departmentCode: input.departmentCode,
        skillCode: input.skillSlug ?? null,
        sopKey: input.sopKey ?? null,
        priority: stage === 'EMERGENCY_RESPONSE' || stage === 'ESCALATION' ? 9 : stage === 'TASK_EXECUTION' ? 8 : 5,
        quality: 0.8,
        version: '1.0.0',
        status: 'ACTIVE',
        template,
        variables: body.variables,
        tags: [stage, department?.category ?? 'GENERAL', input.roleSlug],
      })
    }
  }
  return records
}

/**
 * Render a prompt with its variables substituted. A variable with no
 * value is left visible as a marker rather than being silently
 * replaced with an empty string — a prompt with a hole in it must be
 * visible.
 */
export function renderPrompt(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined || value === '' ? match : value
  })
}

/** The prompt stages that apply to a given kind of work. */
export function stagesForTask(complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'): PromptStage[] {
  if (complexity === 'SIMPLE') return ['INITIALIZATION', 'TASK_INTAKE', 'TASK_EXECUTION']
  if (complexity === 'STANDARD') return ['INITIALIZATION', 'TASK_INTAKE', 'TASK_EXECUTION', 'TOOL_USAGE', 'QUALITY_REVIEW']
  if (complexity === 'COMPLEX') {
    return ['INITIALIZATION', 'TASK_INTAKE', 'RESEARCH', 'DECISION_SUPPORT', 'TASK_EXECUTION', 'TOOL_USAGE', 'QUALITY_REVIEW', 'ESCALATION', 'REFLECTION']
  }
  return [
    'INITIALIZATION',
    'TASK_INTAKE',
    'RESEARCH',
    'DECISION_SUPPORT',
    'TASK_EXECUTION',
    'TOOL_USAGE',
    'COLLABORATION',
    'QUALITY_REVIEW',
    'ESCALATION',
    'REPORTING',
    'REFLECTION',
  ]
}
