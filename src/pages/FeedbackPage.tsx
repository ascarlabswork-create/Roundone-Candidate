import { Link, useParams } from 'react-router-dom'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { getCandidateProfile } from '../services/candidateProfile.ts'
import { mapFeedbackError, getCandidateSafeFeedback } from '../services/candidateFeedback.ts'
import { READINESS_LABELS, type CandidateSafeFeedback } from '../services/candidateFeedbackModel.ts'
import { getCandidateInterviewByBooking, type CandidateInterview } from '../services/interviewSessions.ts'

const SCORE_SCALE = 5

type FeedbackPageData = {
  interview: CandidateInterview
  feedback: CandidateSafeFeedback | null
  targetRole: string | null
}

async function loadFeedbackPage(bookingId: string): Promise<FeedbackPageData> {
  let interview: CandidateInterview
  try {
    interview = await getCandidateInterviewByBooking(bookingId)
  } catch (error) {
    throw mapFeedbackError(error)
  }

  let targetRole: string | null = null
  try {
    const account = await getCandidateProfile()
    targetRole = account.candidate.target_role
  } catch (error) {
    console.error('loadFeedbackPage profile failed', error)
  }

  if (interview.status !== 'completed') {
    return { interview, feedback: null, targetRole }
  }

  try {
    const feedback = await getCandidateSafeFeedback(interview.id)
    return { interview, feedback, targetRole }
  } catch (error) {
    throw mapFeedbackError(error)
  }
}

export function FeedbackPage() {
  const { id = '' } = useParams()
  const state = useAsync(() => loadFeedbackPage(id), [id])

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState title="Unable to load feedback" body={state.error} />
        <div className="mt-4">
          <Link to="/candidate/interviews" className="text-sm font-medium text-blue-700">
            Back to My Interviews
          </Link>
        </div>
      </div>
    )
  }

  const { interview, feedback, targetRole } = state.data
  const completed = interview.status === 'completed'

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-950">Interview Feedback</h1>
        <p className="mt-2 text-sm text-slate-600">
          Private performance feedback from your interviewer. Only you and authorized RoundOne staff can see this.
        </p>
      </div>

      <InterviewSummaryCard interview={interview} targetRole={targetRole} />

      {!completed ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy-950">Feedback unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">
            Feedback is available after this interview is completed.
          </p>
          <Link to="/candidate/interviews" className="mt-4 inline-block">
            <Button variant="outline">Back to My Interviews</Button>
          </Link>
        </Card>
      ) : null}

      {completed && !feedback ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy-950">Feedback Pending</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your interviewer has not submitted private feedback for this session yet.
          </p>
          <Link to="/candidate/interviews" className="mt-4 inline-block">
            <Button variant="outline">Back to My Interviews</Button>
          </Link>
        </Card>
      ) : null}

      {completed && feedback ? <CandidateFeedbackReport report={feedback} /> : null}
    </div>
  )
}

function InterviewSummaryCard({
  interview,
  targetRole,
}: {
  interview: CandidateInterview
  targetRole: string | null
}) {
  const zone = interview.displayTimezone
  const dateLabel = formatCivilDateWithYear(isoDateInZone(new Date(interview.startsAtUtc), zone))
  return (
    <Card className="grid gap-3 p-5 text-sm sm:grid-cols-2">
      <SummaryField label="Interviewer" value={interview.interviewerName} />
      <SummaryField label="Interview / service" value={interview.serviceName} />
      <SummaryField label="Interview type" value={interview.interviewType} />
      <SummaryField label="Date" value={`${dateLabel} · ${formatBookingTime(interview.startsAtUtc, zone)}`} />
      <SummaryField label="Target role" value={targetRole?.trim() || '—'} />
    </Card>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}</span>
      <br />
      <span className="font-medium text-navy-950">{value}</span>
    </p>
  )
}

function CandidateFeedbackReport({ report }: { report: CandidateSafeFeedback }) {
  const scores: Array<{ label: string; value: number | null; required?: boolean }> = [
    { label: 'Overall Performance', value: report.overall, required: true },
    { label: 'Technical Knowledge', value: report.technicalSkills, required: true },
    { label: 'Problem Solving', value: report.problemSolving, required: true },
    { label: 'Communication', value: report.communication, required: true },
    { label: 'System Design', value: report.systemDesign },
    { label: 'Coding', value: report.coding },
    { label: 'Behavioral', value: report.behavioral },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-950">Performance</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {READINESS_LABELS[report.readiness]}
          </span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {scores
            .filter((item) => item.required || item.value != null)
            .map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-slate-500">{item.label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-navy-950">
                  {item.value == null ? '—' : `${item.value}/${SCORE_SCALE}`}
                </dd>
              </div>
            ))}
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-navy-950">Strengths</h2>
        {report.strengths.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No strengths were listed.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-navy-950">Areas for Improvement</h2>
        {report.improvements.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {report.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No improvement areas were listed.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-navy-950">Interviewer Summary</h2>
        {report.summary.trim() ? (
          <p className="mt-3 text-sm leading-7 text-slate-700">{report.summary}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No summary was provided.</p>
        )}
      </Card>

      <Link to="/candidate/interviews" className="inline-block">
        <Button variant="outline">Back to My Interviews</Button>
      </Link>
    </div>
  )
}
