import { Link } from 'react-router-dom'
import { Button } from '../ui/Button.tsx'
import { EmptyState, ErrorState, Skeleton } from '../ui/primitives.tsx'
import { useAsync } from '../../lib/useAsync.ts'
import { listJobTargets } from '../../services/jobTargets.ts'

export function SavedJobTargets() {
  const state = useAsync(() => listJobTargets(), [])

  return (
    <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950">Job matches</h2>
          <p className="mt-1 text-sm text-slate-600">Job postings you analyzed for interviewer discovery.</p>
        </div>
        <Link to="/candidate/job-match">
          <Button variant="outline" size="sm">
            Find for a job
          </Button>
        </Link>
      </div>

      {state.status === 'loading' ? <Skeleton className="mt-4 h-20" /> : null}
      {state.status === 'error' ? (
        <div className="mt-4">
          <ErrorState body="Couldn't load your saved jobs. Please try again." />
        </div>
      ) : null}
      {state.status === 'success' && state.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No saved jobs yet" body="Analyze a public job URL to find interviewers for that role." />
        </div>
      ) : null}
      {state.status === 'success' && state.data.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {state.data.map((job) => (
            <li key={job.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium text-navy-950">{job.jobTitle || 'Untitled job'}</p>
                <p className="break-words text-sm text-slate-600">
                  {job.companyName || (job.sourceType === 'manual' ? 'Pasted description' : 'Company not set')}
                  {job.skills.length > 0 ? ` · ${job.skills.length} skills` : ''}
                </p>
              </div>
              <Link to={`/candidate/job-match?target=${job.id}`} className="shrink-0">
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
