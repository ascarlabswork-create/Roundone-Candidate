# jobround.ai — Project architecture & authentication

This document describes how the **Candidate** application works end-to-end: authentication (JWT/sessions), signup/login, API architecture, Edge Functions, shared database with the Interviewer product, and what is hardcoded vs configured.

| Item | Value |
|------|--------|
| **Repo** | [Roundone-Candidate](https://github.com/ascarlabswork-create/Roundone-Candidate) |
| **Production** | https://www.jobround.ai/ |
| **This app** | Candidate-facing only |
| **Sister product** | Interviewer / experts app (`experts.jobround.ai`, separate frontend) |
| **Shared backend** | One Supabase project (Auth + Postgres + RLS + Edge Functions) |

---

## 1. High-level stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7 |
| Auth & DB | Supabase Auth, PostgreSQL, Row Level Security (RLS) |
| Server logic | Supabase Edge Functions (Deno) |
| Realtime video | LiveKit (`livekit-client` + `create-interview-token` Edge Function) |
| Deploy | Vercel (frontend); Supabase (backend) |
| AI | OpenAI-compatible API via Edge Function `assist-matching` (`MATCHING_AI_*` secrets) |

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (jobround.ai)                                      │
│  React app → src/services/* → @supabase/supabase-js         │
│  Session = Supabase JWT (access_token) in localStorage      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + Authorization: Bearer <JWT>
┌──────────────────────────▼──────────────────────────────────┐
│  Supabase                                                   │
│  • Auth (signup / OTP / Google / password)                  │
│  • Postgres + RLS (candidates, bookings, practice, …)       │
│  • Edge Functions (AI, LiveKit, email hook, notifications)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication overview (JWT / sessions)

### What tokens are used?

This project does **not** invent a custom JWT. Authentication is **Supabase Auth**:

1. After a successful login/signup, Supabase returns a **session** containing:
   - `access_token` — JWT signed by Supabase (short-lived)
   - `refresh_token` — used to refresh the access token
2. `@supabase/supabase-js` stores the session in **browser localStorage** (`persistSession: true`).
3. Every `supabase.from(...)`, `supabase.rpc(...)`, and `supabase.functions.invoke(...)` call automatically sends:

   `Authorization: Bearer <access_token>`

4. Tokens **auto-refresh** (`autoRefreshToken: true`).
5. OAuth / email confirmation links use `detectSessionInUrl: true` so the hash/query session is picked up on `/candidate/auth/callback`.

**Frontend env (public):**

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>
```

Configured in `src/lib/supabase.ts`.  
**Never** put `SUPABASE_SERVICE_ROLE_KEY` or AI keys in `VITE_*` variables.

### Session lifecycle in the app

| Step | Where | What happens |
|------|--------|--------------|
| Boot | `src/state/session.tsx` | `getCurrentUser()` → if user, load candidate profile |
| Listen | `onAuthStateChange` | Reacts to login/logout/token refresh |
| Gate | `RequireCandidateAuth` | Unauthenticated → `/?auth=login&next=…` |
| Role | `getCandidateProfile` | Rejects `admin`; may `claim_candidate_persona` for dual-persona users |
| Logout | `signOut()` | Clears Supabase session + local session state |

---

## 3. Candidate signup & login (this repo)

Source of truth: `src/services/auth.ts` + `src/components/auth/AuthForm.tsx`.

### 3.1 Email + password signup

```
User fills name, email, password
  → signUpCandidate()
  → supabase.auth.signUp({ email, password, options: {
        emailRedirectTo: {origin}/candidate/auth/callback,
        data: { full_name, role: 'candidate', timezone }
     }})
```

Outcomes:

| Result | Meaning |
|--------|---------|
| `sessionCreated: true` | Immediate session (email confirm disabled or auto-confirmed) |
| `needsEmailConfirmation: true` | User must click email link → lands on `/candidate/auth/callback` |

Duplicate emails are detected client-side via `isDuplicateSignup` and shown as “account already exists”.

**DB provisioning:** New users are provisioned by a database trigger (`handle_new_user` / related migrations). Role for this product path is **candidate**. Google OAuth does **not** set role on the client; the server trigger does.

### 3.2 Email + password login

```
signInCandidate() → supabase.auth.signInWithPassword()
→ session (JWT) created → SessionProvider loads profile
```

### 3.3 Email 6-digit OTP login (existing accounts only)

```
sendEmailSignInCode(email)
  → supabase.auth.signInWithOtp({ shouldCreateUser: false })
  → email contains {{ .Token }} (6-digit code)

verifyEmailSignInCode(email, code)
  → supabase.auth.verifyOtp({ type: 'email', token })
  → session created
```

OTP does **not** create new accounts (`shouldCreateUser: false`). New users must register first.

Auth email delivery: Supabase Auth + SMTP / optional Edge Function hook `send-email` (Resend). Template must include `{{ .Token }}` for codes (see `supabase/config.toml` comments).

### 3.4 Google sign-in

| Method | Function | Used by UI? |
|--------|----------|-------------|
| Google Identity Services ID token | `signInWithGoogleIdToken` | Yes — `GoogleContinueButton` |
| Full OAuth redirect | `signInWithGoogle` | Defined; not the primary UI path |
| Google One Tap | `GoogleOneTap` component | Exists; not currently mounted in layout |

Flow (button):

```
GIS returns id_token
  → signInWithGoogleIdToken(token, nonce)
  → supabase.auth.signInWithIdToken({ provider: 'google' })
  → applyDetectedTimezone(userId)   # optional profiles.timezone update
  → session created
```

Optional env: `VITE_GOOGLE_CLIENT_ID` (there is also a default client ID in `src/services/googleOneTap.ts`).

### 3.5 Password reset

```
sendPasswordReset(email)
  → resetPasswordForEmail → redirectTo /candidate/update-password
updatePassword(newPassword)
  → supabase.auth.updateUser({ password })
```

### 3.6 Dual persona (same email, candidate + interviewer)

One email can have both personas across the two products:

- RPC: `claim_candidate_persona()` — called when a signed-in user lacks `candidate_profiles`
- Sister RPC: `claim_interviewer_persona()` — for the Interviewer app (migration lives in this repo’s shared SQL)
- Migration: `supabase/migrations/20261108105055_dual_persona_same_email.sql`

`admin` accounts are **blocked** from the Candidate app with:  
“This Candidate app only supports candidate accounts.”

---

## 4. Interviewer signup (sister product — not this UI)

**This repository does not implement interviewer signup screens or routes.** Full interviewer auth is documented in the Interviewer repo: `docs/ARCHITECTURE.md`.

Interviewers use a **separate frontend** (redirects configured in `supabase/config.toml`), for example:

- `https://experts.jobround.ai/interviewer/auth/callback`
- `https://roundone-interviewer.vercel.app/...`
- Local: `http://localhost:5174/...`

Both apps share the **same Supabase Auth + database** (project `fhcrxjrqtojixgqemofp`).

| Topic | Candidate app | Interviewer app |
|-------|---------------|-----------------|
| Auth provider | Same Supabase Auth (JWT sessions in localStorage) | Same |
| Email signup | `signUpCandidate` + `role: 'candidate'` | `signUpInterviewer` + employment metadata + `persona: interviewer` |
| Password / OTP / Google | Yes | Yes (Google via GIS ID token) |
| Provisioning | Candidate profile / persona | Interviewer profile / persona |
| Claim RPC | `claim_candidate_persona` | `claim_interviewer_persona` |
| Frontend | This repo | [Roundone-Interviewer](https://github.com/ascarlabswork-create/Roundone-Interviewer) |
| Admin | Blocked from Candidate UI | `/admin/*` when `profiles.role = 'admin'` |
| Data this app reads | Public interviewer views (`interviewer_public_directory`, services, skills, …) | Owns interviewer-side tables |

Cross-product diagram and feature map: [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

---

## 5. Frontend route architecture

Router: `src/app/router.tsx`.

### Public (no login required)

- `/` — marketing / home (auth modal via `?auth=login`)
- `/candidate/login`, `/candidate/register`
- `/candidate/auth/callback`, `/candidate/update-password`
- Legal: `/privacy`, `/cookies`, `/terms`, `/refund-policy`, `/pricing`, `/contact`
- `/candidate/how-it-works`, `/product-film`

### Protected (`RequireCandidateAuth`)

Examples:

- `/candidate/welcome` — role & skills onboarding
- `/candidate/find`, `/candidate/job-match`, `/candidate/matches`
- `/candidate/interviewers`, `/candidate/interviewers/:id`, `.../book`
- `/candidate/interviews`, `/candidate/interview/:id` (LiveKit room)
- `/candidate/practice`, `/candidate/practice/mock`, history
- `/candidate/preparation`, `/candidate/resume-skills`
- `/candidate/ats-check`, `/candidate/ats-check/studio`
- `/candidate/profile`, `/candidate/notifications`, `/candidate/progress`

Unauthenticated access → redirect to `/?auth=login&next=<original path>`.

---

## 6. API / call architecture

### Pattern

```
Page / Component
  → src/services/*.ts  (or practice/, resume/, matching/, preparation/)
    → supabase.from / .rpc / .auth / .functions.invoke
      → Postgres (RLS) or Edge Function
```

There is **no separate custom REST API server** for the main product. The “API” is:

1. **PostgREST** (Supabase tables/views) with RLS  
2. **Postgres RPCs** (`supabase.rpc`)  
3. **Edge Functions** (`supabase.functions.invoke`)

Legacy mock layer (`src/api/services.ts`, `src/data/*` seeds) exists for older local demos and is **not** the live path used by current pages.

### Typical service modules

| Area | Service / module |
|------|------------------|
| Auth | `src/services/auth.ts` |
| Profile / skills / prefs | `src/services/candidateProfile.ts` |
| Matching / find | matching services + RPCs like `match_interviewers_by_skills` |
| Bookings / slots | booking services + `create_booking`, `list_bookable_slots`, … |
| Payments | stub RPC `confirm_stub_payment` (not live card charging) |
| Interviews / LiveKit | `create-interview-token`, interview call services |
| Practice AI | `src/practice/aiAssist.ts` → `assist-matching` |
| Resume / ATS | resume services + `assist-matching` modes |
| Job analysis | `analyze-job` Edge Function |
| Notifications | tables + `notification-worker` |

### How JWT is attached

`supabase-js` attaches the current user’s **access token** automatically. Edge Functions configured with `verify_jwt = true` reject requests without a valid Supabase JWT (except explicitly public/hook functions).

---

## 7. Edge Functions (backend)

Located under `supabase/functions/`. Configured in `supabase/config.toml`.

| Function | Purpose | Auth |
|----------|---------|------|
| **`assist-matching`** | Multiplexed AI: practice questions/feedback, preparation, resume skill plan, ATS improve, matching assist, realtime session, TTS | `verify_jwt = true`; AI via `MATCHING_AI_API_KEY` |
| **`analyze-job`** | Parse job URL / pasted JD | `verify_jwt = true` + candidate check |
| **`create-interview-token`** | Mint LiveKit token for interview room | `verify_jwt = true`; LiveKit secrets server-side |
| **`interview-recording`** | Start/stop/save recording egress | `verify_jwt = true`; may use **service role** for storage admin |
| **`send-email`** | Auth email hook → Resend | Hook secret (`SEND_EMAIL_HOOK_SECRET`); not user JWT |
| **`notification-worker`** | Process notification deliveries | Shared secret + often **service role** |

### AI-related server env (Edge Function secrets — not Vite)

- `MATCHING_AI_API_KEY` (required for AI)
- `MATCHING_AI_MODEL` (default e.g. `gpt-4o-mini`)
- `MATCHING_AI_BASE_URL` (default OpenAI)

Other backend secrets (examples): `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_*`, `RESEND_API_KEY`, `NOTIFICATION_WORKER_SECRET`, recording/S3 vars.

### `assist-matching` modes (client invokes with `{ mode: '…' }`)

Examples used by the Candidate app:

- `practice_next_question`, `practice_feedback`, `realtime_session`, `tts`
- Preparation / resume / ATS / matching-related modes as implemented in `assist-matching/index.ts`

---

## 8. Database & RLS (conceptual)

- All sensitive tables are protected by **Row Level Security**.
- The browser uses the **anon/publishable key** + user JWT; RLS ensures users only see their own candidate data (and public interviewer directory views).
- Privileged operations use **security definer RPCs** or Edge Functions with the **service role** where necessary (never exposed to the browser).

Important candidate-related objects (illustrative):

- `profiles`, `candidate_profiles`, `candidate_preferences`, `candidate_skills`
- `bookings`, `payments`, `interview_sessions`, …
- `practice_sessions` (+ questions/answers)
- Public read models: `interviewer_public_directory`, `interviewer_services_public`, …

---

## 9. What is hardcoded vs configured?

### Configured (env / secrets)

| Item | Where |
|------|--------|
| Supabase URL + publishable key | `VITE_*` |
| Google OAuth client ID | `VITE_GOOGLE_CLIENT_ID` (optional) |
| AI provider | Edge secrets `MATCHING_AI_*` |
| Email (Resend / SMTP) | Supabase / Edge secrets |
| LiveKit | Edge secrets |
| Site / redirect URLs | `supabase/config.toml` `[auth]` |

### Hardcoded / client-side catalogs (by design)

| Item | Location | Notes |
|------|----------|--------|
| Roles, skills list, levels, companies | `src/data/catalogs.ts` | UI option catalogs |
| AI interviewer personas (John, Lily, …) | `src/practice/aiModel.ts` | Practice mock voices/styles |
| AI credits wallet | `src/resume/aiCredits.ts` | Client `localStorage` starting credits (e.g. 10) |
| Practice drills / resources copy | `src/data/*` | Content |
| Legacy mock interviewers / demo candidate | `src/data/interviewers.ts`, `candidate.ts` | Not live signup; leftover/demo helpers |
| Payment charging | Stub RPC | Legal copy: no live card charge in current stub path |
| Feature-flag system | — | No central feature-flag framework found |

### Not hardcoded (live)

- Real auth users and sessions (Supabase Auth)
- Bookings, profiles, practice history (Postgres)
- Interviewer directory shown to candidates (DB views)
- AI question generation / feedback (Edge + model API)

---

## 10. Frontend ↔ backend request map (examples)

| User action | Frontend | Backend |
|-------------|----------|---------|
| Register | `signUpCandidate` | Supabase Auth + DB trigger |
| Login password | `signInCandidate` | Supabase Auth |
| Login OTP | `sendEmailSignInCode` / `verifyEmailSignInCode` | Supabase Auth |
| Google | `signInWithGoogleIdToken` | Supabase Auth |
| Load profile | `getCandidateProfile` | `profiles` + `candidate_profiles` (+ claim RPC) |
| Start AI mock | `requestNextPracticeQuestion` | `assist-matching` (`practice_next_question`) |
| Score answer | `requestPracticeFeedback` | `assist-matching` (`practice_feedback`) |
| Live voice | `requestRealtimeSession` | `assist-matching` (`realtime_session`) |
| Join interview room | create token service | `create-interview-token` → LiveKit |
| Analyze JD URL | job analysis service | `analyze-job` |

---

## 11. Security notes

1. **Publishable key is public** — security relies on RLS + JWT, not on hiding the anon key.
2. **Service role** must only live in Edge Function / server secrets.
3. **Role is enforced server-side** (DB + profile load); client metadata `role: 'candidate'` on email signup is advisory; Google path relies on DB triggers.
4. Candidate app **refuses admin** (and unclaimable non-candidate) accounts.
5. Auth redirect allowlist in `config.toml` must include production, preview, and local origins for both Candidate and Interviewer apps.

---

## 12. Local development

```bash
cp .env.example .env.local
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

npm install
npm run dev -- --host localhost --port 5173
```

Scripts:

- `npm run build` — typecheck + production build  
- `npm run lint` — Oxlint  
- `npm run preview` — serve build  

Edge Function secrets and Auth email/SMTP are configured in the Supabase project (Dashboard / CLI), not in Vite.

---

## 13. Related source files (quick index)

| Topic | Path |
|-------|------|
| Supabase client | `src/lib/supabase.ts` |
| Auth API | `src/services/auth.ts` |
| Auth UI | `src/components/auth/AuthForm.tsx` |
| Route guard | `src/components/auth/RequireCandidateAuth.tsx` |
| Session state | `src/state/session.tsx` |
| Profile load / role | `src/services/candidateProfile.ts` |
| Router | `src/app/router.tsx` |
| Dual persona SQL | `supabase/migrations/20261108105055_dual_persona_same_email.sql` |
| AI Edge Function | `supabase/functions/assist-matching/index.ts` |
| Auth config / redirects | `supabase/config.toml` |
| Env template | `.env.example` |

---

## 14. End-to-end auth diagram

```
                 ┌──────────────┐
                 │   Browser    │
                 └──────┬───────┘
        email/password  │  OTP  │  Google ID token
                        ▼
              ┌─────────────────────┐
              │   Supabase Auth     │
              │  issues JWT session │
              └──────────┬──────────┘
                         │ access_token stored (localStorage)
                         ▼
              ┌─────────────────────┐
              │ SessionProvider     │
              │ getCandidateProfile │
              │ claim_candidate_…   │
              └──────────┬──────────┘
                         │
           ┌─────────────┴─────────────┐
           │ role OK (candidate)       │ admin / blocked
           ▼                           ▼
   RequireCandidateAuth          Error / cannot use
   protected routes              Candidate app
           │
           ▼
   supabase.from / rpc / functions.invoke
   (Bearer JWT → RLS / verify_jwt)
```

---

*Last aligned with the Candidate codebase structure (Auth services, SessionProvider, Edge Functions, shared Supabase project). Interviewer UI details live in the interviewer repository; shared auth redirects and persona RPCs are documented above.*
