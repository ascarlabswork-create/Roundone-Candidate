import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  COMPANIES,
  SKILLS,
  TIME_WINDOWS,
} from '../data/catalogs.ts'
import { NormalizationSuggestions } from '../components/matching/NormalizationSuggestions.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Chip, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { toNormalizationInput, type NormalizationPatch } from '../matching/normalizeModel.ts'
import { usePreferenceNormalization } from '../matching/usePreferenceNormalization.ts'
import { requestResumeSkillPlan } from '../resume/aiAssist.ts'
import { canAnalyzeResume, type ResumeSkillPlan } from '../resume/aiModel.ts'
import { extractResumeText, RESUME_ACCEPT } from '../resume/resumeText.ts'
import { emptyPreferences, useMatching } from '../state/matching.tsx'
import type { TimeWindow } from '../data/catalogs.ts'
import type { MatchingPreferences } from '../types.ts'

function mergeUniqueSkills(existing: string[], incoming: string[]) {
  const next = [...existing]
  for (const skill of incoming) {
    const value = skill.trim()
    if (value.length < 2) continue
    if (next.some((item) => item.toLowerCase() === value.toLowerCase())) continue
    next.push(value)
  }
  return next
}

/** Collect every skill/technology grounded in the resume skill plan. */
function skillsFromResumePlan(plan: ResumeSkillPlan, existing: string[]) {
  const incoming: string[] = []
  for (const item of plan.extractedSkills) incoming.push(item.skill)
  for (const item of plan.inferredSkills) incoming.push(item.skill)
  for (const project of plan.projects) incoming.push(...project.technologies)
  for (const experience of plan.experiences) incoming.push(...experience.technologies)
  return mergeUniqueSkills(existing, incoming)
}

/** Fallback when AI is unavailable: match all catalog skills found in the resume text. */
function skillsFromResumeText(text: string, existing: string[]) {
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `
  const found: string[] = []
  for (const skill of SKILLS) {
    const needle = skill.toLowerCase()
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const boundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`)
    if (!boundary.test(haystack)) continue
    found.push(skill)
  }
  return mergeUniqueSkills(existing, found)
}

export function FindPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { preferences, setPreferences } = useMatching()
  const { status: suggestionStatus, suggestions, suggest, clear } = usePreferenceNormalization()
  const intentTimer = useRef<number>(0)
  const autoSuggested = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const [resumeFileName, setResumeFileName] = useState<string | null>(null)
  const [resumeExtracting, setResumeExtracting] = useState(false)
  const [resumeStatus, setResumeStatus] = useState<string | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [optionalOpen, setOptionalOpen] = useState(() =>
    Boolean(initial.targetCompany || initial.naturalLanguageQuery?.trim()),
  )

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
      targetCompany: patch.targetCompany ?? prev.targetCompany,
      skills: patch.skills ?? prev.skills,
    }))
    if (patch.targetCompany) {
      setOptionalOpen(true)
    }
    setSkillDraft('')
    clear()
  }

  async function onResumeSelected(file: File | null) {
    setResumeError(null)
    setResumeStatus(null)
    if (!file) return

    setResumeExtracting(true)
    setResumeFileName(file.name)
    try {
      setResumeStatus('Reading resume…')
      const text = await extractResumeText(file)
      if (!canAnalyzeResume(text)) {
        throw new Error(
          'That resume did not contain enough readable text. Please try another PDF, or paste a longer resume.',
        )
      }

      setResumeStatus('Extracting skills from resume…')
      const outcome = await requestResumeSkillPlan(text)
      setForm((prev) => {
        const usedAi = outcome.ok
        const skills = usedAi
          ? skillsFromResumePlan(outcome.plan, prev.skills)
          : skillsFromResumeText(text, prev.skills)
        const added = Math.max(0, skills.length - prev.skills.length)
        // Defer status so we never set state synchronously inside another updater.
        queueMicrotask(() => {
          setResumeStatus(
            usedAi
              ? added > 0
                ? `Added ${added} skill${added === 1 ? '' : 's'} from your resume`
                : 'Resume attached · no new skills found beyond what you already added'
              : added > 0
                ? `Added ${added} catalog skill${added === 1 ? '' : 's'} (full AI extract unavailable)`
                : 'Resume attached · skill extract unavailable — add skills manually',
          )
        })
        return { ...prev, skills }
      })
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not read that resume file.')
      setResumeStatus(null)
    } finally {
      setResumeExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function clearResume() {
    setResumeFileName(null)
    setResumeError(null)
    setResumeStatus(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  function submit(event: FormEvent) {
    event.preventDefault()
    setPreferences({
      ...form,
      targetRole: '',
      interviewType: '',
      candidateLevel: '',
      budget: 0,
      language: '',
    })
    navigate('/candidate/matches')
  }

  const canSubmit =
    form.skills.length > 0 ||
    Boolean(form.targetCompany) ||
    Boolean(form.naturalLanguageQuery && form.naturalLanguageQuery.trim().length >= 12) ||
    Boolean(resumeFileName)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Tell us about your interview"
        subtitle="We’ll rank interviewers against this goal. You can still browse everyone afterwards."
        actions={
          <Link to="/candidate/job-match" className="text-sm font-medium text-blue-700">
            Match interviewers to a job posting
          </Link>
        }
      />

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
        <div>
          <FieldLabel htmlFor="resume-file">Resume</FieldLabel>
          <input
            ref={fileInputRef}
            id="resume-file"
            type="file"
            accept={RESUME_ACCEPT}
            className="hidden"
            onChange={(event) => void onResumeSelected(event.target.files?.[0] ?? null)}
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={resumeExtracting}
              >
                {resumeExtracting ? 'Extracting…' : resumeFileName ? 'Replace file' : 'Upload resume'}
              </Button>
              {resumeFileName ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-navy-950">
                    <span className="truncate font-medium" title={resumeFileName}>
                      {resumeFileName}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-slate-500 hover:text-navy-900"
                      onClick={clearResume}
                      aria-label="Remove resume"
                    >
                      ×
                    </button>
                  </span>
                  {resumeStatus ? <span className="text-xs text-slate-500">{resumeStatus}</span> : null}
                </div>
              ) : (
                <span className="text-sm text-slate-500">
                  PDF or plain text, up to 8 MB. We extract all skills found in the resume.
                </span>
              )}
            </div>
            {resumeError ? <p className="mt-2 text-sm text-red-700">{resumeError}</p> : null}
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
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="date-from">Preferred Date</FieldLabel>
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
                  Preferred date end
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
            <p className="mt-1 text-xs text-slate-500">
              Pick a range (for example 24–27). Leave empty for any day.
            </p>
          </div>
          <div className="sm:col-span-2 sm:max-w-xs">
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
            <span className="text-sm font-medium text-blue-700">{optionalOpen ? 'Hide' : 'Show'}</span>
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
