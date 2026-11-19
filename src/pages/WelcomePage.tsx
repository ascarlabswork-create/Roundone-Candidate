import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { RoleSuggestInput } from '../components/ui/RoleSuggestInput.tsx'
import { SkillMultiInput } from '../components/ui/SkillMultiInput.tsx'
import { Card, FieldLabel } from '../components/ui/primitives.tsx'
import { TARGET_ROLES } from '../data/catalogs.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { localResumeSkillPlan } from '../resume/localSkillPlan.ts'
import { extractResumeText } from '../resume/resumeText.ts'
import {
  getCandidateProfile,
  getCandidateSkills,
  updateCandidatePreferences,
  updateCandidateProfile,
  updateCandidateSkills,
} from '../services/candidateProfile.ts'
import { useMatching } from '../state/matching.tsx'

const INTENT_READY_KEY = 'roundone.intentReady'
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

function suggestionChipClass(selected: boolean) {
  return selected
    ? 'inline-flex h-6 max-w-full items-center truncate rounded-md bg-navy-950 px-2 text-[11px] font-medium text-white'
    : 'inline-flex h-6 max-w-full items-center truncate rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-navy-700'
}

function rolesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailConfirmed = searchParams.get('confirmed') === '1'
  const { setPreferences } = useMatching()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [alreadySet, setAlreadySet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readingResume, setReadingResume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillDraft, setSkillDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [account, savedSkills] = await Promise.all([getCandidateProfile(), getCandidateSkills()])
        if (cancelled) return
        const roleValue = account.candidate.target_role?.trim() ?? ''
        const saved = dedupeSkills(savedSkills)
        if (roleValue && saved.length > 0) {
          sessionStorage.setItem(INTENT_READY_KEY, '1')
          setAlreadySet(true)
          return
        }
        setRole(roleValue)
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

  async function readResume(file: File) {
    setError(null)
    setReadingResume(true)
    try {
      const text = await extractResumeText(file)
      const found = localResumeSkillPlan(text)?.extractedSkills.map((item) => item.skill) ?? []
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
    const nextRole = role.trim()
    const nextSkills = dedupeSkills(skills)
    if (!nextRole) {
      setError('Add the role you want.')
      return
    }
    if (nextSkills.length === 0) {
      setError('Add at least one skill.')
      return
    }
    setSaving(true)
    try {
      await updateCandidateProfile({ targetRole: nextRole, headline: nextRole })
      await updateCandidateSkills(nextSkills)
      await updateCandidatePreferences({ skills: nextSkills })
      setPreferences({
        targetRole: nextRole,
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
      sessionStorage.setItem(INTENT_READY_KEY, '1')
      navigate('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  if (alreadySet) return <Navigate to="/" replace />

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
      {emailConfirmed ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Email confirmed</p>
          <p className="mt-1 text-emerald-800">
            You’re signed in. Add your role and skills below, then continue to your dashboard.
          </p>
        </div>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Before your dashboard</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">What are you preparing for?</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Add your role and a few skills. You can change this later from your profile.
      </p>

      <Card className="mt-6 p-4 sm:mt-8 sm:p-8">
        {loading ? (
          <p className="text-sm text-slate-600">Loading your profile…</p>
        ) : (
          <form className="grid gap-6" onSubmit={(event) => void save(event)}>
            <fieldset>
              <legend className="text-sm font-semibold text-navy-950">Role you want</legend>
              <div className="mt-3">
                <FieldLabel htmlFor="welcome-role">Type your role</FieldLabel>
                <RoleSuggestInput
                  id="welcome-role"
                  required
                  disabled={saving}
                  placeholder="Software Engineer, ML Engineer…"
                  options={TARGET_ROLES}
                  value={role}
                  onChange={(next) => {
                    setError(null)
                    setRole(next)
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK_ROLES.map((option) => {
                  const selected = rolesMatch(role, option)
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setError(null)
                        setRole(selected ? '' : option)
                      }}
                      className={suggestionChipClass(selected)}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-navy-950">Skills</legend>
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
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        aria-label={`Remove ${skill}`}
                        onClick={() => {
                          setError(null)
                          setSkills((current) =>
                            current.filter((item) => item.toLowerCase() !== skill.toLowerCase()),
                          )
                        }}
                        className={suggestionChipClass(true)}
                      >
                        {skill} ×
                      </button>
                    ))}
                  </div>
                ) : null}
                {QUICK_SKILLS.some(
                  (skill) => !skills.some((item) => item.toLowerCase() === skill.toLowerCase()),
                ) ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {QUICK_SKILLS.filter(
                      (skill) => !skills.some((item) => item.toLowerCase() === skill.toLowerCase()),
                    ).map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          setError(null)
                          setSkills((current) => dedupeSkills([...current, skill]))
                        }}
                        className={suggestionChipClass(false)}
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-1">
                  <Button type="button" variant="outline" fullWidth disabled={readingResume} onClick={() => fileRef.current?.click()}>
                    {readingResume ? 'Reading…' : 'Upload resume'}
                  </Button>
                </div>
              </div>
            </fieldset>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="pt-1">
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
