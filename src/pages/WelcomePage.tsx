import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, Chip, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { CANDIDATE_LEVELS, INTERVIEW_TYPES, SKILLS, TARGET_ROLES } from '../data/catalogs.ts'
import { dedupeSkills } from '../matching/skills.ts'
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

const SUGGESTED_SKILLS = SKILLS.slice(0, 16)

export function WelcomePage() {
  const navigate = useNavigate()
  const { setPreferences } = useMatching()
  const [loading, setLoading] = useState(true)
  const [alreadySet, setAlreadySet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [level, setLevel] = useState('')
  const [interviewType, setInterviewType] = useState('')
  const [company, setCompany] = useState('')
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
        if (roleValue || saved.length > 0) {
          setAlreadySet(true)
          return
        }
        setRole(roleValue)
        setLevel(account.candidate.candidate_level ?? '')
        setCompany(account.candidate.target_company ?? '')
        setInterviewType(preferences?.interview_type ?? '')
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
    setSkills(next)
    setSkillDraft('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const nextSkills = dedupeSkills(skills)
    if (!role) {
      setError('Choose the role you are preparing for.')
      return
    }
    if (nextSkills.length === 0) {
      setError('Add at least one skill so we can match interviewers.')
      return
    }
    setSaving(true)
    try {
      await updateCandidateProfile({
        targetRole: role,
        candidateLevel: level || null,
        targetCompany: company.trim() || null,
      })
      await updateCandidateSkills(nextSkills)
      await updateCandidatePreferences({
        interviewType: interviewType || null,
        skills: nextSkills,
      })
      setPreferences({
        targetRole: role,
        candidateLevel: level,
        interviewType,
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
      navigate('/candidate/matches')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  if (alreadySet) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="What are you here to practice?"
        subtitle="Tell us the role, level, and skills you want to be interviewed on. We’ll use this to find interviewers and shape your practice."
      />
      <Card className="mt-8 p-6 sm:p-8">
        {loading ? (
          <p className="text-sm text-slate-600">Loading your profile…</p>
        ) : (
          <form className="space-y-5" onSubmit={(event) => void save(event)}>
            <div>
              <FieldLabel htmlFor="welcome-role">Role you are preparing for</FieldLabel>
              <SelectInput id="welcome-role" required value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">Select a role</option>
                {TARGET_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="welcome-level">Your level</FieldLabel>
                <SelectInput id="welcome-level" value={level} onChange={(event) => setLevel(event.target.value)}>
                  <option value="">Select a level</option>
                  {CANDIDATE_LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="welcome-type">Interview you want</FieldLabel>
                <SelectInput
                  id="welcome-type"
                  value={interviewType}
                  onChange={(event) => setInterviewType(event.target.value)}
                >
                  <option value="">Any round</option>
                  {INTERVIEW_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="welcome-company">Company you are targeting (optional)</FieldLabel>
              <TextInput
                id="welcome-company"
                value={company}
                placeholder="Google, a startup, your current company…"
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="welcome-skill">Skills you want to be interviewed on</FieldLabel>
              <div className="flex gap-2">
                <TextInput
                  id="welcome-skill"
                  value={skillDraft}
                  placeholder="Add a skill, then press Add"
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
                {SUGGESTED_SKILLS.map((skill) => (
                  <Chip
                    key={skill}
                    active={skills.some((item) => item.toLowerCase() === skill.toLowerCase())}
                    onClick={() => {
                      const exists = skills.some((item) => item.toLowerCase() === skill.toLowerCase())
                      setSkills(exists ? skills.filter((item) => item.toLowerCase() !== skill.toLowerCase()) : dedupeSkills([...skills, skill]))
                    }}
                  >
                    {skill}
                  </Chip>
                ))}
              </div>
              {skills.length > 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  Selected: {skills.join(', ')}
                </p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Find interviewers for this'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem(INTENT_READY_KEY, '1')
                  navigate('/')
                }}
                disabled={saving}
              >
                Skip for now
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
