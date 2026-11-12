import { AlertTriangle, CheckCircle2, CircleDashed, FileSearch, Target } from 'lucide-react'
import { Button } from '../ui/Button.tsx'
import {
  atsGradeLabel,
  type AtsReadinessResult,
  type JdMatchResult,
} from '../../resume/atsCheck.ts'

function scoreTone(score: number) {
  if (score >= 75) return 'text-emerald-800 bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'text-amber-900 bg-amber-50 border-amber-200'
  return 'text-rose-800 bg-rose-50 border-rose-200'
}

function ScoreRing({ score, label, animateKey }: { score: number; label: string; animateKey?: string | number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c
  return (
    <div className="flex items-center gap-3">
      <svg key={animateKey ?? score} width="84" height="84" viewBox="0 0 84 84" className="ats-score-ring shrink-0" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(226 232 240)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={score >= 75 ? 'rgb(5 150 105)' : score >= 50 ? 'rgb(217 119 6)' : 'rgb(225 29 72)'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
          className="ats-ring-draw"
          style={{ ['--ats-ring-offset' as string]: String(offset), ['--ats-ring-full' as string]: String(c) }}
        />
        <text x="42" y="46" textAnchor="middle" className="fill-navy-950 text-[15px] font-semibold">
          {score}
        </text>
      </svg>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreTone(score)}`}>
          {atsGradeLabel(score >= 75 ? 'strong' : score >= 50 ? 'fair' : 'needs_work')}
        </p>
        <p className="mt-1 text-xs text-slate-500">Checklist only — not a hiring prediction.</p>
      </div>
    </div>
  )
}

export function AtsReadinessPanel({
  result,
  className = '',
  animate = true,
}: {
  result: AtsReadinessResult
  className?: string
  animate?: boolean
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-sky-100/90 bg-white/95 shadow-sm ${animate ? 'ats-panel' : ''} ${className}`}
    >
      <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50/90 via-white to-indigo-50/50 px-5 py-4 sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900">
          <FileSearch className="h-4 w-4" aria-hidden />
          ATS readiness
        </p>
        <p className="mt-1 text-sm text-slate-600">Structural checks parsers usually need when you upload a resume.</p>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <ScoreRing score={result.score} label="Readiness score" animateKey={result.score} />
        <ul className="ats-check-stagger grid gap-2 sm:grid-cols-2">
          {result.items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                item.passed ? 'border-emerald-100 bg-emerald-50/40 text-slate-700' : 'border-amber-100 bg-amber-50/50 text-slate-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {item.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                ) : (
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                )}
                <div>
                  <p className="font-medium text-navy-950">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {result.improvements.length > 0 ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Suggested improvements
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {result.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function JdMatchPanel({
  result,
  onReupload,
  className = '',
}: {
  result: JdMatchResult
  onReupload?: () => void
  className?: string
}) {
  return (
    <section className={`ats-panel overflow-hidden rounded-2xl border border-violet-100/90 bg-white/95 shadow-sm ${className}`}>
      <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50/90 via-white to-indigo-50/40 px-5 py-4 sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-900">
          <Target className="h-4 w-4" aria-hidden />
          Resume ↔ job match
        </p>
        <p className="mt-1 text-sm text-slate-600">How many required job skills appear in your resume text.</p>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <ScoreRing score={result.score} label="JD match coverage" animateKey={`${result.score}-${result.matchedSkills.length}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Matched</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.matchedSkills.length === 0 ? (
                <p className="text-sm text-slate-500">None yet</p>
              ) : (
                result.matchedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="ats-chip-pop rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-100"
                  >
                    {skill}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Missing from resume</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.missingSkills.length === 0 ? (
                <p className="text-sm text-slate-500">No gaps detected</p>
              ) : (
                result.missingSkills.map((skill) => (
                  <span
                    key={skill}
                    className="ats-chip-pop rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-900 ring-1 ring-rose-100"
                  >
                    {skill}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        {result.improvements.length > 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <p className="text-sm font-semibold text-violet-950">Improve before applying</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {result.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {onReupload ? (
              <div className="mt-3">
                <Button type="button" size="sm" variant="outline" onClick={onReupload}>
                  Upload an updated resume
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
