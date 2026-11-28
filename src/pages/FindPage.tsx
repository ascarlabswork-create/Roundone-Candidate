import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  COMPANIES,
  TIME_WINDOWS,
} from '../data/catalogs.ts'
import { NormalizationSuggestions } from '../components/matching/NormalizationSuggestions.tsx'
import { Button } from '../components/ui/Button.tsx'
import { SkillMultiInput } from '../components/ui/SkillMultiInput.tsx'
import { Chip, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { preferredDateRangeError } from '../lib/dates.ts'
import { isCanonicalSkillDuplicate, uniqueCandidateSkillWording } from '../matching/skills.ts'
import { toNormalizationInput, type NormalizationPatch } from '../matching/normalizeModel.ts'
import {
  getCandidateSkills,
  updateCandidatePreferences,
  updateCandidateSkills,
} from '../services/candidateProfile.ts'
import { usePreferenceNormalization } from '../matching/usePreferenceNormalization.ts'
import { emptyPreferences, useMatching } from '../state/matching.tsx'
import type { TimeWindow } from '../data/catalogs.ts'
import type { MatchingPreferences } from '../types.ts'

function mergeUniqueSkills(existing: string[], incoming: string[]) {
  const next = [...existing]
  for (const skill of incoming) {
    const value = skill.trim()
    if (value.length < 2) continue
    if (isCanonicalSkillDuplicate(next, value)) continue
    next.push(value)
  }
  return uniqueCandidateSkillWording(next)
}

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
      targetRole: '',
      interviewType: '',
      candidateLevel: '',
      targetCompany: params.get('company') || preferences?.targetCompany || '',
      budget: 0,
      language: '',
      naturalLanguageQuery: params.get('q') || preferences?.naturalLanguageQuery || '',
    }),
    [params, preferences],
  )

  const [form, setForm] = useState<MatchingPreferences>(initial)
  const [skillDraft, setSkillDraft] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [optionalOpen, setOptionalOpen] = useState(() =>
    Boolean(initial.targetCompany || initial.naturalLanguageQuery?.trim()),
  )

  function addSkills(values: string[]) {
    if (values.length === 0) return
    setForm({ ...form, skills: mergeUniqueSkills(form.skills, values) })
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
      targetCompany: patch.targetCompany ?? prev.targetCompany,
      skills: patch.skills ?? prev.skills,
    }))
    if (patch.targetCompany) {
      setOptionalOpen(true)
    }
    setSkillDraft('')
    clear()
  }

  useEffect(() => {
    const intent = initial.naturalLanguageQuery?.trim() ?? ''
    if (autoSuggested.current || intent.length < 12) return
    autoSuggested.current = true
    requestSuggestions(initial)
  }, [initial])

  useEffect(() => {
    return () => window.clearTimeout(intentTimer.current)
  }, [])

  async function persistFindPreferences() {
    const skills = uniqueCandidateSkillWording(form.skills)
    const next = {
      ...form,
      skills,
      targetRole: '',
      interviewType: '',
      candidateLevel: '',
      budget: 0,
      language: '',
    }
    try {
      await Promise.all([
        updateCandidatePreferences({
          skills,
          preferredDate: form.preferredDate || null,
          preferredDateEnd: form.preferredDateEnd || null,
          preferredTimeWindow: form.preferredTime || null,
        }),
        // Merge Find skills into the profile — never replace the full skill list with this search only.
        skills.length > 0
          ? getCandidateSkills()
              .then((existing) => updateCandidateSkills(mergeUniqueSkills(existing, skills)))
              .catch(() => updateCandidateSkills(skills))
          : Promise.resolve([]),
      ])
    } catch {
      // Matching still uses the in-session skills if the preference row cannot be saved.
    }
    setPreferences(next)
    return next
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const rangeError = preferredDateRangeError(form.preferredDate, form.preferredDateEnd)
    if (rangeError) {
      setDateError(rangeError)
      return
    }
    setDateError(null)
    await persistFindPreferences()
    navigate('/candidate/matches')
  }

  const canSubmit =
    form.skills.length > 0 ||
    Boolean(form.targetCompany) ||
    Boolean(form.naturalLanguageQuery && form.naturalLanguageQuery.trim().length >= 12)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Match"
        title="Tell us about your interview"
        subtitle="Interviewers are ranked by how closely their skills match the ones you add below."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/candidate/ats-check"
              className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-medium text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              ATS resume check
            </Link>
            <Link
              to="/candidate/job-match"
              className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-black/10 bg-white px-4 text-sm font-medium text-navy-950 transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2"
            >
              Match interviewers to a job posting
            </Link>
          </div>
        }
      />

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-navy-950/8 bg-white/90 p-5 shadow-[0_18px_40px_-28px_rgba(12,18,32,0.45)] sm:p-8">
        <div>
          <FieldLabel htmlFor="skills">Skills / Technologies</FieldLabel>
          <SkillMultiInput
            id="skills"
            value={skillDraft}
            onChange={setSkillDraft}
            selected={form.skills}
            onAdd={addSkills}
            placeholder="Java, AWS, Microservices"
            hint=""
          />
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

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-navy-950">
              Preferred mock interview date and time{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Choose when you want to sit a live mock interview. You can leave both blank and browse any open slot.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="date-from">Date range</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <TextInput
                  id="date-from"
                  type="date"
                  value={form.preferredDate}
                  onChange={(event) => {
                    const nextStart = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      preferredDate: nextStart,
                      preferredDateEnd:
                        prev.preferredDateEnd && nextStart && prev.preferredDateEnd < nextStart
                          ? nextStart
                          : prev.preferredDateEnd,
                    }))
                  }}
                />
                <span className="hidden text-center text-sm text-slate-500 sm:block">to</span>
                <div>
                  <label htmlFor="date-to" className="sr-only">
                    Preferred mock interview date end
                  </label>
                  <TextInput
                    id="date-to"
                    type="date"
                    min={form.preferredDate || undefined}
                    value={form.preferredDateEnd || form.preferredDate}
                    onChange={(event) => {
                      const nextEnd = event.target.value
                      setForm((prev) => ({
                        ...prev,
                        preferredDateEnd: nextEnd,
                        preferredDate:
                          prev.preferredDate && nextEnd && nextEnd < prev.preferredDate
                            ? nextEnd
                            : prev.preferredDate || nextEnd,
                      }))
                    }}
                  />
                </div>
              </div>
              {dateError ? <p className="mt-1 text-sm text-red-700">{dateError}</p> : null}
            </div>
            <div className="sm:col-span-2 sm:max-w-xs">
              <FieldLabel htmlFor="time">Time of day</FieldLabel>
              <SelectInput
                id="time"
                value={form.preferredTime}
                onChange={(event) =>
                  setForm({ ...form, preferredTime: event.target.value as TimeWindow | '' })
                }
              >
                <option value="">Any time (optional)</option>
                {TIME_WINDOWS.map((window) => (
                  <option key={window.id} value={window.id}>
                    {window.label}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setOptionalOpen((open) => !open)}
            aria-expanded={optionalOpen}
          >
            <div>
              <p className="text-sm font-semibold text-navy-950">Optional details</p>
              <p className="text-xs text-slate-500">Describe what you want and target company</p>
            </div>
            <span className="text-sm font-medium text-coral-700">{optionalOpen ? 'Hide' : 'Show'}</span>
          </button>

          {optionalOpen ? (
            <div className="space-y-5 border-t border-slate-100 px-4 py-4">
              <div>
                <FieldLabel htmlFor="intent">Describe what you want</FieldLabel>
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

              {(suggestionStatus !== 'idle' || suggestions) && (
                <NormalizationSuggestions
                  status={suggestionStatus}
                  suggestions={suggestions}
                  currentSkills={form.skills}
                  onApply={applySuggestions}
                />
              )}

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
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={!canSubmit}>
            Find My Matches
          </Button>
        </div>
      </form>
    </div>
  )
}
