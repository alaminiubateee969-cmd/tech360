/**
 * TECH360 — 10-point AI agent rule engine.
 *
 * Each rule is exercised on its own so a regression names the exact rule that
 * broke, and the composition is checked to fail closed.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AI_AGENT_RULES,
  REQUIRED_SAVE_FIELDS,
  agentContentIsSendable,
  evaluateAgentContent,
} from '../src/lib/ai-agent-rule-engine'

const okRecord = {
  clientId: 'TECH-2026-000101',
  direction: 'OUTBOUND',
  channel: 'EMAIL',
  body: 'Thanks for your enquiry.',
  status: 'SENT',
  createdAt: '2026-11-09T10:00:00.000Z',
}

describe('the rule engine publishes exactly ten rules', () => {
  it('numbers the rules 1..10 with unique ids', () => {
    assert.equal(AI_AGENT_RULES.length, 10)
    assert.deepEqual(
      AI_AGENT_RULES.map((r) => r.number),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    )
    assert.equal(new Set(AI_AGENT_RULES.map((r) => r.id)).size, 10)
    for (const rule of AI_AGENT_RULES) {
      assert.ok(rule.title.length > 8)
      assert.ok(rule.summary.length > 20)
    }
  })
})

describe('a clean auto-send message is allowed', () => {
  it('passes every rule', () => {
    const result = evaluateAgentContent(
      { body: 'Thanks for reaching out to TECH360. Could you confirm which services you need?', stage: 'FIRST_MESSAGE' },
      okRecord,
    )
    assert.equal(result.decision, 'allow')
    assert.equal(result.allowed, true)
    assert.deepEqual(result.failedRules, [])
    assert.equal(result.gate, 'AUTO_SEND')
    assert.equal(result.results.length, 10)
  })
})

describe('rule 1 — AI disclosure is blocked', () => {
  for (const body of [
    'Our AI assistant will answer shortly.',
    'This project is delivered by our AI workforce.',
    'An AI agent wrote this message for you.',
    'AI agents answer every enquiry within a minute.',
  ]) {
    it(`blocks: ${body}`, () => {
      const result = evaluateAgentContent({ body, stage: 'FIRST_MESSAGE' })
      assert.equal(result.decision, 'block')
      assert.ok(result.failedRules.includes(1))
    })
  }

  it('still allows the purchasable client-service wording', () => {
    const result = evaluateAgentContent({
      body: 'We build AI Agent Systems for clients who need their own supervised agents.',
      stage: 'FIRST_MESSAGE',
    })
    assert.equal(result.decision, 'allow')
  })
})

describe('rule 2 — gated categories require a recorded approval', () => {
  it('holds the final scope without approval', () => {
    const result = evaluateAgentContent({ body: 'Final scope attached.', stage: 'FINAL_SCOPE_APPROVED' })
    assert.equal(result.decision, 'hold-for-approval')
    assert.ok(result.failedRules.includes(2))
  })

  it('passes the final scope once approved', () => {
    const result = evaluateAgentContent({
      body: 'Final scope attached.',
      stage: 'FINAL_SCOPE_APPROVED',
      adminApproved: true,
    })
    assert.equal(result.decision, 'allow')
  })

  it('fails closed for an unknown stage', () => {
    const result = evaluateAgentContent({ body: 'Hello.', stage: 'NOT_A_REAL_STAGE' })
    assert.equal(result.decision, 'hold-for-approval')
  })
})

describe('rule 3 — phone numbers are blocked', () => {
  it('blocks an international number', () => {
    const result = evaluateAgentContent({ body: 'Call us on +1 816 380 8660 today.', stage: 'FIRST_MESSAGE' })
    assert.equal(result.decision, 'block')
    assert.ok(result.failedRules.includes(3))
  })
})

describe('rule 4 — an amount is a payment instruction', () => {
  it('holds a message that quotes a price', () => {
    const result = evaluateAgentContent({ body: 'The milestone is $4,200 due on delivery.', stage: 'PAYMENT_RECEIVED' })
    assert.equal(result.decision, 'hold-for-approval')
    assert.ok(result.failedRules.includes(4))
  })
})

describe('rule 5 — source code only after verified payment', () => {
  it('blocks handover content before payment is verified', () => {
    const result = evaluateAgentContent({
      body: 'Here is the source code download link.',
      category: 'SOURCE_CODE_HANDOVER',
      paymentVerified: false,
      adminApproved: true,
    })
    assert.equal(result.decision, 'block')
    assert.ok(result.failedRules.includes(5))
  })

  it('still needs approval after payment is verified', () => {
    const result = evaluateAgentContent({
      body: 'Here is the source code download link.',
      category: 'SOURCE_CODE_HANDOVER',
      paymentVerified: true,
    })
    assert.equal(result.decision, 'hold-for-approval')
    assert.ok(result.failedRules.includes(5))
  })

  it('allows a verified, approved handover', () => {
    const result = evaluateAgentContent({
      body: 'Here is the source code download link.',
      category: 'SOURCE_CODE_HANDOVER',
      paymentVerified: true,
      adminApproved: true,
    })
    assert.equal(result.decision, 'allow')
  })
})

describe('rule 6 — no preview claim outside the agreed scope', () => {
  it('blocks a preview claim when the scope has no preview', () => {
    const result = evaluateAgentContent({
      body: 'Your HTML preview is ready for review.',
      stage: 'HTML_PREVIEW_SENT',
      previewInScope: false,
      adminApproved: true,
    })
    assert.equal(result.decision, 'block')
    assert.ok(result.failedRules.includes(6))
  })
})

describe('rule 7 — the CRM save contract', () => {
  it('blocks a record missing required fields', () => {
    const result = evaluateAgentContent(
      { body: 'Thanks for your enquiry.', stage: 'FIRST_MESSAGE' },
      { clientId: 'TECH-2026-000101', direction: 'OUTBOUND' },
    )
    assert.equal(result.decision, 'block')
    assert.ok(result.failedRules.includes(7))
  })

  it('names the fields it needs', () => {
    assert.deepEqual([...REQUIRED_SAVE_FIELDS], [
      'clientId', 'direction', 'channel', 'body', 'status', 'createdAt',
    ])
  })
})

describe('rule 8 — marketing needs explicit consent', () => {
  it('blocks marketing without consent', () => {
    const result = evaluateAgentContent({ body: 'Our November newsletter is out.', marketing: true })
    assert.equal(result.decision, 'block')
    assert.ok(result.failedRules.includes(8))
  })

  it('allows marketing with consent', () => {
    const result = evaluateAgentContent({
      body: 'Our November newsletter is out.',
      marketing: true,
      marketingConsent: true,
    })
    assert.equal(result.decision, 'allow')
  })
})

describe('rule 9 — secrets are blocked', () => {
  for (const body of [
    'DATABASE_URL=mysql://root:secret@localhost/db',
    'Authorization: Bearer abcdefghijklmnop1234',
    ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join(''),
    'SELECT * FROM Client',
  ]) {
    it(`blocks: ${body.slice(0, 32)}`, () => {
      const result = evaluateAgentContent({ body, stage: 'FIRST_MESSAGE' })
      assert.equal(result.decision, 'block')
      assert.ok(result.failedRules.includes(9))
    })
  }
})

describe('rule 10 — another client’s record is blocked', () => {
  it('blocks a foreign Client ID', () => {
    const result = evaluateAgentContent({
      body: 'Your project is linked to TECH-2026-000999.',
      stage: 'FIRST_MESSAGE',
      clientId: 'TECH-2026-000101',
    })
    assert.equal(result.decision, 'block')
    assert.ok(result.failedRules.includes(10))
  })

  it('allows the recipient’s own Client ID', () => {
    const result = evaluateAgentContent({
      body: 'Your project is linked to TECH-2026-000101.',
      stage: 'FIRST_MESSAGE',
      clientId: 'TECH-2026-000101',
    })
    assert.equal(result.decision, 'allow')
  })

  it('blocks a Client ID when the recipient is unknown', () => {
    const result = evaluateAgentContent({ body: 'Reference TECH-2026-000101.', stage: 'FIRST_MESSAGE' })
    assert.equal(result.decision, 'block')
  })
})

describe('composition fails closed', () => {
  it('a block outranks an approval', () => {
    const result = evaluateAgentContent({
      body: 'Our AI assistant released the source code download link for $9,999. Call +1 816 380 8660 or check TECH-2026-000999.',
      stage: 'FINAL_SCOPE_APPROVED',
      adminApproved: false,
      paymentVerified: true,
      clientId: 'TECH-2026-000101',
    })
    assert.equal(result.decision, 'block')
    assert.deepEqual([...result.failedRules].sort((a, b) => a - b), [1, 2, 3, 4, 10])
    assert.ok(result.blockers.every((b) => b.startsWith('Rule ')))
  })

  it('the boolean helper agrees with the decision', () => {
    const clean = { body: 'Thanks for reaching out.', stage: 'FIRST_MESSAGE' }
    assert.equal(agentContentIsSendable(clean), true)
    assert.equal(agentContentIsSendable({ body: 'Our AI agent replied.', stage: 'FIRST_MESSAGE' }), false)
  })
})
