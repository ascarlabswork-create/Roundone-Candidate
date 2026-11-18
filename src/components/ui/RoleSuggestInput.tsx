import { useEffect, useMemo, useRef, useState } from 'react'
import { TARGET_ROLES } from '../../data/catalogs.ts'
import { cn } from '../../lib/cn.ts'
import { TextInput } from './primitives.tsx'

type RoleSuggestInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  options?: readonly string[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

function rankRoles(options: readonly string[], filter: string) {
  const matched = options.filter((role) => role.toLowerCase().includes(filter))
  return matched.sort((a, b) => {
    const aName = a.toLowerCase()
    const bName = b.toLowerCase()
    const aPrefix = aName.startsWith(filter) ? 0 : 1
    const bPrefix = bName.startsWith(filter) ? 0 : 1
    if (aPrefix !== bPrefix) return aPrefix - bPrefix
    return aName.localeCompare(bName)
  })
}

/** Single-value role field: suggestions only appear while typing. */
export function RoleSuggestInput({
  id,
  value,
  onChange,
  options = TARGET_ROLES,
  placeholder = 'Software Engineer, ML Engineer…',
  disabled = false,
  required = false,
  className,
}: RoleSuggestInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const filter = value.trim().toLowerCase()

  const suggestions = useMemo(() => {
    if (!filter) return []
    const exact = options.some((role) => role.toLowerCase() === filter)
    const ranked = rankRoles(options, filter)
    // Hide the panel once the typed value exactly matches a role.
    return exact ? [] : ranked.slice(0, 8)
  }, [filter, options])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(role: string) {
    onChange(role)
    setOpen(false)
  }

  const showList = open && !disabled && suggestions.length > 0

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <TextInput
        id={id}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className="text-base"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-suggestions`}
        aria-autocomplete="list"
        onFocus={() => {
          if (!disabled && filter) setOpen(true)
        }}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && suggestions.length === 1) {
            event.preventDefault()
            pick(suggestions[0]!)
          }
          if (event.key === 'ArrowDown' && suggestions.length > 0) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />
      {showList ? (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Role suggestions"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-0.5 shadow-lg"
        >
          {suggestions.map((role) => (
            <button
              key={role}
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-center px-2.5 py-1.5 text-left text-xs text-navy-950 hover:bg-slate-50"
              onMouseDown={(event) => {
                event.preventDefault()
                pick(role)
              }}
            >
              {role}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
