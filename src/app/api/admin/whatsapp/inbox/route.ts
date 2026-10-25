import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * WhatsApp inbox API foundation.
 *
 * Groups the existing communication ledger into contact threads, preserving
 * Tech360 Client IDs. The query is deliberately bounded until dedicated
 * WhatsApp conversation/assignment tables are introduced in a reviewed
 * migration. Access is guarded server-side; never rely on UI-only permissions.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const query = sanitizeText(url.searchParams.get('q') ?? '', 120)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const perPage = Math.min(100, Math.max(10, Number(url.searchParams.get('perPage') ?? 30) || 30))

  const where = {
    channel: 'WHATSAPP',
    ...(status && ['SENT', 'DELIVERED', 'READ', 'RECEIVED', 'FAILED', 'QUEUED', 'NOT_CONFIGURED'].includes(status)
      ? { status }
      : {}),
    ...(query
      ? {
          OR: [
            { body: { contains: query } },
            { sender: { contains: query } },
            { recipient: { contains: query } },
            { client: { name: { contains: query } } },
            { client: { clientId: { contains: query } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.communication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        clientId: true,
        channel: true,
        direction: true,
        recipient: true,
        sender: true,
        body: true,
        messageType: true,
        templateName: true,
        providerMessageId: true,
        status: true,
        error: true,
        metadata: true,
        createdAt: true,
        sentAt: true,
        client: { select: { id: true, clientId: true, name: true, whatsapp: true, phone: true } },
      },
    }),
    db.communication.count({ where }),
  ])

  // Thread identity prefers the internal Client row; unknown contacts fall
  // back to a normalized sender/recipient string without creating a new lead
  // as a side effect of viewing the inbox.
  const threads = new Map<string, {
    key: string
    client: typeof rows[number]['client']
    address: string
    messages: typeof rows
    lastInboundAt: Date | null
  }>()

  for (const row of rows) {
    const address = row.client?.whatsapp || row.client?.phone || row.sender || row.recipient || 'unknown'
    const key = row.clientId || address
    let thread = threads.get(key)
    if (!thread) {
      thread = { key, client: row.client, address, messages: [], lastInboundAt: null }
      threads.set(key, thread)
    }
    if (thread.messages.length < 30) thread.messages.push(row)
    if (row.direction === 'IN' && (!thread.lastInboundAt || row.createdAt > thread.lastInboundAt)) {
      thread.lastInboundAt = row.createdAt
    }
  }

  const now = Date.now()
  const allThreads = Array.from(threads.values()).map((thread) => {
    const expiresAt = thread.lastInboundAt
      ? new Date(thread.lastInboundAt.getTime() + 24 * 60 * 60 * 1000)
      : null
    const latest = thread.messages[0]
    return {
      id: thread.key,
      clientId: thread.client?.clientId ?? null,
      clientRowId: thread.client?.id ?? null,
      contactName: thread.client?.name ?? latest?.sender ?? latest?.recipient ?? 'Unknown WhatsApp contact',
      phone: thread.address,
      lastMessagePreview: latest?.body?.slice(0, 240) ?? '',
      lastMessageAt: latest?.createdAt ?? null,
      lastMessageDirection: latest?.direction ?? null,
      lastMessageStatus: latest?.status ?? null,
      lastInboundAt: thread.lastInboundAt,
      serviceWindowExpiresAt: expiresAt,
      canSendFreeform: Boolean(expiresAt && expiresAt.getTime() > now),
      messages: thread.messages,
    }
  }).sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime())

  const start = (page - 1) * perPage
  return Response.json({
    threads: allThreads.slice(start, start + perPage),
    page,
    perPage,
    total,
    threadCountInLoadedWindow: allThreads.length,
    note: 'Inbox foundation based on the existing communication ledger. Assignment, unread tracking, department walls and durable conversation records are planned in the next schema phase.',
  })
}
