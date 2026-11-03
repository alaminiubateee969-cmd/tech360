import {
  AI_ADMIN_APPROVAL, AI_ALWAYS_SAVE, AI_AUTO_SEND, CRM_PROFILE_FIELDS, FINAL_RULES,
  PIPELINE_BRAND, PIPELINE_CORE_RULE, PIPELINE_DOMAIN, PIPELINE_EMAIL, PIPELINE_WEBCHAT,
  CLIENT_ID_FORMAT, CLIENT_ID_PATTERN, SPEC_CHANNELS, SPEC_COPY_META, SPEC_STAGES, SPEC_STAGE_GROUPS, SPEC_GROUP_TITLES,
} from '@/lib/pipeline/spec-copy'
import {
  ACTION_SAVE_FIELDS, ADMIN_APPROVAL_CATEGORIES, ADMIN_APPROVAL_STAGES, AUTO_SEND_STAGES,
  CLIENT_JOURNEY_STAGES, CRM_SAVE_FIELDS, POLICY_HTML_PREVIEW_BEFORE_PAYMENT,
  POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT, gatePartitionIsComplete,
} from '@/lib/pipeline/rules'
import { COMM_CHANNELS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

/**
 * Public, read-only statement of the AI Agent Communication Pipeline.
 *
 * This endpoint deliberately returns ONLY the approved client-facing copy and
 * the policy lists. It performs no database query and exposes no client record,
 * no Client ID that belongs to a real person, no credentials, no internal
 * metrics and no file links. It exists so the website, an n8n relay or a
 * partner integration can read the same single source of truth instead of
 * maintaining a second copy of the wording.
 */
export async function GET() {
  return Response.json({
    generatedAt: new Date().toISOString(),
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
    note: 'This is the approved master wording. The live sender (src/lib/pipeline/templates.ts) adds consent and legal clarifications; the enforced gates live in src/lib/pipeline/rules.ts.',
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
}
