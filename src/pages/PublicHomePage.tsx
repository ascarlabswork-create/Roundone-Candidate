import { Bot, ClipboardList, FileSearch, Target, Users, Video } from 'lucide-react'
import { ProductDemoShowcase } from '../components/marketing/ProductDemoShowcase.tsx'
import { TestimonialsMarquee } from '../components/marketing/TestimonialsMarquee.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'
import { useAuthModal } from '../state/authModal.tsx'

const steps = [
  { n: '1', title: 'Share your goal', body: 'Resume upload or target job — we learn what to practice.' },
  { n: '2', title: 'Prepare with AI', body: 'Mock questions, prep plans, and skill gaps surfaced early.' },
  { n: '3', title: 'Book a live round', body: 'Match with a professional and join a real-time video mock.' },
  { n: '4', title: 'Improve with feedback', body: 'Scores and notes you can reuse before the next interview.' },
]

const features = [
  { icon: Bot, title: 'AI mock interviews', body: 'Timed practice with written feedback.' },
  { icon: Target, title: 'Job-specific preparation', body: 'Align sessions with a posting or company.' },
  { icon: FileSearch, title: 'Resume skill analysis', body: 'Skills extracted from what you actually wrote.' },
  { icon: Users, title: 'Interviewer matching', body: 'Ranked fits with clear overlap reasons.' },
  { icon: Video, title: 'Live video mocks', body: 'One-to-one sessions with working professionals.' },
  { icon: ClipboardList, title: 'Performance tracking', body: 'History, scores, and progress over time.' },
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
            <p className="inline-flex rounded-full border border-coral-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-coral-700">
              Interview preparation platform
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#101c35] sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Your next interview starts with confidence.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Prepare with AI-powered mock interviews, connect with experienced professionals, and build the confidence
              to succeed in your next opportunity.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => openAuth('register')}>
                Start preparing
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
            <p className="text-sm font-semibold text-coral-600">Platform demo</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">See how JobRound.ai works</h2>
            <p className="mt-3 text-slate-600">A guided tour of AI practice, matching, booking, and feedback — built from the real product.</p>
          </div>
          <div className="mt-10">
            <ProductDemoShowcase />
          </div>
        </div>
      </section>

      <section id="quote" className="scroll-mt-24 border-b border-black/[0.05] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold text-coral-600">Career growth</p>
          <blockquote className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-[#101c35] sm:text-3xl sm:leading-tight">
            Don&apos;t just prepare for interviews. Experience them, practise them, and improve with every conversation.
          </blockquote>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600">
            Confidence comes from repetition with structure — the same pressure as a hiring loop, with room to learn
            before it counts.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-b border-black/[0.05] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold text-coral-600">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Four steps to a stronger round</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <Card key={step.n} className="border-black/[0.06] bg-[#fafbfc] p-5 shadow-none">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-coral-600 text-sm font-bold text-white">
                  {step.n}
                </span>
                <h3 className="mt-4 font-semibold text-navy-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-b border-black/[0.05] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold text-coral-600">Features</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Built for serious preparation</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <Card key={item.title} className="p-5 transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(16,28,53,0.35)]">
                <item.icon className="h-6 w-6 text-coral-600" aria-hidden />
                <h3 className="mt-4 font-semibold text-navy-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="scroll-mt-24 border-b border-black/[0.05] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-coral-600">By role</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">How different tracks use JobRound.ai</h2>
            <p className="mt-3 text-slate-600">Stories grouped by role — no individual names, just the kind of preparation each track needs.</p>
          </div>
          <div className="mt-10">
            <TestimonialsMarquee />
          </div>
        </div>
      </section>

      <section id="get-started" className="scroll-mt-24 bg-[#101c35] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your next opportunity deserves better preparation.</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">Start practising with AI and learn from real interview experiences.</p>
          <Button size="lg" className="mt-8 bg-white text-[#101c35] hover:bg-slate-100" onClick={() => openAuth('register')}>
            Get started
          </Button>
          <p className="mt-6 text-sm text-slate-400">
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
