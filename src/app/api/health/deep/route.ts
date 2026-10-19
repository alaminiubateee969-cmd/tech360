import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { db } from '@/lib/db'
import { modelServiceStatus, listLocalModels } from '@/lib/model/router'
import { summariseRegistry } from '@/lib/skills/registry'
import { knowledgeCorpusStats } from '@/lib/rag/pipeline'
import { skillQueueDepth } from '@/lib/skills/queue'
import { LOGICAL_AGENT_CATALOGUE } from '@/lib/agents/catalogue'
import { CORE_AGENTS, DEPARTMENTS } from '@/lib/agents/registry'
import packageJson from '../../../../../package.json'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health/deep
 *
 * The deep health check. It is AUTHENTICATED (SUPER_ADMIN or above) —
 * unlike /api/health, which is public and deliberately says very little.
 *
 * It reports the real state of every subsystem the private AI platform
 * depends on: the database, the model providers, the local weights, the
 * skill registry, the task queue and the knowledge corpus.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g

  const checks: Record<string, { status: string; detail: string; [key: string]: unknown }> = {}

  // --- database -------------------------------------------------------
  let databaseUp = false
  try {
    await db.$queryRaw`SELECT 1`
    databaseUp = true
    checks.database = { status: 'UP', detail: 'connection and core schema available' }
  } catch {
    checks.database = { status: 'DOWN', detail: 'database connection or core schema check failed' }
  }

  // --- model service --------------------------------------------------
  const models = modelServiceStatus()
  checks.modelService = {
    status: models.state,
    detail: models.detail,
    gatewayEnabled: models.gateway.enabled,
    providers: models.providers.map((provider) => ({
      kind: provider.kind,
      state: provider.state,
      privateOnly: provider.privateOnly,
    })),
  }

  if (models.state !== 'UNAVAILABLE') {
    const installed = await listLocalModels()
    checks.localModels = {
      status: installed.ok ? (installed.models.length > 0 ? 'UP' : 'EMPTY') : 'UNREACHABLE',
      detail: installed.ok
        ? `${installed.models.length} model(s) installed on the local server`
        : (installed.error ?? 'the local model server could not be reached'),
      installed: installed.ok ? installed.models.map((m) => m.name) : [],
    }
  } else {
    checks.localModels = { status: 'UNAVAILABLE', detail: 'no local model provider is configured' }
  }

  // --- registries -----------------------------------------------------
  if (databaseUp) {
    try {
      const [skillCount, agentCount, departmentCount] = await Promise.all([
        db.skill.count(),
        db.aiAgent.count(),
        db.department.count(),
      ])
      checks.registries = {
        status: skillCount > 0 || agentCount > 0 ? 'UP' : 'EMPTY',
        detail: 'catalogue sizes are reported separately from persisted rows',
        persistedSkills: skillCount,
        persistedExecutableAgents: agentCount,
        persistedDepartments: departmentCount,
        catalogueSkills: summariseRegistry().registered,
        catalogueLogicalAgents: LOGICAL_AGENT_CATALOGUE.length,
        executableAgents: CORE_AGENTS.length,
        departments: DEPARTMENTS.length,
      }
    } catch {
      checks.registries = { status: 'UNKNOWN', detail: 'registry counts could not be read' }
    }

    try {
      const depth = await skillQueueDepth()
      const queued = await db.agentJob.count({ where: { status: { in: ['QUEUED', 'RETRYING'] } } })
      checks.taskQueue = {
        status: 'UP',
        detail: `${queued} task(s) awaiting a worker`,
        queued,
        queuedSkills: depth,
      }
    } catch {
      checks.taskQueue = { status: 'UNKNOWN', detail: 'task queue depth could not be read' }
    }

    try {
      const corpus = await knowledgeCorpusStats()
      checks.knowledgeCorpus = {
        status: corpus.chunks > 0 ? 'UP' : 'EMPTY',
        detail: `${corpus.chunks} chunk(s) across ${corpus.documents} indexed document(s)`,
        ...corpus,
      }
    } catch {
      checks.knowledgeCorpus = { status: 'UNKNOWN', detail: 'knowledge corpus statistics could not be read' }
    }
  } else {
    checks.registries = { status: 'UNKNOWN', detail: 'database unavailable' }
    checks.taskQueue = { status: 'UNKNOWN', detail: 'database unavailable' }
    checks.knowledgeCorpus = { status: 'UNKNOWN', detail: 'database unavailable' }
  }

  const failing = Object.values(checks).filter((check) => check.status === 'DOWN' || check.status === 'UNREACHABLE')

  return Response.json({
    status: failing.length === 0 ? 'healthy' : 'degraded',
    app: 'tech360-platform',
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
  })
}
