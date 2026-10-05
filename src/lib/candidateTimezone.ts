/** Shown first. Any other IANA zone the browser supports is still accepted. */
export const POPULAR_TIMEZONE_IDS = [
  'Asia/Kolkata',
  'America/Chicago',
  'America/New_York',
  'America/Los_Angeles',
  'America/Denver',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
] as const

export type TimezoneOption = { id: string; label: string }

const TIMEZONE_ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  IST: 'Asia/Kolkata',
}

export function normalizeTimezoneId(zone: string | null | undefined) {
  const trimmed = zone?.trim() ?? ''
  if (!trimmed) return ''
  return TIMEZONE_ALIASES[trimmed] ?? trimmed
}

export function isValidTimezone(zone: string | null | undefined) {
  const trimmed = normalizeTimezoneId(zone)
  if (!trimmed) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return true
  } catch {
    return false
  }
}

export function browserTimezone() {
  try {
    return normalizeTimezoneId(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return ''
  }
}

/** Where the candidate is. Profile timezone wins, then the browser, then India. */
export function candidateDisplayTimezone(profileTimezone?: string | null) {
  const profile = normalizeTimezoneId(profileTimezone)
  if (isValidTimezone(profile)) return profile
  const browser = browserTimezone()
  if (isValidTimezone(browser)) return browser
  return 'Asia/Kolkata'
}

function shortOffset(zone: string, atMs: number) {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(new Date(atMs))
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    )
  } catch {
    return ''
  }
}

export function formatTimezoneLabel(zone: string, atMs = Date.now()) {
  const id = normalizeTimezoneId(zone)
  if (!isValidTimezone(id)) return zone
  const name = shortOffset(id, atMs)
  const readable = id.replace(/_/g, ' ')
  return name ? `${readable} (${name})` : readable
}

function allIanaTimezones() {
  const set = new Set<string>()
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      for (const id of Intl.supportedValuesOf('timeZone')) set.add(id)
    } catch {
      // The short popular list still works.
    }
  }
  for (const id of POPULAR_TIMEZONE_IDS) {
    if (isValidTimezone(id)) set.add(id)
  }
  if (set.has('Asia/Kolkata')) set.delete('Asia/Calcutta')
  if (set.size === 0) return [...POPULAR_TIMEZONE_IDS]
  return [...set]
}

export function timezoneSelectOptions(current?: string | null, atMs = Date.now()): TimezoneOption[] {
  const zones = allIanaTimezones()
  const popular = new Set<string>(POPULAR_TIMEZONE_IDS)
  const head = POPULAR_TIMEZONE_IDS.filter((id) => zones.includes(id))
  const tail = zones.filter((id) => !popular.has(id)).sort((a, b) => a.localeCompare(b))
  const ids = [...head, ...tail]
  const currentId = normalizeTimezoneId(current)
  if (currentId && isValidTimezone(currentId) && !ids.includes(currentId)) ids.unshift(currentId)
  return ids.map((id) => ({ id, label: formatTimezoneLabel(id, atMs) }))
}
