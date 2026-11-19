import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import type { NextRequest } from 'next/server'

// Exercise the route without a real database or sending any credentials off-box.
// Every database/session operation can fail independently, including after the
// password and second factor have been verified.
const sensitiveDetail = 'mysql://private-user:private-password@private-host/customer-data'
const calls: string[] = []
const failures = new Map<string, unknown>()
const diagnostics: unknown[][] = []
let user: Record<string, unknown> | null
let limited = false
let validPassword = true
let validTotp = true
let POST: (request: NextRequest) => Promise<Response>

async function operation<T>(name: string, result: T): Promise<T> {
  calls.push(name)
  if (failures.has(name)) throw failures.get(name)
  return result
}

before(async () => {
  mock.module('@/lib/db', { namedExports: { db: {
    user: {
      findUnique: () => operation('findUser', user),
      update: () => operation('updateUser', user),
    },
  } } })
  mock.module('@/lib/auth', { namedExports: {
    verifyPassword: () => validPassword,
    createSession: () => operation('createSession', { token: 'local-test-session' }),
    makeCsrfToken: () => 'local-test-csrf',
  } })
  mock.module('@/lib/totp', { namedExports: { verifyTotp: () => validTotp } })
  mock.module('@/lib/security', { namedExports: {
    clientIp: () => 'local-test-ip',
    rateLimit: () => ({ ok: !limited }),
    readJson: async (request: Request) => {
      try { return await request.json() } catch { return {} }
    },
    sanitizeEmail: (value: unknown) => typeof value === 'string' && value.includes('@') ? value.toLowerCase().trim() : '',
    sanitizeText: (value: unknown) => typeof value === 'string' ? value.trim() : '',
    audit: () => operation('audit', undefined),
    logError: () => operation('logError', undefined),
  } })
  ;({ POST } = await import('../src/app/api/auth/login/route'))
})

beforeEach(() => {
  calls.length = 0
  failures.clear()
  diagnostics.length = 0
  limited = false
  validPassword = true
  validTotp = true
  user = {
    id: 'local-test-user', email: 'person@example.invalid', name: 'Test User', role: 'ADMIN',
    passwordHash: 'not-a-real-password-hash', isActive: true, failedLogins: 0, lockedUntil: null,
    twoFactorEnabled: false, twoFactorSecret: null, mustChangePassword: false,
  }
  mock.method(console, 'error', (...args: unknown[]) => { diagnostics.push(args) })
})

afterEach(() => mock.restoreAll())

function request(body: unknown = { email: 'person@example.invalid', password: 'local-test-password' }) {
  return new Request('https://example.invalid/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }) as NextRequest
}

async function assertClosed(response: Response, status: number) {
  assert.equal(response.status, status)
  assert.equal(response.headers.get('set-cookie'), null, 'an unsuccessful login must not issue cookies')
  const body = await response.json()
  assert.equal(body.ok, undefined)
  assert.ok(typeof body.error === 'string' && body.error.length > 0)
  assert.doesNotMatch(JSON.stringify(body), /mysql:\/\/|private-user|private-password|private-host|customer-data|local-test-password/)
  return body
}

describe('staff login dependency failures', () => {
  for (const code of ['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037']) {
    for (const property of ['code', 'errorCode']) {
      it(`returns retryable 503 for ${property}=${code} without exposing database details`, async () => {
        failures.set('findUser', Object.assign(new Error(sensitiveDetail), { [property]: code }))
        const response = await POST(request())
        const body = await assertClosed(response, 503)
        assert.equal(body.code, 'DATABASE_UNAVAILABLE')
        assert.equal(response.headers.get('retry-after'), '30')
        assert.equal(response.headers.get('cache-control'), 'no-store')
        assert.ok(!calls.includes('createSession'))
        assert.ok(!calls.includes('logError'), 'do not try to log an outage through the unavailable database')
        assert.doesNotMatch(JSON.stringify(diagnostics), /mysql:\/\/|private-password|private-host/)
      })
    }
  }

  it('handles Prisma initialization errors without a populated error code', async () => {
    failures.set('findUser', Object.assign(new Error(sensitiveDetail), { name: 'PrismaClientInitializationError' }))
    await assertClosed(await POST(request()), 503)
  })

  for (const operation of ['createSession', 'updateUser']) {
    it(`fails closed when ${operation} loses its connection after password verification`, async () => {
      failures.set(operation, Object.assign(new Error(sensitiveDetail), { code: 'P1017' }))
      await assertClosed(await POST(request()), 503)
    })
  }

  it('handles a failed-login counter write outage without treating it as bad credentials', async () => {
    validPassword = false
    failures.set('updateUser', Object.assign(new Error(sensitiveDetail), { code: 'P2024' }))
    await assertClosed(await POST(request()), 503)
    assert.ok(!calls.includes('createSession'))
  })

  it('does not misclassify unrelated Prisma failures as a temporary database outage', async () => {
    failures.set('findUser', Object.assign(new Error(sensitiveDetail), { code: 'P2002' }))
    const response = await POST(request())
    const body = await assertClosed(response, 500)
    assert.equal(body.code, 'LOGIN_FAILED')
    assert.equal(response.headers.get('retry-after'), null)
    assert.doesNotMatch(JSON.stringify(diagnostics), /mysql:\/\/|private-password|private-host/)
  })

  it('does not treat explicit initialization configuration errors as transient outages', async () => {
    failures.set('findUser', Object.assign(new Error(sensitiveDetail), { name: 'PrismaClientInitializationError', errorCode: 'P1012' }))
    const response = await POST(request())
    await assertClosed(response, 500)
    assert.equal(response.headers.get('retry-after'), null)
  })

  for (const error of [null, undefined, 'P1001', new Error(sensitiveDetail)]) {
    it(`returns a safe JSON failure for unexpected thrown values (${String(error)})`, async () => {
      failures.set('createSession', error)
      await assertClosed(await POST(request()), 500)
    })
  }
})

describe('staff login authentication contract', () => {
  it('rejects missing credentials before accessing the database', async () => {
    await assertClosed(await POST(request({})), 400)
    assert.deepEqual(calls, [])
  })

  it('keeps rate limiting ahead of database reads', async () => {
    limited = true
    await assertClosed(await POST(request()), 429)
    assert.ok(!calls.includes('findUser'))
    assert.ok(!calls.includes('createSession'))
  })

  it('rejects an unknown email with the same bad-credentials status', async () => {
    user = null
    await assertClosed(await POST(request()), 401)
    assert.ok(!calls.includes('createSession'))
  })

  it('rejects disabled users without creating a session', async () => {
    user!.isActive = false
    await assertClosed(await POST(request()), 403)
    assert.ok(!calls.includes('createSession'))
  })

  it('preserves account lockouts', async () => {
    user!.lockedUntil = new Date(Date.now() + 60_000)
    await assertClosed(await POST(request()), 423)
    assert.ok(!calls.includes('createSession'))
  })

  it('records a bad password attempt without creating a session', async () => {
    validPassword = false
    await assertClosed(await POST(request()), 401)
    assert.ok(calls.includes('updateUser'))
    assert.ok(!calls.includes('createSession'))
  })

  for (const secret of [null, '']) {
    it(`never bypasses enabled two-factor authentication when its secret is ${secret === null ? 'null' : 'empty'}`, async () => {
      user!.twoFactorEnabled = true
      user!.twoFactorSecret = secret
      const body = await assertClosed(await POST(request()), 503)
      assert.equal(body.code, 'TOTP_UNAVAILABLE')
      assert.ok(!calls.includes('createSession'))
      assert.ok(!calls.includes('updateUser'))
    })
  }

  it('accepts a valid enrolled second factor', async () => {
    user!.twoFactorEnabled = true
    user!.twoFactorSecret = 'local-test-totp-secret'
    const response = await POST(request({ email: user!.email, password: 'local-test-password', totp: '123456' }))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).ok, true)
    assert.ok(calls.includes('createSession'))
  })

  it('requires the second factor before creating a session', async () => {
    user!.twoFactorEnabled = true
    user!.twoFactorSecret = 'local-test-totp-secret'
    const body = await assertClosed(await POST(request()), 401)
    assert.equal(body.code, 'TOTP_REQUIRED')
    assert.ok(!calls.includes('createSession'))
  })

  it('rejects an invalid second factor before creating a session', async () => {
    user!.twoFactorEnabled = true
    user!.twoFactorSecret = 'local-test-totp-secret'
    validTotp = false
    const body = await assertClosed(await POST(request({ email: user!.email, password: 'local-test-password', totp: '123456' })), 401)
    assert.equal(body.code, 'TOTP_INVALID')
    assert.ok(!calls.includes('createSession'))
  })

  it('still issues a session and CSRF cookie after a successful login', async () => {
    const response = await POST(request())
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.user.email, user!.email)
    assert.ok(calls.includes('createSession'))
    assert.ok(calls.includes('updateUser'))
    const cookies = response.headers.getSetCookie()
    assert.equal(cookies.length, 2)
    assert.ok(cookies.some((cookie) => cookie.includes('local-test-session') && cookie.includes('HttpOnly')))
    assert.ok(cookies.some((cookie) => cookie.includes('local-test-csrf')))
  })
})
