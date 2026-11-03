import { Bot, ClipboardList, FileSearch, Target, Users, Video } from 'lucide-react'
import { ProductDemoShowcase } from '../components/marketing/ProductDemoShowcase.tsx'
import { TestimonialsMarquee } from '../components/marketing/TestimonialsMarquee.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'
import { useAuthModal } from '../state/authModal.tsx'
import { cn } from '../lib/cn.ts'

const steps = [
  { n: '1', title: 'Share your goal', body: 'Resume upload or target job — we learn who you should practice with.', tone: 'from-coral-500 to-sky-500' },
  { n: '2', title: 'Book a live human round', body: 'Match with a professional and join a real-time video mock interview.', tone: 'from-sky-500 to-mint-500' },
  { n: '3', title: 'Practice with AI', body: 'Between bookings, sharpen answers with AI mocks and prep plans.', tone: 'from-violet-500 to-coral-500' },
  { n: '4', title: 'Improve with feedback', body: 'Scores and notes you can reuse before the next interview.', tone: 'from-amber-500 to-rose-500' },
]

const features = [
  { icon: Video, title: 'Live human mock interviews', body: 'One-to-one video sessions with working professionals.', iconBg: 'bg-rose-50 text-rose-500', ring: 'ring-rose-100' },
  { icon: Users, title: 'Interviewer matching', body: 'Ranked fits with clear skill-overlap reasons.', iconBg: 'bg-mint-50 text-mint-600', ring: 'ring-emerald-100' },
  { icon: Target, title: 'Job-specific preparation', body: 'Align sessions with a posting or company.', iconBg: 'bg-coral-100 text-coral-600', ring: 'ring-coral-100' },
  { icon: FileSearch, title: 'Resume skill analysis', body: 'Skills extracted from what you actually wrote.', iconBg: 'bg-sky-100 text-sky-600', ring: 'ring-sky-100' },
  { icon: Bot, title: 'AI mock interviews', body: 'Timed practice with written feedback between live rounds.', iconBg: 'bg-violet-100 text-violet-600', ring: 'ring-violet-100' },
  { icon: ClipboardList, title: 'Performance tracking', body: 'History, scores, and progress over time.', iconBg: 'bg-amber-50 text-amber-500', ring: 'ring-amber-100' },
]

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function PublicHomePage() {
  const { openAuth } = useAuthModal()

  return (
    <div className="public-surface text-[#1d1d1f]">
      <section id="home" className="public-hero scroll-mt-24 border-b border-black/[0.05]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex rounded-full border border-violet-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 shadow-sm">
              Live mock interviews with professionals
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#101c35] sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Your next interview starts with{' '}
              <span className="text-gradient-brand">confidence.</span>
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Book live mock interviews with experienced professionals first — then use AI practice and feedback to keep
              improving between rounds.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => openAuth('register')}>
                Book a mock interview
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToId('demo')}>
                Watch the demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="scroll-mt-24 border-b border-black/[0.05] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-violet-600">Platform demo</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">See how JobRound.ai works</h2>
            <p className="mt-3 text-slate-600">
              Auto-playing walkthrough with zoom — live human booking first, then matching, AI practice, and feedback.
            </p>
          </div>
          <div className="mt-10">
            <ProductDemoShowcase />
          </div>
        </div>
      </section>

      <section id="quote" className="public-section-quote scroll-mt-24 border-b border-black/[0.05] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 shadow-sm">
            Career growth
          </p>
          <blockquote className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 px-6 py-10 text-left shadow-[0_28px_70px_-36px_rgba(79,70,229,0.45)] sm:px-12 sm:py-12 sm:text-center">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-coral-500 via-violet-500 to-sky-400"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-400/20 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-sky-400/20 blur-3xl"
              aria-hidden
            />
            <p className="relative text-2xl font-bold leading-snug tracking-tight text-[#101c35] sm:text-3xl sm:leading-tight">
              Don&apos;t just prepare for interviews.{' '}
              <span className="text-gradient-brand">Experience them, practice them,</span> and improve with every
              conversation.
            </p>
          </blockquote>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600">
            Confidence comes from repetition with structure — live human rounds first, then focused practice before it
            counts.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-b border-black/[0.05] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold text-coral-600">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Four steps to a stronger round</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <Card key={step.n} className="overflow-hidden border-black/[0.06] p-0 shadow-none">
                <div className={cn('h-1.5 bg-gradient-to-r', step.tone)} />
                <div className="p-5">
                  <span
                    className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white',
                      step.tone,
                    )}
                  >
                    {step.n}
                  </span>
                  <h3 className="mt-4 font-semibold text-navy-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="public-section-sky scroll-mt-24 border-b border-black/[0.05] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold text-sky-600">Features</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Built for serious preparation</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <Card
                key={item.title}
                className={cn('p-5 ring-2 ring-inset transition hover:-translate-y-0.5 hover:shadow-lg', item.ring)}
              >
                <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', item.iconBg)}>
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-navy-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="public-section-mint scroll-mt-24 border-b border-black/[0.05] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-mint-600">By role</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">How different tracks use JobRound.ai</h2>
            <p className="mt-3 text-slate-600">Stories grouped by role — no individual names, just the kind of preparation each track needs.</p>
          </div>
          <div className="mt-10">
            <TestimonialsMarquee />
          </div>
        </div>
      </section>

      <section id="get-started" className="public-cta-gradient scroll-mt-24 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your next opportunity deserves better preparation.</h2>
          <p className="mt-4 text-base leading-7 text-blue-100">
            Book a live mock with a real interviewer, then sharpen with AI practice between sessions.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-white text-violet-700 shadow-lg hover:bg-violet-50"
            onClick={() => openAuth('register')}
          >
            Book a mock interview
          </Button>
          <p className="mt-6 text-sm text-blue-200/90">
            Already have an account?{' '}
            <button type="button" className="font-semibold text-white underline underline-offset-2" onClick={() => openAuth('login')}>
              Sign in
            </button>
          </p>
        </div>
      </section>
    </div>
  )
}
