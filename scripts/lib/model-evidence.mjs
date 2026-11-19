import { BlockList, isIP } from 'node:net'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Accept both documented --name=value and --name value CLI forms. */
export function argument(name, fallback = null) {
  const flag = `--${name}`
  const equal = process.argv.find((value) => value.startsWith(`${flag}=`))
  if (equal !== undefined) {
    const value = equal.slice(flag.length + 1)
    if (!value) throw new Error(`${flag} requires a value`)
    return value
  }
  const index = process.argv.indexOf(flag)
  if (index < 0) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`)
  return value
}

const privateAddresses = new BlockList()
for (const [ip, prefix] of [['127.0.0.0', 8], ['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16]]) {
  privateAddresses.addSubnet(ip, prefix, 'ipv4')
}
privateAddresses.addAddress('::1', 'ipv6')
privateAddresses.addSubnet('fc00::', 7, 'ipv6')

export function privateModelBaseUrl(raw) {
  const url = new URL(raw)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const version = isIP(host)
  const privateHost = host === 'localhost' || host === 'localhost.localdomain'
    || version && privateAddresses.check(host, version === 4 ? 'ipv4' : 'ipv6')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !privateHost) {
    throw new Error('The model evidence tools require a loopback or private-network HTTP(S) base URL without credentials, query or fragment')
  }
  return url.toString().replace(/\/+$/, '')
}

export function timeoutMs() {
  const value = Number(argument('timeout-ms', 120_000))
  if (!Number.isFinite(value) || value < 1 || value > 300_000) throw new Error('--timeout-ms must be between 1 and 300000')
  return value
}

export function modelHeaders() {
  const headers = { accept: 'application/json', 'content-type': 'application/json' }
  const key = process.env.LOCAL_MODEL_API_KEY?.trim()
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}
