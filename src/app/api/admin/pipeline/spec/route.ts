import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import {
  AI_ADMIN_APPROVAL,
  AI_ALWAYS_SAVE,
  AI_AUTO_SEND,
  CLIENT_ID_FORMAT,
  CLIENT_ID_PATTERN,
  CRM_PROFILE_FIELDS,
  FINAL_RULES,
  PIPELINE_BRAND,
  PIPELINE_CORE_RULE,
  PIPELINE_DOMAIN,
  PIPELINE_EMAIL,
  PIPELINE_WEBCHAT,
  SPEC_CHANNELS,
  SPEC_COPY_META,
  SPEC_GROUP_TITLES,
  SPEC_STAGE_GROUPS,
  SPEC_STAGES,
} from '@/lib/pipeline/spec-copy'
import {
  ACTION_SAVE_FIELDS,
  ADMIN_APPROVAL_CATEGORIES,
  ADMIN_APPROVAL_STAGES,
  AUTO_SEND_STAGES,
  CLIENT_JOURNEY_STAGES,
  CRM_SAVE_FIELDS,
  POLICY_HTML_PREVIEW_BEFORE_PAYMENT,
  POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT,
  gatePartitionIsComplete,
} from '@/lib/pipeline/rules'
import { COMM_CHANNELS } from '@/lib/constants'
import { AI_AGENT_RULES } from '@/lib/ai-agent-rule-engine'

export const dynamic = 'force-dynamic'

/**
 * AUTHENTICATED operator specification for the communication pipeline.
 *
 * This is the full master specification — exact message copy per stage,
 * approval-gate mapping, CRM save contract and the 10-point agent rule set.
 *
 * ACCESS: `guard()` requires a signed-in operator session with at least the
 * MANAGER role, matching `VIEW_MIN_ROLE.pipeline` in the console navigation.
 * The public, read-only shape of this contract lives at
 * `/api/pipeline/public` and deliberately omits the per-stage copy.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      requestedBy: { email: g.user.email, role: g.user.role },
      brand: PIPELINE_BRAND,
      domain: PIPELINE_DOMAIN,
      email: PIPELINE_EMAIL,
      webchat: PIPELINE_WEBCHAT,
      coreRule: PIPELINE_CORE_RULE,
      clientId: { format: CLIENT_ID_FORMAT, pattern: CLIENT_ID_PATTERN },
      meta: SPEC_COPY_META,
      channels: SPEC_CHANNELS,
      systemChannels: COMM_CHANNELS,
      crmProfileFields: CRM_PROFILE_FIELDS,
      crmSaveFields: CRM_SAVE_FIELDS,
      actionSaveFields: ACTION_SAVE_FIELDS,
      autoSendStages: AUTO_SEND_STAGES,
      adminApprovalStages: ADMIN_APPROVAL_STAGES,
      adminApprovalCategories: ADMIN_APPROVAL_CATEGORIES,
      autoSendMessages: AI_AUTO_SEND,
      adminApprovalMessages: AI_ADMIN_APPROVAL,
      alwaysSave: AI_ALWAYS_SAVE,
      finalRules: FINAL_RULES,
      policies: [POLICY_HTML_PREVIEW_BEFORE_PAYMENT, POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT],
      gatePartitionIsComplete: gatePartitionIsComplete(),
      journey: CLIENT_JOURNEY_STAGES.map((s) => ({ number: s.number, key: s.key, label: s.label })),
      stageGroups: SPEC_STAGE_GROUPS,
      groupTitles: SPEC_GROUP_TITLES,
      stages: SPEC_STAGES,
      agentRules: AI_AGENT_RULES,
      note: 'Internal master wording. The live sender (src/lib/pipeline/templates.ts) adds consent and legal clarifications; the enforced gates live in src/lib/pipeline/rules.ts and src/lib/ai-agent-rule-engine.ts.',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    },
  )
}
