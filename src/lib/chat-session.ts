import { createHmac } from 'node:crypto'
import { constantTimeEquals } from '@/lib/constant-time'

export const CHAT_SESSION_COOKIE = 't360_chat_session'
export const CHAT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  return process.env.NODE_ENV === 'production' ? '' : 'tech360-chat-local-development-secret'
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`tech360-chat-session\0${payload}`, 'utf8').digest('base64url')
}

/** A signed, expiring browser capability bound to one anonymous chat id. */
export function signChatSessionToken(
  anonId: string,
  secret: string,
  expiresAt = Math.floor(Date.now() / 1000) + CHAT_SESSION_TTL_SECONDS,
): string {
  if (!secret || !anonId || !Number.isSafeInteger(expiresAt)) throw new Error('A chat session requires a secret, visitor id, and expiry.')
  const encodedId = Buffer.from(anonId, 'utf8').toString('base64url')
  const payload = `${encodedId}.${expiresAt}`
  return `${payload}.${signPayload(payload, secret)}`
}

export function verifyChatSessionToken(
  token: string | null | undefined,
  anonId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!token || !anonId || !secret) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [encodedId, expiryText, signature] = parts
  const expiry = Number(expiryText)
  if (!encodedId || !Number.isSafeInteger(expiry) || expiry <= nowSeconds) return false
  const expected = signPayload(`${encodedId}.${expiryText}`, secret)
  if (!constantTimeEquals(signature, expected)) return false
  try {
    return Buffer.from(encodedId, 'base64url').toString('utf8') === anonId
  } catch {
    return false
  }
}

export function chatSessionCookieIsValid(
  token: string | null | undefined,
  anonId: string,
  secret = sessionSecret(),
): boolean {
  return verifyChatSessionToken(token, anonId, secret)
}

/** Attach the HttpOnly chat-session cookie to an existing response. */
export function withChatSessionCookie<T extends Response>(response: T, anonId: string): T {
  const secret = sessionSecret()
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes to issue a chat session.')
  }
  const token = signChatSessionToken(anonId, secret)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.headers.append(
    'Set-Cookie',
    `${CHAT_SESSION_COOKIE}=${token}; Path=/api/chat; HttpOnly; SameSite=Strict; Max-Age=${CHAT_SESSION_TTL_SECONDS}${secure}`,
  )
  return response
}
