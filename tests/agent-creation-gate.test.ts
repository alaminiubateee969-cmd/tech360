import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = join(import.meta.dirname, '..')
const createRoute = readFileSync(join(root, 'src/app/api/admin/agents/create/route.ts'), 'utf8')
const activationRoute = readFileSync(join(root, 'src/app/api/admin/agents/[code]/route.ts'), 'utf8')
const hierarchyService = readFileSync(join(root, 'src/lib/agents/hierarchy-service.ts'), 'utf8')

describe('agent creation and activation gates', () => {
  it('checks a fresh DCC certificate before any creation inference call', () => {
    const dccCheck = createRoute.indexOf('requireCurrentCertification(certification)')
    const inference = createRoute.indexOf("runAgent('AGC-041'")
    assert.ok(dccCheck >= 0)
    assert.ok(inference > dccCheck, 'DCC must be checked before paying for or invoking draft inference')
  })

  it('does not save or activate an agent without bounded parent placement', () => {
    assert.match(createRoute, /inspectParentHierarchy\(db, parentCode, department\.id\)/)
    assert.match(createRoute, /MAX_CHILD_AGENTS_PER_PARENT|evaluateAgentPlacement/)
    assert.match(createRoute, /status: 'PAUSED'/)
  })

  it('requires an explicit activation confirmation, current DCC, hierarchy checks, and an audit record', () => {
    assert.match(activationRoute, /confirmation !== 'ACTIVATE'/)
    assert.match(activationRoute, /isCurrentDccCertification/)
    assert.match(activationRoute, /isValidExistingChildAgent/)
    assert.match(activationRoute, /action: nextStatus === 'ACTIVE' \? 'AGENT_ACTIVATED'/)
  })

  it('rechecks current DCC on every dynamic-agent execution boundary', () => {
    assert.match(hierarchyService, /departmentCapabilityAssessment\.findFirst/)
    assert.match(hierarchyService, /isCurrentDccCertification/)
    for (const path of ['src/lib/agents/engine.ts', 'src/lib/agents/jobs.ts', 'src/lib/agents/tool-executor.ts']) {
      const source = readFileSync(join(root, path), 'utf8')
      assert.match(source, /isValidExistingChildAgent/)
    }
  })
})
