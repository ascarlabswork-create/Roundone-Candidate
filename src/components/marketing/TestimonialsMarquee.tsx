import { CANDIDATE_LEVELS, TARGET_ROLES } from '../../data/catalogs.ts'

type RoleStory = {
  role: string
  focus: string
  quote: string
  tone: string
}

const stories: RoleStory[] = [
  {
    role: 'Software Engineer',
    focus: 'Coding & system design',
    quote:
      'Practising with a structured scorecard helped me see where my explanations broke down before the real loop.',
    tone: 'bg-sky-100 text-sky-800',
  },
  {
    role: 'Backend Engineer',
    focus: 'SDE 2 bar',
    quote: 'Matching on skills meant my mock felt like the teams I was actually interviewing with.',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  {
    role: 'Product Manager',
    focus: 'Behavioral & product sense',
    quote: 'AI practice between live mocks kept my stories tight — less rambling, more signal.',
    tone: 'bg-violet-100 text-violet-800',
  },
  {
    role: 'Data Scientist',
    focus: 'Case & ML interviews',
    quote: 'Job-specific prep pulled the right topics from the posting instead of generic question lists.',
    tone: 'bg-amber-100 text-amber-900',
  },
  {
    role: 'Frontend Engineer',
    focus: 'New grad loop',
    quote: 'Booking a 45-minute live round felt closer to reality than reading interview blogs alone.',
    tone: 'bg-rose-100 text-rose-800',
  },
  {
    role: 'Engineering Manager',
    focus: 'Leadership interviews',
    quote: 'Feedback after each session gave me a clear “practice again on X” instead of vague encouragement.',
    tone: 'bg-coral-100 text-coral-800',
  },
]

function initials(role: string) {
  return role
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function StoryCard({ item }: { item: RoleStory }) {
  return (
    <figure className="flex h-full w-[min(100%,22rem)] shrink-0 flex-col rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_20px_50px_-36px_rgba(16,28,53,0.35)] sm:w-[22rem]">
      <span className="text-4xl font-serif leading-none text-navy-950/20" aria-hidden>
        &ldquo;
      </span>
      <blockquote className="mt-2 flex-1 text-[15px] leading-7 text-slate-700">{item.quote}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-black/[0.06] pt-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.tone}`}
          aria-hidden
        >
          {initials(item.role)}
        </span>
        <div>
          <p className="text-sm font-semibold text-navy-950">{item.role}</p>
          <p className="text-xs text-slate-500">{item.focus}</p>
        </div>
      </figcaption>
    </figure>
  )
}

export function TestimonialsMarquee() {
  const track = [...stories, ...stories]

  return (
    <div className="relative overflow-hidden">
      <p className="sr-only">
        Illustrative preparation stories by role. Roles reflect common tracks on JobRound.ai (
        {TARGET_ROLES.slice(0, 3).join(', ')}, and more). Levels include {CANDIDATE_LEVELS.slice(0, 4).join(', ')}.
      </p>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#f5f7fa] to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#f5f7fa] to-transparent sm:w-24" />
      <div className="testimonial-marquee flex w-max gap-4 py-2">
        {track.map((item, index) => (
          <StoryCard key={`${item.role}-${index}`} item={item} />
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Role-based illustrations for design — not attributed to individual customers.
      </p>
    </div>
  )
}
