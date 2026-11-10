import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardPaste,
  FileText,
  FileUp,
  FolderKanban,
  Sparkles,
  Upload,
} from 'lucide-react'
import { DataUseConsent } from '../components/legal/DataUseConsent.tsx'
import { ResumeExtractingBanner } from '../components/matching/ResumeExtractingBanner.tsx'
import { Button } from '../components/ui/Button.tsx'
import {
  Badge,
  EmptyState,
  FieldLabel,
  TextArea,
  TextInput,
  Toggle,
} from '../components/ui/primitives.tsx'
import { requestResumeSkillPlan } from '../resume/aiAssist.ts'
import { keepTechnicalSkillsOnly, localResumeSkillPlan } from '../resume/localSkillPlan.ts'
import {
  canAnalyzeResume,
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
  const [analysisConsent, setAnalysisConsent] = useState(false)
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
  const [dragOver, setDragOver] = useState(false)

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
    if (analyzing || submittingRef.current || !analysisConsent || !canAnalyzeResume(resumeText)) return
    submittingRef.current = true
    setAnalyzing(true)
    setError(null)
    setNotice(null)
    setSaved(false)
    const outcome = await requestResumeSkillPlan(resumeText)
    submittingRef.current = false
    setAnalyzing(false)
    if (!outcome.ok) {
      const local = localResumeSkillPlan(resumeText)
      if (local) {
        applyPlan(local)
        setLoadedExisting(false)
        setPhase('review')
        setNotice('AI analysis was unavailable, so these skills were taken from the text in your resume. Review them before saving.')
        return
      }
      setError(outcome.reason === 'insufficient_evidence' ? INSUFFICIENT : UNAVAILABLE)
      return
    }
    applyPlan(outcome.plan)
    setLoadedExisting(false)
    setPhase('review')
  }

  function applyPlan(plan: ResumeSkillPlan) {
    const technical = keepTechnicalSkillsOnly(plan)
    setProfileSummary(technical.profileSummary)
    setItems(planToItems(technical))
    setProjects(
      technical.projects.map((p, i) => ({
        key: keyFor('project', p.name, i),
        name: p.name,
        description: p.description,
        technologies: p.technologies,
        accepted: true,
      })),
    )
    setCertifications(technical.certifications)
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
  const textLen = resumeText.trim().length
  const textProgress = Math.min(100, Math.round((textLen / RESUME_TEXT_MIN) * 100))
  const busy = extracting || analyzing
  const hasResume = textLen > 0
  const wordCount = useMemo(
    () => (hasResume ? resumeText.trim().split(/\s+/).filter(Boolean).length : 0),
    [hasResume, resumeText],
  )
  const previewSnippet = useMemo(() => {
    const cleaned = resumeText.trim().replace(/\s+/g, ' ')
    if (!cleaned) return ''
    return cleaned.length > 220 ? `${cleaned.slice(0, 220)}…` : cleaned
  }, [resumeText])

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    if (busy) return
    const file = event.dataTransfer.files?.[0] ?? null
    void onFileSelected(file)
  }

  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(ellipse_70%_55%_at_12%_0%,rgba(0,122,255,0.14),transparent_55%),radial-gradient(ellipse_55%_45%_at_92%_8%,rgba(124,58,237,0.14),transparent_50%)]"
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="profile-enter overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_40px_-28px_rgba(12,18,32,0.35)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gradient-brand">Resume-based</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-[1.85rem]">
                Resume Interview Skills
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                {hasResume && phase === 'input'
                  ? 'Resume captured. Confirm the text, agree to analysis, then extract technical skills.'
                  : 'Upload your resume and we build an interview skill plan strictly from what it says. You review and accept every skill before it is saved.'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[15rem]">
              {[
                {
                  n: '1',
                  label: 'Upload',
                  active: phase === 'input' && !canAnalyze,
                  done: canAnalyze || phase === 'review',
                },
                { n: '2', label: 'Review', active: phase === 'review', done: false },
                { n: '3', label: 'Save', active: phase === 'review' && saved, done: saved },
              ].map((step, index) => (
                <div
                  key={step.n}
                  className={`resume-step-pop rounded-xl px-2.5 py-2 text-center ${
                    step.active
                      ? 'bg-gradient-to-br from-coral-600 to-violet-600 text-white shadow-md shadow-violet-500/25'
                      : step.done
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
                  }`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{step.n}</p>
                  <p className="mt-0.5 text-xs font-semibold">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {phase === 'input' ? (
          <div className="profile-stagger mt-6 space-y-5">
            {busy ? (
              <ResumeExtractingBanner
                fileName={fileName || 'Pasted resume text'}
                status={extracting ? 'Reading your resume file…' : 'Analyzing resume and extracting technical skills…'}
              />
            ) : null}

            <div
              className={`overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-300 sm:p-7 ${
                busy ? 'pointer-events-none opacity-55' : 'hover:border-violet-200/80 hover:shadow-md hover:shadow-violet-100/70'
              }`}
            >
              <input
                ref={fileInputRef}
                id="resume-file"
                type="file"
                accept={RESUME_ACCEPT}
                className="hidden"
                onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)}
              />

              {hasResume ? (
                <div className={`space-y-5 ${busy ? '' : 'resume-loaded-enter'}`}>
                  <div
                    className={`relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 sm:p-5 ${
                      canAnalyze ? 'resume-ready-glow' : ''
                    }`}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-emerald-300/30 blur-2xl"
                    />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-mint-600 text-white shadow-lg shadow-emerald-500/25">
                          <CheckCircle2 className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-navy-950">Resume ready</p>
                            {canAnalyze ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                                Ready to analyze
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                                Needs more detail
                              </span>
                            )}
                          </div>
                          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-slate-600">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                            <span className="truncate font-medium text-navy-950">
                              {fileName || 'Pasted resume text'}
                            </span>
                          </p>
                          {previewSnippet ? (
                            <p className="mt-3 line-clamp-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm">
                              {previewSnippet}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="h-4 w-4" />
                        Replace file
                      </Button>
                    </div>

                    <div className="relative mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Characters', value: textLen.toLocaleString('en-IN') },
                        { label: 'Words', value: wordCount.toLocaleString('en-IN') },
                        { label: 'Source', value: fileName ? 'File' : 'Paste' },
                      ].map((stat, index) => (
                        <div
                          key={stat.label}
                          className="resume-stat-rise rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-center shadow-sm"
                          style={{ animationDelay: `${index * 70}ms` }}
                        >
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
                          <p className="mt-0.5 text-sm font-semibold text-navy-950">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                          <ClipboardPaste className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-navy-950">Document preview</p>
                          <p className="text-[11px] text-slate-500">Edit if anything looks incomplete</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {textLen}/{RESUME_TEXT_MAX}
                      </span>
                    </div>
                    <div className="p-3 sm:p-4">
                      <TextArea
                        id="resume-text"
                        className="min-h-48 border-slate-200 bg-white shadow-inner"
                        value={resumeText}
                        disabled={busy}
                        onChange={(event) => setResumeText(event.target.value.slice(0, RESUME_TEXT_MAX))}
                        placeholder="Paste your full resume text here."
                      />
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                              canAnalyze
                                ? 'bg-gradient-to-r from-emerald-500 to-mint-500'
                                : 'bg-gradient-to-r from-coral-500 to-violet-500'
                            }`}
                            style={{ width: `${textProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !busy && fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        if (!busy) fileInputRef.current?.click()
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault()
                      setDragOver(true)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault()
                      setDragOver(false)
                    }}
                    onDrop={onDrop}
                    className={`resume-dropzone-idle relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-4 py-8 text-center transition duration-300 sm:px-6 sm:py-10 ${
                      dragOver
                        ? 'scale-[1.01] border-coral-500 bg-coral-50/70'
                        : 'border-violet-200 bg-gradient-to-br from-white via-violet-50/40 to-sky-50/50 hover:border-violet-400'
                    }`}
                  >
                    <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral-600 via-violet-500 to-sky-500 text-white shadow-lg shadow-violet-500/30">
                      <Upload className="h-7 w-7" />
                    </span>
                    <p className="mt-4 text-base font-semibold text-navy-950">
                      {dragOver ? 'Drop to upload' : 'Drag & drop your resume'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">PDF, Word, text, and more · up to 8 MB</p>
                    <div className="mt-4">
                      <span className="inline-flex h-10 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-semibold text-navy-950 shadow-sm">
                        <FileUp className="mr-2 h-4 w-4 text-violet-600" />
                        {extracting ? 'Reading file…' : 'Choose file'}
                      </span>
                    </div>
                  </div>

                  <div className="relative my-6">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        or paste text
                      </span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor="resume-text-empty">Resume text</FieldLabel>
                    <TextArea
                      id="resume-text-empty"
                      className="min-h-52 transition focus:border-violet-400"
                      value={resumeText}
                      disabled={busy}
                      onChange={(event) => setResumeText(event.target.value.slice(0, RESUME_TEXT_MAX))}
                      placeholder="Paste your full resume text here. Include skills, projects (with technologies), experience, education, and certifications."
                    />
                  </div>
                </>
              )}

              <div
                className={`mt-5 rounded-2xl border p-4 transition duration-300 sm:p-5 ${
                  canAnalyze
                    ? 'border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-sky-50/70 shadow-sm shadow-violet-100'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <DataUseConsent
                  id="resume-analysis-consent"
                  checked={analysisConsent}
                  onChange={setAnalysisConsent}
                >
                  I agree to send this resume text for optional AI analysis. It is not published. I can skip this step.{' '}
                  <Link to="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                </DataUseConsent>

                {error ? (
                  <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    {canAnalyze
                      ? analysisConsent
                        ? 'Next: extract technical skills for review.'
                        : 'Tick the box above to enable analysis.'
                      : 'Add enough resume text to continue.'}
                  </p>
                  <Button
                    fullWidth
                    className="sm:w-auto"
                    onClick={() => void analyze()}
                    disabled={!canAnalyze || !analysisConsent || busy}
                  >
                    <Sparkles className="h-4 w-4" />
                    {analyzing ? 'Analyzing resume…' : 'Analyze Resume'}
                  </Button>
                </div>
              </div>
            </div>

            {!canAnalyze && textLen === 0 ? (
              <EmptyState
                title="No resume analyzed yet"
                body="Upload or paste your resume, then analyze. We only extract skills, projects, experience and certifications that your resume actually states."
              />
            ) : null}
          </div>
        ) : (
          <div className="profile-stagger mt-6 space-y-5">
            {notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 shadow-sm shadow-emerald-100">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            {profileSummary ? (
              <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-violet-50/40 px-5 py-4 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gradient-brand">From your resume</p>
                </div>
                <p className="px-5 py-4 text-sm leading-6 text-slate-700 sm:px-6">{profileSummary}</p>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-violet-200/80 hover:shadow-md hover:shadow-violet-100/70">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-sky-50/40 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-coral-50 to-violet-100 text-violet-700">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-navy-950">Review your interview skills</h2>
                      <p className="text-xs text-slate-500">
                        {acceptedItems.length} accepted of {items.length}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-coral-500 to-violet-500 transition-[width] duration-500"
                      style={{
                        width: `${items.length === 0 ? 0 : Math.round((acceptedItems.length / items.length) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Accept what fits, remove what does not. Only accepted skills become your resume-derived set.
                </p>
              </div>

              <div className="p-5 sm:p-6">
                {items.length === 0 ? (
                  <p className="text-sm text-slate-600">No skills yet. Add one below or analyze a resume.</p>
                ) : (
                  <div className="space-y-6">
                    {SECTION_ORDER.map((section) => {
                      const sectionItems = grouped[section]
                      if (sectionItems.length === 0) return null
                      const meta = CATEGORY_META[section]
                      return (
                        <div key={section} className="resume-step-pop">
                          <div className="flex items-center gap-2">
                            <Badge tone={meta.tone}>{meta.title}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                          <ul className="mt-3 space-y-2">
                            {sectionItems.map((item) => (
                              <li
                                key={item.key}
                                className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition duration-300 ${
                                  item.accepted
                                    ? 'border-violet-100 bg-violet-50/40 hover:border-violet-200'
                                    : 'border-slate-100 bg-slate-50/50 opacity-70'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-navy-950">{item.skill}</p>
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
              </div>
            </section>

            {projects.length > 0 ? (
              <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-violet-200/80 hover:shadow-md hover:shadow-violet-100/70">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-mint-50/50 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-mint-50 to-sky-100 text-sky-700">
                      <FolderKanban className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-navy-950">Projects identified in your resume</h2>
                      <p className="text-sm text-slate-600">
                        AI Interview only asks about these — never invented projects.
                      </p>
                    </div>
                  </div>
                </div>
                <ul className="space-y-3 p-5 sm:p-6">
                  {projects.map((project) => (
                    <li
                      key={project.key}
                      className={`rounded-xl border p-3 transition ${
                        project.accepted
                          ? 'border-sky-100 bg-sky-50/40'
                          : 'border-slate-100 bg-slate-50/50 opacity-70'
                      }`}
                    >
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
              </section>
            ) : null}

            {certifications.length > 0 ? (
              <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
                <h2 className="font-semibold text-navy-950">Certifications</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {certifications.map((cert) => (
                    <Badge key={cert} tone="blue">
                      {cert}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_12px_40px_-18px_rgba(12,18,32,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={startOver}>
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
      </div>
    </div>
  )
}
