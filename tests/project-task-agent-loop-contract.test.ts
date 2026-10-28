import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('project task AI draft human loop wiring', () => {
  it('queues a project-scoped draft only after final scope approval and labels it as not complete', () => {
    const route = read('src/app/api/admin/projects/[id]/tasks/[taskId]/run/route.ts')
    assert.match(route, /guard\(_req, \{ minRole: 'MANAGER' \}\)/)
    assert.match(route, /status: 'FINAL'/)
    assert.match(route, /projectTaskId: task\.id/)
    assert.match(route, /workflow: 'PROJECT_TASK_EXECUTION'/)
    assert.match(route, /It will not be treated as complete/)
  })

  it('moves successful draft work to REVIEW, never DONE, and requires human acceptance evidence', () => {
    const worker = read('src/lib/agents/jobs.ts')
    const engine = read('src/lib/agents/engine.ts')
    const policy = read('src/lib/project-task-policy.ts')
    const patchRoute = read('src/app/api/admin/projects/[id]/tasks/[taskId]/route.ts')
    assert.match(worker, /syncProjectTaskForJob\(tx, job, nextStatus, retry, now\)/)
    assert.match(engine, /PROJECT TASK HUMAN-REVIEW MODE/)
    assert.match(engine, /projectTaskDraftRules/)
    assert.match(engine, /changed infrastructure or finished work/i)
    assert.match(policy, /if \(status === 'COMPLETED'\) return 'REVIEW'/)
    assert.match(patchRoute, /canHumanAcceptAgentDraft/)
    assert.match(patchRoute, /REVIEW_EVIDENCE_REQUIRED/)
  })

  it('shows the draft in the admin task view and offers explicit human acceptance', () => {
    const api = read('src/lib/admin-client.ts')
    const ui = read('src/components/admin/ProjectsView.tsx')
    assert.match(api, /runTaskAgentDraft/)
    assert.match(ui, /AI draft output — review required/)
    assert.match(ui, /Mark verified/)
  })
})
