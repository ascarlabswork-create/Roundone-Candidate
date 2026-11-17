# jobround.ai — Candidate product features

Feature inventory for the **Candidate** app (`www.jobround.ai`). Auth/API detail: [ARCHITECTURE.md](./ARCHITECTURE.md). Cross-product map: [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

---

## Discovery & matching

| Feature | Notes |
|---------|--------|
| Find interviewers | Skill-overlap browse / match (not a dump of the full directory) |
| Job match | Paste/analyze JD; match interviewers to job skills |
| Matches list | Ranked / saved match views as implemented |
| Interviewer public profile | Services, skills, verification signals |
| Book a session | Slot pick via `list_bookable_slots` / booking RPCs |

---

## Interviews & feedback

| Feature | Notes |
|---------|--------|
| Upcoming / history interviews | Booking status tabs |
| Live interview room | LiveKit; token from Edge Function |
| Private feedback | Interviewer-written feedback for the candidate |
| Reviews | Candidate can leave reviews where enabled |

---

## AI practice & preparation

| Feature | Notes |
|---------|--------|
| Practice hub | Entry to mocks / history |
| AI mock interview | Role, difficulty, question count, skills, persona; voice/text via `assist-matching` |
| Practice history | Prior sessions |
| AI Prep / preparation | Study plan style flows |
| Resume → skills | Extract / plan skills from resume |
| ATS check & studio | Resume vs JD; template/edit flows |
| AI credits (client wallet) | Local starting credits for some AI tools (see architecture “hardcoded”) |

---

## Account & prefs

| Feature | Notes |
|---------|--------|
| Welcome onboarding | Role & skills |
| Profile | Candidate profile / preferences |
| Notifications | Booking lifecycle alerts |
| Progress | Practice / prep progress surfaces |
| Auth | Email/password, OTP, Google, password reset |
| Dual persona | Same email can open Interviewer app after claim |

---

## Explicitly out of scope for this app

- Interviewer availability editing, verification submission, earnings, admin console (Interviewer repo)
- Minting interviewer profiles (except dual-persona claim for candidates who also interview)
