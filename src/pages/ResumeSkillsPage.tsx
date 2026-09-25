import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import {
  Badge,
  Card,
  EmptyState,
  FieldLabel,
  PageHeader,
  TextArea,
  TextInput,
  Toggle,
} from '../components/ui/primitives.tsx'
import { requestResumeSkillPlan } from '../resume/aiAssist.ts'
import {
  canAnalyzeResume,
  evidenceTypeLabel,
  RESUME_TEXT_MAX,
  RESUME_TEXT_MIN,
  type ResumeEvidenceType,
  type ResumeSkillCategory,
  type ResumeSkillPlan,
} from '../resume/aiModel.ts'
import { extractResumeText, RESUME_ACCEPT } from '../resume/resumeText.ts'
import {
  getResumeSkillProfile,
  saveResumeSkillProfile,
  type SaveResumeProject,
} from '../services/resumeSkills.ts'

type ReviewItem = {
  key: string
  skill: string
  category: ResumeSkillCategory
  evidenceType: ResumeEvidenceType | null
  evidenceDetail: string
  inferredFrom?: string
  derivedFrom?: string[]
  accepted: boolean
}

type ReviewProject = {
  key: string
  name: string
  description: string
  technologies: string[]
  accepted: boolean
}

const UNAVAILABLE =
  'Resume analysis is temporarily unavailable. Please try again in a moment.'
const INSUFFICIENT =
  'We could not find enough clearly-stated skills, projects, or experience in that resume. Add more detail or paste the full text, then analyze again.'

function keyFor(prefix: string, value: string, index: number) {
  return `${prefix}:${value.toLowerCase()}:${index}`
}

function planToItems(plan: ResumeSkillPlan): ReviewItem[] {
  const items: ReviewItem[] = []
  plan.extractedSkills.forEach((s, i) =>
    items.push({
      key: keyFor('extracted', s.skill, i),
      skill: s.skill,
      category: 'extracted',
      evidenceType: s.evidenceType,
      evidenceDetail: s.evidenceDetail,
      accepted: true,
    }),
  )
  plan.inferredSkills.forEach((s, i) =>
    items.push({
      key: keyFor('inferred', s.skill, i),
      skill: s.skill,
      category: 'inferred',
      evidenceType: s.evidenceType,
      evidenceDetail: s.evidenceDetail,
      inferredFrom: s.inferredFrom,
      accepted: true,
    }),
  )
  plan.interviewTopics.forEach((s, i) =>
    items.push({
      key: keyFor('topic', s.skill, i),
      skill: s.skill,
      category: 'topic',
      evidenceType: null,
      evidenceDetail: s.evidenceDetail,
      derivedFrom: s.derivedFrom,
      accepted: true,
    }),
  )
  return items
}

const CATEGORY_META: Record<
  ReviewSection,
  { title: string; description: string; tone: 'blue' | 'violet' | 'green' | 'slate' }
> = {
  extracted: {
    title: '1 · Directly extracted from your resume',
    description: 'Skills, languages, frameworks and tools written explicitly in your resume.',
    tone: 'blue',
  },
  inferred: {
    title: '2 · Inferred from your projects & experience',
    description:
      'Skills implied by an explicit project or experience description. Each shows the exact resume text it was inferred from.',
    tone: 'violet',
  },
  topic: {
    title: '3 · Interview topics derived from your skills',
    description: 'Focus areas built only from the skills above — no new technologies are introduced.',
    tone: 'green',
  },
  manual: {
    title: 'Added by you',
    description: 'Skills you added manually. These are saved as your own additions.',
    tone: 'slate',
  },
}

type ReviewSection = ResumeSkillCategory

const SECTION_ORDER: ReviewSection[] = ['extracted', 'inferred', 'topic', 'manual']

export function ResumeSkillsPage() {
  const [phase, setPhase] = useState<'input' | 'review'>('input')
  const [resumeText, setResumeText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [profileSummary, setProfileSummary] = useState('')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [projects, setProjects] = useState<ReviewProject[]>([])
  const [certifications, setCertifications] = useState<string[]>([])
  const [manualDraft, setManualDraft] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadedExisting, setLoadedExisting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const submittingRef = useRef(false)

  // Load any previously saved resume-derived skill set so the candidate can
  // review/edit it without re-uploading.
  useEffect(() => {
    let cancelled = false
    void getResumeSkillProfile()
      .then((profile) => {
        if (cancelled || profile.skills.length === 0) return
        setItems(
          profile.skills.map((row, i) => ({
            key: keyFor(`saved-${row.category}`, row.skill, i),
            skill: row.skill,
            category: row.category,
            evidenceType: (row.evidence_type as ResumeEvidenceType | null) ?? null,
            evidenceDetail: row.evidence_detail ?? '',
            accepted: row.accepted,
          })),
        )
        setProjects(
          profile.projects.map((row, i) => ({
            key: keyFor('saved-project', row.name, i),
            name: row.name,
            description: row.description ?? '',
            technologies: row.technologies ?? [],
            accepted: true,
          })),
        )
        setLoadedExisting(true)
        setPhase('review')
        setNotice('Loaded your saved resume-derived interview skills. Edit and save to update them.')
      })
      .catch(() => {
        /* first-time users have no saved profile yet */
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onFileSelected(file: File | null) {
    if (!file) return
    setError(null)
    setNotice(null)
    setExtracting(true)
    try {
      const text = await extractResumeText(file)
      setResumeText(text.slice(0, RESUME_TEXT_MAX))
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file. Please paste the text instead.')
    } finally {
      setExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function analyze() {
    if (analyzing || submittingRef.current || !canAnalyzeResume(resumeText)) return
    submittingRef.current = true
    setAnalyzing(true)
    setError(null)
    setNotice(null)
    setSaved(false)
    const outcome = await requestResumeSkillPlan(resumeText)
    submittingRef.current = false
    setAnalyzing(false)
    if (!outcome.ok) {
      setError(outcome.reason === 'insufficient_evidence' ? INSUFFICIENT : UNAVAILABLE)
      return
    }
    applyPlan(outcome.plan)
    setLoadedExisting(false)
    setPhase('review')
  }

  function applyPlan(plan: ResumeSkillPlan) {
    setProfileSummary(plan.profileSummary)
    setItems(planToItems(plan))
    setProjects(
      plan.projects.map((p, i) => ({
        key: keyFor('project', p.name, i),
        name: p.name,
        description: p.description,
        technologies: p.technologies,
        accepted: true,
      })),
    )
    setCertifications(plan.certifications)
  }

  function toggleItem(key: string, accepted: boolean) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, accepted } : item)))
    setSaved(false)
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key))
    setSaved(false)
  }

  function toggleProject(key: string, accepted: boolean) {
    setProjects((current) => current.map((p) => (p.key === key ? { ...p, accepted } : p)))
    setSaved(false)
  }

  function removeProject(key: string) {
    setProjects((current) => current.filter((p) => p.key !== key))
    setSaved(false)
  }

  function addManualSkill() {
    const skill = manualDraft.trim()
    if (!skill) return
    if (items.some((item) => item.skill.toLowerCase() === skill.toLowerCase())) {
      setManualDraft('')
      return
    }
    setItems((current) => [
      ...current,
      {
        key: keyFor('manual', skill, current.length),
        skill,
        category: 'manual',
        evidenceType: null,
        evidenceDetail: '',
        accepted: true,
      },
    ])
    setManualDraft('')
    setSaved(false)
  }

  const acceptedItems = useMemo(() => items.filter((item) => item.accepted), [items])
  const acceptedProjects = useMemo(() => projects.filter((p) => p.accepted), [projects])

  const grouped = useMemo(() => {
    const map: Record<ReviewSection, ReviewItem[]> = {
      extracted: [],
      inferred: [],
      topic: [],
      manual: [],
    }
    for (const item of items) map[item.category].push(item)
    return map
  }, [items])

  async function save() {
    if (saving || acceptedItems.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const skills = acceptedItems.map((item) => ({
        skill: item.skill,
        category: item.category,
        evidenceType: item.evidenceType,
        evidenceDetail: item.evidenceDetail || item.inferredFrom || null,
      }))
      const projectPayload: SaveResumeProject[] = acceptedProjects.map((p) => ({
        name: p.name,
        description: p.description,
        technologies: p.technologies,
      }))
      await saveResumeSkillProfile(skills, projectPayload)
      setSaved(true)
      setNotice('Saved. Your AI Interview will now use these resume-derived skills and projects.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your interview skill set.')
    } finally {
      setSaving(false)
    }
  }

  function startOver() {
    setPhase('input')
    setResumeText('')
    setFileName(null)
    setProfileSummary('')
    setItems([])
    setProjects([])
    setCertifications([])
    setError(null)
    setNotice(null)
    setSaved(false)
    setLoadedExisting(false)
  }

  const canAnalyze = canAnalyzeResume(resumeText)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Resume-based"
        title="Resume Interview Skills"
        subtitle="Upload your resume and we build an interview skill plan strictly from what it actually says. Nothing is invented — you review and accept every skill before it is saved to your profile."
      />

      {phase === 'input' ? (
        <div className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <div>
            <FieldLabel htmlFor="resume-file">Upload resume (PDF or .txt)</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                id="resume-file"
                type="file"
                accept={RESUME_ACCEPT}
                className="hidden"
                onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
              >
                {extracting ? 'Reading file…' : 'Choose file'}
              </Button>
              {fileName ? (
                <span className="text-sm text-slate-600">
                  Loaded <span className="font-medium text-navy-950">{fileName}</span>
                </span>
              ) : (
                <span className="text-sm text-slate-500">PDF or plain text, up to 8 MB.</span>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or paste text</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="resume-text">Resume text</FieldLabel>
            <TextArea
              id="resume-text"
              className="min-h-52"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value.slice(0, RESUME_TEXT_MAX))}
              placeholder="Paste your full resume text here. Include your skills, projects (with the technologies used), work/internship experience, education, and certifications so the analysis has real evidence to work from."
            />
            <p className="mt-1 text-xs text-slate-500">
              {resumeText.trim().length}/{RESUME_TEXT_MAX} · Minimum {RESUME_TEXT_MIN} characters · Sent only to your
              secure analysis endpoint; not stored as a public document.
            </p>
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <Button onClick={() => void analyze()} disabled={!canAnalyze || analyzing}>
              {analyzing ? 'Analyzing resume…' : 'Analyze Resume'}
            </Button>
          </div>
          {!canAnalyze && resumeText.trim().length > 0 ? (
            <p className="text-xs text-slate-500">Add a bit more detail to analyze.</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {notice ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {profileSummary ? (
            <Card className="p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">From your resume</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{profileSummary}</p>
            </Card>
          ) : null}

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-navy-950">Review your interview skills</h2>
              <span className="text-xs text-slate-500">
                {acceptedItems.length} accepted of {items.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Accept the skills you want, remove anything that does not fit, and add your own. Only accepted skills
              become your resume-derived interview skill set.
            </p>

            {items.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No skills yet. Add one below or analyze a resume.</p>
            ) : (
              <div className="mt-4 space-y-6">
                {SECTION_ORDER.map((section) => {
                  const sectionItems = grouped[section]
                  if (sectionItems.length === 0) return null
                  const meta = CATEGORY_META[section]
                  return (
                    <div key={section}>
                      <div className="flex items-center gap-2">
                        <Badge tone={meta.tone}>{meta.title}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                      <ul className="mt-3 space-y-2">
                        {sectionItems.map((item) => (
                          <li
                            key={item.key}
                            className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-navy-950">{item.skill}</p>
                              {item.evidenceType || item.evidenceDetail ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  <span className="font-medium text-slate-600">
                                    {evidenceTypeLabel(item.evidenceType)}
                                  </span>
                                  {item.evidenceDetail ? <span> · {item.evidenceDetail}</span> : null}
                                </p>
                              ) : null}
                              {item.inferredFrom ? (
                                <p className="mt-1 text-xs italic text-slate-500">
                                  Inferred from: “{item.inferredFrom}”
                                </p>
                              ) : null}
                              {item.derivedFrom && item.derivedFrom.length > 0 ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  Derived from: {item.derivedFrom.join(', ')}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <Toggle
                                checked={item.accepted}
                                label={`Accept ${item.skill}`}
                                onChange={(next) => toggleItem(item.key, next)}
                              />
                              <button
                                type="button"
                                onClick={() => removeItem(item.key)}
                                className="text-xs font-medium text-slate-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <FieldLabel htmlFor="manual-skill">Add a skill manually</FieldLabel>
              <div className="flex gap-2">
                <TextInput
                  id="manual-skill"
                  value={manualDraft}
                  placeholder="e.g. GraphQL"
                  onChange={(event) => setManualDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addManualSkill()
                    }
                  }}
                />
                <Button variant="outline" onClick={addManualSkill}>
                  Add
                </Button>
              </div>
            </div>
          </Card>

          {projects.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <h2 className="font-semibold text-navy-950">Projects identified in your resume</h2>
              <p className="mt-1 text-sm text-slate-600">
                Your AI Interview will only ask about these resume projects — never invented ones. Remove any you
                don&apos;t want discussed.
              </p>
              <ul className="mt-4 space-y-3">
                {projects.map((project) => (
                  <li key={project.key} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-950">{project.name}</p>
                        {project.description ? (
                          <p className="mt-1 text-sm text-slate-600">{project.description}</p>
                        ) : null}
                        {project.technologies.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {project.technologies.map((tech) => (
                              <Badge key={tech} tone="slate">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Toggle
                          checked={project.accepted}
                          label={`Include ${project.name}`}
                          onChange={(next) => toggleProject(project.key, next)}
                        />
                        <button
                          type="button"
                          onClick={() => removeProject(project.key)}
                          className="text-xs font-medium text-slate-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {certifications.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <h2 className="font-semibold text-navy-950">Certifications</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {certifications.map((cert) => (
                  <Badge key={cert} tone="blue">
                    {cert}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={startOver}>
              {loadedExisting ? 'Analyze a new resume' : 'Start over'}
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {saved ? (
                <Link to="/candidate/practice/mock?fresh=1">
                  <Button variant="outline">Start AI Interview</Button>
                </Link>
              ) : null}
              <Button onClick={() => void save()} disabled={saving || acceptedItems.length === 0}>
                {saving ? 'Saving…' : saved ? 'Saved ✓ Update' : `Save ${acceptedItems.length} skills to profile`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'input' && !canAnalyze && resumeText.trim().length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No resume analyzed yet"
            body="Upload or paste your resume, then analyze. We only extract skills, projects, experience and certifications that your resume actually states."
          />
        </div>
      ) : null}
    </div>
  )
}
