import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { tenantOf } from '@/lib/tenancy'
import { getConversationForTenant } from '@/lib/webchat/inbox-service'
import { serveChatAttachment } from '@/lib/webchat/attachments'

export const dynamic = 'force-dynamic'

// ADMIN — download a conversation attachment (tenant-scoped, hardened headers).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'crm.read' })
  if (isResponse(g)) return g
  const { id, fileId } = await params
  const conversation = await getConversationForTenant(sanitizeText(id, 40), tenantOf(g.user as typeof g.user & { tenantId?: string }))
  if (!conversation) return Response.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
  const res = await serveChatAttachment(sanitizeText(fileId, 40), conversation.id)
  return res ?? Response.json({ error: 'File not found', code: 'NOT_FOUND' }, { status: 404 })
}
