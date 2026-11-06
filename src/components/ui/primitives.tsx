import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn.ts'

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: 'slate' | 'navy' | 'green' | 'violet' | 'blue'
  className?: string
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    navy: 'bg-navy-950 text-white',
    green: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-violet-600 bg-gradient-to-r from-coral-50 to-violet-100 text-violet-800'
          : 'border-black/10 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800',
      )}
    >
      {children}
    </button>
  )
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
      {children}
    </label>
  )
}

const fieldClass =
  'h-11 min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-coral-600 focus:ring-2 focus:ring-coral-100 disabled:bg-slate-50'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />
}

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Hide password' : 'Show password'

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(fieldClass, 'pr-11', className)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-navy-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
}

type SelectOption = { value: string; label: string; disabled: boolean }

function optionLabel(children: ReactNode, fallback: string) {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  return fallback
}

function readSelectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = []
  const walk = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return
      const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode }
      if (child.type === 'option') {
        const value = props.value != null ? String(props.value) : optionLabel(props.children, '')
        options.push({
          value,
          label: optionLabel(props.children, value),
          disabled: Boolean(props.disabled),
        })
        return
      }
      if (props.children) walk(props.children)
    })
  }
  walk(children)
  return options
}

export function SelectInput({
  className,
  children,
  value,
  onChange,
  id,
  disabled,
  required,
  name,
  'aria-label': ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = readSelectOptions(children)
  const current = String(value ?? '')
  const selected = options.find((option) => option.value === current) ?? options[0]
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(240, openUp ? spaceAbove : spaceBelow))
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 50,
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
    })
  }

  useEffect(() => {
    if (!open) return
    placeMenu()
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onReflow() {
      placeMenu()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open])

  function choose(next: string) {
    setOpen(false)
    onChange?.({
      target: { value: next, name },
      currentTarget: { value: next, name },
    } as ChangeEvent<HTMLSelectElement>)
    buttonRef.current?.focus({ preventScroll: true })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className={cn(fieldClass, 'flex items-center justify-between gap-2 text-left', className)}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span className="truncate">{selected?.label || 'Select'}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          style={menuStyle}
          className="overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === selected?.value
            return (
              <li key={`${option.value}:${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={cn(
                    'flex w-full px-3 py-2 text-left text-sm text-navy-950 hover:bg-violet-50 disabled:text-slate-400',
                    isSelected && 'bg-violet-50 font-medium text-violet-800',
                  )}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {name || required ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}
    </div>
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-28 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-navy-950 outline-none transition focus:border-coral-600 focus:ring-2 focus:ring-coral-100',
        props.className,
      )}
    />
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-14 text-center">
      <h3 className="text-lg font-semibold text-navy-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string
  body: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-red-800">{title}</h3>
      {body ? <p className="mt-2 text-sm text-red-700">{body}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-sm font-semibold text-red-800 underline"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200', className)} />
}

export function Toggle({
  id,
  checked,
  disabled,
  label,
  onChange,
}: {
  id?: string
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-coral-600' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gradient-brand">{eyebrow}</p>
        ) : null}
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-navy-950 sm:text-[1.85rem]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}
