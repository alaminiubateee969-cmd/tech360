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
}
