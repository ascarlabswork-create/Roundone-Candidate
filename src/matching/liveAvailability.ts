import { getBookableSlots, getBookableWindow } from '../services/availability.ts'
import type { MatchingPreferences } from '../types.ts'
import { classifyBookingReadiness, type BookingReadiness } from './bookingReadiness.ts'
import type { MatchingCatalogPerson } from './catalog.ts'
import { pickServiceForAvailability } from './liveAvailabilityPick.ts'

const AVAILABILITY_CHECK_CONCURRENCY = 6

export async function describeBookingReadiness(
  person: MatchingCatalogPerson,
  prefs: MatchingPreferences,
): Promise<BookingReadiness> {
  if (person.services.length === 0) return 'no_service'
  const service = pickServiceForAvailability(person, prefs.interviewType)
  if (!service) return 'no_service'
  const { from, to } = getBookableWindow(0)
  try {
    const slots = await getBookableSlots({
      interviewerProfileId: person.id,
      serviceId: service.id,
      from,
      to,
    })
    return classifyBookingReadiness({
      serviceCount: person.services.length,
      slots,
      timezone: person.timezone,
      preferredDate: prefs.preferredDate,
      preferredDateEnd: prefs.preferredDateEnd,
    })
  } catch (error) {
    console.error('matching availability check failed', person.id, error)
    return 'no_availability'
  }
}

async function hasLiveBookableSlot(person: MatchingCatalogPerson, prefs: MatchingPreferences) {
  const readiness = await describeBookingReadiness(person, prefs)
  return readiness === 'ready'
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

export async function flagInterviewersWithBookableSlots(
  catalog: MatchingCatalogPerson[],
  prefs: MatchingPreferences,
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>()
  if (catalog.length === 0) return flags
  const results = await mapPool(catalog, AVAILABILITY_CHECK_CONCURRENCY, (person) =>
    hasLiveBookableSlot(person, prefs),
  )
  catalog.forEach((person, index) => {
    flags.set(person.id, results[index])
  })
  return flags
}

/** @deprecated Prefer flagInterviewersWithBookableSlots — availability is no longer a hard pre-rank gate. */
export async function keepInterviewersWithBookableSlots(
  catalog: MatchingCatalogPerson[],
  prefs: MatchingPreferences,
) {
  const flags = await flagInterviewersWithBookableSlots(catalog, prefs)
  return catalog.filter((person) => flags.get(person.id))
}
