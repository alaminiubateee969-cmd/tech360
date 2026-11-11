/**
 * Tolerant reads for crawler-facing surfaces.
 *
 * `db` is a lazy proxy (see `src/lib/db.ts`): when no driver adapter is
 * configured, `db.model.findMany(...)` throws a `PrismaClientInitializationError`
 * SYNCHRONOUSLY, during property access — before a promise exists, so `.catch()`
 * cannot be attached to it. Verified directly:
 *
 *     const p = db.blogPost.findMany({ take: 1 })   // throws here
 *     p.catch(() => {})                             // never reached
 *
 * Every read that feeds `sitemap.xml`, `rss.xml` or `llms.txt` therefore has to
 * be guarded with `try/catch`, and the read must be passed as a thunk so the
 * throwing property access happens *inside* the guard.
 *
 * These surfaces must never 500. An empty feed or sitemap is honest — it
 * advertises nothing — whereas a 500 removes the discovery surface entirely and
 * is what crawlers and agents actually observe.
 */

/**
 * Await a read, falling back to an empty array if it throws — synchronously or
 * asynchronously.
 *
 * The thunk is required (rather than a promise) precisely because the failure
 * can happen before a promise is returned.
 */
export async function orEmpty<T>(read: () => PromiseLike<T[]>): Promise<T[]> {
  try {
    return await read()
  } catch {
    return []
  }
}
