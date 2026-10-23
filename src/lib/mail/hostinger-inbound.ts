// ============================================================
// TECH360 — Hostinger inbox synchronization (SERVER-ONLY)
//
// Reads INBOX messages through the documented search and text endpoints,
// stores each new message once as an inbound Communication, and keeps a
// checkpoint. Nothing is deleted, moved or re-flagged by this code.
//
// Guarantees:
//   - Each message is claimed in InboundWebhookReceipt (provider HOSTMAIL)
//     before it is stored, so concurrent syncs or webhook deliveries cannot
//     both insert it.
//   - Before inserting, the existing Communication for the same
//     providerMessageId is looked up, so a crash between insert and receipt
//     completion cannot create a second row on retry.
//   - The checkpoint only advances over a contiguous prefix of successes
//     (messages are processed oldest first). A failure leaves the failing UID
//     for the next run.
//   - Customer association uses an exact sender-address match on the CRM
//     client's email only. Display names are never used.
// ============================================================

import { db } from '@/lib/db'
import { claimInboundWebhookEvent, finishInboundWebhookEvent } from '@/lib/identity-resolver'
import type { HostingerMailClient, HostingerInboxSummary } from './hostinger-mail'
import { readHostingerMailConfig } from './hostinger-config'
import { createHostingerMailClient } from './hostinger-mail'
import {
  EMPTY_CHECKPOINT,
  htmlToPlainText,
  inboundMessageDedupKey,
  normalizeSenderAddress,
  parseCheckpoint,
  selectNewUids,
  type InboxCheckpoint,
} from './hostinger-inbound-policy'

export const HOSTINGER_CHECKPOINT_SETTING = 'hostinger_mail.inbox_checkpoint'
const PROVIDER = 'HOSTMAIL'
const PAGE_SIZE = 50

export type InboundSyncOptions = {
  maxPages?: number
  maxMessages?: number
}

export type InboundSyncSummary = {
  stopped: 'COMPLETE' | 'BUDGET' | 'BUSY' | 'ERROR' | 'NOT_CONFIGURED'
  scanned: number
  imported: number
  duplicates: number
  unmatched: number
  checkpointUid: number
  /** Safe, value-free reason when stopped on an error. */
  error?: string
}

export async function readInboundCheckpoint(): Promise<InboxCheckpoint> {
  const row = await db.setting.findUnique({ where: { key: HOSTINGER_CHECKPOINT_SETTING }, select: { value: true } })
  return parseCheckpoint(row?.value ?? null)
}

async function writeInboundCheckpoint(checkpoint: InboxCheckpoint): Promise<void> {
  const value = JSON.stringify(checkpoint)
  await db.setting.upsert({
    where: { key: HOSTINGER_CHECKPOINT_SETTING },
    create: { key: HOSTINGER_CHECKPOINT_SETTING, value },
    update: { value },
  })
}

/** Resolve the one CRM client whose stored email equals the sender, or null. */
async function matchClientBySender(sender: string | null): Promise<{ id: string } | null> {
  if (!sender) return null
  return db.client.findFirst({
    where: { email: sender, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })
}

async function storeInboundMessage(input: {
  summary: HostingerInboxSummary
  body: string
  mailboxAddress: string
}): Promise<{ stored: boolean; matched: boolean }> {
  const providerMessageId = input.summary.messageId?.trim() || `hostmail-uid:${input.summary.uid}`
  const existing = await db.communication.findFirst({
    where: { providerMessageId, direction: 'IN' },
    select: { id: true },
  })
  if (existing) return { stored: false, matched: false }

  const sender = normalizeSenderAddress(input.summary.fromAddress)
  const client = await matchClientBySender(sender)
  await db.communication.create({
    data: {
      clientId: client?.id ?? null,
      channel: 'EMAIL',
      direction: 'IN',
      sender,
      recipient: input.mailboxAddress,
      subject: input.summary.subject.slice(0, 500) || null,
      body: input.body.slice(0, 8000),
      providerMessageId,
      status: 'RECEIVED',
      metadata: JSON.stringify({ source: 'HOSTINGER_MAIL_API', orphan: !client, uid: input.summary.uid }),
    },
  })
  return { stored: true, matched: Boolean(client) }
}

/**
 * Run one bounded, checkpointed inbox sync. Returns a summary. Never throws
 * for provider or data errors: they are recorded in the checkpoint and
 * reported in the summary.
 */
export async function syncHostingerInbox(options: InboundSyncOptions = {}, client?: HostingerMailClient): Promise<InboundSyncSummary> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 3, 20))
  const maxMessages = Math.max(1, Math.min(options.maxMessages ?? 25, 200))

  const status = readHostingerMailConfig()
  if (status.state !== 'CONFIGURED') {
    return { stopped: 'NOT_CONFIGURED', scanned: 0, imported: 0, duplicates: 0, unmatched: 0, checkpointUid: 0, error: 'Hostinger Mail API is not configured.' }
  }
  const mailClient = client ?? createHostingerMailClient(status.config)
  const mailboxAddress = status.config.fromAddress

  const checkpoint = await readInboundCheckpoint()
  const start = { ...(checkpoint ?? EMPTY_CHECKPOINT) }
  let lastUid = start.lastUid
  let scanned = 0
  let imported = 0
  let duplicates = 0
  let unmatched = 0
  let stopped: InboundSyncSummary['stopped'] = 'COMPLETE'
  let error: string | undefined
  let processed = 0

  try {
    let page = 1
    let totalPages = 1
    pageLoop: do {
      const result = await mailClient.searchInbox({ uidFrom: lastUid + 1, page, perPage: PAGE_SIZE })
      totalPages = result.totalPages
      const fresh = selectNewUids(result.items, lastUid)
      scanned += result.items.length

      for (const summary of fresh) {
        if (processed >= maxMessages) {
          stopped = 'BUDGET'
          break pageLoop
        }
        processed += 1

        const dedupKey = inboundMessageDedupKey(summary.messageId, summary.uid)
        const claim = await claimInboundWebhookEvent({ provider: PROVIDER, providerEventId: dedupKey, eventType: 'INBOUND_MESSAGE' })
        if (!claim.claimed || !claim.receiptId || !claim.claimToken) {
          // Another worker holds or has finished this message. Advance only when
          // the row is already stored; otherwise stop so a crashed worker's message
          // is never skipped by the checkpoint.
          const alreadyStored = await db.communication.findFirst({
            where: { providerMessageId: summary.messageId?.trim() || `hostmail-uid:${summary.uid}`, direction: 'IN' },
            select: { id: true },
          })
          if (!alreadyStored) {
            stopped = 'BUSY'
            break pageLoop
          }
          duplicates += 1
          lastUid = summary.uid
          continue
        }

        try {
          const text = await mailClient.getInboxMessageText(summary.uid)
          const body = text.text.trim() || htmlToPlainText(text.html)
          const stored = await storeInboundMessage({ summary, body, mailboxAddress })
          if (!stored.stored) duplicates += 1
          else {
            imported += 1
            if (!stored.matched) unmatched += 1
          }
          await finishInboundWebhookEvent({
            receiptId: claim.receiptId,
            claimToken: claim.claimToken,
            success: true,
            clientId: null,
          })
          lastUid = summary.uid
        } catch (messageError) {
          const failure = describeSyncFailure(messageError)
          await finishInboundWebhookEvent({
            receiptId: claim.receiptId,
            claimToken: claim.claimToken,
            success: false,
            errorCode: failure.code,
          }).catch(() => false)
          stopped = 'ERROR'
          error = failure.message
          break pageLoop
        }
      }

      page += 1
    } while (page <= totalPages)
  } catch (syncError) {
    const failure = describeSyncFailure(syncError)
    stopped = 'ERROR'
    error = failure.message
  }

  const now = new Date().toISOString()
  const next: InboxCheckpoint = {
    lastUid,
    lastRunAt: now,
    lastSuccessAt: stopped === 'ERROR' ? start.lastSuccessAt : now,
    lastError: stopped === 'ERROR' ? error ?? 'Unknown sync error' : null,
    lastImported: imported,
  }
  await writeInboundCheckpoint(next).catch(() => null)

  return { stopped, scanned, imported, duplicates, unmatched, checkpointUid: lastUid, ...(error ? { error } : {}) }
}

/** Map an error to a safe message and code. Never includes message content or credentials. */
export function describeSyncFailure(error: unknown): { code: string; message: string } {
  const e = (error ?? {}) as { response?: { status?: unknown }; code?: unknown }
  const status = typeof e.response?.status === 'number' ? e.response.status : undefined
  if (status === 429) return { code: 'RATE_LIMITED', message: 'Hostinger Mail API rate limit reached during inbox sync; the next run resumes from the checkpoint.' }
  if (status === 401 || status === 403) return { code: 'AUTH_REJECTED', message: 'Hostinger Mail API rejected the credentials for inbox sync (HTTP ' + status + ').' }
  if (status !== undefined && status >= 500) return { code: 'UPSTREAM_' + status, message: `Hostinger Mail API returned HTTP ${status} during inbox sync; the next run resumes from the checkpoint.` }
  if (typeof e.code === 'string') return { code: 'TRANSPORT', message: 'Could not reach the Hostinger Mail API during inbox sync.' }
  return { code: 'SYNC_FAILED', message: 'Inbox sync stopped on an unexpected error; details were not recorded to avoid exposing message content.' }
}
