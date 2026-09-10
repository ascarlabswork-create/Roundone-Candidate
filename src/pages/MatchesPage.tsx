import { Link } from 'react-router-dom'
import { recommendInterviewers } from '../api/index.ts'
import { InterviewerCard, InterviewerCardSkeleton } from '../components/interviewer/InterviewerCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Badge, EmptyState, ErrorState, PageHeader } from '../components/ui/primitives.tsx'
import { formatINR } from '../lib/format.ts'
import { timeWindowLabel, weekdayName } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { hasMeaningfulPreferences } from '../matching/index.ts'
import { useMatching } from '../state/matching.tsx'

export function MatchesPage() {
  const { preferences } = useMatching()
  const ready = hasMeaningfulPreferences(preferences)
  const state = useAsync(
    () => (preferences ? recommendInterviewers(preferences) : Promise.resolve([])),
    [JSON.stringify(preferences)],
  )

  const chips = preferences
    ? [
        preferences.candidateLevel,
        preferences.interviewType,
        preferences.targetCompany,
        preferences.preferredDate
          ? `${weekdayName(preferences.preferredDate)}${preferences.preferredTime ? ` ${timeWindowLabel(preferences.preferredTime)}` : ''}`
          : '',
        preferences.budget ? formatINR(preferences.budget) : '',
      ].filter(Boolean)
    : []

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Recommended for you"
        title="Best matches for your interview goal"
        subtitle="Ranked by a deterministic compatibility score. Each card explains why the interviewer was recommended."
        actions={
          <Link to="/candidate/find">
            <Button variant="outline">Edit goal</Button>
          </Link>
        }
      />

      {chips.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge key={chip} tone="navy">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}

      {!ready ? (
        <div className="mt-8">
          <EmptyState
            title="Tell us what you are preparing for"
            body="Matching needs a target role, level, and interview type so we can rank interviewers."
            action={
              <Link to="/candidate/find">
                <Button>Find My Interviewer</Button>
              </Link>
            }
          />
        </div>
      ) : null}

      {ready && state.status === 'loading' ? (
        <div className="mt-8 space-y-4">
          <InterviewerCardSkeleton />
          <InterviewerCardSkeleton />
        </div>
      ) : null}

      {ready && state.status === 'error' ? (
        <div className="mt-8">
          <ErrorState body={state.error} />
        </div>
      ) : null}

      {ready && state.status === 'success' ? (
        <div className="mt-8 space-y-4">
          {state.data.map(({ interviewer, match }) => (
            <InterviewerCard
              key={interviewer.id}
              interviewer={interviewer}
              matchScore={match.score}
              reasons={match.reasons}
              fromMatches
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
