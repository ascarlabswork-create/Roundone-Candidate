import { Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listInterviewers } from '../api/index.ts'
import { FilterPanel } from '../components/interviewer/FilterPanel.tsx'
import { InterviewerCard, InterviewerCardSkeleton } from '../components/interviewer/InterviewerCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState, ErrorState, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { SORT_OPTIONS, type SortOption } from '../data/catalogs.ts'
import { getNextSlot } from '../data/interviewers.ts'
import { formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { hasMeaningfulPreferences, scoreInterviewer } from '../matching/index.ts'
import { useMatching } from '../state/matching.tsx'
import type { Interviewer, InterviewerFilters } from '../types.ts'

const defaultFilters: InterviewerFilters = {
  query: '',
  interviewTypes: [],
  candidateLevels: [],
  targetRoles: [],
  companies: [],
  experience: '',
  skills: [],
  price: '',
  rating: '',
  availability: '',
  languages: [],
  verifiedOnly: false,
  onlineOnly: false,
  sort: 'best-match',
}

function filtersFromParams(params: URLSearchParams): InterviewerFilters {
  const type = params.get('type')
  return {
    ...defaultFilters,
    query: params.get('q') ?? '',
    interviewTypes: type ? [type] : params.getAll('types'),
    candidateLevels: params.getAll('levels'),
    targetRoles: params.getAll('roles'),
    companies: params.getAll('companies'),
    experience: params.get('experience') ?? '',
    skills: params.getAll('skills'),
    price: params.get('price') ?? '',
    rating: params.get('rating') ?? '',
    availability: params.get('availability') ?? '',
    languages: params.getAll('languages'),
    verifiedOnly: params.get('verified') === '1',
    onlineOnly: params.get('online') === '1',
    sort: (params.get('sort') as SortOption) || 'best-match',
  }
}

function filtersToParams(filters: InterviewerFilters) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  filters.interviewTypes.forEach((item) => params.append('types', item))
  filters.candidateLevels.forEach((item) => params.append('levels', item))
  filters.targetRoles.forEach((item) => params.append('roles', item))
  filters.companies.forEach((item) => params.append('companies', item))
  filters.skills.forEach((item) => params.append('skills', item))
  filters.languages.forEach((item) => params.append('languages', item))
  if (filters.experience) params.set('experience', filters.experience)
  if (filters.price) params.set('price', filters.price)
  if (filters.rating) params.set('rating', filters.rating)
  if (filters.availability) params.set('availability', filters.availability)
  if (filters.verifiedOnly) params.set('verified', '1')
  if (filters.onlineOnly) params.set('online', '1')
  if (filters.sort !== 'best-match') params.set('sort', filters.sort)
  return params
}

function sortInterviewers(
  people: Interviewer[],
  sort: SortOption,
  matchById: Map<string, number>,
) {
  const copy = [...people]
  copy.sort((a, b) => {
    if (sort === 'highest-rated') return b.rating - a.rating
    if (sort === 'most-experienced') return b.experienceYears - a.experienceYears
    if (sort === 'lowest-price') return a.price - b.price
    if (sort === 'earliest') {
      const aSlot = getNextSlot(a)
      const bSlot = getNextSlot(b)
      return (aSlot ? +new Date(aSlot.start) : Infinity) - (bSlot ? +new Date(bSlot.start) : Infinity)
    }
    const aMatch = matchById.get(a.id) ?? a.rating * 20
    const bMatch = matchById.get(b.id) ?? b.rating * 20
    if (sort === 'recommended') {
      return bMatch * 0.7 + b.rating * 6 - (aMatch * 0.7 + a.rating * 6)
    }
    return bMatch - aMatch
  })
  return copy
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(params), [params])
  const { preferences } = useMatching()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])

  const state = useAsync(() => listInterviewers(filters), [params.toString()])

  const matchById = useMemo(() => {
    const map = new Map<string, number>()
    if (!hasMeaningfulPreferences(preferences) || state.status !== 'success') return map
    for (const person of state.data) {
      map.set(person.id, scoreInterviewer(person, preferences!).score)
    }
    return map
  }, [preferences, state])

  const visible = state.status === 'success' ? sortInterviewers(state.data, filters.sort, matchById) : []
  const compared = visible.filter((person) => compareIds.includes(person.id))

  function updateFilters(next: InterviewerFilters) {
    setParams(filtersToParams(next), { replace: true })
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= 3) return current
      return [...current, id]
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <TextInput
            className="pl-9"
            placeholder="Search interviewers, skills, companies..."
            value={filters.query}
            onChange={(event) => updateFilters({ ...filters, query: event.target.value })}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={filters.onlineOnly}
            onChange={(event) => updateFilters({ ...filters, onlineOnly: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-navy-950"
          />
          Online
        </label>
        <div className="flex gap-2">
          <SelectInput
            value={filters.sort}
            onChange={(event) => updateFilters({ ...filters, sort: event.target.value as SortOption })}
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <Button variant="outline" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-5">
            <FilterPanel
              filters={filters}
              onChange={updateFilters}
              onClear={() => setParams(new URLSearchParams(), { replace: true })}
            />
          </div>
        </div>

        <div className="space-y-4 pb-24">
          {state.status === 'loading' ? (
            <>
              <InterviewerCardSkeleton />
              <InterviewerCardSkeleton />
              <InterviewerCardSkeleton />
            </>
          ) : null}
          {state.status === 'error' ? <ErrorState body={state.error} /> : null}
          {state.status === 'success' && visible.length === 0 ? (
            <EmptyState
              title="No interviewers match these filters"
              body="Clear a few filters or browse all verified interviewers."
              action={
                <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </Button>
              }
            />
          ) : null}
          {visible.map((person) => (
            <InterviewerCard
              key={person.id}
              interviewer={person}
              matchScore={matchById.get(person.id)}
              selected={compareIds.includes(person.id)}
              onToggleCompare={() => toggleCompare(person.id)}
            />
          ))}
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/40"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(100%,24rem)] overflow-auto bg-white p-5 shadow-xl">
            <FilterPanel
              filters={filters}
              onChange={updateFilters}
              onClear={() => setParams(new URLSearchParams(), { replace: true })}
            />
            <Button className="mt-6" fullWidth onClick={() => setDrawerOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      ) : null}

      {compared.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto">
            <p className="shrink-0 text-sm font-semibold text-navy-950">Compare</p>
            {compared.map((person) => (
              <Link
                key={person.id}
                to={`/candidate/interviewers/${person.id}`}
                className="min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <p className="font-medium text-navy-950">{person.name}</p>
                <p className="text-slate-600">
                  {formatINR(person.price)} · {person.rating}
                </p>
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
