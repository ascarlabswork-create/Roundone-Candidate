import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { accountDeletionConfirmed } from '../account/deletion.ts'
import { NormalizationSuggestions } from '../components/matching/NormalizationSuggestions.tsx'
import { SavedJobTargets } from '../components/profile/SavedJobTargets.tsx'
import { NotificationPreferencesCard } from '../components/notifications/NotificationPreferencesCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import {
  Card,
  EmptyState,
  ErrorState,
  FieldLabel,
  PageHeader,
  SelectInput,
  Skeleton,
  TextArea,
  TextInput,
} from '../components/ui/primitives.tsx'
import {
  COMPANIES,
  SKILLS,
  TIME_WINDOWS,
  TIMEZONES,
} from '../data/catalogs.ts'
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
      const saved = await updateCandidateSkills(next)
      setForm((prev) => ({ ...prev, skills: saved }))
      setSavedForm((prev) => ({ ...prev, skills: saved }))
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
        timezone: form.timezone,
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
      const saved = { ...form, skills }
      setForm(saved)
      setSavedForm(saved)
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
      navigate('/candidate/login', { replace: true })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not delete your account.'
      setDeleteError(
        message.toLowerCase().includes('interview_in_progress')
          ? 'Finish or cancel your live interview before deleting your account.'
          : message,
      )
      setDeleting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-16" />
        <Skeleton className="h-80" />
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
        <Skeleton className="h-16" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  const isEmpty = !form.targetCompany && form.skills.length === 0 && !form.headline

  const timezoneOptions = (TIMEZONES as readonly string[]).includes(form.timezone)
    ? [...TIMEZONES]
    : [form.timezone, ...TIMEZONES]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Profile"
        subtitle="These details are stored on your candidate account and are visible only to you until you share them in a booking."
      />

      <Card className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-navy-950">Resume interview skills</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload your resume to build an interview skill set from what it actually says. Accepted skills feed AI
            Practice and your matching preferences.
          </p>
        </div>
        <Link to="/candidate/resume-skills" className="shrink-0">
          <Button variant="outline">Upload / manage resume</Button>
        </Link>
      </Card>

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            title="Your profile is still empty"
            body="Add skills and preferences so we can use them in later matching."
          />
        </div>
      ) : null}

      <form className="mt-8 space-y-6" onSubmit={save}>
        <Card className="p-6">
          <h2 className="font-semibold text-navy-950">Account</h2>
          <p className="mt-1 text-sm text-slate-600">{account.email}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <SelectInput
                id="timezone"
                value={form.timezone}
                onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              >
                {timezoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </SelectInput>
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
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-navy-950">Interview goals</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
          </div>

          <div className="mt-5">
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
              Used only to suggest a role, skills, and interview type. It is not saved unless you apply those
              suggestions and save the profile.
            </p>
          </div>

          <div className="mt-5">
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
            <ul className="mt-3 space-y-2">
              {form.skills.length === 0 ? (
                <li className="text-sm text-slate-500">No skills added yet.</li>
              ) : (
                form.skills.map((skill) => (
                  <li
                    key={skill}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingSkill === skill ? (
                      <TextInput
                        aria-label={`Edit ${skill}`}
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            saveSkillEdit()
                          }
                        }}
                      />
                    ) : (
                      <span className="text-sm font-medium text-navy-950">{skill}</span>
                    )}
                    <div className="flex gap-2">
                      {editingSkill === skill ? (
                        <>
                          <Button size="sm" onClick={saveSkillEdit} disabled={skillBusy}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSkill(null)
                              setEditDraft('')
                            }}
                            disabled={skillBusy}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSkill(skill)
                              setEditDraft(skill)
                              setSkillError(null)
                            }}
                            disabled={skillBusy}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void persistSkills(form.skills.filter((item) => item !== skill))}
                            disabled={skillBusy}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mt-5 space-y-3">
            <Button variant="outline" onClick={requestSuggestions} disabled={suggestionStatus === 'loading'}>
              {suggestionStatus === 'loading' ? 'Suggesting…' : 'Suggest matches'}
            </Button>
            <NormalizationSuggestions
              status={suggestionStatus}
              suggestions={suggestions}
              currentSkills={form.skills}
              onApply={applySuggestions}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-navy-950">Preferences</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="preferredDate">Preferred dates</FieldLabel>
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
                  aria-label="Preferred end date"
                  min={form.preferredDate || undefined}
                  value={form.preferredDateEnd}
                  onChange={(event) => setForm({ ...form, preferredDateEnd: event.target.value })}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Interviews you prefer between these dates. Example: 01-10-2026 to 15-10-2026. Leave both empty for
                any day.
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="preferredTime">Preferred time</FieldLabel>
              <SelectInput
                id="preferredTime"
                value={form.preferredTime}
                onChange={(event) =>
                  setForm({ ...form, preferredTime: event.target.value as TimeWindow | '' })
                }
              >
                <option value="">Any time</option>
                {TIME_WINDOWS.map((window) => (
                  <option key={window.id} value={window.id}>
                    {window.label}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>
        </Card>

        {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}
        {saveSuccess ? <p className="text-sm text-emerald-700">Profile saved.</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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

      <Card className="mt-8 border-red-200 p-6">
        <h2 className="font-semibold text-navy-950">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600">
          This removes your profile, skills, preferences, and practice data. Shared booking records stay for the
          interviewer without your personal profile. Type DELETE to confirm.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextInput
            aria-label="Type DELETE to confirm account deletion"
            value={deletePhrase}
            onChange={(event) => setDeletePhrase(event.target.value)}
            placeholder="DELETE"
          />
          <Button
            variant="danger"
            disabled={!accountDeletionConfirmed(deletePhrase) || deleting}
            onClick={() => void deleteAccount()}
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
        {deleteError ? <p className="mt-2 text-sm text-red-700">{deleteError}</p> : null}
      </Card>

      <Card className="mt-8 p-6">
        <h2 className="font-semibold text-navy-950">Saved interviewers</h2>
        {savedState.status === 'loading' ? <Skeleton className="mt-3 h-16" /> : null}
        {savedState.status === 'error' ? (
          <p className="mt-2 text-sm text-slate-600">Unable to load saved interviewers right now.</p>
        ) : null}
        {savedState.status === 'success' && saved.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Save interviewers from a profile to see them here.</p>
        ) : null}
        {savedState.status === 'success' && saved.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {saved.map((person) => (
              <li key={person.id}>
                <Link className="font-medium text-blue-700" to={`/candidate/interviewers/${person.id}`}>
                  {person.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}
