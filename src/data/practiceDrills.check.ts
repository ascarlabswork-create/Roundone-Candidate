import { coverageForAnswer, isAttemptedAnswer, practiceTypeFromSlug, practiceTypeSlug } from './practiceDrills.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runPracticeDrillChecks() {
  expect(practiceTypeSlug('System Design') === 'system-design', 'Slug uses kebab-case')
  expect(practiceTypeFromSlug('system-design') === 'System Design', 'Slug round-trips to type')
  expect(practiceTypeFromSlug('nope') === null, 'Unknown slugs are rejected')

  const points = [
    { label: 'Hash map', keywords: ['map', 'hash'] },
    { label: 'O(n) time', keywords: ['o(n)', 'linear'] },
  ]
  const hit = coverageForAnswer('Use a hash map in O(n)', points)
  expect(hit.covered.length === 2, 'Keywords mark rubric points covered')
  const miss = coverageForAnswer('I would sort the array', points)
  expect(miss.missed.length === 2, 'Unrelated answers miss the rubric')

  expect(
    !isAttemptedAnswer({ id: 'x', title: 't', prompt: 'p', kind: 'coding', starterCode: 'foo()', expectedPoints: [], followUp: '', modelOutline: '' }, 'foo()'),
    'Unchanged starter code is not an attempt',
  )
  expect(
    isAttemptedAnswer({ id: 'x', title: 't', prompt: 'p', kind: 'written', expectedPoints: [], followUp: '', modelOutline: '' }, 'STAR story'),
    'Written text counts as an attempt',
  )
  return true
}

runPracticeDrillChecks()
console.log('practice drill checks passed')
