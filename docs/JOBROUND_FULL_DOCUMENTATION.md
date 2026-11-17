# jobround.ai — Full project documentation

**This is the single master document** for the whole product: Candidate frontend, Interviewer frontend, shared Supabase backend, authentication (JWT), API architecture, signup flows, features, and what is hardcoded vs configured.

| Item | Value |
|------|--------|
| Candidate app | https://www.jobround.ai/ · [Roundone-Candidate](https://github.com/ascarlabswork-create/Roundone-Candidate) |
| Interviewer app | https://experts.jobround.ai/ · [Roundone-Interviewer](https://github.com/ascarlabswork-create/Roundone-Interviewer) |
| Backend | Shared Supabase project **`fhcrxjrqtojixgqemofp`** (Auth + Postgres + RLS + Edge Functions + Storage) |
| Local ports | Candidate `5173` · Interviewer `5174` |

> Shorter/split docs still exist (`ARCHITECTURE.md`, `FEATURES.md`, `PROJECT_OVERVIEW.md`) for navigation. **Prefer this file when you want everything in one place.**

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Stack](#2-stack)
3. [Authentication & JWT (both apps)](#3-authentication--jwt-both-apps)
4. [Candidate signup & login](#4-candidate-signup--login)
5. [Interviewer signup & login](#5-interviewer-signup--login)
6. [Admin auth](#6-admin-auth)
7. [API / call architecture](#7-api--call-architecture)
8. [Edge Functions (backend)](#8-edge-functions-backend)
9. [Database & RLS](#9-database--rls)
10. [Hardcoded vs configured](#10-hardcoded-vs-configured)
11. [Features — Candidate](#11-features--candidate)
12. [Features — Interviewer & Admin](#12-features--interviewer--admin)
13. [Routes](#13-routes)
14. [Local development & env](#14-local-development--env)
15. [Security notes](#15-security-notes)
16. [Source file index](#16-source-file-index)

---

## 1. System overview

One product, **two frontends**, **one backend**.

```
┌────────────────────┐     ┌────────────────────┐
│  Candidate SPA     │     │  Interviewer SPA   │
│  jobround.ai       │     │  experts.jobround  │
└─────────┬──────────┘     └──────────┬─────────┘
          │  JWT (Supabase Auth)      │
          └────────────┬──────────────┘
                       ▼
          ┌────────────────────────────┐
          │ Supabase                   │
          │ Auth · Postgres · RLS      │
          │ Edge Functions · LiveKit   │
          └────────────────────────────┘
```

There is **no** separate Nest/Express “main API” and **no custom JWT server**. Both SPAs call Supabase with the user’s access token.

---

## 2. Stack

| Layer | Technology |
|-------|------------|
| Frontends | React, TypeScript, Vite, Tailwind CSS, React Router |
| Auth & DB | Supabase Auth, PostgreSQL, Row Level Security (RLS) |
| Server logic | Supabase Edge Functions (Deno) + Postgres RPCs |
| Video | LiveKit (`livekit-client` + `create-interview-token`) |
| Deploy | Vercel (UIs) + Supabase (backend) |
| AI (Candidate) | Edge Function `assist-matching` → OpenAI-compatible API (`MATCHING_AI_*` secrets) |

---

## 3. Authentication & JWT (both apps)

### What tokens are used?

1. After signup/login, Supabase returns a **session**:
   - `access_token` — JWT signed by Supabase (short-lived)
   - `refresh_token` — used to refresh the access token
2. `@supabase/supabase-js` stores the session in **browser localStorage** (`persistSession: true`).
3. Every `supabase.from(...)`, `supabase.rpc(...)`, and `supabase.functions.invoke(...)` sends:

   `Authorization: Bearer <access_token>`

4. Tokens **auto-refresh** (`autoRefreshToken: true`).
5. Email confirmation / OAuth / recovery links use `detectSessionInUrl: true`.

### Session lifecycle

| Step | Candidate | Interviewer |
|------|-----------|-------------|
| Boot | `getCurrentUser` → load candidate profile | `getCurrentUser` → `getCurrentInterviewer` |
| Listen | `onAuthStateChange` | same |
| Gate | `RequireCandidateAuth` → `/?auth=login&next=…` | `RequireInterviewerAuth` → `/interviewer/login?next=…` |
| Persona | `claim_candidate_persona` | `claim_interviewer_persona` |
| Blocked | `admin` cannot use Candidate app | Admins hitting interviewer routes go to `/admin` |

### Dual persona

Same email can use **both** products:

| App | Claim RPC |
|-----|-----------|
| Candidate | `claim_candidate_persona` |
| Interviewer | `claim_interviewer_persona` |

---

## 4. Candidate signup & login

Source: Candidate `src/services/auth.ts`.

### Email + password signup

```
signUpCandidate({ email, password, fullName, timezone? })
  → supabase.auth.signUp({
      emailRedirectTo: {origin}/candidate/auth/callback,
      data: { full_name, role: 'candidate', timezone }
    })
```

| Result | Meaning |
|--------|---------|
| `sessionCreated: true` | Immediate JWT session |
| `needsEmailConfirmation: true` | Confirm via email link |

DB provisioning: Auth trigger creates `profiles` / candidate rows. Google path does **not** set role client-side; trigger provisions candidate.

### Password login

`signInCandidate` → `signInWithPassword` → JWT session.

### Email 6-digit OTP (existing accounts only)

```
sendEmailSignInCode → signInWithOtp({ shouldCreateUser: false })
verifyEmailSignInCode → verifyOtp({ type: 'email' }) → session
```

### Google

Primary UI: Google Identity Services → `signInWithGoogleIdToken` → Supabase session.  
Optional env: `VITE_GOOGLE_CLIENT_ID` (default public client ID may exist in code).

### Password reset

`resetPasswordForEmail` → `/candidate/update-password` → `updateUser({ password })`.

---

## 5. Interviewer signup & login

Source: Interviewer `src/services/auth.ts`.

### Email + password signup

```
signUpInterviewer({ firstName, lastName, email, password, company, currentRole, experienceYears, phone?, timezone? })
  → supabase.auth.signUp({
      emailRedirectTo: https://experts.jobround.ai/interviewer/auth/callback?next=/interviewer/setup?step=professional,
      data: {
        full_name, first_name, last_name,
        role: 'interviewer', persona: 'interviewer', signup_app: 'interviewer',
        timezone, phone, current_role, company, experience_years
      }
    })
```

Confirmation emails are forced to the **experts** origin (never `jobround.ai`) via `buildEmailAuthRedirect` / `VITE_PUBLIC_APP_URL`.

Duplicate emails (empty `identities`) are detected and user is told to sign in.

### Password / OTP / Google

Same Supabase mechanisms as Candidate. Google uses GIS ID token on the experts origin. After Google, app may call `claim_interviewer_persona` if `interviewer_profiles` is missing.

### Password reset

Redirect: `/interviewer/reset-password` on experts origin → then welcome/setup.

---

## 6. Admin auth

- UI: Interviewer app `/admin/login` (separate from interviewer chrome).
- Access: `profiles.role = 'admin'` granted in **SQL**, not public signup.
- Gate: `RequireAdminAuth`.
- Example:

```sql
UPDATE public.profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@company.com' LIMIT 1);
```

---

## 7. API / call architecture

### Pattern (both frontends)

```
Page / Component
  → src/services/*  (Candidate also: practice/, resume/, matching/, preparation/)
    → supabase.from / .rpc / .auth / .functions.invoke
      → Postgres (RLS) or Edge Function
```

### How JWT is attached

Automatically by `supabase-js`. Edge Functions with `verify_jwt = true` reject missing/invalid JWTs.

### Example request map

| User action | Frontend | Backend |
|-------------|----------|---------|
| Candidate register | `signUpCandidate` | Supabase Auth + DB trigger |
| Interviewer register | `signUpInterviewer` | Supabase Auth + DB trigger |
| Login password / OTP / Google | auth services | Supabase Auth |
| Claim persona | claim RPCs | Postgres RPC |
| Match / browse interviewers | matching / search services | views + RPCs e.g. `match_interviewers_by_skills` |
| Book / list slots | booking services | `create_booking`, `list_bookable_slots`, … |
| Confirm / reject / cancel / reschedule | Interviewer bookings service | booking RPCs |
| AI mock question / feedback | `assist-matching` invoke | Edge + `MATCHING_AI_*` |
| Analyze JD | `analyze-job` | Edge Function |
| Join interview room | create-token services | `create-interview-token` → LiveKit |
| Admin approve verification | `adminOperations` | `moderate_interviewer_verification` |
| Delete interviewer account | account deletion service | Edge `delete-interviewer-account` |

Payments: stub / skip-payment paths as configured (not live card charging in the stub path).

---

## 8. Edge Functions (backend)

Shared project; some functions live primarily in Candidate migrations/repo, some in Interviewer.

| Function | Purpose | Typical auth |
|----------|---------|----------------|
| `assist-matching` | AI practice, prep, resume/ATS assist, TTS, realtime session | User JWT; AI secrets server-side |
| `analyze-job` | Parse job URL / JD | User JWT |
| `create-interview-token` | LiveKit room token | User JWT |
| `interview-recording` / `control-interview-recording` | Recording egress | User JWT (+ privileged secrets) |
| `end-interview-call` | Call teardown side effects | User JWT |
| `delete-interviewer-account` | Account deletion | User JWT |
| `send-email` | Auth email hook → Resend | Hook secret (not user JWT) |
| `notification-worker` | Notification delivery | Shared secret + often service role |

**Server secrets (never `VITE_*`):** `SUPABASE_SERVICE_ROLE_KEY`, `MATCHING_AI_API_KEY`, `MATCHING_AI_MODEL`, `MATCHING_AI_BASE_URL`, `LIVEKIT_*`, `RESEND_API_KEY`, worker secrets, storage/S3 as needed.

---

## 9. Database & RLS

- Browser uses **publishable/anon key + user JWT**.
- **RLS** scopes rows (own candidate/interviewer data; public interviewer directory views for candidates).
- Privileged work uses **security definer RPCs** or Edge Functions with **service role**.

Illustrative objects:

- `profiles`, `candidate_profiles`, `interviewer_profiles`
- Skills, preferences, services, availability, blocked times
- `bookings`, `payments`, `interview_sessions`
- Practice / prep / notification tables
- Public views: e.g. `interviewer_public_directory`, services public

---

## 10. Hardcoded vs configured

### Configured (env / dashboard)

| Item | Where |
|------|--------|
| Supabase URL + publishable key | Each app `VITE_SUPABASE_*` |
| Interviewer public URL (email redirects) | `VITE_PUBLIC_APP_URL` |
| Google client ID override | `VITE_GOOGLE_CLIENT_ID` |
| Extra Google origins | `VITE_GOOGLE_AUTHORIZED_ORIGINS` |
| Auth redirect allowlist | Supabase Auth URL config / `config.toml` |
| AI / LiveKit / email / service role | Edge Function / Supabase secrets |

### Hardcoded / client catalogs (by design)

| Item | Notes |
|------|--------|
| Skills / roles suggestion lists | `src/data/catalogs.ts` in each app |
| AI interviewer personas (John, Lily, …) | Candidate practice model |
| AI credits starting wallet | Candidate client `localStorage` credits helper |
| Legal copy | Static pages |
| Default Google web client ID | Public browser OAuth client (overridable) |
| Interviewer expected project ref | Hard-checks `fhcrxjrqtojixgqemofp` |
| Interviewer production origin fallback | `https://experts.jobround.ai` |
| Admin role | SQL only — no self-serve |

### Not hardcoded

- Real Auth users and JWT sessions
- Live bookings, profiles, verification, interview sessions
- AI generation when Edge + API key are configured

---

## 11. Features — Candidate

| Area | Features |
|------|----------|
| Discovery | Find interviewers (skill overlap), job match, matches, public interviewer profiles, book slots |
| Interviews | Upcoming/history, LiveKit room, private feedback, reviews |
| AI practice | Mock interview (role, difficulty, questions, skills, persona), history, voice/text via `assist-matching` |
| Prep / ATS | Preparation, resume→skills, ATS check & studio |
| Account | Welcome onboarding, profile, notifications, progress, dual persona |

---

## 12. Features — Interviewer & Admin

### Interviewer workspace

| Feature | Notes |
|---------|--------|
| Dashboard | Upcoming sessions, readiness |
| Bookings | Confirm / reject / cancel / **reschedule** / join / feedback |
| Calendar | Weekly hours, custom slots, blocked times |
| Services | Optional priced services (matching can use skills alone) |
| Profile | Skills (multi / comma), roles, bio, employment |
| Verification | Submit docs; status tracked |
| Live room | LiveKit, timing rules, notes, messages, recording |
| Feedback / reviews / earnings / notifications / settings | As implemented |
| Candidate history | Only booked candidates (no global directory) |

### Admin console (`/admin/*`)

Dashboard, verifications (approve/reject), reviews, bookings, services, audit.

---

## 13. Routes

### Candidate (examples)

**Public:** `/`, login/register, `/candidate/auth/callback`, `/candidate/update-password`, legal  

**Protected:** welcome, find, job-match, matches, interviewers + book, interviews + room, practice/mock/history, preparation, resume-skills, ats-check, profile, notifications, progress  

### Interviewer (examples)

**Public:** `/interviewer/login`, register, auth callback, reset-password, `/admin/login`, legal  

**Interviewer:** setup, welcome, dashboard, bookings, calendar, services, profile, verification, settings, interview room, feedback, reviews, earnings, notifications, candidates/:id  

**Admin:** `/admin/dashboard`, verifications, reviews, bookings, services, audit  

---

## 14. Local development & env

### Candidate

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev -- --host localhost --port 5173
```

### Interviewer

```bash
cp .env.example .env.local
# Same project URL; fill publishable key
# Optional: VITE_PUBLIC_APP_URL=https://experts.jobround.ai
npm install
npm run dev -- --host localhost --port 5174
```

Both origins must be in Supabase Auth redirect URLs and Google authorized JavaScript origins.

---

## 15. Security notes

1. Publishable key is **public**; security is **RLS + JWT**, not hiding the anon key.
2. Service role / AI / LiveKit secrets **never** in `VITE_*`.
3. Role/persona enforced server-side (triggers + claim RPCs + gates).
4. Candidate app refuses admin accounts; Interviewer admin is SQL-granted only.
5. Interviewer email redirects must stay on **experts** hosts so confirmation does not open Candidate.

### Auth diagram

```
Browser (jobround.ai OR experts.jobround.ai)
   │ email/password · OTP · Google ID token
   ▼
Supabase Auth  →  JWT session (localStorage)
   │
   ▼
SessionProvider + persona claim RPCs
   │
   ├─ Candidate gates  → candidate routes
   ├─ Interviewer gates → interviewer routes
   └─ Admin gate        → /admin/*
   │
   ▼
supabase.from / rpc / functions.invoke
(Bearer JWT → RLS / verify_jwt)
```

---

## 16. Source file index

| Topic | Candidate | Interviewer |
|-------|-----------|-------------|
| Supabase client | `src/lib/supabase.ts` | `src/lib/supabase.ts` |
| Auth API | `src/services/auth.ts` | `src/services/auth.ts` |
| Session | `src/state/session.tsx` | `src/state/session.tsx` |
| Route guard | `RequireCandidateAuth` | `RequireInterviewerAuth`, `RequireAdminAuth` |
| Router | `src/app/router.tsx` | `src/app/router.tsx` |
| Env template | `.env.example` | `.env.example` |
| AI Edge Function | `supabase/functions/assist-matching` | (uses shared project; LiveKit/recording/delete functions in interviewer repo) |

---

*Master document for jobround.ai Candidate + Interviewer + shared Supabase backend. Keep this file updated when auth, APIs, or major features change.*
