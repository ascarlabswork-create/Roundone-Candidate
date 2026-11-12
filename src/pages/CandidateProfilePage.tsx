import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  CalendarDays,
  FileSearch,
  FileUp,
  Sparkles,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react'
import { accountDeletionConfirmed } from '../account/deletion.ts'
import { NormalizationSuggestions } from '../components/matching/NormalizationSuggestions.tsx'
import { SavedJobTargets } from '../components/profile/SavedJobTargets.tsx'
import { NotificationPreferencesCard } from '../components/notifications/NotificationPreferencesCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Avatar } from '../components/ui/identity.tsx'
import {
  EmptyState,
  ErrorState,
  FieldLabel,
  SelectInput,
  Skeleton,
  TextArea,
  TextInput,
} from '../components/ui/primitives.tsx'
import {
  COMPANIES,
  SKILLS,
  TIME_WINDOWS,
} from '../data/catalogs.ts'
import { candidateDisplayTimezone, formatTimezoneLabel } from '../lib/candidateTimezone.ts'
import { preferredDateRangeError } from '../lib/dates.ts'
import { isUuid } from '../lib/uuid.ts'
import { useAsync } from '../lib/useAsync.ts'
import { loadMatchingInterviewer } from '../matching/catalog.ts'
import { isCanonicalSkillDuplicate, uniqueCandidateSkillWording } from '../matching/skills.ts'
import { toNormalizationInput, type NormalizationPatch } from '../matching/normalizeModel.ts'
import { usePreferenceNormalization } from '../matching/usePreferenceNormalization.ts'
import {
  getCandidatePreferences,
  getCandidateSkills,
  updateCandidatePreferences,
  updateCandidateProfile,
  updateCandidateSkills,
} from '../services/candidateProfile.ts'
import { deleteMyCandidateAccount } from '../services/deleteCandidateAccount.ts'
import { useSavedInterviewers } from '../state/saved.tsx'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import type { TimeWindow } from '../data/catalogs.ts'

type ProfileForm = {
  fullName: string
  timezone: string
  headline: string
  bio: string
  targetRole: string
  candidateLevel: string
  targetCompany: string
  interviewType: string
  skills: string[]
  preferredDate: string
  preferredDateEnd: string
  preferredTime: TimeWindow | ''
}

const emptyForm: ProfileForm = {
  fullName: '',
  timezone: 'Asia/Kolkata',
  headline: '',
  bio: '',
  targetRole: '',
  candidateLevel: '',
  targetCompany: '',
  interviewType: '',
  skills: [],
  preferredDate: '',
  preferredDateEnd: '',
  preferredTime: '',
}

function profileCompleteness(form: ProfileForm) {
  const checks = [
    Boolean(form.fullName.trim()),
    Boolean(form.headline.trim()),
    Boolean(form.bio.trim()),
    Boolean(form.targetCompany.trim()),
    form.skills.length > 0,
  ]
  const done = checks.filter(Boolean).length
  return {
    done,
    total: checks.length,
    percent: Math.round((done / checks.length) * 100),
  }
}

function ProfileSection({
  icon,
  title,
  description,
  children,
  tone = 'default',
}: {
  icon: ReactNode
  title: string
  description?: string
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={
        tone === 'danger'
          ? 'overflow-hidden rounded-2xl border border-rose-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-300 hover:shadow-md hover:shadow-rose-100'
          : 'overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-300 hover:border-violet-200/80 hover:shadow-md hover:shadow-violet-100/70'
      }
    >
      <div
        className={
          tone === 'danger'
            ? 'border-b border-rose-100 bg-gradient-to-r from-rose-50/90 to-white px-5 py-4 sm:px-6'
            : 'border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-violet-50/40 px-5 py-4 sm:px-6'
        }
      >
        <div className="flex items-start gap-3">
          <span
            className={
              tone === 'danger'
                ? 'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600'
                : 'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-coral-50 to-violet-100 text-violet-700'
            }
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-navy-950">{title}</h2>
            {description ? <p className="mt-0.5 text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function CompletenessRing({ percent }: { percent: number }) {
  const offset = 100 - percent
  return (
    <div className="relative h-16 w-16 shrink-0" aria-hidden>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="url(#profileRing)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="100"
          strokeDashoffset={offset}
          className="profile-ring-progress"
          style={{ ['--profile-ring-offset' as string]: String(offset) }}
        />
        <defs>
          <linearGradient id="profileRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#007aff" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-navy-950">
        {percent}%
      </span>
    </div>
  )
}

export function CandidateProfilePage() {
  const navigate = useNavigate()
  const { status, account, error, refreshAccount, signOut } = useSession()
  const { savedIds } = useSavedInterviewers()
  const { pushToast } = useToast()
  const savedState = useAsync(async () => {
    const people = await Promise.all(
      savedIds.filter(isUuid).map(async (id) => {
        try {
          return await loadMatchingInterviewer(id)
        } catch {
          return null
        }
      }),
    )
    return people.filter((person): person is NonNullable<typeof person> => person != null)
  }, [savedIds.join(',')])
  const saved = savedState.status === 'success' ? savedState.data : []
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [savedForm, setSavedForm] = useState<ProfileForm>(emptyForm)
  const [skillDraft, setSkillDraft] = useState('')
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [skillError, setSkillError] = useState<string | null>(null)
  const [skillBusy, setSkillBusy] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const { status: suggestionStatus, suggestions, suggest, clear } = usePreferenceNormalization()

  useEffect(() => {
    if (!account) return
    const snapshot = account
    let cancelled = false

    async function load() {
      setReady(false)
      setLoadError(null)
      try {
        const [preferences, skillRows] = await Promise.all([
          getCandidatePreferences(),
          getCandidateSkills(),
        ])
        if (cancelled) return
        const skills = uniqueCandidateSkillWording(skillRows.length > 0 ? skillRows : preferences.skills)
        const loaded: ProfileForm = {
          fullName: snapshot.profile.full_name,
          timezone: snapshot.profile.timezone || 'Asia/Kolkata',
          headline: snapshot.candidate.headline ?? '',
          bio: snapshot.candidate.bio ?? '',
          targetRole: snapshot.candidate.target_role ?? '',
          candidateLevel: snapshot.candidate.candidate_level ?? '',
          targetCompany: snapshot.candidate.target_company ?? '',
          interviewType: preferences.interview_type ?? '',
          skills,
          preferredDate: preferences.preferred_date ?? '',
          preferredDateEnd: preferences.preferred_end_date ?? '',
          preferredTime: (preferences.preferred_time_window ?? '') as TimeWindow | '',
        }
        setForm(loaded)
        setSavedForm(loaded)
        setReady(true)
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : 'Could not load your profile.')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [account?.userId])

  async function persistSkills(next: string[]) {
    setSkillBusy(true)
    setSkillError(null)
    try {
      const savedSkills = await updateCandidateSkills(next)
      setForm((prev) => ({ ...prev, skills: savedSkills }))
      setSavedForm((prev) => ({ ...prev, skills: savedSkills }))
      setEditingSkill(null)
      setEditDraft('')
      setSkillDraft('')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not update skills.'
      setSkillError(
        message.toLowerCase().includes('duplicate_skill') ? 'You already have this skill.' : message,
      )
    } finally {
      setSkillBusy(false)
    }
  }

  function addSkill(value: string) {
    const skill = value.trim().replace(/\s+/g, ' ')
    if (!skill) return
    if (isCanonicalSkillDuplicate(form.skills, skill)) {
      setSkillError('You already have this skill.')
      return
    }
    void persistSkills([...form.skills, skill])
  }

  function saveSkillEdit() {
    if (!editingSkill) return
    const skill = editDraft.trim().replace(/\s+/g, ' ')
    if (!skill) {
      setSkillError('Enter a skill name.')
      return
    }
    if (isCanonicalSkillDuplicate(form.skills, skill, editingSkill)) {
      setSkillError('You already have this skill.')
      return
    }
    void persistSkills(form.skills.map((item) => (item === editingSkill ? skill : item)))
  }

  function cancelEdits() {
    setForm(savedForm)
    setSkillDraft('')
    setEditingSkill(null)
    setEditDraft('')
    setSaveError(null)
    setSaveSuccess(false)
    setSkillError(null)
  }

  function applySuggestions(patch: NormalizationPatch) {
    setForm((prev) => ({
      ...prev,
      targetRole: patch.targetRole ?? prev.targetRole,
      candidateLevel: patch.candidateLevel ?? prev.candidateLevel,
      interviewType: patch.interviewType ?? prev.interviewType,
      targetCompany: patch.targetCompany ?? prev.targetCompany,
      skills: patch.skills ?? prev.skills,
    }))
    setSkillDraft('')
    clear()
  }

  function requestSuggestions() {
    void suggest(
      toNormalizationInput({
        targetRole: form.targetRole,
        candidateLevel: form.candidateLevel,
        skills: form.skills,
        interviewType: form.interviewType,
        targetCompany: form.targetCompany,
        intent: goalDraft,
        skillDraft,
      }),
    )
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    const rangeError = preferredDateRangeError(form.preferredDate, form.preferredDateEnd)
    if (rangeError) {
      setSaveError(rangeError)
      setSaveSuccess(false)
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await updateCandidateProfile({
        fullName: form.fullName,
        timezone: candidateDisplayTimezone(form.timezone),
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        targetRole: form.targetRole.trim() || null,
        candidateLevel: form.candidateLevel.trim() || null,
        targetCompany: form.targetCompany.trim() || null,
      })
      await updateCandidatePreferences({
        interviewType: form.interviewType.trim() || null,
        skills: form.skills,
        preferredDate: form.preferredDate || null,
        preferredDateEnd: form.preferredDateEnd || null,
        preferredTimeWindow: form.preferredTime || null,
      })
      const skills = await updateCandidateSkills(form.skills)
      const next = { ...form, skills }
      setForm(next)
      setSavedForm(next)
      await refreshAccount()
      setSaveSuccess(true)
      pushToast('Profile saved')
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount() {
    if (!accountDeletionConfirmed(deletePhrase)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMyCandidateAccount()
      await signOut()
      navigate('/candidate/login?deleted=1', { replace: true })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not delete your account.'
      setDeleteError(message)
      setDeleting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  if (error && !account) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState title="Could not load profile" body={error} onRetry={() => void refreshAccount()} />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="No candidate profile yet"
          body="Your account is signed in, but a candidate profile row was not found."
        />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState title="Could not load profile details" body={loadError} onRetry={() => void refreshAccount()} />
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  const isEmpty = !form.targetCompany && form.skills.length === 0 && !form.headline
  const detectedTimezone = candidateDisplayTimezone(form.timezone)
  const completeness = profileCompleteness(form)
  const displayName = form.fullName.trim() || 'Your profile'

  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_70%_55%_at_15%_0%,rgba(0,122,255,0.14),transparent_55%),radial-gradient(ellipse_55%_45%_at_90%_5%,rgba(124,58,237,0.14),transparent_50%)]"
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="profile-enter overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_40px_-28px_rgba(12,18,32,0.35)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative">
                <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-coral-500/30 via-violet-500/25 to-mint-500/20 blur-sm" />
                <Avatar
                  src={account.profile.avatar_url ?? ''}
                  name={displayName}
                  size="lg"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gradient-brand">Account</p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-navy-950 sm:text-[1.85rem]">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-slate-600">{account.email}</p>
                {form.headline.trim() ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-700">{form.headline}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Add a headline so this page feels like your prep home.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <CompletenessRing percent={completeness.percent} />
              <div>
                <p className="text-sm font-semibold text-navy-950">Profile strength</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  {completeness.done}/{completeness.total} essentials filled
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="profile-stagger mt-6 space-y-5">
          <Link
            to="/candidate/resume-skills"
            className="group flex flex-col gap-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-sky-50/60 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/80 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100 transition group-hover:scale-105">
                <FileUp className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-navy-950">Resume interview skills</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Upload a resume to pull technical skills into matching and AI practice.
                </p>
              </div>
            </div>
            <span className="inline-flex h-11 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-semibold text-navy-950 transition group-hover:border-violet-300 group-hover:bg-violet-50">
              Upload / manage
            </span>
          </Link>

          <Link
            to="/candidate/ats-check"
            className="group flex flex-col gap-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/50 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/80 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-100 transition group-hover:scale-105">
                <FileSearch className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-navy-950">ATS readiness check</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Score your resume structure without a job description — or pair it with Job Match for JD coverage.
                </p>
              </div>
            </div>
            <span className="inline-flex h-11 items-center justify-center rounded-xl border border-sky-200 bg-white px-4 text-sm font-semibold text-navy-950 transition group-hover:border-sky-300 group-hover:bg-sky-50">
              Check resume
            </span>
          </Link>

          {isEmpty ? (
            <EmptyState
              title="Your profile is still empty"
              body="Add skills and a target company so matching has something real to work with."
            />
          ) : null}

          <form className="space-y-5" onSubmit={save}>
            <ProfileSection
              icon={<UserRound className="h-5 w-5" />}
              title="About you"
              description="Visible only to you until you share context in a booking."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <TextInput
                    id="fullName"
                    required
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-950">Timezone</p>
                  <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-navy-950">
                    {formatTimezoneLabel(detectedTimezone)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Detected from your device.</p>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="headline">Headline</FieldLabel>
                  <TextInput
                    id="headline"
                    placeholder="SDE 2 preparing for Google"
                    value={form.headline}
                    onChange={(event) => setForm({ ...form, headline: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="bio">About</FieldLabel>
                  <TextArea
                    id="bio"
                    placeholder="A short summary of what you want to practice."
                    value={form.bio}
                    onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  />
                </div>
              </div>
            </ProfileSection>

            <ProfileSection
              icon={<Target className="h-5 w-5" />}
              title="Interview goals"
              description="Skills and company signal drive who we recommend."
            >
              <div className="grid gap-4">
                <div>
                  <FieldLabel htmlFor="targetCompany">Target company</FieldLabel>
                  <TextInput
                    id="targetCompany"
                    list="profile-company-options"
                    placeholder="Select or type a company"
                    value={form.targetCompany}
                    onChange={(event) => setForm({ ...form, targetCompany: event.target.value })}
                  />
                  <datalist id="profile-company-options">
                    {COMPANIES.map((company) => (
                      <option key={company} value={company} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <FieldLabel htmlFor="profileGoal">Describe your interview goal (optional)</FieldLabel>
                  <TextArea
                    id="profileGoal"
                    placeholder="I am looking for a backend interview focused on Python, FastAPI and APIs."
                    value={goalDraft}
                    onChange={(event) => setGoalDraft(event.target.value)}
                    onBlur={() => {
                      if (goalDraft.trim().length >= 12) requestSuggestions()
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Used only to suggest skills and company. Nothing is saved until you apply and save.
                  </p>
                </div>

                <div>
                  <FieldLabel htmlFor="skills">Skills</FieldLabel>
                  <div className="flex gap-2">
                    <TextInput
                      id="skills"
                      list="profile-skill-options"
                      placeholder="Java, AWS, Microservices"
                      value={skillDraft}
                      onChange={(event) => setSkillDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addSkill(skillDraft)
                        }
                      }}
                    />
                    <Button variant="outline" onClick={() => addSkill(skillDraft)}>
                      Add
                    </Button>
                  </div>
                  <datalist id="profile-skill-options">
                    {SKILLS.map((skill) => (
                      <option key={skill} value={skill} />
                    ))}
                  </datalist>
                  {skillError ? <p className="mt-2 text-sm text-red-700">{skillError}</p> : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.skills.length === 0 ? (
                      <p className="text-sm text-slate-500">No skills added yet.</p>
                    ) : (
                      form.skills.map((skill) => (
                        <div
                          key={skill}
                          className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 py-1 pl-3 pr-1 text-sm text-navy-950 transition hover:border-violet-200 hover:bg-violet-50/70"
                        >
                          {editingSkill === skill ? (
                            <input
                              aria-label={`Edit ${skill}`}
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  saveSkillEdit()
                                }
                              }}
                              className="min-w-0 max-w-[10rem] bg-transparent text-sm outline-none"
                            />
                          ) : (
                            <span className="truncate font-medium">{skill}</span>
                          )}
                          {editingSkill === skill ? (
                            <>
                              <button
                                type="button"
                                className="rounded-full px-2 py-0.5 text-xs font-semibold text-coral-700 hover:bg-white"
                                onClick={saveSkillEdit}
                                disabled={skillBusy}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-white"
                                onClick={() => {
                                  setEditingSkill(null)
                                  setEditDraft('')
                                }}
                                disabled={skillBusy}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-500 opacity-70 hover:bg-white hover:opacity-100"
                                onClick={() => {
                                  setEditingSkill(skill)
                                  setEditDraft(skill)
                                  setSkillError(null)
                                }}
                                disabled={skillBusy}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${skill}`}
                                className="rounded-full px-2 py-0.5 text-xs font-medium text-rose-600 opacity-70 hover:bg-white hover:opacity-100"
                                onClick={() => void persistSkills(form.skills.filter((item) => item !== skill))}
                                disabled={skillBusy}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
                  <Button variant="outline" onClick={requestSuggestions} disabled={suggestionStatus === 'loading'}>
                    <Sparkles className="h-4 w-4" />
                    {suggestionStatus === 'loading' ? 'Suggesting…' : 'Suggest matches'}
                  </Button>
                  <div className="mt-3">
                    <NormalizationSuggestions
                      status={suggestionStatus}
                      suggestions={suggestions}
                      currentSkills={form.skills}
                      onApply={applySuggestions}
                    />
                  </div>
                </div>
              </div>
            </ProfileSection>

            <ProfileSection
              icon={<CalendarDays className="h-5 w-5" />}
              title="Preferred mock time"
              description="Optional — leave blank to keep any day or window."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="preferredDate">Date range</FieldLabel>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <TextInput
                      id="preferredDate"
                      type="date"
                      value={form.preferredDate}
                      onChange={(event) => {
                        const nextStart = event.target.value
                        setForm((prev) => ({
                          ...prev,
                          preferredDate: nextStart,
                          preferredDateEnd:
                            prev.preferredDateEnd && nextStart && prev.preferredDateEnd < nextStart
                              ? nextStart
                              : prev.preferredDateEnd,
                        }))
                      }}
                    />
                    <span className="text-center text-sm text-slate-500">to</span>
                    <TextInput
                      id="preferredDateEnd"
                      type="date"
                      aria-label="Preferred mock interview end date"
                      min={form.preferredDate || undefined}
                      value={form.preferredDateEnd}
                      onChange={(event) => setForm({ ...form, preferredDateEnd: event.target.value })}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Optional — example 01-10-2026 to 15-10-2026. Leave both empty for any day.
                  </p>
                </div>
                <div>
                  <FieldLabel htmlFor="preferredTime">Time of day</FieldLabel>
                  <SelectInput
                    id="preferredTime"
                    value={form.preferredTime}
                    onChange={(event) =>
                      setForm({ ...form, preferredTime: event.target.value as TimeWindow | '' })
                    }
                  >
                    <option value="">Any time (optional)</option>
                    {TIME_WINDOWS.map((window) => (
                      <option key={window.id} value={window.id}>
                        {window.label}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </div>
            </ProfileSection>

            {saveError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>
            ) : null}
            {saveSuccess ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Profile saved.
              </p>
            ) : null}

            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_12px_40px_-18px_rgba(12,18,32,0.45)] backdrop-blur sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancelEdits} disabled={saving}>
                Cancel
              </Button>
              <Link to="/candidate/interviews">
                <Button variant="outline">My Interviews</Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </form>

          <SavedJobTargets />

          <NotificationPreferencesCard />

          <ProfileSection
            icon={<Bookmark className="h-5 w-5" />}
            title="Saved interviewers"
            description="People you bookmarked from interviewer profiles."
          >
            {savedState.status === 'loading' ? <Skeleton className="h-16" /> : null}
            {savedState.status === 'error' ? (
              <p className="text-sm text-slate-600">Unable to load saved interviewers right now.</p>
            ) : null}
            {savedState.status === 'success' && saved.length === 0 ? (
              <p className="text-sm text-slate-600">Save interviewers from a profile to see them here.</p>
            ) : null}
            {savedState.status === 'success' && saved.length > 0 ? (
              <ul className="space-y-2">
                {saved.map((person) => (
                  <li key={person.id}>
                    <Link
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-navy-950 transition hover:border-violet-200 hover:bg-violet-50/60"
                      to={`/candidate/interviewers/${person.id}`}
                    >
                      <span>{person.name}</span>
                      <span className="text-xs font-medium text-coral-700">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </ProfileSection>

          <ProfileSection
            tone="danger"
            icon={<Trash2 className="h-5 w-5" />}
            title="Delete account"
            description="Cancels upcoming or live interviews, then deletes this candidate account."
          >
            <p className="text-sm leading-6 text-slate-600">
              If this email is also an interviewer account, that interviewer login stays. Type DELETE to confirm.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <TextInput
                aria-label="Type DELETE to confirm account deletion"
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
                placeholder="DELETE"
                className="text-base"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                variant="danger"
                fullWidth
                className="sm:w-auto"
                disabled={!accountDeletionConfirmed(deletePhrase) || deleting}
                onClick={() => void deleteAccount()}
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </Button>
            </div>
            {deleteError ? <p className="mt-2 text-sm text-red-700">{deleteError}</p> : null}
          </ProfileSection>
        </div>
      </div>
    </div>
  )
}
