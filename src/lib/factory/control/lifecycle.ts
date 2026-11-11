/**
 * Managed application/release lifecycle. Pure state machine — the DB layer
 * must call it before every status change. There is deliberately no path
 * from an untested configuration straight to LIVE.
 */
import {
  APP_STATUSES, RELEASE_STATUSES, type AppStatus, type IsolationModel,
} from './types'
import { compareSemver, isCompatible } from './util'

export interface TransitionContext {
  validationPassed: boolean
  testsPassed: boolean
  approvalRecorded: boolean
  backupVerified: boolean
  rollbackTargetExists: boolean
  deploymentEvidence: string | null
  deploymentModel: IsolationModel
  healthStatus: string
  privilegedApproval: boolean
}

const DEFAULT_CONTEXT: TransitionContext = {
  validationPassed: false,
  testsPassed: false,
  approvalRecorded: false,
  backupVerified: false,
  rollbackTargetExists: false,
  deploymentEvidence: null,
  deploymentModel: 'SHARED_TENANT',
  healthStatus: 'UNKNOWN',
  privilegedApproval: false,
}

export const TRANSITIONS: Record<AppStatus, readonly AppStatus[]> = {
  DRAFT: ['VALIDATED'],
  VALIDATED: ['PROVISIONING'],
  PROVISIONING: ['TEST_FAILED', 'STAGING'],
  TEST_FAILED: ['PROVISIONING'],
  STAGING: ['AWAITING_APPROVAL', 'RETIRED'],
  AWAITING_APPROVAL: ['LIVE', 'STAGING', 'RETIRED'],
  LIVE: ['DEGRADED', 'ROLLED_BACK', 'RETIRED'],
  DEGRADED: ['LIVE', 'ROLLED_BACK', 'RETIRED'],
  ROLLED_BACK: ['STAGING', 'RETIRED'],
  RETIRED: [],
}

export function canTransition(from: string, to: string, partial: Partial<TransitionContext> = {}): { ok: boolean; reason: string } {
  const ctx = { ...DEFAULT_CONTEXT, ...partial }
  if (!APP_STATUSES.includes(to as AppStatus)) return { ok: false, reason: `unknown status ${to}` }
  if (!TRANSITIONS[from as AppStatus]?.includes(to as AppStatus)) {
    return { ok: false, reason: `${from} → ${to} is not an allowed lifecycle transition` }
  }
  switch (to) {
    case 'VALIDATED':
      if (!ctx.validationPassed) return { ok: false, reason: 'configuration validation has not passed' }
      break
    case 'STAGING':
      if (!ctx.testsPassed) return { ok: false, reason: 'automated setup and acceptance tests have not passed' }
      break
    case 'AWAITING_APPROVAL':
      if (!ctx.testsPassed) return { ok: false, reason: 'approval cannot be requested before tests pass' }
      if (!ctx.backupVerified) return { ok: false, reason: 'a verified pre-activation backup is required' }
      break
    case 'LIVE':
      if (!ctx.testsPassed) return { ok: false, reason: 'tests have not passed' }
      if (!ctx.approvalRecorded || !ctx.privilegedApproval) return { ok: false, reason: 'an authorized, audited activation approval is required' }
      if (!ctx.backupVerified) return { ok: false, reason: 'a verified rollback point is required before activation' }
      if (ctx.healthStatus === 'DOWN') return { ok: false, reason: 'health check is DOWN' }
      if (ctx.deploymentModel === 'DEDICATED' && (!ctx.deploymentEvidence || ctx.deploymentEvidence.trim().length < 20)) {
        return { ok: false, reason: 'dedicated instances require recorded deployment evidence (separate DB, storage, credentials, domain, TLS)' }
      }
      break
    case 'DEGRADED':
      if (ctx.healthStatus === 'HEALTHY') return { ok: false, reason: 'a healthy application cannot be marked degraded' }
      break
    case 'ROLLED_BACK':
      if (!ctx.rollbackTargetExists) return { ok: false, reason: 'no known-good backup/config revision to roll back to' }
      break
    case 'RETIRED':
      if (!ctx.privilegedApproval) return { ok: false, reason: 'retirement requires an authorized, audited approval' }
      if (!ctx.backupVerified) return { ok: false, reason: 'a verified final backup is required before retirement' }
      break
    default:
      break
  }
  return { ok: true, reason: 'allowed' }
}

export const RELEASE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['STAGING', 'FAILED'],
  STAGING: ['APPROVED', 'FAILED'],
  APPROVED: ['DEPLOYED', 'FAILED'],
  DEPLOYED: ['ROLLED_BACK'],
  ROLLED_BACK: [],
  FAILED: ['DRAFT'],
}

export function canReleaseTransition(from: string, to: string, opts: { approved?: boolean; testsPassed?: boolean; backupVerified?: boolean } = {}): { ok: boolean; reason: string } {
  if (!RELEASE_STATUSES.includes(to as typeof RELEASE_STATUSES[number])) return { ok: false, reason: `unknown release status ${to}` }
  if (!RELEASE_TRANSITIONS[from]?.includes(to)) return { ok: false, reason: `${from} → ${to} is not an allowed release transition` }
  if (to === 'STAGING' && !opts.testsPassed) return { ok: false, reason: 'compatibility and migration tests must pass before staging' }
  if (to === 'APPROVED' && !opts.approved) return { ok: false, reason: 'an authorized release approval is required' }
  if (to === 'DEPLOYED' && !opts.backupVerified) return { ok: false, reason: 'a verified pre-deployment backup is required' }
  return { ok: true, reason: 'allowed' }
}

/** Compatibility report used for impact analysis and staging upgrades. */
export function compatibilityReport(
  pins: Array<{ code: string; semver: string }>,
  updates: Array<{ code: string; semver: string; breaking?: boolean }>,
): { compatible: boolean; breaking: boolean; rows: Array<{ code: string; from: string; to: string; result: 'UNCHANGED' | 'COMPATIBLE' | 'BREAKING' | 'DOWNGRADE' | 'MISSING' }> } {
  const rows = updates.map((u) => {
    const pin = pins.find((p) => p.code === u.code)
    if (!pin) return { code: u.code, from: '—', to: u.semver, result: 'MISSING' as const }
    if (compareSemver(pin.semver, u.semver) > 0) return { code: u.code, from: pin.semver, to: u.semver, result: 'DOWNGRADE' as const }
    if (pin.semver === u.semver) return { code: u.code, from: pin.semver, to: u.semver, result: 'UNCHANGED' as const }
    return isCompatible(pin.semver, u.semver, u.breaking)
      ? { code: u.code, from: pin.semver, to: u.semver, result: 'COMPATIBLE' as const }
      : { code: u.code, from: pin.semver, to: u.semver, result: 'BREAKING' as const }
  })
  return {
    compatible: rows.every((r) => r.result === 'UNCHANGED' || r.result === 'COMPATIBLE'),
    breaking: rows.some((r) => r.result === 'BREAKING' || r.result === 'DOWNGRADE' || r.result === 'MISSING'),
    rows,
  }
}
