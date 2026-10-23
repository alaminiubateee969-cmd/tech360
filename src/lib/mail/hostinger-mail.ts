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
  MessagesApi,
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

/** The narrow surface the rest of the application depends on. Tests substitute a fake. */
export type HostingerMailClient = {
  sendEmail(request: { to: string[]; subject: string; html?: string; text?: string; displayName?: string }): Promise<void>
  getCurrentAccount(): Promise<{ mailboxes: HostingerMailboxSummary[] }>
  searchInbox(args: { uidFrom: number; page: number; perPage: number }): Promise<{ items: HostingerInboxSummary[]; totalPages: number }>
  getInboxMessageText(uid: number): Promise<{ text: string; html: string }>
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
  const axiosOptions = { timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS }
  const mailbox = config.mailboxResourceId

  return {
    async sendEmail(request) {
      // The SDK's generated types mark every V1SendRequest field as required,
      // although the API reference marks cc/bcc/attachments/inReplyTo/forwardOf
      // as optional. Only the keys set below are present in the JSON body
      // (undefined keys are dropped on serialization), so the cast is limited
      // to that type-level difference.
      const payload = {
        to: request.to,
        subject: request.subject,
        ...(request.html !== undefined ? { html: request.html } : {}),
        ...(request.text !== undefined ? { text: request.text } : {}),
        ...(request.displayName ? { displayName: request.displayName } : {}),
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
