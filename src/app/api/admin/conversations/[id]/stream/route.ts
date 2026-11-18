import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { tenantOf } from '@/lib/tenancy'
import { getConversationForTenant } from '@/lib/webchat/inbox-service'
import { operatorDelta, SSE_HEADERS, sseStream } from '@/lib/webchat/thread'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ADMIN — Server-Sent Events for one conversation thread (tenant-scoped).
// Streams new messages (incl. internal notes), visitor typing, delivery receipts
// and state changes. Ends after ~55s; EventSource reconnects automatically.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'crm.read' })
  if (isResponse(g)) return g
  const { id } = await params
  const conversation = await getConversationForTenant(sanitizeText(id, 40), tenantOf(g.user as typeof g.user & { tenantId?: string }))
  if (!conversation) return Response.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
  const url = new URL(req.url)
  let lastId: string | null = sanitizeText(url.searchParams.get('after') ?? req.headers.get('last-event-id') ?? '', 40) || null
  let lastStatus = ''
  let lastTyping = false
  let lastReceipts = ''
  const body = sseStream(req.signal, async (send) => {
    const delta = await operatorDelta(conversation.id, lastId)
    if (!delta) { send('gone', {}); return false }
    if (delta.messages.length) {
      lastId = delta.messages[delta.messages.length - 1].id
      send('messages', { messages: delta.messages, lastId })
    }
    const status = JSON.stringify(delta.conversation)
    if (status !== lastStatus) { lastStatus = status; send('status', delta.conversation) }
    if (delta.typing.active !== lastTyping) { lastTyping = delta.typing.active; send('typing', delta.typing) }
    const receipts = JSON.stringify(delta.receipts)
    if (receipts !== lastReceipts) { lastReceipts = receipts; send('receipts', { receipts: delta.receipts }) }
    return true
  })
  return new Response(body, { headers: SSE_HEADERS })
}
