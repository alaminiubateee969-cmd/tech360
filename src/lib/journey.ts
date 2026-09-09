import { db } from '@/lib/db'
import { nextClientId, nextProjectCode, nextInvoiceNumber, publicToken } from '@/lib/ids'
import { runAgent, rememberMemory, recallMemory } from '@/lib/agents/engine'
import { sendCommunication, emailTemplate, wrapEmailHtml, escapeHtml } from '@/lib/comms'
import { newCorrelationId, logError, audit, sanitizeText } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'

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
  tracking?: unknown
  formId?: string
}): Promise<{ clientId: string; clientRowId: string; logId: string }> {
  const log = await startLog('LEAD_INTAKE', input.source, undefined, input)
  try {
    // De-dupe by email / whatsapp / phone
    let existing: Awaited<ReturnType<typeof db.client.findFirst>> = null
    if (input.email) existing = await db.client.findFirst({ where: { email: input.email, deletedAt: null } })
    if (!existing && (input.whatsapp || input.phone)) {
      const tel = input.whatsapp ?? input.phone
      existing = await db.client.findFirst({ where: { OR: [{ whatsapp: tel }, { phone: tel }], deletedAt: null } })
    }

    let clientRow: Awaited<ReturnType<typeof db.client.findFirst>>
    if (existing) {
      clientRow = await db.client.update({
        where: { id: existing.id },
        data: {
          name: existing.name || input.name || 'Unknown',
          businessName: existing.businessName ?? input.businessName ?? null,
          email: existing.email ?? input.email ?? null,
          whatsapp: existing.whatsapp ?? input.whatsapp ?? null,
          phone: existing.phone ?? input.phone ?? null,
          country: existing.country ?? input.country ?? null,
        },
      })
    } else {
      const clientId = await nextClientId()
      clientRow = await db.client.create({
        data: {
          clientId,
          name: sanitizeText(input.name, 200) || 'Unknown Contact',
          businessName: sanitizeText(input.businessName, 200) || null,
          businessType: input.businessType || null,
          email: input.email || null,
          phone: input.phone || null,
          whatsapp: input.whatsapp || null,
          country: input.country || null,
          source: input.source,
          status: 'LEAD',
          pipelineStage: 'NEW',
          preferredContact: input.preferredContact || null,
        },
      })
      await rememberMemory({ scope: 'CLIENT', key: `origin:${clientRow.id}`, content: `Client originated from ${input.source} on ${new Date().toISOString()}. First message: ${sanitizeText(input.message, 500)}`, clientId: clientRow.id, importance: 7 })
    }

    if (input.formId) {
      await db.formSubmission.update({ where: { id: input.formId }, data: { clientId: clientRow.id, status: 'PROCESSED' } }).catch(() => null)
    }

    // Save the original inbound message
    await db.communication.create({
      data: {
        clientId: clientRow.id, channel: input.source, direction: 'IN',
        sender: input.name ?? null, body: sanitizeText(input.message, 8000),
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

    // Auto-advance: business detection
    await detectBusiness(clientRow.id, input.message)

    await setStage(clientRow.id, 'CONTACTED', 'First message processed')
    await finishLog(log.id, 'SUCCESS', { clientId: clientRow.clientId, leadId: lead.id })

    // Send honest welcome (WhatsApp if configured, else email if configured — else logged only)
    const whatsapp = clientRow.whatsapp
    const email = clientRow.email
    if (whatsapp) {
      const tpl = emailTemplate('WELCOME', { name: clientRow.name })
      const r = await sendCommunication({ clientId: clientRow.id, channel: 'WHATSAPP', to: whatsapp, body: `Hi ${clientRow.name}, thank you for contacting Tech360. Your reference ID is ${clientRow.clientId}. Our team is reviewing your requirements and will reply shortly. — Team Tech360`, agentCode: 'EML-012', workflowId: log.id })
      await stepLog(log.id, 'welcome_whatsapp', { status: r.result.status })
    }
    if (email) {
      const r = await sendCommunication({
        clientId: clientRow.id, channel: 'EMAIL', to: email, subject: 'Welcome to Tech360 — we received your request',
        body: emailTemplate('WELCOME', { name: clientRow.name, extra: '' }).body.replace('{{clientId}}', clientRow.clientId),
        agentCode: 'EML-012', workflowId: log.id,
      })
      await stepLog(log.id, 'welcome_email', { status: r.result.status })
    }

    return { clientId: clientRow.clientId, clientRowId: clientRow.id, logId: log.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await finishLog(log.id, 'FAILED', undefined, msg)
    await logError({ source: 'AUTOMATION', code: 'LEAD_INTAKE_FAILED', message: msg, workflow: 'LEAD_INTAKE' })
    throw e
  }
}

// ------------------------------------------------------------
// STEP 2 — Business detection (AI, real execution)
// ------------------------------------------------------------
export async function detectBusiness(clientRowId: string, messageText?: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (!client) throw new Error('Client not found')
  const text = messageText ?? client.lead?.requirements ?? `${client.businessName ?? ''} ${client.name}`
  const run = await runAgent('BIZ-004', {
    input: `Business name: ${client.businessName ?? 'unknown'}\nContact name: ${client.name}\nMessage: ${text}`,
    clientId: client.id, workflow: 'BUSINESS_DETECTION', expectJson: true,
  })
  if (run.ok && run.json) {
    const businessType = sanitizeText(run.json.businessType, 80)
    await db.client.update({ where: { id: client.id }, data: { businessType } })
    await setStage(client.id, 'BUSINESS_IDENTIFIED', 'AI business detection')
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
    const plan = sanitizeText(run.json.plan, 120)
    await db.client.update({ where: { id: client.id }, data: {} })
    await db.lead.update({ where: { clientId: client.id }, data: { interest: plan } }).catch(() => null)
    await setStage(client.id, 'PLAN_RECOMMENDED', 'AI plan recommendation')
    await rememberMemory({ scope: 'CLIENT', key: `plan:${client.id}`, content: `Recommended plan: ${plan}. Rationale: ${sanitizeText(String(run.json.rationale ?? ''), 800)}`, clientId: client.id, importance: 6, agentCode: 'PLN-005' })
  }
  return run
}

// ------------------------------------------------------------
// STEP 4 — Scope discovery questions (AI) → sent via best channel
// ------------------------------------------------------------
export async function askScopeQuestions(clientRowId: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (!client) throw new Error('Client not found')
  const run = await runAgent('SCP-006', {
    input: `Business type: ${client.businessType ?? 'unknown'}\nPlan of interest: ${client.lead?.interest ?? 'unknown'}\nRequirements so far: ${client.lead?.requirements ?? ''}`,
    clientId: client.id, workflow: 'SCOPE_COLLECTION',
  })
  let delivery: string[] = []
  if (run.ok && run.output) {
    await setStage(client.id, 'SCOPE_COLLECTION', 'Scope questions sent')
    if (client.whatsapp) {
      const r = await sendCommunication({ clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: run.output, agentCode: 'COM-010', workflowId: run.executionId })
      delivery.push(`WHATSAPP:${r.result.status}`)
    }
    if (client.email) {
      const r = await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'A few questions about your project — Tech360', body: emailTemplate('SCOPE_QUESTIONS', { name: client.name, extra: `<div>${run.output.replace(/\n/g, '<br/>')}</div>` }).body, agentCode: 'EML-012', workflowId: run.executionId })
      delivery.push(`EMAIL:${r.result.status}`)
    }
    if (delivery.length === 0) delivery = ['LOGGED_ONLY: no channel contact available']
  }
  return { run, delivery }
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

  if (client.whatsapp) {
    const r = await sendCommunication({ clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: scopeText, agentCode: 'WAP-011', workflowId: log.id })
    results.push(`WHATSAPP:${r.result.status}`)
  }
  if (client.email) {
    const r = await sendCommunication({
      clientId: client.id, channel: 'EMAIL', to: client.email, subject: `Your Final Scope of Work — ${client.clientId}`,
      body: emailTemplate('FINAL_SCOPE', { name: client.name, extra: `<div>${escapeHtml(scopeText).replace(/\n/g, '<br/>')}</div>` }).body,
      agentCode: 'EML-012', workflowId: log.id,
    })
    results.push(`EMAIL:${r.result.status}`)
  }
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
    await rememberMemory({ scope: 'CLIENT', key: `approval:${client.id}`, content: `Client approved final scope v${finalScope.version} at ${new Date().toISOString()}`, clientId: client.id, importance: 8 })
    return { next: 'REQUEST_PREVIEW' }
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
    return { next: 'ADMIN_APPROVAL', newScopeId }
  }
  // CLARIFICATION → meeting only when client asks
  const meeting = await db.meeting.create({
    data: { clientId: client.id, reason: sanitizeText(notes, 1000) || 'Client requested clarification', status: 'REQUESTED' },
  })
  await setStage(client.id, 'FINAL_SCOPE', 'Meeting requested by client')
  const run = await runAgent('MTG-015', { input: `Client ${client.name} (${client.clientId}) requests clarification about final scope. Timezone preference: ${client.country ?? 'Asia/Dhaka'}`, clientId: client.id, workflow: 'MEETING', expectJson: true })
  if (run.ok && run.json) {
    await db.meeting.update({ where: { id: meeting.id }, data: { status: 'SCHEDULED', notes: run.output.slice(0, 2000) } })
  }
  return { next: 'MEETING', meetingId: meeting.id }
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
  const existing = await db.preview.count({ where: { clientId: client.id } })
  const token = publicToken()
  const html = buildPreviewHtml(client, content, existing + 1)

  const preview = await db.preview.create({
    data: {
      token, clientId: client.id, projectId: null, scopeVersion: finalScope.version,
      version: existing + 1, status: 'GENERATED', html,
    },
  })
  await db.previewEvent.create({ data: { previewId: preview.id, type: 'GENERATED' } })

  // send preview link
  const base = process.env.APP_PUBLIC_URL ?? ''
  const link = `${base}/api/preview/${token}`
  if (client.whatsapp) {
    await sendCommunication({ clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: `Hi ${client.name}, your project preview is ready: ${link} — review before payment, then reply APPROVED or send change requests. — Team Tech360`, agentCode: 'WAP-011' })
  }
  if (client.email) {
    await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Your project preview is ready', body: emailTemplate('PREVIEW', { name: client.name, link }).body, agentCode: 'EML-012' })
  }
  await db.preview.update({ where: { id: preview.id }, data: { status: 'SENT', sentAt: new Date() } })
  await db.previewEvent.create({ data: { previewId: preview.id, type: 'SENT' } })
  return { previewId: preview.id, token, link }
}

function buildPreviewHtml(client: { clientId: string; name: string; businessName: string | null }, content: Record<string, unknown>, version: number): string {
  const items = Array.isArray(content.items) ? (content.items as Array<Record<string, string>>) : []
  const timeline = Array.isArray(content.timeline) ? (content.timeline as Array<Record<string, string>>) : []
  const pp = (content.paymentPolicy ?? {}) as Record<string, unknown>
  const itemRows = items.map((i) => `<div class="card"><h3>${escapeHtml(i.name ?? '')}</h3><p>${escapeHtml(i.description ?? '')}</p><div class="tag">Deliverable: ${escapeHtml(i.deliverable ?? 'as described')}</div></div>`).join('')
  const timelineRows = timeline.map((t) => `<li><strong>${escapeHtml(t.phase ?? '')}</strong> <span>(${escapeHtml(String(t.weeks ?? '?'))} week${String(t.weeks ?? '') === '1' ? '' : 's'})</span><p>${escapeHtml(t.activities ?? '')}</p></li>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Project Preview — Tech360</title><style>
:root{--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--acc:#16a34a;--bg:#f8fafc}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
header{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:48px 24px;text-align:center}
header .b{font-size:28px;font-weight:800;letter-spacing:.5px}header .b em{color:#4ade80;font-style:normal}
header p{color:#94a3b8;margin:6px 0 0}
main{max-width:880px;margin:0 auto;padding:32px 20px}
.ref{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:99px;padding:8px 18px;font-weight:600;margin-bottom:18px}
h2{margin:28px 0 12px;font-size:20px}.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:12px}
.card h3{margin:0 0 6px;font-size:16px}.card p{margin:0;color:var(--mut);font-size:14px;line-height:1.6}
.tag{margin-top:10px;display:inline-block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-size:12px;padding:4px 10px;border-radius:99px}
ol{padding-left:0;list-style:none}ol li{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:10px}
ol li span{color:var(--acc);font-size:13px}ol li p{color:var(--mut);font-size:14px;margin:6px 0 0}
.pay{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;display:flex;gap:16px;flex-wrap:wrap}
.pay div{flex:1;min-width:140px;text-align:center}.pay b{font-size:24px;color:var(--acc)}.pay small{color:var(--mut)}
.note{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 18px;font-size:14px;color:#92400e;margin:22px 0}
footer{margin:40px 0 24px;text-align:center;color:var(--mut);font-size:12px;line-height:1.7}
.acts{display:flex;gap:12px;justify-content:center;margin-top:26px;flex-wrap:wrap}
.btn{padding:13px 30px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block}
.btn-a{background:var(--acc);color:#fff}.btn-r{background:#fff;color:var(--ink);border:1px solid var(--line)}
</style></head><body>
<header><div class="b">Tech<em>360</em></div><p>Project Preview — for your review</p></header>
<main>
<div class="ref">Reference ${escapeHtml(client.clientId)} · Preview v${version}</div>
<h2>Hello ${escapeHtml(client.name)}${client.businessName ? ` · ${escapeHtml(client.businessName)}` : ''}</h2>
<p style="color:var(--mut)">This is the working preview of your project scope, generated from your approved requirements. Review everything below — no payment is due until you approve.</p>
<h2>Deliverables</h2>${itemRows || '<div class="card"><p>Scope items will appear here.</p></div>'}
<h2>Timeline</h2><ol>${timelineRows}</ol>
<h2>Payment Plan</h2>
<div class="pay">
<div><b>${escapeHtml(String(pp.advancePct ?? '—'))}%</b><br/><small>Advance</small></div>
<div><b>${escapeHtml(String(pp.milestonePct ?? '—'))}%</b><br/><small>On milestone</small></div>
<div><b>${escapeHtml(String(pp.finalPct ?? '—'))}%</b><br/><small>On final delivery</small></div>
</div>
<div class="note"><strong>Our promise:</strong> HTML Preview Before Payment · Source Code After Full Payment · Changes to approved scope may require additional cost/time.</div>
<div class="acts"><a class="btn btn-a" href="#approve" id="approveBtn">✓ Approve this preview</a><a class="btn btn-r" href="#revise" id="reviseBtn">Request changes</a></div>
</main>
<footer>TECH360 LLC · Harrisonville, MO, USA · info@bdtech360.com · wa.me/8801327100297<br/>This preview is confidential and intended for the addressed recipient.</footer>
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
  if (client.whatsapp) {
    const r = await sendCommunication({ clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: message, agentCode: 'PAY-016' })
    results.push(`WHATSAPP:${r.result.status}`)
  }
  if (client.email) {
    const r = await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Payment instructions — Tech360', body: emailTemplate('PAYMENT', { name: client.name, extra: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(instructions)}</pre>` }).body, agentCode: 'EML-012' })
    results.push(`EMAIL:${r.result.status}`)
  }
  await setStage(client.id, 'PAYMENT_PENDING', 'Payment requested')
  await audit({ actor, action: 'PAYMENT_REQUESTED', clientId: client.clientId, details: { results } })
  return { instructions, results }
}

export async function recordPayment(clientRowId: string, input: { amount: number; currency?: string; method?: string; transactionId?: string; milestone?: string; notes?: string }) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { projects: true } })
  if (!client) throw new Error('Client not found')
  const project = client.projects.filter((p) => !['COMPLETED', 'CANCELLED'].includes(p.status)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  const payment = await db.payment.create({
    data: {
      clientId: client.id, projectId: project?.id ?? null,
      amount: input.amount, currency: input.currency ?? 'USD',
      method: input.method ?? null, transactionId: input.transactionId || undefined,
      milestone: input.milestone ?? null, notes: sanitizeText(input.notes, 2000) || null,
      status: 'PENDING',
    },
  })
  return payment
}

export async function verifyPayment(paymentId: string, adminUserId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { client: true, project: true } })
  if (!payment) throw new Error('Payment not found')
  await db.payment.update({ where: { id: payment.id }, data: { status: 'PAID', verifiedBy: adminUserId, verifiedAt: new Date() } })
  const client = payment.client
  const project = payment.project

  if (project) {
    const paid = await db.payment.aggregate({ where: { projectId: project.id, status: 'PAID' }, _sum: { amount: true } })
    const paidSum = paid._sum.amount ?? 0
    const paymentStatus = paidSum >= project.totalAmount && project.totalAmount > 0 ? 'PAID' : paidSum > 0 ? 'PARTIAL' : 'PENDING'
    await db.project.update({ where: { id: project.id }, data: { paidAmount: paidSum, paymentStatus } })
    await db.invoice.updateMany({ where: { projectId: project.id }, data: { status: paymentStatus } }).catch(() => null)
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
  // confirmation email
  if (client?.email) {
    await sendCommunication({
      clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Payment received — thank you',
      body: emailTemplate('PAYMENT_CONFIRMED', { name: client.name, extra: `<p>Payment of <strong>${payment.amount} ${payment.currency}</strong> verified on ${new Date().toDateString()}.</p>` }).body, agentCode: 'EML-012',
    })
  }
  await audit({ actor: `admin:${adminUserId}`, action: 'PAYMENT_VERIFIED', clientId: client?.clientId, entityId: payment.id, details: { amount: payment.amount, currency: payment.currency } })
  return { ok: true }
}

// ------------------------------------------------------------
// STEP 10 — Project activation + AI task breakdown
// ------------------------------------------------------------
export async function activateProject(clientRowId: string, projectId?: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true, projects: true, scopes: true } })
  if (!client) throw new Error('Client not found')
  let project = projectId ? await db.project.findUnique({ where: { id: projectId } }) : null
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
  } else {
    project = await db.project.update({ where: { id: project.id }, data: { status: 'ACTIVE', startedAt: project.startedAt ?? new Date() } })
  }

  await setStage(client.id, 'PROJECT_ACTIVE', `Project ${project.code} active`)

  // AI task breakdown (Anchor)
  const run = await runAgent('PRJ-018', {
    input: `Create task breakdown for project ${project.code}: ${project.name}\nScope: ${project.description ?? ''}\nPlan: ${project.plan ?? 'unknown'}`,
    clientId: client.id, projectId: project.id, workflow: 'PROJECT_TASKS', expectJson: true,
  })
  if (run.ok && run.json && Array.isArray(run.json.tasks)) {
    let order = 0
    for (const t of (run.json.tasks as Array<Record<string, unknown>>)) {
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
  // Delivery record
  await db.delivery.create({ data: { clientId: client.id, projectId: project.id } })
  return { project, taskRun: run }
}

// ------------------------------------------------------------
// STEP 11 — Completion / final payment / handover gates
// ------------------------------------------------------------
export async function prepareHandover(clientRowId: string, projectId: string, actor: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { client: true, payments: true, handovers: true, deliveries: true } })
  if (!project) throw new Error('Project not found')
  const paid = project.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0)
  const fullPayment = project.totalAmount > 0 ? paid >= project.totalAmount : paid > 0
  if (!fullPayment) {
    await logError({ source: 'AUTOMATION', code: 'HANDOVER_BLOCKED', message: `Handover blocked for ${project.code}: payment incomplete (${paid}/${project.totalAmount})`, clientId: project.client.clientId, workflow: 'HANDOVER' })
    return { blocked: true, reason: `Full payment verification required before source code handover. Paid: ${paid} ${project.currency} of ${project.totalAmount} ${project.currency}.` }
  }
  const existing = project.handovers.filter((h) => h.type === 'SOURCE_CODE')[0]
  if (existing) return { blocked: false, handover: existing }

  const token = publicToken()
  const run = await runAgent('HND-030', {
    input: `Prepare handover manifest for project ${project.code} (${project.name}). Client: ${project.client.clientId}. Full payment verified: ${fullPayment}.`,
    clientId: project.clientId, projectId: project.id, workflow: 'HANDOVER', expectJson: true,
  })
  const handover = await db.handoverRecord.create({
    data: {
      clientId: project.clientId, projectId: project.id, type: 'SOURCE_CODE',
      packageToken: token, status: 'PENDING_APPROVAL',
      paymentVerifiedAt: new Date(),
      contents: run.output.slice(0, 8000),
      expiryAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  })
  await db.approvalRequest.create({
    data: {
      type: 'SOURCE_HANDOVER', title: `Release source code — ${project.code} (${project.client.clientId})`,
      description: 'Full payment verified. Approve release of the source-code package to the client.',
      clientId: project.clientId, agentCode: 'HND-030', risk: 'HIGH',
      payload: JSON.stringify({ handoverId: handover.id }), requestedBy: actor,
    },
  })
  await setStage(project.clientId, 'HANDOVER', 'Handover pending admin approval')
  return { blocked: false, handover }
}

export async function releaseHandover(handoverId: string, adminUserId: string) {
  const handover = await db.handoverRecord.findUnique({ where: { id: handoverId }, include: { project: true, client: true } })
  if (!handover) throw new Error('Handover record not found')
  const project = await db.project.findUnique({ where: { id: handover.projectId }, include: { payments: true, client: true } })
  if (!project) throw new Error('Project not found')
  const paid = project.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0)
  if (project.totalAmount > 0 && paid < project.totalAmount) {
    throw new Error('BLOCKED: full payment verification required before releasing source code.')
  }
  await db.handoverRecord.update({
    where: { id: handover.id },
    data: { status: 'RELEASED', releasedBy: adminUserId, releasedAt: new Date() },
  })
  await db.project.update({ where: { id: project.id }, data: { status: 'HANDOVER' } })
  const base = process.env.APP_PUBLIC_URL ?? ''
  const link = `${base}/api/handover/${handover.packageToken}/download`
  const client = project.client
  if (client.whatsapp) {
    await sendCommunication({ clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: `Hi ${client.name}, your source package is ready (project ${project.code}). Secure download (valid 14 days): ${link} — After downloading, please change all temporary passwords and confirm. — Team Tech360`, agentCode: 'HND-030' })
  }
  if (client.email) {
    await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Source code handover — secure download', body: emailTemplate('HANDOVER', { name: client.name, link }).body, agentCode: 'EML-012' })
  }
  await db.handoverRecord.update({ where: { id: handover.id }, data: { passwordChangeRequestedAt: new Date() } })
  await audit({ actor: `admin:${adminUserId}`, action: 'SOURCE_HANDOVER_RELEASED', clientId: client.clientId, projectId: project.id, details: { packageToken: handover.packageToken } })
  return { link }
}

export async function confirmDelivery(clientRowId: string, answers: { received: boolean; working: boolean; passwordsChanged: boolean; satisfied?: boolean }) {
  const client = await db.client.findUnique({ where: { id: clientRowId }, include: { projects: true } })
  if (!client) throw new Error('Client not found')
  const project = client.projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  if (!project) throw new Error('Project not found')
  const delivery = await db.delivery.upsert({
    where: { id: (await db.delivery.findFirst({ where: { projectId: project.id } }))?.id ?? 'none' },
    create: { clientId: client.id, projectId: project.id, status: 'CONFIRMED', clientConfirmedAt: new Date(), confirmationAnswers: JSON.stringify(answers) },
    update: { status: 'CONFIRMED', clientConfirmedAt: new Date(), confirmationAnswers: JSON.stringify(answers) },
  }).catch(async () => {
    const existing = await db.delivery.findFirst({ where: { projectId: project.id } })
    if (existing) return db.delivery.update({ where: { id: existing.id }, data: { status: 'CONFIRMED', clientConfirmedAt: new Date(), confirmationAnswers: JSON.stringify(answers) } })
    return db.delivery.create({ data: { clientId: client.id, projectId: project.id, status: 'CONFIRMED', clientConfirmedAt: new Date(), confirmationAnswers: JSON.stringify(answers) } })
  })
  const handover = await db.handoverRecord.findFirst({ where: { projectId: project.id, type: 'SOURCE_CODE' } })
  if (handover && answers.passwordsChanged) {
    await db.handoverRecord.update({ where: { id: handover.id }, data: { passwordChangeConfirmedAt: new Date(), status: 'CONFIRMED' } })
  }
  await setStage(client.id, 'PASSWORD_CHANGE', answers.passwordsChanged ? 'Password change confirmed' : 'Delivery confirmed, password change pending')
  await rememberMemory({ scope: 'CLIENT', key: `delivery:${client.id}`, content: `Delivery confirmed at ${new Date().toISOString()}: received=${answers.received}, working=${answers.working}, passwordsChanged=${answers.passwordsChanged}, satisfied=${answers.satisfied ?? 'n/a'}`, clientId: client.id, importance: 8 })
  return { delivery }
}

// ------------------------------------------------------------
// STEP 12 — Optional review/referral + closure
// ------------------------------------------------------------
export async function requestReviewAndReferral(clientRowId: string) {
  const client = await db.client.findUnique({ where: { id: clientRowId } })
  if (!client) throw new Error('Client not found')
  await setStage(client.id, 'REVIEW_REQUESTED', 'Review requested (optional)')
  if (client.email) {
    await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'How was your experience with Tech360?', body: emailTemplate('REVIEW_REQUEST', { name: client.name }).body, agentCode: 'RSK-036' })
  }
  await setStage(client.id, 'REFERRAL_REQUESTED', 'Referral requested (optional)')
  if (client.email) {
    await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Know a business that needs software?', body: emailTemplate('REFERRAL_REQUEST', { name: client.name }).body, agentCode: 'RSK-036' })
  }
  return { ok: true }
}

export async function closeProject(projectId: string, actor: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { client: true, payments: true } })
  if (!project) throw new Error('Project not found')
  const paid = project.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0)
  const fullPayment = project.totalAmount > 0 ? paid >= project.totalAmount : paid > 0
  const handover = await db.handoverRecord.findFirst({ where: { projectId, type: 'SOURCE_CODE' } })
  if (!fullPayment) throw new Error('Cannot close: full payment not verified.')
  if (project.status !== 'HANDOVER' && !handover) throw new Error('Cannot close: handover not completed.')
  await db.project.update({ where: { id: projectId }, data: { status: 'COMPLETED', closedAt: new Date() } })
  await setStage(project.clientId, 'COMPLETED', 'Project completed')
  await db.client.update({ where: { id: project.clientId }, data: { status: 'COMPLETED' } })
  await audit({ actor, action: 'PROJECT_CLOSED', clientId: project.client.clientId, projectId, details: { paid, total: project.totalAmount } })
  return { ok: true }
}
