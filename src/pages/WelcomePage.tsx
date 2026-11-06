import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, TextInput } from '../components/ui/primitives.tsx'
import { CANDIDATE_LEVELS, INTERVIEW_TYPES } from '../data/catalogs.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { localResumeSkillPlan } from '../resume/localSkillPlan.ts'
import { extractResumeText } from '../resume/resumeText.ts'
import {
  getCandidatePreferencesIfPresent,
  getCandidateProfile,
  getCandidateSkills,
  updateCandidatePreferences,
  updateCandidateProfile,
  updateCandidateSkills,
} from '../services/candidateProfile.ts'
import { useMatching } from '../state/matching.tsx'

const INTENT_READY_KEY = 'roundone.intentReady'
const QUICK_SKILLS = ['Python', 'Java', 'SQL', 'React', 'Machine Learning', 'System Design', 'AWS', 'DSA'] as const

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

function pillClass(selected: boolean) {
  return selected
    ? 'rounded-full bg-navy-950 px-3 py-1.5 text-sm text-white'
    : 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-navy-700'
}

export function WelcomePage() {
  const navigate = useNavigate()
  const { setPreferences } = useMatching()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [alreadySet, setAlreadySet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readingResume, setReadingResume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [level, setLevel] = useState('')
  const [interviewTypes, setInterviewTypes] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [skillDraft, setSkillDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [account, savedSkills, preferences] = await Promise.all([
          getCandidateProfile(),
          getCandidateSkills(),
          getCandidatePreferencesIfPresent(),
        ])
        if (cancelled) return
        const roleValue = account.candidate.target_role?.trim() ?? ''
        const saved = dedupeSkills(savedSkills)
        if (roleValue && saved.length > 0) {
          sessionStorage.setItem(INTENT_READY_KEY, '1')
          setAlreadySet(true)
          return
        }
        setRole(roleValue)
        setCompany(account.candidate.target_company ?? '')
        setLevel(account.candidate.candidate_level ?? '')
        setInterviewTypes(
          (preferences?.interview_type ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        )
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
      setError('Add a recognisable skill, such as Python, SQL, or System Design.')
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
      const plan = localResumeSkillPlan(text)
      const found = plan?.extractedSkills.map((item) => item.skill) ?? []
      if (found.length === 0) {
        setError('No skills stood out in that resume. Type a few below.')
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
      setError('Add the role you are preparing for.')
      return
    }
    if (interviewTypes.length === 0) {
      setError('Choose at least one kind of interview you want to practice.')
      return
    }
    if (nextSkills.length === 0) {
      setError('Add at least one skill from your resume.')
      return
    }
    setSaving(true)
    try {
      const focus = interviewTypes.join(', ')
      await updateCandidateProfile({
        targetRole: nextRole,
        candidateLevel: level || null,
        targetCompany: company.trim() || null,
        headline: `${nextRole} · ${focus}`,
      })
      await updateCandidateSkills(nextSkills)
      await updateCandidatePreferences({
        interviewType: focus,
        skills: nextSkills,
      })
      setPreferences({
        targetRole: nextRole,
        candidateLevel: level,
        interviewType: interviewTypes[0] ?? '',
        targetCompany: company.trim(),
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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Before your dashboard</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">What are you preparing for?</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Interviewers are matched to you from this. Tell us the role you want, the interviews you came to practice, and
        a few skills from your resume. You can change it later from your profile.
      </p>

      <Card className="mt-8 p-6 sm:p-8">
        {loading ? (
          <p className="text-sm text-slate-600">Loading your profile…</p>
        ) : (
          <form className="grid gap-8" onSubmit={(event) => void save(event)}>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="col-span-full text-sm font-semibold text-navy-950">Your background</legend>
              <div>
                <FieldLabel htmlFor="welcome-role">Role you want</FieldLabel>
                <TextInput
                  id="welcome-role"
                  required
                  autoComplete="organization-title"
                  placeholder="Software Engineer"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="welcome-company">Company you are targeting</FieldLabel>
                <TextInput
                  id="welcome-company"
                  autoComplete="organization"
                  placeholder="Optional"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Your level</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CANDIDATE_LEVELS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={level === item}
                      onClick={() => setLevel((current) => (current === item ? '' : item))}
                      className={pillClass(level === item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-navy-950">Interviews you came to practice</legend>
              <p className="mt-1 text-xs text-slate-500">Pick every format you want to be interviewed on.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INTERVIEW_TYPES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={interviewTypes.includes(item)}
                    onClick={() => setInterviewTypes((current) => toggle(current, item))}
                    className={pillClass(interviewTypes.includes(item))}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-navy-950">Skills from your resume</legend>
              <p className="mt-1 text-xs text-slate-500">
                Upload a resume to pull skills out, or add the ones you want to be interviewed on.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void readResume(file)
                  }}
                />
                <Button type="button" variant="outline" disabled={readingResume} onClick={() => fileRef.current?.click()}>
                  {readingResume ? 'Reading resume…' : 'Upload resume'}
                </Button>
                <TextInput
                  id="welcome-skill"
                  value={skillDraft}
                  placeholder="Add a skill, e.g. Python"
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addSkill(skillDraft)
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => addSkill(skillDraft)} disabled={!skillDraft.trim()}>
                  Add
                </Button>
              </div>
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
                        onClick={() => setSkills((current) => current.filter((item) => item !== skill))}
                        className={pillClass(true)}
                      >
                        {skill} ×
                      </button>
                    ))}
                </div>
              ) : null}
            </fieldset>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || readingResume}>
                {saving ? 'Saving…' : 'Save and open home'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
