import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSearch, FileUp, Sparkles, Upload } from 'lucide-react'
import { AtsReadinessPanel } from '../components/resume/AtsCheckPanel.tsx'
import { Button } from '../components/ui/Button.tsx'
import { FieldLabel, TextArea } from '../components/ui/primitives.tsx'
import { evaluateAtsReadiness, type AtsReadinessResult } from '../resume/atsCheck.ts'
import { extractResumeText, RESUME_ACCEPT } from '../resume/resumeText.ts'
import { RESUME_TEXT_MAX, RESUME_TEXT_MIN } from '../resume/aiModel.ts'

export function AtsCheckPage() {
  const [resumeText, setResumeText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AtsReadinessResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [runId, setRunId] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const canCheck = resumeText.trim().length >= RESUME_TEXT_MIN

  const preview = useMemo(() => {
    const cleaned = resumeText.trim().replace(/\s+/g, ' ')
    return cleaned ? cleaned.slice(0, 220) : ''
  }, [resumeText])

  async function onFile(file: File | null) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const text = await extractResumeText(file)
      const clipped = text.slice(0, RESUME_TEXT_MAX)
      setResumeText(clipped)
      setFileName(file.name)
      const next = evaluateAtsReadiness(clipped)
      setResult(next)
      setRunId((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file. Try PDF, DOCX, or paste text.')
      setResult(null)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function runCheck() {
    if (!canCheck) {
      setError(`Paste at least ${RESUME_TEXT_MIN} characters, or upload a resume file.`)
      return
    }
    setError('')
    setResult(evaluateAtsReadiness(resumeText))
    setRunId((value) => value + 1)
  }

  return (
    <div className="ats-studio relative isolate overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-gradient-to-b from-sky-50/95 via-indigo-50/45 to-transparent"
        aria-hidden
      />
      <div className="ats-orb ats-orb-a pointer-events-none absolute -left-20 top-8 h-52 w-52 rounded-full bg-sky-200/45 blur-3xl" aria-hidden />
      <div className="ats-orb ats-orb-b pointer-events-none absolute -right-16 top-24 h-44 w-44 rounded-full bg-indigo-200/35 blur-3xl" aria-hidden />

      <section className="ats-enter mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
          <FileSearch className="h-4 w-4" aria-hidden />
          ATS readiness
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">Check your resume without a job link</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Upload a resume for a structural ATS readiness check — contact, sections, keywords, and formatting signals. To score against a
          specific posting, use{' '}
          <Link to="/candidate/job-match" className="font-medium text-indigo-800 underline decoration-indigo-200">
            Job Match
          </Link>
          .
        </p>
      </section>

      <div className="ats-fade-up mx-auto mt-8 max-w-4xl space-y-5 px-4 sm:px-6">
        <div
          className={`overflow-hidden rounded-2xl border border-sky-100/90 bg-white/95 p-5 shadow-sm sm:p-7 ${
            busy ? 'pointer-events-none opacity-70' : ''
          }`}
        >
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
            className={`ats-dropzone relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-4 py-8 text-center transition duration-300 sm:py-10 ${
              dragOver
                ? 'scale-[1.01] border-sky-500 bg-sky-50/80'
                : 'border-sky-200 bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/40 hover:border-sky-400'
            }`}
          >
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 via-indigo-500 to-violet-500 text-white shadow-lg shadow-sky-500/25">
              <Upload className="h-7 w-7" />
            </span>
            <p className="mt-4 text-base font-semibold text-navy-950">{dragOver ? 'Drop to check' : 'Drag & drop your resume'}</p>
            <p className="mt-1 text-sm text-slate-600">PDF, Word, or text · checked instantly on your device</p>
            <span className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-semibold text-navy-950 shadow-sm">
              <FileUp className="mr-2 h-4 w-4 text-sky-700" />
              {busy ? 'Reading…' : fileName ? 'Replace file' : 'Choose file'}
            </span>
          </div>

          {fileName || preview ? (
            <div className="ats-fade-up mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-sm font-medium text-navy-950">{fileName || 'Pasted resume text'}</p>
              {preview ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{preview}</p> : null}
            </div>
          ) : null}

          <div className="mt-5">
            <FieldLabel htmlFor="ats-resume-text">Or paste resume text</FieldLabel>
            <TextArea
              id="ats-resume-text"
              className="min-h-40"
              value={resumeText}
              disabled={busy}
              onChange={(event) => setResumeText(event.target.value.slice(0, RESUME_TEXT_MAX))}
              placeholder="Paste full resume text to run the same readiness checklist without a job description."
            />
            <p className="mt-1 text-xs text-slate-500">
              {resumeText.trim().length}/{RESUME_TEXT_MAX}
            </p>
          </div>

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">No JD required. For job-specific coverage, open Job Match after analyzing a posting.</p>
            <Button type="button" disabled={busy || !canCheck} onClick={runCheck} className="ats-cta-glow">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" aria-hidden />
                {result ? 'Re-check readiness' : 'Check ATS readiness'}
              </span>
            </Button>
          </div>
        </div>

        {result ? (
          <div key={runId} className="space-y-4">
            <AtsReadinessPanel result={result} animate />
            <div className="ats-fade-up rounded-2xl border border-indigo-100 bg-indigo-50/40 px-5 py-4 text-sm text-slate-700">
              Want skill coverage against a posting?{' '}
              <Link to="/candidate/job-match" className="font-medium text-indigo-900 underline decoration-indigo-200">
                Analyze a job URL
              </Link>{' '}
              then upload the same resume in Step 2. Or extract interview skills on{' '}
              <Link to="/candidate/resume-skills" className="font-medium text-indigo-900 underline decoration-indigo-200">
                Resume skills
              </Link>
              .
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
