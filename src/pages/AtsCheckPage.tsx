import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  FileSearch,
  FileUp,
  Loader2,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react'
import { Button } from '../components/ui/Button.tsx'
import { FieldLabel, TextArea } from '../components/ui/primitives.tsx'
import { RESUME_TEXT_MAX, RESUME_TEXT_MIN } from '../resume/aiModel.ts'
import { atsGradeLabel } from '../resume/atsCheck.ts'
import { buildAtsFullReport, type AtsFullReport, type AtsIssue } from '../resume/atsReport.ts'
import { ATS_TEMPLATES, formatResumeWithTemplate, type AtsTemplateId } from '../resume/atsTemplates.ts'
import { extractResumeText, RESUME_ACCEPT } from '../resume/resumeText.ts'

type Mode = 'resume' | 'jd'
type CategoryId = 'content' | 'sections' | 'ats'

function scoreTone(score: number) {
  if (score >= 75) return 'text-emerald-800 bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'text-amber-900 bg-amber-50 border-amber-200'
  return 'text-rose-800 bg-rose-50 border-rose-200'
}

function Gauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score))
  const angle = (clamped / 100) * 180
  return (
    <div className="ats-gauge relative mx-auto h-28 w-48">
      <div className="absolute inset-x-0 bottom-0 h-24 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-48 rounded-full border-[12px] border-slate-200" />
        <div
          className="absolute inset-x-0 top-0 h-48 rounded-full border-[12px] border-transparent border-t-sky-500 border-l-sky-500 transition-transform duration-700 ease-out"
          style={{ transform: `rotate(${angle - 180}deg)` }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <p className="text-3xl font-semibold text-navy-950">{clamped}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">/ 100</p>
      </div>
    </div>
  )
}

export function AtsCheckPage() {
  const [mode, setMode] = useState<Mode>('resume')
  const [resumeText, setResumeText] = useState('')
  const [jobText, setJobText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [report, setReport] = useState<AtsFullReport | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryId>('content')
  const [templateId, setTemplateId] = useState<AtsTemplateId>('classic')
  const [previewMode, setPreviewMode] = useState<'original' | 'improved'>('improved')
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const improvedText = useMemo(() => {
    if (!resumeText.trim()) return ''
    return formatResumeWithTemplate(resumeText, templateId, {
      missingJobSkills: report?.jdMatch?.missingSkills?.slice(0, 8) ?? [],
    })
  }, [resumeText, templateId, report?.jdMatch?.missingSkills])

  const categoryIssues = useMemo(() => {
    if (!report) return [] as AtsIssue[]
    return report.issues.filter((issue) => issue.category === activeCategory)
  }, [report, activeCategory])

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current)
    }
  }, [])

  function clearProgressTimer() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  function runAnalysis(text: string, jd: string) {
    clearProgressTimer()
    setAnalyzing(true)
    setProgress(8)
    setError('')
    progressTimer.current = setInterval(() => {
      setProgress((value) => (value >= 92 ? value : value + 7 + Math.floor(Math.random() * 6)))
    }, 160)

    window.setTimeout(() => {
      try {
        const next = buildAtsFullReport(text, mode === 'jd' ? jd : '', '')
        setReport(next)
        setActiveCategory(next.categories.sort((a, b) => b.issueCount - a.issueCount)[0]?.id ?? 'content')
        setPreviewMode('improved')
        setProgress(100)
      } catch {
        setError('Could not score that resume. Try pasting the text and run again.')
        setReport(null)
      } finally {
        clearProgressTimer()
        window.setTimeout(() => {
          setAnalyzing(false)
          setProgress(0)
        }, 350)
      }
    }, 1100)
  }

  async function onFile(file: File | null) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const text = await extractResumeText(file)
      const clipped = text.slice(0, RESUME_TEXT_MAX)
      setResumeText(clipped)
      setFileName(file.name)
      if (clipped.trim().length >= RESUME_TEXT_MIN) runAnalysis(clipped, jobText)
      else setError(`We need at least ${RESUME_TEXT_MIN} characters of resume text.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
      setReport(null)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onCheck() {
    if (resumeText.trim().length < RESUME_TEXT_MIN) {
      setError(`Paste at least ${RESUME_TEXT_MIN} characters, or upload a resume.`)
      return
    }
    if (mode === 'jd' && jobText.trim().length < 40) {
      setError('Paste a job description (or switch to Resume only).')
      return
    }
    runAnalysis(resumeText, jobText)
  }

  async function copyImproved() {
    if (!improvedText) return
    try {
      await navigator.clipboard.writeText(improvedText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy. Select the improved text manually.')
    }
  }

  return (
    <div className="ats-studio relative isolate overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-gradient-to-b from-sky-50/95 via-indigo-50/40 to-transparent"
        aria-hidden
      />
      <div className="ats-orb ats-orb-a pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" aria-hidden />
      <div className="ats-orb ats-orb-b pointer-events-none absolute -right-16 top-28 h-44 w-44 rounded-full bg-indigo-200/35 blur-3xl" aria-hidden />

      <section className="ats-enter mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
          <FileSearch className="h-4 w-4" aria-hidden />
          Resume checker
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">Check score, then fix the format</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Upload a resume for readiness scoring and issue breakdown. Pick an ATS-friendly template to rebuild a cleaner version — optionally
          tailored to a job description.
        </p>
      </section>

      <div className="ats-fade-up mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === 'resume' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setMode('resume')}
          >
            Resume only
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === 'jd' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setMode('jd')}
          >
            Resume + JD tailor
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <div className={`rounded-2xl border border-sky-100/90 bg-white/95 p-5 shadow-sm sm:p-6 ${busy ? 'opacity-70' : ''}`}>
            <input
              ref={inputRef}
              type="file"
              accept={RESUME_ACCEPT}
              className="hidden"
              onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => !busy && inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (!busy) inputRef.current?.click()
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
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(false)
                void onFile(event.dataTransfer.files?.[0] ?? null)
              }}
              className={`ats-dropzone cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition sm:py-9 ${
                dragOver ? 'scale-[1.01] border-sky-500 bg-sky-50' : 'border-sky-200 bg-gradient-to-br from-white to-sky-50/50'
              }`}
            >
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-500 text-white shadow-md">
                <Upload className="h-6 w-6" />
              </span>
              <p className="mt-3 text-base font-semibold text-navy-950">{dragOver ? 'Drop to analyze' : 'Upload resume'}</p>
              <p className="mt-1 text-sm text-slate-600">PDF, Word, or text · scored on your device</p>
              <span className="mt-4 inline-flex h-10 items-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-semibold">
                <FileUp className="mr-2 h-4 w-4 text-sky-700" />
                {busy ? 'Reading…' : fileName ? 'Replace file' : 'Choose file'}
              </span>
            </div>

            <div className="mt-4">
              <FieldLabel htmlFor="ats-resume">Resume text</FieldLabel>
              <TextArea
                id="ats-resume"
                className="min-h-36"
                value={resumeText}
                disabled={busy || analyzing}
                onChange={(event) => setResumeText(event.target.value.slice(0, RESUME_TEXT_MAX))}
                placeholder="Or paste resume text here."
              />
            </div>

            {mode === 'jd' ? (
              <div className="mt-4">
                <FieldLabel htmlFor="ats-jd">Job description</FieldLabel>
                <TextArea
                  id="ats-jd"
                  className="min-h-28"
                  value={jobText}
                  disabled={busy || analyzing}
                  onChange={(event) => setJobText(event.target.value.slice(0, 12_000))}
                  placeholder="Paste the JD to tailor missing skills into the improved template."
                />
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" disabled={busy || analyzing} onClick={onCheck} className="ats-cta-glow">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {report ? 'Re-check resume' : 'Check score'}
                </span>
              </Button>
            </div>
          </div>

          {report ? (
            <div className="ats-panel grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your score</p>
                <Gauge score={report.readiness.score} />
                <p className={`mx-auto mt-2 w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreTone(report.readiness.score)}`}>
                  {atsGradeLabel(report.readiness.grade)}
                </p>
                <p className="mt-2 text-center text-xs text-slate-500">Checklist only — not a hiring prediction.</p>
                <div className="mt-5 space-y-2">
                  {report.categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                        activeCategory === category.id
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-100 bg-slate-50/60 hover:border-slate-200'
                      }`}
                    >
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{category.label}</span>
                        <span className="text-sm font-semibold text-navy-950">{category.score}%</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        {category.issueCount === 0 ? 'No issues' : `${category.issueCount} issue${category.issueCount === 1 ? '' : 's'}`}
                      </span>
                    </button>
                  ))}
                </div>
                {report.jdMatch ? (
                  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-900">
                      <Target className="h-3.5 w-3.5" />
                      JD coverage
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-navy-950">{report.jdMatch.score}%</p>
                    <p className="text-xs text-slate-600">
                      {report.jdMatch.matchedSkills.length}/{report.jdMatch.jobSkills.length} required skills found
                    </p>
                  </div>
                ) : null}
              </aside>

              <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-navy-950 capitalize">{activeCategory === 'ats' ? 'ATS essentials' : activeCategory}</h2>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-100">
                      {report.issueCount} issue{report.issueCount === 1 ? '' : 's'} found
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-navy-950">Estimated parse coverage</p>
                    <p className="mt-1 text-sm text-slate-600">
                      How cleanly a typical ATS can read contact, headings, and keywords from this text.
                    </p>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="ats-parse-fill h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                        style={{ width: `${report.parseRate}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm font-medium text-emerald-800">{report.parseRate}% likely readable by ATS parsers</p>
                  </div>

                  <ul className="ats-check-stagger mt-5 space-y-2">
                    {categoryIssues.length === 0 ? (
                      <li className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3 text-sm text-emerald-900">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          No issues in this category
                        </span>
                      </li>
                    ) : (
                      categoryIssues.map((issue) => (
                        <li key={issue.id} className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3 text-sm">
                          <p className="inline-flex items-center gap-2 font-semibold text-navy-950">
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                            {issue.title}
                          </p>
                          <p className="mt-1 text-slate-600">{issue.detail}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold text-navy-950">Improve with a template</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose a layout. We rebuild a cleaner text version — missing JD skills are added to the Skills block when you used JD
                    tailor mode.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {ATS_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setTemplateId(template.id)
                          setPreviewMode('improved')
                        }}
                        className={`rounded-xl border p-3 text-left transition ${
                          templateId === template.id
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                            : 'border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <p className="text-sm font-semibold text-navy-950">{template.name}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{template.blurb}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        previewMode === 'original' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600'
                      }`}
                      onClick={() => setPreviewMode('original')}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        previewMode === 'improved' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600'
                      }`}
                      onClick={() => setPreviewMode('improved')}
                    >
                      Improved template
                    </button>
                  </div>

                  <pre className="ats-fade-up mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs leading-5 text-slate-800">
                    {previewMode === 'original' ? resumeText : improvedText}
                  </pre>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => void copyImproved()}>
                      <span className="inline-flex items-center gap-2">
                        <ClipboardCopy className="h-4 w-4" />
                        {copied ? 'Copied improved text' : 'Copy improved resume'}
                      </span>
                    </Button>
                    <Link to="/candidate/resume-skills">
                      <Button type="button" variant="ghost">
                        Open resume skills →
                      </Button>
                    </Link>
                    {mode === 'jd' ? (
                      <Link to="/candidate/job-match">
                        <Button type="button" variant="ghost">
                          Find interviewers for this job →
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="ats-fade-up h-fit rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm">
          <p className="text-sm font-semibold text-navy-950">How this works</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-6 text-slate-600">
            <li>Upload or paste your resume.</li>
            <li>Optional: paste a JD to see coverage gaps.</li>
            <li>Review score + issues by category.</li>
            <li>Pick a template and copy the improved text.</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            Suggestions are based on structure and keywords in your text — not a guarantee of interviews or offers.
          </p>
        </aside>
      </div>

      {analyzing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="ats-analyze-modal w-full max-w-md rounded-2xl border border-white/20 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy-950">
                <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
                Analyzing & preparing fixes…
              </p>
              <p className="text-xs font-medium text-slate-500">{Math.min(progress, 99)}% complete</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 transition-[width] duration-200"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-600">Checking sections, keywords, and readability — then building your template preview.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
