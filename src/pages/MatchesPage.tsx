import { Link } from 'react-router-dom'
import { SkillMatchCard, SkillMatchCardSkeleton } from '../components/interviewer/SkillMatchCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState, ErrorState, PageHeader } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { candidateDisplayTimezone } from '../lib/candidateTimezone.ts'
import { recommendMatchedInterviewers } from '../matching/index.ts'
import { useMatching } from '../state/matching.tsx'
import { useSession } from '../state/session.tsx'

export function MatchesPage() {
  const { preferences } = useMatching()
  const { account } = useSession()
  const displayTimezone = candidateDisplayTimezone(account?.profile.timezone)
  const ready = Boolean(preferences)
  const state = useAsync(
    () => (preferences ? recommendMatchedInterviewers(preferences, displayTimezone) : Promise.resolve([])),
    [JSON.stringify(preferences), displayTimezone],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Recommended for you"
        title="Best matches for your skills"
        subtitle="Ranked by skill overlap"
        actions={
          <Link to="/candidate/find">
            <Button variant="outline">Edit goal</Button>
          </Link>
        }
      />

      {!ready ? (
        <div className="mt-8">
          <EmptyState
            title="Tell us what you are preparing for"
            body="Add the skills you want to practice so we can rank interviewers by skill overlap."
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
          <SkillMatchCardSkeleton />
          <SkillMatchCardSkeleton />
          <SkillMatchCardSkeleton />
        </div>
      ) : null}

      {ready && state.status === 'error' ? (
        <div className="mt-8">
          <ErrorState
            title="Couldn't load skill matches"
            body="Couldn't load skill matches. Please try again."
          />
        </div>
      ) : null}

      {ready && state.status === 'success' && state.data.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No skill matches found yet"
            body="We couldn't find interviewers who share your current skills."
            action={
              <Link to="/candidate/interviewers">
                <Button>Browse Interviewers</Button>
              </Link>
            }
          />
        </div>
      ) : null}

      {ready && state.status === 'success' && state.data.length > 0 ? (
        <div className="mt-8 space-y-4">
          {state.data.map(({ interviewer, match, booking }) => (
            <SkillMatchCard
              key={interviewer.id}
              interviewer={interviewer}
              skillMatch={match.skillMatch}
              booking={booking}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
