import { Link } from 'react-router-dom'
import { recommendMatchedInterviewers } from '../matching/index.ts'
import { InterviewerCard, InterviewerCardSkeleton } from '../components/interviewer/InterviewerCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState, ErrorState, PageHeader } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { useMatching } from '../state/matching.tsx'

export function MatchesPage() {
  const { preferences } = useMatching()
  const ready = Boolean(preferences)
  const state = useAsync(
    () => (preferences ? recommendMatchedInterviewers(preferences) : Promise.resolve([])),
    [JSON.stringify(preferences)],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Recommended for you"
        title="Best matches for your skills"
        subtitle="Ranked by skill overlap only. Availability, services, and other preferences are not used to hide matches."
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
          <InterviewerCardSkeleton />
          <InterviewerCardSkeleton />
        </div>
      ) : null}

      {ready && state.status === 'error' ? (
        <div className="mt-8">
          <ErrorState body={state.error} />
        </div>
      ) : null}

      {ready && state.status === 'success' && state.data.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No strong skill matches found yet."
            body="We could not find listed interviewers who share your skills. Try different skills or browse everyone."
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
          {state.data.map(({ interviewer, match }) => (
            <InterviewerCard
              key={interviewer.id}
              interviewer={interviewer}
              matchScore={match.score}
              skillMatch={match.skillMatch}
              fromMatches
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
