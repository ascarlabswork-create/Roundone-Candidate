import {
  CANDIDATE_LEVELS,
  COMPANIES,
  INTERVIEW_TYPES,
  LANGUAGES,
  SKILLS,
  TARGET_ROLES,
} from '../../data/catalogs.ts'
import type { InterviewerFilters } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { FieldLabel, SelectInput, TextInput } from '../ui/primitives.tsx'

const experienceOptions = [
  { id: '', label: 'Any experience' },
  { id: '0-3', label: '0–3 years' },
  { id: '3-6', label: '3–6 years' },
  { id: '6-10', label: '6–10 years' },
  { id: '10+', label: '10+ years' },
]

const priceOptions = [
  { id: '', label: 'Any price' },
  { id: 'under-1000', label: 'Under ₹1,000' },
  { id: '1000-1500', label: '₹1,000 – ₹1,500' },
  { id: '1500-2000', label: '₹1,500 – ₹2,000' },
  { id: '2000+', label: '₹2,000+' },
]

const ratingOptions = [
  { id: '', label: 'Any rating' },
  { id: '4', label: '4.0+' },
  { id: '4.5', label: '4.5+' },
  { id: '4.8', label: '4.8+' },
]

const availabilityOptions = [
  { id: '', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'weekend', label: 'Weekends' },
]

function MultiCheck({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: readonly string[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-navy-950">{label}</legend>
      <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
        {options.map((option) => {
          const checked = values.includes(option)
          return (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(checked ? values.filter((item) => item !== option) : [...values, option])
                }
                className="h-4 w-4 rounded border-slate-300 text-navy-950 focus:ring-blue-600"
              />
              {option}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function FilterPanel({
  filters,
  onChange,
  onClear,
}: {
  filters: InterviewerFilters
  onChange: (filters: InterviewerFilters) => void
  onClear: () => void
}) {
  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-950">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>

      <div>
        <FieldLabel htmlFor="filter-search">Search</FieldLabel>
        <TextInput
          id="filter-search"
          value={filters.query}
          placeholder="Interviewers, skills, companies..."
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
      </div>

      <MultiCheck
        label="Interview Type"
        options={INTERVIEW_TYPES}
        values={filters.interviewTypes}
        onChange={(interviewTypes) => onChange({ ...filters, interviewTypes })}
      />
      <MultiCheck
        label="Candidate Level"
        options={CANDIDATE_LEVELS}
        values={filters.candidateLevels}
        onChange={(candidateLevels) => onChange({ ...filters, candidateLevels })}
      />
      <MultiCheck
        label="Target Role"
        options={TARGET_ROLES}
        values={filters.targetRoles}
        onChange={(targetRoles) => onChange({ ...filters, targetRoles })}
      />
      <MultiCheck
        label="Company"
        options={COMPANIES}
        values={filters.companies}
        onChange={(companies) => onChange({ ...filters, companies })}
      />

      <div>
        <FieldLabel htmlFor="experience">Experience</FieldLabel>
        <SelectInput
          id="experience"
          value={filters.experience}
          onChange={(event) => onChange({ ...filters, experience: event.target.value })}
        >
          {experienceOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </div>

      <MultiCheck
        label="Skills"
        options={SKILLS}
        values={filters.skills}
        onChange={(skills) => onChange({ ...filters, skills })}
      />

      <div>
        <FieldLabel htmlFor="price">Price</FieldLabel>
        <SelectInput
          id="price"
          value={filters.price}
          onChange={(event) => onChange({ ...filters, price: event.target.value })}
        >
          {priceOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </div>

      <div>
        <FieldLabel htmlFor="rating">Rating</FieldLabel>
        <SelectInput
          id="rating"
          value={filters.rating}
          onChange={(event) => onChange({ ...filters, rating: event.target.value })}
        >
          {ratingOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </div>

      <div>
        <FieldLabel htmlFor="availability">Availability</FieldLabel>
        <SelectInput
          id="availability"
          value={filters.availability}
          onChange={(event) => onChange({ ...filters, availability: event.target.value })}
        >
          {availabilityOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </div>

      <MultiCheck
        label="Language"
        options={LANGUAGES}
        values={filters.languages}
        onChange={(languages) => onChange({ ...filters, languages })}
      />

      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          checked={filters.verifiedOnly}
          onChange={(event) => onChange({ ...filters, verifiedOnly: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-navy-950 focus:ring-blue-600"
        />
        Verified only
      </label>
    </aside>
  )
}
