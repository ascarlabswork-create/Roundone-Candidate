import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CANDIDATE_LEVELS,
  INTERVIEW_TYPES,
  LANGUAGES,
  SKILLS,
  TARGET_ROLES,
  TIME_WINDOWS,
} from '../data/catalogs.ts'
import { Button } from '../components/ui/Button.tsx'
import { Chip, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { emptyPreferences, useMatching } from '../state/matching.tsx'
import type { TimeWindow } from '../data/catalogs.ts'
import type { MatchingPreferences } from '../types.ts'

export function FindPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { preferences, setPreferences } = useMatching()

  const initial = useMemo<MatchingPreferences>(
    () => ({
      ...emptyPreferences,
      ...preferences,
      targetRole: params.get('role') || preferences?.targetRole || '',
      interviewType: params.get('type') || preferences?.interviewType || '',
      candidateLevel: params.get('level') || preferences?.candidateLevel || '',
      targetCompany: params.get('company') || preferences?.targetCompany || '',
    }),
    [params, preferences],
  )

  const [form, setForm] = useState<MatchingPreferences>(initial)
  const [skillDraft, setSkillDraft] = useState('')

  function addSkill(skill: string) {
    const value = skill.trim()
    if (!value || form.skills.includes(value)) return
    setForm({ ...form, skills: [...form.skills, value] })
    setSkillDraft('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setPreferences(form)
    navigate('/candidate/matches')
  }

  const canSubmit = Boolean(form.targetRole && form.interviewType && form.candidateLevel)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Tell us about your interview"
        subtitle="We’ll rank interviewers against this goal. You can still browse everyone afterwards."
      />

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="targetRole">Target Role</FieldLabel>
            <SelectInput
              id="targetRole"
              required
              value={form.targetRole}
              onChange={(event) => setForm({ ...form, targetRole: event.target.value })}
            >
              <option value="">e.g. Software Engineer</option>
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="level">Candidate Level</FieldLabel>
            <SelectInput
              id="level"
              required
              value={form.candidateLevel}
              onChange={(event) => setForm({ ...form, candidateLevel: event.target.value })}
            >
              <option value="">e.g. SDE 2</option>
              {CANDIDATE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="type">Interview Type</FieldLabel>
            <SelectInput
              id="type"
              required
              value={form.interviewType}
              onChange={(event) => setForm({ ...form, interviewType: event.target.value })}
            >
              <option value="">e.g. System Design</option>
              {INTERVIEW_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="company">Target Company</FieldLabel>
            <TextInput
              id="company"
              placeholder="Google"
              value={form.targetCompany}
              onChange={(event) => setForm({ ...form, targetCompany: event.target.value })}
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="skills">Skills / Technologies</FieldLabel>
          <div className="flex gap-2">
            <TextInput
              id="skills"
              list="skill-options"
              placeholder="Java, AWS, Microservices"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSkill(skillDraft)
                }
              }}
            />
            <Button variant="outline" onClick={() => addSkill(skillDraft)}>
              Add
            </Button>
          </div>
          <datalist id="skill-options">
            {SKILLS.map((skill) => (
              <option key={skill} value={skill} />
            ))}
          </datalist>
          <div className="mt-3 flex flex-wrap gap-2">
            {form.skills.map((skill) => (
              <Chip
                key={skill}
                active
                onClick={() => setForm({ ...form, skills: form.skills.filter((item) => item !== skill) })}
              >
                {skill} ×
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="date">Preferred Date</FieldLabel>
            <TextInput
              id="date"
              type="date"
              value={form.preferredDate}
              onChange={(event) => setForm({ ...form, preferredDate: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="time">Preferred Time</FieldLabel>
            <SelectInput
              id="time"
              value={form.preferredTime}
              onChange={(event) =>
                setForm({ ...form, preferredTime: event.target.value as TimeWindow | '' })
              }
            >
              <option value="">Any time</option>
              {TIME_WINDOWS.map((window) => (
                <option key={window.id} value={window.id}>
                  {window.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="budget">Budget (₹)</FieldLabel>
            <TextInput
              id="budget"
              type="number"
              min={0}
              placeholder="2000"
              value={form.budget || ''}
              onChange={(event) => setForm({ ...form, budget: Number(event.target.value) || 0 })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="language">Language</FieldLabel>
            <SelectInput
              id="language"
              value={form.language}
              onChange={(event) => setForm({ ...form, language: event.target.value })}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => navigate('/candidate/interviewers')}>
            Browse instead
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            Find My Matches
          </Button>
        </div>
      </form>
    </div>
  )
}
