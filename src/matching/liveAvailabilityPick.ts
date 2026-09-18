import type { MatchingCatalogPerson } from './catalog.ts'

export function pickServiceForAvailability(person: MatchingCatalogPerson, interviewType: string) {
  const wanted = interviewType.trim().toLowerCase()
  if (wanted) {
    const typed = person.services.find((service) => {
      const name = `${service.interviewType} ${service.name}`.toLowerCase()
      return name.includes(wanted) || wanted.includes(service.interviewType.toLowerCase())
    })
    if (typed) return typed
  }
  return person.services.reduce((shortest, service) =>
    service.durationMin < shortest.durationMin ? service : shortest,
  )
}
