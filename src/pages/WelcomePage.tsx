import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { RoleSuggestInput } from '../components/ui/RoleSuggestInput.tsx'
import { SkillMultiInput } from '../components/ui/SkillMultiInput.tsx'
import { Card, FieldLabel } from '../components/ui/primitives.tsx'
import { TARGET_ROLES } from '../data/catalogs.ts'
import { markIntentReady } from '../lib/intentReady.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { extractSkillsFromResumeText } from '../resume/extractResumeSkills.ts'
import { extractResumeText } from '../resume/resumeText.ts'
import {
  getCandidateProfile,
  getCandidateSkills,
  updateCandidatePreferences,
  updateCandidateProfile,
  updateCandidateSkills,
} from '../services/candidateProfile.ts'
import { useMatching } from '../state/matching.tsx'
import { useSession } from '../state/session.tsx'

const QUICK_ROLES = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Data Scientist',
  'ML Engineer',
  'DevOps Engineer',
  'Product Manager',
] as const
const QUICK_SKILLS = ['Python', 'Java', 'SQL', 'React', 'Machine Learning', 'System Design'] as const

function uniqueLabels(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, ' ')
    if (value.length < 2) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function parseStoredRoles(raw: string) {
  return uniqueLabels(raw.split(/[,;|·]/).map((part) => part.trim()))
}

function formatStoredRoles(roles: string[]) {
  return roles.join(', ')
}

function hasLabel(list: string[], label: string) {
  const key = label.trim().toLowerCase()
  return list.some((item) => item.toLowerCase() === key)
}

function selectedChipClass() {
  return 'welcome-chip-in inline-flex h-7 max-w-full items-center gap-1 truncate rounded-full bg-navy-950 px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-navy-800'
}

function suggestionChipClass() {
  return 'welcome-chip-in inline-flex h-7 max-w-full items-center truncate rounded-full border border-slate-300/90 bg-white/90 px-2.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-coral-500 hover:text-navy-950'
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailConfirmed = searchParams.get('confirmed') === '1'
  const { user } = useSession()
  const { setPreferences } = useMatching()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [alreadySet, setAlreadySet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readingResume, setReadingResume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [roleDraft, setRoleDraft] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillDraft, setSkillDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [account, savedSkills] = await Promise.all([getCandidateProfile(), getCandidateSkills()])
        if (cancelled) return
        const savedRoles = parseStoredRoles(account.candidate.target_role ?? '')
        const saved = dedupeSkills(savedSkills)
        if (savedRoles.length > 0 && saved.length > 0) {
          markIntentReady(account.userId)
          setAlreadySet(true)
          return
        }
        setRoles(savedRoles)
        setSkills(saved)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load your profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function addRoles(values: string[]) {
    if (values.length === 0) return
    const next = uniqueLabels([...roles, ...values])
    if (next.length === roles.length) {
      setError('That role is already added.')
      return
    }
    setError(null)
    setRoles(next)
    setRoleDraft('')
  }

  function removeRole(role: string) {
    setError(null)
    setRoles((current) => current.filter((item) => item.toLowerCase() !== role.toLowerCase()))
  }

  function addSkills(values: string[]) {
    if (values.length === 0) return
    const next = dedupeSkills([...skills, ...values])
    if (next.length === skills.length) {
      setError('Add a skill such as Python, SQL, or System Design.')
      return
    }
    setError(null)
    setSkills(next)
    setSkillDraft('')
  }

  function removeSkill(skill: string) {
    setError(null)
    setSkills((current) => current.filter((item) => item.toLowerCase() !== skill.toLowerCase()))
  }

  async function readResume(file: File) {
    setError(null)
    setReadingResume(true)
    try {
      const text = await extractResumeText(file)
      const found = extractSkillsFromResumeText(text, { limit: 36 })
      if (found.length === 0) {
        setError('No skills stood out in that resume. Pick a few below.')
        return
      }
      setSkills((current) => dedupeSkills([...current, ...found]))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read that resume.')
    } finally {
      setReadingResume(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const nextRoles = uniqueLabels(roles)
    const nextSkills = dedupeSkills(skills)
    if (nextRoles.length === 0) {
      setError('Add at least one role.')
      return
    }
    if (nextSkills.length === 0) {
      setError('Add at least one skill.')
      return
    }
    const primaryRole = nextRoles[0]!
    const storedRoles = formatStoredRoles(nextRoles)
    setSaving(true)
    try {
      await updateCandidateProfile({ targetRole: storedRoles, headline: primaryRole })
      await updateCandidateSkills(nextSkills)
      await updateCandidatePreferences({ skills: nextSkills })
      setPreferences({
        targetRole: primaryRole,
        candidateLevel: '',
        interviewType: '',
        targetCompany: '',
        skills: nextSkills,
        preferredDate: '',
        preferredDateEnd: '',
        preferredTime: '',
        budget: 0,
        language: '',
        naturalLanguageQuery: '',
      })
      markIntentReady(user?.id)
      navigate('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  if (alreadySet) return <Navigate to="/" replace />

  const availableQuickRoles = QUICK_ROLES.filter((role) => !hasLabel(roles, role))
  const availableQuickSkills = QUICK_SKILLS.filter((skill) => !hasLabel(skills, skill))

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-coral-200/50 blur-3xl welcome-orb"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-28 h-36 w-36 rounded-full bg-sky-200/45 blur-3xl welcome-orb [animation-delay:1.2s]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-10 left-1/3 h-28 w-28 rounded-full bg-mint-500/15 blur-3xl welcome-orb [animation-delay:2.4s]"
      />

      {emailConfirmed ? (
        <div className="welcome-rise mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-900 shadow-sm">
          <p className="font-semibold">Email confirmed</p>
          <p className="mt-1 text-emerald-800">
            You’re signed in. Add your roles and skills below, then continue to your dashboard.
          </p>
        </div>
      ) : null}

      <div className="welcome-rise relative" style={{ animationDelay: '40ms' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Before your dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">
          What are you preparing for?
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Pick one or more roles, then add skills. You can change this later from your profile.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-coral-600" />
          {roles.length} role{roles.length === 1 ? '' : 's'} · {skills.length} skill{skills.length === 1 ? '' : 's'}
        </p>
      </div>

      <Card className="welcome-rise relative mt-6 border-white/70 bg-white/95 p-4 shadow-[0_18px_50px_-28px_rgba(16,28,53,0.45)] backdrop-blur sm:mt-8 sm:p-8">
        {loading ? (
          <p className="text-sm text-slate-600">Loading your profile…</p>
        ) : (
          <form className="grid gap-7" onSubmit={(event) => void save(event)}>
            <fieldset className="welcome-rise" style={{ animationDelay: '90ms' }}>
              <legend className="text-sm font-semibold text-navy-950">Roles you want</legend>
              <p className="mt-1 text-xs text-slate-500">Select multiple. Added roles appear below the field.</p>
              <div className="mt-3 flex gap-2">
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="welcome-role">Type a role</FieldLabel>
                  <RoleSuggestInput
                    id="welcome-role"
                    disabled={saving}
                    placeholder="Software Engineer, ML Engineer…"
                    options={TARGET_ROLES}
                    exclude={roles}
                    value={roleDraft}
                    onChange={(next) => {
                      setError(null)
                      setRoleDraft(next)
                    }}
                    onCommit={(role) => addRoles([role])}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || !roleDraft.trim()}
                    onClick={() => addRoles([roleDraft])}
                  >
                    + Add
                  </Button>
                </div>
              </div>

              {roles.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-navy-950/8 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your roles</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {roles.map((role, index) => (
                      <button
                        key={role}
                        type="button"
                        aria-label={`Remove ${role}`}
                        onClick={() => removeRole(role)}
                        className={selectedChipClass()}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        {role} ×
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {availableQuickRoles.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested roles</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {availableQuickRoles.map((role, index) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => addRoles([role])}
                        className={suggestionChipClass()}
                        style={{ animationDelay: `${80 + index * 35}ms` }}
                      >
                        + {role}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </fieldset>

            <fieldset className="welcome-rise" style={{ animationDelay: '160ms' }}>
              <legend className="text-sm font-semibold text-navy-950">Skills</legend>
              <p className="mt-1 text-xs text-slate-500">Added skills stay separate from suggestions.</p>
              <div className="mt-3 grid gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void readResume(file)
                  }}
                />
                <SkillMultiInput
                  id="welcome-skill"
                  value={skillDraft}
                  onChange={(next) => {
                    setError(null)
                    setSkillDraft(next)
                  }}
                  selected={skills}
                  onAdd={addSkills}
                  placeholder="Type a skill, e.g. py → Python"
                  disabled={readingResume || saving}
                  hint=""
                  compact
                />

                {skills.length > 0 ? (
                  <div className="rounded-2xl border border-navy-950/8 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your skills</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skills.map((skill, index) => (
                        <button
                          key={skill}
                          type="button"
                          aria-label={`Remove ${skill}`}
                          onClick={() => removeSkill(skill)}
                          className={selectedChipClass()}
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          {skill} ×
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {availableQuickSkills.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested skills</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {availableQuickSkills.map((skill, index) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSkills([skill])}
                          className={suggestionChipClass()}
                          style={{ animationDelay: `${80 + index * 35}ms` }}
                        >
                          + {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-1">
                  <Button
                    type="button"
                    variant="outline"
                    fullWidth
                    disabled={readingResume}
                    onClick={() => fileRef.current?.click()}
                  >
                    {readingResume ? 'Reading…' : 'Upload resume'}
                  </Button>
                </div>
              </div>
            </fieldset>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="welcome-rise pt-1" style={{ animationDelay: '220ms' }}>
              <Button type="submit" fullWidth disabled={saving || readingResume}>
                {saving ? 'Saving…' : 'Save and open home'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
