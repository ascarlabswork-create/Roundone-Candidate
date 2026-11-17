/** Staff-facing interviewer account code, e.g. ID003001. */
export function PublicCodeBadge({ code }: { code?: string | null }) {
  const value = code?.trim()
  if (!value) return null
  return (
    <span
      className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-600"
      title="Interviewer account ID"
    >
      {value}
    </span>
  )
}
