import { BadgeCheck, Star } from 'lucide-react'
import { Button } from '../../../ui/Button.tsx'
import { Card } from '../../../ui/primitives.tsx'

const interviewers = [
  {
    name: 'Priya Sharma',
    title: 'Staff engineer · FinTech',
    match: 94,
    skills: ['System design', 'Python', 'Leadership'],
    reason: 'Strong overlap with your target stack and senior behavioral rounds.',
  },
  {
    name: 'Marcus Chen',
    title: 'Engineering manager · SaaS',
    match: 89,
    skills: ['React', 'Team leadership', 'Product sense'],
    reason: 'Great fit for cross-functional and “tell me about a conflict” prompts.',
  },
  {
    name: 'Elena Rodriguez',
    title: 'Principal IC · Cloud',
    match: 86,
    skills: ['Distributed systems', 'Go', 'Architecture'],
    reason: 'Deep technical depth for staff-level loops.',
  },
]

export function MatchingFilmScene() {
  return (
    <div className="min-h-[720px] bg-paper p-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Find my interviewer</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy-950">Ranked matches for your role</h2>
        <p className="mt-2 max-w-2xl text-slate-600">See overlap scores and book a live mock with one click.</p>
        <ul className="mt-8 grid gap-4 lg:grid-cols-3">
          {interviewers.map((person, index) => (
            <li key={person.name}>
              <Card
                className={`p-5 transition-shadow ${index === 0 ? 'ring-2 ring-violet-300 shadow-lg shadow-violet-100' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy-950">{person.name}</p>
                    <p className="text-sm text-slate-500">{person.title}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {person.match}%
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {person.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
                      {skill}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{person.reason}</p>
                <div className="mt-4 flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden />
                  ))}
                  <span className="ml-1 text-xs text-slate-500">4.9 · 120+ mocks</span>
                </div>
                <Button className="mt-4 w-full" size="sm">
                  View profile
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
