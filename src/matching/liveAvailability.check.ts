import { pickServiceForAvailability } from './liveAvailabilityPick.ts'
import type { MatchingCatalogPerson } from './catalog.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const person = {
  services: [
    { id: 'coding', name: 'Coding Mock', interviewType: 'Coding', durationMin: 60, price: 1000, description: '' },
    { id: 'design', name: 'System Design', interviewType: 'System Design', durationMin: 45, price: 1200, description: '' },
  ],
} as MatchingCatalogPerson

expect(pickServiceForAvailability(person, 'System Design').id === 'design', 'Prefers a service matching the requested interview type')
expect(pickServiceForAvailability(person, '').id === 'design', 'Without a type, uses the shortest service')
console.log('matching availability checks passed')
