// REBUILD-A — demo data: clean test conversations + seed the Sarah Mitchell demo thread.
import { db } from '../src/lib/db'

async function main() {
  // 1) remove curl test conversations (test-qa-1 / test-qa-2)
  const testConvs = await db.chatConversation.findMany({
    where: { anonId: { in: ['test-qa-1', 'test-qa-2'] } },
    select: { id: true },
  })
  for (const c of testConvs) {
    await db.chatConversation.delete({ where: { id: c.id } })
  }
  console.log(`deleted ${testConvs.length} test conversation(s)`)

  // 2) remove the throwaway Client+Lead created by the convert-to-lead curl test
  const testClient = await db.client.findUnique({ where: { clientId: 'TECH-2026-000003' } })
  if (testClient) {
    await db.client.delete({ where: { id: testClient.id } }) // Lead cascades
    console.log('deleted test client TECH-2026-000003 (+ lead)')
  }

  // 3) seed the demo conversation (idempotent)
  const existing = await db.chatConversation.findFirst({ where: { anonId: 'demo-sarah-mitchell' } })
  if (existing) {
    console.log('demo conversation already present:', existing.id)
    return
  }
  const now = Date.now()
  const conv = await db.chatConversation.create({
    data: {
      anonId: 'demo-sarah-mitchell',
      status: 'OPEN',
      visitorName: 'Sarah Mitchell',
      visitorEmail: 'sarah@example.com',
      subject: 'Website redesign question',
      lastMessageAt: new Date(now - 2 * 60_000),
      unreadCount: 1,
      createdAt: new Date(now - 26 * 60_000),
    },
  })
  const seq = [
    { sender: 'VISITOR', body: "Hi! We're looking to redesign our company website — do you also handle ongoing maintenance?", at: now - 26 * 60_000 },
    { sender: 'ADMIN', agentEmail: 'admin@bdtech360.com', body: "Hi Sarah, absolutely — redesigns are our core work and every project ships with a maintenance option. What's your current site built on?", at: now - 19 * 60_000 },
    { sender: 'VISITOR', body: "It's on WordPress right now, and it's gotten slow over the years.", at: now - 2 * 60_000 },
  ]
  for (const m of seq) {
    await db.chatMessage.create({
      data: { conversationId: conv.id, sender: m.sender, body: m.body, agentEmail: m.agentEmail ?? null, createdAt: new Date(m.at) },
    })
  }
  await db.chatConversation.update({
    where: { id: conv.id },
    data: { lastMessagePreview: "It's on WordPress right now, and it's gotten slow over the years.", unreadCount: 1 },
  })
  console.log('demo conversation created:', conv.id, '(Sarah Mitchell, OPEN, 3 messages)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .then(() => process.exit(0))
