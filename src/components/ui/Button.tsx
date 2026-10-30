import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

const variants = {
  primary:
    'bg-coral-600 text-white hover:bg-coral-700 disabled:bg-slate-300 disabled:text-slate-500',
  secondary:
    'bg-navy-950 text-white hover:bg-navy-800 disabled:bg-slate-300 disabled:text-slate-500',
  outline:
    'border border-black/10 bg-white text-navy-950 hover:bg-black/[0.03] disabled:text-slate-400',
  ghost: 'text-navy-800 hover:bg-black/[0.04] disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300',
}

const sizes = {
  sm: 'h-9 min-h-9 px-3.5 text-sm',
  md: 'h-11 min-h-11 px-4 text-sm',
  lg: 'h-12 min-h-12 px-5 text-[15px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
