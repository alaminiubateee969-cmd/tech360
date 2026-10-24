/**
 * In-memory stand-in for the Prisma client, used ONLY by the Hostinger mail
 * tests. It implements the handful of model operations the code under test
 * performs, with the same semantics that matter for correctness:
 *
 *   - a unique constraint on InboundWebhookReceipt(provider, eventIdHash) that
 *     raises P2002 exactly as MySQL/Prisma does;
 *   - optimistic updates that match on the previous updatedAt / claimToken;
 *   - "where" filters on the fields the code actually uses.
 *
 * It is installed with mock.module('@prisma/client') in each test file, so the
 * production modules run against it unchanged. Nothing here touches a database.
 */

export type FakeRow = Record<string, unknown> & { id: string; updatedAt?: Date }

export type FakeStore = {
  setting: FakeRow[]
  client: FakeRow[]
  communication: FakeRow[]
  inboundWebhookReceipt: FakeRow[]
  errorLog: FakeRow[]
  auditLog: FakeRow[]
  notification: FakeRow[]
  seq: number
}

export function createFakeStore(): FakeStore {
  return { setting: [], client: [], communication: [], inboundWebhookReceipt: [], errorLog: [], auditLog: [], notification: [], seq: 0 }
}

function nextId(store: FakeStore, prefix: string): string {
  store.seq += 1
  return `${prefix}_${store.seq}`
}

function matchesWhere(row: FakeRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  for (const [key, expected] of Object.entries(where)) {
    if (key === 'OR' || key === 'AND' || key === 'NOT') continue
    const actual = row[key]
    if (expected === null) {
      if (actual !== null && actual !== undefined) return false
      continue
    }
    if (expected instanceof Date) {
      if (!(actual instanceof Date) || actual.getTime() !== expected.getTime()) return false
      continue
    }
    if (typeof expected === 'object' && expected !== null && 'in' in (expected as Record<string, unknown>)) {
      if (!((expected as { in: unknown[] }).in ?? []).includes(actual)) return false
      continue
    }
    if (typeof expected === 'object' && expected !== null && 'lt' in (expected as Record<string, unknown>)) {
      if (!(actual instanceof Date) || !((expected as { lt: Date }).lt.getTime() > actual.getTime())) return false
      continue
    }
    if (actual !== expected) return false
  }
  return true
}

function uniqueError(message: string): Error {
  return Object.assign(new Error(message), { code: 'P2002' })
}

function applyData(row: FakeRow, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !(value instanceof Date) && 'increment' in (value as Record<string, unknown>)) {
      row[key] = Number(row[key] ?? 0) + Number((value as { increment: number }).increment)
    } else {
      row[key] = value
    }
  }
}

function bumpUpdatedAt(row: FakeRow): void {
  const previous = row.updatedAt instanceof Date ? row.updatedAt.getTime() : 0
  row.updatedAt = new Date(Math.max(Date.now(), previous + 1))
}

/** Build a PrismaClient-shaped class bound to one store. */
export function createFakePrismaClientClass(store: FakeStore) {
  const model = (name: keyof Omit<FakeStore, 'seq'>, prefix: string) => ({
    async findFirst({ where, orderBy: _orderBy, select: _select }: { where?: Record<string, unknown>; orderBy?: unknown; select?: unknown } = {}) {
      return store[name].find((row) => matchesWhere(row, where)) ?? null
    },
    async findMany({ where }: { where?: Record<string, unknown> } = {}) {
      return store[name].filter((row) => matchesWhere(row, where))
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      // Compound unique keys are passed as { provider_eventIdHash: { provider, eventIdHash } }.
      const compound = Object.values(where).find((v) => v && typeof v === 'object' && !(v instanceof Date)) as Record<string, unknown> | undefined
      if (compound && Object.keys(where).length === 1 && Object.keys(where)[0].includes('_')) {
        return store[name].find((row) => matchesWhere(row, compound)) ?? null
      }
      return store[name].find((row) => matchesWhere(row, where)) ?? null
    },
    async create({ data }: { data: Record<string, unknown> }) {
      if (name === 'inboundWebhookReceipt') {
        const duplicate = store.inboundWebhookReceipt.find((r) => r.provider === data.provider && r.eventIdHash === data.eventIdHash)
        if (duplicate) throw uniqueError('Unique constraint failed on InboundWebhookReceipt(provider, eventIdHash)')
      }
      if (name === 'setting') {
        if (store.setting.some((r) => r.key === data.key)) throw uniqueError('Unique constraint failed on Setting(key)')
      }
      const row: FakeRow = {
        id: nextId(store, prefix),
        status: 'PROCESSING',
        attempts: 1,
        clientId: null,
        deletedAt: null,
        clientRowLike: true,
        ...data,
        createdAt: new Date(),
      }
      bumpUpdatedAt(row)
      store[name].push(row)
      return { ...row }
    },
    async update({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const row = store[name].find((r) => matchesWhere(r, where))
      if (!row) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' })
      applyData(row, data)
      bumpUpdatedAt(row)
      return { ...row }
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const rows = store[name].filter((r) => matchesWhere(r, where))
      for (const row of rows) {
        applyData(row, data)
        bumpUpdatedAt(row)
      }
      return { count: rows.length }
    },
    async upsert({ where, create, update }: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) {
      const row = store[name].find((r) => matchesWhere(r, where))
      if (row) {
        applyData(row, update)
        bumpUpdatedAt(row)
        return { ...row }
      }
      return this.create({ data: create })
    },
    async count({ where }: { where?: Record<string, unknown> } = {}) {
      return store[name].filter((row) => matchesWhere(row, where)).length
    },
    async deleteMany({ where }: { where?: Record<string, unknown> } = {}) {
      const before = store[name].length
      const kept = store[name].filter((row) => !matchesWhere(row, where))
      store[name].splice(0, store[name].length, ...kept)
      return { count: before - kept.length }
    },
  })

  return class FakePrismaClient {
    setting = model('setting', 'set')
    client = model('client', 'cli')
    communication = model('communication', 'com')
    inboundWebhookReceipt = model('inboundWebhookReceipt', 'rcp')
    errorLog = model('errorLog', 'err')
    auditLog = model('auditLog', 'aud')
    notification = model('notification', 'not')
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(this)
    }
  }
}
