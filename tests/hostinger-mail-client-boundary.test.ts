/**
 * Static guard: the Hostinger SDK and its adapter must never reach a client
 * bundle, and no client component may read the mail token or its variables.
 * A "client module" is any file with a 'use client' directive, or any file
 * under src/components.
 * This runs in CI with `npm test` and fails the build if a boundary breaks.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const SERVER_ONLY_MODULES = ['hostinger-mail-api-sdk', '@/lib/mail/hostinger-mail', '@/lib/mail/hostinger-config', '@/lib/mail/hostinger-inbound', '@/lib/mail/hostinger-outcome', '@/lib/mail/hostinger-inbound-policy']
const TOKEN_VARS = ['HOSTINGER_MAIL_API_TOKEN', 'HOSTINGER_MAIL_WEBHOOK_SECRET']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const sourceFiles = walk(join(ROOT, 'src'))
const isClientFile = (src: string) => /^\s*(['"])use client\1/m.test(src)
const clientFiles = sourceFiles.filter((f) => isClientFile(readFileSync(f, 'utf8')) || relative(ROOT, f).startsWith('src/components/'))

describe('Hostinger Mail client-bundle boundary', () => {
  it('finds client modules to check (guard is not vacuous)', () => {
    assert.ok(clientFiles.length > 20, `expected many client modules, found ${clientFiles.length}`)
  })

  it('no client module imports the SDK or the server-only mail adapter', () => {
    const offenders: string[] = []
    for (const file of clientFiles) {
      const src = readFileSync(file, 'utf8')
      for (const mod of SERVER_ONLY_MODULES) {
        if (new RegExp(`from\\s+['"]${mod.replace(/[/.@-]/g, '\\$&')}['"]|import\\(\\s*['"]${mod.replace(/[/.@-]/g, '\\$&')}['"]`).test(src)) {
          offenders.push(`${relative(ROOT, file)} → ${mod}`)
        }
      }
    }
    assert.deepEqual(offenders, [])
  })

  it('no client module references a Hostinger token or webhook secret variable', () => {
    const offenders = clientFiles.filter((f) => TOKEN_VARS.some((v) => readFileSync(f, 'utf8').includes(v))).map((f) => relative(ROOT, f))
    assert.deepEqual(offenders, [])
  })

  it('no NEXT_PUBLIC_ variable carries Hostinger mail configuration', () => {
    const offenders = sourceFiles.filter((f) => /NEXT_PUBLIC_HOSTINGER/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f))
    assert.deepEqual(offenders, [])
  })

  it('.env.example documents the variable names with empty values only', () => {
    const env = readFileSync(join(ROOT, '.env.example'), 'utf8')
    for (const name of ['HOSTINGER_MAIL_ENABLED', 'HOSTINGER_MAIL_API_TOKEN', 'HOSTINGER_MAILBOX_RESOURCE_ID', 'HOSTINGER_MAIL_FROM_ADDRESS', 'HOSTINGER_MAIL_WEBHOOK_SECRET']) {
      assert.match(env, new RegExp(`^${name}=$`, 'm'), `${name} must be present with an empty value`)
    }
    assert.doesNotMatch(env, /hm_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/)
  })
})
