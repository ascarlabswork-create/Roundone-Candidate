import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, PageHeader } from '../components/ui/primitives.tsx'
import { INTERVIEW_TYPES } from '../data/catalogs.ts'
import { useSession } from '../state/session.tsx'

export function InterviewTypesPage() {
  const copy: Record<string, string> = {
    Coding: 'Data structures, algorithms, and follow-ups on complexity.',
    'System Design': 'APIs, storage, trade-offs, and capacity for SDE 2 through Staff.',
    Behavioral: 'Leadership, conflict, and scope — scored like a real hiring loop.',
    'Machine Learning': 'Modeling, evaluation, and ML system design.',
    Product: 'Product sense, metrics, and execution interviews.',
    'Data Science': 'SQL, experiments, and case-style product questions.',
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader title="Interview Types" subtitle="Pick a format, then find an interviewer who actually runs that loop." />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {INTERVIEW_TYPES.map((type) => (
          <Card key={type} className="p-5">
            <h2 className="font-semibold text-navy-950">{type}</h2>
            <p className="mt-2 text-sm text-slate-600">{copy[type]}</p>
            <Link to={`/candidate/interviewers?type=${encodeURIComponent(type)}`} className="mt-4 inline-block">
              <Button size="sm">Browse {type} interviewers</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ResourcesPage() {
  const items = [
    { title: 'How to structure a 45-minute system design', type: 'Guide' },
    { title: 'A scorecard you can reuse after every mock', type: 'Template' },
    { title: 'What “SDE 2 bar” usually means', type: 'Article' },
    { title: 'Turning feedback into a two-week plan', type: 'Guide' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader title="Resources" subtitle="Short reads for candidates preparing with jobround.ai." />
      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <Card key={item.title} className="p-5">
            <p className="text-xs font-medium text-coral-700">{item.type}</p>
            <h2 className="mt-1 font-semibold text-navy-950">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Placeholder content for the candidate prototype. Replace with CMS or MDX later.
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function HowItWorksPage() {
  const { status } = useSession()
  const steps = [
    {
      n: '01',
      title: 'Tell us what you are practicing',
      body: 'Skills, a target company, or a job posting — enough signal to rank the right interviewer.',
    },
    {
      n: '02',
      title: 'Pick someone who has run that loop',
      body: 'See why they match, compare a few, and book a 45-minute live session.',
    },
    {
      n: '03',
      title: 'Sit the round like it is real',
      body: 'Video, shared context, and the same pressure you will feel when the company is watching.',
    },
    {
      n: '04',
      title: 'Leave with a scorecard',
      body: 'Scores, notes, and a recommended next mock. Then practice with AI between live rounds.',
    },
  ]

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-coral-700">How it works</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">
          Four steps from “I should practice” to a round you can reuse.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          jobround.ai is a mock-interview studio. You are not hunting jobs here — you are warming up with people who
          already hire.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <Card key={step.n} className="p-6">
              <p className="font-mono text-sm font-semibold text-gold-500">{step.n}</p>
              <h2 className="mt-3 text-xl font-semibold text-navy-950">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/candidate/find">
            <Button>Find my interviewer</Button>
          </Link>
          {status === 'authenticated' ? null : (
            <Link to="/candidate/register">
              <Button variant="outline">Create an account</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-navy-950">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">That route is not part of the candidate website.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/">
          <Button variant="outline">Home</Button>
        </Link>
        <Link to="/candidate/find">
          <Button>Find My Interviewer</Button>
        </Link>
      </div>
    </div>
  )
}
