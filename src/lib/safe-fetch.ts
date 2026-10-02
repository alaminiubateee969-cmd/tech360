import { lookup } from 'dns/promises'
import { isIP } from 'net'

// ============================================================
// SSRF-safe fetch for admin tools that load a URL the admin typed
// (SEO audit). Blocks loopback / private / link-local / metadata
// addresses, re-validates every redirect hop, caps size and time.
// Note: DNS is resolved and checked before connecting; this removes
// the practical attacks, but a hostile DNS server could in theory
// rebind between check and connect — the tool is MANAGER+ only.
// ============================================================

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a, b, c] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  if (v === 6) {
    const l = ip.toLowerCase()
    if (l === '::' || l === '::1') return true
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff')
  }
  return true // not an IP at all → refuse
}

export class UnsafeUrlError extends Error {}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) } catch { throw new UnsafeUrlError('That is not a valid URL') }
  if (!/^https?:$/.test(u.protocol)) throw new UnsafeUrlError('Only http(s) URLs are allowed')
  if (u.username || u.password) throw new UnsafeUrlError('URLs with credentials are not allowed')
  if (u.port && !['80', '443', ''].includes(u.port)) throw new UnsafeUrlError('Only the default web ports are allowed')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^(localhost|.*\.local|.*\.internal|.*\.lan)$/i.test(host)) throw new UnsafeUrlError('Internal hostnames are not allowed')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new UnsafeUrlError('Could not resolve that hostname') })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError('That address is not publicly reachable')
  return u
}

export type SafeResponse = { url: string; status: number; headers: Headers; body: string; ms: number; redirects: string[] }

export async function safeFetch(raw: string, opts: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {}): Promise<SafeResponse> {
  const maxBytes = opts.maxBytes ?? 1_500_000
  const maxRedirects = opts.maxRedirects ?? 4
  const redirects: string[] = []
  let current = (await assertPublicUrl(raw)).toString()
  const started = Date.now()
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Tech360-SEO-Audit/1.0 (+https://bdtech360.com)', Accept: 'text/html,application/xhtml+xml,text/plain,*/*;q=0.5' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      redirects.push(current)
      current = (await assertPublicUrl(new URL(res.headers.get('location')!, current).toString())).toString()
      continue
    }
    const reader = res.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) { await reader.cancel(); break }
      chunks.push(value)
    }
    return { url: current, status: res.status, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - started, redirects }
  }
  throw new UnsafeUrlError('Too many redirects')
}
