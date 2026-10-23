import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'

export function Logo({
  className,
  compact = false,
  inverted = false,
}: {
  className?: string
  compact?: boolean
  inverted?: boolean
}) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2', className)} aria-label="jobround.ai home">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-black shadow-sm',
          inverted ? 'bg-white text-navy-950' : 'bg-navy-950 text-gold-400',
        )}
      >
        1
      </span>
      {compact ? null : (
        <span
          className={cn(
            'text-lg font-semibold tracking-tight',
            inverted ? 'text-white' : 'text-navy-950',
          )}
        >
          jobround.ai
        </span>
      )}
    </Link>
  )
}
