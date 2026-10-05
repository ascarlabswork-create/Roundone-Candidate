import { Link } from 'react-router-dom'
import { bookingStatusMessage, type BookingReadiness } from '../../matching/bookingReadiness.ts'
import type { MatchingCatalogPerson } from '../../matching/catalog.ts'
import type { SkillMatchDetail } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { Avatar } from '../ui/identity.tsx'
import { formatSkillPercentLabel, skillOverlapSummary } from './skillMatchFormat.ts'

function SkillChip({
  skill,
  tone,
  marker,
}: {
  skill: string
  tone: 'matched' | 'missing' | 'additional'
  marker: string
}) {
  const tones = {
    matched: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    missing: 'border-rose-200 bg-rose-50 text-rose-800',
    additional: 'border-slate-200 bg-slate-50 text-slate-700',
  }
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      <span aria-hidden="true">{marker}</span>
      <span className="truncate">{skill}</span>
    </span>
  )
}

function SkillGroup({
  label,
  description,
  skills,
  tone,
  marker,
}: {
  label: string
  description: string
  skills: string[]
  tone: 'matched' | 'missing' | 'additional'
  marker: string
}) {
  if (skills.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <SkillChip key={`${tone}-${skill}`} skill={skill} tone={tone} marker={marker} />
        ))}
      </div>
    </div>
  )
}

export function SkillMatchPanel({ skillMatch }: { skillMatch: SkillMatchDetail }) {
  const summary = skillOverlapSummary(skillMatch)

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
      {summary ? <p className="text-sm font-semibold text-navy-950">{summary}</p> : null}

      <SkillGroup
        label="Matched"
        description="Skills you match"
        skills={skillMatch.matchedSkills}
        tone="matched"
        marker="🟢"
      />
      <SkillGroup
        label="Missing"
        description="Skills you may want covered"
        skills={skillMatch.candidateMissingSkills}
        tone="missing"
        marker="🔴"
      />
      <SkillGroup
        label="Additional"
        description="Additional interviewer skills"
        skills={skillMatch.interviewerExtraSkills}
        tone="additional"
        marker="⚪"
      />
    </div>
  )
}

export function SkillMatchCard({
  interviewer,
  skillMatch,
  booking,
}: {
  interviewer: MatchingCatalogPerson
  skillMatch: SkillMatchDetail
  booking: BookingReadiness
}) {
  const percentLabel = formatSkillPercentLabel(skillMatch.percent)
  const roleLine = [interviewer.currentRole, interviewer.company].filter(Boolean).join(' @ ')
  const profileTo = `/candidate/interviewers/${interviewer.id}?from=matches`

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <Avatar src={interviewer.photo} name={interviewer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-navy-950">{interviewer.name}</h3>
              {interviewer.headline ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{interviewer.headline}</p>
              ) : null}
              {roleLine ? <p className="mt-0.5 text-sm text-slate-600">{roleLine}</p> : null}
            </div>
            {percentLabel ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800">
                {percentLabel}% Skill Match
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <SkillMatchPanel skillMatch={skillMatch} />

      {booking === 'ready' ? (
        <p className="mt-3 text-xs text-slate-500">Matched by skills. A bookable time is open.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-medium text-navy-950">{bookingStatusMessage(booking)?.headline}</p>
          <p className="text-sm text-slate-600">{bookingStatusMessage(booking)?.detail}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Link to={profileTo} className="sm:w-auto">
          <Button variant="outline" size="sm" fullWidth>
            View Profile
          </Button>
        </Link>
        {booking === 'ready' ? (
          <Link to={`/candidate/interviewers/${interviewer.id}/book`} className="sm:w-auto">
            <Button size="sm" fullWidth>
              Book
            </Button>
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export function SkillMatchCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="h-4 w-56 max-w-full rounded bg-slate-200" />
          <div className="h-4 w-32 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-4 h-24 rounded-lg bg-slate-100" />
      <div className="mt-4 h-9 rounded bg-slate-100" />
    </div>
  )
}
