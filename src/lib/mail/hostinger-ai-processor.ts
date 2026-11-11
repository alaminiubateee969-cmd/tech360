// ============================================================
// TECH360 — Hostinger Mail Inbound AI & CRM Lifecycle Processor
//
// Bridges newly synced Hostinger Mail API inbound messages for
// info@bdtech360.com into:
//   Incoming Email (persisted Communication)
//   → Bounce / Self / RFC 3834 Loop Protection
//   → CRM Identity Resolution or First-Contact Lead Creation (TECH-YYYY-NNNNNN)
//   → AI Classification & One-Question-at-a-Time Orchestration
//   → Approval Gate Enforcement (never auto-sends commercial/legal/handover)
//   → Email Delivery (sendCommunication)
//   → CRM & Conversation State Logging
//
// Idempotency:
//   Every message is fenced via `claimInboundWebhookEvent` (`HOSTINGER_AI`)
//   keyed by `Communication.providerMessageId` (or `Communication.id`), so
//   concurrent `/api/webhooks/hostinger-mail`, `/api/admin/mail/sync`, and
//   background `ops-loop` runs can never send duplicate replies.
// ============================================================

import { db } from '@/lib/db'
import { nextClientId } from '@/lib/ids'
import { sendCommunication, escapeHtml } from '@/lib/comms'
import { claimInboundWebhookEvent, finishInboundWebhookEvent } from '@/lib/identity-resolver'
import { recordInbound, recordOutbound, updateStage } from '@/lib/conversation-state'
import { handleCustomerMessage } from '@/lib/chat-orchestrator'
import { detectBusiness } from '@/lib/journey'
import { sendPipelineMessage } from '@/lib/pipeline/send'
import { audit, logError, sanitizeText } from '@/lib/security'
import { COMPANY } from '@/lib/constants'
import { classifyInboundEmailSafety } from './email-inbound-guard'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'

export interface HostingerAiProcessResult {
  processed: number
  leadsCreated: number
  aiReplied: number
  bouncesRecorded: number
  suppressedLoops: number
  skippedDuplicate: number
  failed: number
}

interface StoredHostingerMetadata {
  source?: string
  senderName?: string | null
  inReplyTo?: string | null
  receivedAt?: string | null
  aiProcessedAt?: string | null
}

function parseMeta(raw: string | null): StoredHostingerMetadata {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as StoredHostingerMetadata) : {}
  } catch {
    return {}
  }
}

export async function processHostingerInboundMessages(options?: {
  communicationIds?: string[]
  limit?: number
}): Promise<HostingerAiProcessResult> {
  const summary: HostingerAiProcessResult = {
    processed: 0,
    leadsCreated: 0,
    aiReplied: 0,
    bouncesRecorded: 0,
    suppressedLoops: 0,
    skippedDuplicate: 0,
    failed: 0,
  }

  const limit = Math.max(1, Math.min(options?.limit ?? 25, 50))
  const explicitIds = options?.communicationIds?.filter(Boolean) ?? []

  const candidates = explicitIds.length > 0
    ? await db.communication.findMany({
        where: {
          id: { in: explicitIds },
          channel: 'EMAIL',
          direction: 'IN',
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })
    : await db.communication.findMany({
        where: {
          channel: 'EMAIL',
          direction: 'IN',
          status: 'RECEIVED',
          metadata: { contains: 'HOSTINGER_MAIL_API' },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })

  for (const comm of candidates) {
    const meta = parseMeta(comm.metadata)
    if (meta.aiProcessedAt) {
      summary.skippedDuplicate += 1
      continue
    }

    const eventKey = (comm.providerMessageId || comm.id).slice(0, 170)
    let claim: Awaited<ReturnType<typeof claimInboundWebhookEvent>>
    try {
      claim = await claimInboundWebhookEvent({
        provider: 'HOSTINGER_AI',
        providerEventId: eventKey,
        eventType: 'EMAIL_AI',
      })
    } catch {
      summary.failed += 1
      continue
    }

    if (!claim.claimed || !claim.receiptId || !claim.claimToken) {
      summary.skippedDuplicate += 1
      continue
    }

    try {
      const fromEmail = (comm.sender ?? '').trim().toLowerCase()
      const cleanBody = redactSensitiveCrmData(sanitizeText(comm.body ?? '', 8000)).text
      const cleanSubject = sanitizeText(comm.subject ?? '(no subject)', 200)

      if (cleanBody !== comm.body) {
        await db.communication.update({
          where: { id: comm.id },
          data: { body: cleanBody },
        }).catch(() => null)
      }

      const safety = classifyInboundEmailSafety({
        fromEmail,
        subject: cleanSubject,
        body: cleanBody,
      })

      if (!safety.allowProcess) {
        if (safety.classification === 'BOUNCE_NOTIFICATION') {
          summary.bouncesRecorded += 1
          if (meta.inReplyTo) {
            await db.communication.updateMany({
              where: { providerMessageId: meta.inReplyTo, direction: 'OUT' },
              data: { status: 'FAILED', error: 'Bounce notification received from mail system' },
            }).catch(() => null)
          }
          await logError({
            source: 'EMAIL_AI',
            code: 'EMAIL_BOUNCE_RECEIVED',
            message: `Bounce notification recorded from ${fromEmail}: ${cleanSubject.slice(0, 120)}`,
            workflow: 'EMAIL_IN',
          })
        } else {
          summary.suppressedLoops += 1
          await audit({
            actor: 'mail:hostinger-ai',
            action: 'INBOUND_EMAIL_SUPPRESSED',
            entityType: 'Communication',
            entityId: comm.id,
            details: { classification: safety.classification, reason: safety.reason },
          })
        }

        await markCommunicationAiProcessed(comm.id, meta, safety.classification)
        await finishInboundWebhookEvent({
          receiptId: claim.receiptId,
          claimToken: claim.claimToken,
          success: true,
          clientId: comm.clientId,
        })
        summary.processed += 1
        continue
      }

      let clientRow = comm.clientId
        ? await db.client.findUnique({ where: { id: comm.clientId }, include: { lead: true } })
        : null

      if (!clientRow) {
        // Attempt deterministic thread correlation before creating a new lead:
        // 1. Exact Client.email match
        clientRow = await db.client.findFirst({
          where: { email: fromEmail, deletedAt: null, mergedIntoId: null },
          include: { lead: true },
        })

        // 2. In-Reply-To matching an existing Communication.providerMessageId
        if (!clientRow && meta.inReplyTo) {
          const parentComm = await db.communication.findFirst({
            where: { providerMessageId: meta.inReplyTo, clientId: { not: null } },
            select: { clientId: true },
          })
          if (parentComm?.clientId) {
            clientRow = await db.client.findUnique({
              where: { id: parentComm.clientId },
              include: { lead: true },
            })
          }
        }

        // 3. Canonical TECH-YYYY-NNNNNN Client ID in subject or body
        if (!clientRow) {
          const idMatch = `${cleanSubject} ${cleanBody}`.match(/\b(TECH-\d{4}-\d{6})\b/i)
          if (idMatch) {
            clientRow = await db.client.findUnique({
              where: { clientId: idMatch[1].toUpperCase() },
              include: { lead: true },
            })
          }
        }

        if (clientRow && !comm.clientId) {
          await db.communication.update({
            where: { id: comm.id },
            data: { clientId: clientRow.id },
          })
        }
      }

      // First-time prospective customer emailing info@bdtech360.com:
      // Create CRM Client + TECH-YYYY-NNNNNN + Lead, link the persisted
      // inbound Communication (without duplicating it), send Stage 1
      // acknowledgment, and run AI business detection.
      if (!clientRow) {
        const senderName = sanitizeText(meta.senderName ?? '', 120) || 'Email Contact'
        const allocatedClientId = await nextClientId()
        const createdClient = await db.client.create({
          data: {
            clientId: allocatedClientId,
            name: senderName,
            email: fromEmail,
            source: 'EMAIL',
            status: 'LEAD',
            pipelineStage: 'NEW',
            preferredContact: 'Email',
          },
        })
        await db.lead.upsert({
          where: { clientId: createdClient.id },
          create: {
            clientId: createdClient.id,
            requirements: cleanBody.slice(0, 4000),
            sourceDetails: 'HOSTINGER_MAIL_API',
          },
          update: { requirements: cleanBody.slice(0, 4000) },
        })
        await db.communication.update({
          where: { id: comm.id },
          data: { clientId: createdClient.id },
        })
        await recordInbound(createdClient.id, createdClient.clientId, cleanBody, 'EMAIL').catch(() => null)

        const welcome = await sendPipelineMessage({
          clientRowId: createdClient.id,
          stage: 'FIRST_MESSAGE',
          variables: {
            clientId: createdClient.clientId,
            clientName: createdClient.name,
            inquirySummary: cleanBody.slice(0, 1200),
            meetingLink: `${COMPANY.url}/#contact`,
          },
          channels: ['EMAIL'],
          agentCode: 'EML-012',
          nextPendingAction: 'Share your business type and main project goal',
          nextPendingActor: 'CLIENT',
          followUpStage: 'CONTACTED',
        })
        const welcomeAccepted = welcome.deliveries.some((d) => d.ok)
        if (welcomeAccepted) {
          await db.client.update({
            where: { id: createdClient.id },
            data: { pipelineStage: 'CONTACTED' },
          }).catch(() => null)
          summary.aiReplied += 1
        }
        const businessRun = await detectBusiness(createdClient.id, cleanBody, { advanceStage: welcomeAccepted }).catch(() => null)
        if (welcomeAccepted && businessRun?.ok && businessRun.json) {
          await updateStage(createdClient.id, createdClient.clientId, 'BUSINESS_IDENTIFIED').catch(() => null)
        }

        await audit({
          actor: 'mail:hostinger-ai',
          action: 'NEW_LEAD_FROM_HOSTINGER_EMAIL',
          clientId: createdClient.clientId,
          entityType: 'Communication',
          entityId: comm.id,
        })
        await markCommunicationAiProcessed(comm.id, meta, 'NEW_LEAD_WELCOME')
        await finishInboundWebhookEvent({
          receiptId: claim.receiptId,
          claimToken: claim.claimToken,
          success: true,
          clientId: createdClient.id,
        })
        summary.leadsCreated += 1
        summary.processed += 1
        continue
      }

      // Returning / matched customer email → unified AI orchestrator
      await recordInbound(clientRow.id, clientRow.clientId, cleanBody, 'EMAIL').catch(() => null)
      await audit({
        actor: 'mail:hostinger-ai',
        action: 'INBOUND_EMAIL_RECEIVED',
        clientId: clientRow.clientId,
        entityType: 'Communication',
        entityId: comm.id,
        details: { subject: cleanSubject.slice(0, 100) },
      })

      let convo = await db.chatConversation.findFirst({
        where: { anonId: `email:${fromEmail}`, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      })
      if (!convo) {
        convo = await db.chatConversation.create({
          data: {
            anonId: `email:${fromEmail}`,
            visitorName: clientRow.name,
            visitorEmail: fromEmail,
            clientId: clientRow.id,
            status: 'OPEN',
          },
        })
      }

      const aiOutcome = await handleCustomerMessage({
        channel: 'EMAIL',
        conversationId: convo.id,
        clientRowId: clientRow.id,
        clientId: clientRow.clientId,
        visitorBody: cleanBody,
        visitorName: clientRow.name,
        visitorEmail: fromEmail,
      })

      if (aiOutcome.ok && clientRow.email) {
        const replySubject = cleanSubject.toLowerCase().startsWith('re:')
          ? cleanSubject
          : `Re: ${cleanSubject} [${clientRow.clientId}]`
        const htmlBody = `<p>${escapeHtml(aiOutcome.reply).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p><p style="color:#64748b;font-size:12px;">Ref: ${escapeHtml(clientRow.clientId)}</p>`
        const sendRes = await sendCommunication({
          clientId: clientRow.id,
          channel: 'EMAIL',
          to: clientRow.email,
          subject: replySubject,
          body: htmlBody,
          storedBody: aiOutcome.reply,
          agentCode: aiOutcome.wasAiGenerated ? 'EML-012' : 'EMAIL-FALLBACK',
        })
        if (!sendRes.result.ok) {
          await logError({
            source: 'EMAIL_AI',
            code: `EMAIL_REPLY_${sendRes.result.status}`,
            message: sendRes.result.error ?? 'Outbound Hostinger email reply was not accepted',
            clientId: clientRow.clientId,
            workflow: 'EMAIL_IN',
          })
        } else {
          await recordOutbound(
            clientRow.id,
            clientRow.clientId,
            aiOutcome.reply,
            'EMAIL',
            clientRow.pipelineStage,
            aiOutcome.nextAction,
            aiOutcome.nextActor,
            aiOutcome.nextDueDate,
          ).catch(() => null)
          summary.aiReplied += 1
        }
      }

      await markCommunicationAiProcessed(comm.id, meta, aiOutcome.wasAiGenerated ? 'AI_REPLIED' : 'FALLBACK_OR_SUPPRESSED')
      await finishInboundWebhookEvent({
        receiptId: claim.receiptId,
        claimToken: claim.claimToken,
        success: true,
        clientId: clientRow.id,
      })
      summary.processed += 1
    } catch (error) {
      summary.failed += 1
      await finishInboundWebhookEvent({
        receiptId: claim.receiptId,
        claimToken: claim.claimToken,
        success: false,
        errorCode: error instanceof Error ? error.name : 'EMAIL_AI_FAILED',
      }).catch(() => false)
      await logError({
        source: 'EMAIL_AI',
        code: 'HOSTINGER_AI_PROCESS_FAILED',
        message: error instanceof Error ? error.message : 'Hostinger inbound AI processing failed',
        workflow: 'EMAIL_IN',
      }).catch(() => null)
    }
  }

  return summary
}

async function markCommunicationAiProcessed(
  commId: string,
  existingMeta: StoredHostingerMetadata,
  outcome: string,
): Promise<void> {
  const nextMeta = {
    ...existingMeta,
    aiProcessedAt: new Date().toISOString(),
    aiOutcome: outcome,
  }
  await db.communication.update({
    where: { id: commId },
    data: { metadata: JSON.stringify(nextMeta) },
  }).catch(() => null)
}
