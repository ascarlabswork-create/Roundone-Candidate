import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookMarked, BookOpen, CalendarDays, Compass, Library, Sparkles, Target } from 'lucide-react'
import { DataUseConsent } from '../components/legal/DataUseConsent.tsx'
import { Button } from '../components/ui/Button.tsx'
import {
  Badge,
  Card,
  Chip,
  EmptyState,
  FieldLabel,
  SelectInput,
  TextArea,
  TextInput,
} from '../components/ui/primitives.tsx'
import { CANDIDATE_LEVELS, INTERVIEW_TYPES, SKILLS, TARGET_ROLES } from '../data/catalogs.ts'
import { requestPreparationAssist } from '../preparation/aiAssist.ts'
import {
  canGeneratePreparation,
  preparationInputHash,
  practiceHrefFromPreparation,
  type PreparationInput,
  type PreparationPriorityTopic,
  type PreparationResult,
} from '../preparation/aiModel.ts'
import {
  clearSavedPreparation,
  readSavedPreparation,
  writeSavedPreparation,
} from '../preparation/session.ts'
import { getCandidatePreferencesIfPresent, getCandidateSkills } from '../services/candidateProfile.ts'
import { useSession } from '../state/session.tsx'

const UNAVAILABLE = 'Preparation suggestions are temporarily unavailable.'
const PREP_CHECKLIST_KEY = 'roundone.prepChecklist'

const DEFAULT_CHECKLIST = [
  'Skim your profile summary once before practicing',
  'Turn the top priority topic into a 2-minute spoken pitch',
  'Note one gap to address in AI Practice today',
] as const

type StudyDay = { label: string; focus: string; topics: string[] }

function priorityTone(priority: string): 'blue' | 'violet' | 'slate' {
  if (priority === 'high') return 'violet'
  if (priority === 'medium') return 'blue'
  return 'slate'
}

function prepReadinessPercent(input: PreparationInput) {
  let score = 0
  if (input.targetRole.trim()) score += 25
  if (input.skills.length >= 2) score += 25
  else if (input.skills.length === 1) score += 12
  if (input.resumeText.trim().length >= 120) score += 30
  else if (input.resumeText.trim().length >= 40) score += 18
  if (input.interviewType.trim()) score += 10
  if (input.experienceLevel.trim()) score += 10
  return Math.min(100, score)
}

function buildStudyPlan(topics: PreparationPriorityTopic[]): StudyDay[] {
  const names = topics.map((item) => item.topic)
  const high = topics.filter((item) => item.priority === 'high').map((item) => item.topic)
  const rest = topics.filter((item) => item.priority !== 'high').map((item) => item.topic)
  const day1 = high.length > 0 ? high.slice(0, 3) : names.slice(0, 2)
  const day2 = rest.length > 0 ? rest.slice(0, 3) : names.slice(2, 5)
  const day3 = [...new Set([...names.slice(0, 6)])].filter((item) => !day1.includes(item) && !day2.includes(item)).slice(0, 3)
  return [
    {
      label: 'Day 1 — Anchor',
      focus: 'Highest-impact topics and crisp narratives',
      topics: day1.length ? day1 : ['Core role fundamentals'],
    },
    {
      label: 'Day 2 — Depth',
      focus: 'Trade-offs, examples, and follow-up angles',
      topics: day2.length ? day2 : day1.slice(0, 2),
    },
    {
      label: 'Day 3 — Pressure test',
      focus: 'Mixed recall + one timed AI practice block',
      topics: day3.length ? day3 : ['Run AI Practice on your weakest topic'],
    },
  ]
}

function readChecklist(): string[] {
  try {
    const raw = sessionStorage.getItem(PREP_CHECKLIST_KEY)
    if (!raw) return [...DEFAULT_CHECKLIST]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_CHECKLIST]
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 16)
  } catch {
    return [...DEFAULT_CHECKLIST]
  }
}

function writeChecklist(items: string[]) {
  try {
    sessionStorage.setItem(PREP_CHECKLIST_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function checklistFromResult(result: PreparationResult | null) {
  if (!result) return [...DEFAULT_CHECKLIST]
  const high = result.priorityTopics.filter((item) => item.priority === 'high').slice(0, 3).map((item) => `Study: ${item.topic}`)
  return [...DEFAULT_CHECKLIST, ...high].slice(0, 12)
}

export function PreparationPage() {
  const { account } = useSession()
  const saved = readSavedPreparation()
  const [input, setInput] = useState<PreparationInput>(
    saved?.input ?? {
      targetRole: '',
      experienceLevel: '',
      skills: [],
      interviewType: '',
      resumeText: '',
    },
  )
  const [skillDraft, setSkillDraft] = useState('')
  const [result, setResult] = useState<PreparationResult | null>(saved?.result ?? null)
  const [resultHash, setResultHash] = useState(saved?.inputHash ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preparationConsent, setPreparationConsent] = useState(false)
  const [prefilled, setPrefilled] = useState(Boolean(saved))
  const [checklist, setChecklist] = useState<string[]>(() => readChecklist())
  const [checked, setChecked] = useState<string[]>([])
  const submittingRef = useRef(false)

  const readiness = prepReadinessPercent(input)
  const studyPlan = useMemo(() => buildStudyPlan(result?.priorityTopics ?? []), [result?.priorityTopics])

  useEffect(() => {
    if (prefilled || !account) return
    let cancelled = false
    void Promise.all([getCandidatePreferencesIfPresent(), getCandidateSkills()])
      .then(([preferences, skills]) => {
        if (cancelled) return
        setInput((current) => ({
          targetRole: current.targetRole || account.candidate.target_role || '',
          experienceLevel: current.experienceLevel || account.candidate.candidate_level || '',
          interviewType: current.interviewType || preferences?.interview_type || '',
          skills: current.skills.length > 0 ? current.skills : (skills.length > 0 ? skills : preferences?.skills ?? []).slice(0, 12),
          resumeText: current.resumeText,
        }))
        setPrefilled(true)
      })
      .catch(() => {
        if (!cancelled) setPrefilled(true)
      })
    return () => {
      cancelled = true
    }
  }, [account, prefilled])

  useEffect(() => {
    if (!result) return
    const next = checklistFromResult(result)
    setChecklist(next)
    writeChecklist(next)
    setChecked([])
  }, [resultHash, result])

  function toggleChecklistItem(item: string) {
    setChecked((current) => (current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]))
  }

  function addSkill(value: string) {
    const skill = value.trim()
    if (!skill || input.skills.includes(skill) || input.skills.length >= 12) return
    setInput({ ...input, skills: [...input.skills, skill] })
    setSkillDraft('')
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault()
    if (busy || submittingRef.current || !preparationConsent || !canGeneratePreparation(input)) return
    const hash = preparationInputHash(input)
    submittingRef.current = true
    setBusy(true)
    setError(null)
    const next = await requestPreparationAssist(input, hash)
    submittingRef.current = false
    setBusy(false)
    if (!next) {
      setError(UNAVAILABLE)
      return
    }
    setResult(next)
    setResultHash(hash)
    writeSavedPreparation({
      version: 1,
      inputHash: hash,
      input,
      result: next,
      generatedAt: new Date().toISOString(),
    })
  }

  function clearAll() {
    clearSavedPreparation()
    setResult(null)
    setResultHash('')
    setError(null)
    setChecked([])
  }

  const canGenerate = canGeneratePreparation(input)
  const stale = Boolean(result && resultHash && resultHash !== preparationInputHash(input))
  const checklistDone = checklist.length > 0 ? Math.round((checked.length / checklist.length) * 100) : 0

  return (
    <div className="prep-studio relative isolate overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-gradient-to-b from-emerald-50/95 via-teal-50/50 to-cyan-50/15"
        aria-hidden
      />
      <div className="prep-orb prep-orb-a pointer-events-none absolute -left-24 top-8 h-56 w-56 rounded-full bg-emerald-300/35 blur-3xl" aria-hidden />
      <div className="prep-orb prep-orb-b pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-teal-200/40 blur-3xl" aria-hidden />
      <div
        className="prep-orb prep-orb-c pointer-events-none absolute right-1/4 top-4 h-36 w-36 rounded-full bg-cyan-200/30 blur-3xl"
        aria-hidden
      />

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 prep-enter">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              <BookOpen className="h-4 w-4" aria-hidden />
              Study studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">Plan before you practice</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Build a focused study map from your role, level, and background. This page plans and prioritizes — it does not run a mock
              interview. When you are ready to be questioned, switch to{' '}
              <Link to="/candidate/practice" className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2">
                AI Practice
              </Link>
              .
            </p>
          </div>
          <div className="prep-readiness-card prep-readiness-shine flex items-center gap-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-white/95 to-emerald-50/40 px-5 py-4 shadow-sm backdrop-blur-sm">
            <ReadinessRing percent={readiness} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brief completeness</p>
              <p className="text-lg font-semibold text-navy-950">{readiness}%</p>
              <p className="text-xs text-slate-500">Role, skills, and context for better suggestions</p>
            </div>
          </div>
        </div>
      </section>

      <FadeIn className="mx-auto mt-10 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]" stagger>
        <form
          className="prep-panel prep-panel-glow space-y-6 rounded-2xl border border-emerald-200/60 bg-white/95 p-5 shadow-sm sm:p-8"
          onSubmit={(event) => void generate(event)}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-navy-950">
            <Compass className="h-4 w-4 text-emerald-700" aria-hidden />
            Your interview brief
          </div>

          <div className="prep-brief-fields grid gap-5 rounded-xl border border-emerald-100/60 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="prep-role">Target role</FieldLabel>
              <TextInput
                id="prep-role"
                list="prep-role-options"
                placeholder="Software Engineer, Product Manager…"
                value={input.targetRole}
                onChange={(event) => setInput({ ...input, targetRole: event.target.value })}
              />
              <datalist id="prep-role-options">
                {TARGET_ROLES.map((role) => (
                  <option key={role} value={role} />
                ))}
              </datalist>
            </div>
            <div>
              <FieldLabel htmlFor="prep-level">Experience level</FieldLabel>
              <SelectInput
                id="prep-level"
                value={input.experienceLevel}
                onChange={(event) => setInput({ ...input, experienceLevel: event.target.value })}
              >
                <option value="">From profile or select</option>
                {CANDIDATE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="prep-round">Interview round</FieldLabel>
              <SelectInput
                id="prep-round"
                value={input.interviewType}
                onChange={(event) => setInput({ ...input, interviewType: event.target.value })}
              >
                <option value="">Any / not sure yet</option>
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="prep-skills">Skills to emphasize</FieldLabel>
            <div className="flex gap-2">
              <TextInput
                id="prep-skills"
                list="prep-skill-options"
                placeholder="Python, FastAPI"
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addSkill(skillDraft)
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addSkill(skillDraft)}>
                Add
              </Button>
            </div>
            <datalist id="prep-skill-options">
              {SKILLS.map((skill) => (
                <option key={skill} value={skill} />
              ))}
            </datalist>
            <div className="mt-3 flex flex-wrap gap-2">
              {input.skills.length === 0 ? (
                <p className="text-sm text-slate-500">Add skills or paste background text below.</p>
              ) : (
                input.skills.map((skill) => (
                  <Chip
                    key={skill}
                    active
                    onClick={() => setInput({ ...input, skills: input.skills.filter((item) => item !== skill) })}
                  >
                    {skill} ×
                  </Chip>
                ))
              )}
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="prep-resume">Resume / background (optional)</FieldLabel>
            <TextArea
              id="prep-resume"
              className="min-h-40"
              value={input.resumeText}
              onChange={(event) => setInput({ ...input, resumeText: event.target.value.slice(0, 8000) })}
              placeholder="Paste relevant experience, projects, or skills. This stays private to your account session and is only sent to the secure preparation endpoint."
            />
            <p className="mt-1 text-xs text-slate-500">{input.resumeText.trim().length}/8000 · Not stored as a public document.</p>
          </div>

          <DataUseConsent id="preparation-consent" checked={preparationConsent} onChange={setPreparationConsent}>
            I agree to send this preparation text for optional AI suggestions. Nothing is saved to my public profile.{' '}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>
          </DataUseConsent>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {stale ? <p className="text-sm text-amber-800">Your brief changed — regenerate to refresh the study plan.</p> : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            {result ? (
              <Button type="button" variant="outline" onClick={clearAll}>
                Clear suggestions
              </Button>
            ) : null}
            <Button type="submit" disabled={!canGenerate || !preparationConsent || busy} className="prep-generate-glow">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 prep-spin-slow" aria-hidden />
                  Building your plan…
                </span>
              ) : result ? (
                'Regenerate study plan'
              ) : (
                'Generate study plan'
              )}
            </Button>
          </div>
        </form>

        <aside className="prep-aside space-y-4">
          <Card className="prep-aside-card border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Prep vs practice</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                <span>
                  <strong className="font-medium text-navy-950">Here:</strong> priorities, 3-day plan, checklists
                </span>
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" aria-hidden />
                <span>
                  <strong className="font-medium text-navy-950">AI Practice:</strong> live mocks, timed drills, scoring
                </span>
              </li>
            </ul>
            <div className="mt-4 space-y-2">
              <Link to="/candidate/practice" className="block">
                <Button variant="outline" fullWidth size="sm">
                  Go to AI Practice
                </Button>
              </Link>
              <Link to="/candidate/resources" className="block">
                <Button variant="ghost" fullWidth size="sm" className="text-violet-800 hover:bg-violet-50">
                  <span className="inline-flex items-center gap-2">
                    <Library className="h-4 w-4" aria-hidden />
                    Prep library →
                  </span>
                </Button>
              </Link>
            </div>
          </Card>
          <Card className="prep-aside-card border-violet-100/70 bg-gradient-to-br from-white to-violet-50/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Study playbooks</p>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              Guides and checklists ranked for your role — open{' '}
              <Link to="/candidate/resources" className="font-medium text-violet-900 underline decoration-violet-200">
                Resources
              </Link>{' '}
              while you work through your plan.
            </p>
            <Link to="/candidate/resources" className="mt-3 block">
              <Button variant="outline" fullWidth size="sm">
                <span className="inline-flex items-center gap-2">
                  <BookMarked className="h-4 w-4" aria-hidden />
                  Browse resources
                </span>
              </Button>
            </Link>
          </Card>
          {result ? (
            <Card className="prep-aside-card border-emerald-100/80 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
              <p className="mt-1 text-sm font-medium text-navy-950">{checklistDone}% done</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
                  style={{ width: `${checklistDone}%` }}
                />
              </div>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-700">
                {checklist.map((item) => {
                  const on = checked.includes(item)
                  return (
                    <li key={item}>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleChecklistItem(item)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span className={on ? 'text-slate-500 line-through' : ''}>{item}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ) : null}
        </aside>
      </FadeIn>

      {!result ? (
        <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6 prep-fade-up">
          <EmptyState
            title="No study plan yet"
            body="Fill in your brief and generate a plan. We only use what you provide — no invented experience."
          />
        </div>
      ) : (
        <div className="prep-results mx-auto mt-10 max-w-6xl space-y-6 px-4 sm:px-6">
          <Card className="prep-result-card border-emerald-100/80 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Profile brief</p>
            <h2 className="mt-1 font-semibold text-navy-950">How you show up on paper</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{result.profileSummary}</p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="prep-result-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-semibold text-navy-950">
                <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden />
                Suggested 3-day rhythm
              </h2>
              <p className="mt-1 text-sm text-slate-600">A lightweight schedule — adjust to your calendar.</p>
              <ol className="mt-4 space-y-4">
                {studyPlan.map((day) => (
                  <li
                    key={day.label}
                    className="prep-day-tile rounded-xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/30 to-white p-4"
                  >
                    <p className="text-sm font-semibold text-navy-950">{day.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{day.focus}</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {day.topics.map((topic) => (
                        <li key={topic}>
                          <Badge tone="blue">{topic}</Badge>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Card>

            <Card className="prep-result-card p-5 sm:p-6">
              <h2 className="font-semibold text-navy-950">Priority topics</h2>
              {result.priorityTopics.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No priority topics returned for this input.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {result.priorityTopics.map((item, index) => (
                    <li key={item.topic} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy-950">
                          {index + 1}. {item.topic}
                        </span>
                        <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <Card className="prep-result-card p-5 sm:p-6">
            <h2 className="font-semibold text-navy-950">Interview focus</h2>
            {result.interviewFocusAreas.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No focus areas returned.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.interviewFocusAreas.map((item) => (
                  <li key={item}>
                    <Badge tone="violet">{item}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="prep-result-card border-coral-100/60 bg-gradient-to-br from-white to-orange-50/30 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-navy-950">Ready to be questioned?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Jump into AI Practice with topics pre-filled from this plan. Sessions start only when you choose.
                </p>
              </div>
              <Link to={practiceHrefFromPreparation(input, result)} className="shrink-0">
                <Button>Start AI Practice with these topics</Button>
              </Link>
            </div>
            {result.practiceRecommendations.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No practice recommendations returned.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.practiceRecommendations.map((item) => (
                  <li
                    key={item.topic}
                    className="flex flex-col gap-2 rounded-lg border border-white/80 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-navy-950">{item.topic}</p>
                      <p className="text-sm text-slate-600">
                        {item.questionCount} questions · {item.difficulty}
                      </p>
                    </div>
                    <Link to={practiceHrefFromPreparation(input, result, item)}>
                      <Button size="sm" variant="outline">
                        Practice this topic
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function ReadinessRing({ percent }: { percent: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="prep-ring shrink-0" aria-hidden>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgb(226 232 240)" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="rgb(5 150 105)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        className="prep-ring-progress"
      />
      <text x="44" y="48" textAnchor="middle" className="fill-navy-950 text-[13px] font-semibold">
        {percent}
      </text>
    </svg>
  )
}

function FadeIn({
  className,
  children,
  stagger,
}: {
  className?: string
  children: ReactNode
  stagger?: boolean
}) {
  const cls = [className, stagger ? 'prep-stagger' : 'prep-fade-up'].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}
