import { PrismaClient } from '@prisma/client'
import { attachPreviewAdapter } from './preview-db'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * The Prisma client is created LAZILY.
 *
 * Previously the client was constructed when this module was first
 * imported. That meant any module which merely imported `db` — even
 * a module with a purely computational function, such as the SOP
 * executor or the prompt retriever — could not be loaded at all
 * unless a generated Prisma client was present. The pure paths are
 * now loadable without a database, and the client is constructed on
 * the first real property access.
 *
 * The behaviour is otherwise unchanged: the same singleton, the same
 * global cache in development, and the same log levels.
 */

// Never log full queries in production: Prisma's `query` level prints bound
// parameter values, which would write customer PII and credentials into the
// server log.
function createClient(): PrismaClient {
  // Preview mode (development only) swaps the native query engine for the
  // pure-JS libSQL adapter against a throwaway SQLite file — see
  // src/lib/preview-db.ts. In production this returns undefined and the
  // client is built exactly as before.
  const preview = attachPreviewAdapter()
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'warn', 'error'],
    ...(preview ?? {}),
  })
}

let client: PrismaClient | null = globalForPrisma.prisma ?? null

function ensureClient(): PrismaClient {
  if (!client) {
    client = createClient()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  }
  return client
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const real = ensureClient()
    const value = (real as unknown as Record<string | symbol, unknown>)[property]
    // Bind the methods to the real client so `this` is correct inside
    // Prisma's own implementation.
    return typeof value === 'function' ? value.bind(real) : value
  },
  has(_target, property) {
    return property in ensureClient()
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client ?? undefined
