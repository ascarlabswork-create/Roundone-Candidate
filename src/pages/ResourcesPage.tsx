import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookMarked, ChevronDown, Compass, Library, Search, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/Button.tsx'
import { Card, Chip, TextInput } from '../components/ui/primitives.tsx'
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

const KIND_ACCENT: Record<ResourceKind, { label: string; chip: string; rail: string; hover: string }> = {
  Guide: {
    label: 'text-sky-800',
    chip: 'bg-sky-50 text-sky-800 ring-sky-100',
    rail: 'from-sky-400 to-cyan-400',
    hover: 'hover:border-sky-200 hover:shadow-sky-100/50',
  },
  Template: {
    label: 'text-violet-800',
    chip: 'bg-violet-50 text-violet-800 ring-violet-100',
    rail: 'from-violet-400 to-purple-400',
    hover: 'hover:border-violet-200 hover:shadow-violet-100/50',
  },
  Checklist: {
    label: 'text-emerald-800',
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    rail: 'from-emerald-400 to-teal-400',
    hover: 'hover:border-emerald-200 hover:shadow-emerald-100/50',
  },
  Drill: {
    label: 'text-coral-800',
    chip: 'bg-orange-50 text-coral-800 ring-orange-100',
    rail: 'from-orange-400 to-coral-500',
    hover: 'hover:border-orange-200 hover:shadow-orange-100/50',
  },
  Article: {
    label: 'text-indigo-800',
    chip: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
    rail: 'from-indigo-400 to-blue-400',
    hover: 'hover:border-indigo-200 hover:shadow-indigo-100/50',
  },
}

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
  const accent = KIND_ACCENT[resource.kind]
  return (
    <Card
      className={`resource-card resource-card-lift overflow-hidden border-slate-200/80 p-0 shadow-sm transition-shadow ${accent.hover}`}
    >
      <div className={`h-1 w-full bg-gradient-to-r ${accent.rail}`} aria-hidden />
      <button
        type="button"
        onClick={onToggle}
        className="group w-full p-5 text-left transition-colors hover:bg-gradient-to-br hover:from-white hover:to-slate-50/80"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-xs font-semibold uppercase tracking-wide ${accent.label}`}>{resource.kind}</p>
          <span className="text-xs text-slate-400">· {resource.minutes} min read</span>
          {reason ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${accent.chip}`}>{reason}</span>
          ) : null}
        </div>
        <h2 className="mt-1 text-base font-semibold text-navy-950 transition-colors group-hover:text-navy-900">
          {resource.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{resource.summary}</p>
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-800">
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
          {open ? 'Hide steps' : 'Show steps'}
        </p>
      </button>
      {open ? (
        <div className="resource-expand border-t border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {resource.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {(resource.skills.length > 0 || resource.interviewTypes.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...resource.interviewTypes, ...resource.skills.slice(0, 6)].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200/80"
                >
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
    <div className="resource-library relative isolate overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-gradient-to-b from-violet-50/95 via-sky-50/50 to-transparent"
        aria-hidden
      />
      <div
        className="resource-orb resource-orb-a pointer-events-none absolute -left-20 top-6 h-52 w-52 rounded-full bg-violet-200/45 blur-3xl"
        aria-hidden
      />
      <div
        className="resource-orb resource-orb-b pointer-events-none absolute -right-12 top-32 h-44 w-44 rounded-full bg-sky-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/3 top-48 -z-10 h-32 w-32 rounded-full bg-emerald-100/35 blur-3xl resource-orb resource-orb-c"
        aria-hidden
      />

      <section className="resource-enter mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-800">
          <Library className="h-4 w-4" aria-hidden />
          Prep library
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">Resources that match your loop</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Practical guides tied to your role and skills — not generic blog filler. Pair this with{' '}
          <Link
            to="/candidate/preparation"
            className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2"
          >
            AI Prep
          </Link>{' '}
          for priorities, then use these playbooks when you study.
        </p>
      </section>

      <FadeIn className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
        {focusBits.length > 0 ? (
          <div className="resource-signal-card relative overflow-hidden rounded-2xl border border-violet-100/90 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 via-violet-400 to-sky-400" aria-hidden />
            <div className="pl-3">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-800">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Based on your prep
              </p>
              <p className="mt-1 text-sm leading-6 text-navy-950">
                We ranked these using <span className="font-medium">{focusBits.join(', ')}</span>. Update profile or skills
                anytime to retarget.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
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
                <Link to="/candidate/preparation">
                  <Button size="sm" variant="ghost" className="text-emerald-800">
                    Open AI Prep →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="resource-signal-card rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm text-slate-600 shadow-sm">
            Add a target role and skills on your profile to personalize this page.{' '}
            <Link to="/candidate/welcome" className="font-medium text-violet-800 underline decoration-violet-200">
              Complete setup
            </Link>
          </div>
        )}
      </FadeIn>

      <section className="mx-auto mt-10 max-w-5xl px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-violet-700" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-800/90">For you</h2>
        </div>
        <div className="resource-stagger mt-4 space-y-3">
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

      <section className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 resource-fade-up">
        <div className="rounded-2xl border border-sky-100/80 bg-gradient-to-br from-white via-white to-sky-50/40 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-sky-800" aria-hidden />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-900/80">Browse all</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">{CANDIDATE_RESOURCES.length} resources you can open anytime.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <label htmlFor="resource-search" className="sr-only">
                Search resources
              </label>
              <TextInput
                id="resource-search"
                value={query}
                placeholder="SQL, system design, behavioral…"
                className="resource-search-input pl-10 text-base"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="resource-filter-chips mt-4 flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>

        <div className="resource-stagger mt-4 space-y-3">
          {browse.length === 0 ? (
            <Card className="border-dashed border-slate-200 bg-slate-50/50 p-5 text-sm text-slate-600">
              No resources match that filter. Try another skill or kind.
            </Card>
          ) : (
            browse.map((resource) => (
              <ResourceCard
                key={`browse-${resource.id}`}
                resource={resource}
                open={openId === `browse-${resource.id}`}
                onToggle={() =>
                  setOpenId((current) => (current === `browse-${resource.id}` ? null : `browse-${resource.id}`))
                }
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function FadeIn({ className, children }: { className?: string; children: ReactNode }) {
  const cls = ['resource-fade-up', className].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}
