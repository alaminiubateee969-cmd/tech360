// ============================================================
// TECH360 — WebChat attachment storage + safe download
// ============================================================
import { db } from '@/lib/db'
import { DOCUMENT_SECURITY_HEADERS, isInlineSafeMime, normalizeUploadName, serializeScanResult } from '@/lib/files'
import { logError } from '@/lib/security'
import { validateChatAttachment } from '@/lib/webchat/policy'

export const CHAT_ATTACHMENT_RELATED_TYPE = 'CHAT_ATTACHMENT'

export type StoredAttachment = { id: string; name: string; mime: string; size: number }

export type StoreResult =
  | { ok: true; attachment: StoredAttachment }
  | { ok: false; status: number; code: string; error: string }

/** Validate and persist an uploaded chat file. Rejected bytes are never stored. */
export async function storeChatAttachment(input: {
  bytes: Buffer
  declaredMime: string
  filename: string
  conversationId: string
  clientRowId: string | null
  uploadedBy: string
}): Promise<StoreResult> {
  const verdict = validateChatAttachment(input.bytes, input.declaredMime, input.filename)
  if (!verdict.ok) {
    if (verdict.code === 'MALICIOUS') {
      await logError({ source: 'WEBCHAT', code: 'ATTACHMENT_REJECTED', message: `Conversation ${input.conversationId}: ${verdict.scan?.notes.join('; ') ?? verdict.reason}`.slice(0, 900) }).catch(() => null)
    }
    return { ok: false, status: verdict.code === 'TOO_LARGE' ? 413 : verdict.code === 'TYPE_NOT_ALLOWED' ? 415 : 422, code: `ATTACHMENT_${verdict.code}`, error: verdict.reason }
  }
  const name = normalizeUploadName(input.filename, `attachment.${verdict.ext}`)
  const row = await db.fileRecord.create({
    data: {
      filename: `chat-${verdict.scan.sha256.slice(0, 20)}.${verdict.ext}`,
      originalName: name,
      mimeType: verdict.mime,
      size: input.bytes.length,
      sha256: verdict.scan.sha256,
      classification: 'PRIVATE',
      scanStatus: 'CLEAN',
      scanResult: serializeScanResult(verdict.scan),
      content: new Uint8Array(input.bytes),
      clientId: input.clientRowId,
      relatedType: CHAT_ATTACHMENT_RELATED_TYPE,
      relatedId: input.conversationId,
      uploadedBy: input.uploadedBy,
    },
  })
  return { ok: true, attachment: { id: row.id, name, mime: verdict.mime, size: input.bytes.length } }
}

/** Serve an attachment that belongs to `conversationId` with hardened headers. */
export async function serveChatAttachment(fileId: string, conversationId: string): Promise<Response | null> {
  const file = await db.fileRecord.findUnique({ where: { id: fileId } })
  if (!file || file.relatedType !== CHAT_ATTACHMENT_RELATED_TYPE || file.relatedId !== conversationId || file.scanStatus !== 'CLEAN' || !file.content) return null
  const inline = isInlineSafeMime(file.mimeType)
  const safeName = file.originalName.replace(/[^\w.\- ]/g, '_')
  await db.fileRecord.update({ where: { id: file.id }, data: { downloads: { increment: 1 } } }).catch(() => null)
  return new Response(new Uint8Array(file.content), {
    status: 200,
    headers: {
      ...DOCUMENT_SECURITY_HEADERS,
      'Content-Type': inline ? file.mimeType : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
