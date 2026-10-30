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
          'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold',
          inverted ? 'bg-white text-navy-950' : 'bg-coral-600 text-white',
        )}
      >
        1
      </span>
      {compact ? null : (
        <span
          className={cn(
            'text-[15px] font-semibold tracking-tight',
            inverted ? 'text-white' : 'text-navy-950',
          )}
        >
          jobround.ai
        </span>
      )}
    </Link>
  )
}
