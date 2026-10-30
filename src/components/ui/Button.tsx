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
    'bg-gradient-to-r from-coral-600 via-violet-500 to-coral-600 bg-[length:200%_100%] text-white shadow-md shadow-coral-600/30 hover:bg-[position:100%_0] disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none',
  secondary:
    'bg-gradient-to-r from-navy-950 to-navy-700 text-white shadow-md shadow-navy-950/25 hover:from-navy-800 hover:to-navy-600 disabled:from-slate-300 disabled:to-slate-300',
  outline:
    'border border-coral-200 bg-white text-navy-950 hover:border-violet-300 hover:bg-violet-50 disabled:text-slate-400',
  ghost: 'text-navy-800 hover:bg-violet-50 hover:text-violet-700 disabled:text-slate-400',
  danger: 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 disabled:from-slate-300 disabled:to-slate-300',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
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
