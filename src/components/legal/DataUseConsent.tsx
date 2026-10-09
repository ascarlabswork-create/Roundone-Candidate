export function DataUseConsent({
  id,
  checked,
  onChange,
  children,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label htmlFor={id} className="flex items-start gap-3 text-sm leading-5 text-slate-700">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <span>{children}</span>
      </label>
    </div>
  )
}
