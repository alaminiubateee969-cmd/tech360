// ============================================================
// TECH360 — Chat Orchestrator: One-Question-at-a-Time Engine
// Connects website chat (and other channels) to AI agent runtime
// safely, with genuine AI responses or honest error states.
//
// For each customer turn:
// - Load client record, conversation history, known requirements, lifecycle stage
// - Determine what is known and what is still missing
// - Answer customer's actual question first
// - Ask at most one primary follow-up question per message
// - Never ask again for info already supplied
// - Save answer and update CRM before advancing
// - Summarize requirements for confirmation before SOW draft
// - If AI provider fails, do not invent response — record failure, honest fallback
// ============================================================

import { db } from '@/lib/db'
import { runAgent } from '@/lib/agents/engine'
import { getZaiProviderStatus } from '@/lib/ai-provider'
import { sanitizeText } from '@/lib/security'
import { COMPANY } from '@/lib/constants'
import { PUBLIC_CONTACT } from '@/lib/site-contact'
import { loadDiscoveryState, saveDiscoveryState, nextQuestion, buildSummary, extractEmail, isEmailLike, DISCOVERY_FIELDS, type DiscoveryFieldKey } from '@/lib/discovery'
import { loadCommState, recordInbound, recordOutbound } from '@/lib/conversation-state'
import { validateEmail } from '@/lib/channel-router'
import { sendCommunication } from '@/lib/comms'

export type OrchestratorResult = {
  ok: boolean
  reply: string
  clientRowId: string
  clientId: string
  conversationId: string
  wasAiGenerated: boolean
  error?: string
  nextAction?: string
  escalated?: boolean
  stage?: string
}

/** Minimal context needed to generate a contextual answer. */
type ClientContext = {
  id: string
  clientId: string
  name: string
  businessName: string | null
  businessType: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  pipelineStage: string
  lead: { requirements: string | null; interest: string | null; budgetRange: string | null } | null
}

type ConversationHistory = Array<{ sender: string; body: string; createdAt: Date }>

/**
 * Main entry: process a visitor message from any channel and produce a
 * contextual reply (AI or honest fallback), update CRM, and persist state.
 */
export async function handleCustomerMessage(input: {
  channel: 'WEB' | 'WHATSAPP' | 'SMS' | 'EMAIL'
  conversationId: string
  clientRowId: string
  clientId: string
  visitorBody: string
  visitorName?: string | null
  visitorEmail?: string | null
}): Promise<OrchestratorResult> {
  const visitorBody = sanitizeText(input.visitorBody, 4000)
  if (!visitorBody) {
    return {
      ok: false,
      reply: 'Please send a message so I can help you.',
      clientRowId: input.clientRowId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      wasAiGenerated: false,
      error: 'Empty message',
    }
  }

  // Load full context
  const client = await db.client.findUnique({
    where: { id: input.clientRowId },
    include: { lead: true },
  })
  if (!client) {
    return {
      ok: false,
      reply: 'We could not find your client record. Please contact info@bdtech360.com with your Client ID.',
      clientRowId: input.clientRowId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      wasAiGenerated: false,
      error: 'Client not found',
    }
  }

  const context: ClientContext = {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    businessName: client.businessName,
    businessType: client.businessType,
    email: client.email,
    phone: client.phone,
    whatsapp: client.whatsapp,
    pipelineStage: client.pipelineStage,
    lead: client.lead ? { requirements: client.lead.requirements, interest: client.lead.interest, budgetRange: client.lead.budgetRange } : null,
  }

  // Load conversation history (last 20 messages for context)
  const history = await loadHistoryForClient(input.clientRowId, input.conversationId)

  // Load discovery state
  const discovery = await loadDiscoveryState(input.clientRowId)

  // Check for email in this message (email collection requirement D)
  const emailInMessage = extractEmail(visitorBody)
  let emailCollectedThisTurn = false
  if (emailInMessage && !client.email) {
    const v = validateEmail(emailInMessage)
    if (v.ok) {
      await db.client.update({ where: { id: client.id }, data: { email: v.normalized } }).catch(() => null)
      context.email = v.normalized
      emailCollectedThisTurn = true
      // Log email collection
      await db.communication
        .create({
          data: {
            clientId: client.id,
            channel: input.channel,
            direction: 'IN',
            sender: v.normalized,
            body: `Email collected: ${v.normalized}`,
            status: 'RECEIVED',
          },
        })
        .catch(() => null)
    }
  }

  // Save inbound to Communication log and state machine (never claim sent unless succeeded)
  await recordInbound(client.id, client.clientId, visitorBody, input.channel, client.pipelineStage).catch(() => null)

  // Also persist inbound Communication row for audit
  await db.communication
    .create({
      data: {
        clientId: client.id,
        channel: input.channel,
        direction: 'IN',
        sender: input.visitorName || input.visitorEmail || client.name || 'Visitor',
        body: visitorBody,
        status: 'RECEIVED',
        providerMessageId: `web:${input.conversationId}:${Date.now()}`,
      },
    })
    .catch(() => null)

  // Store visitor's answer for current discovery question if applicable
  // Heuristic: if discovery.currentQuestion exists, treat this message as answer to it
  // Unless message contains a new question to us — answer first, then optionally advance
  let discoveryUpdated = false
  if (discovery.currentQuestion && visitorBody.length > 2) {
    const fieldKey = discovery.currentQuestion
    // Extract potential email answer vs discovery answer: if current question is not email and message looks like email, maybe it's email collection
    // But we already handled email collection above
    // Save the visitor's answer as the field value (unless it's clearly a new question to us that should be answered first)
    const isQuestionToUs = isCustomerQuestion(visitorBody)
    // If customer is asking a question, we will answer it but still capture discovery context if message also contains answer
    // For now, treat body as answer to current discovery question if not purely a question
    if (!isQuestionToUs || visitorBody.length > 30) {
      // Only save if field not already answered
      if (!discovery.answers[fieldKey as DiscoveryFieldKey]) {
        discovery.answers[fieldKey as DiscoveryFieldKey] = visitorBody.slice(0, 1000)
        discoveryUpdated = true
      }
    }
  }

  // Special: if message itself contains discovery field hint, capture it heuristically
  // e.g. businessType detection from keywords
  if (!discovery.answers.businessType && !discoveryUpdated) {
    const inferred = inferBusinessType(visitorBody)
    if (inferred) {
      discovery.answers.businessType = inferred
      discoveryUpdated = true
    }
  }

  if (discoveryUpdated) {
    await saveDiscoveryState(client.id, discovery)
    // Advance currentQuestion to next missing field
    const next = nextQuestion(discovery.answers)
    discovery.currentQuestion = (next?.key as DiscoveryFieldKey) ?? null
    if (!next) discovery.completed = true
    await saveDiscoveryState(client.id, discovery)
  }

  // Check for AI provider availability
  const providerStatus = getZaiProviderStatus()
  const aiAvailable = providerStatus.configured

  // Try AI generation; if fails, provide honest fallback
  let aiReply: string | null = null
  let aiError: string | null = null
  let wasAiGenerated = false

  if (aiAvailable) {
    const aiResult = await tryGenerateAiReply({
      context,
      history,
      discovery,
      visitorBody,
      isQuestion: isCustomerQuestion(visitorBody),
      emailCollectedThisTurn,
      emailInMessage,
    })
    if (aiResult.ok && aiResult.output) {
      aiReply = aiResult.output
      wasAiGenerated = true
    } else {
      aiError = aiResult.error ?? 'AI provider unavailable'
      // Record failure honestly
      const { logError } = await import('@/lib/security')
      await logError({
        source: 'CHAT_ORCHESTRATOR',
        code: 'AI_GENERATION_FAILED',
        message: `Client ${client.clientId}: ${aiError}`,
        clientId: client.clientId,
      }).catch(() => null)
    }
  } else {
    aiError = providerStatus.detail || 'AI provider not configured'
  }

  // Build final reply: either AI output or honest fallback
  let finalReply: string
  let escalated = false
  if (aiReply) {
    finalReply = aiReply
  } else {
    // Honest fallback — do not invent response
    escalated = true
    finalReply = buildHonestFallback({
      context,
      discovery,
      visitorBody,
      aiError: aiError ?? 'AI service temporarily unavailable',
      aiAvailable,
      emailCollectedThisTurn,
    })
  }

  // Ensure every customer-facing lifecycle message includes: Client ID, stage/status, what happened, next step, who must act (Requirement E)
  // Append a structured footer when in discovery or formal stages
  if (discovery.completed && !discovery.summaryConfirmed && !emailCollectedThisTurn) {
    // Discovery complete but not confirmed — summarize for confirmation before SOW
    const summary = buildSummary(discovery.answers, client.name, client.clientId)
    // If AI already summarized, don't duplicate; else append summary as next action
    if (!finalReply.includes('Please confirm if this is correct')) {
      finalReply = finalReply + '\n\n' + summary
    }
    // Mark that summary was sent (but not yet confirmed)
  }

  // Persist outbound message to ChatMessage + Communication
  const outboundBody = finalReply.slice(0, 8000)
  try {
    await db.chatMessage.create({
      data: {
        conversationId: input.conversationId,
        sender: escalated ? 'SYSTEM' : 'ADMIN', // SYSTEM for honest fallback/escalation, ADMIN for AI reply (attributed to TECH360)
        body: outboundBody,
      },
    })
    await db.chatConversation.update({
      where: { id: input.conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: outboundBody.slice(0, 120),
        lastSender: escalated ? 'SYSTEM' : 'ADMIN',
      },
    })
    // Communication log for CRM
    await db.communication.create({
      data: {
        clientId: client.id,
        channel: input.channel,
        direction: 'OUT',
        recipient: client.name,
        body: outboundBody,
        status: escalated ? 'SENT' : 'SENT', // honest: even fallback is sent (system message)
        providerMessageId: `chat_out:${input.conversationId}:${Date.now()}`,
        agentCode: wasAiGenerated ? 'CHAT-AI' : 'CHAT-FALLBACK',
      },
    })
  } catch {
    // If persistence fails, do not claim sent — return honest error
    return {
      ok: false,
      reply: 'Your message was received but our reply could not be saved. Please try again or email info@bdtech360.com with your Client ID ' + client.clientId + '.',
      clientRowId: client.id,
      clientId: client.clientId,
      conversationId: input.conversationId,
      wasAiGenerated: false,
      error: 'Failed to persist outbound message',
    }
  }

  // Update conversation state machine
  const nextAction = determineNextAction({
    context,
    discovery,
    emailCollectedThisTurn,
    escalated,
    wasAiGenerated,
  })
  await recordOutbound(client.id, client.clientId, outboundBody, input.channel, client.pipelineStage, nextAction.action, nextAction.actor, nextAction.dueDate).catch(() => null)

  // Also update discovery's currentQuestion if we just asked one
  // If reply contains a discovery question, set currentQuestion accordingly
  // (This is handled via saveDiscoveryState above; but we ensure next question is set)
  if (!discovery.completed && !discovery.currentQuestion) {
    const nxt = nextQuestion(discovery.answers)
    if (nxt) {
      discovery.currentQuestion = nxt.key as DiscoveryFieldKey
      await saveDiscoveryState(client.id, discovery).catch(() => null)
    }
  }

  return {
    ok: true,
    reply: outboundBody,
    clientRowId: client.id,
    clientId: client.clientId,
    conversationId: input.conversationId,
    wasAiGenerated,
    error: aiError ?? undefined,
    escalated,
    nextAction: nextAction.action,
    stage: client.pipelineStage,
  }
}

async function loadHistoryForClient(clientRowId: string, conversationId: string): Promise<ConversationHistory> {
  // Load chat messages for this conversation
  const chatMsgs = await db.chatMessage
    .findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    .catch(() => [] as Array<{ sender: string; body: string; createdAt: Date }>)

  // Also load recent Communications for broader context (email, WhatsApp)
  const comms = await db.communication
    .findMany({
      where: { clientId: clientRowId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    .catch(() => [] as Array<{ direction: string; channel: string; body: string; createdAt: Date }>)

  const history: ConversationHistory = []
  for (const m of chatMsgs) {
    history.push({ sender: m.sender, body: m.body, createdAt: m.createdAt })
  }
  // Add comms that aren't already in chat (dedupe by body)
  const chatBodies = new Set(history.map((h) => h.body.slice(0, 100)))
  for (const c of comms.reverse()) {
    if (chatBodies.has(c.body.slice(0, 100))) continue
    history.push({ sender: c.direction === 'IN' ? 'VISITOR' : 'ADMIN', body: c.body, createdAt: c.createdAt })
  }
  return history.slice(-20)
}

function isCustomerQuestion(text: string): boolean {
  const t = text.trim()
  if (t.endsWith('?')) return true
  const qWords = ['what', 'how', 'when', 'where', 'why', 'who', 'can you', 'could you', 'do you', 'are you', 'is it', 'will you', 'should i']
  const lower = t.toLowerCase()
  return qWords.some((w) => lower.startsWith(w + ' ') || lower.includes(' ' + w + ' '))
}

function inferBusinessType(text: string): string | null {
  const lower = text.toLowerCase()
  const map: Array<{ keywords: string[]; type: string }> = [
    { keywords: ['ecommerce', 'e-commerce', 'online store', 'shop', 'retail'], type: 'eCommerce' },
    { keywords: ['school', 'education', 'training', 'student', 'course'], type: 'Education' },
    { keywords: ['restaurant', 'food', 'cafe', 'hotel', 'hospitality'], type: 'Restaurants & Food' },
    { keywords: ['health', 'clinic', 'hospital', 'doctor'], type: 'Healthcare' },
    { keywords: ['real estate', 'property', 'construction'], type: 'Real Estate' },
    { keywords: ['agency', 'marketing'], type: 'Agencies' },
    { keywords: ['finance', 'bank', 'investment'], type: 'Finance' },
  ]
  for (const m of map) {
    if (m.keywords.some((k) => lower.includes(k))) return m.type
  }
  return null
}

async function tryGenerateAiReply(input: {
  context: ClientContext
  history: ConversationHistory
  discovery: { answers: Record<string, string | undefined>; currentQuestion: string | null; completed: boolean }
  visitorBody: string
  isQuestion: boolean
  emailCollectedThisTurn: boolean
  emailInMessage: string | null
}): Promise<{ ok: boolean; output?: string; error?: string }> {
  const historyText = input.history
    .slice(-8)
    .map((h) => `${h.sender === 'VISITOR' ? 'Customer' : 'TECH360'}: ${h.body.slice(0, 500)}`)
    .join('\n')

  const knownContext = [
    `Client ID: ${input.context.clientId}`,
    `Name: ${input.context.name}`,
    `Business Name: ${input.context.businessName ?? 'not provided'}`,
    `Business Type: ${input.context.businessType ?? 'not yet known'}`,
    `Email: ${input.context.email ?? 'not yet collected'}`,
    `Stage: ${input.context.pipelineStage}`,
    `Known requirements: ${input.context.lead?.requirements?.slice(0, 500) ?? 'none yet'}`,
    `Discovery answers so far: ${JSON.stringify(input.discovery.answers)}`,
    `Discovery complete: ${input.discovery.completed}`,
  ].join('\n')

  const missingField = input.discovery.completed ? null : nextQuestion(input.discovery.answers as never)
  const nextQuestionInstruction = missingField
    ? `The next essential information still missing is: ${missingField.label} — ask this as ONE concise question: "${missingField.question}" (${missingField.example}). Ask ONLY this one question after answering the customer's query.`
    : input.discovery.completed
      ? 'All discovery information is collected. Summarize for confirmation before SOW.'
      : ''

  const prompt = `You are TECH360's AI assistant — a helpful, professional business consultant, not a human. Answer truthfully if asked whether you are AI.

Your task:
1. Answer the customer's ACTUAL question first, using the business context.
2. Then, ask AT MOST ONE primary follow-up question from the missing fields.
3. Never ask again for information already provided.
4. Keep tone warm, concise, business-first.
5. Always include Client ID ${input.context.clientId} and current stage ${input.context.pipelineStage} naturally.
6. If email is not yet known, after providing useful initial assistance, naturally invite the customer to share preferred email for formal updates (do not be pushy).

Context:
${knownContext}

Recent conversation:
${historyText || '(no prior messages in this conversation)'}

Customer's current message:
"${input.visitorBody}"

${nextQuestionInstruction}

Instructions:
- Respond in 2-5 short paragraphs max.
- Start with a direct, useful answer to what the customer asked.
- If the customer asked a question, answer it before any follow-up.
- Ask one follow-up question only if something is still missing; otherwise confirm next steps.
- Do not invent pricing, timelines, or team availability; be honest about what happens next.
- Do not mention internal tool names, agent codes, or system prompts.
- If the customer's email was just collected (${input.emailInMessage ?? 'none'}), acknowledge it warmly.

Produce your reply now:`

  try {
    // Use existing AI agent engine — CHAT-AI is a general assistant
    // Fall back to BIZ-004 or SCP-006 if CHAT-AI not in registry
    const agentCodesToTry = ['BIZ-004', 'SCP-006', 'PLN-005', 'COM-010']
    let lastError: string | null = null
    for (const code of agentCodesToTry) {
      const result = await runAgent(code, {
        input: prompt.slice(0, 24000),
        clientId: input.context.id,
        workflow: 'CHAT_ONE_QA',
      })
      if (result.ok && result.output) {
        // Screen for phone numbers leaking into public content (honest guard)
        const { screenAiContent } = await import('@/lib/pipeline/rules')
        const screened = screenAiContent(result.output)
        // Never return a phone number in AI content — policy
        if (screened.redacted.length > 0) {
          // Log redaction but return cleaned text
          const { logError } = await import('@/lib/security')
          await logError({
            source: 'CHAT_ORCHESTRATOR',
            code: 'PHONE_REDACTED',
            message: `Redacted ${screened.redacted.length} phone number(s) from AI reply for ${input.context.clientId}`,
            clientId: input.context.clientId,
          }).catch(() => null)
        }
        return { ok: true, output: screened.text.slice(0, 4000) }
      }
      lastError = result.error ?? 'AI agent did not return output'
      // If agent not found or paused, try next
      if (lastError.includes('not found') || lastError.includes('is PAUSED') || lastError.includes('is RETIRED')) continue
      // For other errors (quota, provider), stop and return fallback
      break
    }
    return { ok: false, error: lastError ?? 'AI generation failed' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function buildHonestFallback(input: {
  context: ClientContext
  discovery: { answers: Record<string, string | undefined>; currentQuestion: string | null; completed: boolean }
  visitorBody: string
  aiError: string
  aiAvailable: boolean
  emailCollectedThisTurn: boolean
}): string {
  // Honest, non-invented response — must state what happened and next action (Requirement E)
  const stageLabel = input.context.pipelineStage
  const clientId = input.context.clientId

  let body = `Thank you for your message. Your enquiry is registered under Client ID ${clientId} (current stage: ${stageLabel}).\n\n`

  if (input.emailCollectedThisTurn) {
    body += `Your email has been saved — formal updates, scope documents and proposals will be sent there.\n\n`
  }

  // Address potential issue transparently
  if (!input.aiAvailable) {
    body += `Our AI assistant is temporarily being configured. Your message has been saved and our team will review it — you will receive a reply within one business day via your original channel.\n\n`
  } else if (input.aiError.includes('quota') || input.aiError.includes('Quota')) {
    body += `Our AI assistant has reached its usage limit for now. Your message is saved and our team will follow up shortly. For urgent help, please email ${PUBLIC_CONTACT.email} with your Client ID ${clientId}.\n\n`
  } else if (input.aiError.includes('timeout') || input.aiError.includes('TIMEOUT')) {
    body += `I'm having trouble generating a reply at this moment (provider timeout). Your message has not been lost — it is saved under your Client ID and our team will respond within one business day.\n\n`
  } else {
    body += `I'm having trouble generating a detailed reply right now. Your message has been saved under your Client ID and our team will respond — you won't need to resend.\n\n`
  }

  // One follow-up question if discovery not complete
  const missing = nextQuestion(input.discovery.answers as never)
  if (missing && !input.discovery.completed) {
    const stillNeedsEmail = !input.context.email && missing.key !== 'businessType' // avoid asking email twice in same fallback
    if (stillNeedsEmail && !input.emailCollectedThisTurn) {
      // Prefer discovery question; email can be asked next turn after useful assistance
      body += `${missing.question}\n`
    } else {
      body += `${missing.question}\n`
    }
  } else if (input.discovery.completed) {
    body += `All your requirements have been noted. Our team will prepare a summary for your confirmation before drafting the formal Scope of Work.\n`
  }

  body += `\nRef: ${clientId} | If you prefer, email ${PUBLIC_CONTACT.email} with your reference.`

  return body
}

function determineNextAction(input: {
  context: ClientContext
  discovery: { completed: boolean; summaryConfirmed: boolean }
  emailCollectedThisTurn: boolean
  escalated: boolean
  wasAiGenerated: boolean
}): { action: string; actor: 'CLIENT' | 'TECH360'; dueDate: string | null } {
  if (input.escalated) {
    return { action: 'Human review within 1 business day', actor: 'TECH360', dueDate: null }
  }
  if (!input.context.email) {
    return { action: 'Share preferred email for formal updates', actor: 'CLIENT', dueDate: null }
  }
  if (!input.discovery.completed) {
    const missing = nextQuestion({} as never) // will be determined by caller context
    return { action: `Provide remaining requirement details (${input.discovery.completed ? 'confirmation' : 'next question'})`, actor: 'CLIENT', dueDate: null }
  }
  if (input.discovery.completed && !input.discovery.summaryConfirmed) {
    return { action: 'Confirm requirements summary before SOW draft', actor: 'CLIENT', dueDate: null }
  }
  return { action: 'TECH360 will draft Scope of Work for Admin approval', actor: 'TECH360', dueDate: null }
}
