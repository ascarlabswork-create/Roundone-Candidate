import {
  candidateFeedbackAction,
  mapFeedbackError,
  parseCandidateSafeFeedback,
} from './candidateFeedbackModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runCandidateFeedbackChecks() {
  const secret = 'INTERNAL — candidate must never see this'
  const parsed = parseCandidateSafeFeedback({
    id: '00000000-0000-4000-8000-000000000051',
    booking_id: '00000000-0000-4000-8000-000000000021',
    interviewer_profile_id: '00000000-0000-4000-8000-000000000031',
    candidate_profile_id: '00000000-0000-4000-8000-000000000041',
    technical_skills: 4,
    problem_solving: 3,
    communication: 5,
    system_design: 4,
    coding: null,
    behavioral: null,
    overall: 4,
    strengths: ['Clear communication'],
    improvements: ['Quantify trade-offs'],
    summary: 'Solid session with a clear next step.',
    readiness: 'almost_ready',
    created_at: '2026-09-17T14:00:00.000Z',
    internal_notes: secret,
  })

  expect(Boolean(parsed), 'Candidate-safe feedback must parse')
  expect(!('internalNotes' in (parsed ?? {})), 'internal_notes must not be mapped')
  expect(!JSON.stringify(parsed).includes(secret), 'internal_notes must not leak into parsed feedback')
  expect(parsed?.overall === 4, 'Overall score comes from the candidate-safe view')
  expect(parsed?.summary === 'Solid session with a clear next step.', 'Summary is candidate-visible')

  expect(candidateFeedbackAction('completed', true) === 'view', 'Completed with feedback can be viewed')
  expect(candidateFeedbackAction('completed', false) === 'pending', 'Completed without feedback is pending')
  expect(candidateFeedbackAction('confirmed', true) === null, 'Confirmed interviews do not expose feedback')
  expect(candidateFeedbackAction('requested', false) === null, 'Requested interviews do not expose feedback')
  expect(candidateFeedbackAction('cancelled', true) === null, 'Cancelled interviews do not expose feedback')
  expect(candidateFeedbackAction('pending_payment', false) === null, 'Unpaid bookings do not expose feedback')

  const mapped = mapFeedbackError({ message: 'duplicate key value violates unique constraint', code: '23505' })
  expect(!mapped.message.toLowerCase().includes('duplicate key'), 'Raw postgres text is not shown')
  expect(mapFeedbackError({ message: 'Failed to fetch' }).code === 'network', 'Network errors map cleanly')

  return true
}

runCandidateFeedbackChecks()
console.log('candidate feedback checks passed')
