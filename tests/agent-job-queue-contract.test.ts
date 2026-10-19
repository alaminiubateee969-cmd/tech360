/**
 * TECH360 — the shared AgentJob queue contract.
 *
 * Two merge-breakage classes are pinned here, both cheap to check without a
 * database:
 *
 *  1. `AgentJob.agentCode` nullability. Migration 8_private_ai_platform made
 *     the column NULL so the SAME durable queue can carry skill and workflow
 *     tasks that no LLM agent owns. When `prisma/schema.prisma` disagrees with
 *     that DDL, CI fails with
 *       NULLABILITY  AgentJob.agentCode — schema NOT NULL, DDL NULL
 *     and nothing can deploy. This asserts the schema, the relation and every
 *     migration that touches the column agree.
 *
 *  2. AgentJob state vocabulary. `finishClaimedJob` maps a reported status
 *     through the retry policy, so a status that is not a known AgentJob state
 *     ('SUCCESS', for example, which belongs to SkillRun) is silently treated
 *     as a FAILURE: a successful skill run would be retried and then persisted
 *     as FAILED. Every status the queue writers report must be a real state.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { AGENT_JOB_STATES, agentJobTerminalState, isRetryableAgentJobFailure } from '../src/lib/agents/job-policy'
import { AGENT_JOB_TOOL_ALLOWLIST } from '../src/lib/agents/tool-executor'
import { SKILL_TASK_TYPE } from '../src/lib/skills/queue'

const ROOT = join(__dirname, '..')
const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
const migrationsDir = join(ROOT, 'prisma/migrations')

function agentJobModel(): string {
  const match = /model AgentJob \{([\s\S]*?)\n\}/.exec(schema)
  assert.ok(match, 'model AgentJob not found in prisma/schema.prisma')
  return match[1]
}

/** The nullability the committed DDL leaves `AgentJob.agentCode` with. */
function ddlAgentCodeNullable(): boolean {
  let nullable: boolean | null = null
  for (const dir of readdirSync(migrationsDir).filter((d) => /^\d+_/.test(d)).sort()) {
    const sql = readFileSync(join(migrationsDir, dir, 'migration.sql'), 'utf8')
    for (const line of sql.split('\n')) {
      const created = /^\s*`agentCode`\s+VARCHAR\(\d+\)\s+(NOT NULL|NULL)/i.exec(line)
      if (created) {
        nullable = created[1].toUpperCase() === 'NULL'
        continue
      }
      const modified = /ALTER TABLE\s+`AgentJob`\s+MODIFY COLUMN\s+`agentCode`\s+VARCHAR\(\d+\)\s+(NOT NULL|NULL)/i.exec(line)
      if (modified) nullable = modified[1].toUpperCase() === 'NULL'
    }
  }
  assert.ok(nullable !== null, 'no migration declares AgentJob.agentCode')
  return nullable
}

/**
 * The status literals the skill worker reports to `finishClaimedJob`: the
 * object literals that carry the queue result envelope (`executionId` plus
 * `status`). A `status:` on some other row — a ProjectTask, a SkillRun — is
 * not an AgentJob state and is deliberately not matched.
 */
function skillQueueStatuses(): string[] {
  const src = readFileSync(join(ROOT, 'src/lib/skills/queue.ts'), 'utf8')
  const statuses: string[] = []
  // Anchor on the queue result envelope, then read every status literal in
  // that object so both branches of a ternary are checked.
  for (const anchor of src.matchAll(/executionId:/g)) {
    const end = src.indexOf('\n      }', anchor.index)
    const block = src.slice(anchor.index, end === -1 ? anchor.index + 400 : end)
    const status = /status:([^\n]*)/.exec(block)
    if (status) statuses.push(...[...status[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]))
  }
  return statuses
}

/** The statuses the durable tool executor can return for an AgentJob. */
function toolExecutorStatuses(): string[] {
  const src = readFileSync(join(ROOT, 'src/lib/agents/tool-executor.ts'), 'utf8')
  const union = /export type AgentJobToolExecutionResult =([\s\S]*?)\n\n/.exec(src)
  assert.ok(union, 'AgentJobToolExecutionResult not found in tool-executor.ts')
  return [...union[1].matchAll(/status: '([A-Z_]+)'/g)].map((m) => m[1])
}

describe('the shared AgentJob queue contract', () => {
  it('keeps agentCode nullable in the schema, the relation and the DDL', () => {
    const body = agentJobModel()
    assert.match(
      body,
      /^\s*agentCode\s+String\?\s*$/m,
      'AgentJob.agentCode must be optional: skill and workflow jobs are queued with agentCode NULL',
    )
    assert.match(
      body,
      /^\s*agent\s+AiAgent\?\s+@relation\(fields: \[agentCode\], references: \[code\], onDelete: Restrict\)/m,
      'the agent relation must be optional while agentCode is nullable',
    )
    assert.equal(
      ddlAgentCodeNullable(),
      true,
      'the committed migrations must leave AgentJob.agentCode NULL, or CI reports schema drift',
    )
  })

  it('queues the platform task types that have no LLM agent', () => {
    assert.equal(SKILL_TASK_TYPE, 'SKILL')
    const orchestrator = readFileSync(join(ROOT, 'src/lib/agents/orchestrator.ts'), 'utf8')
    assert.match(orchestrator, /agentCode: null,\s*\n\s*taskType: 'WORKFLOW'/)
    // The enqueue input accepts them, so a merge cannot silently drop a type.
    const jobs = readFileSync(join(ROOT, 'src/lib/agents/jobs.ts'), 'utf8')
    for (const taskType of ['INFERENCE', 'TOOL_CALL', 'SKILL', 'WORKFLOW', 'DOCUMENT']) {
      assert.ok(jobs.includes(`'${taskType}'`), `enqueueAgentJob no longer names task type ${taskType}`)
    }
    // The merged regression this pins: enqueueAgentJob resolved an agent for
    // EVERY task type, so a skill or workflow job queued with agentCode NULL
    // was rejected with "Agent null is not registered in the database".
    assert.match(
      jobs,
      /const agentOwned = taskType === 'INFERENCE' \|\| taskType === 'TOOL_CALL'/,
      'enqueueAgentJob must only require a registered agent for the agent-owned task types',
    )
    assert.match(jobs, /if \(agentOwned\) \{[\s\S]*?db\.aiAgent\.findUnique/, 'the agent lookup must stay inside the agent-owned branch')
  })

  it('reports only real AgentJob states from every queue writer', () => {
    const known = new Set<string>(AGENT_JOB_STATES)
    const writers: Array<[string, string[]]> = [
      ['src/lib/skills/queue.ts', skillQueueStatuses()],
      ['src/lib/agents/tool-executor.ts', toolExecutorStatuses()],
    ]
    const seen: string[] = []
    for (const [file, statuses] of writers) {
      assert.ok(statuses.length > 0, `no reported statuses were extracted from ${file} — the guard stopped matching`)
      for (const status of statuses) {
        seen.push(status)
        assert.ok(known.has(status), `${file} reports '${status}', which is not an AgentJob state (${[...known].join(', ')})`)
      }
    }
    assert.ok(seen.includes('COMPLETED'), 'the queue writers must be able to complete a job')
    assert.ok(!seen.includes('SUCCESS'), "'SUCCESS' is SkillRun vocabulary and would be persisted as FAILED")
  })

  it('proves why an unknown status would be treated as a failure', () => {
    // The regression this guard exists for: a successful skill run reporting
    // 'SUCCESS' is retried, then terminally FAILED.
    assert.equal(isRetryableAgentJobFailure('SUCCESS', null, 1, 3), false)
    assert.equal(agentJobTerminalState('SUCCESS', 3, 3), 'FAILED')
    // The terminal state is only computed for a job that reported ok === false,
    // so a successful run must never be reported through this path at all.
    assert.equal(agentJobTerminalState('COMPLETED', 3, 3), 'FAILED')
  })

  it('keeps the durable tool allowlist explicit', () => {
    assert.deepEqual([...AGENT_JOB_TOOL_ALLOWLIST], ['task.create'])
  })
})
