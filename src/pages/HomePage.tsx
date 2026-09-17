import { ArrowRight, BadgeCheck, ClipboardCheck, Target } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CANDIDATE_LEVELS,
  COMPANIES,
  INTERVIEW_TYPES,
  POPULAR_COMPANIES,
  TARGET_ROLES,
} from '../data/catalogs.ts'
import { InterviewSummaryCard } from '../components/interviews/InterviewSummaryCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { getCandidateUpcomingInterviews } from '../services/interviewSessions.ts'

const steps = [
  { n: '01', title: 'Tell us your goal', body: 'Share the role, interview type, skills, and when you can meet.' },
  { n: '02', title: 'Get matched', body: 'See ranked interviewers with a clear explanation of why they fit.' },
  { n: '03', title: 'Book your interview', body: 'Pick a service, a time slot, and confirm in minutes.' },
  { n: '04', title: 'Improve with feedback', body: 'Leave with scores, notes, and a recommended next interview.' },
]

export function HomePage() {
  const navigate = useNavigate()
  const upcomingState = useAsync(() => getCandidateUpcomingInterviews(), [])
  const nearest = upcomingState.status === 'success' ? upcomingState.data[0] ?? null : null
  const [goal, setGoal] = useState({
    targetRole: '',
    candidateLevel: '',
    targetCompany: '',
  })

  function submitGoal(event: FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (goal.targetRole) params.set('role', goal.targetRole)
    if (goal.candidateLevel) params.set('level', goal.candidateLevel)
    if (goal.targetCompany) params.set('company', goal.targetCompany)
    navigate(`/candidate/find?${params.toString()}`)
  }

  return (
    <div>
      {nearest ? (
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <h2 className="text-lg font-semibold text-navy-950">Upcoming Interview</h2>
            <div className="mt-4">
              <InterviewSummaryCard interview={nearest} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Mock interviews with working professionals
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl">
              Find the right interviewer
              <span className="block">for your next interview</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Tell us your target role, interview type, skills and availability. RoundOne helps you
              find relevant professionals for realistic mock interviews.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/candidate/find">
                <Button size="lg" fullWidth>
                  Find My Interviewer
                </Button>
              </Link>
              <Link to="/candidate/interviewers">
                <Button size="lg" variant="outline" fullWidth>
                  Browse Interviewers
                </Button>
              </Link>
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-navy-950">What are you preparing for?</h2>
            <p className="mt-1 text-sm text-slate-600">Start with a few details. You can refine matches next.</p>
            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submitGoal}>
              <div>
                <FieldLabel htmlFor="home-role">Target Role</FieldLabel>
                <SelectInput
                  id="home-role"
                  value={goal.targetRole}
                  onChange={(event) => setGoal({ ...goal, targetRole: event.target.value })}
                >
                  <option value="">Select role</option>
                  {TARGET_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="home-level">Target Level</FieldLabel>
                <SelectInput
                  id="home-level"
                  value={goal.candidateLevel}
                  onChange={(event) => setGoal({ ...goal, candidateLevel: event.target.value })}
                >
                  <option value="">Select level</option>
                  {CANDIDATE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="home-company">Target Company</FieldLabel>
                <TextInput
                  id="home-company"
                  list="home-company-options"
                  placeholder="e.g. Google, Amazon, Flipkart"
                  value={goal.targetCompany}
                  onChange={(event) => setGoal({ ...goal, targetCompany: event.target.value })}
                />
                <datalist id="home-company-options">
                  {COMPANIES.map((company) => (
                    <option key={company} value={company} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" fullWidth>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h2 className="text-lg font-semibold text-navy-950">Popular interview categories</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {INTERVIEW_TYPES.map((type) => (
            <Link
              key={type}
              to={`/candidate/interviewers?type=${encodeURIComponent(type)}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-navy-700 hover:text-navy-900"
            >
              {type}
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
          {[
            {
              icon: BadgeCheck,
              title: 'Verified Interviewers',
              body: 'Identity and employment checks so you know who is on the other side of the call.',
            },
            {
              icon: Target,
              title: 'Role-Specific Mock Interviews',
              body: 'Coding, system design, behavioral, ML, product, and data science — matched to your level.',
            },
            {
              icon: ClipboardCheck,
              title: 'Actionable Feedback',
              body: 'Structured scores, written notes, and a recommended next interview. Not a vague “you did well.”',
            },
          ].map((item) => (
            <Card key={item.title} className="p-6">
              <item.icon className="h-6 w-6 text-navy-800" />
              <h3 className="mt-4 text-base font-semibold text-navy-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold text-navy-950">How RoundOne Works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-violet-700">{step.n}</p>
              <h3 className="mt-2 text-base font-semibold text-navy-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold text-navy-950">Interviewers from teams at</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {POPULAR_COMPANIES.map((company) => (
              <div
                key={company}
                className="rounded-lg border border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700"
              >
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
