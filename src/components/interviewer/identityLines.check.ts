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
  expect(lines.length === 1, 'TEST 1 one line')
  expect(lines[0] === 'software Engineer · System Design', 'TEST 1 keep headline')
  expect(!lines.some((line) => line.toLowerCase().includes('asc')), 'TEST 1 hide company')
}

{
  const lines = interviewerIdentityLines({
    headline: 'Staff Backend Engineer',
    currentRole: 'Staff Backend Engineer',
    company: 'Stripe',
  })
  expect(JSON.stringify(lines) === JSON.stringify(['Staff Backend Engineer']), 'TEST 2 exact role headline')
}

{
  const lines = interviewerIdentityLines({
    headline: 'Hiring-loop coach for FAANG',
    currentRole: 'Staff Engineer',
    company: 'Meta',
  })
  expect(
    JSON.stringify(lines) === JSON.stringify(['Hiring-loop coach for FAANG', 'Staff Engineer']),
    'TEST 3 distinct headline keeps role line without company',
  )
}

{
  const lines = interviewerIdentityLines({
    headline: null,
    currentRole: 'Engineer',
    company: 'Acme',
  })
  expect(lines.length === 1 && lines[0] === 'Engineer', 'TEST 4 no headline → role only')
}

console.log('interviewer identity lines checks passed')
