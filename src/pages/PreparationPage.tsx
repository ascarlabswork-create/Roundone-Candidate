import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import {
  Badge,
  Card,
  Chip,
  EmptyState,
  FieldLabel,
  PageHeader,
  SelectInput,
  TextArea,
  TextInput,
} from '../components/ui/primitives.tsx'
import { INTERVIEW_TYPES, SKILLS, TARGET_ROLES } from '../data/catalogs.ts'
import { requestPreparationAssist } from '../preparation/aiAssist.ts'
import {
  canGeneratePreparation,
  preparationInputHash,
  practiceHrefFromPreparation,
  type PreparationInput,
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

function priorityTone(priority: string): 'blue' | 'violet' | 'slate' {
  if (priority === 'high') return 'violet'
  if (priority === 'medium') return 'blue'
  return 'slate'
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
  const [prefilled, setPrefilled] = useState(Boolean(saved))
  const submittingRef = useRef(false)

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

  function addSkill(value: string) {
    const skill = value.trim()
    if (!skill || input.skills.includes(skill) || input.skills.length >= 12) return
    setInput({ ...input, skills: [...input.skills, skill] })
    setSkillDraft('')
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault()
    if (busy || submittingRef.current || !canGeneratePreparation(input)) return
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
  }

  const canGenerate = canGeneratePreparation(input)
  const stale = Boolean(result && resultHash && resultHash !== preparationInputHash(input))

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="AI Interview Preparation"
        subtitle="Personalized preparation based on your profile and optional background text. Suggestions only — nothing changes your profile unless you edit it yourself."
      />

      <form className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8" onSubmit={(event) => void generate(event)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="prep-role">Target role</FieldLabel>
            <TextInput
              id="prep-role"
              list="prep-role-options"
              value={input.targetRole}
              onChange={(event) => setInput({ ...input, targetRole: event.target.value })}
              placeholder="Backend Engineer"
            />
            <datalist id="prep-role-options">
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabel htmlFor="prep-level">Experience level</FieldLabel>
            <TextInput
              id="prep-level"
              value={input.experienceLevel}
              onChange={(event) => setInput({ ...input, experienceLevel: event.target.value })}
              placeholder="SDE 2"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="prep-type">Interview type</FieldLabel>
            <SelectInput
              id="prep-type"
              value={input.interviewType}
              onChange={(event) => setInput({ ...input, interviewType: event.target.value })}
            >
              <option value="">Select a type (optional)</option>
              {INTERVIEW_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="prep-skills">Skills</FieldLabel>
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
            <Button variant="outline" onClick={() => addSkill(skillDraft)}>
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
              <p className="text-sm text-slate-500">Optional if you paste background text.</p>
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

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {stale ? <p className="text-sm text-slate-600">Your inputs changed. Generate again to refresh suggestions.</p> : null}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          {result ? (
            <Button variant="outline" onClick={clearAll}>
              Clear suggestions
            </Button>
          ) : null}
          <Button type="submit" disabled={!canGenerate || busy}>
            {busy ? 'Generating…' : result ? 'Regenerate Preparation' : 'Generate Preparation'}
          </Button>
        </div>
      </form>

      {!result ? (
        <div className="mt-8">
          <EmptyState
            title="No preparation suggestions yet"
            body="Use your profile fields alone, or add background text, then generate. AI will not invent experience you did not provide."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <Card className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Based on your profile</p>
            <h2 className="mt-1 font-semibold text-navy-950">Preparation summary</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{result.profileSummary}</p>
            {input.targetRole ? (
              <p className="mt-3 text-sm text-slate-600">
                Target role: <span className="font-medium text-navy-950">{input.targetRole}</span>
              </p>
            ) : null}
          </Card>

          <Card className="p-5 sm:p-6">
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

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-navy-950">Preparation focus</h2>
            {result.interviewFocusAreas.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No focus areas returned.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.interviewFocusAreas.map((item) => (
                  <li key={item}>
                    <Badge tone="blue">{item}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-navy-950">Practice recommendations</h2>
            <p className="mt-1 text-sm text-slate-600">Opens the existing AI Practice setup. It does not start a session automatically.</p>
            {result.practiceRecommendations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No practice recommendations returned.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.practiceRecommendations.map((item) => (
                  <li key={item.topic} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="mt-4">
              <Link to={practiceHrefFromPreparation(input, result)}>
                <Button>Practice These Topics</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
