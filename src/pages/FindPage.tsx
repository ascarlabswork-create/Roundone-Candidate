import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CANDIDATE_LEVELS,
  COMPANIES,
  INTERVIEW_TYPES,
  SKILLS,
  TARGET_ROLES,
  TIME_WINDOWS,
} from '../data/catalogs.ts'
import { NormalizationSuggestions } from '../components/matching/NormalizationSuggestions.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Chip, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { toNormalizationInput, type NormalizationPatch } from '../matching/normalizeModel.ts'
import { usePreferenceNormalization } from '../matching/usePreferenceNormalization.ts'
import { emptyPreferences, useMatching } from '../state/matching.tsx'
import type { TimeWindow } from '../data/catalogs.ts'
import type { MatchingPreferences } from '../types.ts'

export function FindPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { preferences, setPreferences } = useMatching()
  const { status: suggestionStatus, suggestions, suggest, clear } = usePreferenceNormalization()
  const intentTimer = useRef<number>(0)
  const autoSuggested = useRef(false)

  const initial = useMemo<MatchingPreferences>(
    () => ({
      ...emptyPreferences,
      ...preferences,
      targetRole: params.get('role') || preferences?.targetRole || '',
      interviewType: params.get('type') || preferences?.interviewType || '',
      candidateLevel: params.get('level') || preferences?.candidateLevel || '',
      targetCompany: params.get('company') || preferences?.targetCompany || '',
      budget: 0,
      language: '',
      naturalLanguageQuery: params.get('q') || preferences?.naturalLanguageQuery || '',
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

  function normalizationInput(next: MatchingPreferences = form) {
    return toNormalizationInput({
      targetRole: next.targetRole,
      candidateLevel: next.candidateLevel,
      skills: next.skills,
      interviewType: next.interviewType,
      targetCompany: next.targetCompany,
      intent: next.naturalLanguageQuery ?? '',
      skillDraft,
    })
  }

  function requestSuggestions(next: MatchingPreferences = form) {
    void suggest(normalizationInput(next))
  }

  function applySuggestions(patch: NormalizationPatch) {
    setForm((prev) => ({
      ...prev,
      targetRole: patch.targetRole ?? prev.targetRole,
      candidateLevel: patch.candidateLevel ?? prev.candidateLevel,
      interviewType: patch.interviewType ?? prev.interviewType,
      targetCompany: patch.targetCompany ?? prev.targetCompany,
      skills: patch.skills ?? prev.skills,
    }))
    setSkillDraft('')
    clear()
  }

  useEffect(() => {
    const intent = initial.naturalLanguageQuery?.trim() ?? ''
    if (autoSuggested.current || intent.length < 12) return
    if (initial.targetRole && initial.interviewType) return
    autoSuggested.current = true
    requestSuggestions(initial)
  }, [initial])

  useEffect(() => {
    return () => window.clearTimeout(intentTimer.current)
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    setPreferences({
      ...form,
      budget: 0,
      language: '',
    })
    navigate('/candidate/matches')
  }

  const canSubmit =
    Boolean(form.targetRole && form.interviewType && form.candidateLevel) ||
    Boolean(form.naturalLanguageQuery && form.naturalLanguageQuery.trim().length >= 12)
  const structuredRequired = !(form.naturalLanguageQuery && form.naturalLanguageQuery.trim().length >= 12)

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
            <TextInput
              id="targetRole"
              required={structuredRequired}
              list="find-role-options"
              placeholder="Select or type a role"
              value={form.targetRole}
              onChange={(event) => setForm({ ...form, targetRole: event.target.value })}
            />
            <datalist id="find-role-options">
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabel htmlFor="level">Candidate Level</FieldLabel>
            <TextInput
              id="level"
              required={structuredRequired}
              list="find-level-options"
              placeholder="Select or type a level"
              value={form.candidateLevel}
              onChange={(event) => setForm({ ...form, candidateLevel: event.target.value })}
            />
            <datalist id="find-level-options">
              {CANDIDATE_LEVELS.map((level) => (
                <option key={level} value={level} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabel htmlFor="type">Interview Type</FieldLabel>
            <TextInput
              id="type"
              required={structuredRequired}
              list="find-type-options"
              placeholder="Select or type a type"
              value={form.interviewType}
              onChange={(event) => setForm({ ...form, interviewType: event.target.value })}
            />
            <datalist id="find-type-options">
              {INTERVIEW_TYPES.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabel htmlFor="company">Target Company</FieldLabel>
            <TextInput
              id="company"
              list="find-company-options"
              placeholder="Select or type a company"
              value={form.targetCompany}
              onChange={(event) => setForm({ ...form, targetCompany: event.target.value })}
            />
            <datalist id="find-company-options">
              {COMPANIES.map((company) => (
                <option key={company} value={company} />
              ))}
            </datalist>
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

        <div>
          <FieldLabel htmlFor="intent">Describe what you want (optional)</FieldLabel>
          <TextInput
            id="intent"
            placeholder="I want a backend interview for Python and FastAPI, preferably someone who has worked with startups."
            value={form.naturalLanguageQuery ?? ''}
            onChange={(event) => setForm({ ...form, naturalLanguageQuery: event.target.value })}
            onBlur={() => {
              window.clearTimeout(intentTimer.current)
              const intent = form.naturalLanguageQuery?.trim() ?? ''
              if (intent.length < 12) return
              intentTimer.current = window.setTimeout(() => requestSuggestions(), 700)
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            We’ll turn this into structured matching signals. Ranking still uses verified interviewer data.
          </p>
        </div>

        <div className="space-y-3">
          <Button variant="outline" onClick={() => requestSuggestions()} disabled={suggestionStatus === 'loading'}>
            {suggestionStatus === 'loading' ? 'Suggesting…' : 'Suggest matches'}
          </Button>
          <NormalizationSuggestions
            status={suggestionStatus}
            suggestions={suggestions}
            currentSkills={form.skills}
            onApply={applySuggestions}
          />
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
