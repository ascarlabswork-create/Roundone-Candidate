import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { JobMatchCard } from '../components/interviewer/JobMatchCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState, FieldLabel, PageHeader, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { dedupeSkills } from '../matching/skills.ts'
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

function draftFromAnalysis(analysis: JobAnalysis, jobId: string): ReviewDraft {
  return {
    companyName: analysis.companyName ?? '',
    jobTitle: analysis.jobTitle ?? '',
    description: analysis.description ?? '',
    skills: analysis.skills,
    skillDraft: '',
    sourceUrl: analysis.sourceUrl,
    sourceType: analysis.sourceType,
    jobId: analysis.jobId ?? jobId,
  }
}

function draftFromTarget(target: JobTarget): ReviewDraft {
  return {
    companyName: target.companyName ?? '',
    jobTitle: target.jobTitle ?? '',
    description: target.description ?? '',
    skills: target.skills,
    skillDraft: '',
    sourceUrl: target.sourceUrl,
    sourceType: target.sourceType,
    jobId: target.jobId ?? '',
  }
}

export function JobMatchPage() {
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

  useEffect(() => {
    if (!targetId) return
    let cancelled = false
    setLoadingTarget(true)
    getJobTarget(targetId)
      .then((target) => {
        if (cancelled || !target) return
        setReview(draftFromTarget(target))
        setSavedId(target.id)
        setSkillsEdited(true)
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

  function addSkill() {
    if (!review) return
    const next = dedupeSkills([...review.skills, review.skillDraft])
    setReview({ ...review, skills: next, skillDraft: '' })
    setSkillsEdited(true)
  }

  function removeSkill(skill: string) {
    if (!review) return
    setReview({ ...review, skills: review.skills.filter((item) => item !== skill) })
    setSkillsEdited(true)
  }

  async function loadMatches(nextPage: number, nextSearch: string) {
    if (!review) return
    if (review.skills.length === 0) {
      setFindError("We couldn't identify interview skills from this posting. Add the required skills manually to continue.")
      return
    }
    setFinding(true)
    setFindError('')
    try {
      await saveReviewed(review, 'ready')
      const result = await matchInterviewersForJob({
        skills: review.skills,
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Job-based discovery"
        title="Find an Interviewer for a Job"
        subtitle="Paste a public job URL. RoundOne reads the posting, then ranks interviewers by how well their skills cover that job."
      />

      <form onSubmit={onAnalyze} className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-navy-950">Find an interviewer for a job</h2>
        <div>
          <FieldLabel htmlFor="job-url">Job URL</FieldLabel>
          <TextInput
            id="job-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/jobs/123"
            required={!showPaste}
          />
        </div>
        <div>
          <FieldLabel htmlFor="job-id">Job ID (optional)</FieldLabel>
          <TextInput id="job-id" value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="Optional" />
        </div>
        {analyzeError ? <p className="text-sm text-red-700">{analyzeError}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={analyzing}>
            {analyzing ? 'Analyzing job...' : 'Analyze Job'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowPaste((value) => !value)}>
            Paste Job Description
          </Button>
        </div>
      </form>

      {showPaste ? (
        <form onSubmit={onPaste} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <FieldLabel htmlFor="job-paste">Paste Job Description</FieldLabel>
          <TextArea id="job-paste" value={paste} onChange={(event) => setPaste(event.target.value)} rows={8} />
          <p className="text-xs text-slate-500">This description is entered by you. It is not claimed to come from a job URL.</p>
          <Button type="submit" disabled={analyzing}>
            Continue
          </Button>
        </form>
      ) : null}

      {analyzing ? <p className="mt-6 text-sm font-medium text-navy-950">Analyzing job...</p> : null}
      {loadingTarget ? <Skeleton className="mt-6 h-40" /> : null}

      {review ? (
        <section className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-950">Review extracted job</h2>
          <p className="text-sm text-slate-600">
            {review.sourceType === 'url'
              ? 'These values were extracted from the job source. You can correct them before matching.'
              : 'You supplied this description. Add the company, title, and skills you want matched.'}
          </p>
          {review.sourceUrl ? (
            <p className="break-all text-sm text-slate-600">
              Source URL: <a className="text-blue-700" href={review.sourceUrl}>{review.sourceUrl}</a>
            </p>
          ) : null}
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
          <div>
            <p className="text-sm font-medium text-navy-950">Required interview skills</p>
            {review.skills.length === 0 ? (
              <p className="mt-2 text-sm text-red-700">
                We couldn't identify interview skills from this posting. Add the required skills manually to continue.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {review.skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-navy-950"
                    onClick={() => removeSkill(skill)}
                  >
                    {skill} <span className="text-slate-500">Remove</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <TextInput
                value={review.skillDraft}
                onChange={(event) => setReview({ ...review, skillDraft: event.target.value })}
                placeholder="Add a skill"
                aria-label="Add a required skill"
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                Add skill
              </Button>
            </div>
          </div>
          {findError ? <p className="text-sm text-red-700">{findError}</p> : null}
          <Button type="button" disabled={finding || review.skills.length === 0} onClick={() => void loadMatches(1, search)}>
            {finding ? 'Finding interviewers...' : 'Find Interviewers'}
          </Button>
        </section>
      ) : null}

      {matches ? (
        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-navy-950">Interviewers for this Job</h2>
              <p className="mt-1 text-sm text-slate-600">
                {matches.total} interviewer{matches.total === 1 ? '' : 's'} ranked by job skill coverage.
                {matches.total === 0 ? ' No matching skills found does not mean no interviewers exist.' : ''}
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
          </div>

          {finding ? <Skeleton className="mt-6 h-40" /> : null}
          {!finding && matches.results.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={matches.reason === 'no_job_skills' ? 'Add job skills to continue' : 'No interviewers for this search'}
                body={
                  matches.reason === 'no_job_skills'
                    ? "We couldn't identify interview skills from this posting. Add the required skills manually to continue."
                    : 'No interviewers matched this search. Coverage can be 0% and those interviewers still appear when the search is empty.'
                }
              />
            </div>
          ) : null}
          {!finding && matches.results.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
            </div>
          ) : null}

          {matches.total > matches.pageSize ? (
            <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
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
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
