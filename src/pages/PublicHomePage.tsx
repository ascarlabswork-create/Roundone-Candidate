import {
  BadgeCheck,
  Bot,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSearch,
  MessageSquare,
  Sparkles,
  Target,
  Users,
  Video,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ProductDemoShowcase } from '../components/marketing/ProductDemoShowcase.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'
import { useAuthModal } from '../state/authModal.tsx'
import { cn } from '../lib/cn.ts'

const steps = [
  { n: '1', title: 'Upload your resume or select a target job', body: 'Tell us what you are preparing for.' },
  { n: '2', title: 'Discover skills and prepare with AI', body: 'Practice questions and prep tailored to your goals.' },
  { n: '3', title: 'Connect with experienced interviewers', body: 'Match on skills and book a live mock.' },
  { n: '4', title: 'Practise, receive feedback, and improve', body: 'Scorecards and notes for your next round.' },
]

const features = [
  { icon: Bot, title: 'AI Mock Interviews', body: 'Timed practice with generated questions and written feedback.' },
  { icon: Target, title: 'Job-Specific Preparation', body: 'Align prep with a posting or target company.' },
  { icon: FileSearch, title: 'Resume-Based Skill Analysis', body: 'Extract skills from your resume for matching and practice.' },
  { icon: Users, title: 'Interviewer Matching', body: 'Ranked professionals with clear skill overlap.' },
  { icon: Video, title: 'Live 1-to-1 Video Interviews', body: 'Real-time mocks with working professionals.' },
  { icon: ClipboardList, title: 'Interview Feedback and Performance Tracking', body: 'History, scores, and progress over time.' },
]

const sampleTestimonials = [
  {
    quote: 'Sample quote for development only — replace with approved customer testimonials before launch.',
    name: 'Sample candidate',
    role: 'Software engineer',
  },
  {
    quote: 'Another placeholder testimonial. Do not publish fabricated reviews in production.',
    name: 'Sample candidate',
    role: 'Product manager',
  },
  {
    quote: 'Structure preview for a future testimonial carousel.',
    name: 'Sample candidate',
    role: 'Data analyst',
  },
]

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function PublicHomePage() {
  const { openAuth } = useAuthModal()
  const [testimonialIndex, setTestimonialIndex] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setTestimonialIndex((i) => (i + 1) % sampleTestimonials.length)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [])

  const testimonial = sampleTestimonials[testimonialIndex]

  return (
    <div className="bg-[#f5f7fa] text-[#1d1d1f]">
      <section id="home" className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-20">
          <div className="order-1 lg:order-1">
            <ProductDemoShowcase />
          </div>
          <div className="order-2 lg:order-2">
            <p className="text-sm font-semibold text-coral-600">For candidates</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#101c35] sm:text-5xl sm:leading-[1.08]">
              Your Next Interview Starts With Confidence.
            </h1>
            <blockquote className="mt-5 border-l-4 border-coral-600 pl-4 text-base font-medium leading-relaxed text-[#101c35] sm:text-lg">
              Don&apos;t just prepare for interviews. Experience them, practise them, and improve with every conversation.
            </blockquote>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Prepare with AI-powered mock interviews, connect with experienced professionals, and build the confidence to
              succeed in your next opportunity.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" fullWidth className="sm:w-auto" onClick={() => openAuth('register')}>
                Start Preparing
              </Button>
              <Button
                size="lg"
                variant="outline"
                fullWidth
                className="sm:w-auto"
                onClick={() => scrollToId('features')}
              >
                Explore Features
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-b border-black/[0.06] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold text-coral-600">How JobRound.ai works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Four steps to a stronger round</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <Card key={step.n} className="p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-coral-50 text-sm font-bold text-coral-700">
                  {step.n}
                </span>
                <h3 className="mt-4 font-semibold text-navy-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-b border-black/[0.06] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold text-coral-600">Our features</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Everything you need to prepare</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Capabilities available in the candidate app today.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <Card key={item.title} className="p-5">
                <item.icon className="h-6 w-6 text-coral-600" aria-hidden />
                <h3 className="mt-4 font-semibold text-navy-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="for-candidates" className="scroll-mt-24 border-b border-black/[0.06] py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold text-coral-600">AI interview preparation</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Practise questions. Improve weak areas.</h2>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" />
                Run AI mock interviews with scored feedback.
              </li>
              <li className="flex gap-2">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" />
                Review answers and notes after each session.
              </li>
              <li className="flex gap-2">
                <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" />
                Prepare from job requirements and your skill profile.
              </li>
            </ul>
            <Button className="mt-8" onClick={() => openAuth('register', '/candidate/practice')}>
              Try AI Practice
            </Button>
          </div>
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
            <p className="mt-3 text-lg font-semibold text-navy-950">AI Practice report</p>
            <p className="mt-2 text-sm text-slate-600">Average score · question breakdown · suggested next topics.</p>
            <div className="mt-6 h-2 rounded-full bg-[#f5f7fa]">
              <div className="h-2 w-3/4 rounded-full bg-coral-600" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Available after sign-in at /candidate/practice</p>
          </Card>
        </div>
      </section>

      <section id="human-interviews" className="scroll-mt-24 border-b border-black/[0.06] bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <Card className="order-2 p-6 lg:order-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-navy-950 text-center text-sm font-bold leading-[3rem] text-white">
                Pro
              </div>
              <div>
                <p className="font-semibold text-navy-950">Interviewer profile</p>
                <p className="text-sm text-slate-600">Skills · experience · availability</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                Verification badges shown only when checks are completed in the product.
              </li>
              <li>Skill-based matching and flexible booking.</li>
              <li>Live video interviews in the app.</li>
            </ul>
          </Card>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold text-coral-600">Real human interview experience</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Learn from people who hire</h2>
            <p className="mt-4 text-slate-600 leading-7">
              Browse professionals, compare skill fit, and book a live mock — the same format as a real hiring loop,
              with feedback you can act on.
            </p>
            <Button className="mt-8" variant="outline" onClick={() => openAuth('register', '/candidate/find')}>
              Find an interviewer
            </Button>
          </div>
        </div>
      </section>

      <section id="testimonials" className="scroll-mt-24 border-b border-black/[0.06] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold text-coral-600">Testimonials</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#101c35]">Candidate stories</h2>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-700">
            Development placeholders — not real customer quotes
          </p>
          <figure className="mt-8 rounded-2xl border border-black/[0.08] bg-white p-8 shadow-sm">
            <blockquote className="text-lg leading-relaxed text-slate-700">&ldquo;{testimonial.quote}&rdquo;</blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-navy-950">
              {testimonial.name}
              <span className="font-normal text-slate-500"> · {testimonial.role}</span>
            </figcaption>
          </figure>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Previous testimonial"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] hover:bg-white"
              onClick={() => setTestimonialIndex((i) => (i - 1 + sampleTestimonials.length) % sampleTestimonials.length)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {sampleTestimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to testimonial ${i + 1}`}
                className={cn('h-2 w-2 rounded-full', i === testimonialIndex ? 'bg-coral-600' : 'bg-slate-300')}
                onClick={() => setTestimonialIndex(i)}
              />
            ))}
            <button
              type="button"
              aria-label="Next testimonial"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] hover:bg-white"
              onClick={() => setTestimonialIndex((i) => (i + 1) % sampleTestimonials.length)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <section id="get-started" className="scroll-mt-24 bg-[#101c35] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your Next Opportunity Deserves Better Preparation.</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Start practising with AI and learn from real interview experiences.
          </p>
          <Button size="lg" className="mt-8" onClick={() => openAuth('register')}>
            Get Started
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
