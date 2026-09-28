import { GitCompare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { isVerified } from '../../data/interviewers.ts'
import { formatCount, formatINR } from '../../lib/format.ts'
import type { Interviewer, SkillMatchDetail } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { Badge } from '../ui/primitives.tsx'
import { Avatar, MatchScore, StarRating, VerifiedBadge } from '../ui/identity.tsx'

function formatSkillPercent(percent: number | null) {
  if (percent == null) return '—'
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

export function SkillMatchPanel({ skillMatch }: { skillMatch: SkillMatchDetail }) {
  return (
    <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
      <p className="text-sm font-semibold text-navy-950">
        Skill Match: {formatSkillPercent(skillMatch.percent)}%
      </p>

      {skillMatch.matchedSkills.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Matched Skills
          </p>
          <ul className="space-y-1">
            {skillMatch.matchedSkills.map((skill) => (
              <li key={`m-${skill}`} className="text-sm text-emerald-700">
                🟢 {skill}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skillMatch.candidateMissingSkills.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Missing Candidate Skills
          </p>
          <ul className="space-y-1">
            {skillMatch.candidateMissingSkills.map((skill) => (
              <li key={`r-${skill}`} className="text-sm text-rose-700">
                🔴 {skill}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skillMatch.interviewerExtraSkills.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Interviewer Extra Skills
          </p>
          <ul className="space-y-1">
            {skillMatch.interviewerExtraSkills.map((skill) => (
              <li key={`n-${skill}`} className="text-sm text-slate-600">
                ⚪ {skill}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function InterviewerCard({
  interviewer,
  matchScore,
  skillMatch,
  selected,
  onToggleCompare,
  compareFull,
  fromMatches,
}: {
  interviewer: Interviewer
  matchScore?: number
  skillMatch?: SkillMatchDetail
  selected?: boolean
  onToggleCompare?: () => void
  compareFull?: boolean
  fromMatches?: boolean
}) {
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
                {interviewer.currentRole}
                {interviewer.company ? ` @ ${interviewer.company}` : ''}
              </p>
            </div>
            {typeof matchScore === 'number' ? <MatchScore score={matchScore} /> : null}
          </div>
          {!fromMatches ? (
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{interviewer.experienceYears}+ years experience</span>
              <span>{formatCount(interviewer.completedInterviews)} interviews</span>
              <span className="inline-flex items-center gap-1">
                <StarRating value={interviewer.rating} />
                {interviewer.rating}
                <span className="text-slate-500">({formatCount(interviewer.reviewCount)} reviews)</span>
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {!skillMatch ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {interviewer.skills.slice(0, 6).map((skill) => (
            <Badge key={skill}>{skill}</Badge>
          ))}
        </div>
      ) : null}

      {skillMatch ? <SkillMatchPanel skillMatch={skillMatch} /> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-lg font-semibold text-navy-950">{formatINR(interviewer.price)} / session</p>
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
