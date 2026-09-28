export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: 'invalid_url' | 'unsupported_url' }

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google.internal.',
])

function stripBrackets(hostname: string) {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function ipv4ToInt(host: string): number | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : NaN))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return (((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3]) >>> 0
}

function inCidrV4(host: string, network: number, bits: number) {
  const value = ipv4ToInt(host)
  if (value == null) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (value & mask) === (network & mask)
}

export function isBlockedAddress(hostname: string): boolean {
  const host = stripBrackets(hostname).toLowerCase().replace(/\.$/, '')
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true
  if (host.startsWith('::ffff:')) {
    const mapped = host.slice('::ffff:'.length)
    if (isBlockedAddress(mapped)) return true
  }
  const v4 = ipv4ToInt(host)
  if (v4 == null) return false
  return (
    inCidrV4(host, 0, 8) ||
    inCidrV4(host, 127 << 24, 8) ||
    inCidrV4(host, 10 << 24, 8) ||
    inCidrV4(host, (172 << 24) + (16 << 16), 12) ||
    inCidrV4(host, (192 << 24) + (168 << 16), 16) ||
    inCidrV4(host, (169 << 24) + (254 << 16), 16)
  )
}

export function checkJobUrl(input: string): UrlCheck {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (url.username || url.password) return { ok: false, reason: 'unsupported_url' }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'unsupported_url' }
  if (isBlockedAddress(url.hostname)) return { ok: false, reason: 'unsupported_url' }
  return { ok: true, url }
}

export async function assertPublicResolution(
  url: URL,
  resolveHost: (hostname: string) => Promise<string[]> = defaultResolve,
): Promise<UrlCheck> {
  const host = stripBrackets(url.hostname)
  if (ipv4ToInt(host) != null || host.includes(':')) {
    return isBlockedAddress(host) ? { ok: false, reason: 'unsupported_url' } : { ok: true, url }
  }
  let addresses: string[] = []
  try {
    addresses = await resolveHost(host)
  } catch {
    return { ok: false, reason: 'unsupported_url' }
  }
  if (addresses.length === 0 || addresses.some((address) => isBlockedAddress(address))) {
    return { ok: false, reason: 'unsupported_url' }
  }
  return { ok: true, url }
}

async function defaultResolve(hostname: string): Promise<string[]> {
  const deno = (globalThis as { Deno?: { resolveDns: (host: string, record: 'A' | 'AAAA') => Promise<string[]> } }).Deno
  if (!deno?.resolveDns) return [hostname]
  const v4 = await deno.resolveDns(hostname, 'A').catch(() => [] as string[])
  const v6 = await deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[])
  return [...v4, ...v6]
}
