import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { buildPromptsForBinding, PROMPT_STAGES, promptLibraryIndex } from '@/lib/prompts/library'
import { retrievePrompts, stagesRetrieved } from '@/lib/prompts/retrieval'
import { ROLE_ARCHETYPES } from '@/lib/agents/catalogue'
import { DEPARTMENTS } from '@/lib/agents/registry'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/prompts — the prompt library.
 *
 * The library is 110 departments x 20 roles x 16 stages x 2 languages
 * = 70,400 slots. It is NEVER sent in one response and it is NEVER
 * loaded into a model context. The endpoint returns:
 *
 *   ?mode=index    — the shape of the library and the stages
 *   ?mode=retrieve — the prompts a retriever WOULD return for a
 *                    department, a role and a complexity. This is the
 *                    retrieval the runtime actually performs.
 *
 * The stored templates are read from the PromptTemplate table, so a
 * panel shows what is persisted, and the live library index is shown
 * next to it.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const mode = params.get('mode') ?? 'index'

  const stored = await db.promptTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, code: true, name: true, category: true, agentCode: true, stage: true, language: true, departmentCode: true, priority: true, quality: true, version: true, status: true, usageCount: true, successCount: true, updatedAt: true },
  })
  const storedTotal = await db.promptTemplate.count()

  if (mode === 'retrieve') {
    const departmentCode = params.get('department') ?? DEPARTMENTS[0].code
    const roleSlug = params.get('role') ?? ROLE_ARCHETYPES[0].slug
    const complexity = (params.get('complexity') ?? 'STANDARD') as 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
    const language = (params.get('language') ?? 'en') as 'en' | 'bn'
    const limit = Math.max(1, Math.min(32, Number(params.get('limit') ?? 12)))

    const retrieved = retrievePrompts({
      departmentCode,
      roleSlug,
      roleTitle: ROLE_ARCHETYPES.find((r) => r.slug === roleSlug)?.title ?? roleSlug,
      language,
      complexity,
      limit,
    })

    return Response.json({
      mode: 'retrieve',
      departmentCode,
      roleSlug,
      complexity,
      language,
      retrieved: retrieved.map((entry) => ({
        code: entry.prompt.code,
        name: entry.prompt.name,
        stage: entry.prompt.stage,
        language: entry.prompt.language,
        score: entry.score,
        reasons: entry.reasons,
        priority: entry.prompt.priority,
        quality: entry.prompt.quality,
        version: entry.prompt.version,
        variables: entry.prompt.variables,
        template: entry.prompt.template,
      })),
      stagesUsed: stagesRetrieved(retrieved),
      count: retrieved.length,
    })
  }

  const index = promptLibraryIndex(ROLE_ARCHETYPES.length)
  const byStage = new Map<string, number>()
  for (const row of stored) {
    byStage.set(row.stage, (byStage.get(row.stage) ?? 0) + 1)
  }

  return Response.json({
    mode: 'index',
    library: index,
    stages: PROMPT_STAGES,
    roles: ROLE_ARCHETYPES.map((role) => ({ slug: role.slug, title: role.title })),
    departments: DEPARTMENTS.map((department) => ({ code: department.code, name: department.name, category: department.category })),
    stored: { total: storedTotal, shown: stored.length, byStage: Object.fromEntries(byStage) },
    storedTemplates: stored,
  })
}
