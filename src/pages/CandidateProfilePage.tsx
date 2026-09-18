import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { NotificationPreferencesCard } from '../components/notifications/NotificationPreferencesCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import {
  Card,
  Chip,
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
  CANDIDATE_LEVELS,
  COMPANIES,
  INTERVIEW_TYPES,
  SKILLS,
  TARGET_ROLES,
  TIME_WINDOWS,
  TIMEZONES,
} from '../data/catalogs.ts'
import { getInterviewerById } from '../data/interviewers.ts'
import {
  getCandidatePreferences,
  getCandidateSkills,
  updateCandidatePreferences,
  updateCandidateProfile,
  updateCandidateSkills,
} from '../services/candidateProfile.ts'
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
  preferredTime: '',
}

export function CandidateProfilePage() {
  const { status, account, error, refreshAccount } = useSession()
  const { savedIds } = useSavedInterviewers()
  const { pushToast } = useToast()
  const saved = savedIds.map((id) => getInterviewerById(id)).filter((person) => person !== undefined)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [skillDraft, setSkillDraft] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [ready, setReady] = useState(false)

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
        const skills = skillRows.length > 0 ? skillRows : preferences.skills
        setForm({
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
          preferredTime: (preferences.preferred_time_window ?? '') as TimeWindow | '',
        })
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

  function addSkill(value: string) {
    const skill = value.trim()
    if (!skill || form.skills.includes(skill)) return
    setForm({ ...form, skills: [...form.skills, skill] })
    setSkillDraft('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
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
        preferredTimeWindow: form.preferredTime || null,
      })
      await updateCandidateSkills(form.skills)
      await refreshAccount()
      setSaveSuccess(true)
      pushToast('Profile saved')
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
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

  const isEmpty =
    !form.targetRole && !form.candidateLevel && !form.targetCompany && form.skills.length === 0 && !form.headline

  const timezoneOptions = (TIMEZONES as readonly string[]).includes(form.timezone)
    ? [...TIMEZONES]
    : [form.timezone, ...TIMEZONES]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Profile"
        subtitle="These details are stored on your candidate account and are visible only to you until you share them in a booking."
      />

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            title="Your profile is still empty"
            body="Add a target role, level, skills, and preferences so we can use them in later matching."
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
            <div>
              <FieldLabel htmlFor="targetRole">Target role</FieldLabel>
              <TextInput
                id="targetRole"
                list="profile-role-options"
                placeholder="Select or type a role"
                value={form.targetRole}
                onChange={(event) => setForm({ ...form, targetRole: event.target.value })}
              />
              <datalist id="profile-role-options">
                {TARGET_ROLES.map((role) => (
                  <option key={role} value={role} />
                ))}
              </datalist>
            </div>
            <div>
              <FieldLabel htmlFor="candidateLevel">Candidate level</FieldLabel>
              <TextInput
                id="candidateLevel"
                list="profile-level-options"
                placeholder="Select or type a level"
                value={form.candidateLevel}
                onChange={(event) => setForm({ ...form, candidateLevel: event.target.value })}
              />
              <datalist id="profile-level-options">
                {CANDIDATE_LEVELS.map((level) => (
                  <option key={level} value={level} />
                ))}
              </datalist>
            </div>
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
              <FieldLabel htmlFor="interviewType">Interview type</FieldLabel>
              <TextInput
                id="interviewType"
                list="profile-type-options"
                placeholder="Select or type a type"
                value={form.interviewType}
                onChange={(event) => setForm({ ...form, interviewType: event.target.value })}
              />
              <datalist id="profile-type-options">
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
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
            <div className="mt-3 flex flex-wrap gap-2">
              {form.skills.length === 0 ? (
                <p className="text-sm text-slate-500">No skills added yet.</p>
              ) : (
                form.skills.map((skill) => (
                  <Chip
                    key={skill}
                    active
                    onClick={() => setForm({ ...form, skills: form.skills.filter((item) => item !== skill) })}
                  >
                    {skill} ×
                  </Chip>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-navy-950">Preferences</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="preferredDate">Preferred date</FieldLabel>
              <TextInput
                id="preferredDate"
                type="date"
                value={form.preferredDate}
                onChange={(event) => setForm({ ...form, preferredDate: event.target.value })}
              />
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
          <Link to="/candidate/interviews">
            <Button variant="outline">My Interviews</Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <NotificationPreferencesCard />

      <Card className="mt-8 p-6">
        <h2 className="font-semibold text-navy-950">Saved interviewers</h2>
        {saved.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Save interviewers from a profile to see them here.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {saved.map((person) => (
              <li key={person.id}>
                <Link className="font-medium text-blue-700" to={`/candidate/interviewers/${person.id}`}>
                  {person.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
