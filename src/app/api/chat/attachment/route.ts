import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, clientIp, json, rateLimit, sanitizeText } from '@/lib/security'
import { isValidClientRequestId } from '@/lib/contact-policy'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'
import { resolveVisitorConversation, visitorBurstExceeded } from '@/lib/webchat/visitor-auth'
import { storeChatAttachment } from '@/lib/webchat/attachments'
import { CHAT_ATTACHMENT_MAX_BYTES, VISITOR_BURST_LIMIT, VISITOR_BURST_WINDOW_MS, toVisitorMessage } from '@/lib/webchat/policy'

export const dynamic = 'force-dynamic'

// PUBLIC — visitor uploads one image/PDF/text file into their OPEN conversation.
// multipart/form-data: anonId, requestId, file, caption?
// Signed session required; type allow-list + content scan; rejected bytes are never stored.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`chat-attachment:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return apiError('Too many uploads — please wait a moment.', 429, 'RATE_LIMITED')
  try {
    const length = Number(req.headers.get('content-length') ?? 0)
    if (length > CHAT_ATTACHMENT_MAX_BYTES + 64 * 1024) return apiError('Files must be 5 MB or smaller.', 413, 'ATTACHMENT_TOO_LARGE')
    const form = await req.formData().catch(() => null)
    if (!form) return apiError('Expected a multipart upload.', 400, 'BAD_UPLOAD')
    const requestId = sanitizeText(form.get('requestId'), 64)
    if (!isValidClientRequestId(requestId)) return apiError('A valid request id is required.', 400, 'BAD_REQUEST_ID')
    const resolved = await resolveVisitorConversation(req, form.get('anonId'), { requireOpen: true })
    if (resolved instanceof Response) return resolved
    const { conversation } = resolved

    const prior = await db.chatMessage.findUnique({ where: { clientRequestId: requestId } })
    if (prior) {
      if (prior.conversationId !== conversation.id) return apiError('This request id is already bound to another chat.', 409, 'REQUEST_ID_CONFLICT')
      return json({ message: toVisitorMessage(prior), duplicate: true })
    }
    if (await visitorBurstExceeded(conversation.id, VISITOR_BURST_LIMIT, VISITOR_BURST_WINDOW_MS)) {
      return apiError('You are sending messages too quickly — please wait a moment.', 429, 'RATE_LIMITED')
    }
    const file = form.get('file')
    if (!(file instanceof File)) return apiError('Choose a file to upload.', 400, 'FILE_REQUIRED')
    const bytes = Buffer.from(await file.arrayBuffer())
    const stored = await storeChatAttachment({
      bytes,
      declaredMime: file.type,
      filename: file.name,
      conversationId: conversation.id,
      clientRowId: conversation.clientId,
      uploadedBy: 'visitor',
    })
    if (!stored.ok) return apiError(stored.error, stored.status, stored.code)

    const caption = redactSensitiveCrmData(sanitizeText(form.get('caption'), 500)).text
    const message = await db.chatMessage.create({
      data: {
        conversationId: conversation.id,
        clientRequestId: requestId,
        sender: 'VISITOR',
        body: caption || `Shared a file: ${stored.attachment.name}`,
        attachmentId: stored.attachment.id,
        attachmentName: stored.attachment.name,
        attachmentMime: stored.attachment.mime,
        attachmentSize: stored.attachment.size,
      },
    })
    await db.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: message.body.slice(0, 120),
        lastSender: 'VISITOR',
        unreadCount: { increment: 1 },
        visitorTypingAt: null,
        ...(conversation.inboxState === 'RESOLVED' ? { inboxState: 'OPEN', resolvedAt: null, resolvedBy: null } : {}),
      },
    })
    if (conversation.clientId) {
      await db.communication.create({
        data: {
          clientId: conversation.clientId, channel: 'WEB', direction: 'IN', messageType: 'DOCUMENT',
          sender: conversation.visitorEmail || conversation.visitorName || conversation.anonId, recipient: 'TECH360 Live Chat',
          body: message.body, status: 'RECEIVED', providerMessageId: `chatmsg:${message.id}`,
          metadata: JSON.stringify({ conversationId: conversation.id, source: 'LIVE_CHAT', fileId: stored.attachment.id }),
        },
      }).catch(() => null)
    }
    return json({ message: toVisitorMessage(message), duplicate: false }, 201)
  } catch {
    return apiError('Upload failed — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
