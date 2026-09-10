import { BadgeCheck, Star } from 'lucide-react'
import { cn } from '../../lib/cn.ts'
import { initials } from '../../lib/format.ts'

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizes = {
    sm: 'h-10 w-10 text-xs',
    md: 'h-14 w-14 text-sm',
    lg: 'h-20 w-20 text-lg',
    xl: 'h-24 w-24 text-xl',
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-900 font-semibold text-white',
        sizes[size],
      )}
    >
      <img src={src} alt="" className="relative z-10 h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center">{initials(name)}</span>
    </span>
  )
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
      {compact ? <span className="sr-only">Verified</span> : <span className="text-xs font-semibold">Verified</span>}
    </span>
  )
}

export function StarRating({
  value,
  size = 'sm',
}: {
  value: number
  size?: 'sm' | 'md'
}) {
  const icon = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index + 1 <= Math.round(value)
        return (
          <Star
            key={index}
            className={cn(icon, filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300')}
          />
        )
      })}
    </span>
  )
}

export function InteractiveStars({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1
        const filled = star <= value
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
          >
            <Star className={cn('h-7 w-7', filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
          </button>
        )
      })}
    </div>
  )
}

export function MatchScore({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-violet-50 font-semibold text-violet-700',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
    >
      {score}% Match
    </span>
  )
}
