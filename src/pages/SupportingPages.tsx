import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, PageHeader } from '../components/ui/primitives.tsx'
import { INTERVIEW_TYPES } from '../data/catalogs.ts'

export function PracticePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        title="AI Practice"
        subtitle="A self-paced workspace for warm-ups. Matching and live mocks still happen with a human interviewer — this screen is a static prototype, not a live model."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {INTERVIEW_TYPES.map((type) => (
          <Card key={type} className="p-5">
            <h2 className="font-semibold text-navy-950">{type} drill</h2>
            <p className="mt-2 text-sm text-slate-600">
              Timed prompts, a notes pane, and a recap checklist. Connect an LLM later without changing this layout.
            </p>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Practice session placeholder</div>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <Link to="/candidate/find">
          <Button>Find a human interviewer instead</Button>
        </Link>
      </div>
    </div>
  )
}

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
      <PageHeader title="Resources" subtitle="Short reads for candidates preparing with RoundOne." />
      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <Card key={item.title} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.type}</p>
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

export function NotificationsPage() {
  const notes = [
    { title: 'Rahul Sharma confirmed Saturday 7:00 PM', body: 'Join from My Interviews 10 minutes early.' },
    { title: 'Feedback ready from Marcus Chen', body: 'Your system design scorecard is available.' },
    { title: 'Reminder: Fatima Khan coding mock next week', body: 'Add it to your calendar if you have not already.' },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader title="Notifications" subtitle="Booking updates, feedback, and reminders." />
      <div className="mt-8 space-y-3">
        {notes.map((note) => (
          <Card key={note.title} className="p-5">
            <h2 className="font-semibold text-navy-950">{note.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{note.body}</p>
          </Card>
        ))}
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
