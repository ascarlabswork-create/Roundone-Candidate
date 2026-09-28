import { Link } from 'react-router-dom'
import { formatMoneyFromPaise } from '../../lib/format.ts'
import type { MatchingCatalogPerson } from '../../matching/catalog.ts'
import type { SkillMatchDetail } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { Avatar } from '../ui/identity.tsx'
import { formatSkillPercentLabel } from './skillMatchFormat.ts'

function SkillChip({ skill, tone, marker }: { skill: string; tone: 'matched' | 'missing' | 'additional'; marker: string }) {
  const tones = {
    matched: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    missing: 'border-rose-200 bg-rose-50 text-rose-800',
    additional: 'border-slate-200 bg-slate-50 text-slate-700',
  }
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      <span aria-hidden="true">{marker}</span>
      <span className="break-words">{skill}</span>
    </span>
  )
}

function SkillGroup({
  label,
  skills,
  tone,
  marker,
}: {
  label: string
  skills: string[]
  tone: 'matched' | 'missing' | 'additional'
  marker: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {skills.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">None</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <SkillChip key={`${tone}-${skill}`} skill={skill} tone={tone} marker={marker} />
          ))}
        </div>
      )}
    </div>
  )
}

export function JobMatchCard({
  interviewer,
  skillMatch,
  listPricePaise,
  ratingAvg,
  reviewCount,
}: {
  interviewer: MatchingCatalogPerson
  skillMatch: SkillMatchDetail
  listPricePaise: number | null
  ratingAvg: number | null
  reviewCount: number
}) {
  const percentLabel = formatSkillPercentLabel(skillMatch.percent)
  const percentValue = Math.max(0, Math.min(100, skillMatch.percent ?? 0))
  const roleLine = [interviewer.currentRole, interviewer.company].filter(Boolean).join(' @ ')

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex gap-3">
        <Avatar src={interviewer.photo} name={interviewer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold text-navy-950">{interviewer.name}</h3>
          {roleLine ? <p className="mt-0.5 break-words text-sm text-slate-600">{roleLine}</p> : null}
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-semibold text-navy-950">{percentLabel ?? '0'}% job skill coverage</span>
            {ratingAvg != null ? <span> · {ratingAvg} rating</span> : null}
            {reviewCount > 0 ? <span> · {reviewCount} reviews</span> : null}
          </p>
          {listPricePaise != null ? (
            <p className="mt-0.5 text-sm text-slate-600">From {formatMoneyFromPaise(listPricePaise)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4" aria-label={`Job skill coverage ${percentValue}%`}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percentValue}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{percentValue}% of this job's skills are covered</p>
      </div>

      <div className="mt-4 space-y-3">
        <SkillGroup label="Matched job skills" skills={skillMatch.matchedSkills} tone="matched" marker="Matched" />
        <SkillGroup label="Missing job skills" skills={skillMatch.candidateMissingSkills} tone="missing" marker="Missing" />
        <SkillGroup label="Additional interviewer skills" skills={skillMatch.interviewerExtraSkills} tone="additional" marker="Also" />
      </div>

      <p className="mt-3 text-xs text-slate-500">Job skill coverage only — not a booking or availability guarantee.</p>

      <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
        <Link to={`/candidate/interviewers/${interviewer.id}`} className="sm:flex-1">
          <Button variant="outline" size="sm" fullWidth>
            View Profile
          </Button>
        </Link>
        <Link to={`/candidate/interviewers/${interviewer.id}/book`} className="sm:flex-1">
          <Button size="sm" fullWidth>
            Book
          </Button>
        </Link>
      </div>
    </article>
  )
}
