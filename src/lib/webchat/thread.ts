// ============================================================
// TECH360 — thread reads shared by polling and SSE streaming
// ============================================================
import { db } from '@/lib/db'
import { isTypingFresh, toOperatorMessage, toVisitorMessage, VISITOR_VISIBLE_WHERE, type StoredChatMessage } from '@/lib/webchat/policy'
import { markDeliveredToVisitor } from '@/lib/webchat/inbox-service'

const MESSAGE_SELECT = {
  id: true, sender: true, body: true, agentEmail: true, kind: true, internal: true, aiGenerated: true,
  deliveryStatus: true, deliveredAt: true, readAt: true, attachmentId: true, attachmentName: true,
  attachmentMime: true, attachmentSize: true, createdAt: true,
} as const

/** Messages strictly after `afterId` in (createdAt, id) order. Visitor scope excludes notes at query level. */
export async function messagesAfter(conversationId: string, afterId: string | null, scope: 'VISITOR' | 'OPERATOR'): Promise<StoredChatMessage[]> {
  const visibility = scope === 'VISITOR' ? VISITOR_VISIBLE_WHERE : {}
  const anchor = afterId
    ? await db.chatMessage.findFirst({ where: { id: afterId, conversationId }, select: { id: true, createdAt: true } })
    : null
  // Apply BOTH parts of the ordering key before LIMIT, including when a
  // visitor's anchor is an internal note. Slicing a timestamp-only page in
  // memory stalls or drops ties as soon as an anchor falls outside that page.
  return db.chatMessage.findMany({
    where: {
      conversationId,
      ...visibility,
      ...(anchor ? { OR: [
        { createdAt: { gt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { gt: anchor.id } },
      ] } : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 300,
    select: MESSAGE_SELECT,
  })
}

/** Visitor delta: visible messages, delivery receipts and live status (agent typing etc.). */
export async function visitorDelta(conversationId: string, afterId: string | null) {
  const [conversation, rows] = await Promise.all([
    db.chatConversation.findUnique({ where: { id: conversationId } }),
    messagesAfter(conversationId, afterId, 'VISITOR'),
  ])
  if (!conversation) return null
  // The visitor's browser has now received these team/AI messages.
  const delivered = rows.filter((r) => r.sender !== 'VISITOR' && r.deliveryStatus === 'SENT').map((r) => r.id)
  if (delivered.length) {
    await markDeliveredToVisitor(conversationId, delivered)
    for (const r of rows) if (delivered.includes(r.id)) r.deliveryStatus = 'DELIVERED'
  }
  // Delivery state of the visitor's own recent messages (READ once a team member opened the thread).
  const ownReceipts = await db.chatMessage.findMany({
    where: { conversationId, sender: 'VISITOR' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, deliveryStatus: true },
  })
  return {
    conversation: {
      id: conversation.id,
      status: conversation.status as 'OPEN' | 'CLOSED',
      inboxState: conversation.inboxState,
      humanRequested: Boolean(conversation.humanRequestedAt),
      assigned: Boolean(conversation.assignedToId),
      closedBy: conversation.closedBy === 'VISITOR' ? 'VISITOR' : conversation.closedBy ? 'TEAM' : null,
    },
    typing: isTypingFresh(conversation.agentTypingAt) ? { active: true, name: 'TECH360 team' } : { active: false, name: null },
    messages: rows.map(toVisitorMessage),
    receipts: ownReceipts.map((r) => ({ id: r.id, deliveryStatus: r.deliveryStatus })),
  }
}

/** Operator delta: every message including notes, plus visitor typing. */
export async function operatorDelta(conversationId: string, afterId: string | null) {
  const [conversation, rows] = await Promise.all([
    db.chatConversation.findUnique({ where: { id: conversationId } }),
    messagesAfter(conversationId, afterId, 'OPERATOR'),
  ])
  if (!conversation) return null
  const receipts = await db.chatMessage.findMany({
    where: { conversationId, sender: { in: ['ADMIN', 'SYSTEM'] }, internal: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, deliveryStatus: true },
  })
  return {
    conversation: {
      id: conversation.id,
      status: conversation.status,
      inboxState: conversation.inboxState,
      priority: conversation.priority,
      assignedToId: conversation.assignedToId,
      assignedToEmail: conversation.assignedToEmail,
      team: conversation.team,
    },
    typing: isTypingFresh(conversation.visitorTypingAt) ? { active: true } : { active: false },
    messages: rows.map(toOperatorMessage),
    receipts,
  }
}

/** Build a Server-Sent Events stream that polls `tick` until the client disconnects or maxMs elapses. */
export function sseStream(signal: AbortSignal, tick: (send: (event: string, data: unknown, id?: string) => void) => Promise<boolean>, opts: { intervalMs?: number; maxMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 1500
  const maxMs = opts.maxMs ?? 55_000
  const encoder = new TextEncoder()
  let cancel = () => {}
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const started = Date.now()
      let closed = false
      let wake: (() => void) | null = null
      const close = (cancelled = false) => {
        if (closed) return
        closed = true
        signal.removeEventListener('abort', abort)
        wake?.()
        if (!cancelled) controller.close()
      }
      const abort = () => close()
      cancel = () => close(true)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) { close(); return }
      const send = (event: string, data: unknown, id?: string) => {
        if (closed) return
        // EventSource only sends Last-Event-ID when an actual id: field was
        // delivered. Strip frame delimiters even though message IDs are DB IDs.
        const cursor = id ? `id: ${id.replace(/[\r\n\0]/g, '')}\n` : ''
        controller.enqueue(encoder.encode(`${cursor}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      controller.enqueue(encoder.encode(`retry: 3000\n\n`))
      void (async () => {
        try {
          while (!closed && Date.now() - started < maxMs) {
            if (!await tick(send) || closed) break
            await new Promise<void>((resolve) => {
              const timer = setTimeout(() => { wake = null; resolve() }, intervalMs)
              wake = () => { clearTimeout(timer); wake = null; resolve() }
            })
          }
          send('reconnect', { afterMs: 0 })
        } catch {
          send('error', { code: 'STREAM_READ_FAILED' })
        } finally {
          close()
        }
      })()
    },
    cancel() { cancel() },
  })
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const
