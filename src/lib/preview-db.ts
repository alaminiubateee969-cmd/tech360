/**
 * TECH360 — offline preview / demo database adapter (development only).
 *
 * WHY THIS EXISTS
 * ---------------
 * Production runs Prisma against MySQL on Hostinger (`DATABASE_URL`). A
 * developer machine or a sandbox without a MySQL server could not start the
 * app at all, which made the website, the client portal and the Super Admin
 * console impossible to click through locally.
 *
 * When `PREVIEW_SQLITE_URL` is set (a `file:` URL pointing at a throwaway
 * SQLite file created by `npm run preview:setup`) the client is built with the
 * pure-JavaScript libSQL driver adapter instead of the native query engine.
 * Nothing else in the application changes: the same schema, the same routes,
 * the same guards, the same Prisma Client API.
 *
 * SAFETY RULES (all enforced below, never bypassable by configuration)
 * -------------------------------------------------------------------
 * 1. Refused in production. A production process that sees this variable
 *    throws on the first query instead of quietly using a local SQLite file.
 * 2. Refused when `DATABASE_URL` is a real (non-file) MySQL URL only if the
 *    preview variable is explicitly set — an accidental leftover variable in
 *    a MySQL environment fails loudly.
 * 3. Opt-in only: with `PREVIEW_SQLITE_URL` unset this module returns
 *    `undefined` and the client is constructed exactly as in production.
 * 4. The adapter packages are optional. They are resolved lazily so the
 *    production build never depends on them; if they are missing the error
 *    message tells the operator exactly what to install.
 */
import type { PrismaClient } from '@prisma/client'

type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0]

export const PREVIEW_ENV_VAR = 'PREVIEW_SQLITE_URL'

export function previewDatabaseUrl(): string | null {
  const url = process.env[PREVIEW_ENV_VAR]?.trim()
  return url ? url : null
}

/**
 * Returns the extra Prisma client options for preview mode, or `undefined`
 * when preview mode is not active. Called once per client construction.
 */
export function attachPreviewAdapter(): PrismaClientOptions | undefined {
  const url = previewDatabaseUrl()
  if (!url) return undefined

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${PREVIEW_ENV_VAR} is a development-only setting and is refused in production. ` +
        'Unset it and use a MySQL DATABASE_URL.',
    )
  }
  if (!url.startsWith('file:') && !url.startsWith('libsql:')) {
    throw new Error(`${PREVIEW_ENV_VAR} must be a file: (SQLite) or libsql: URL. Refusing: ${url}`)
  }

  // Resolved through `createRequire` on purpose: the adapter is an optional
  // development dependency and must never be part of the production bundle.
  const nodeRequire = createLazyRequire()
  let PrismaLibSQL: new (options: { url: string }) => unknown
  try {
    const mod = nodeRequire('@prisma/adapter-libsql') as { PrismaLibSQL: typeof PrismaLibSQL }
    PrismaLibSQL = mod.PrismaLibSQL
  } catch {
    throw new Error(
      `${PREVIEW_ENV_VAR} is set but @prisma/adapter-libsql is not installed. ` +
        'Install it with `npm i --no-save @prisma/adapter-libsql@6.19.3 @libsql/client@0.15.15` ' +
        '(the version must match @prisma/client), then run `npm run preview:setup`.',
    )
  }

  return { adapter: new PrismaLibSQL({ url }) } as unknown as PrismaClientOptions
}

function createLazyRequire(): (id: string) => Record<string, unknown> {
  // `eval('require')` keeps the optional adapter out of the webpack module
  // graph so a production build without the package still compiles.
  const req = eval('require') as NodeRequire
  return (id: string) => req(id) as Record<string, unknown>
}

export function isPreviewMode(): boolean {
  return previewDatabaseUrl() !== null && process.env.NODE_ENV !== 'production'
}
