import { isoDateInZone } from '../availability/timezone.ts'
import { getBookableSlots, getBookableWindow } from '../services/availability.ts'
import type { MatchingPreferences } from '../types.ts'
import type { MatchingCatalogPerson } from './catalog.ts'
import { pickServiceForAvailability } from './liveAvailabilityPick.ts'

const AVAILABILITY_CHECK_CONCURRENCY = 6

function slotMatchesPreferredDate(startsAtUtc: string, timezone: string, preferredDate: string) {
  return isoDateInZone(new Date(startsAtUtc), timezone) === preferredDate
}

async function hasLiveBookableSlot(person: MatchingCatalogPerson, prefs: MatchingPreferences) {
  const service = pickServiceForAvailability(person, prefs.interviewType)
  if (!service) return false
  const { from, to } = getBookableWindow(0)
  try {
    const slots = await getBookableSlots({
      interviewerProfileId: person.id,
      serviceId: service.id,
      from,
      to,
    })
    if (slots.length === 0) return false
    if (!prefs.preferredDate) return true
    return slots.some((slot) => slotMatchesPreferredDate(slot.startsAtUtc, person.timezone, prefs.preferredDate))
  } catch (error) {
    console.error('matching availability check failed', person.id, error)
    return false
  }
}

async function mapPool<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function keepInterviewersWithBookableSlots(
  catalog: MatchingCatalogPerson[],
  prefs: MatchingPreferences,
) {
  if (catalog.length === 0) return catalog
  const flags = await mapPool(catalog, AVAILABILITY_CHECK_CONCURRENCY, (person) =>
    hasLiveBookableSlot(person, prefs),
  )
  return catalog.filter((_, index) => flags[index])
}
