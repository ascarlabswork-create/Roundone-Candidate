import {
  candidateReviewAction,
  mapReviewError,
  parseCandidateReview,
  parsePublicCandidateReview,
  validateReviewInput,
} from './candidateReviewModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runCandidateReviewChecks() {
  const parsed = parseCandidateReview({
    id: '00000000-0000-4000-8000-000000000061',
    booking_id: '00000000-0000-4000-8000-000000000021',
    interviewer_profile_id: '00000000-0000-4000-8000-000000000031',
    candidate_profile_id: '00000000-0000-4000-8000-000000000041',
    overall_rating: 5,
    technical_expertise: 4,
    communication: 5,
    interview_realism: 4,
    feedback_quality: 5,
    professionalism: 5,
    recommend: 'yes',
    written_review: 'Clear, realistic mock.',
    show_name_publicly: false,
    display_name: 'Anonymous Candidate',
    moderation_status: 'pending',
    created_at: '2026-09-17T16:00:00.000Z',
    email: 'secret@example.com',
  })

  expect(Boolean(parsed), 'Own review must parse')
  expect(parsed?.displayName === 'Anonymous Candidate', 'Backend display name is preserved')
  expect(parsed?.moderationStatus === 'pending', 'New reviews stay pending moderation')
  expect(!JSON.stringify(parsed).includes('secret@example.com'), 'Email must not leak into parsed reviews')

  const published = parsePublicCandidateReview({
    id: '00000000-0000-4000-8000-000000000062',
    interviewer_profile_id: '00000000-0000-4000-8000-000000000031',
    display_name: 'Aditi S.',
    overall_rating: 5,
    technical_expertise: 5,
    communication: 4,
    interview_realism: 5,
    feedback_quality: 4,
    professionalism: 5,
    recommend: 'yes',
    written_review: 'Helpful session.',
    created_at: '2026-09-17T16:00:00.000Z',
    candidate_profile_id: 'must-not-appear-if-unused',
    email: 'hidden@example.com',
  })
  expect(Boolean(published), 'Public review must parse')
  expect(!('candidateProfileId' in (published ?? {})), 'Public reviews do not expose candidate_profile_id')
  expect(!JSON.stringify(published).includes('hidden@example.com'), 'Public reviews do not expose email')

  expect(candidateReviewAction('completed', false) === 'rate', 'Completed interviews can be reviewed')
  expect(candidateReviewAction('completed', true) === 'submitted', 'Existing reviews are submitted')
  expect(candidateReviewAction('confirmed', false) === null, 'Confirmed interviews cannot be reviewed')
  expect(candidateReviewAction('requested', false) === null, 'Requested interviews cannot be reviewed')
  expect(candidateReviewAction('cancelled', false) === null, 'Cancelled interviews cannot be reviewed')
  expect(candidateReviewAction('pending_payment', false) === null, 'Unpaid bookings cannot be reviewed')

  const invalid = validateReviewInput({
    bookingId: '00000000-0000-4000-8000-000000000021',
    overallRating: 6,
    technicalExpertise: 5,
    communication: 5,
    interviewRealism: 5,
    feedbackQuality: 5,
    professionalism: 5,
    recommend: 'yes',
    writtenReview: 'Great',
    showNamePublicly: false,
  })
  expect(invalid !== null, 'Scores outside 1–5 fail validation')

  const mapped = mapReviewError({ message: 'duplicate key value violates unique constraint', code: '23505' })
  expect(mapped.code === 'duplicate', 'Duplicate booking reviews map cleanly')
  expect(!mapped.message.toLowerCase().includes('duplicate key'), 'Raw postgres text is not shown')
  expect(mapReviewError({ message: 'invalid_status', code: 'P0001' }).code === 'not_completed', 'Incomplete interviews map cleanly')
  expect(mapReviewError({ message: 'Failed to fetch' }).code === 'network', 'Network errors map cleanly')

  return true
}

runCandidateReviewChecks()
console.log('candidate review checks passed')
