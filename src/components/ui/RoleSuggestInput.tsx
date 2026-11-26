import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SOFTWARE_FUNCTION_LABEL,
  SOFTWARE_ROLE_GROUPS,
  TARGET_ROLES,
} from '../../data/catalogs.ts'
import { cn } from '../../lib/cn.ts'
import { TextInput } from './primitives.tsx'

type RoleSuggestInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  /** When set, Enter / picking a suggestion commits a role instead of only filling the field. */
  onCommit?: (role: string) => void
  /** Already-selected roles are hidden from the typeahead list. */
  exclude?: readonly string[]
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

/** Role typeahead with a Software / Internet / AI browse panel on focus or hover. */
export function RoleSuggestInput({
  id,
  value,
  onChange,
  onCommit,
  exclude = [],
  options = TARGET_ROLES,
  placeholder = 'Software Engineer, ML Engineer…',
  disabled = false,
  required = false,
  className,
}: RoleSuggestInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const filter = value.trim().toLowerCase()
  const excluded = useMemo(
    () => new Set(exclude.map((role) => role.trim().toLowerCase()).filter(Boolean)),
    [exclude],
  )

  const suggestions = useMemo(() => {
    if (!filter) return []
    const available = options.filter((role) => !excluded.has(role.trim().toLowerCase()))
    const exact = available.some((role) => role.toLowerCase() === filter)
    const ranked = rankRoles(available, filter)
    return exact ? [] : ranked.slice(0, 8)
  }, [filter, options, excluded])

  const browseGroups = useMemo(
    () =>
      SOFTWARE_ROLE_GROUPS.map((group) => ({
        title: group.title,
        roles: group.roles.filter((role) => !excluded.has(role.toLowerCase())),
      })).filter((group) => group.roles.length > 0),
    [excluded],
  )

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
    if (onCommit) {
      onCommit(role)
      onChange('')
      setOpen(false)
      return
    }
    onChange(role)
    setOpen(false)
  }

  function commitDraft() {
    const next = value.trim()
    if (!next || !onCommit) return
    onCommit(next)
    onChange('')
    setOpen(false)
  }

  const showTypeahead = open && !disabled && suggestions.length > 0
  const showBrowse = open && !disabled && !filter && browseGroups.length > 0

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      onMouseEnter={() => {
        if (!disabled) setOpen(true)
      }}
    >
      <TextInput
        id={id}
        required={required && !onCommit}
        disabled={disabled}
        placeholder={placeholder}
        className="text-base"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showTypeahead || showBrowse}
        aria-controls={`${id}-suggestions`}
        aria-autocomplete="list"
        onFocus={() => {
          if (!disabled) setOpen(true)
        }}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (suggestions.length === 1) {
              pick(suggestions[0]!)
              return
            }
            if (onCommit && value.trim()) commitDraft()
          }
          if (event.key === 'ArrowDown' && (suggestions.length > 0 || browseGroups.length > 0)) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />

      {showBrowse ? (
        <div
          id={`${id}-suggestions`}
          className="absolute z-30 mt-1 flex w-[min(100vw-2rem,36rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_40px_-24px_rgba(16,28,53,0.55)]"
          role="listbox"
          aria-label="Software role suggestions"
        >
          <div className="w-[9.5rem] shrink-0 border-r border-slate-100 bg-slate-50/90 p-2 sm:w-44">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Job function
            </p>
            <div
              className="rounded-lg bg-coral-600 px-2.5 py-2 text-xs font-semibold leading-snug text-white"
              aria-current="true"
            >
              {SOFTWARE_FUNCTION_LABEL}
            </div>
          </div>
          <div className="max-h-72 min-w-0 flex-1 overflow-y-auto p-3 sm:max-h-80">
            {browseGroups.map((group) => (
              <div key={group.title} className="mb-3 last:mb-0">
                <p className="text-[11px] font-semibold text-navy-950">{group.title}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-coral-400 hover:bg-coral-50 hover:text-navy-950"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        pick(role)
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showTypeahead ? (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Role suggestions"
          className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-0.5 shadow-lg"
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
