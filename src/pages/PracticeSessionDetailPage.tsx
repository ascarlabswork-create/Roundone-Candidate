import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Badge, Card, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import {
  difficultyLabel,
  formatPracticeDate,
  formatPracticeScore,
  getPracticeSessionDetail,
  practiceAgainHref,
  type PracticeQuestionResult,
} from '../services/practiceProgress.ts'
import { useState } from 'react'

function ResultList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-navy-950">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function QuestionResult({ item, index }: { item: PracticeQuestionResult; index: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question {index + 1}</p>
      <h2 className="mt-1 text-base font-semibold text-navy-950">{item.question}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{item.topic}</Badge>
        <Badge tone="slate">{difficultyLabel(item.difficulty)}</Badge>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-navy-950">Candidate answer</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {item.answer?.answerText ?? 'No scored answer was stored for this question.'}
        </p>
      </div>
      {item.answer ? (
        <>
          <p className="mt-4 text-lg font-semibold text-navy-950">Practice score: {item.answer.score} / 10</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.answer.summary}</p>
          <ResultList title="Strengths" items={item.answer.strengths} />
          <ResultList title="Areas for improvement" items={item.answer.improvements} />
          <ResultList title="Missing points" items={item.answer.missingPoints} />
        </>
      ) : null}
    </Card>
  )
}

export function PracticeSessionDetailPage() {
  const { id = '' } = useParams()
  const [retryNonce, setRetryNonce] = useState(0)
  const state = useAsync(() => getPracticeSessionDetail(id), [id, retryNonce])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/candidate/practice/history" className="text-sm font-medium text-blue-700">
        ← Practice progress
      </Link>

      {state.status === 'loading' ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="mt-8">
          <ErrorState title="Unable to load this practice session" body={state.error} onRetry={() => setRetryNonce((value) => value + 1)} />
        </div>
      ) : null}

      {state.status === 'success' && !state.data ? (
        <div className="mt-8">
          <ErrorState title="Practice session not found" body="You don't have access to this practice session." />
        </div>
      ) : null}

      {state.status === 'success' && state.data ? (
        <>
          <div className="mt-6">
            <PageHeader
              title="Practice summary"
              subtitle="Stored AI practice results from this session. This is not official interviewer feedback."
              actions={
                <Link to={practiceAgainHref(state.data)}>
                  <Button>Practice Again</Button>
                </Link>
              }
            />
          </div>
          <Card className="mt-8 p-5 sm:p-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt>
                <dd className="mt-1 font-semibold text-navy-950">{state.data.targetRole}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Interview type</dt>
                <dd className="mt-1 font-semibold text-navy-950">{state.data.interviewType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Difficulty</dt>
                <dd className="mt-1 font-semibold text-navy-950">{difficultyLabel(state.data.difficulty)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</dt>
                <dd className="mt-1 font-semibold text-navy-950">{formatPracticeDate(state.data.completedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Questions</dt>
                <dd className="mt-1 font-semibold text-navy-950">
                  {state.data.questionsAnswered} of {state.data.questionCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Average practice score</dt>
                <dd className="mt-1 text-2xl font-semibold text-navy-950">{formatPracticeScore(state.data.averageScore)}</dd>
              </div>
            </dl>
          </Card>

          <div className="mt-6 space-y-4">
            {state.data.questions.map((item, index) => (
              <QuestionResult key={item.id} item={item} index={index} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
