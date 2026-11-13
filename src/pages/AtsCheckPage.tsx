import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Coins,
  Download,
  FileSearch,
  FileUp,
  Loader2,
  PencilLine,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  Upload,
  Wand2,
} from 'lucide-react'
import { AtsResumePreview } from '../components/resume/AtsResumePreview.tsx'
import { Button } from '../components/ui/Button.tsx'
import { FieldLabel, TextArea } from '../components/ui/primitives.tsx'
import { RESUME_TEXT_MAX, RESUME_TEXT_MIN } from '../resume/aiModel.ts'
import { ATS_AI_IMPROVE_COST, canSpendAiCredits, getAiCredits, refundAiCredits, spendAiCredits } from '../resume/aiCredits.ts'
import { requestAtsAiImprove } from '../resume/atsAiImprove.ts'
import { atsGradeLabel } from '../resume/atsCheck.ts'
import { buildAtsFullReport, type AtsFullReport, type AtsIssue } from '../resume/atsReport.ts'
import { ATS_TEMPLATES, formatResumeWithTemplate, type AtsTemplateId } from '../resume/atsTemplates.ts'
import { extractResumeText, RESUME_ACCEPT } from '../resume/resumeText.ts'

type Mode = 'resume' | 'jd'
type CategoryId = 'content' | 'sections' | 'ats'
type PreviewMode = 'original' | 'improved' | 'ai'
type DraftView = 'visual' | 'plain' | 'edit'

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
  const [improving, setImproving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [report, setReport] = useState<AtsFullReport | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryId>('content')
  const [templateId, setTemplateId] = useState<AtsTemplateId>('classic')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('improved')
  const [draftView, setDraftView] = useState<DraftView>('visual')
  const [aiDraft, setAiDraft] = useState('')
  const [credits, setCredits] = useState(() => getAiCredits())
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const jdDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analysisToken = useRef(0)

  const templateText = useMemo(() => {
    if (!resumeText.trim()) return ''
    return formatResumeWithTemplate(resumeText, templateId, {
      missingJobSkills: report?.jdMatch?.missingSkills?.slice(0, 8) ?? [],
      matchedJobSkills: report?.jdMatch?.matchedSkills?.slice(0, 8) ?? [],
      jobDescription: report?.jdMatch ? jobText : '',
      suggestions: report?.suggestions?.slice(0, 6) ?? [],
    })
  }, [
    resumeText,
    templateId,
    jobText,
    report?.jdMatch,
    report?.jdMatch?.missingSkills,
    report?.jdMatch?.matchedSkills,
    report?.suggestions,
  ])

  const displayText =
    previewMode === 'original' ? resumeText : previewMode === 'ai' && aiDraft ? aiDraft : templateText
  const resumeOnlyText = useMemo(() => displayText.split(/\nCOACHING NOTES\n/i)[0]?.trim() ?? displayText, [displayText])

  const headlineScore = report?.fitScore ?? report?.readiness.score ?? 0
  const headlineGrade = report?.fitGrade ?? report?.readiness.grade ?? 'needs_work'

  const categoryIssues = useMemo(() => {
    if (!report) return [] as AtsIssue[]
    return report.issues.filter((issue) => issue.category === activeCategory)
  }, [report, activeCategory])

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current)
      if (jdDebounce.current) clearTimeout(jdDebounce.current)
    }
  }, [])

  function refreshCredits() {
    setCredits(getAiCredits())
  }

  function clearProgressTimer() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  function runAnalysis(text: string, jd: string, analysisMode: Mode = mode) {
    const useJd = analysisMode === 'jd'
    if (useJd && jd.trim().length < 40) {
      setError('Paste a job description (or switch to Resume only).')
      return
    }

    const token = ++analysisToken.current
    clearProgressTimer()
    setAnalyzing(true)
    setProgress(8)
    setError('')
    setInfo('')
    setAiDraft('')
    progressTimer.current = setInterval(() => {
      setProgress((value) => (value >= 92 ? value : value + 7 + Math.floor(Math.random() * 6)))
    }, 160)

    window.setTimeout(() => {
      if (token !== analysisToken.current) return
      try {
        const next = buildAtsFullReport(text, useJd ? jd : '', '')
        setReport(next)
        setActiveCategory(
          next.jdMatch && next.jdMatch.score < 50
            ? 'content'
            : (next.categories.sort((a, b) => b.issueCount - a.issueCount)[0]?.id ?? 'content'),
        )
        setPreviewMode('improved')
        setProgress(100)
        window.setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      } catch {
        setError('Could not score that resume. Try pasting the text and run again.')
        setReport(null)
      } finally {
        clearProgressTimer()
        window.setTimeout(() => {
          if (token !== analysisToken.current) return
          setAnalyzing(false)
          setProgress(0)
        }, 350)
      }
    }, 900)
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
      if (clipped.trim().length < RESUME_TEXT_MIN) {
        setError(`We need at least ${RESUME_TEXT_MIN} characters of resume text.`)
        return
      }
      if (mode === 'jd' && jobText.trim().length < 40) {
        setReport(null)
        setError('Resume loaded. Paste the job description, then click Check score.')
        return
      }
      runAnalysis(clipped, jobText, mode)
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
    runAnalysis(resumeText, jobText, mode)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setInfo('')
    setAiDraft('')
    if (resumeText.trim().length < RESUME_TEXT_MIN) return
    if (next === 'jd' && jobText.trim().length < 40) {
      setReport(null)
      return
    }
    runAnalysis(resumeText, jobText, next)
  }

  function onJobTextChange(value: string) {
    setJobText(value)
    if (mode !== 'jd' || resumeText.trim().length < RESUME_TEXT_MIN) return
    if (jdDebounce.current) clearTimeout(jdDebounce.current)
    if (value.trim().length < 40) return
    jdDebounce.current = setTimeout(() => {
      runAnalysis(resumeText, value, 'jd')
    }, 700)
  }

  async function onImproveWithAi() {
    if (!report || resumeText.trim().length < RESUME_TEXT_MIN) {
      setError('Run a score check first, then improve with AI.')
      return
    }
    if (!canSpendAiCredits(ATS_AI_IMPROVE_COST)) {
      setError(`You need ${ATS_AI_IMPROVE_COST} AI credits. You have ${getAiCredits()} left.`)
      refreshCredits()
      return
    }
    if (!spendAiCredits(ATS_AI_IMPROVE_COST)) {
      setError(`You need ${ATS_AI_IMPROVE_COST} AI credits.`)
      refreshCredits()
      return
    }
    refreshCredits()
    setImproving(true)
    setError('')
    setInfo('')
    try {
      const outcome = await requestAtsAiImprove({
        resumeText,
        jobDescription: mode === 'jd' ? jobText : '',
        templateId,
        matchedSkills: report.jdMatch?.matchedSkills ?? [],
        missingSkills: report.jdMatch?.missingSkills ?? [],
        suggestions: report.suggestions,
      })
      if (!outcome.ok) {
        refundAiCredits(ATS_AI_IMPROVE_COST)
        refreshCredits()
        setError('AI improve could not finish. Your credits were refunded — try again.')
        return
      }
      setAiDraft(outcome.text)
      setPreviewMode('ai')
      setDraftView('visual')
      setApplied(false)
      setInfo(
        outcome.source === 'ai'
          ? `AI rewrite ready (−${ATS_AI_IMPROVE_COST} credits). Review the resume layout, then copy, download, or apply it.`
          : `Resume rewrite ready (−${ATS_AI_IMPROVE_COST} credits). Remote AI was unavailable, so we used the on-device improver.`,
      )
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    } catch {
      refundAiCredits(ATS_AI_IMPROVE_COST)
      refreshCredits()
      setError('AI improve failed. Credits refunded.')
    } finally {
      setImproving(false)
    }
  }

  async function copyImproved() {
    const text = resumeOnlyText
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy. Select the improved text manually.')
    }
  }

  function downloadResume() {
    const text = resumeOnlyText
    if (!text) return
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = previewMode === 'ai' ? 'ai-improved-resume.txt' : 'improved-resume.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  function printResume() {
    if (!resumeOnlyText) return
    window.print()
  }

  function applyToEditor() {
    if (!resumeOnlyText) return
    setResumeText(resumeOnlyText.slice(0, RESUME_TEXT_MAX))
    setApplied(true)
    setInfo('Applied rewrite into the resume editor above. Re-check score anytime.')
    window.setTimeout(() => setApplied(false), 2000)
  }

  return (
    <div className="ats-studio relative isolate overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-gradient-to-b from-sky-50/95 via-indigo-50/40 to-transparent"
        aria-hidden
      />
      <div className="ats-orb ats-orb-a pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" aria-hidden />
      <div className="ats-orb ats-orb-b pointer-events-none absolute -right-16 top-28 h-44 w-44 rounded-full bg-indigo-200/35 blur-3xl" aria-hidden />
      <div className="ats-orb ats-orb-c pointer-events-none absolute bottom-24 left-1/3 h-40 w-40 rounded-full bg-emerald-200/25 blur-3xl" aria-hidden />

      <section className="ats-enter mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
              <FileSearch className="h-4 w-4" aria-hidden />
              Resume checker
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">
              Score, tailor, then improve with AI
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Upload a resume for readiness scoring. In Resume + JD mode we rebuild toward the job. Spend AI credits for a deeper rewrite
              after analysis.
            </p>
          </div>
          <div className="ats-credit-chip inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-sm font-semibold text-amber-950 shadow-sm">
            <Coins className="h-4 w-4 text-amber-700" />
            {credits} AI credit{credits === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      <div className="ats-fade-up mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === 'resume' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => switchMode('resume')}
          >
            Resume only
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === 'jd' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => switchMode('jd')}
          >
            Resume + JD tailor
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <div className={`ats-card-lift rounded-2xl border border-sky-100/90 bg-white/95 p-5 shadow-sm sm:p-6 ${busy ? 'opacity-70' : ''}`}>
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
                disabled={busy || analyzing || improving}
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
                  disabled={busy || analyzing || improving}
                  onChange={(event) => onJobTextChange(event.target.value.slice(0, 12_000))}
                  placeholder="Paste the JD to tailor missing skills into the improved template."
                />
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            {info ? <p className="mt-3 text-sm text-emerald-800">{info}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" disabled={busy || analyzing || improving} onClick={onCheck} className="ats-cta-glow">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {report ? 'Re-check resume' : 'Check score'}
                </span>
              </Button>
            </div>
          </div>

          {report ? (
            <div ref={resultsRef} className="ats-panel grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
              <aside className="ats-card-lift rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {report.fitScore != null ? 'Job fit score' : 'Your score'}
                </p>
                <Gauge score={headlineScore} />
                <p className={`mx-auto mt-2 w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreTone(headlineScore)}`}>
                  {atsGradeLabel(headlineGrade)}
                </p>
                <p className="mt-2 text-center text-xs text-slate-500">
                  {report.fitScore != null
                    ? 'Mostly JD skill coverage — not a hiring prediction.'
                    : 'Checklist only — not a hiring prediction.'}
                </p>
                {report.jdMatch ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="ats-chip-pop rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ATS readiness</p>
                      <p className="text-sm font-semibold text-navy-950">{report.readiness.score}</p>
                    </div>
                    <div className="ats-chip-pop rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">JD coverage</p>
                      <p className="text-sm font-semibold text-navy-950">{report.jdMatch.score}%</p>
                    </div>
                  </div>
                ) : null}
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
                      JD coverage detail
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {report.jdMatch.matchedSkills.length}/{report.jdMatch.jobSkills.length} required skills found
                    </p>
                    {report.jdMatch.missingSkills.length > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-indigo-950">
                        Missing: {report.jdMatch.missingSkills.slice(0, 6).join(', ')}
                        {report.jdMatch.missingSkills.length > 6 ? '…' : ''}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-800">All extracted JD skills appear in the resume.</p>
                    )}
                  </div>
                ) : null}
              </aside>

              <div className="space-y-5">
                {report.jdMatch && report.fitScore != null && report.fitScore < 50 ? (
                  <div className="ats-alert-pulse rounded-2xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-950">
                      <AlertTriangle className="h-4 w-4" />
                      Weak match for this job description
                    </p>
                    <p className="mt-1 text-sm leading-6 text-rose-900/90">
                      ATS readiness can still look high when the resume is well formatted. Job fit is driven by JD skills — this resume
                      covers {report.jdMatch.matchedSkills.length}/{report.jdMatch.jobSkills.length} required tools.
                    </p>
                    {report.suggestions.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-rose-950">
                        {report.suggestions.slice(0, 5).map((item) => (
                          <li key={item} className="leading-5">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <section className="ats-card-lift rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-navy-950 capitalize">
                      {activeCategory === 'ats' ? 'ATS essentials' : activeCategory}
                    </h2>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-100">
                      {report.issueCount} issue{report.issueCount === 1 ? '' : 's'} found
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-navy-950">Estimated parse coverage</p>
                    <p className="mt-1 text-sm text-slate-600">
                      How cleanly a typical ATS can read contact, headings, and keywords from this text (separate from job fit).
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
                        <li
                          key={issue.id}
                          className={`rounded-xl border px-3 py-3 text-sm ${
                            issue.severity === 'high' ? 'border-rose-100 bg-rose-50/50' : 'border-amber-100 bg-amber-50/40'
                          }`}
                        >
                          <p className="inline-flex items-center gap-2 font-semibold text-navy-950">
                            <AlertTriangle className={`h-4 w-4 ${issue.severity === 'high' ? 'text-rose-700' : 'text-amber-700'}`} />
                            {issue.title}
                          </p>
                          <p className="mt-1 text-slate-600">{issue.detail}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section className="ats-ai-panel relative overflow-hidden rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-200/30 blur-2xl" aria-hidden />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-navy-950">
                        {report.jdMatch ? 'Tailor resume to this JD' : 'Improve with a template'}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {report.jdMatch
                          ? 'Free template rebuild prioritizes JD skills. Then spend credits for a deeper AI rewrite.'
                          : 'Free ATS template rebuild, plus optional AI polish with credits.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      disabled={busy || analyzing || improving}
                      onClick={() => void onImproveWithAi()}
                      className="ats-ai-glow"
                    >
                      <span className="inline-flex items-center gap-2">
                        {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        {improving ? 'Improving…' : `Improve with AI (−${ATS_AI_IMPROVE_COST})`}
                      </span>
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {ATS_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setTemplateId(template.id)
                          if (previewMode !== 'ai') setPreviewMode('improved')
                        }}
                        className={`ats-template-card rounded-xl border p-3 text-left transition ${
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

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-1">
                      {(
                        [
                          ['original', 'Original'],
                          ['improved', report.jdMatch ? 'JD-tailored' : 'Template'],
                          ...(aiDraft ? ([['ai', 'AI rewrite']] as const) : []),
                        ] as Array<[PreviewMode, string]>
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                            previewMode === id ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600'
                          }`}
                          onClick={() => {
                            setPreviewMode(id)
                            if (id !== 'original') setDraftView('visual')
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {previewMode !== 'original' ? (
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        {(
                          [
                            ['visual', 'Resume view'],
                            ['plain', 'Plain text'],
                            ['edit', 'Edit'],
                          ] as Array<[DraftView, string]>
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                              draftView === id ? 'bg-slate-900 text-white' : 'text-slate-600'
                            }`}
                            onClick={() => setDraftView(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="ats-draft-pane mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100/80">
                    {previewMode === 'original' || draftView === 'plain' ? (
                      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap bg-slate-50/90 p-4 text-xs leading-5 text-slate-800">
                        {displayText}
                      </pre>
                    ) : draftView === 'edit' ? (
                      <TextArea
                        className="min-h-[28rem] rounded-none border-0 bg-white text-sm"
                        value={previewMode === 'ai' ? aiDraft : templateText}
                        onChange={(event) => {
                          const next = event.target.value.slice(0, RESUME_TEXT_MAX)
                          if (previewMode === 'ai') setAiDraft(next)
                          else setResumeText(next)
                        }}
                      />
                    ) : (
                      <div className="ats-resume-stage max-h-[36rem] overflow-auto p-3 sm:p-5">
                        <AtsResumePreview text={displayText} showMeta={previewMode === 'ai'} />
                      </div>
                    )}
                  </div>

                  <div className="ats-action-row mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyImproved()}
                      className="ats-action-btn w-full whitespace-nowrap"
                    >
                      <ClipboardCopy className="h-4 w-4 shrink-0" />
                      {copied ? 'Copied resume' : 'Copy resume'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={downloadResume} className="ats-action-btn w-full whitespace-nowrap">
                      <Download className="h-4 w-4 shrink-0" />
                      Download .txt
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={printResume} className="ats-action-btn w-full whitespace-nowrap">
                      <Printer className="h-4 w-4 shrink-0" />
                      Print / Save PDF
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={applyToEditor}
                      className="ats-action-btn w-full whitespace-nowrap"
                    >
                      <PencilLine className="h-4 w-4 shrink-0" />
                      {applied ? 'Applied to editor' : 'Apply to editor'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || analyzing || improving}
                      onClick={() => void onImproveWithAi()}
                      className="ats-action-btn w-full whitespace-nowrap"
                    >
                      <RefreshCw className={`h-4 w-4 shrink-0 ${improving ? 'animate-spin' : ''}`} />
                      Re-run AI (−{ATS_AI_IMPROVE_COST})
                    </Button>
                    <Link
                      to="/candidate/resume-skills"
                      className="ats-action-link inline-flex h-9 min-h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-navy-950"
                    >
                      Resume skills
                      <span aria-hidden>→</span>
                    </Link>
                    {mode === 'jd' ? (
                      <Link
                        to="/candidate/job-match"
                        className="ats-action-link inline-flex h-9 min-h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 text-sm font-semibold text-indigo-950 sm:col-span-2 lg:col-span-1"
                      >
                        Find interviewers
                        <span aria-hidden>→</span>
                      </Link>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="ats-fade-up h-fit space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-sm font-semibold text-navy-950">How this works</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-6 text-slate-600">
              <li>Upload or paste your resume.</li>
              <li>Optional: paste a JD — headline score becomes job fit.</li>
              <li>Review gaps, pick a free template rebuild.</li>
              <li>
                Spend {ATS_AI_IMPROVE_COST} AI credits for Improve with AI (resume-only or Resume + JD).
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              Credits start at 10 in this browser. AI rewrites never invent experience — missing JD tools stay listed as gaps.
            </p>
          </div>
          <div className="ats-credit-card rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
              <Coins className="h-4 w-4" />
              Your AI credits
            </p>
            <p className="mt-2 text-3xl font-semibold text-navy-950">{credits}</p>
            <p className="mt-1 text-xs text-slate-600">
              Improve with AI costs {ATS_AI_IMPROVE_COST} credits. Failed runs are refunded.
            </p>
          </div>
        </aside>
      </div>

      {analyzing || improving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="ats-analyze-modal w-full max-w-md rounded-2xl border border-white/20 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy-950">
                <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
                {improving ? 'AI improving your resume…' : 'Analyzing & preparing fixes…'}
              </p>
              {!improving ? <p className="text-xs font-medium text-slate-500">{Math.min(progress, 99)}% complete</p> : null}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 ${
                  improving ? 'ats-ai-progress w-2/3' : 'transition-[width] duration-200'
                }`}
                style={improving ? undefined : { width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-600">
              {improving
                ? mode === 'jd'
                  ? 'Rewriting toward the JD: summary, prioritized bullets, and honest skill gaps.'
                  : 'Polishing structure, bullets, and keyword clarity for ATS parsers.'
                : 'Scoring job fit vs the JD, then sections and readability — then building your tailored draft.'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
