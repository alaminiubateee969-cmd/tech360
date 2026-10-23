// ============================================================
// TECH360 — Persisted Communication State Machine (Requirement G)
// - Record last inbound, last outbound, current stage, next pending action
// - Send follow-ups only when appropriate, configurable delays
// - Default: 1 reminder after 24h, final after 72h if not replied,
//   stage unchanged, not opted out, no human takeover
// - Stop after response, opt-out, closure, manual takeover
// - Apply provider consent rules, idempotency, retry handling
// - Respect quiet hours and communication preferences
// ============================================================

import { db } from '@/lib/db'
import { PIPELINE_STAGES } from '@/lib/constants'

const STATE_SCOPE = 'COMM_STATE'
function stateKey(clientRowId: string): string {
  return `comm_state:${clientRowId}`
}

export type FollowUpConfig = {
  firstDelayHours: number // default 24
  finalDelayHours: number // default 72
  respectQuietHours: boolean
  quietHoursStart: string // "22:00" Asia/Dhaka
  quietHoursEnd: string // "07:00"
  timezone: string
}

const DEFAULT_CONFIG: FollowUpConfig = {
  firstDelayHours: 24,
  finalDelayHours: 72,
  respectQuietHours: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'Asia/Dhaka',
}

export type CommState = {
  clientRowId: string
  clientId: string
  currentStage: string
  lastInboundAt: string | null
  lastInboundBody: string | null
  lastOutboundAt: string | null
  lastOutboundBody: string | null
  lastChannel: string | null
  nextPendingAction: string | null
  nextPendingActor: 'CLIENT' | 'TECH360' | null
  dueDate: string | null
  // Follow-up tracking
  followUpEnabled: boolean
  followUpStage: string | null // stage at which follow-up was scheduled
  firstReminderAt: string | null
  finalReminderAt: string | null
  lastReminderAt: string | null
  reminderCount: number
  maxReminderCount: number
  // Flags
  optedOut: boolean
  humanTakeover: boolean
  humanTakeoverAt: string | null
  closed: boolean
  // Quiet hours
  config: FollowUpConfig
  updatedAt: string
}

function nowISO(): string {
  return new Date().toISOString()
}

export function defaultCommState(clientRowId: string, clientId: string, stage: string = 'NEW'): CommState {
  const now = new Date()
  return {
    clientRowId,
    clientId,
    currentStage: stage,
    lastInboundAt: null,
    lastInboundBody: null,
    lastOutboundAt: null,
    lastOutboundBody: null,
    lastChannel: null,
    nextPendingAction: null,
    nextPendingActor: null,
    dueDate: null,
    followUpEnabled: true,
    followUpStage: stage,
    firstReminderAt: new Date(now.getTime() + DEFAULT_CONFIG.firstDelayHours * 3600_000).toISOString(),
    finalReminderAt: new Date(now.getTime() + DEFAULT_CONFIG.finalDelayHours * 3600_000).toISOString(),
    lastReminderAt: null,
    reminderCount: 0,
    maxReminderCount: 2,
    optedOut: false,
    humanTakeover: false,
    humanTakeoverAt: null,
    closed: false,
    config: { ...DEFAULT_CONFIG },
    updatedAt: nowISO(),
  }
}

export async function loadCommState(clientRowId: string, clientId: string, fallbackStage?: string): Promise<CommState> {
  try {
    const row = await db.aiMemory.findFirst({
      where: { scope: STATE_SCOPE, key: stateKey(clientRowId) },
    })
    if (!row) return defaultCommState(clientRowId, clientId, fallbackStage ?? 'NEW')
    const parsed = JSON.parse(row.content) as CommState
    // Migrate missing fields
    return {
      ...defaultCommState(clientRowId, clientId, fallbackStage ?? 'NEW'),
      ...parsed,
      clientRowId,
      clientId,
      config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
    }
  } catch {
    return defaultCommState(clientRowId, clientId, fallbackStage ?? 'NEW')
  }
}

export async function saveCommState(state: CommState): Promise<void> {
  const key = stateKey(state.clientRowId)
  const next = { ...state, updatedAt: nowISO() }
  const existing = await db.aiMemory.findFirst({ where: { scope: STATE_SCOPE, key } })
  if (existing) {
    await db.aiMemory.update({ where: { id: existing.id }, data: { content: JSON.stringify(next), updatedAt: new Date() } })
  } else {
    await db.aiMemory.create({
      data: {
        scope: STATE_SCOPE,
        key,
        content: JSON.stringify(next),
        clientId: state.clientRowId,
        importance: 7,
      },
    })
  }
}

// ---- State transitions ----

export async function recordInbound(
  clientRowId: string,
  clientId: string,
  body: string,
  channel: string,
  newStage?: string,
): Promise<CommState> {
  const state = await loadCommState(clientRowId, clientId)
  state.lastInboundAt = nowISO()
  state.lastInboundBody = body.slice(0, 2000)
  state.lastChannel = channel
  // Customer replied → reset follow-up for this stage
  state.reminderCount = 0
  state.firstReminderAt = new Date(Date.now() + state.config.firstDelayHours * 3600_000).toISOString()
  state.finalReminderAt = new Date(Date.now() + state.config.finalDelayHours * 3600_000).toISOString()
  state.lastReminderAt = null
  if (newStage) {
    state.currentStage = newStage
    state.followUpStage = newStage
  }
  // Any inbound clears humanTakeover only if explicitly re-engaged? Keep takeover until manually cleared
  await saveCommState(state)
  return state
}

export async function recordOutbound(
  clientRowId: string,
  clientId: string,
  body: string,
  channel: string,
  stage?: string,
  nextPendingAction?: string,
  nextPendingActor?: 'CLIENT' | 'TECH360',
  dueDate?: string | null,
): Promise<CommState> {
  const state = await loadCommState(clientRowId, clientId)
  state.lastOutboundAt = nowISO()
  state.lastOutboundBody = body.slice(0, 2000)
  state.lastChannel = channel
  if (stage) {
    state.currentStage = stage
    state.followUpStage = stage
  }
  if (nextPendingAction !== undefined) state.nextPendingAction = nextPendingAction
  if (nextPendingActor !== undefined) state.nextPendingActor = nextPendingActor
  if (dueDate !== undefined) state.dueDate = dueDate
  // Schedule follow-up windows from this outbound
  const now = new Date()
  state.firstReminderAt = new Date(now.getTime() + state.config.firstDelayHours * 3600_000).toISOString()
  state.finalReminderAt = new Date(now.getTime() + state.config.finalDelayHours * 3600_000).toISOString()
  await saveCommState(state)
  return state
}

export async function setHumanTakeover(clientRowId: string, clientId: string, takeover: boolean): Promise<void> {
  const state = await loadCommState(clientRowId, clientId)
  state.humanTakeover = takeover
  state.humanTakeoverAt = takeover ? nowISO() : null
  // When human takes over, disable auto follow-ups
  if (takeover) state.followUpEnabled = false
  await saveCommState(state)
}

export async function setOptOut(clientRowId: string, clientId: string, optedOut: boolean): Promise<void> {
  const state = await loadCommState(clientRowId, clientId)
  state.optedOut = optedOut
  if (optedOut) state.followUpEnabled = false
  await saveCommState(state)
}

export async function setClosed(clientRowId: string, clientId: string, closed: boolean): Promise<void> {
  const state = await loadCommState(clientRowId, clientId)
  state.closed = closed
  if (closed) state.followUpEnabled = false
  await saveCommState(state)
}

export async function updateStage(clientRowId: string, clientId: string, stage: string): Promise<void> {
  const state = await loadCommState(clientRowId, clientId)
  if (stage !== state.currentStage) {
    state.currentStage = stage
    state.followUpStage = stage
    // Stage changed → reset reminders for new stage
    const now = new Date()
    state.firstReminderAt = new Date(now.getTime() + state.config.firstDelayHours * 3600_000).toISOString()
    state.finalReminderAt = new Date(now.getTime() + state.config.finalDelayHours * 3600_000).toISOString()
    state.reminderCount = 0
    await saveCommState(state)
  }
}

// ---- Follow-up decision ----

export type FollowUpDecision = {
  shouldSend: boolean
  which: 'FIRST' | 'FINAL' | 'NONE'
  reason: string
}

export function decideFollowUp(state: CommState, now: Date = new Date()): FollowUpDecision {
  if (!state.followUpEnabled) return { shouldSend: false, which: 'NONE', reason: 'Follow-ups disabled' }
  if (state.optedOut) return { shouldSend: false, which: 'NONE', reason: 'Customer opted out' }
  if (state.humanTakeover) return { shouldSend: false, which: 'NONE', reason: 'Human takeover active' }
  if (state.closed) return { shouldSend: false, which: 'NONE', reason: 'Project closed' }
  if (state.nextPendingActor !== 'CLIENT') return { shouldSend: false, which: 'NONE', reason: 'No pending client action — waiting on TECH360' }

  // If customer replied after last outbound, don't send
  if (state.lastInboundAt && state.lastOutboundAt) {
    if (new Date(state.lastInboundAt).getTime() > new Date(state.lastOutboundAt).getTime()) {
      return { shouldSend: false, which: 'NONE', reason: 'Customer has replied since last outbound' }
    }
  }

  // Stage must not have changed since follow-up was scheduled
  if (state.followUpStage && state.currentStage !== state.followUpStage) {
    return { shouldSend: false, which: 'NONE', reason: 'Stage changed — new context, suppress old reminder' }
  }

  if (state.reminderCount >= state.maxReminderCount) {
    return { shouldSend: false, which: 'NONE', reason: 'Max reminders reached' }
  }

  // Check quiet hours
  if (state.config.respectQuietHours && isQuietHour(now, state.config)) {
    return { shouldSend: false, which: 'NONE', reason: 'Within quiet hours' }
  }

  const firstAt = state.firstReminderAt ? new Date(state.firstReminderAt) : null
  const finalAt = state.finalReminderAt ? new Date(state.finalReminderAt) : null
  const lastRem = state.lastReminderAt ? new Date(state.lastReminderAt) : null

  // First reminder eligibility: after firstDelay, and not already sent
  if (firstAt && now >= firstAt && state.reminderCount === 0) {
    return { shouldSend: true, which: 'FIRST', reason: `First reminder due (24h after outbound)` }
  }

  // Final reminder: after finalDelay, and first was already sent, and cooldown passed
  if (finalAt && now >= finalAt && state.reminderCount === 1) {
    // Ensure we don't send final too soon after first (at least 1h cooldown)
    if (lastRem && now.getTime() - lastRem.getTime() < 3600_000) {
      return { shouldSend: false, which: 'NONE', reason: 'Cooldown after first reminder' }
    }
    return { shouldSend: true, which: 'FINAL', reason: `Final reminder due (72h after outbound)` }
  }

  return { shouldSend: false, which: 'NONE', reason: 'Not yet due' }
}

function isQuietHour(now: Date, config: FollowUpConfig): boolean {
  // Simple Asia/Dhaka interpretation: get local hour via Intl
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: config.timezone }).format(now)
    const hour = parseInt(hourStr, 10)
    const startHour = parseInt(config.quietHoursStart.split(':')[0], 10)
    const endHour = parseInt(config.quietHoursEnd.split(':')[0], 10)
    if (startHour < endHour) {
      return hour >= startHour && hour < endHour
    } else {
      // Overnight span e.g. 22:00-07:00
      return hour >= startHour || hour < endHour
    }
  } catch {
    return false
  }
}

export async function recordReminderSent(clientRowId: string, clientId: string): Promise<void> {
  const state = await loadCommState(clientRowId, clientId)
  state.lastReminderAt = nowISO()
  state.reminderCount += 1
  await saveCommState(state)
}

/** Idempotency: check if this provider event was already handled. */
export async function isDuplicateInbound(clientRowId: string, providerEventId: string, channel: string): Promise<boolean> {
  // Use InboundWebhookReceipt for dedup (existing table)
  const hash = providerEventId.slice(0, 64)
  const existing = await db.inboundWebhookReceipt.findUnique({
    where: { provider_eventIdHash: { provider: channel.toUpperCase(), eventIdHash: hash } } as never,
  }).catch(() => null)
  // Also check Communication providerMessageId
  if (existing) return true
  const comm = await db.communication.findFirst({
    where: { providerMessageId: providerEventId },
    select: { id: true },
  })
  return Boolean(comm)
}
