import { interviewerIdentityLines } from './identityLines.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

{
  const lines = interviewerIdentityLines({
    headline: 'software Engineer · System Design',
    currentRole: 'software Engineer',
    company: 'asc',
  })
  expect(lines.length === 2, 'TEST 1 two lines')
  expect(lines[0] === 'software Engineer · System Design', 'TEST 1 keep headline')
  expect(lines[1] === 'asc', 'TEST 1 company only — do not repeat role')
  expect(!lines.some((line) => line.includes('software Engineer @')), 'TEST 1 no double role')
}

{
  const lines = interviewerIdentityLines({
    headline: 'Staff Backend Engineer',
    currentRole: 'Staff Backend Engineer',
    company: 'Stripe',
  })
  expect(JSON.stringify(lines) === JSON.stringify(['Staff Backend Engineer', 'Stripe']), 'TEST 2 exact role headline')
}

{
  const lines = interviewerIdentityLines({
    headline: 'Hiring-loop coach for FAANG',
    currentRole: 'Staff Engineer',
    company: 'Meta',
  })
  expect(
    JSON.stringify(lines) === JSON.stringify(['Hiring-loop coach for FAANG', 'Staff Engineer @ Meta']),
    'TEST 3 distinct headline keeps role line',
  )
}

{
  const lines = interviewerIdentityLines({
    headline: null,
    currentRole: 'Engineer',
    company: 'Acme',
  })
  expect(lines.length === 1 && lines[0] === 'Engineer @ Acme', 'TEST 4 no headline → role @ company')
}

console.log('interviewer identity lines checks passed')
