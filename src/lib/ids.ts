import { db } from './db'
import { randomBytes } from 'node:crypto'

// ============================================================
// MONOTONIC, CONCURRENCY-SAFE IDENTIFIER SEQUENCES
//
// Canonical formats:
//   Client:  TECH-YYYY-NNNNNN  (6 digits, e.g. TECH-2026-000001)
//   Project: PRJ-YYYY-NNNN     (4 digits, e.g. PRJ-2026-0001)
//   Invoice: INV-YYYY-NNNN     (4 digits, e.g. INV-2026-0001)
//   Receipt: RCT-YYYY-NNNN     (4 digits, e.g. RCT-2026-0001)
//   Refund:  RFD-YYYY-NNNN     (4 digits, e.g. RFD-2026-0001)
//
// Invariants enforced here:
//   1. Never derives the next identifier from row counts (`count()`).
//   2. Monotonic high-water counter persisted in `SequenceCounter` per
//      `(prefix, year)` — deleted, archived, merged, or rolled-back records
//      never cause an identifier to be reused.
//   3. Atomic database increment (`lastValue: { increment: 1 }`) inside a
//      serialized/row-locked operation guarantees uniqueness under concurrency.
//   4. First use in a year seeds `SequenceCounter` from the highest existing
//      numeric suffix (including soft-deleted/merged rows and audit history)
//      so brownfield production databases advance seamlessly without collision.
//   5. Year rollover creates a fresh `(prefix, newYear)` counter while
//      preserving all historical years untouched.
// ============================================================

export interface SequenceConfig {
  prefix: string
  digits: number
  year?: number
}

export interface SequenceStore {
  /**
   * Atomically allocate and return the next positive integer for `(prefix, year)`.
   * When the counter row does not yet exist, `seedFloor()` computes the highest
   * already-issued sequence number for `(prefix, year)` so brownfield rows are
   * never collided with.
   */
  nextValue(prefix: string, year: number, seedFloor: () => Promise<number>): Promise<number>
}

export function resolveSequenceYear(now: Date = new Date(), overrideYear?: number): number {
  const y = overrideYear ?? now.getUTCFullYear()
  if (!Number.isInteger(y) || y < 2000 || y > 9999) {
    throw new Error(`Invalid sequence year: ${String(y)}`)
  }
  return y
}

export function formatSequenceId(prefix: string, year: number, sequenceNumber: number, digits: number): string {
  const cleanPrefix = prefix.trim().replace(/-+$/, '').toUpperCase()
  if (!/^[A-Z0-9]{2,12}$/.test(cleanPrefix)) {
    throw new Error(`Invalid sequence prefix: ${prefix}`)
  }
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error(`Invalid sequence number: ${sequenceNumber}`)
  }
  if (!Number.isInteger(digits) || digits < 3 || digits > 12) {
    throw new Error(`Invalid sequence width: ${digits}`)
  }
  return `${cleanPrefix}-${year}-${String(sequenceNumber).padStart(digits, '0')}`
}

export function parseSequenceSuffix(identifier: string, prefix: string, year: number): number {
  const head = `${prefix.toUpperCase()}-${year}-`
  if (!identifier.startsWith(head)) return 0
  const tail = identifier.slice(head.length)
  if (!/^\d+$/.test(tail)) return 0
  const parsed = Number.parseInt(tail, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

export function maxSequenceFromIdentifiers(identifiers: Iterable<string>, prefix: string, year: number): number {
  let max = 0
  for (const id of identifiers) {
    const val = parseSequenceSuffix(id, prefix, year)
    if (val > max) max = val
  }
  return max
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: unknown }).code
  return code === 'P2002'
}

/**
 * Default MySQL/Prisma-backed `SequenceStore`.
 *
 * Uses `SequenceCounter` (`id = "${prefix}:${year}"`). In MySQL InnoDB,
 * `UPDATE SequenceCounter SET lastValue = lastValue + 1 WHERE id = ?` acquires
 * an exclusive row lock and increments atomically in the storage engine, so
 * concurrent requests never observe duplicate sequence values.
 */
export const prismaSequenceStore: SequenceStore = {
  async nextValue(prefix: string, year: number, seedFloor: () => Promise<number>): Promise<number> {
    const counterId = `${prefix}:${year}`

    const existing = await db.sequenceCounter.findUnique({ where: { id: counterId }, select: { id: true } })
    if (!existing) {
      const floor = await seedFloor()
      try {
        await db.sequenceCounter.create({
          data: { id: counterId, prefix, year, lastValue: floor },
        })
      } catch (err) {
        // Another concurrent caller initialized the same `(prefix, year)` row first.
        if (!isUniqueConstraintError(err)) throw err
      }
    }

    const updated = await db.$transaction(async (tx) => {
      return tx.sequenceCounter.update({
        where: { id: counterId },
        data: { lastValue: { increment: 1 } },
        select: { lastValue: true },
      })
    })
    return updated.lastValue
  },
}

/**
 * In-memory `SequenceStore` with serialized per-key queue for deterministic
 * unit testing of concurrency, deletion non-reuse, and year rollover.
 */
export function createInMemorySequenceStore(): SequenceStore {
  const counters = new Map<string, number>()
  const locks = new Map<string, Promise<unknown>>()

  return {
    async nextValue(prefix: string, year: number, seedFloor: () => Promise<number>): Promise<number> {
      const key = `${prefix}:${year}`
      const prev = locks.get(key) ?? Promise.resolve()
      const task = prev.then(async () => {
        if (!counters.has(key)) {
          const floor = await seedFloor()
          counters.set(key, floor)
        }
        const next = (counters.get(key) ?? 0) + 1
        counters.set(key, next)
        return next
      })
      locks.set(key, task.catch(() => null))
      return task
    },
  }
}

export function createSequenceAllocator(
  store: SequenceStore = prismaSequenceStore,
  seeders?: Partial<Record<string, (year: number) => Promise<number>>>,
) {
  return async function allocate(config: SequenceConfig, now: Date = new Date()): Promise<string> {
    const prefix = config.prefix.trim().replace(/-+$/, '').toUpperCase()
    const year = resolveSequenceYear(now, config.year)
    const seeder = seeders?.[prefix] ?? (() => defaultSeedFloor(prefix, year))
    const seq = await store.nextValue(prefix, year, () => seeder(year))
    return formatSequenceId(prefix, year, seq, config.digits)
  }
}

async function defaultSeedFloor(prefix: string, year: number): Promise<number> {
  const head = `${prefix}-${year}-`
  if (prefix === 'TECH') {
    const [clients, audited] = await Promise.all([
      db.client.findMany({
        where: { clientId: { startsWith: head } },
        select: { clientId: true },
      }),
      db.auditLog.findMany({
        where: { clientId: { startsWith: head } },
        select: { clientId: true },
      }),
    ])
    const allIds: string[] = []
    for (const c of clients) allIds.push(c.clientId)
    for (const a of audited) if (a.clientId) allIds.push(a.clientId)
    return maxSequenceFromIdentifiers(allIds, prefix, year)
  }
  if (prefix === 'PRJ') {
    const rows = await db.project.findMany({
      where: { code: { startsWith: head } },
      select: { code: true },
    })
    return maxSequenceFromIdentifiers(rows.map((r) => r.code), prefix, year)
  }
  if (prefix === 'INV') {
    const rows = await db.invoice.findMany({
      where: { number: { startsWith: head } },
      select: { number: true },
    })
    return maxSequenceFromIdentifiers(rows.map((r) => r.number), prefix, year)
  }
  if (prefix === 'RCT') {
    const rows = await db.paymentReceipt.findMany({
      where: { receiptNumber: { startsWith: head } },
      select: { receiptNumber: true },
    })
    return maxSequenceFromIdentifiers(rows.map((r) => r.receiptNumber), prefix, year)
  }
  if (prefix === 'RFD') {
    const rows = await db.refundCase.findMany({
      where: { caseNumber: { startsWith: head } },
      select: { caseNumber: true },
    })
    return maxSequenceFromIdentifiers(rows.map((r) => r.caseNumber), prefix, year)
  }
  return 0
}

const defaultAllocate = createSequenceAllocator(prismaSequenceStore)

export async function nextClientId(options?: { now?: Date; year?: number; prefix?: string; digits?: number }): Promise<string> {
  const prefix = options?.prefix ?? process.env.CLIENT_ID_PREFIX ?? 'TECH-'
  const digits = options?.digits ?? 6
  return defaultAllocate({ prefix, digits, year: options?.year }, options?.now)
}

export async function nextProjectCode(options?: { now?: Date; year?: number; prefix?: string; digits?: number }): Promise<string> {
  const prefix = options?.prefix ?? 'PRJ-'
  const digits = options?.digits ?? 4
  return defaultAllocate({ prefix, digits, year: options?.year }, options?.now)
}

export async function nextInvoiceNumber(options?: { now?: Date; year?: number; prefix?: string; digits?: number }): Promise<string> {
  const prefix = options?.prefix ?? 'INV-'
  const digits = options?.digits ?? 4
  return defaultAllocate({ prefix, digits, year: options?.year }, options?.now)
}

export async function nextReceiptNumber(options?: { now?: Date; year?: number; prefix?: string; digits?: number }): Promise<string> {
  const prefix = options?.prefix ?? 'RCT-'
  const digits = options?.digits ?? 4
  return defaultAllocate({ prefix, digits, year: options?.year }, options?.now)
}

export async function nextRefundCaseNumber(options?: { now?: Date; year?: number; prefix?: string; digits?: number }): Promise<string> {
  const prefix = options?.prefix ?? 'RFD-'
  const digits = options?.digits ?? 4
  return defaultAllocate({ prefix, digits, year: options?.year }, options?.now)
}

export function secureToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

export function publicToken(): string {
  return randomBytes(16).toString('hex')
}

