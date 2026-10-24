import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { screenAiReply } from '../src/lib/ai-reply-guard'

const blocked: Array<[string, string]> = [
  ['a price with a dollar sign', 'Our starter website package is $500 for the first phase.'],
  ['a price with a currency code', 'The CRM build costs USD 1,200 in total.'],
  ['a Bangladeshi taka amount', 'Your automation setup is BDT 50000.'],
  ['a payment confirmation', 'Good news: your payment has been confirmed and the project starts today.'],
  ['a refund approval', 'Your refund was approved and will be issued this week.'],
  ['a contract approval', 'The contract is approved, so we can begin.'],
  ['a source code release', 'The source code has been sent to your inbox.'],
  ['a completion claim', 'Your website is completed and live now.'],
]

const allowed: string[] = [
  'Thank you for contacting Tech360. Our team will review your requirements.',
  'We will prepare a written quote after the scope review is complete.',
  'Pricing depends on scope; a team member will confirm the figures with you.',
  'Please share your business name and your main goal so we can plan the next step.',
  'Payment is only due after you approve the preview, under our Payment Policy.',
  'Refunds are reviewed by our team against the policy; we cannot promise one here.',
  'Your project plan is being prepared for your review.',
]

describe('AI reply output guard', () => {
  for (const [label, text] of blocked) {
    it(`withholds a reply containing ${label}`, () => {
      assert.equal(screenAiReply(text).ok, false)
    })
  }
  for (const text of allowed) {
    it(`allows ordinary wording: "${text.slice(0, 48)}…"`, () => {
      assert.deepEqual(screenAiReply(text), { ok: true })
    })
  }

  it('the chat orchestrator applies the screen before any AI reply is shown', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'src/lib/chat-orchestrator.ts'), 'utf8')
    assert.match(src, /screenAiReply\(aiResult\.output\)/)
    assert.match(src, /AI_REPLY_WITHHELD/)
  })
})
