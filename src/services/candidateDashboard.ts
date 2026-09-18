import { supabase } from '../lib/supabase.ts'
import { BookingError, countCandidateBookings, listCandidateBookingsWhere } from './bookings.ts'
import { CANDIDATE_FEEDBACK_VIEW } from './candidateFeedbackModel.ts'
import { getCandidatePreferencesIfPresent, getCandidateProfile, getCandidateSkills } from './candidateProfile.ts'
import { CANDIDATE_REVIEWS_TABLE } from './candidateReviewModel.ts'
import {
  DASHBOARD_RECENT_LIMIT,
  NEXT_INTERVIEW_STATUSES,
  UPCOMING_STATUSES,
  buildDashboardPendingActions,
  missingProfileItems,
  pickNextInterview,
  type CandidateDashboard,
} from './candidateDashboardModel.ts'
import { decorateCandidateInterviews, type CandidateInterview } from './interviewSessions.ts'

export {
  DASHBOARD_RECENT_LIMIT,
  buildDashboardPendingActions,
  missingProfileItems,
  pickNextInterview,
  type CandidateDashboard,
  type CandidateDashboardCounts,
  type DashboardPendingAction,
} from './candidateDashboardModel.ts'

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new BookingError('unauthenticated', 'Please sign in to view your dashboard.')
  }
  return data.user
}

async function countOrNull(factory: () => Promise<number>) {
  try {
    return await factory()
  } catch (error) {
    console.error('dashboard count failed', error)
    return null
  }
}

async function countRows(table: string) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function loadMissingProfileItems() {
  try {
    const account = await getCandidateProfile()
    const [preferences, skills] = await Promise.all([getCandidatePreferencesIfPresent(), getCandidateSkills()])
    return missingProfileItems({
      targetRole: account.candidate.target_role,
      candidateLevel: account.candidate.candidate_level,
      skills: skills.length > 0 ? skills : (preferences?.skills ?? []),
      interviewType: preferences?.interview_type,
    })
  } catch (error) {
    console.error('dashboard profile completeness failed', error)
    return []
  }
}

export async function getCandidateDashboard(): Promise<CandidateDashboard> {
  try {
    await requireAuthenticatedUser()

    const [completed, upcoming, feedbackReceived, reviewsSubmitted, nextRows, recentRows, pendingPayRows, profileGaps] =
      await Promise.all([
        countOrNull(() => countCandidateBookings(['completed'])),
        countOrNull(() => countCandidateBookings([...UPCOMING_STATUSES])),
        countOrNull(() => countRows(CANDIDATE_FEEDBACK_VIEW)),
        countOrNull(() => countRows(CANDIDATE_REVIEWS_TABLE)),
        listCandidateBookingsWhere({
          statuses: [...NEXT_INTERVIEW_STATUSES],
          ascending: true,
          limit: 5,
        }).catch((error: unknown) => {
          console.error('dashboard next interviews failed', error)
          return []
        }),
        listCandidateBookingsWhere({
          statuses: ['completed'],
          ascending: false,
          limit: DASHBOARD_RECENT_LIMIT,
        }).catch((error: unknown) => {
          console.error('dashboard recent interviews failed', error)
          return []
        }),
        listCandidateBookingsWhere({
          statuses: ['pending_payment'],
          ascending: false,
          limit: 3,
        }).catch((error: unknown) => {
          console.error('dashboard pending payments failed', error)
          return []
        }),
        loadMissingProfileItems(),
      ])

    let decorated: CandidateInterview[] = []
    try {
      decorated = await decorateCandidateInterviews([...nextRows, ...recentRows])
    } catch (error) {
      console.error('dashboard decorate failed', error)
    }

    const decoratedById = new Map(decorated.map((item) => [item.id, item]))
    const nextCandidates = nextRows
      .map((row) => decoratedById.get(row.id))
      .filter((item): item is NonNullable<typeof item> => item != null)
    const recentCompleted = recentRows
      .map((row) => decoratedById.get(row.id))
      .filter((item): item is NonNullable<typeof item> => item != null)

    const nextInterview = pickNextInterview(nextCandidates)

    return {
      counts: {
        completed,
        upcoming,
        feedbackReceived,
        reviewsSubmitted,
      },
      nextInterview,
      recentCompleted,
      pendingActions: buildDashboardPendingActions({
        nextInterview,
        recentCompleted,
        pendingPayments: pendingPayRows,
      }),
      missingProfileItems: profileGaps,
    }
  } catch (error) {
    if (error instanceof BookingError) throw error
    console.error('getCandidateDashboard failed', error)
    throw new BookingError('rpc', 'Unable to load your dashboard. Please try again.')
  }
}
