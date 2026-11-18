import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, sanitizeText } from '@/lib/security'
import { tenantOf } from '@/lib/tenancy'
import { getConversationForTenant } from '@/lib/webchat/inbox-service'
import { storeChatAttachment } from '@/lib/webchat/attachments'
import { CHAT_ATTACHMENT_MAX_BYTES } from '@/lib/webchat/policy'

export const dynamic = 'force-dynamic'

// ADMIN — upload a file to share in a conversation. Returns a file reference that
// the reply action attaches. Same allow-list and content scan as visitor uploads.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'comms.send', limit: { max: 20, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const { id } = await params
  const conversation = await getConversationForTenant(sanitizeText(id, 40), tenantOf(g.user as typeof g.user & { tenantId?: string }))
  if (!conversation) return Response.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
  if (Number(req.headers.get('content-length') ?? 0) > CHAT_ATTACHMENT_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: 'Files must be 5 MB or smaller.', code: 'ATTACHMENT_TOO_LARGE' }, { status: 413 })
  }
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'Choose a file to upload.', code: 'FILE_REQUIRED' }, { status: 400 })
  const stored = await storeChatAttachment({
    bytes: Buffer.from(await file.arrayBuffer()),
    declaredMime: file.type,
    filename: file.name,
    conversationId: conversation.id,
    clientRowId: conversation.clientId,
    uploadedBy: g.user.email,
  })
  if (!stored.ok) return Response.json({ error: stored.error, code: stored.code }, { status: stored.status })
  await audit({ actor: g.user.email, action: 'CHAT_ATTACHMENT_UPLOADED', userId: g.user.id, entityType: 'ChatConversation', entityId: conversation.id, details: { fileId: stored.attachment.id, mime: stored.attachment.mime, size: stored.attachment.size }, ip: g.ip })
  return Response.json({ ok: true, attachment: stored.attachment }, { status: 201 })
}
