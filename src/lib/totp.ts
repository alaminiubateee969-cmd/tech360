import { createHmac, randomBytes } from 'crypto'

// ============================================================
// TOTP — RFC 6238 time-based one-time passwords.
// Implemented with node:crypto only (no third-party deps):
//   - base32 encode/decode (RFC 4648)
//   - HMAC-SHA1, 30s step, 6 digits, ±1 window drift
//   - otpauth:// provisioning URI for authenticator apps
// ============================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const c of clean) {
    const idx = BASE32_ALPHABET.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  // 20 bytes (160 bits) — the standard secret length for authenticator apps
  return base32Encode(randomBytes(20))
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter % 0x100000000, 4)
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

const STEP_SECONDS = 30
const DRIFT_STEPS = 1 // accept previous + current + next step

/** Verify a 6-digit TOTP code against a base32 secret (±1 step drift). */
export function verifyTotp(secretBase32: string, code: string, atMs: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const key = base32Decode(secretBase32)
  if (key.length === 0) return false
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS)
  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift++) {
    if (hotp(key, counter + drift) === code) return true
  }
  return false
}

/** otpauth:// URI for provisioning authenticator apps (QR-encodable). */
export function otpauthUri(email: string, secretBase32: string, issuer = 'TECH360'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
