import { GitCompare, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTimeInZone } from '../../availability/index.ts'
import { getNextSlot, isVerified } from '../../data/interviewers.ts'
import { formatCount, formatINR } from '../../lib/format.ts'
import type { Interviewer } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { Avatar, MatchScore, StarRating, VerifiedBadge } from '../ui/identity.tsx'
import { Badge } from '../ui/primitives.tsx'

const MAX_COMPARE = 3

function uniqueSkills(person: Interviewer) {
  return [...new Set([...person.skills, ...person.technologies])]
}

function MatchCell({ score }: { score?: number }) {
  if (typeof score !== 'number') {
    return <span className="text-slate-400">—</span>
  }
  return <MatchScore score={score} size="sm" />
}

function CompanyCell({ person }: { person: Interviewer }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-navy-950">
        {person.currentRole} @ {person.company}
      </p>
      <p className="text-slate-500">
        {person.previousCompanies.length > 0
          ? `Previously: ${person.previousCompanies.join(', ')}`
          : 'No previous companies listed'}
      </p>
    </div>
  )
}

function AvailabilityCell({ person }: { person: Interviewer }) {
  const next = person.availability.recurring.length > 0 || person.availability.custom.length > 0
    ? getNextSlot(person)
    : null
  return <span>{next ? formatDateTimeInZone(next.start, person.availability.timezone) : 'See booking for live times'}</span>
}

function TypeBadges({ person }: { person: Interviewer }) {
  return (
    <div className="flex flex-wrap gap-1">
      {person.interviewTypes.map((type) => (
        <Badge key={type} tone="blue">
          {type}
        </Badge>
      ))}
    </div>
  )
}

function SkillBadges({ person }: { person: Interviewer }) {
  return (
    <div className="flex flex-wrap gap-1">
      {uniqueSkills(person).map((skill) => (
        <Badge key={skill}>{skill}</Badge>
      ))}
    </div>
  )
}

function ActionButtons({ person }: { person: Interviewer }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link to={`/candidate/interviewers/${person.id}`} className="sm:flex-1">
        <Button variant="outline" size="sm" fullWidth>
          View Profile
        </Button>
      </Link>
      <Link to={`/candidate/interviewers/${person.id}/book`} className="sm:flex-1">
        <Button size="sm" fullWidth>
          Book
        </Button>
      </Link>
    </div>
  )
}

function compareRows(matchById: Map<string, number>): Array<{
  key: string
  label: string
  cell: (person: Interviewer) => ReactNode
}> {
  return [
    {
      key: 'match',
      label: 'Match %',
      cell: (person) => <MatchCell score={matchById.get(person.id)} />,
    },
    {
      key: 'experience',
      label: 'Experience',
      cell: (person) => `${person.experienceYears}+ years`,
    },
    {
      key: 'rating',
      label: 'Rating',
      cell: (person) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StarRating value={person.rating} />
          <span className="font-medium text-navy-950">{person.rating}</span>
        </span>
      ),
    },
    {
      key: 'reviews',
      label: 'Reviews',
      cell: (person) => `${formatCount(person.reviewCount)} reviews`,
    },
    {
      key: 'completed',
      label: 'Completed interviews',
      cell: (person) => formatCount(person.completedInterviews),
    },
    {
      key: 'types',
      label: 'Interview types',
      cell: (person) => <TypeBadges person={person} />,
    },
    {
      key: 'skills',
      label: 'Skills',
      cell: (person) => <SkillBadges person={person} />,
    },
    {
      key: 'company',
      label: 'Company experience',
      cell: (person) => <CompanyCell person={person} />,
    },
    {
      key: 'price',
      label: 'Price',
      cell: (person) => (
        <span className="font-semibold text-navy-950">{formatINR(person.price)} / session</span>
      ),
    },
    {
      key: 'availability',
      label: 'Next availability',
      cell: (person) => <AvailabilityCell person={person} />,
    },
  ]
}

function PersonHeader({
  person,
  onRemove,
}: {
  person: Interviewer
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar src={person.photo} name={person.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate font-semibold text-navy-950">{person.name}</p>
            {isVerified(person) ? <VerifiedBadge compact /> : null}
          </div>
          <button
            type="button"
            onClick={() => onRemove(person.id)}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-navy-900"
            aria-label={`Remove ${person.name} from comparison`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ComparePanel({
  interviewers,
  matchById,
  onRemove,
  onClear,
}: {
  interviewers: Interviewer[]
  matchById: Map<string, number>
  onRemove: (id: string) => void
  onClear: () => void
}) {
  if (interviewers.length === 0) return null

  const rows = compareRows(matchById)
  const ready = interviewers.length >= 2

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-navy-950">
              Compare ({interviewers.length} of {MAX_COMPARE})
            </p>
            {!ready ? (
              <p className="text-sm text-slate-500">Select one more interviewer to see the table</p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>

        {!ready ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {interviewers.map((person) => (
              <div
                key={person.id}
                className="flex min-w-56 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <PersonHeader person={person} onRemove={onRemove} />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[min(62vh,36rem)] overflow-auto">
            <div className="hidden md:block">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <caption className="sr-only">Interviewer comparison</caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="sticky left-0 z-10 w-40 bg-white py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Profile
                    </th>
                    {interviewers.map((person) => (
                      <th key={person.id} scope="col" className="px-3 py-3 align-top font-normal">
                        <PersonHeader person={person} onRemove={onRemove} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100 align-top">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {row.label}
                      </th>
                      {interviewers.map((person) => (
                        <td key={person.id} className="px-3 py-3 text-slate-700">
                          {row.cell(person)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="align-top">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Actions
                    </th>
                    {interviewers.map((person) => (
                      <td key={person.id} className="px-3 py-3">
                        <ActionButtons person={person} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {interviewers.map((person) => (
                <article key={person.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <PersonHeader person={person} onRemove={onRemove} />
                  <dl className="mt-4 space-y-3">
                    {rows.map((row) => (
                      <div key={row.key}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {row.label}
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700">{row.cell(person)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <ActionButtons person={person} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const COMPARE_MAX = MAX_COMPARE
