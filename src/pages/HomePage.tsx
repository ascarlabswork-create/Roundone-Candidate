import { ArrowRight, BadgeCheck, ClipboardCheck, Target } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { COMPANIES, POPULAR_COMPANIES } from '../data/catalogs.ts'
import { CandidateDashboard } from '../components/dashboard/CandidateDashboard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, TextInput } from '../components/ui/primitives.tsx'

const steps = [
  { n: '01', title: 'Share your skills', body: 'Upload a resume or add the skills you want to practice.' },
  { n: '02', title: 'Get matched', body: 'See ranked interviewers with a clear explanation of why they fit.' },
  { n: '03', title: 'Book your interview', body: 'Pick a service, a time slot, and confirm in minutes.' },
  { n: '04', title: 'Improve with feedback', body: 'Leave with scores, notes, and a recommended next interview.' },
]

export function HomePage() {
  const navigate = useNavigate()
  const [targetCompany, setTargetCompany] = useState('')

  function submitGoal(event: FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (targetCompany) params.set('company', targetCompany)
    navigate(`/candidate/find?${params.toString()}`)
  }

  return (
    <div>
      <CandidateDashboard />

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
              Tell us your skills and availability. RoundOne helps you find relevant professionals for
              realistic mock interviews.
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
            <p className="mt-1 text-sm text-slate-600">Start with a company focus, or continue with skills next.</p>
            <form className="mt-6 grid gap-4" onSubmit={submitGoal}>
              <div>
                <FieldLabel htmlFor="home-company">Target Company</FieldLabel>
                <TextInput
                  id="home-company"
                  list="home-company-options"
                  placeholder="e.g. Google, Amazon, Flipkart"
                  value={targetCompany}
                  onChange={(event) => setTargetCompany(event.target.value)}
                />
                <datalist id="home-company-options">
                  {COMPANIES.map((company) => (
                    <option key={company} value={company} />
                  ))}
                </datalist>
              </div>
              <Button type="submit" fullWidth>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </Card>
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
              title: 'Skill-based matching',
              body: 'Ranked matches based on the skills you want to practice.',
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
