import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canHumanAcceptAgentDraft, canQueueAgentDraft, statusAfterAgentJob } from '../src/lib/project-task-policy'

describe('project task human-review policy', () => {
  it('queues drafts only for agent-owned TODO/BLOCKED tasks with no live/completed draft', () => {
    assert.equal(canQueueAgentDraft({ assigneeType: 'AGENT', status: 'TODO' }), true)
    assert.equal(canQueueAgentDraft({ assigneeType: 'AGENT', status: 'BLOCKED', linkedJobStatus: 'FAILED' }), true)
    assert.equal(canQueueAgentDraft({ assigneeType: 'HUMAN', status: 'TODO' }), false)
    assert.equal(canQueueAgentDraft({ assigneeType: 'AGENT', status: 'IN_PROGRESS' }), false)
    assert.equal(canQueueAgentDraft({ assigneeType: 'AGENT', status: 'TODO', linkedJobStatus: 'RUNNING' }), false)
    assert.equal(canQueueAgentDraft({ assigneeType: 'AGENT', status: 'TODO', linkedJobStatus: 'COMPLETED' }), false)
  })

  it('never treats an agent result as accepted until a human marks the task for review and accepts it', () => {
    assert.equal(canHumanAcceptAgentDraft({ assigneeType: 'AGENT', taskStatus: 'REVIEW', jobStatus: 'COMPLETED' }), true)
    assert.equal(canHumanAcceptAgentDraft({ assigneeType: 'AGENT', taskStatus: 'IN_PROGRESS', jobStatus: 'COMPLETED' }), false)
    assert.equal(canHumanAcceptAgentDraft({ assigneeType: 'AGENT', taskStatus: 'REVIEW', jobStatus: 'FAILED' }), false)
    assert.equal(canHumanAcceptAgentDraft({ assigneeType: 'HUMAN', taskStatus: 'REVIEW', jobStatus: 'COMPLETED' }), false)
  })

  it('routes successful drafts to review and terminal failures to human-blocked state', () => {
    assert.equal(statusAfterAgentJob('COMPLETED', false), 'REVIEW')
    assert.equal(statusAfterAgentJob('RETRYING', true), 'IN_PROGRESS')
    assert.equal(statusAfterAgentJob('FAILED', false), 'BLOCKED')
    assert.equal(statusAfterAgentJob('TIMED_OUT', false), 'BLOCKED')
    assert.equal(statusAfterAgentJob('RUNNING', false), null)
  })
})
