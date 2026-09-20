import { Clock3, GitCompare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateTimeInZone } from '../../availability/index.ts'
import { getNextSlot, isVerified } from '../../data/interviewers.ts'
import { formatCount, formatINR } from '../../lib/format.ts'
import type { Interviewer, MatchReason } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { Badge } from '../ui/primitives.tsx'
import { Avatar, MatchScore, StarRating, VerifiedBadge } from '../ui/identity.tsx'

export function MatchReasonList({ reasons }: { reasons: MatchReason[] }) {
  return (
    <ul className="space-y-1.5">
      {reasons.map((reason) => (
        <li
          key={reason.key}
          className={reason.matched ? 'text-sm text-emerald-700' : 'text-sm text-slate-400'}
        >
          {reason.matched ? '✓' : '○'} {reason.label}
        </li>
      ))}
    </ul>
  )
}

export function InterviewerCard({
  interviewer,
  matchScore,
  reasons,
  matchedFactors,
  matchExplanation,
  selected,
  onToggleCompare,
  compareFull,
  fromMatches,
}: {
  interviewer: Interviewer
  matchScore?: number
  reasons?: MatchReason[]
  matchedFactors?: string[]
  matchExplanation?: string
  selected?: boolean
  onToggleCompare?: () => void
  compareFull?: boolean
  fromMatches?: boolean
}) {
  const hasLocalCalendar =
    interviewer.availability.recurring.length > 0 || interviewer.availability.custom.length > 0
  const next = hasLocalCalendar ? getNextSlot(interviewer) : null
  const profileTo = fromMatches
    ? `/candidate/interviewers/${interviewer.id}?from=matches`
    : `/candidate/interviewers/${interviewer.id}`

  return (
    <article
      className={
        selected
          ? 'flex flex-col rounded-xl border border-blue-600 bg-white p-5 shadow-sm ring-2 ring-blue-100'
          : 'flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
      }
    >
      <div className="flex gap-4">
        <Avatar src={interviewer.photo} name={interviewer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-navy-950">{interviewer.name}</h3>
                {isVerified(interviewer) ? <VerifiedBadge /> : null}
                {interviewer.isOnline ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                {interviewer.currentRole} @ {interviewer.company}
              </p>
            </div>
            {typeof matchScore === 'number' ? <MatchScore score={matchScore} /> : null}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>{interviewer.experienceYears}+ years experience</span>
            <span>{formatCount(interviewer.completedInterviews)} interviews</span>
            <span className="inline-flex items-center gap-1">
              <StarRating value={interviewer.rating} />
              {interviewer.rating}
              <span className="text-slate-500">({formatCount(interviewer.reviewCount)} reviews)</span>
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {interviewer.interviewTypes.map((type) => (
          <Badge key={type} tone="blue">
            {type}
          </Badge>
        ))}
        {[...interviewer.skills, ...interviewer.technologies].slice(0, 4).map((skill) => (
          <Badge key={skill}>{skill}</Badge>
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Suitable for:</span>{' '}
        {interviewer.candidateLevels.join(' · ')}
      </p>

      {matchExplanation || (matchedFactors && matchedFactors.length > 0) ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Why this match?
          </p>
          {matchedFactors && matchedFactors.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {matchedFactors.map((factor) => (
                <Badge key={factor} tone="blue">
                  {factor}
                </Badge>
              ))}
            </div>
          ) : null}
          {matchExplanation ? <p className="text-sm text-slate-700">{matchExplanation}</p> : null}
        </div>
      ) : null}

      {reasons ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Why this interviewer matches
          </p>
          <MatchReasonList reasons={reasons} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-lg font-semibold text-navy-950">{formatINR(interviewer.price)} / session</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
            <Clock3 className="h-4 w-4" />
            Next available:{' '}
            {next
              ? formatDateTimeInZone(next.start, interviewer.availability.timezone)
              : 'See booking for live bookable times'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {onToggleCompare ? (
            <Button
              variant={selected ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onToggleCompare}
              disabled={!selected && compareFull}
              aria-pressed={selected}
              aria-label={selected ? 'Remove from comparison' : 'Add to comparison'}
              title={!selected && compareFull ? 'You can compare up to 3 interviewers' : undefined}
            >
              <GitCompare className="h-4 w-4" />
              {selected ? 'Selected' : 'Compare'}
            </Button>
          ) : null}
          <Link to={profileTo} className="sm:w-auto">
            <Button variant="outline" size="sm" fullWidth>
              View Profile
            </Button>
          </Link>
          <Link to={`/candidate/interviewers/${interviewer.id}/book`} className="sm:w-auto">
            <Button size="sm" fullWidth>
              Book
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}

export function InterviewerCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="h-4 w-56 rounded bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-4 h-8 rounded bg-slate-100" />
      <div className="mt-4 h-10 rounded bg-slate-100" />
    </div>
  )
}
