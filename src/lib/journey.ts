import { db } from '@/lib/db'
import { nextClientId, nextProjectCode, nextInvoiceNumber, publicToken } from '@/lib/ids'
import { runAgent, rememberMemory } from '@/lib/agents/engine'
import { sendCommunication, emailTemplate, escapeHtml } from '@/lib/comms'
import { newCorrelationId, logError, audit, sanitizeText } from '@/lib/security'
import { PIPELINE_STAGES, COMPANY } from '@/lib/constants'
import { PAD_CSS, padHeader, padMeta, padFooter, padSignatures, docDate } from '@/lib/letterhead'
import { evaluateDeliveryAcceptance, evaluateProjectClosure } from '@/lib/lifecycle-policy'
import { hasExplicitContactConsent, selectWelcomeChannel } from '@/lib/contact-policy'
import { hasAcceptedPreviewDelivery } from '@/lib/preview-policy'
import { createHandoverManifest, parseHandoverManifest, verifyHandoverArtifacts } from '@/lib/handover-artifacts'
import { normalizeIdentity, resolveOrCreateVerifiedClient, type VerifiedIdentityProof } from '@/lib/identity-resolver'
import { sendPipelineMessage, recordStageChange, type PipelineChannel } from '@/lib/pipeline/send'
import type { PipelineVariables } from '@/lib/pipeline/templates'
import { assertDeliveryRules, screenAiContent } from '@/lib/pipeline/rules'

// The booking link the client uses to take a scope-explaining call.
const MEETING_BOOKING_URL = process.env.MEETING_BOOKING_URL ?? `${COMPANY.url}/#contact`

/**
 * The pipeline variables for a client.
 *
 * Every message in the pipeline is built from this one shape, so a
 * message can never be composed with a missing client ID.
 */
function pipelineVars(client: {
  clientId: string
  name: string
  businessType?: string | null
  lead?: { interest?: string | null } | null
}, extra: Partial<PipelineVariables> = {}): PipelineVariables {
  return {
    clientId: client.clientId,
    clientName: client.name,
    businessType: client.businessType ?? null,
    recommendedPlan: client.lead?.interest ?? null,
    meetingLink: MEETING_BOOKING_URL,
    ...extra,
  }
}

// Tokenized preview links expire after this many days (env-overridable).
const PREVIEW_TTL_DAYS = Math.max(1, Number(process.env.PREVIEW_TTL_DAYS ?? 30) || 30)

// ============================================================
// FIRST MESSAGE → FINAL DELIVERY JOURNEY ENGINE
// Every step is persisted against the Client ID with automation
// logs, agent executions and audit entries.
// ============================================================

function stageIndex(stage: string): number {
  return PIPELINE_STAGES.indexOf(stage as (typeof PIPELINE_STAGES)[number])
}

async function setStage(clientId: string, stage: string, note: string) {
  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error('Client not found')
  // stage only moves forward (except explicit reopen actions)
  if (stageIndex(stage) > stageIndex(client.pipelineStage) || stage === 'CLOSED') {
    await db.client.update({
      where: { id: clientId },
      data: {
        pipelineStage: stage,
        status: stage === 'COMPLETED' || stage === 'CLOSED' ? 'CLOSED' : stageIndex(stage) >= 9 ? 'ACTIVE' : client.status === 'LEAD' && stageIndex(stage) >= 8 ? 'CLIENT' : client.status,
      },
    })
    // The status change and its timestamp are always saved in the CRM.
    await recordStageChange({
      clientRowId: clientId,
      clientId: client.clientId,
      from: client.pipelineStage,
      to: stage,
      note,
    }).catch(() => null)
    await db.automationLog.updateMany({ where: { clientId, status: 'RUNNING' }, data: { status: 'SUCCESS' } }).catch(() => null)
  }
}

async function startLog(workflow: string, trigger: string, clientId?: string, input?: unknown) {
  return db.automationLog.create({
    data: {
      workflow, trigger, correlationId: newCorrelationId(), clientId: clientId ?? null,
      input: input ? JSON.stringify(input).slice(0, 4000) : null, status: 'RUNNING',
      steps: JSON.stringify([]),
    },
  })
}

async function finishLog(id: string, status: 'SUCCESS' | 'FAILED' | 'AWAITING_APPROVAL', output?: unknown, error?: string) {
  const log = await db.automationLog.findUnique({ where: { id } })
  const steps = log?.steps ? (JSON.parse(log.steps) as unknown[]) : []
  return db.automationLog.update({
    where: { id },
    data: {
      status,
      output: output ? JSON.stringify(output).slice(0, 8000) : undefined,
      error: error?.slice(0, 2000),
      finishedAt: new Date(),
      durationMs: log ? Date.now() - new Date(log.startedAt).getTime() : undefined,
      steps: JSON.stringify(steps),
    },
  })
}

async function stepLog(id: string, step: string, detail: unknown) {
  const log = await db.automationLog.findUnique({ where: { id } })
  if (!log) return
  const steps = log.steps ? (JSON.parse(log.steps) as unknown[]) : []
  steps.push({ step, detail, at: new Date().toISOString() })
  await db.automationLog.update({ where: { id }, data: { steps: JSON.stringify(steps).slice(0, 12000) } })
}

// ------------------------------------------------------------
// STEP 1 — INTAKE: first message from any channel
// ------------------------------------------------------------
export async function intakeLead(input: {
  source: string
  name?: string
  businessName?: string
  businessType?: string
  email?: string
  phone?: string
  whatsapp?: string
  country?: string
  message: string
  projectType?: string
  budgetRange?: string
  preferredContact?: string
  contactConsent?: unknown
  providerMessageId?: string
  verifiedIdentities?: VerifiedIdentityProof[]
  tracking?: unknown
  formId?: string
}): Promise<{ clientId: string; clientRowId: string; logId: string }> {
  // Keep contact details out of automation-log inputs; the CRM stores the
  // minimum required record, while the log tracks only workflow metadata.
  const log = await startLog('LEAD_INTAKE', input.source, undefined, { source: input.source, providerEvent: Boolean(input.providerMessageId), hasFormId: Boolean(input.formId) })
  try {
    if (input.formId) {
      const priorSubmission = await db.formSubmission.findUnique({ where: { id: input.formId }, select: { clientId: true, status: true } })
      if (priorSubmission?.clientId) {
        const priorClient = await db.client.findUnique({ where: { id: priorSubmission.clientId } })
        if (priorSubmission.status === 'PROCESSED' && priorClient) {
          await finishLog(log.id, 'SUCCESS', { clientId: priorClient.clientId, idempotentReplay: true })
          return { clientId: priorClient.clientId, clientRowId: priorClient.id, logId: log.id }
        }
        throw new Error('This form submission is already processing or needs operator review; duplicate intake was refused.')
      }
    }

    const createData = {
      clientId: await nextClientId(),
      name: sanitizeText(input.name, 200) || 'Unknown Contact',
      businessName: sanitizeText(input.businessName, 200) || null,
      businessType: sanitizeText(input.businessType, 80) || null,
      email: sanitizeText(input.email, 320) || null,
      phone: sanitizeText(input.phone, 40) || null,
      whatsapp: sanitizeText(input.whatsapp, 40) || null,
      country: sanitizeText(input.country, 80) || null,
      source: sanitizeText(input.source, 40).toUpperCase() || 'UNKNOWN',
      status: 'LEAD',
      pipelineStage: 'NEW',
      preferredContact: sanitizeText(input.preferredContact, 40) || null,
    }

    // Raw website/email/phone values are not identity proof. Only provider-
    // verified identities may automatically link an intake to an existing row.
    let clientRow: Awaited<ReturnType<typeof db.client.findUnique>>
    let isNewClient = true
    if (input.verifiedIdentities?.length) {
      const resolved = await resolveOrCreateVerifiedClient(createData, input.verifiedIdentities)
      clientRow = resolved.client
      isNewClient = resolved.created
      if (!isNewClient) {
        const verifiedEmail = input.verifiedIdentities.some((proof) =>
          proof.type === 'EMAIL' && normalizeIdentity('EMAIL', proof.value) === normalizeIdentity('EMAIL', createData.email ?? ''),
        )
        const verifiedPhone = input.verifiedIdentities.some((proof) =>
          proof.type === 'PHONE' && normalizeIdentity('PHONE', proof.value) === normalizeIdentity('PHONE', createData.whatsapp || createData.phone || ''),
        )
        clientRow = await db.client.update({
          where: { id: resolved.client.id },
          data: {
            name: resolved.client.name === 'Unknown Contact' ? createData.name : resolved.client.name,
            businessName: resolved.client.businessName ?? createData.businessName,
            businessType: resolved.client.businessType ?? createData.businessType,
            email: verifiedEmail ? resolved.client.email ?? createData.email : resolved.client.email,
            whatsapp: verifiedPhone ? resolved.client.whatsapp ?? createData.whatsapp : resolved.client.whatsapp,
            phone: verifiedPhone && normalizeIdentity('PHONE', createData.phone || '') === normalizeIdentity('PHONE', createData.whatsapp || '')
              ? resolved.client.phone ?? createData.phone
              : resolved.client.phone,
            country: resolved.client.country ?? createData.country,
          },
        })
      }
    } else {
      // Unverified email/phone are contact data only, not identity proof.
      clientRow = await db.client.create({ data: createData })
    }
    if (!clientRow) throw new Error('Client intake did not create or resolve a client record.')
    if (input.formId) {
      await db.formSubmission.update({ where: { id: input.formId }, data: { clientId: clientRow.id, status: 'PROCESSING' } })
    }

    if (isNewClient) {
      await rememberMemory({ scope: 'CLIENT', key: `origin:${clientRow.id}`, content: `Client originated from ${input.source} on ${new Date().toISOString()}. First message: ${sanitizeText(input.message, 500)}`, clientId: clientRow.id, importance: 7 })
    }

    // Save the original inbound message
    await db.communication.create({
      data: {
        clientId: clientRow.id, channel: createData.source, direction: 'IN',
        sender: sanitizeText(input.name, 200) || null, body: sanitizeText(input.message, 8000),
        providerMessageId: input.providerMessageId ?? null,
        status: 'RECEIVED',
      },
    })

    // Lead detail record
    const lead = await db.lead.upsert({
      where: { clientId: clientRow.id },
      create: {
        clientId: clientRow.id,
        requirements: sanitizeText(input.message, 4000),
        projectType: input.projectType || null,
        budgetRange: input.budgetRange || null,
        tracking: input.tracking ? JSON.stringify(input.tracking) : null,
        sourceDetails: input.source,
      },
      update: { requirements: sanitizeText(input.message, 4000) },
    })

    await stepLog(log.id, 'client_created', { clientId: clientRow.clientId })

    if (isNewClient) {
      // Website enquiries require the exact boolean consent checked by the form;
      // inbound messages may receive a reply only on their originating channel.
      const hasContactPermission = createData.source !== 'WEBSITE' || hasExplicitContactConsent(input.contactConsent)
      const selectedChannel = hasContactPermission ? selectWelcomeChannel(createData.source, clientRow.preferredContact) : null
      let welcomeAccepted = false
      if (!hasContactPermission) {
        await stepLog(log.id, 'welcome_skipped', {
          reason: 'explicit website contact consent was not recorded',
        })
      } else if (selectedChannel) {
        // STAGE 1 — the first reply. The exact pipeline copy is sent on the
        // client's own channel, with the generated Client ID inside it.
        const welcome = await sendPipelineMessage({
          clientRowId: clientRow.id,
          stage: 'FIRST_MESSAGE',
          variables: pipelineVars(clientRow),
          channels: [selectedChannel as PipelineChannel],
          agentCode: 'COM-010',
          workflowId: log.id,
        })
        welcomeAccepted = welcome.deliveries.some((delivery) => delivery.ok)
        await stepLog(log.id, 'welcome_sent', {
          stage: 'FIRST_MESSAGE',
          channel: selectedChannel,
          status: welcome.status,
          providerAccepted: welcomeAccepted,
          deliveries: welcome.deliveries.map((delivery) => `${delivery.channel}:${delivery.status}`),
        })
      } else {
        await stepLog(log.id, 'welcome_skipped', {
          reason: 'no usable selected contact channel',
        })
      }

      if (welcomeAccepted) await setStage(clientRow.id, 'CONTACTED', 'Welcome send accepted by selected provider channel')
      // Business detection runs after the welcome attempt. It may update
      // businessType, but only an accepted welcome can advance the pipeline.
      const businessRun = await detectBusiness(clientRow.id, input.message, { advanceStage: welcomeAccepted })
      await finishLog(log.id, 'SUCCESS', { clientId: clientRow.clientId, leadId: lead.id, welcomeAccepted, businessDetectionOk: businessRun.ok })
    } else {
      // A returning client. Their reply may now carry the business type,
      // which unlocks STAGE 2 of the pipeline: the plan is recommended and
      // the eight scope questions are sent on WhatsApp/SMS and email.
      let stage2Sent = false
      if (!clientRow.businessType) {
        const businessRun = await detectBusiness(clientRow.id, input.message, { advanceStage: true })
        if (businessRun.ok && businessRun.json) {
          const scopeRun = await askScopeQuestions(clientRow.id)
          stage2Sent = scopeRun.sent.status !== 'AWAITING_APPROVAL'
          await stepLog(log.id, 'stage2_business_type', {
            businessType: businessRun.json.businessType ?? null,
            status: scopeRun.sent.status,
            deliveries: scopeRun.delivery,
          })
        }
      }
      await finishLog(log.id, 'SUCCESS', { clientId: clientRow.clientId, leadId: lead.id, reusedVerifiedIdentity: true, stage2Sent })
    }

    if (input.formId) {
      await db.formSubmission.update({ where: { id: input.formId }, data: { clientId: clientRow.id, status: 'PROCESSED' } })
    }
    return { clientId: clientRow.clientId, clientRowId: clientRow.id, logId: log.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (input.formId) await db.formSubmission.updateMany({ where: { id: input.formId, status: 'PROCESSING' }, data: { status: 'FAILED' } }).catch(() => null)
    await finishLog(log.id, 'FAILED', undefined, msg)
    await logError({ source: 'AUTOMATION', code: 'LEAD_INTAKE_FAILED', message: msg, workflow: 'LEAD_INTAKE' })
    throw e
  }
}

// ------------------------------------------------------------
// STEP 2 — Business detection (AI, real execution)
// ------------------------------------------------------------
export async function detectBusiness(clientRowId: string, messageText?: string, options: { advanceStage?: boolean } = {}) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (!client) throw new Error('Client not found')
  const text = messageText ?? client.lead?.requirements ?? `${client.businessName ?? ''} ${client.name}`
  const run = await runAgent('BIZ-004', {
    input: `Business name: ${client.businessName ?? 'unknown'}\nContact name: ${client.name}\nMessage: ${text}`,
    clientId: client.id, workflow: 'BUSINESS_DETECTION', expectJson: true,
  })
  if (run.ok && run.json) {
    // The AI agent must not put a phone number into any client-facing
    // content. The detected business type is shown to the client, so it
    // is screened before it is stored.
    const businessType = sanitizeText(screenAiContent(String(run.json.businessType ?? '')).text, 80)
    await db.client.update({ where: { id: client.id }, data: { businessType } })
    if (options.advanceStage !== false) await setStage(client.id, 'BUSINESS_IDENTIFIED', 'AI business detection')
    await rememberMemory({ scope: 'CLIENT', key: `business:${client.id}`, content: `Business type detected: ${businessType} (confidence ${run.json.confidence ?? 'n/a'})`, clientId: client.id, importance: 6, agentCode: 'BIZ-004' })
  } else if (run.error) {
    await logError({ source: 'AUTOMATION', code: 'BUSINESS_DETECTION_FAILED', message: run.error, clientId: client.clientId, workflow: 'BUSINESS_DETECTION' })
  }
  return run
}

// ------------------------------------------------------------
// STEP 3 — Plan recommendation (AI)
// ------------------------------------------------------------
export async function recommendPlan(clientRowId: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (!client) throw new Error('Client not found')
  const run = await runAgent('PLN-005', {
    input: `Business type: ${client.businessType ?? 'unknown'}\nIntent: ${client.lead?.requirements ?? ''}\nBudget: ${client.lead?.budgetRange ?? 'unknown'}\nCountry: ${client.country ?? 'unknown'}`,
    clientId: client.id, workflow: 'PLAN_RECOMMENDATION', expectJson: true,
  })
  if (run.ok && run.json) {
    // The recommended plan is shown to the client in the stage-2 message,
    // so it is screened for phone numbers first.
    const plan = sanitizeText(screenAiContent(String(run.json.plan ?? '')).text, 120)
    await db.client.update({ where: { id: client.id }, data: {} })
    await db.lead.update({ where: { clientId: client.id }, data: { interest: plan } }).catch(() => null)
    await setStage(client.id, 'PLAN_RECOMMENDED', 'AI plan recommendation')
    await rememberMemory({ scope: 'CLIENT', key: `plan:${client.id}`, content: `Recommended plan: ${plan}. Rationale: ${sanitizeText(String(run.json.rationale ?? ''), 800)}`, clientId: client.id, importance: 6, agentCode: 'PLN-005' })
  }
  return run
}

// ------------------------------------------------------------
// STEP 4 — Scope discovery questions (AI) → sent via best channel
//
// STAGE 2 of the communication pipeline. The client receives the
// exact pipeline copy: the recommended plan plus the eight scope
// questions. The AI's own questions are produced by the SCP-006
// agent and kept for the sales team (memory + automation log), but
// the wording the client sees is the specified copy.
// ------------------------------------------------------------
export async function askScopeQuestions(clientRowId: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (!client) throw new Error('Client not found')
  const run = await runAgent('SCP-006', {
    input: `Business type: ${client.businessType ?? 'unknown'}\nPlan of interest: ${client.lead?.interest ?? 'unknown'}\nRequirements so far: ${client.lead?.requirements ?? ''}`,
    clientId: client.id, workflow: 'SCOPE_COLLECTION',
  })
  // The recommended plan must exist before the stage-2 message goes out.
  if (!client.lead?.interest) {
    await recommendPlan(clientRowId)
  }
  // The AI's own questions are kept for the sales team. The wording the
  // client receives is the specified copy.
  await rememberMemory({
    scope: 'CLIENT',
    key: `scope-questions:${client.id}`,
    content: `AI scope questions prepared for the client: ${sanitizeText(run.output ?? '', 2000) || 'no AI output'}`,
    clientId: client.id,
    importance: 5,
    agentCode: 'SCP-006',
  })

  const fresh = await db.client.findUnique({ where: { id: client.id }, include: { lead: true } })
  if (!fresh) throw new Error('Client not found')
  await setStage(client.id, 'SCOPE_COLLECTION', 'Scope questions sent')

  const sent = await sendPipelineMessage({
    clientRowId: client.id,
    stage: 'BUSINESS_TYPE_RECEIVED',
    variables: pipelineVars(fresh),
    agentCode: 'COM-010',
    workflowId: run.executionId ?? undefined,
  })
  const delivery = sent.deliveries.map((entry) => `${entry.channel}:${entry.status}`)
  if (delivery.length === 0) delivery.push('LOGGED_ONLY: no channel contact available')
  return { run, delivery, sent }
}

// ------------------------------------------------------------
// STEP 5 — Client submits scope → AI review + draft SOW
// ------------------------------------------------------------
export async function submitScope(clientRowId: string, scopeText: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (!client) throw new Error('Client not found')
  const log = await startLog('SCOPE_REVIEW', 'API', client.id, { length: scopeText.length })

  // Save client's submission as inbound communication
  await db.communication.create({
    data: { clientId: client.id, channel: 'PORTAL', direction: 'IN', sender: client.name, body: sanitizeText(scopeText, 12000), status: 'RECEIVED' },
  })
  await db.lead.update({ where: { clientId: client.id }, data: { requirements: sanitizeText(scopeText, 8000) } }).catch(() => null)

  // AI review (Auditor)
  const review = await runAgent('SCP-007', {
    input: `Business type: ${client.businessType ?? 'unknown'}\nPlan: ${client.lead?.interest ?? 'unknown'}\nClient submitted scope:\n${scopeText}`,
    clientId: client.id, workflow: 'SCOPE_REVIEW', expectJson: true,
  })
  await stepLog(log.id, 'ai_review', { ok: review.ok })

  // Draft SOW v1 (Forge) including AI recommended updates
  const forgeInput = `Business type: ${client.businessType}\nPlan: ${client.lead?.interest ?? 'unknown'}\nBudget: ${client.lead?.budgetRange ?? 'TBD'}\nClient scope:\n${scopeText}\n\nAI review notes: ${review.output}`
  const forge = await runAgent('SCP-008', { input: forgeInput, clientId: client.id, workflow: 'SCOPE_DRAFT', expectJson: true })

  let scopeId: string | null = null
  if (forge.ok && forge.json) {
    const count = await db.scopeOfWork.count({ where: { clientId: client.id } })
    const scope = await db.scopeOfWork.create({
      data: {
        clientId: client.id,
        version: count + 1,
        status: 'AWAITING_ADMIN_APPROVAL',
        summary: sanitizeText(String(forge.json.summary ?? ''), 1000),
        content: JSON.stringify(forge.json),
        aiNotes: review.output.slice(0, 8000),
        generatedBy: 'SCP-008',
      },
    })
    scopeId = scope.id
    await setStage(client.id, 'SCOPE_REVIEW', 'Draft SOW generated, awaiting admin approval')
    // Queue admin approval (sensitive: final scope send comes later)
    await db.approvalRequest.create({
      data: {
        type: 'FINAL_SCOPE_SEND',
        title: `Approve Final Scope for ${client.clientId} (${client.name})`,
        description: 'Review the AI-generated draft Scope of Work. Approving will finalize it and (after approval) send to client via WhatsApp + Email.',
        clientId: client.id,
        agentCode: 'SCP-008',
        payload: JSON.stringify({ scopeId: scope.id, content: forge.json }),
        risk: 'MEDIUM',
        requestedBy: 'SCP-008',
      },
    })
    await db.notification.create({
      data: { type: 'APPROVAL', title: 'Scope awaiting admin approval', body: `${client.clientId} — ${client.name}`, severity: 'INFO' },
    }).catch(() => null)

    // STAGE 3 — the client is told the requirements were received and
    // that the draft is under internal review. The final Scope of Work
    // itself is NOT sent here: it waits for the admin approval above.
    await sendPipelineMessage({
      clientRowId: client.id,
      stage: 'SCOPE_DETAILS_RECEIVED',
      variables: pipelineVars(client),
      agentCode: 'SCP-008',
      workflowId: log.id,
    })
  }
  await finishLog(log.id, forge.ok ? 'SUCCESS' : 'FAILED', { scopeId })
  return { review, forge, scopeId }
}

// ------------------------------------------------------------
// STEP 6 — Admin approves draft → FINAL scope + send to client
// (invoked from approval execute path)
// ------------------------------------------------------------
export async function finalizeScopeAndSend(scopeId: string, adminUserId: string) {
  const scope = await db.scopeOfWork.findUnique({ where: { id: scopeId }, include: { client: true } })
  if (!scope || !scope.client) throw new Error('Scope/client not found')
  const log = await startLog('FINAL_SCOPE', 'ADMIN_APPROVAL', scope.clientId, { scopeId })

  await db.scopeOfWork.update({ where: { id: scope.id }, data: { status: 'FINAL', approvedBy: adminUserId, approvedAt: new Date() } })
  await db.scopeOfWork.updateMany({ where: { clientId: scope.clientId, id: { not: scope.id }, status: { in: ['DRAFT', 'AWAITING_ADMIN_APPROVAL', 'APPROVED'] } }, data: { status: 'SUPERSEDED' } })
  await setStage(scope.clientId, 'FINAL_SCOPE', 'Final SOW ready')

  const content = JSON.parse(scope.content || '{}') as Record<string, unknown>
  const client = scope.client
  const scopeText = formatScopeForClient(content, client.clientId)
  const results: string[] = []

  // STAGE 4 — the final Scope of Work. This message is only ever sent
  // from the admin approval execution path, so the gate is satisfied by
  // the approval that has already been granted.
  const sent = await sendPipelineMessage({
    clientRowId: client.id,
    stage: 'FINAL_SCOPE_APPROVED',
    variables: pipelineVars(client, {
      projectName: String(content.title ?? '') || null,
      finalScope: scopeText,
      paymentPolicy: `Advance ${String((content.paymentPolicy as Record<string, unknown> | undefined)?.advancePct ?? '—')}% · On milestone ${String((content.paymentPolicy as Record<string, unknown> | undefined)?.milestonePct ?? '—')}% · On final delivery ${String((content.paymentPolicy as Record<string, unknown> | undefined)?.finalPct ?? '—')}% · ${String((content.paymentPolicy as Record<string, unknown> | undefined)?.currency ?? 'USD')}`,
    }),
    agentCode: 'WAP-011',
    workflowId: log.id,
    approved: true,
  })
  results.push(...sent.deliveries.map((delivery) => `${delivery.channel}:${delivery.status}`))

  await rememberMemory({ scope: 'CLIENT', key: `finalscope:${client.id}`, content: `Final scope v${scope.version} approved by admin ${adminUserId} at ${new Date().toISOString()}. Delivered channels: ${results.join(', ')}`, clientId: client.id, importance: 8 })
  await finishLog(log.id, 'SUCCESS', { channels: results })
  await audit({ actor: 'system', action: 'FINAL_SCOPE_SENT', clientId: client.clientId, userId: adminUserId, details: { channels: results } })
  return { results }
}

export function formatScopeForClient(content: Record<string, unknown>, clientId: string): string {
  const items = Array.isArray(content.items) ? (content.items as Array<Record<string, string>>) : []
  const timeline = Array.isArray(content.timeline) ? (content.timeline as Array<Record<string, string>>) : []
  const pp = (content.paymentPolicy ?? {}) as Record<string, unknown>
  let text = `FINAL SCOPE OF WORK — Tech360\nReference: ${clientId}\n\n${String(content.title ?? 'Project Scope')}\n${String(content.summary ?? '')}\n\nDELIVERABLES\n`
  items.forEach((i, idx) => { text += `${idx + 1}. ${i.name ?? ''} — ${i.description ?? ''} (Deliverable: ${i.deliverable ?? 'as described'})\n` })
  text += '\nTIMELINE\n'
  timeline.forEach((t) => { text += `• ${t.phase ?? ''} (${t.weeks ?? '?'} week(s)): ${t.activities ?? ''}\n` })
  text += `\nPAYMENT POLICY\n• Advance: ${String(pp.advancePct ?? '—')}%\n• On milestone: ${String(pp.milestonePct ?? '—')}%\n• On final delivery: ${String(pp.finalPct ?? '—')}%\n• Currency: ${String(pp.currency ?? 'USD')}\n${String(pp.terms ?? '')}\n\nKEY POLICIES\n• HTML Preview Before Payment\n• Source Code After Full Payment\n• Changes to approved scope may require additional cost/time\n\nReply APPROVED to confirm, or send your revision notes.\n— Team Tech360`
  return text
}

// ------------------------------------------------------------
// STEP 7 — Client decision on scope (approve / revision / meeting)
// ------------------------------------------------------------
export async function clientScopeDecision(clientRowId: string, decision: 'APPROVED' | 'REVISION_REQUESTED' | 'CLARIFICATION_REQUESTED', notes?: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { scopes: true } })
  if (!client) throw new Error('Client not found')
  const finalScope = client.scopes.filter((s) => s.status === 'FINAL').sort((a, b) => b.version - a.version)[0]
  if (!finalScope) throw new Error('No final scope to approve')

  await db.scopeApproval.create({
    data: {
      scopeId: finalScope.id, clientId: client.id, decision,
      notes: sanitizeText(notes, 4000) || null,
      meetingRequested: decision === 'CLARIFICATION_REQUESTED',
    },
  })

  if (decision === 'APPROVED') {
    await setStage(client.id, 'CLIENT_APPROVAL', 'Client approved final scope')
    // STAGE 5B — the scope is approved. The acknowledgement is auto-sent
    // and the HTML preview is prepared next.
    const sent = await sendPipelineMessage({
      clientRowId: client.id,
      stage: 'SCOPE_APPROVED',
      variables: pipelineVars(client),
      agentCode: 'COM-010',
    })
    await rememberMemory({ scope: 'CLIENT', key: `approval:${client.id}`, content: `Client approved final scope v${finalScope.version} at ${new Date().toISOString()}. Acknowledgement: ${sent.deliveries.map((d) => `${d.channel}:${d.status}`).join(', ') || 'no channel'}`, clientId: client.id, importance: 8 })
    return { next: 'REQUEST_PREVIEW', sent }
  }
  if (decision === 'REVISION_REQUESTED') {
    await db.scopeOfWork.update({ where: { id: finalScope.id }, data: { status: 'SUPERSEDED' } })
    const run = await runAgent('REV-032', {
      input: `Current scope: ${finalScope.content}\nClient revision notes: ${notes ?? ''}`,
      clientId: client.id, workflow: 'SCOPE_REVISION', expectJson: true,
    })
    let newScopeId: string | null = null
    if (run.ok && run.json) {
      const scope = await db.scopeOfWork.create({
        data: {
          clientId: client.id, version: finalScope.version + 1, status: 'AWAITING_ADMIN_APPROVAL',
          summary: sanitizeText(String(run.json.newVersionSummary ?? ''), 1000),
          content: JSON.stringify({ ...JSON.parse(finalScope.content || '{}'), ...(run.json as object) }),
          aiNotes: run.output.slice(0, 8000), generatedBy: 'REV-032',
        },
      })
      newScopeId = scope.id
      await db.approvalRequest.create({
        data: {
          type: 'FINAL_SCOPE_SEND', title: `Approve revised scope for ${client.clientId}`,
          description: `Revision requested by client. v${scope.version} generated.`,
          clientId: client.id, agentCode: 'REV-032', payload: JSON.stringify({ scopeId: scope.id }), risk: 'MEDIUM', requestedBy: 'REV-032',
        },
      })
      await setStage(client.id, 'SCOPE_REVIEW', 'Revision generated, awaiting admin approval')
    }
    // The revision acknowledgement is auto-sent; the revised scope still
    // waits for the admin approval above.
    const sent = await sendPipelineMessage({
      clientRowId: client.id,
      stage: 'REVISION_REQUESTED',
      variables: pipelineVars(client),
      agentCode: 'REV-032',
    })
    return { next: 'ADMIN_APPROVAL', newScopeId, sent }
  }
  // CLARIFICATION → meeting only when client asks
  const meeting = await db.meeting.create({
    data: { clientId: client.id, reason: sanitizeText(notes, 1000) || 'Client requested clarification', status: 'REQUESTED', bookingLink: MEETING_BOOKING_URL },
  })
  await setStage(client.id, 'FINAL_SCOPE', 'Meeting requested by client')
  const run = await runAgent('MTG-015', { input: `Client ${client.name} (${client.clientId}) requests clarification about final scope. Timezone preference: ${client.country ?? 'Asia/Dhaka'}`, clientId: client.id, workflow: 'MEETING', expectJson: true })
  if (run.ok && run.json) {
    await db.meeting.update({ where: { id: meeting.id }, data: { status: 'SCHEDULED', notes: run.output.slice(0, 2000) } })
  }

  // STAGE 5A — the meeting link is auto-sent, the request is saved (the
  // Meeting row above) and a task is created for the team.
  const sent = await sendPipelineMessage({
    clientRowId: client.id,
    stage: 'MEETING_REQUESTED',
    variables: pipelineVars(client),
    agentCode: 'MTG-015',
  })
  await createHumanTask({
    clientRowId: client.id,
    title: `Scope clarification meeting — ${client.clientId}`,
    description: `The client asked for an explanation of the approved scope. Meeting request ${meeting.id} was saved and the booking link was sent.`,
    link: 'meetings',
  })

  return { next: 'MEETING', meetingId: meeting.id, sent }
}

/**
 * Create a human task for the team.
 *
 * A `ProjectTask` is used when the client already has a project; before
 * that a `Notification` carries the task, because a ProjectTask cannot
 * exist without a project.
 */
async function createHumanTask(input: {
  clientRowId: string
  title: string
  description: string
  link?: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
}): Promise<string | null> {
  const project = await db.project.findFirst({
    where: { clientId: input.clientRowId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (project) {
    const task = await db.projectTask.create({
      data: {
        projectId: project.id,
        title: input.title,
        description: input.description,
        status: 'TODO',
        priority: input.priority ?? 'HIGH',
        assigneeType: 'HUMAN',
      },
    })
    return task.id
  }
  await db.notification.create({
    data: {
      type: 'LEAD',
      title: input.title,
      body: input.description,
      severity: 'WARNING',
      link: input.link ?? 'clients',
    },
  })
  return null
}

// ------------------------------------------------------------
// STEP 8 — HTML PREVIEW (before payment)
// ------------------------------------------------------------
export async function generatePreview(clientRowId: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true, scopes: true, projects: true } })
  if (!client) throw new Error('Client not found')
  const finalScope = client.scopes.filter((s) => s.status === 'FINAL').sort((a, b) => b.version - a.version)[0]
  if (!finalScope) throw new Error('Final scope required before preview')

  const content = JSON.parse(finalScope.content || '{}') as Record<string, unknown>
  const now = new Date()
  const activePreview = await db.preview.findFirst({
    where: {
      clientId: client.id,
      scopeVersion: finalScope.version,
      status: { in: ['GENERATED', 'SENT', 'VIEWED'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
  })
  const base = process.env.APP_PUBLIC_URL ?? ''
  if (activePreview) {
    return {
      previewId: activePreview.id,
      token: activePreview.token,
      link: `${base}/api/preview/${activePreview.token}`,
      status: activePreview.status,
      reused: true,
      delivery: [],
    }
  }

  const existingCount = await db.preview.count({ where: { clientId: client.id } })
  const token = publicToken()
  const html = buildPreviewHtml(client, content, existingCount + 1)
  const preview = await db.preview.create({
    data: {
      token, clientId: client.id, projectId: null, scopeVersion: finalScope.version,
      version: existingCount + 1, status: 'GENERATED', html,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_DAYS * 24 * 3600 * 1000),
    },
  })
  await db.previewEvent.create({ data: { previewId: preview.id, type: 'GENERATED' } })

  const link = `${base}/api/preview/${token}`
  const attempts: Array<{ channel: string; status: string; ok: boolean }> = []
  // STAGE 6 — the HTML preview notification. The preview is produced
  // BEFORE any payment: HTML Preview Before Payment.
  const sent = await sendPipelineMessage({
    clientRowId: client.id,
    stage: 'HTML_PREVIEW_SENT',
    variables: pipelineVars(client, { htmlPreviewUrl: link }),
    agentCode: 'WAP-011',
  })
  for (const delivery of sent.deliveries) {
    attempts.push({ channel: delivery.channel, status: delivery.status, ok: delivery.ok })
  }

  const accepted = hasAcceptedPreviewDelivery(attempts)
  const updated = accepted
    ? await db.preview.update({ where: { id: preview.id }, data: { status: 'SENT', sentAt: new Date() } })
    : preview
  if (accepted) await db.previewEvent.create({ data: { previewId: preview.id, type: 'SENT' } })
  return { previewId: updated.id, token, link, status: updated.status, reused: false, delivery: attempts }
}

function buildPreviewHtml(client: { clientId: string; name: string; businessName: string | null }, content: Record<string, unknown>, version: number): string {
  const items = Array.isArray(content.items) ? (content.items as Array<Record<string, string>>) : []
  const timeline = Array.isArray(content.timeline) ? (content.timeline as Array<Record<string, string>>) : []
  const pp = (content.paymentPolicy ?? {}) as Record<string, unknown>
  const itemRows = items.map((i) => `<div class="card"><h3>${escapeHtml(i.name ?? '')}</h3><p>${escapeHtml(i.description ?? '')}</p><div class="tag">Deliverable: ${escapeHtml(i.deliverable ?? 'as described')}</div></div>`).join('')
  const timelineRows = timeline.map((t) => `<li><strong>${escapeHtml(t.phase ?? '')}</strong> <span>(${escapeHtml(String(t.weeks ?? '?'))} week${String(t.weeks ?? '') === '1' ? '' : 's'})</span><p>${escapeHtml(t.activities ?? '')}</p></li>`).join('')
  const clientDisplayName = escapeHtml(client.name)
  const issued = docDate()
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><title>Scope of Work — ${escapeHtml(client.clientId)} — Tech360</title><style>${PAD_CSS}
.hello{margin:26px 0 6px;font-size:22px}
.intro{color:#526173;font-size:14px;line-height:1.7;max-width:64ch}
</style></head><body>
<div class="sheet">
${padHeader("Scope of Work — Project Preview")}
${padMeta([
    { label: "Client reference", value: escapeHtml(client.clientId), brand: true },
    { label: "Document", value: `SOW Preview v${version}` },
    { label: "Issued", value: issued },
    { label: "Status", value: "For client review" },
  ])}
<main class="doc">
<h1 class="hello">Hello ${clientDisplayName}${client.businessName ? ` · ${escapeHtml(client.businessName)}` : ''}</h1>
<p class="intro">This is the working preview of your project scope, generated from your approved requirements and presented on official Tech360 company letterhead. Review everything below — <strong>no payment is due until you approve.</strong></p>
<h2>Deliverables</h2>${itemRows || '<div class="card"><p>Scope items will appear here.</p></div>'}
<h2>Timeline</h2><ol class="timeline">${timelineRows}</ol>
<h2>Payment Plan</h2>
<div class="pay">
<div><b>${escapeHtml(String(pp.advancePct ?? '—'))}%</b><br/><small>Advance</small></div>
<div><b>${escapeHtml(String(pp.milestonePct ?? '—'))}%</b><br/><small>On milestone</small></div>
<div><b>${escapeHtml(String(pp.finalPct ?? '—'))}%</b><br/><small>On final delivery</small></div>
</div>
<div class="note"><strong>Our promise:</strong> HTML Preview Before Payment · Source Code After Full Payment · Changes to approved scope may require additional cost/time.</div>
${padSignatures(clientDisplayName, "Client approval of scope preview")}
<div class="acts no-print"><a class="btn btn-a" href="#approve" id="approveBtn">✓ Approve this preview</a><a class="btn btn-r" href="#revise" id="reviseBtn">Request changes</a></div>
</main>
${padFooter("This scope preview is confidential and intended for the addressed recipient only. Not a tax invoice.")}
</div>
<script>
(function(){
  var t = location.pathname.split('/').pop();
  function act(decision){
    fetch('/api/preview/' + t + '/action', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:decision})})
      .then(function(r){return r.json()}).then(function(d){
        alert(decision==='APPROVED' ? 'Thank you! Your approval was recorded. Team Tech360 will continue with payment instructions.' : 'Thank you! Your change request was recorded. Team Tech360 will review it.');
      }).catch(function(){ alert('Could not record — please contact info@bdtech360.com'); });
  }
  var a=document.getElementById('approveBtn'); if(a) a.addEventListener('click',function(e){e.preventDefault();act('APPROVED');});
  var r=document.getElementById('reviseBtn'); if(r) r.addEventListener('click',function(e){e.preventDefault();var n=prompt('Please describe your change requests:'); if(n) fetch('/api/preview/'+t+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:'REVISION_REQUESTED',notes:n})}).then(function(){alert('Change request recorded. Thank you!');});});
  fetch('/api/preview/' + t + '/view', {method:'POST'}).catch(function(){});
})();
</script></body></html>`
}

// ------------------------------------------------------------
// STAGE 7 — the client decides on the HTML preview
// ------------------------------------------------------------
export async function recordPreviewDecision(
  clientRowId: string,
  decision: 'APPROVED' | 'REVISION_REQUESTED',
  notes?: string,
) {
  const client = await db.client.findUnique({ where: { id: clientRowId } })
  if (!client) throw new Error('Client not found')

  if (decision === 'REVISION_REQUESTED') {
    // STAGE 7A — the revision acknowledgement is auto-sent, the admin is
    // notified and a task is created.
    const sent = await sendPipelineMessage({
      clientRowId: client.id,
      stage: 'REVISION_REQUESTED',
      variables: pipelineVars(client),
      agentCode: 'REV-032',
    })
    await db.notification.create({
      data: {
        type: 'LEAD',
        title: 'HTML preview revision requested',
        body: `${client.clientId} — ${client.name}: ${sanitizeText(notes ?? '', 500)}`,
        severity: 'WARNING',
        link: 'clients',
      },
    }).catch(() => null)
    await createHumanTask({
      clientRowId: client.id,
      title: `Preview revision — ${client.clientId}`,
      description: `The client requested a revision to the HTML preview. Notes: ${sanitizeText(notes ?? '', 2000) || 'none supplied'}`,
      link: 'clients',
    })
    return { decision, sent, taskCreated: true }
  }

  // STAGE 7B — the client approved the preview. The next message is the
  // payment step, which the policy requires an admin to approve, so the
  // sender raises the approval instead of sending.
  const sent = await sendPipelineMessage({
    clientRowId: client.id,
    stage: 'HTML_PREVIEW_APPROVED',
    variables: pipelineVars(client),
    agentCode: 'PAY-016',
  })
  return { decision, sent, taskCreated: false }
}

// ------------------------------------------------------------
// STEP 9 — Payment request (approval-gated) + record + verify
// ------------------------------------------------------------
export async function requestPayment(clientRowId: string, actor: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { scopes: true, projects: true, payments: true } })
  if (!client) throw new Error('Client not found')
  const finalScope = client.scopes.filter((s) => s.status === 'FINAL').sort((a, b) => b.version - a.version)[0]
  if (!finalScope) throw new Error('Final scope required')

  const run = await runAgent('PAY-016', {
    input: `Prepare payment instructions. Scope payment policy: ${finalScope.content}\nClient: ${client.clientId}, ${client.name}\nCountry: ${client.country ?? 'unknown'}`,
    clientId: client.id, workflow: 'PAYMENT_REQUEST', expectJson: true,
  })
  let instructions: string = run.output
  if (run.ok && run.json) {
    const milestones = Array.isArray(run.json.milestones) ? run.json.milestones : []
    instructions = milestones.map((m: Record<string, unknown>) => `• ${m.name}: ${m.amount} ${m.currency ?? 'USD'} — ${m.dueNote ?? ''}`).join('\n')
    // create invoices for milestones with amounts
    for (const m of milestones as Array<Record<string, unknown>>) {
      const amount = Number(m.amount)
      if (!Number.isFinite(amount) || amount <= 0) continue
      const number = await nextInvoiceNumber()
      await db.invoice.create({
        data: { number, clientId: client.id, amount, currency: String(m.currency ?? 'USD'), status: 'DRAFT', notes: String(m.name ?? 'Milestone') },
      })
    }
  }
  const message = `Payment instructions for your Tech360 project (${client.clientId}):\n${instructions}\n\nAfter payment, send us the transaction reference and we will confirm receipt. — Team Tech360`
  const results: string[] = []

  // A payment instruction WITH an amount must not reach the client before
  // an admin approves it. The message is composed and saved, and an
  // approval request is raised for the Super Admin.
  const approval = await db.approvalRequest.create({
    data: {
      type: 'PAYMENT_INSTRUCTION',
      title: `Approve payment instructions for ${client.clientId} (${client.name})`,
      description: 'The AI prepared the payment instructions (amounts included) for the approved scope. Approving sends them to the client on WhatsApp/SMS and email.',
      clientId: client.id,
      agentCode: 'PAY-016',
      payload: JSON.stringify({
        clientRowId: client.id,
        clientId: client.clientId,
        message,
        instructions,
      }),
      risk: 'HIGH',
      requestedBy: actor,
    },
  })
  await db.notification.create({
    data: {
      type: 'APPROVAL',
      title: 'Payment instructions awaiting admin approval',
      body: `${client.clientId} — ${client.name}`,
      severity: 'WARNING',
      link: 'approvals',
    },
  }).catch(() => null)
  await setStage(client.id, 'PAYMENT_PENDING', 'Payment instructions prepared, awaiting admin approval')
  await audit({ actor, action: 'PAYMENT_INSTRUCTIONS_AWAITING_APPROVAL', clientId: client.clientId, entityId: approval.id, details: { instructions } })
  return { instructions, results, approvalId: approval.id, status: 'AWAITING_APPROVAL' as const }
}

/**
 * Execute an approved payment instruction.
 *
 * Called by the approval decision path only — the message never leaves
 * the system without a Super Admin approval.
 */
export async function sendApprovedPaymentInstruction(payload: {
  clientRowId: string
  message: string
  instructions: string
}, approvalId: string, adminUserId: string) {
  const client = await db.client.findUnique({ where: { id: payload.clientRowId } })
  if (!client) throw new Error('Client not found')
  const results: string[] = []
  if (client.whatsapp) {
    const r = await sendCommunication({
      clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: payload.message,
      agentCode: 'PAY-016', approvalId,
    })
    results.push(`WHATSAPP:${r.result.status}`)
  }
  if (client.email) {
    const r = await sendCommunication({
      clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Payment instructions — Tech360',
      body: emailTemplate('PAYMENT', { name: client.name, extra: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(payload.instructions)}</pre>` }).body,
      agentCode: 'EML-012', approvalId,
    })
    results.push(`EMAIL:${r.result.status}`)
  }
  await audit({ actor: `admin:${adminUserId}`, action: 'PAYMENT_INSTRUCTIONS_SENT', clientId: client.clientId, entityId: approvalId, details: { results } })
  return { results }
}

export async function recordPayment(clientRowId: string, input: { amount: number; currency?: string; method?: string; transactionId?: string; milestone?: string; notes?: string; invoiceId?: string }) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { projects: true } })
  if (!client) throw new Error('Client not found')
  // Per-invoice allocation (idurar/frappe parity): when an invoice is linked,
  // validate it belongs to this client and inherit its project when known.
  let invoiceId: string | null = null
  let invoiceProjectId: string | null = null
  if (input.invoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId } })
    if (!invoice || invoice.clientId !== client.id) throw new Error('Invoice not found for this client')
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') throw new Error(`Invoice ${invoice.number} is ${invoice.status} — cannot allocate more payments to it`)
    if (input.amount > invoice.amount) throw new Error(`Payment exceeds invoice ${invoice.number} (amount ${invoice.amount}) — record at most the outstanding balance`)
    invoiceId = invoice.id
    invoiceProjectId = invoice.projectId
  }
  const fallbackProject = client.projects.filter((p) => !['COMPLETED', 'CANCELLED'].includes(p.status)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  const project = invoiceProjectId ?? fallbackProject?.id ?? null
  const payment = await db.payment.create({
    data: {
      clientId: client.id, projectId: project,
      invoiceId,
      amount: input.amount, currency: input.currency ?? 'USD',
      method: input.method ?? null, transactionId: input.transactionId || undefined,
      milestone: input.milestone ?? null, notes: sanitizeText(input.notes, 2000) || null,
      status: 'PENDING',
    },
  })
  return payment
}

/**
 * Per-invoice payment allocation: recompute an invoice's status from the
 * sum of its VERIFIED (PAID) payments. Never touches CANCELLED invoices.
 * Returns the new status (or null when nothing changed).
 */
export async function recalcInvoiceStatus(invoiceId: string): Promise<string | null> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice || invoice.status === 'CANCELLED') return null
  const paidAgg = await db.payment.aggregate({ where: { invoiceId: invoice.id, status: 'PAID' }, _sum: { amount: true } })
  const paidSum = paidAgg._sum.amount ?? 0
  const next = paidSum >= invoice.amount && invoice.amount > 0 ? 'PAID' : paidSum > 0 ? 'PARTIAL' : null
  if (!next || next === invoice.status) return invoice.status
  await db.invoice.update({ where: { id: invoice.id }, data: { status: next } })
  return next
}

export async function verifyPayment(paymentId: string, adminUserId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { client: true, project: true, invoice: true } })
  if (!payment) throw new Error('Payment not found')
  if (['FAILED', 'REFUNDED', 'CANCELLED'].includes(payment.status)) throw new Error(`A ${payment.status.toLowerCase()} payment cannot be verified.`)
  const alreadyVerified = payment.status === 'PAID'
  if (!alreadyVerified) {
    await db.payment.update({ where: { id: payment.id }, data: { status: 'PAID', verifiedBy: adminUserId, verifiedAt: new Date() } })
  }
  const client = payment.client
  const project = payment.project

  if (project) {
    const paid = await db.payment.aggregate({ where: { projectId: project.id, status: 'PAID' }, _sum: { amount: true } })
    const paidSum = paid._sum.amount ?? 0
    const paymentStatus = paidSum >= project.totalAmount && project.totalAmount > 0 ? 'PAID' : paidSum > 0 ? 'PARTIAL' : 'PENDING'
    await db.project.update({ where: { id: project.id }, data: { paidAmount: paidSum, paymentStatus } })
    // NOTE: invoices are deliberately NOT stamped with the project-level status
    // here — an invoice is only ever PARTIAL/PAID via its OWN linked verified
    // payments (per-invoice allocation, see the recalc pass below). The old
    // coarse stamp wrongly marked every project invoice PAID on any verify.
  }

  // First verified payment → project activation (project is created if it doesn't exist yet)
  if (client && stageIndex((await db.client.findUnique({ where: { id: client.id } }))?.pipelineStage ?? 'NEW') < stageIndex('PROJECT_ACTIVE')) {
    const activation = await activateProject(client.id, project?.id)
    // link the payment + invoices to the (possibly new) project
    await db.payment.update({ where: { id: payment.id }, data: { projectId: activation.project.id } }).catch(() => null)
    await db.invoice.updateMany({ where: { clientId: client.id, projectId: null }, data: { projectId: activation.project.id } }).catch(() => null)
    const paid = await db.payment.aggregate({ where: { projectId: activation.project.id, status: 'PAID' }, _sum: { amount: true } })
    const paidSum = paid._sum.amount ?? 0
    const paymentStatus = paidSum >= activation.project.totalAmount && activation.project.totalAmount > 0 ? 'PAID' : paidSum > 0 ? 'PARTIAL' : 'PENDING'
    await db.project.update({ where: { id: activation.project.id }, data: { paidAmount: paidSum, paymentStatus } })
  }

  // Per-invoice allocation (idurar/frappe parity): every invoice of this
  // client that has at least one linked payment gets its status recomputed
  // from ITS OWN verified payments. Invoices without linked payments keep
  // their current status (DRAFT/SENT/OVERDUE) until a payment is allocated
  // to them — no project-level coarse stamping.
  if (client) {
    const linked = await db.payment.findMany({
      where: { clientId: client.id, invoiceId: { not: null } },
      select: { invoiceId: true },
      distinct: ['invoiceId'],
    })
    for (const row of linked) {
      if (row.invoiceId) await recalcInvoiceStatus(row.invoiceId).catch(() => null)
    }
  }
  // STAGE 8 — the payment-received acknowledgement. The message carries no
  // amount (the verified amount lives on the Payment record and in the
  // audit trail), so it stays on the auto-send list.
  if (!alreadyVerified && client) {
    await sendPipelineMessage({
      clientRowId: client.id,
      stage: 'PAYMENT_RECEIVED',
      variables: pipelineVars(client),
      agentCode: 'PAY-016',
    })
  }
  await audit({ actor: `admin:${adminUserId}`, action: alreadyVerified ? 'PAYMENT_VERIFICATION_RECONCILED' : 'PAYMENT_VERIFIED', clientId: client?.clientId, entityId: payment.id, details: { amount: payment.amount, currency: payment.currency, invoice: payment.invoice?.number ?? null } })
  return { ok: true, idempotent: alreadyVerified }
}

// ------------------------------------------------------------
// STEP 10 — Project activation + AI task breakdown
// ------------------------------------------------------------
export async function activateProject(clientRowId: string, projectId?: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true, projects: true, scopes: true } })
  if (!client) throw new Error('Client not found')

  let project = projectId ? await db.project.findUnique({ where: { id: projectId } }) : null
  if (projectId && !project) throw new Error('Project not found')
  if (project && project.clientId !== client.id) throw new Error('Project does not belong to this client')
  if (!project) {
    project = client.projects
      .filter((candidate) => !['COMPLETED', 'CANCELLED'].includes(candidate.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
  }

  const paymentCount = await db.payment.count({
    where: { clientId: client.id, status: 'PAID', ...(project ? { projectId: project.id } : { projectId: null }) },
  })
  if (paymentCount === 0) throw new Error('A verified payment linked to this client or project is required before activation.')
  if (project && ['COMPLETED', 'CANCELLED'].includes(project.status)) throw new Error('A completed or cancelled project cannot be reactivated.')

  if (!project) {
    const finalScope = client.scopes.filter((s) => s.status === 'FINAL').sort((a, b) => b.version - a.version)[0]
    const code = await nextProjectCode()
    const content = finalScope ? JSON.parse(finalScope.content || '{}') as Record<string, unknown> : {}
    const budget = client.lead?.budgetRange ?? ''
    const firstNum = budget.match(/[\d][\d,]*/)
    const est = firstNum ? Number(firstNum[0].replace(/,/g, '')) || 0 : 0
    project = await db.project.create({
      data: {
        code, clientId: client.id,
        name: String(content.title ?? `Project for ${client.businessName ?? client.name}`),
        description: sanitizeText(String(content.summary ?? ''), 2000) || null,
        plan: client.lead?.interest ?? null,
        status: 'ACTIVE', totalAmount: est, paidAmount: 0,
        startedAt: new Date(),
      },
    })
    if (finalScope) await db.scopeOfWork.updateMany({ where: { id: finalScope.id }, data: { projectId: project.id } })
  } else if (project.status !== 'ACTIVE') {
    project = await db.project.update({ where: { id: project.id }, data: { status: 'ACTIVE', startedAt: project.startedAt ?? new Date() } })
  }

  await setStage(client.id, 'PROJECT_ACTIVE', `Project ${project.code} active`)

  // Existing tasks are the idempotency marker: a retry never reruns the model
  // or duplicates its persisted breakdown.
  const existingTasks = await db.projectTask.count({ where: { projectId: project.id } })
  let taskRun: Awaited<ReturnType<typeof runAgent>> | null = null
  if (existingTasks === 0) {
    taskRun = await runAgent('PRJ-018', {
      input: `Create task breakdown for project ${project.code}: ${project.name}\nScope: ${project.description ?? ''}\nPlan: ${project.plan ?? 'unknown'}`,
      clientId: client.id, projectId: project.id, workflow: 'PROJECT_TASKS', expectJson: true,
    })
    if (taskRun.ok && taskRun.json && Array.isArray(taskRun.json.tasks)) {
      let order = 0
      for (const t of taskRun.json.tasks as Array<Record<string, unknown>>) {
        await db.projectTask.create({
          data: {
            projectId: project.id,
            title: sanitizeText(String(t.title ?? t.name ?? `Task ${order + 1}`), 200),
            description: sanitizeText(String(t.description ?? ''), 2000) || null,
            priority: ['LOW', 'MEDIUM', 'HIGH'].includes(String(t.priority)) ? String(t.priority) : 'MEDIUM',
            assigneeType: String(t.assigneeType ?? 'AGENT') === 'HUMAN' ? 'HUMAN' : 'AGENT',
            order: order++,
          },
        })
      }
    }
  }

  // Delivery initialization is idempotent and does not claim delivery itself.
  const delivery = await db.delivery.findFirst({ where: { projectId: project.id } })
  if (!delivery) await db.delivery.create({ data: { clientId: client.id, projectId: project.id, checklist: '{}' } })
  const taskCount = await db.projectTask.count({ where: { projectId: project.id } })
  return { project, taskRun, taskCount }
}

// ------------------------------------------------------------
// STEP 11 — Completion / final payment / handover gates
// ------------------------------------------------------------
type PrepareHandoverResult =
  | { blocked: true; reason: string }
  | { blocked: false; handover: Awaited<ReturnType<typeof db.handoverRecord.create>>; reused?: boolean }

export async function prepareHandover(clientRowId: string, projectId: string, actor: string): Promise<PrepareHandoverResult> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true, payments: true, handovers: true, deliveries: true, tasks: true },
  })
  if (!project) throw new Error('Project not found')
  if (project.clientId !== clientRowId) throw new Error('Project does not belong to this client')

  const paid = project.payments.filter((payment) => payment.status === 'PAID').reduce((total, payment) => total + payment.amount, 0)
  const fullPayment = project.totalAmount > 0 ? paid >= project.totalAmount : paid > 0
  if (!fullPayment) {
    await logError({ source: 'AUTOMATION', code: 'HANDOVER_BLOCKED', message: `Handover blocked for ${project.code}: payment incomplete (${paid}/${project.totalAmount})`, clientId: project.client.clientId, workflow: 'HANDOVER' })
    return { blocked: true, reason: `Full payment verification required before handover. Paid: ${paid} ${project.currency} of ${project.totalAmount} ${project.currency}.` }
  }
  if (project.tasks.length === 0 || project.tasks.some((task) => task.status !== 'DONE')) {
    return { blocked: true, reason: 'Every project task must be completed before source handover can be prepared.' }
  }

  const artifacts = await db.fileRecord.findMany({
    where: {
      clientId: project.clientId,
      projectId: project.id,
      relatedType: 'DELIVERY',
      scanStatus: 'CLEAN',
      classification: { in: ['PUBLIC', 'PRIVATE'] },
      content: { not: null },
      sha256: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, originalName: true, mimeType: true, size: true, sha256: true, clientId: true, projectId: true, relatedType: true, scanStatus: true, classification: true, content: true },
  })
  const manifest = createHandoverManifest(
    project.id,
    artifacts.filter((file) => file.sha256).map((file) => ({
      id: file.id, originalName: file.originalName, mimeType: file.mimeType, size: file.size, sha256: file.sha256!,
    })),
  )
  if (!manifest || !verifyHandoverArtifacts(manifest, artifacts, project.clientId)) {
    return { blocked: true, reason: 'No complete, source-code-containing, scan-passed project artifact set is attached. Attach the intended source files and remove any secrets before retrying.' }
  }

  const existing = project.handovers
    .filter((handover) => handover.type === 'SOURCE_CODE')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  if (existing) {
    const existingManifest = parseHandoverManifest(existing.contents, project.id)
    if (!existingManifest) {
      return { blocked: true, reason: 'A legacy handover record has no verifiable artifact list. It requires operator review; no new release approval was created.' }
    }
    const expired = existing.status !== 'CONFIRMED' && (existing.status === 'EXPIRED' || Boolean(existing.expiryAt && existing.expiryAt <= new Date()))
    if (!expired) {
      // STAGE 9 — the delivery-ready notice is auto-sent; the FILE LINKS
      // are not included here. They are only released by the pending
      // Super Admin source-handover approval.
      await sendPipelineMessage({
        clientRowId: project.clientId,
        stage: 'FINAL_DELIVERY_READY',
        variables: pipelineVars(project.client),
        agentCode: 'HND-030',
      })
      return { blocked: false, handover: existing, reused: true }
    }
    // Create a new token + approval for an expired package. The old token stays
    // expired, and the new approval is bound to the current exact manifest.
  }

  const handover = await db.handoverRecord.create({
    data: {
      clientId: project.clientId,
      projectId: project.id,
      type: 'SOURCE_CODE',
      packageToken: publicToken(),
      status: 'PENDING_APPROVAL',
      paymentVerifiedAt: new Date(),
      contents: JSON.stringify(manifest),
      expiryAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  })
  await db.approvalRequest.create({
    data: {
      type: 'SOURCE_HANDOVER',
      title: `Release source code — ${project.code} (${project.client.clientId})`,
      description: `Full payment and completed tasks verified. Review and approve the exact ${manifest.files.length}-file artifact manifest; release packages the pinned file bytes.`,
      clientId: project.clientId,
      projectId: project.id,
      agentCode: 'HND-030',
      risk: 'HIGH',
      payload: JSON.stringify({ handoverId: handover.id, artifactIds: manifest.files.map((file) => file.id), manifest }),
      requestedBy: actor,
    },
  })
  await setStage(project.clientId, 'HANDOVER', 'Verified artifact manifest pending Super Admin approval')
  // STAGE 9 — the delivery-ready notice. The notice carries NO file link;
  // the links are released only through the approved handover.
  await sendPipelineMessage({
    clientRowId: project.clientId,
    stage: 'FINAL_DELIVERY_READY',
    variables: pipelineVars(project.client),
    agentCode: 'HND-030',
  })
  return { blocked: false, handover }
}

export async function releaseHandover(handoverId: string, adminUserId: string, approvalRequestId: string) {
  const approval = await db.approvalRequest.findUnique({ where: { id: approvalRequestId } })
  if (!approval || approval.type !== 'SOURCE_HANDOVER' || approval.status !== 'EXECUTING') {
    throw new Error('A pending Super Admin handover approval is required before release.')
  }
  let approvalPayload: Record<string, unknown>
  try {
    approvalPayload = JSON.parse(approval.payload || '{}') as Record<string, unknown>
  } catch {
    throw new Error('Approval payload is invalid.')
  }
  if (String(approvalPayload.handoverId ?? '') !== handoverId) throw new Error('Approval does not authorize this handover.')
  if (approval.decidedBy !== adminUserId) throw new Error('Approval executor does not match the deciding Super Admin.')

  const handover = await db.handoverRecord.findUnique({ where: { id: handoverId }, include: { project: true, client: true } })
  if (!handover) throw new Error('Handover record not found')
  if (handover.status !== 'PENDING_APPROVAL') throw new Error('Handover is not awaiting approval.')
  if (handover.expiryAt && handover.expiryAt <= new Date()) throw new Error('BLOCKED: handover package expired; prepare a fresh manifest and approval.')
  if (approval.clientId !== handover.clientId || approval.projectId !== handover.projectId || handover.project.clientId !== handover.clientId) {
    throw new Error('Approval and handover tenant do not match.')
  }

  const project = await db.project.findUnique({ where: { id: handover.projectId }, include: { payments: true, client: true, tasks: true } })
  if (!project) throw new Error('Project not found')
  const paid = project.payments.filter((payment) => payment.status === 'PAID').reduce((total, payment) => total + payment.amount, 0)
  const fullPayment = project.totalAmount > 0 ? paid >= project.totalAmount : paid > 0
  // The two non-negotiable rules, enforced in code: Source Code After
  // Full Payment, and an admin approval for every handover release.
  assertDeliveryRules({ paymentConfirmed: fullPayment, sourceCodeRelease: true, adminApproved: true })
  if (!fullPayment) throw new Error('BLOCKED: full payment verification required before releasing source code.')
  if (project.tasks.length === 0 || project.tasks.some((task) => task.status !== 'DONE')) {
    throw new Error('BLOCKED: every project task must be completed before releasing source code.')
  }

  const manifest = parseHandoverManifest(handover.contents, project.id)
  if (!manifest) throw new Error('BLOCKED: handover has no valid, project-bound artifact manifest.')
  const approvedManifest = parseHandoverManifest(JSON.stringify(approvalPayload.manifest ?? null), project.id)
  if (!approvedManifest || JSON.stringify(approvedManifest) !== JSON.stringify(manifest)) {
    throw new Error('BLOCKED: the approved artifact manifest no longer matches the package manifest.')
  }
  const approvedIds = Array.isArray(approvalPayload.artifactIds)
    ? approvalPayload.artifactIds.filter((id): id is string => typeof id === 'string').sort()
    : []
  const manifestIds = manifest.files.map((file) => file.id).sort()
  if (new Set(approvedIds).size !== approvedIds.length || JSON.stringify(approvedIds) !== JSON.stringify(manifestIds)) {
    throw new Error('BLOCKED: approval file list no longer matches the pinned manifest.')
  }

  const artifacts = await db.fileRecord.findMany({
    where: {
      id: { in: manifest.files.map((file) => file.id) },
      clientId: handover.clientId,
      projectId: project.id,
      relatedType: 'DELIVERY',
      scanStatus: 'CLEAN',
      classification: { in: ['PUBLIC', 'PRIVATE'] },
      content: { not: null },
      sha256: { not: null },
    },
    select: { id: true, originalName: true, mimeType: true, size: true, sha256: true, clientId: true, projectId: true, relatedType: true, scanStatus: true, classification: true, content: true },
  })
  if (!verifyHandoverArtifacts(manifest, artifacts, handover.clientId)) {
    throw new Error('BLOCKED: one or more approved artifact bytes, hashes, tenant links, or scan states changed.')
  }

  const now = new Date()
  await db.$transaction(async (tx) => {
    const claimed = await tx.handoverRecord.updateMany({
      where: { id: handover.id, clientId: handover.clientId, projectId: project.id, status: 'PENDING_APPROVAL' },
      data: { status: 'RELEASED', releasedBy: adminUserId, releasedAt: now, passwordChangeRequestedAt: now },
    })
    if (claimed.count !== 1) throw new Error('Handover was already released or changed by another request.')
    await tx.project.update({ where: { id: project.id }, data: { status: 'HANDOVER' } })
  })
  await setStage(project.clientId, 'HANDOVER', 'Exact approved artifact package released')

  const base = process.env.APP_PUBLIC_URL ?? ''
  const link = `${base}/api/handover/${handover.packageToken}/download`
  let notificationStatus = 'NOT_CONFIGURED'
  try {
    const channel = selectWelcomeChannel(project.client.source, project.client.preferredContact)
    let result: Awaited<ReturnType<typeof sendCommunication>> | null = null
    if (channel === 'WHATSAPP' && project.client.whatsapp) {
      result = await sendCommunication({
        clientId: project.client.id,
        channel,
        to: project.client.whatsapp,
        body: `Hi ${project.client.name}, your approved project package is available at ${link}. Please change any temporary passwords and confirm receipt and function after download. — Team Tech360`,
        agentCode: 'HND-030',
      })
    } else if (channel === 'EMAIL' && project.client.email) {
      result = await sendCommunication({
        clientId: project.client.id,
        channel,
        to: project.client.email,
        subject: 'Approved source package — secure download',
        body: emailTemplate('HANDOVER', { name: project.client.name, link }).body,
        agentCode: 'EML-012',
      })
    }
    if (result) notificationStatus = result.result.ok && result.result.status === 'SENT' ? 'PROVIDER_ACCEPTED' : 'FAILED'
    if (notificationStatus === 'FAILED') {
      await logError({ source: 'COMMS', code: 'HANDOVER_NOTIFICATION_FAILED', message: 'The approved package was released, but the selected provider did not accept the notification. The client was not reported as notified.', clientId: project.client.clientId, workflow: 'HANDOVER' })
    }
  } catch {
    notificationStatus = 'FAILED'
    await logError({ source: 'COMMS', code: 'HANDOVER_NOTIFICATION_FAILED', message: 'The approved package was released, but the selected provider notification could not be completed. The client was not reported as notified.', clientId: project.client.clientId, workflow: 'HANDOVER' }).catch(() => null)
  }

  await audit({
    actor: `admin:${adminUserId}`,
    action: 'SOURCE_HANDOVER_RELEASED',
    clientId: project.client.clientId,
    projectId: project.id,
    entityId: handover.id,
    details: { artifactCount: manifest.files.length, notificationStatus },
  })

  // STAGE 10 — the delivery is complete. The client is asked to confirm
  // receipt, function and the password change.
  await sendPipelineMessage({
    clientRowId: project.clientId,
    stage: 'FINAL_DELIVERY_COMPLETED',
    variables: pipelineVars(project.client),
    agentCode: 'HND-030',
    approvalId: approvalRequestId,
  })

  return { link, artifactCount: manifest.files.length, notificationStatus, status: 'RELEASED' as const }
}

export async function confirmDelivery(
  clientRowId: string,
  answers: { received: boolean; working: boolean; passwordsChanged: boolean; satisfied?: boolean; notes?: string },
  projectId?: string,
) {
  if (typeof answers.received !== 'boolean' || typeof answers.working !== 'boolean' || typeof answers.passwordsChanged !== 'boolean') {
    throw new Error('Explicit receipt, function, and password-change answers are required.')
  }
  const client = await db.client.findUnique({ where: { id: clientRowId } })
  if (!client) throw new Error('Client not found')
  const project = projectId
    ? await db.project.findUnique({ where: { id: projectId } })
    : await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } })
  if (!project) throw new Error('Project not found')
  if (project.clientId !== client.id) throw new Error('Project does not belong to this client')

  const decision = evaluateDeliveryAcceptance({ received: answers.received, working: answers.working })
  const handover = await db.handoverRecord.findFirst({
    where: { projectId: project.id, type: 'SOURCE_CODE' },
    orderBy: { createdAt: 'desc' },
  })
  if (decision.accepted && (!handover || !['DOWNLOADED', 'CONFIRMED'].includes(handover.status))) {
    throw new Error('The approved project package must be downloaded before delivery can be accepted.')
  }

  const now = new Date()
  const notes = sanitizeText(answers.notes, 2000) || null
  const confirmationAnswers = JSON.stringify({
    received: answers.received,
    working: answers.working,
    passwordsChanged: answers.passwordsChanged,
    satisfied: answers.satisfied,
    notes,
  })
  const existingDelivery = await db.delivery.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' } })
  const delivery = existingDelivery
    ? await db.delivery.update({
        where: { id: existingDelivery.id },
        data: { status: decision.status, clientConfirmedAt: decision.accepted ? now : null, confirmationAnswers },
      })
    : await db.delivery.create({
        data: {
          clientId: client.id,
          projectId: project.id,
          checklist: '{}',
          status: decision.status,
          clientConfirmedAt: decision.accepted ? now : null,
          confirmationAnswers,
        },
      })

  if (handover) {
    if (decision.accepted && answers.passwordsChanged) {
      await db.handoverRecord.update({
        where: { id: handover.id },
        data: { passwordChangeConfirmedAt: now, confirmedAt: now, status: 'CONFIRMED' },
      })
    } else if (!decision.accepted && handover.status === 'CONFIRMED') {
      await db.handoverRecord.update({ where: { id: handover.id }, data: { status: 'DOWNLOADED', confirmedAt: null } })
    }
  }

  if (!decision.accepted) {
    const followUpTitle = 'Client-reported delivery issue — human follow-up'
    const followUp = await db.projectTask.findFirst({
      where: { projectId: project.id, title: followUpTitle, assigneeType: 'HUMAN', status: { not: 'DONE' } },
    })
    const description = `Client reported ${decision.code.toLowerCase().replace(/_/g, ' ')}. ${notes ? `Details: ${notes}` : 'No additional notes were provided.'}`
    if (followUp) {
      await db.projectTask.update({ where: { id: followUp.id }, data: { description, status: 'TODO', priority: 'HIGH' } })
    } else {
      await db.projectTask.create({
        data: { projectId: project.id, title: followUpTitle, description, status: 'TODO', priority: 'HIGH', assigneeType: 'HUMAN' },
      })
    }
    await setStage(client.id, 'DELIVERY', 'Client reported a delivery issue; human follow-up is required')
  } else {
    await setStage(client.id, 'PASSWORD_CHANGE', answers.passwordsChanged ? 'Delivery accepted and password change confirmed' : 'Delivery accepted; password change confirmation remains pending')
  }

  await rememberMemory({
    scope: 'CLIENT',
    key: `delivery:${project.id}`,
    content: `Delivery response recorded at ${now.toISOString()}: accepted=${decision.accepted}, received=${answers.received}, working=${answers.working}, passwordsChanged=${answers.passwordsChanged}.`,
    clientId: client.id,
    importance: 8,
  })
  return { delivery, accepted: decision.accepted, code: decision.accepted ? 'ACCEPTED' : decision.code }
}

// ------------------------------------------------------------
// STEP 12 — Optional review/referral + closure
// ------------------------------------------------------------
export async function requestReviewAndReferral(clientRowId: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { projects: { orderBy: { createdAt: 'desc' }, take: 1 } } })
  if (!client) throw new Error('Client not found')

  // Create the real Review slot (client submits content via portal → admin moderates)
  const projectId = client.projects[0]?.id ?? null
  const existingReview = await db.review.findFirst({ where: { clientId: client.id } })
  const review = existingReview
    ? await db.review.update({ where: { id: existingReview.id }, data: { status: existingReview.status === 'PENDING' ? 'PENDING' : existingReview.status } })
    : await db.review.create({ data: { clientId: client.id, projectId, status: 'PENDING', published: false, consent: false } })

  // Create the real Referral record (client submits via portal → admin tracks conversion)
  const existingReferral = await db.referral.findFirst({ where: { clientId: client.id } })
  const referral = existingReferral
    ? existingReferral
    : await db.referral.create({ data: { clientId: client.id, status: 'REQUESTED', notes: 'Requested after delivery confirmation' } })

  await setStage(client.id, 'REVIEW_REQUESTED', 'Review requested (optional)')
  // STAGE 11 — the project is closed. The review request and the optional
  // recommendation request are on the auto-send list.
  const sent = await sendPipelineMessage({
    clientRowId: client.id,
    stage: 'PROJECT_CLOSED',
    variables: pipelineVars(client),
    agentCode: 'RSK-036',
  })
  await setStage(client.id, 'REFERRAL_REQUESTED', 'Referral requested (optional)')
  await rememberMemory({ scope: 'CLIENT', key: `review-request:${client.id}`, content: `Review + referral requested after delivery. Review slot ${review.id} (PENDING), referral record ${referral.id} (REQUESTED). Client submits via portal.`, clientId: client.id, importance: 6 })
  return { ok: true, reviewId: review.id, referralId: referral.id, projectId, sent }
}

export async function closeProject(projectId: string, actor: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true, payments: true, tasks: true, deliveries: true, handovers: true },
  })
  if (!project) throw new Error('Project not found')
  const paid = project.payments.filter((payment) => payment.status === 'PAID').reduce((total, payment) => total + payment.amount, 0)
  const delivery = project.deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  const handover = project.handovers
    .filter((row) => row.type === 'SOURCE_CODE')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  let deliveryAnswers: { received: boolean; working: boolean } | null = null
  try {
    const parsed = JSON.parse(delivery?.confirmationAnswers ?? 'null') as Record<string, unknown> | null
    if (parsed && typeof parsed.received === 'boolean' && typeof parsed.working === 'boolean') {
      deliveryAnswers = { received: parsed.received, working: parsed.working }
    }
  } catch {
    deliveryAnswers = null
  }
  const closure = evaluateProjectClosure({
    totalAmount: project.totalAmount,
    paidAmount: paid,
    taskStatuses: project.tasks.map((task) => task.status),
    deliveryStatus: delivery?.status,
    deliveryAnswers,
    handoverStatus: handover?.status,
  })
  if (!closure.allowed) {
    const reasons = {
      PAYMENT_INCOMPLETE: 'full payment not verified',
      TASKS_INCOMPLETE: 'one or more project tasks are incomplete',
      DELIVERY_NOT_ACCEPTED: 'client delivery acceptance is not confirmed',
      HANDOVER_NOT_CONFIRMED: 'source handover acceptance is not confirmed',
    }
    throw new Error(`Cannot close: ${reasons[closure.code]}.`)
  }
  await db.project.update({ where: { id: projectId }, data: { status: 'COMPLETED', closedAt: new Date() } })
  await setStage(project.clientId, 'COMPLETED', 'Project completed')
  await db.client.update({ where: { id: project.clientId }, data: { status: 'COMPLETED' } })
  await audit({ actor, action: 'PROJECT_CLOSED', clientId: project.client.clientId, projectId, details: { paid, total: project.totalAmount } })
  return { ok: true }
}
