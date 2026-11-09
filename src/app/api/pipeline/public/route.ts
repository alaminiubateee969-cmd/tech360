import {
  PIPELINE_BRAND,
  PIPELINE_CORE_RULE,
  PIPELINE_DOMAIN,
  PIPELINE_EMAIL,
  PIPELINE_WEBCHAT,
} from '@/lib/pipeline/spec-copy'
import { POLICY_HTML_PREVIEW_BEFORE_PAYMENT, POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT } from '@/lib/pipeline/rules'
import { PUBLIC_DELIVERY_PROMISES, PUBLIC_JOURNEY } from '@/lib/public-journey'

export const dynamic = 'force-dynamic'

/**
 * Public, read-only statement of how a TECH360 engagement runs.
 *
 * WHAT THIS RETURNS: the seven-step customer journey, the two delivery
 * promises, and public contact details. Nothing else.
 *
 * WHAT THIS DELIBERATELY OMITS (available only from the authenticated
 * operator specification at /api/admin/pipeline/spec):
 *   - the internal eleven-stage operator pipeline and its message variants
 *   - auto-send vs admin-approval mappings and internal approval categories
 *   - CRM save-field contracts and profile-field inventories
 *   - the internal 10-point agent rule set
 *
 * It performs no database query and exposes no client record, no real Client
 * ID, no credential and no internal metric.
 */
export async function GET() {
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      brand: PIPELINE_BRAND,
      domain: PIPELINE_DOMAIN,
      email: PIPELINE_EMAIL,
      webchat: PIPELINE_WEBCHAT,
      coreRule: PIPELINE_CORE_RULE,
      summary:
        'How a TECH360 engagement runs, from the first enquiry to source-code handover.',
      meta: {
        journeyStepCount: PUBLIC_JOURNEY.length,
        version: 'public-journey-v1',
      },
      journey: PUBLIC_JOURNEY,
      promises: PUBLIC_DELIVERY_PROMISES,
      policies: [POLICY_HTML_PREVIEW_BEFORE_PAYMENT, POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT],
      note: 'This endpoint publishes the customer journey only. Stage-by-stage internal operator mechanics are not part of the public contract.',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  )
}
