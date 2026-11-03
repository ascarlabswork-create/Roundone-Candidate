import { CalendarDays, ClipboardCheck, Sparkles, Target } from 'lucide-react'
import { Button } from '../../../ui/Button.tsx'
import { Card } from '../../../ui/primitives.tsx'

const metrics = [
  { label: 'Interviews completed', value: 6, tone: 'from-coral-500 to-sky-500' },
  { label: 'Upcoming interviews', value: 2, tone: 'from-violet-500 to-coral-500' },
  { label: 'Feedback received', value: 5, tone: 'from-mint-500 to-sky-500' },
  { label: 'Practice score avg.', value: '84', tone: 'from-amber-500 to-rose-500' },
]

export function DashboardFilmScene() {
  return (
    <div className="min-h-[720px] studio-grid p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-navy-950 via-[#1e40af] to-violet-700 p-0 text-white shadow-lg">
          <div className="p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back, Alex</h2>
            <p className="mt-2 max-w-xl text-sm text-blue-100">Your next interview, practice score, and action items — same layout as the signed-in app.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button>Find My Interviewer</Button>
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                Start AI Interview
              </Button>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="overflow-hidden p-0">
              <div className={`h-1 bg-gradient-to-r ${metric.tone}`} />
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-navy-950">{metric.value}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: 'AI practice', body: 'Continue your mock loop with scored feedback.' },
            { icon: Target, title: 'Job match', body: 'Practice for a saved target role.' },
            { icon: CalendarDays, title: 'Upcoming mock', body: 'Thu 4:00 PM · System design round.' },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-coral-100 to-violet-100 text-violet-700">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-4 font-semibold text-navy-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.body}</p>
            </Card>
          ))}
        </div>
        <Card className="flex items-center gap-3 p-4">
          <ClipboardCheck className="h-8 w-8 text-emerald-600" aria-hidden />
          <div>
            <p className="font-semibold text-navy-950">Feedback ready</p>
            <p className="text-sm text-slate-600">Your last live mock includes a scorecard and interviewer notes.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
