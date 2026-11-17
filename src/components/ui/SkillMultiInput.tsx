import { Check, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { SKILLS } from '../../data/catalogs.ts'
import { parseSkillDraft, splitSkillDraftForCommit } from '../../matching/skillInput.ts'
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
  showBrowse?: boolean
  className?: string
}

function selectedKeySet(selected: string[]) {
  return new Set(selected.map((skill) => skill.trim().toLowerCase()).filter(Boolean))
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
  showBrowse = true,
  className,
}: SkillMultiInputProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const selectedKeys = useMemo(() => selectedKeySet(selected), [selected])
  const atMax = typeof max === 'number' && selected.length >= max
  const remaining = typeof max === 'number' ? Math.max(0, max - selected.length) : Infinity

  const available = useMemo(
    () => options.filter((skill) => !selectedKeys.has(skill.trim().toLowerCase())),
    [options, selectedKeys],
  )

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

  useEffect(() => {
    setPicked((current) => current.filter((skill) => !selectedKeys.has(skill.trim().toLowerCase())))
  }, [selectedKeys])

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
      return
    }
    onChange(next)
  }

  function togglePick(skill: string) {
    setPicked((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill],
    )
  }

  function addPicked() {
    if (picked.length === 0) return
    commitSkills(picked)
    setPicked([])
    setOpen(false)
  }

  const canAddDraft = Boolean(value.trim()) && !disabled && !atMax
  const canAddPicked = picked.length > 0 && !disabled && !atMax

  return (
    <div ref={rootRef} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          id={id}
          list={listId}
          placeholder={placeholder}
          value={value}
          disabled={disabled || atMax}
          className="text-base"
          aria-describedby={`${id}-hint`}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft(value)
            }
          }}
          onBlur={() => {
            if (value.includes(',') || value.includes(';')) {
              commitDraft(value)
            }
          }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => commitDraft(value)} disabled={!canAddDraft}>
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
          {showBrowse ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || atMax || available.length === 0}
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-controls={`${id}-browse`}
            >
              Browse
              <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
            </Button>
          ) : null}
        </div>
      </div>
      <datalist id={listId}>
        {available.map((skill) => (
          <option key={skill} value={skill} />
        ))}
      </datalist>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
        Type several at once with commas (e.g. Python, SQL)
        {showBrowse ? ', or browse and select multiple.' : '.'}
        {typeof max === 'number' ? ` Up to ${max}.` : ''}
      </p>

      {open ? (
        <div
          id={`${id}-browse`}
          className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          role="group"
          aria-label="Browse skills"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Select multiple
              {typeof max === 'number' ? ` · ${remaining} left` : ''}
            </p>
            <Button type="button" size="sm" onClick={addPicked} disabled={!canAddPicked}>
              <Check className="h-3.5 w-3.5" />
              Add selected{picked.length > 0 ? ` (${picked.length})` : ''}
            </Button>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
            {available.map((skill) => {
              const checked = picked.includes(skill)
              const wouldExceed = !checked && typeof max === 'number' && picked.length >= remaining
              return (
                <label
                  key={skill}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                    checked ? 'bg-navy-950 text-white' : 'text-navy-950 hover:bg-slate-50'
                  } ${wouldExceed ? 'opacity-40' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={wouldExceed}
                    onChange={() => togglePick(skill)}
                  />
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? 'border-white bg-white text-navy-950' : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  {skill}
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
