import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { planFirstFollowUp } from '../src/lib/lead-followup-policy'

const NOW = new Date('2026-10-30T06:00:00.000Z')

describe('lead follow-up policy', () => {
  it('schedules a 4-hour high-priority call when project type and budget are known', () => {
    const plan = planFirstFollowUp({
      source: 'WEBSITE',
      projectType: 'CRM',
      budgetRange: '$2,000 – $5,000',
      hasEmail: true,
      hasWhatsapp: true,
      now: NOW,
    })
    assert.equal(plan.dueInHours, 4)
    assert.equal(plan.priority, 'HIGH')
    assert.equal(plan.dueAt, '2026-10-30T10:00:00.000Z')
    assert.match(plan.action, /decision maker/i)
  })

  it('schedules 12 hours when the project type is known but the budget is not', () => {
    const plan = planFirstFollowUp({ source: 'WEBSITE', projectType: 'eCommerce', hasEmail: true, now: NOW })
    assert.equal(plan.dueInHours, 12)
    assert.equal(plan.priority, 'HIGH')
    assert.equal(plan.dueAt, '2026-10-30T18:00:00.000Z')
  })

  it('schedules 24 hours, medium priority, when only the business type is known', () => {
    const plan = planFirstFollowUp({ source: 'WHATSAPP', businessType: 'Healthcare', hasWhatsapp: true, now: NOW })
    assert.equal(plan.dueInHours, 24)
    assert.equal(plan.priority, 'MEDIUM')
    assert.equal(plan.dueAt, '2026-10-31T06:00:00.000Z')
  })

  it('treats a bare enquiry as time-critical (2 hours)', () => {
    const plan = planFirstFollowUp({ source: 'SMS', now: NOW })
    assert.equal(plan.dueInHours, 2)
    assert.equal(plan.priority, 'HIGH')
    assert.equal(plan.dueAt, '2026-10-30T08:00:00.000Z')
  })

  it('honours the stated contact preference when a destination exists', () => {
    assert.equal(
      planFirstFollowUp({ source: 'WEBSITE', preferredContact: 'WhatsApp', hasWhatsapp: true, hasEmail: true, now: NOW }).channel,
      'WHATSAPP',
    )
    assert.equal(
      planFirstFollowUp({ source: 'WEBSITE', preferredContact: 'Email', hasEmail: true, now: NOW }).channel,
      'EMAIL',
    )
    assert.equal(
      planFirstFollowUp({ source: 'WEBSITE', preferredContact: 'SMS', hasPhone: true, now: NOW }).channel,
      'SMS',
    )
    assert.equal(
      planFirstFollowUp({ source: 'WEBSITE', preferredContact: 'Phone', hasPhone: true, now: NOW }).channel,
      'CALL',
    )
  })

  it('never selects a channel with no destination, and falls back deterministically', () => {
    // WhatsApp preferred but no WhatsApp number captured → next usable channel.
    assert.equal(
      planFirstFollowUp({ source: 'WEBSITE', preferredContact: 'WhatsApp', hasEmail: true, now: NOW }).channel,
      'EMAIL',
    )
    assert.equal(planFirstFollowUp({ source: 'WEBSITE', hasPhone: true, now: NOW }).channel, 'CALL')
    assert.equal(planFirstFollowUp({ source: 'WEBSITE', now: NOW }).channel, 'EMAIL')
  })

  it('is deterministic and never mutates the supplied clock', () => {
    const input = { source: 'WEBSITE', projectType: 'ERP', hasEmail: true, now: new Date(NOW) }
    const first = planFirstFollowUp(input)
    const second = planFirstFollowUp(input)
    assert.deepEqual(first, second)
    assert.equal(input.now.toISOString(), '2026-10-30T06:00:00.000Z')
  })

  it('records a rationale for every plan so scheduling decisions are auditable', () => {
    const cases = [
      planFirstFollowUp({ source: 'WEBSITE', projectType: 'CRM', budgetRange: '1k', now: NOW }),
      planFirstFollowUp({ source: 'WEBSITE', projectType: 'CRM', now: NOW }),
      planFirstFollowUp({ source: 'WEBSITE', businessType: 'Retail', now: NOW }),
      planFirstFollowUp({ source: 'WEBSITE', now: NOW }),
    ]
    for (const plan of cases) {
      assert.ok(plan.rationale.length > 10)
      assert.ok(plan.action.length > 10)
    }
    // Four distinct branches produce four distinct rationales.
    assert.equal(new Set(cases.map((plan) => plan.rationale)).size, 4)
  })

  it('treats whitespace-only inputs as absent', () => {
    const plan = planFirstFollowUp({
      source: 'WEBSITE',
      projectType: '   ',
      budgetRange: '  ',
      businessType: '',
      now: NOW,
    })
    assert.equal(plan.dueInHours, 2)
  })
})
