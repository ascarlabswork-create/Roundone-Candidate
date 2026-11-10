import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, TextInput } from '../components/ui/primitives.tsx'
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
const QUICK_SKILLS = ['Python', 'Java', 'SQL', 'React', 'Machine Learning', 'System Design'] as const

function pillClass(selected: boolean) {
  return selected
    ? 'inline-flex min-h-11 items-center rounded-full bg-navy-950 px-3.5 py-2 text-sm text-white'
    : 'inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 hover:border-navy-700'
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

  function addSkill(raw: string) {
    const next = dedupeSkills([...skills, raw])
    if (next.length === skills.length && raw.trim()) {
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
            <div>
              <FieldLabel htmlFor="welcome-role">Role you want</FieldLabel>
              <TextInput
                id="welcome-role"
                required
                autoComplete="organization-title"
                enterKeyHint="next"
                placeholder="Software Engineer"
                className="text-base"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-navy-950">Skills</legend>
              <p className="mt-1 text-xs text-slate-500">Pick a few, type one, or upload a resume.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_SKILLS.map((skill) => {
                  const selected = skills.some((item) => item.toLowerCase() === skill.toLowerCase())
                  return (
                    <button
                      key={skill}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSkills((current) =>
                          selected
                            ? current.filter((item) => item.toLowerCase() !== skill.toLowerCase())
                            : dedupeSkills([...current, skill]),
                        )
                      }
                      className={pillClass(selected)}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
              {skills.some((skill) => !QUICK_SKILLS.some((item) => item.toLowerCase() === skill.toLowerCase())) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills
                    .filter((skill) => !QUICK_SKILLS.some((item) => item.toLowerCase() === skill.toLowerCase()))
                    .map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        aria-label={`Remove ${skill}`}
                        onClick={() => setSkills((current) => current.filter((item) => item !== skill))}
                        className={pillClass(true)}
                      >
                        {skill} ×
                      </button>
                    ))}
                </div>
              ) : null}
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
                <TextInput
                  id="welcome-skill"
                  value={skillDraft}
                  enterKeyHint="done"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Add a skill"
                  className="text-base"
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addSkill(skillDraft)
                    }
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" fullWidth onClick={() => addSkill(skillDraft)} disabled={!skillDraft.trim()}>
                    Add
                  </Button>
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
