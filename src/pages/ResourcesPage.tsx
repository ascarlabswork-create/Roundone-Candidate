import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, Chip, FieldLabel, PageHeader, TextInput } from '../components/ui/primitives.tsx'
import {
  CANDIDATE_RESOURCES,
  filterResources,
  rankResourcesForCandidate,
  type CandidateResource,
  type ResourceKind,
} from '../data/resources.ts'
import { getCandidatePreferencesIfPresent, getCandidateSkills } from '../services/candidateProfile.ts'
import { useSession } from '../state/session.tsx'

const KINDS: Array<ResourceKind | 'All'> = ['All', 'Guide', 'Template', 'Checklist', 'Drill', 'Article']

function ResourceCard({
  resource,
  reason,
  open,
  onToggle,
}: {
  resource: CandidateResource
  reason?: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={onToggle} className="w-full p-5 text-left hover:bg-slate-50/80">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">{resource.kind}</p>
          <span className="text-xs text-slate-400">· {resource.minutes} min read</span>
          {reason ? (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100">
              {reason}
            </span>
          ) : null}
        </div>
        <h2 className="mt-1 text-base font-semibold text-navy-950">{resource.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{resource.summary}</p>
        <p className="mt-3 text-xs font-medium text-coral-700">{open ? 'Hide steps' : 'Show steps'}</p>
      </button>
      {open ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {resource.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {(resource.skills.length > 0 || resource.interviewTypes.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...resource.interviewTypes, ...resource.skills.slice(0, 6)].map((tag) => (
                <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {resource.action ? (
            <div className="mt-4">
              <Link to={resource.action.to}>
                <Button size="sm">{resource.action.label}</Button>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

export function ResourcesPage() {
  const { account } = useSession()
  const [skills, setSkills] = useState<string[]>([])
  const [interviewType, setInterviewType] = useState<string>('')
  const [kind, setKind] = useState<ResourceKind | 'All'>('All')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return
    let cancelled = false
    void Promise.all([getCandidateSkills(), getCandidatePreferencesIfPresent()])
      .then(([nextSkills, preferences]) => {
        if (cancelled) return
        setSkills(nextSkills)
        setInterviewType(preferences?.interview_type ?? '')
      })
      .catch(() => {
        /* keep empty signals */
      })
    return () => {
      cancelled = true
    }
  }, [account])

  const signal = useMemo(
    () => ({
      role: account?.candidate.target_role ?? '',
      level: account?.candidate.candidate_level ?? '',
      skills,
      interviewType,
    }),
    [account, interviewType, skills],
  )

  const forYou = useMemo(() => rankResourcesForCandidate(signal, 4), [signal])
  const browse = useMemo(() => filterResources({ kind, query }), [kind, query])
  const focusBits = [signal.role, signal.level, interviewType, ...skills.slice(0, 4)].filter(Boolean)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Resources"
        subtitle="Practical guides matched to the role and skills you are preparing for — not generic blog filler."
      />

      {focusBits.length > 0 ? (
        <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Based on your prep</p>
          <p className="mt-1 text-sm text-navy-950">
            We ranked these using {focusBits.join(', ')}. Update your profile or resume skills anytime to retarget this list.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/candidate/profile">
              <Button size="sm" variant="outline">
                Edit profile
              </Button>
            </Link>
            <Link to="/candidate/resume-skills">
              <Button size="sm" variant="outline">
                Update resume skills
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Add a target role and skills on your profile to personalize this page.{' '}
          <Link to="/candidate/welcome" className="font-medium text-coral-700">
            Complete setup
          </Link>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">For you</h2>
        <div className="mt-3 space-y-3">
          {forYou.map(({ resource, score }) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              reason={score >= 5 ? 'Strong match' : score >= 3 ? 'Related to your skills' : 'Useful for every candidate'}
              open={openId === resource.id}
              onToggle={() => setOpenId((current) => (current === resource.id ? null : resource.id))}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Browse all</h2>
            <p className="mt-1 text-sm text-slate-600">{CANDIDATE_RESOURCES.length} resources you can open anytime.</p>
          </div>
          <div className="w-full sm:max-w-xs">
            <FieldLabel htmlFor="resource-search">Search</FieldLabel>
            <TextInput
              id="resource-search"
              value={query}
              placeholder="SQL, system design, behavioral…"
              className="text-base"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((item) => (
            <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
              {item}
            </Chip>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {browse.length === 0 ? (
            <Card className="p-5 text-sm text-slate-600">No resources match that filter. Try another skill or kind.</Card>
          ) : (
            browse.map((resource) => (
              <ResourceCard
                key={`browse-${resource.id}`}
                resource={resource}
                open={openId === `browse-${resource.id}`}
                onToggle={() => setOpenId((current) => (current === `browse-${resource.id}` ? null : `browse-${resource.id}`))}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
