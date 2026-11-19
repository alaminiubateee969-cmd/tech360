import { BlockList, isIP } from 'node:net'

export type AddressClassification = 'PUBLIC' | 'PRIVATE' | 'LOOPBACK' | 'LINK_LOCAL' | 'METADATA' | 'RESERVED'

// Use the socket library's binary address parser, not text prefixes: URL
// parsing rewrites ::ffff:127.0.0.1 to ::ffff:7f00:1, and DNS can also return
// expanded IPv6. BlockList matches all those forms against the IPv4 subnet.
function blocks(ipv4: ReadonlyArray<readonly [string, number]>, ipv6: ReadonlyArray<readonly [string, number]> = []) {
  const list = new BlockList()
  for (const [address, prefix] of ipv4) list.addSubnet(address, prefix, 'ipv4')
  for (const [address, prefix] of ipv6) list.addSubnet(address, prefix, 'ipv6')
  return list
}

const ranges: ReadonlyArray<readonly [AddressClassification, BlockList]> = [
  ['METADATA', blocks([['169.254.169.254', 32]])],
  ['LOOPBACK', blocks([['127.0.0.0', 8]], [['::', 128], ['::1', 128]])],
  ['LINK_LOCAL', blocks([['169.254.0.0', 16]], [['fe80::', 10]])],
  ['PRIVATE', blocks([
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
    ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
    ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
  ], [['fc00::', 7]])],
  ['RESERVED', blocks([], [['ff00::', 8], ['::ffff:0:0:0', 96]])],
]

/** Classify an IP literal at URL admission and again at the socket/DNS boundary. */
export function classifyNetworkAddress(ip: string): AddressClassification {
  const value = ip.trim().toLowerCase()
  const version = isIP(value)
  if (!version) return 'RESERVED'
  const family = version === 4 ? 'ipv4' : 'ipv6'
  for (const [classification, list] of ranges) {
    if (list.check(value, family)) return classification
  }
  return 'PUBLIC'
}
