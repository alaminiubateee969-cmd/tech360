// ============================================================
// TECH360 — Hostinger Mail API adapter (SERVER-ONLY)
//
// The ONLY module that imports `hostinger-mail-api-sdk`. Nothing in
// src/components or any client bundle may import this file, and no
// route returns the token or the raw SDK response.
//
// Verified SDK contract (hostinger-mail-api-sdk 1.19.6, API 1.2.2 per
// the SDK's generated header; the public reference page is v1.3.0):
//   - Client:   new Configuration({ accessToken, basePath })
//               → Bearer header "Authorization: Bearer <token>"
//   - Send:     SendApi.sendEmail(mailboxResourceId, V1SendRequest)
//               POST /api/v1/mailboxes/{id}/send → 204, NO message id.
//               The message is saved to INBOX.Sent by the provider.
//   - Account:  AccountApi.getCurrentAccount() → GET /api/v1/me
//               { orderResourceId, mailboxes: [{ resourceId, address }] }
//   - Messages: MessagesApi.searchMessages / getMessage / getMessageText
//               under /api/v1/mailboxes/{id}/folders/{folder}/messages
//   - Errors:   non-2xx bodies are { error, code, params }; the SDK
//               throws an axios error carrying response.status and
//               response.data.code.
//   - Limits:   HTTP 429 when rate limited. No retry-after header is
//               documented, so retries use the outbox backoff schedule.
//
// The SDK's send() does not expose a reply-to field, so replies go to
// the mailbox itself. HOSTINGER_MAIL_REPLY_TO is not used.
// ============================================================

import {
  AccountApi,
  Configuration,
  FoldersApi,
  MessagesApi,
  QuotaApi,
  WebhooksApi,
  SendApi,
  type V1FolderMessagesSearchRequest,
  type V1SendRequest,
} from 'hostinger-mail-api-sdk'
import { readHostingerMailConfig, type HostingerMailConfig } from './hostinger-config'
import { classifyHostingerSendFailure, hostingerFailureInputFromError, type HostingerSendClassification } from './hostinger-outcome'

export const HOSTINGER_INBOX_FOLDER = 'INBOX'
const DEFAULT_TIMEOUT_MS = 20_000

export type HostingerMailboxSummary = { resourceId: string; address: string }

export type HostingerInboxSummary = {
  uid: number
  messageId: string | null
  inReplyTo: string | null
  subject: string
  fromAddress: string | null
  date: string | null
}

export type HostingerInboxMessage = HostingerInboxSummary & {
  toAddresses: string[]
}

/** In-Reply-To / References target: the provider copies the source Message-Id. */
export type HostingerThreadRef = { uid: number; folder: string }

/** An attachment body is base64 on the wire (the SDK type documents it). */
export type HostingerOutboundAttachment = {
  filename: string
  contentBase64: string
  contentType?: string
  /** Set for inline images referenced as cid: URLs in the HTML body. */
  cid?: string
}

export type HostingerFolder = { path: string; name: string; specialUse: string | null; messageCount: number }

export type HostingerQuota = { supported: boolean; totalUsage: number; totalLimit: number; percentage: number }

export type HostingerWebhookSummary = {
  id: string
  name: string
  url: string
  events: string[]
  status: string
}

export type HostingerMessageSummary = {
  uid: number
  subject: string
  fromAddress: string | null
  date: string | null
  flags: string[]
  unseen: boolean
  size: number
}

/** The narrow surface the rest of the application depends on. Tests substitute a fake. */
export type HostingerMailClient = {
  sendEmail(request: {
    to: string[]
    subject: string
    html?: string
    text?: string
    displayName?: string
    attachments?: HostingerOutboundAttachment[]
    inReplyTo?: HostingerThreadRef
    forwardOf?: HostingerThreadRef
  }): Promise<void>
  getCurrentAccount(): Promise<{ mailboxes: HostingerMailboxSummary[] }>
  searchInbox(args: { uidFrom: number; page: number; perPage: number }): Promise<{ items: HostingerInboxSummary[]; totalPages: number }>
  getInboxMessageText(uid: number): Promise<{ text: string; html: string }>
  listFolders(): Promise<HostingerFolder[]>
  getQuota(): Promise<HostingerQuota>
  listMessages(args: { folder: string; page: number; perPage: number }): Promise<{ items: HostingerMessageSummary[]; totalPages: number }>
  getMessageAttachment(args: { folder: string; uid: number; attachmentId: string }): Promise<{ filename: string; contentType: string; base64: string }>
  moveMessage(args: { folder: string; uid: number; targetFolder: string }): Promise<void>
  setMessageFlags(args: { folder: string; uid: number; addFlags?: string[]; removeFlags?: string[] }): Promise<void>
  createFolder(name: string): Promise<{ path: string }>
  listWebhooks(): Promise<HostingerWebhookSummary[]>
}

export type HostingerClientOptions = {
  /** Override for tests (a local fake server). Production uses the SDK default. */
  basePath?: string
  timeoutMs?: number
}

/** Build the real SDK-backed client. The token is only ever placed in the SDK configuration. */
export function createHostingerMailClient(config: HostingerMailConfig, options: HostingerClientOptions = {}): HostingerMailClient {
  const configuration = new Configuration({
    accessToken: config.token,
    ...(options.basePath ? { basePath: options.basePath } : {}),
  })
  const sendApi = new SendApi(configuration)
  const accountApi = new AccountApi(configuration)
  const messagesApi = new MessagesApi(configuration)
  const foldersApi = new FoldersApi(configuration)
  const quotaApi = new QuotaApi(configuration)
  const webhooksApi = new WebhooksApi(configuration)
  const axiosOptions = { timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS }
  const mailbox = config.mailboxResourceId

  return {
    async sendEmail(request) {
      // The SDK's generated types mark every V1SendRequest field as required,
      // although the API reference marks cc/bcc/attachments/inReplyTo/forwardOf
      // as optional. Only the keys set below are present in the JSON body
      // (undefined keys are dropped on serialization), so the cast is limited
      // to that type-level difference.
      // Threading (inReplyTo/forwardOf) makes the provider copy the source
      // Message-Id into In-Reply-To/References and flag the source \\Answered,
      // so replies land in the customer's existing thread instead of starting a
      // new conversation. Mutually exclusive per the provider contract.
      if (request.inReplyTo && request.forwardOf) {
        throw new Error('inReplyTo and forwardOf are mutually exclusive')
      }
      const payload = {
        to: request.to,
        subject: request.subject,
        ...(request.html !== undefined ? { html: request.html } : {}),
        ...(request.text !== undefined ? { text: request.text } : {}),
        ...(request.displayName ? { displayName: request.displayName } : {}),
        ...(request.attachments?.length
          ? {
              attachments: request.attachments.map((a) => ({
                filename: a.filename,
                content: a.contentBase64,
                ...(a.contentType ? { contentType: a.contentType } : {}),
                ...(a.cid ? { cid: a.cid } : {}),
              })),
            }
          : {}),
        ...(request.inReplyTo ? { inReplyTo: { uid: request.inReplyTo.uid, folder: request.inReplyTo.folder } } : {}),
        ...(request.forwardOf ? { forwardOf: { uid: request.forwardOf.uid, folder: request.forwardOf.folder } } : {}),
      } as V1SendRequest
      await sendApi.sendEmail(mailbox, payload, axiosOptions)
    },

    async getCurrentAccount() {
      const response = await accountApi.getCurrentAccount(axiosOptions)
      const mailboxes = Array.isArray(response.data?.data?.mailboxes) ? response.data.data.mailboxes : []
      return {
        mailboxes: mailboxes.map((m) => ({ resourceId: String(m.resourceId), address: String(m.address).toLowerCase() })),
      }
    },

    async searchInbox({ uidFrom, page, perPage }) {
      // IMAP UID set "N:*" always returns at least the highest UID, so callers
      // must still filter by uid > checkpoint. Ascending order keeps the
      // checkpoint contiguous: an error mid-page never skips older messages.
      const response = await messagesApi.searchMessages(
        mailbox,
        HOSTINGER_INBOX_FOLDER,
        page,
        perPage,
        'uid',
        // Only `uid` is set; the other documented search fields are optional and
        // omitted from the JSON body (see the note in sendEmail).
        { uid: `${uidFrom}:*` } as V1FolderMessagesSearchRequest,
        axiosOptions,
      )
      const body = response.data
      const items = (body?.data ?? []).map((m) => ({
        uid: Number(m.uid),
        messageId: m.messageId || null,
        inReplyTo: m.inReplyTo || null,
        subject: String(m.subject ?? ''),
        fromAddress: m.from?.address ? String(m.from.address).toLowerCase() : null,
        date: m.date ?? null,
      }))
      return { items, totalPages: Number(body?.pagination?.totalPages ?? 1) }
    },

    async getInboxMessageText(uid) {
      const response = await messagesApi.getMessageText(mailbox, HOSTINGER_INBOX_FOLDER, uid, axiosOptions)
      return {
        text: String(response.data?.data?.text ?? ''),
        html: String(response.data?.data?.html ?? ''),
      }
    },

    async listFolders() {
      const response = await foldersApi.listFolders(mailbox, 1, 200, axiosOptions)
      const folders = Array.isArray(response.data?.data) ? response.data.data : []
      return folders.map((f) => ({
        path: String(f.path ?? ''),
        name: String(f.name ?? f.path ?? ''),
        specialUse: f.specialUse ? String(f.specialUse) : null,
        messageCount: Number(f.messageCount ?? 0),
      })).filter((f) => f.path.length > 0)
    },

    async getQuota() {
      const response = await quotaApi.getQuota(mailbox, axiosOptions)
      const data = response.data?.data
      const totalLimit = Number(data?.totalLimit ?? 0)
      const totalUsage = Number(data?.totalUsage ?? 0)
      return {
        supported: Boolean(data?.supported),
        totalUsage,
        totalLimit,
        percentage: Number(data?.totalPercentage ?? (totalLimit > 0 ? Math.round((totalUsage / totalLimit) * 100) : 0)),
      }
    },

    async listMessages({ folder, page, perPage }) {
      const response = await messagesApi.listMessages(mailbox, folder, page, perPage, 'uid', axiosOptions)
      const body = response.data
      const items = (body?.data ?? []).map((m) => ({
        uid: Number(m.uid),
        subject: String(m.subject ?? ''),
        fromAddress: m.from?.address ? String(m.from.address).toLowerCase() : null,
        date: m.date ?? null,
        flags: Array.isArray(m.flags) ? m.flags.map(String) : [],
        unseen: Boolean(m.unseen),
        size: Number(m.size ?? 0),
      }))
      return { items, totalPages: Number(body?.pagination?.totalPages ?? 1) }
    },

    async getMessageAttachment({ folder, uid, attachmentId }) {
      // Explicitly ask for bytes: without responseType the transport may
      // decode a binary body as text and corrupt the file.
      const response = await messagesApi.getMessageAttachment(mailbox, folder, uid, attachmentId, {
        ...axiosOptions,
        responseType: 'arraybuffer',
      })
      // The SDK declares `File`, but Node's axios transport may hand back a
      // Buffer, an ArrayBuffer or a Blob depending on the transform used. All
      // are accepted; anything else is refused instead of guessed.
      const file = response.data as unknown as {
        arrayBuffer?: () => Promise<ArrayBuffer>
        name?: string
        type?: string
      } | ArrayBuffer | Uint8Array | string
      let bytes: Buffer
      if (typeof file === 'string') bytes = Buffer.from(file, 'binary')
      else if (file instanceof ArrayBuffer) bytes = Buffer.from(file)
      else if (file instanceof Uint8Array) bytes = Buffer.from(file)
      else if (file && typeof file === 'object' && typeof file.arrayBuffer === 'function') {
        bytes = Buffer.from(await file.arrayBuffer())
      } else throw new Error('Attachment body unavailable')
      const meta = (file && typeof file === 'object' && !(file instanceof ArrayBuffer) && !(file instanceof Uint8Array) && typeof file !== 'string')
        ? (file as { name?: string; type?: string })
        : undefined
      // The provider returns the metadata as HTTP headers, not in the body.
      const headers = (response.headers ?? {}) as Record<string, unknown>
      const disposition = typeof headers['content-disposition'] === 'string' ? headers['content-disposition'] : ''
      const quoted = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
      const headerName = quoted?.[1] ? decodeURIComponent(quoted[1]).slice(0, 200) : undefined
      const headerType = typeof headers['content-type'] === 'string' ? headers['content-type'].split(';')[0] : undefined
      return {
        filename: String(meta?.name ?? headerName ?? attachmentId).slice(0, 200),
        contentType: String(meta?.type ?? headerType ?? 'application/octet-stream').slice(0, 120),
        base64: bytes.toString('base64'),
      }
    },

    async moveMessage({ folder, uid, targetFolder }) {
      await messagesApi.moveMessage(mailbox, folder, uid, { targetFolder }, axiosOptions)
    },

    async setMessageFlags({ folder, uid, addFlags, removeFlags }) {
      await messagesApi.patchMessage(
        mailbox,
        folder,
        uid,
        { addFlags: addFlags ?? [], removeFlags: removeFlags ?? [] },
        axiosOptions,
      )
    },

    async createFolder(name) {
      const response = await foldersApi.createFolder(mailbox, { name }, axiosOptions)
      const data = response.data?.data
      return { path: String(data?.path ?? name) }
    },

    async listWebhooks() {
      const response = await webhooksApi.listWebhooks(mailbox, undefined, 1, 100, axiosOptions)
      const hooks = Array.isArray(response.data?.data) ? response.data.data : []
      return hooks.map((h) => ({
        id: String(h.id ?? ''),
        name: String(h.name ?? ''),
        url: String(h.url ?? ''),
        events: Array.isArray(h.events) ? h.events.map(String) : [],
        status: String(h.status ?? 'unknown'),
      }))
    },
  }
}

// ------------------------------------------------------------
// Sending
// ------------------------------------------------------------

export type HostingerSendInput = {
  to: string
  subject: string
  html: string
  text: string
  /** Reply into an existing thread (provider copies Message-Id into In-Reply-To). */
  inReplyTo?: HostingerThreadRef
  attachments?: HostingerOutboundAttachment[]
}

export type HostingerSendResult = {
  ok: boolean
  /** SENT = provider accepted (204). Never implies delivery to the recipient. */
  status: 'SENT' | 'FAILED' | 'NOT_CONFIGURED'
  classification?: HostingerSendClassification
  error?: string
  /** Hostinger returns no message identifier on send; this is always absent. */
  providerMessageId?: undefined
}

const SIMPLE_EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/

export async function sendHostingerEmail(
  input: HostingerSendInput,
  deps: { client: HostingerMailClient; displayName?: string },
): Promise<HostingerSendResult> {
  const to = input.to.trim()
  if (!SIMPLE_EMAIL.test(to) || to.length > 320) {
    return { ok: false, status: 'FAILED', classification: 'REJECTED', error: 'Recipient is not a valid email address' }
  }
  try {
    await deps.client.sendEmail({
      to: [to],
      subject: input.subject.slice(0, 300),
      html: input.html,
      text: input.text,
      displayName: deps.displayName,
      ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    })
    return { ok: true, status: 'SENT', classification: 'ACCEPTED' }
  } catch (error) {
    // Transport-level failures happen after the request was handed to axios.
    const failure = classifyHostingerSendFailure(hostingerFailureInputFromError(error, true))
    return { ok: false, status: 'FAILED', classification: failure.classification, error: failure.error }
  }
}

// ------------------------------------------------------------
// Configuration verification (read-only)
// ------------------------------------------------------------

export type HostingerVerification =
  | { ok: true; mailboxAddress: string }
  | { ok: false; problems: string[] }

/**
 * Confirm the configured mailbox resource id exists for this token and that
 * the configured sender address is that mailbox. Read-only: calls GET /me.
 */
export async function verifyHostingerMailbox(config: HostingerMailConfig, client: HostingerMailClient): Promise<HostingerVerification> {
  let account: { mailboxes: HostingerMailboxSummary[] }
  try {
    account = await client.getCurrentAccount()
  } catch (error) {
    const failure = classifyHostingerSendFailure(hostingerFailureInputFromError(error, false))
    return { ok: false, problems: [failure.error.replace(/^AMBIGUOUS_PROVIDER_OUTCOME: /, '')] }
  }
  const mailbox = account.mailboxes.find((m) => m.resourceId === config.mailboxResourceId)
  if (!mailbox) {
    return { ok: false, problems: ['HOSTINGER_MAILBOX_RESOURCE_ID is not a mailbox this API token can manage'] }
  }
  if (mailbox.address !== config.fromAddress) {
    return { ok: false, problems: ['HOSTINGER_MAIL_FROM_ADDRESS does not match the address of the configured mailbox'] }
  }
  return { ok: true, mailboxAddress: mailbox.address }
}

/** Resolve the live configuration, or report why it cannot be used. Never returns the token. */
export function resolveHostingerMailConfig(env: Record<string, string | undefined> = process.env) {
  return readHostingerMailConfig(env)
}
