import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SKILLS } from '../../data/catalogs.ts'
import { parseSkillDraft, splitSkillDraftForCommit } from '../../matching/skillInput.ts'
import { cn } from '../../lib/cn.ts'
import { Button } from './Button.tsx'
import { TextInput } from './primitives.tsx'

type SkillMultiInputProps = {
  id: string
  value: string
  onChange: (draft: string) => void
  selected: string[]
  onAdd: (skills: string[]) => void
  options?: readonly string[]
  max?: number
  placeholder?: string
  disabled?: boolean
  addLabel?: string
  className?: string
  /** Override the helper line under the input. Pass empty string to hide it. */
  hint?: string
}

function selectedKeySet(selected: string[]) {
  return new Set(selected.map((skill) => skill.trim().toLowerCase()).filter(Boolean))
}

function activeToken(draft: string) {
  const parts = draft.split(/[,;\n]/)
  return (parts[parts.length - 1] ?? '').trim().toLowerCase()
}

export function SkillMultiInput({
  id,
  value,
  onChange,
  selected,
  onAdd,
  options = SKILLS,
  max,
  placeholder = 'Python, SQL, React',
  disabled = false,
  addLabel = 'Add',
  className,
  hint = 'Type several at once with commas (e.g. Python, SQL), or open the list and pick multiple.',
}: SkillMultiInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selectedKeys = useMemo(() => selectedKeySet(selected), [selected])
  const atMax = typeof max === 'number' && selected.length >= max
  const remaining = typeof max === 'number' ? Math.max(0, max - selected.length) : Infinity
  const filter = activeToken(value)

  const suggestions = useMemo(() => {
    const available = options.filter((skill) => !selectedKeys.has(skill.trim().toLowerCase()))
    if (!filter) return available
    const matched = available.filter((skill) => skill.toLowerCase().includes(filter))
    // Prefer prefix hits so "py" surfaces Python ahead of deeper substring matches.
    return matched.sort((a, b) => {
      const aName = a.toLowerCase()
      const bName = b.toLowerCase()
      const aPrefix = aName.startsWith(filter) ? 0 : 1
      const bPrefix = bName.startsWith(filter) ? 0 : 1
      if (aPrefix !== bPrefix) return aPrefix - bPrefix
      return aName.localeCompare(bName)
    })
  }, [options, selectedKeys, filter])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
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

  function commitSkills(skills: string[]) {
    if (disabled || atMax || skills.length === 0) return
    const limited = typeof max === 'number' ? skills.slice(0, remaining) : skills
    if (limited.length === 0) return
    onAdd(limited)
  }

  function commitDraft(raw: string) {
    const skills = parseSkillDraft(raw)
    if (skills.length === 0) return
    commitSkills(skills)
    onChange('')
  }

  function onDraftChange(next: string) {
    const { complete, remainder } = splitSkillDraftForCommit(next)
    if (complete.length > 0) {
      commitSkills(complete)
      onChange(remainder)
      setOpen(true)
      return
    }
    onChange(next)
    if (!disabled && !atMax) setOpen(true)
  }

  function pickSuggestion(skill: string) {
    if (disabled || atMax) return
    commitSkills([skill])
    // Keep the open panel so more skills can be selected from the same input.
    onChange('')
    setOpen(true)
  }

  const canAddDraft = Boolean(value.trim()) && !disabled && !atMax

  return (
    <div ref={rootRef} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <TextInput
            id={id}
            placeholder={placeholder}
            value={value}
            disabled={disabled || atMax}
            className="pr-10 text-base"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-suggestions`}
            aria-autocomplete="list"
            aria-describedby={`${id}-hint`}
            autoComplete="off"
            onFocus={() => {
              if (!disabled && !atMax) setOpen(true)
            }}
            onClick={() => {
              if (!disabled && !atMax) setOpen(true)
            }}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (suggestions.length === 1 && !value.includes(',') && !value.includes(';')) {
                  pickSuggestion(suggestions[0]!)
                  return
                }
                commitDraft(value)
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
              }
            }}
            onBlur={() => {
              if (value.includes(',') || value.includes(';')) {
                commitDraft(value)
              }
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || atMax || suggestions.length === 0}
            aria-label={open ? 'Hide skill suggestions' : 'Show skill suggestions'}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-navy-950 disabled:opacity-40"
            onMouseDown={(event) => {
              // Keep focus in the input; only toggle the panel.
              event.preventDefault()
              if (disabled || atMax) return
              setOpen((current) => !current)
            }}
          >
            <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
          </button>

          {open && !disabled && !atMax ? (
            <div
              id={`${id}-suggestions`}
              role="listbox"
              aria-multiselectable="true"
              aria-label="Skill suggestions"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {suggestions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">
                  {filter ? `No matches for “${filter}”. Press Add to use it.` : 'All listed skills are already added.'}
                </p>
              ) : (
                suggestions.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-navy-950 hover:bg-slate-50"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pickSuggestion(skill)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    {skill}
                  </button>
                ))
              )}
              {typeof max === 'number' ? (
                <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
                  Select multiple from this list · {remaining} left
                </p>
              ) : (
                <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
                  Select multiple from this list. Type commas to add several at once.
                </p>
              )}
            </div>
          ) : null}
        </div>
        <Button type="button" variant="outline" onClick={() => commitDraft(value)} disabled={!canAddDraft}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      {hint || typeof max === 'number' ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
          {typeof max === 'number' ? `${hint ? ' ' : ''}Up to ${max}.` : ''}
        </p>
      ) : (
        <span id={`${id}-hint`} className="sr-only">
          Skill suggestions appear as you type.
        </span>
      )}
    </div>
  )
}
