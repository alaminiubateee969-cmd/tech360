import { getFeatureFlags } from '@/lib/features'

export const dynamic = 'force-dynamic'

// ============================================================
// PUBLIC FEATURE SURFACE — the safe subset the SPA needs to
// render honest states (maintenance banner, blog/case-studies
// sections, support availability). No auth: contains only
// on/off booleans, never credentials or internals.
// ============================================================

export async function GET() {
  const flags = await getFeatureFlags()
  return Response.json(
    {
      maintenance: flags.maintenance_mode,
      publicWebsite: flags.public_website,
      blog: flags.blog,
      caseStudies: flags.case_studies,
      support: flags.support,
      clientPortal: flags.client_portal,
      payments: flags.payments,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
