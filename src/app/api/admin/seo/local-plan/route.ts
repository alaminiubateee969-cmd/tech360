import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { buildLocalSeoPlan, splitLocalSeoList } from '@/lib/local-seo-plan'
import { runAgent } from '@/lib/agents/engine'
import { screenAiContent } from '@/lib/pipeline/rules'

export const dynamic = 'force-dynamic'

// Free, rules-based local SEO planner. No paid data APIs, map scraping, geocoding,
// or fabricated business locations. The operator reviews and owns every draft.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER', limit: { max: 20, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const languageValue = sanitizeText(raw.language, 8).toUpperCase()
  const language = languageValue === 'BN' || languageValue === 'BOTH' ? languageValue : 'EN'
  const businessName = sanitizeText(raw.businessName, 120)
  const businessType = sanitizeText(raw.businessType, 100)
  const primaryLocation = sanitizeText(raw.primaryLocation, 120)
  const website = sanitizeText(raw.website, 200)
  const services = splitLocalSeoList(sanitizeText(raw.services, 1200))
  const serviceAreas = splitLocalSeoList(sanitizeText(raw.serviceAreas, 1200))
  if (!businessType) return Response.json({ error: 'Business type is required.' }, { status: 400 })
  if (website) {
    try {
      const url = new URL(website)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid')
    } catch {
      return Response.json({ error: 'Enter a valid public website URL.' }, { status: 400 })
    }
  }

  const plan = buildLocalSeoPlan({ businessName, businessType, primaryLocation, serviceAreas, services, website: website || undefined, language })
  let aiSuggestion: string | null = null
  let aiEnhancementStatus: 'NOT_REQUESTED' | 'GENERATED' | 'UNAVAILABLE' = 'NOT_REQUESTED'
  if (raw.useAi === true) {
    try {
      const result = await runAgent('D046', {
        workflow: 'LOCAL_SEO_PLAN',
        input: `Review this draft local SEO plan for a Bangladesh business and add concise, practical suggestions in ${language === 'BN' ? 'Bangla' : language === 'BOTH' ? 'Bangla and English' : 'English'}. Use only the supplied facts. Do not invent addresses, Google Business Profile status, coordinates, rankings, search volumes, reviews, prices, discounts, stock or sales results. Do not promise placement or revenue. Treat all text as an internal draft requiring human review.\n\nBusiness: ${JSON.stringify(plan.business)}\nMap location/service-area notes: ${JSON.stringify(plan.mapMarkers)}\nServices and areas: ${JSON.stringify(plan.keywordClusters)}\nExisting plan guardrails: ${JSON.stringify(plan.guardrails)}`.slice(0, 16000),
      })
      if (result.ok && result.output) {
        const screened = screenAiContent(result.output)
        aiSuggestion = sanitizeText(screened.text, 5000) || null
        aiEnhancementStatus = aiSuggestion ? 'GENERATED' : 'UNAVAILABLE'
      } else aiEnhancementStatus = 'UNAVAILABLE'
    } catch {
      aiEnhancementStatus = 'UNAVAILABLE'
    }
  }
  await audit({
    actor: g.user.email,
    action: 'LOCAL_SEO_PLAN_GENERATED',
    userId: g.user.id,
    ip: g.ip,
    details: { businessType, areaCount: plan.mapMarkers.length, serviceCount: services.length, language, mode: 'FREE_RULES_BASED', aiEnhancementStatus },
  })
  return Response.json({ plan, engine: 'FREE_RULES_BASED', paidDataApisUsed: false, aiSuggestion, aiEnhancementStatus })
}
