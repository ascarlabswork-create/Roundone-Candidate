import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Briefcase, FileText, Hash, Link2, RefreshCw, Sparkles, Upload, Users } from 'lucide-react'
import { JobMatchCard } from '../components/interviewer/JobMatchCard.tsx'
import { AtsReadinessPanel, JdMatchPanel } from '../components/resume/AtsCheckPanel.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Chip, EmptyState, FieldLabel, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { skillsFromJobDescription } from '../jobMatch/extractJobSkills.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { evaluateAtsReadiness, evaluateJdMatch, type AtsReadinessResult, type JdMatchResult } from '../resume/atsCheck.ts'
import { extractResumeText, RESUME_ACCEPT } from '../resume/resumeText.ts'
import {
  analyzeJobText,
  analyzeJobUrl,
  JobAnalysisError,
  UNREADABLE_JOB_MESSAGE,
  type JobAnalysis,
} from '../services/jobAnalysis.ts'
import { jobMatchDetail, jobMatchToCatalogPerson, matchInterviewersForJob, type JobMatchPage as JobMatchResult } from '../services/jobMatch.ts'
import { createJobTarget, getJobTarget, updateJobTarget, type JobTarget } from '../services/jobTargets.ts'

type ReviewDraft = {
  companyName: string
  jobTitle: string
  description: string
  skills: string[]
  skillDraft: string
  sourceUrl: string | null
  sourceType: 'url' | 'manual'
  jobId: string
}

const PAGE_SIZE = 20

function draftFromAnalysis(analysis: JobAnalysis, jobIdHint: string): ReviewDraft {
  const description = analysis.description ?? ''
  const jobTitle = analysis.jobTitle ?? ''
  return {
    companyName: analysis.companyName ?? '',
    jobTitle,
    description,
    skills: skillsFromJobDescription(description, jobTitle, analysis.skills),
    skillDraft: '',
    sourceUrl: analysis.sourceUrl,
    sourceType: analysis.sourceType,
    jobId: analysis.jobId ?? jobIdHint,
  }
}

function draftFromTarget(target: JobTarget): ReviewDraft {
  const description = target.description ?? ''
  const jobTitle = target.jobTitle ?? ''
  return {
    companyName: target.companyName ?? '',
    jobTitle,
    description,
    skills: skillsFromJobDescription(description, jobTitle, target.skills),
    skillDraft: '',
    sourceUrl: target.sourceUrl,
    sourceType: target.sourceType,
    jobId: target.jobId ?? '',
  }
}

export function JobMatchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const targetId = params.get('target')
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState('')
  const [paste, setPaste] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [review, setReview] = useState<ReviewDraft | null>(null)
  const [skillsEdited, setSkillsEdited] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(targetId)
  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState('')
  const [matches, setMatches] = useState<JobMatchResult | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loadingTarget, setLoadingTarget] = useState(Boolean(targetId))
  const [resumeText, setResumeText] = useState('')
  const [resumeFileName, setResumeFileName] = useState<string | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [atsResult, setAtsResult] = useState<AtsReadinessResult | null>(null)
  const [jdMatch, setJdMatch] = useState<JdMatchResult | null>(null)
  const resumeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!targetId) return
    let cancelled = false
    setLoadingTarget(true)
    getJobTarget(targetId)
      .then((target) => {
        if (cancelled || !target) return
        setReview(draftFromTarget(target))
        setSavedId(target.id)
        setSkillsEdited(false)
        if (target.sourceUrl) setUrl(target.sourceUrl)
        if (target.jobId) setJobId(target.jobId)
      })
      .catch(() => {
        if (!cancelled) setAnalyzeError('That saved job could not be opened.')
      })
      .finally(() => {
        if (!cancelled) setLoadingTarget(false)
      })
    return () => {
      cancelled = true
    }
  }, [targetId])

  async function saveReviewed(next: ReviewDraft, status: 'analyzed' | 'ready') {
    const input = {
      sourceUrl: next.sourceUrl,
      sourceType: next.sourceType,
      jobId: next.jobId || null,
      companyName: next.companyName || null,
      jobTitle: next.jobTitle || null,
      description: next.description || null,
      skills: next.skills,
      status,
    }
    const saved = savedId ? await updateJobTarget(savedId, input) : await createJobTarget(input)
    setSavedId(saved.id)
    return saved.id
  }

  async function practiceForJob() {
    if (!review) return
    setFindError('')
    try {
      const id = await saveReviewed(review, 'analyzed')
      navigate(`/candidate/practice/mock?fresh=1&job=${id}`)
    } catch (error) {
      setFindError(error instanceof Error ? error.message : 'Save this job before practicing for it.')
    }
  }

  async function onAnalyze(event: FormEvent) {
    event.preventDefault()
    setAnalyzing(true)
    setAnalyzeError('')
    setMatches(null)
    try {
      const analysis = await analyzeJobUrl(url, jobId)
      const next = draftFromAnalysis(analysis, jobId)
      const merged =
        review && skillsEdited
          ? {
              ...next,
              companyName: review.companyName,
              jobTitle: review.jobTitle,
              description: review.description,
              skills: review.skills,
            }
          : next
      setReview(merged)
      setSkillsEdited(false)
      if (merged.jobId) setJobId(merged.jobId)
      setShowPaste(false)
      try {
        await saveReviewed(merged, 'analyzed')
      } catch (error) {
        setAnalyzeError(error instanceof Error ? error.message : 'The job was read, but it could not be saved.')
      }
    } catch (error) {
      const message = error instanceof JobAnalysisError ? error.message : UNREADABLE_JOB_MESSAGE
      setAnalyzeError(message)
      setShowPaste(true)
    } finally {
      setAnalyzing(false)
    }
  }

  async function onPaste(event: FormEvent) {
    event.preventDefault()
    setAnalyzing(true)
    setAnalyzeError('')
    setMatches(null)
    try {
      const analysis = await analyzeJobText(paste, jobId)
      const next = draftFromAnalysis(analysis, jobId)
      setReview(next)
      setSkillsEdited(false)
      if (next.jobId) setJobId(next.jobId)
      try {
        await saveReviewed(next, 'analyzed')
      } catch (error) {
        setAnalyzeError(error instanceof Error ? error.message : 'The description was read, but it could not be saved.')
      }
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : 'Enter a job description to continue.')
    } finally {
      setAnalyzing(false)
    }
  }

  function refreshSkillsFromDescription() {
    if (!review) return
    const skills = skillsFromJobDescription(review.description, review.jobTitle, [])
    setReview({ ...review, skills })
    setSkillsEdited(false)
    setMatches(null)
    if (resumeText.trim()) {
      setJdMatch(evaluateJdMatch(resumeText, review.description, review.jobTitle, skills))
    }
  }

  async function onResumeSelected(file: File | null) {
    if (!file || !review) return
    setResumeBusy(true)
    setResumeError('')
    try {
      const text = await extractResumeText(file)
      setResumeText(text)
      setResumeFileName(file.name)
      setAtsResult(evaluateAtsReadiness(text))
      setJdMatch(evaluateJdMatch(text, review.description, review.jobTitle, review.skills))
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not read that resume. Try PDF, DOCX, or paste text.')
    } finally {
      setResumeBusy(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  function runResumeChecksFromPaste() {
    if (!review || !resumeText.trim()) {
      setResumeError('Paste or upload your resume first.')
      return
    }
    setResumeError('')
    setAtsResult(evaluateAtsReadiness(resumeText))
    setJdMatch(evaluateJdMatch(resumeText, review.description, review.jobTitle, review.skills))
  }

  function addSkill() {
    if (!review) return
    const next = dedupeSkills([...review.skills, review.skillDraft])
    setReview({ ...review, skills: next, skillDraft: '' })
    setSkillsEdited(true)
    setMatches(null)
  }

  function removeSkill(skill: string) {
    if (!review) return
    setReview({ ...review, skills: review.skills.filter((item) => item !== skill) })
    setSkillsEdited(true)
    setMatches(null)
  }

  async function loadMatches(nextPage: number, nextSearch: string) {
    if (!review) return
    const enriched = skillsFromJobDescription(review.description, review.jobTitle, review.skills)
    const skills = skillsEdited ? review.skills : enriched
    if (skills.length === 0) {
      setFindError("We couldn't identify interview skills from this posting. Add the required skills manually to continue.")
      return
    }
    if (!skillsEdited && enriched.length !== review.skills.length) {
      setReview({ ...review, skills: enriched })
    }
    setFinding(true)
    setFindError('')
    try {
      const working = { ...review, skills }
      await saveReviewed(working, 'ready')
      const result = await matchInterviewersForJob({
        skills,
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: nextSearch,
      })
      setMatches(result)
      setPage(result.page)
    } catch (error) {
      setFindError(error instanceof Error ? error.message : 'Unable to find interviewers for this job.')
    } finally {
      setFinding(false)
    }
  }

  const totalPages = matches ? Math.max(1, Math.ceil(matches.total / matches.pageSize)) : 1

  return (
    <div className="job-match-studio relative isolate overflow-hidden pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-gradient-to-b from-indigo-50/95 via-violet-50/50 to-transparent"
        aria-hidden
      />
      <div
        className="job-match-orb job-match-orb-a pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="job-match-orb job-match-orb-b pointer-events-none absolute -right-16 top-28 h-48 w-48 rounded-full bg-violet-200/35 blur-3xl"
        aria-hidden
      />

      <section className="job-match-enter mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-800">
          <Briefcase className="h-4 w-4" aria-hidden />
          Job-based discovery
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">Find an interviewer for this job</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Paste a public job URL or ID — we read the posting, pull{' '}
          <span className="font-medium text-indigo-900">required interview skills</span> from the description, then rank interviewers
          who list those skills.
        </p>
      </section>

      <form
        onSubmit={onAnalyze}
        className="job-match-panel job-match-panel-glow mx-auto mt-8 max-w-6xl space-y-5 rounded-2xl border border-indigo-100/80 bg-white/95 p-5 shadow-sm sm:p-8"
      >
        <Motion className="flex items-center gap-2 text-sm font-semibold text-navy-950">
          <Link2 className="h-4 w-4 text-indigo-700" aria-hidden />
          Step 1 — Link this job posting
        </Motion>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <div>
            <FieldLabel htmlFor="job-url">Job URL</FieldLabel>
            <div className="relative">
              <Link2
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <TextInput
                id="job-url"
                type="url"
                className="job-match-input pl-10"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://careers.example.com/jobs/software-engineer"
                required={!showPaste}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Public career pages work best — no login walls.</p>
          </div>
          <div>
            <FieldLabel htmlFor="job-id">Job ID (optional)</FieldLabel>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <TextInput
                id="job-id"
                className="job-match-input pl-10 font-mono text-sm"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder="ATCI-5198132"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Helps ATS pages that hide the ID in the URL.</p>
          </div>
        </div>
        {analyzeError ? <p className="text-sm text-red-700">{analyzeError}</p> : null}
        {analyzing ? (
          <Motion className="job-match-analyze-bar flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
            <Sparkles className="h-4 w-4 job-match-spin" aria-hidden />
            Reading the job page and extracting skills from the description…
          </Motion>
        ) : null}
        <Motion className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={analyzing} className="job-match-cta-glow">
            {analyzing ? 'Analyzing…' : 'Analyze job'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowPaste((value) => !value)}>
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden />
              {showPaste ? 'Hide paste' : 'Paste description instead'}
            </span>
          </Button>
        </Motion>
      </form>

      {showPaste ? (
        <form
          onSubmit={onPaste}
          className="job-match-expand mx-auto mt-4 max-w-6xl space-y-3 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white to-violet-50/30 p-5 sm:p-6"
        >
          <FieldLabel htmlFor="job-paste">Paste job description</FieldLabel>
          <TextArea id="job-paste" value={paste} onChange={(event) => setPaste(event.target.value)} rows={8} />
          <p className="text-xs text-slate-500">We extract skills only from text you provide — nothing invented.</p>
          <Button type="submit" disabled={analyzing}>
            Extract from pasted text
          </Button>
        </form>
      ) : null}

      {loadingTarget ? <Skeleton className="mx-auto mt-8 h-40 max-w-6xl" /> : null}

      {review ? (
        <Motion
          tag="section"
          className="job-match-review mx-auto mt-8 max-w-6xl space-y-5 rounded-2xl border border-indigo-100/80 bg-white/95 p-5 shadow-sm sm:p-8"
        >
          <h2 className="text-lg font-semibold text-navy-950">Review extracted job</h2>
          <p className="text-sm text-slate-600">
            {review.sourceType === 'url'
              ? 'Values came from the job source. Skills are pulled from the description — edit or refresh anytime.'
              : 'You supplied this description. Confirm title, company, and required skills.'}
          </p>
          {review.sourceUrl ? (
            <p className="break-all text-sm text-slate-600">
              Source:{' '}
              <a className="text-indigo-800 underline decoration-indigo-200" href={review.sourceUrl}>
                {review.sourceUrl}
              </a>
            </p>
          ) : null}
          {review.jobId ? (
            <p className="text-sm text-slate-600">
              Job ID: <span className="font-mono text-navy-950">{review.jobId}</span>
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="company">Company</FieldLabel>
              <TextInput
                id="company"
                value={review.companyName}
                onChange={(event) => {
                  setReview({ ...review, companyName: event.target.value })
                  setSkillsEdited(true)
                }}
              />
            </div>
            <div>
              <FieldLabel htmlFor="title">Job title</FieldLabel>
              <TextInput
                id="title"
                value={review.jobTitle}
                onChange={(event) => {
                  setReview({ ...review, jobTitle: event.target.value })
                  setSkillsEdited(true)
                }}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="description">Job description</FieldLabel>
            <TextArea
              id="description"
              rows={8}
              value={review.description}
              onChange={(event) => {
                setReview({ ...review, description: event.target.value })
                setSkillsEdited(true)
              }}
            />
          </div>

          <Motion className="rounded-xl border border-indigo-100/90 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Required interview skills</p>
                <p className="mt-1 text-sm text-slate-600">Matched against interviewer profiles — add or remove before finding people.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={refreshSkillsFromDescription}>
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Refresh from JD
                </span>
              </Button>
            </div>
            {review.skills.length === 0 ? (
              <p className="mt-3 text-sm text-amber-900">
                No skills detected yet. Edit the description, click <strong>Refresh from JD</strong>, or add skills below.
              </p>
            ) : (
              <div className="job-match-skill-stagger mt-3 flex flex-wrap gap-2">
                {review.skills.map((skill) => (
                  <Chip key={skill} active onClick={() => removeSkill(skill)}>
                    {skill} ×
                  </Chip>
                ))}
              </div>
            )}
            <Motion className="mt-4 flex flex-col gap-2 sm:flex-row">
              <TextInput
                value={review.skillDraft}
                onChange={(event) => setReview({ ...review, skillDraft: event.target.value })}
                placeholder="TypeScript, Machine Learning, System Design…"
                aria-label="Add a required skill"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addSkill()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                Add skill
              </Button>
            </Motion>
          </Motion>

          <Motion className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/50 to-indigo-50/30 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Step 2 — Match your resume to this JD</p>
                <p className="mt-1 text-sm text-slate-600">
                  Upload your resume to get ATS readiness plus skill coverage against this job. Improve gaps, then re-upload.
                </p>
              </div>
              <Link to="/candidate/resume-skills" className="text-sm font-medium text-indigo-800 underline decoration-indigo-200">
                Full resume skills page →
              </Link>
            </div>
            <input
              ref={resumeInputRef}
              type="file"
              accept={RESUME_ACCEPT}
              className="hidden"
              onChange={(event) => void onResumeSelected(event.target.files?.[0] ?? null)}
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" disabled={resumeBusy} onClick={() => resumeInputRef.current?.click()}>
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" aria-hidden />
                  {resumeBusy ? 'Reading resume…' : resumeFileName ? 'Replace resume' : 'Upload resume'}
                </span>
              </Button>
              <Button type="button" variant="ghost" disabled={resumeBusy || !resumeText.trim()} onClick={runResumeChecksFromPaste}>
                Re-check pasted resume
              </Button>
            </div>
            {resumeFileName ? <p className="mt-2 text-xs text-slate-500">Loaded: {resumeFileName}</p> : null}
            <TextArea
              className="mt-3 min-h-28"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value.slice(0, 14_000))}
              placeholder="Or paste resume text here, then click Re-check pasted resume."
            />
            {resumeError ? <p className="mt-2 text-sm text-red-700">{resumeError}</p> : null}
            {atsResult ? <AtsReadinessPanel result={atsResult} className="mt-4" /> : null}
            {jdMatch ? (
              <JdMatchPanel
                result={jdMatch}
                className="mt-4"
                onReupload={() => resumeInputRef.current?.click()}
              />
            ) : null}
          </Motion>

          {findError ? <p className="text-sm text-red-700">{findError}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" disabled={finding || review.skills.length === 0} onClick={() => void loadMatches(1, search)}>
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden />
                {finding ? 'Finding interviewers…' : 'Find interviewers'}
              </span>
            </Button>
            <Button type="button" variant="outline" disabled={finding} onClick={() => void practiceForJob()}>
              Practice for this job
            </Button>
          </div>
        </Motion>
      ) : null}

      {matches ? (
        <section className="job-match-fade-up mx-auto mt-10 max-w-6xl px-4 sm:px-6">
          <Motion className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-navy-950">Interviewers for this job</h2>
              <p className="mt-1 text-sm text-slate-600">
                {matches.total} interviewer{matches.total === 1 ? '' : 's'} with at least one matching job skill, ranked by coverage.
              </p>
            </div>
            <form
              className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                void loadMatches(1, search)
              }}
            >
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search interviewers or skills"
                aria-label="Search interviewers"
              />
              <Button type="submit" variant="outline" disabled={finding}>
                Search
              </Button>
            </form>
          </Motion>

          {finding ? <Skeleton className="mt-6 h-40" /> : null}
          {!finding && matches.results.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={
                  matches.reason === 'no_job_skills'
                    ? 'Add job skills to continue'
                    : matches.reason === 'no_skill_overlap'
                      ? 'No interviewers match these job skills'
                      : 'No interviewers for this search'
                }
                body={
                  matches.reason === 'no_job_skills'
                    ? "We couldn't identify interview skills from this posting. Add the required skills manually to continue."
                    : matches.reason === 'no_skill_overlap'
                      ? 'None of our interviewers list skills that overlap this job. Edit the job skills above (e.g. TypeScript, Machine Learning) or try Browse in Find Interviewer.'
                      : 'No interviewers matched this search. Try a different name or skill keyword.'
                }
              />
            </div>
          ) : null}
          {!finding && matches.results.length > 0 ? (
            <Motion stagger className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {matches.results.map((row) => (
                <JobMatchCard
                  key={row.interviewerProfileId}
                  interviewer={jobMatchToCatalogPerson(row)}
                  skillMatch={jobMatchDetail(row)}
                  listPricePaise={row.listPricePaise}
                  ratingAvg={row.ratingAvg}
                  reviewCount={row.reviewCount}
                />
              ))}
            </Motion>
          ) : null}

          {matches.total > matches.pageSize ? (
            <Motion className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </p>
              <Motion className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={finding || page <= 1}
                  onClick={() => void loadMatches(page - 1, search)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={finding || page >= totalPages}
                  onClick={() => void loadMatches(page + 1, search)}
                >
                  Next
                </Button>
              </Motion>
            </Motion>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Motion({
  className,
  children,
  stagger,
  tag: Tag = 'div',
}: {
  className?: string
  children?: ReactNode
  stagger?: boolean
  tag?: 'div' | 'section'
}) {
  const cls = [className, stagger ? 'job-match-stagger' : 'job-match-fade-up'].filter(Boolean).join(' ')
  return <Tag className={cls}>{children}</Tag>
}
