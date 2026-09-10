import { Bookmark, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getInterviewer, listReviews } from '../api/index.ts'
import { MatchReasonList } from '../components/interviewer/InterviewerCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar, MatchScore, StarRating, VerifiedBadge } from '../components/ui/identity.tsx'
import { getNextSlot, isVerified } from '../data/interviewers.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { formatSlot } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { scoreInterviewer } from '../matching/index.ts'
import { useBookingDraft } from '../state/booking.tsx'
import { useMatching } from '../state/matching.tsx'
import { useSavedInterviewers } from '../state/saved.tsx'
import { useToast } from '../state/toast.tsx'
import type { Interviewer } from '../types.ts'

const tabs = ['About', 'Expertise', 'Services', 'Availability', 'Reviews'] as const

export function ProfilePage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const fromMatches = params.get('from') === 'matches'
  const interviewerState = useAsync(() => getInterviewer(id), [id])
  const reviewsState = useAsync(() => listReviews(id), [id])
  const { preferences } = useMatching()
  const { isSaved, toggleSaved } = useSavedInterviewers()
  const { pushToast } = useToast()
  const { resetDraft } = useBookingDraft()
  const [tab, setTab] = useState<(typeof tabs)[number]>('About')

  if (interviewerState.status === 'loading') {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (interviewerState.status === 'error') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ErrorState body={interviewerState.error} />
      </div>
    )
  }

  const interviewer = interviewerState.data
  const match = preferences ? scoreInterviewer(interviewer, preferences) : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Card className="p-5 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <Avatar src={interviewer.photo} name={interviewer.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-navy-950">{interviewer.name}</h1>
              {isVerified(interviewer) ? <VerifiedBadge /> : null}
              {fromMatches && match ? <MatchScore score={match.score} /> : null}
            </div>
            <p className="mt-1 text-slate-600">
              {interviewer.currentRole} @ {interviewer.company}
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{interviewer.experienceYears}+ years experience</span>
              <span>{formatCount(interviewer.completedInterviews)} interviews</span>
              <span className="inline-flex items-center gap-1">
                <StarRating value={interviewer.rating} />
                {interviewer.rating} ({formatCount(interviewer.reviewCount)} reviews)
              </span>
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to={`/candidate/interviewers/${interviewer.id}/book`}>
                <Button
                  fullWidth
                  onClick={() => resetDraft(interviewer.id)}
                >
                  Book Interview
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => pushToast('Messaging will be available after the interviewer accepts. Prototype only.')}
              >
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
                <Button
                variant={isSaved(interviewer.id) ? 'secondary' : 'ghost'}
                onClick={() => {
                  const currentlySaved = isSaved(interviewer.id)
                  toggleSaved(interviewer.id)
                  pushToast(currentlySaved ? 'Removed from saved' : 'Saved interviewer')
                }}
              >
                <Bookmark className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        </div>
        {fromMatches && match ? (
          <div className="mt-6 rounded-lg bg-violet-50 p-4">
            <p className="mb-2 text-sm font-semibold text-violet-800">Why this interviewer matches</p>
            <MatchReasonList reasons={match.reasons} />
          </div>
        ) : null}
      </Card>

      <div className="mt-6 overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                tab === item
                  ? 'border-navy-950 text-navy-950'
                  : 'border-transparent text-slate-500 hover:text-navy-800'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="py-6">
        {tab === 'About' ? <AboutTab interviewer={interviewer} /> : null}
        {tab === 'Expertise' ? <ExpertiseTab interviewer={interviewer} /> : null}
        {tab === 'Services' ? <ServicesTab interviewer={interviewer} /> : null}
        {tab === 'Availability' ? <AvailabilityTab interviewer={interviewer} /> : null}
        {tab === 'Reviews' ? (
          reviewsState.status === 'success' ? (
            reviewsState.data.length ? (
              <div className="space-y-4">
                {reviewsState.data.map((review) => (
                  <Card key={review.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-navy-950">{review.candidateName}</p>
                      <StarRating value={review.rating} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {review.interviewType} · {review.date}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{review.text}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No reviews yet" body="Be the first candidate to leave a review after your session." />
            )
          ) : reviewsState.status === 'error' ? (
            <ErrorState body={reviewsState.error} />
          ) : (
            <Skeleton className="h-40" />
          )
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
        <Link to={`/candidate/interviewers/${interviewer.id}/book`}>
          <Button fullWidth>Book Interview</Button>
        </Link>
      </div>
    </div>
  )
}

function AboutTab({ interviewer }: { interviewer: Interviewer }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="p-5 md:col-span-2">
        <h2 className="text-base font-semibold text-navy-950">Professional summary</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">{interviewer.bio}</p>
      </Card>
      <Card className="p-5">
        <h2 className="text-base font-semibold text-navy-950">Verification</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className={interviewer.verification.identity ? 'text-emerald-700' : 'text-slate-400'}>
            Identity Verified
          </li>
          <li className={interviewer.verification.employment ? 'text-emerald-700' : 'text-slate-400'}>
            Employment Verified
          </li>
          <li className={interviewer.verification.linkedin ? 'text-emerald-700' : 'text-slate-400'}>
            LinkedIn Verified
          </li>
        </ul>
        <h3 className="mt-6 text-sm font-semibold text-navy-950">Work experience</h3>
        <p className="mt-2 text-sm text-slate-700">
          {interviewer.company}
          {interviewer.previousCompanies.length ? ` · ${interviewer.previousCompanies.join(' · ')}` : ''}
        </p>
      </Card>
    </div>
  )
}

function ExpertiseTab({ interviewer }: { interviewer: Interviewer }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold text-navy-950">Expertise</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...interviewer.skills, ...interviewer.technologies].map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold text-navy-950">Interview Types</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {interviewer.interviewTypes.map((item) => (
            <Badge key={item} tone="blue">
              {item}
            </Badge>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold text-navy-950">Suitable Levels</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {interviewer.candidateLevels.map((item) => (
            <Badge key={item} tone="navy">
              {item}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  )
}

function ServicesTab({ interviewer }: { interviewer: Interviewer }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {interviewer.services.map((service) => (
        <Card key={service.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy-950">{service.name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {service.durationMin} min · {service.interviewType}
              </p>
            </div>
            <p className="font-semibold text-navy-950">{formatINR(service.price)}</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">{service.description}</p>
          <Link to={`/candidate/interviewers/${interviewer.id}/book?service=${service.id}`} className="mt-4 inline-block">
            <Button size="sm">Select</Button>
          </Link>
        </Card>
      ))}
    </div>
  )
}

function AvailabilityTab({ interviewer }: { interviewer: Interviewer }) {
  const upcoming = interviewer.availability.filter((slot) => new Date(slot.start) > new Date())
  const next = getNextSlot(interviewer)
  return (
    <div>
      <p className="text-sm text-slate-600">
        Timezone {interviewer.timezone}. Next available: {next ? formatSlot(next.start) : 'None listed'}.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {upcoming.map((slot) => (
          <div key={slot.id} className="rounded-lg border border-slate-200 px-4 py-3 text-sm">
            {formatSlot(slot.start)} · {slot.durationMin} min
          </div>
        ))}
      </div>
    </div>
  )
}
