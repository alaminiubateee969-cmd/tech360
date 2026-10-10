/**
 * Unified-inbox triage signal (AiPraktor-inspired "needs reply").
 *
 * `lastSender` on ChatConversation is denormalized exactly like
 * lastMessageAt / lastMessagePreview: every message writer must keep it in
 * sync, the admin list API must expose it, and the inbox must surface a
 * "needs reply" badge when the visitor has the last word in an open thread.
 * These checks pin all three invariants so the signal cannot silently rot.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const SCHEMA = read('prisma/schema.prisma')
const WRITERS = [
  'src/app/api/chat/message/route.ts',
  'src/app/api/admin/conversations/[id]/route.ts',
]
const LIST_API = read('src/app/api/admin/conversations/route.ts')
const INBOX = read('src/components/admin/ConversationsView.tsx')

describe('chat triage signal', () => {
  it('schema carries lastSender on ChatConversation', () => {
    const model = SCHEMA.split('model ChatConversation')[1]?.split('}')[0] ?? ''
    assert.match(model, /lastSender\s+String\?/)
  })

  it('visitor send sets lastSender VISITOR alongside the other denormalized fields', () => {
    const src = read(WRITERS[0])
    assert.match(src, /lastSender:\s*'VISITOR'/)
    // stays in the same update as lastMessagePreview — one write, not two
    const update = src.split('chatConversation.update')[1] ?? ''
    assert.match(update.slice(0, 700), /lastMessagePreview[\s\S]*lastSender:\s*'VISITOR'/)
  })

  for (const writer of WRITERS.slice(1)) {
    it(`${writer} keeps lastSender in sync for admin + system writes`, () => {
      const src = read(writer)
      const adminReply = src.split("sender: 'ADMIN'")[1]?.slice(0, 800) ?? ''
      assert.match(adminReply, /lastSender:\s*'ADMIN'/, 'admin reply must set lastSender ADMIN')
      const systemNotes = src.match(/lastSender:\s*'SYSTEM'/g) ?? []
      assert.ok(systemNotes.length >= 2, 'close + reopen system notes must both set lastSender SYSTEM')
    })
  }

  it('admin list API exposes lastSender to the inbox', () => {
    assert.match(LIST_API, /lastSender:\s*c\.lastSender/)
  })

  it('inbox flags open threads whose last word is the visitor', () => {
    assert.match(INBOX, /lastSender === 'VISITOR'/)
    assert.match(INBOX, /needs reply/)
    // badge only on OPEN threads — closed ones are done regardless of sender
    assert.match(INBOX, /c\.status === 'OPEN' && c\.lastSender === 'VISITOR'/)
  })

  it('inbox type includes the triage field', () => {
    assert.match(INBOX, /lastSender:\s*'VISITOR' \| 'ADMIN' \| 'SYSTEM' \| null/)
  })
})
