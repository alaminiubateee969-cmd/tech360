import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { readHostingerMailConfig } from '@/lib/mail/hostinger-config'
import { createHostingerMailClient, HOSTINGER_INBOX_FOLDER } from '@/lib/mail/hostinger-mail'
import { authorizeMailCapability } from '@/lib/mail/hostinger-agentic'
import { decideRecipient } from '@/lib/mail/hostinger-agentic'
import { readMailLists } from '@/lib/mail/hostinger-lists'

export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Folders an operator may read. Anything outside the mailbox tree is refused. */
const ALLOWED_FOLDER = /^(INBOX|Sent|Drafts|Trash|Junk|Archive|Spam)(\/[\w .-]{1,64})?$/

/**
 * GET /api/admin/mail/mailbox?folder=INBOX&page=1
 *
 * Read-only mailbox inspection through the documented Hostinger Mail API:
 * folders, quota and one page of message metadata. It never returns message
 * bodies, attachments or any credential; a body is only readable through the
 * audited single-message action.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const status = readHostingerMailConfig()
  if (status.state !== 'CONFIGURED') {
    return json({
      ok: false,
      code: 'MAIL_NOT_CONFIGURED',
      state: status.state,
      problems: status.state === 'INVALID' ? status.problems : ['HOSTINGER_MAIL_ENABLED is not "true"'],
    }, 409)
  }

  const url = new URL(req.url)
  const folder = sanitizeText(url.searchParams.get('folder') ?? HOSTINGER_INBOX_FOLDER, 80)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  if (!ALLOWED_FOLDER.test(folder)) return json({ ok: false, error: 'Folder is not permitted.' }, 400)

  const client = createHostingerMailClient(status.config)
  try {
    const [folders, quota, page1] = await Promise.all([
      client.listFolders(),
      client.getQuota(),
      client.listMessages({ folder, page, perPage: 25 }),
    ])
    await audit({
      actor: `user:${g.user.email}`,
      action: 'MAILBOX_READ',
      userId: g.user.id,
      entityType: 'Mailbox',
      details: { folder, page, folders: folders.length, messages: page1.items.length },
    })
    return json({
      ok: true,
      mailbox: status.config.fromAddress,
      folder,
      page,
      totalPages: page1.totalPages,
      quota,
      folders: folders.slice(0, 200),
      messages: page1.items,
    })
  } catch {
    // A provider failure is reported as such; nothing is invented.
    return json({ ok: false, code: 'PROVIDER_ERROR', error: 'The mailbox could not be read from Hostinger.' }, 502)
  }
}

/**
 * POST /api/admin/mail/mailbox — audited mailbox operation.
 *
 * body: { action: 'move' | 'flags' | 'createFolder' | 'draft' | 'reply',
 *         folder?, uid?, targetFolder?, addFlags?, removeFlags?, name?,
 *         to?, subject?, body?, approvalId? }
 *
 * Every customer-facing action is gated: a reply or a new message requires a
 * decided ApprovalRequest (approvalId) — the backend decides, not the caller.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 32)
  const status = readHostingerMailConfig()
  if (status.state !== 'CONFIGURED') {
    return json({ ok: false, code: 'MAIL_NOT_CONFIGURED', state: status.state, problems: status.state === 'INVALID' ? status.problems : ['HOSTINGER_MAIL_ENABLED is not "true"'] }, 409)
  }
  const client = createHostingerMailClient(status.config)

  if (action === 'move') {
    const folder = sanitizeText(raw.folder, 80)
    const targetFolder = sanitizeText(raw.targetFolder, 80)
    const uid = Number(raw.uid)
    if (!ALLOWED_FOLDER.test(folder) || !ALLOWED_FOLDER.test(targetFolder) || !Number.isSafeInteger(uid) || uid <= 0) {
      return json({ ok: false, error: 'A valid source folder, target folder and UID are required.' }, 400)
    }
    const decision = authorizeMailCapability({ role: 'ADMIN_ASSISTANT', capability: 'mail.organize', approvalLevel: 1 })
    if (!decision.allowed) return json({ ok: false, code: decision.code, error: decision.reason }, 403)
    try {
      await client.moveMessage({ folder, uid, targetFolder })
    } catch {
      return json({ ok: false, code: 'PROVIDER_ERROR', error: 'The provider refused the move.' }, 502)
    }
    await audit({ actor: `user:${g.user.email}`, action: 'MAIL_MESSAGE_MOVED', userId: g.user.id, entityType: 'MailMessage', entityId: `${folder}:${uid}`, details: { targetFolder } })
    return json({ ok: true, message: `Message moved to ${targetFolder}.` })
  }

  if (action === 'flags') {
    const folder = sanitizeText(raw.folder, 80)
    const uid = Number(raw.uid)
    const addFlags = Array.isArray(raw.addFlags) ? raw.addFlags.filter((f: unknown): f is string => typeof f === 'string').slice(0, 8) : []
    const removeFlags = Array.isArray(raw.removeFlags) ? raw.removeFlags.filter((f: unknown): f is string => typeof f === 'string').slice(0, 8) : []
    if (!ALLOWED_FOLDER.test(folder) || !Number.isSafeInteger(uid) || uid <= 0 || (addFlags.length === 0 && removeFlags.length === 0)) {
      return json({ ok: false, error: 'A valid folder, UID and at least one flag change are required.' }, 400)
    }
    try {
      await client.setMessageFlags({ folder, uid, addFlags, removeFlags })
    } catch {
      return json({ ok: false, code: 'PROVIDER_ERROR', error: 'The provider refused the flag change.' }, 502)
    }
    await audit({ actor: `user:${g.user.email}`, action: 'MAIL_MESSAGE_FLAGS_CHANGED', userId: g.user.id, entityType: 'MailMessage', entityId: `${folder}:${uid}`, details: { addFlags, removeFlags } })
    return json({ ok: true, message: 'Flags updated.' })
  }

  if (action === 'createFolder') {
    const name = sanitizeText(raw.name, 64)
    if (!/^[\w .-]{1,64}$/.test(name)) return json({ ok: false, error: 'A folder name of letters, digits, spaces, dot, dash or underscore is required.' }, 400)
    try {
      const folders = await client.listFolders()
      // Idempotent: an existing folder is reported, never duplicated.
      const existing = folders.find((f) => f.path.toLowerCase() === name.toLowerCase() || f.name.toLowerCase() === name.toLowerCase())
      if (existing) return json({ ok: true, idempotent: true, folder: existing })
      const created = await client.createFolder(name)
      await audit({ actor: `user:${g.user.email}`, action: 'MAIL_FOLDER_CREATED', userId: g.user.id, entityType: 'MailFolder', entityId: created.path })
      return json({ ok: true, folder: created })
    } catch {
      return json({ ok: false, code: 'PROVIDER_ERROR', error: 'The provider refused folder creation.' }, 502)
    }
  }

  // Reply / new message: transmission itself is handled by the governed
  // pipeline (sendCommunication) with an approved template, not here.
  if (action === 'reply' || action === 'draft') {
    return json({
      ok: false,
      code: 'USE_GOVERNED_PIPELINE',
      error: 'Outbound mail is sent through the governed communication pipeline (approval → sendCommunication). Compose and approve it there.',
    }, 409)
  }

  return json({ ok: false, error: 'Unknown action.' }, 400)
}

/** Blocked-recipient preview: lets the admin composer show the decision before sending. */
export async function PUT(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const to = sanitizeText(raw.to, 320)
  const lists = await readMailLists()
  const decision = decideRecipient(to, lists)
  return json({ ok: true, decision })
}
