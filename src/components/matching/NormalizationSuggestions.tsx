import { Button } from '../ui/Button.tsx'
import { Badge } from '../ui/primitives.tsx'
import type { NormalizationStatus } from '../../matching/usePreferenceNormalization.ts'
import { buildNormalizationPatch, type NormalizationPatch, type UsableNormalization } from '../../matching/normalizeModel.ts'

function FieldSuggestion({
  label,
  value,
  band,
}: {
  label: string
  value: string
  band: 'high' | 'medium'
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-navy-950">{value}</p>
        {band === 'medium' ? (
          <Badge tone="slate">Possible match — confirm to use it</Badge>
        ) : null}
      </div>
    </div>
  )
}

export function NormalizationSuggestions({
  status,
  suggestions,
  currentSkills,
  onApply,
}: {
  status: NormalizationStatus
  suggestions: UsableNormalization | null
  currentSkills: string[]
  onApply: (patch: NormalizationPatch) => void
}) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return <p className="text-sm text-slate-600">Looking for suggested matches from your input…</p>
  }

  if (status === 'unavailable') {
    return (
      <p className="text-sm text-slate-600">
        Couldn&apos;t generate suggestions. You can continue with your current input.
      </p>
    )
  }

  if (status === 'empty' || !suggestions) {
    return (
      <p className="text-sm text-slate-600">
        No supported role, skill, or interview-type matches for this input. You can continue with your current
        values.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-navy-950">Suggested matches from your input</p>
      <div className="mt-3 space-y-3">
        {suggestions.targetRole ? (
          <FieldSuggestion
            label="Role"
            value={suggestions.targetRole.value}
            band={suggestions.targetRole.band}
          />
        ) : null}
        {suggestions.candidateLevel ? (
          <FieldSuggestion
            label="Level"
            value={suggestions.candidateLevel.value}
            band={suggestions.candidateLevel.band}
          />
        ) : null}
        {suggestions.interviewType ? (
          <FieldSuggestion
            label="Interview type"
            value={suggestions.interviewType.value}
            band={suggestions.interviewType.band}
          />
        ) : null}
        {suggestions.targetCompany ? (
          <FieldSuggestion
            label="Company"
            value={suggestions.targetCompany.value}
            band={suggestions.targetCompany.band}
          />
        ) : null}
        {suggestions.skills.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.skills.map((skill) => (
                <Badge key={skill.value} tone={skill.band === 'medium' ? 'slate' : 'blue'}>
                  {skill.value}
                  {skill.band === 'medium' ? ' · confirm' : ''}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onApply(buildNormalizationPatch({ skills: currentSkills }, suggestions))}
        >
          Apply suggestions
        </Button>
      </div>
    </div>
  )
}
