<<<<<<< HEAD
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { discoverSkills, summariseRegistry, getSkillDefinition, skillOperationalStatus } from '@/lib/skills/registry'
import { SKILL_HANDLER_KEYS } from '@/lib/skills/primitives'
import { LOGICAL_AGENT_CATALOGUE } from '@/lib/agents/catalogue'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skills
 *
 * The skill registry.
 *
 * ?id=<skillId>      → one skill with its operational status
 * ?query=…           → free-text search
 * ?category=…        → category filter
 * ?department=…      → owning department filter
 * ?handler=…         → handler filter
 * ?status=…          → lifecycle status filter
 * ?limit=&offset=    → pagination
 *
 * The response always separates registered / implemented / tested /
 * enabled / operational. A catalogue row alone is never counted as
 * operational.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)

  const id = sanitizeText(url.searchParams.get('id') ?? '', 120)
  if (id) {
    const definition = getSkillDefinition(id)
    if (!definition) {
      return Response.json({ error: 'Skill not found.', code: 'UNKNOWN_SKILL' }, { status: 404 })
    }
    return Response.json({
      skill: definition,
      status: skillOperationalStatus(definition),
    })
  }

  const limit = Math.max(1, Math.min(200, Math.floor(Number(url.searchParams.get('limit') ?? 50) || 50)))
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') ?? 0) || 0))
  const found = discoverSkills({
    query: sanitizeText(url.searchParams.get('query') ?? '', 120),
    category: sanitizeText(url.searchParams.get('category') ?? '', 40).toUpperCase(),
    departmentCode: sanitizeText(url.searchParams.get('department') ?? '', 10).toUpperCase(),
    handler: sanitizeText(url.searchParams.get('handler') ?? '', 60),
    status: sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase(),
    limit,
    offset,
  })

  return Response.json({
    total: found.total,
    limit: found.limit,
    offset: found.offset,
    results: found.results.map((definition) => skillOperationalStatus(definition)),
    summary: summariseRegistry(),
    handlers: SKILL_HANDLER_KEYS,
    logicalAgents: {
      registered: LOGICAL_AGENT_CATALOGUE.length,
      departments: new Set(LOGICAL_AGENT_CATALOGUE.map((a) => a.department)).size,
    },
  })
=======
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns the AgentOS skill catalog — 10 sample categories from the manifest.
const CATALOG = [
  { category: "executive-ceo-control", path: "skills/private/executive-ceo-control", count: 24, sample: "strategy-agent/SKILL.md", description: "CEO-grade strategic planning, OKRs, board memos." },
  { category: "crm-and-automation", path: "skills/private/crm-and-automation", count: 87, sample: "manager-agent/SKILL.md", description: "Lead lifecycle, scoring, pipeline ops, follow-up automation." },
  { category: "messaging", path: "skills/private/messaging", count: 142, sample: "whatsapp-agent/SKILL.md", description: "WhatsApp, email, SMS — routing, drafting, escalation." },
  { category: "delivery", path: "skills/private/delivery", count: 64, sample: "scope-builder-agent/SKILL.md", description: "Scope building, milestone tracking, evidence capture." },
  { category: "finance", path: "skills/private/finance", count: 38, sample: "payment-verifier-agent/SKILL.md", description: "Invoicing, reconciliation, fraud signals." },
  { category: "legal", path: "skills/private/legal", count: 29, sample: "legal-reviewer-agent/SKILL.md", description: "Contract review, compliance, risk scoring." },
  { category: "marketing", path: "skills/private/marketing", count: 156, sample: "seo-optimizer-agent/SKILL.md", description: "SEO, content strategy, ad copy, A/B testing." },
  { category: "social", path: "skills/private/social", count: 73, sample: "social-media-manager-agent/SKILL.md", description: "Multi-channel scheduling, engagement, listening." },
  { category: "design", path: "skills/private/design", count: 41, sample: "brand-designer-agent/SKILL.md", description: "Brand systems, decks, design tokens." },
  { category: "analytics", path: "skills/private/analytics", count: 52, sample: "analytics-insights-agent/SKILL.md", description: "Dashboards, anomaly detection, weekly digests." },
];

export async function GET() {
  return NextResponse.json({
    totalSkills: 2000,
    totalCategories: 100,
    catalog: CATALOG,
  });
>>>>>>> upload/tech360-production-final
}
