import type { MatchingCatalogPerson } from './catalog.ts'

/** Shortest matching service, or undefined when the interviewer has no published services. */
export function pickServiceForAvailability(
  person: MatchingCatalogPerson,
  interviewType: string,
): MatchingCatalogPerson['services'][number] | undefined {
  const services = person.services
  if (services.length === 0) return undefined

  const wanted = interviewType.trim().toLowerCase()
  if (wanted) {
    const typed = services.find((service) => {
      const name = `${service.interviewType} ${service.name}`.toLowerCase()
      return name.includes(wanted) || wanted.includes(service.interviewType.toLowerCase())
    })
    if (typed) return typed
  }

  return services.reduce((shortest, service) =>
    service.durationMin < shortest.durationMin ? service : shortest,
  )
}
