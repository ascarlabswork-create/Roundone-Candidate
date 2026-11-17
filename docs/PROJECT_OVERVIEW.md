# jobround.ai — Overall project overview

One product, **two frontends**, **one backend**.

| App | Repo | Production | Audience |
|-----|------|------------|----------|
| **Candidate** | [Roundone-Candidate](https://github.com/ascarlabswork-create/Roundone-Candidate) | https://www.jobround.ai/ | People practicing / booking mock interviews |
| **Interviewer** | [Roundone-Interviewer](https://github.com/ascarlabswork-create/Roundone-Interviewer) | https://experts.jobround.ai/ | Experts who host interviews + staff admin |
| **Backend** | Shared Supabase project `fhcrxjrqtojixgqemofp` | Auth, Postgres, RLS, Edge Functions, Storage | Both apps |

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

---

## How authentication works (both apps)

**Not a custom JWT API.** Both apps use **Supabase Auth**.

1. Sign up / sign in / OTP / Google → Supabase returns `access_token` (JWT) + `refresh_token`.
2. `supabase-js` stores the session in **localStorage**, refreshes automatically, and attaches  
   `Authorization: Bearer <access_token>` on every PostgREST / RPC / Edge Function call.
3. **RLS** (and `verify_jwt` on Edge Functions) enforces who can read/write what.
4. Same email can have **both** personas via:
   - `claim_candidate_persona` (Candidate app)
   - `claim_interviewer_persona` (Interviewer app)

| Flow | Candidate | Interviewer |
|------|-----------|-------------|
| Email signup | `signUpCandidate` + `role: 'candidate'` metadata | `signUpInterviewer` + interviewer metadata |
| Password login | `signInWithPassword` | same |
| Email OTP | existing users only | existing users only |
| Google | GIS → `signInWithIdToken` | GIS → `signInWithIdToken` |
| Password reset redirect | `/candidate/update-password` | `/interviewer/reset-password` (experts origin) |
| Route guard | `RequireCandidateAuth` | `RequireInterviewerAuth` / `RequireAdminAuth` |

Deep docs:

- Candidate: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Interviewer: Interviewer repo `docs/ARCHITECTURE.md`

---

## Frontend vs backend responsibilities

### Frontend (each Vite SPA)

- UI, routing, forms, LiveKit room clients
- `src/services/*` wrappers around Supabase client
- Public env only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional Google/demo vars

### Backend (Supabase — shared)

- Auth users & sessions (JWT issuer)
- Postgres schema + migrations + RLS
- Security-definer RPCs (bookings, slots, persona claims, admin moderation, …)
- Edge Functions (AI assist, job analysis, LiveKit tokens, recording, email hook, notifications, account deletion, …)
- Secrets: service role, LiveKit, AI keys, Resend/SMTP, worker secrets

There is **no** separate Express/Nest “main API” for core product data.

---

## Feature map (high level)

| Domain | Candidate | Interviewer |
|--------|-----------|-------------|
| Auth & profiles | Yes | Yes (+ admin) |
| Skill matching / find experts | Yes | Directory is supply side |
| Bookings | Create / pay stub / join | Confirm / reject / cancel / reschedule / join |
| Live interview (LiveKit) | Yes | Yes |
| Feedback & reviews | Receive / leave | Write feedback / see reviews |
| AI practice mock | Yes (`assist-matching`) | No |
| Prep / resume / ATS | Yes | No |
| Availability & services | Consume | Own calendar & optional services |
| Verification | See verified badge | Submit; admin approves |
| Earnings | — | Yes |
| Admin console | — | Yes (`/admin/*`) |

Detailed lists: [FEATURES.md](./FEATURES.md) (Candidate) and Interviewer `docs/FEATURES.md`.

---

## Hardcoding vs configuration (project-wide)

### Configured

- Supabase URL + publishable keys (per app `.env.local`)
- Edge secrets (AI, LiveKit, email, service role)
- Auth redirect URL allowlists (must include both origins + local ports)
- Google OAuth client (Dashboard + optional `VITE_GOOGLE_CLIENT_ID`)

### Intentionally client-side / catalog

- Skill & role suggestion lists (`src/data/catalogs.ts` in each app)
- AI interviewer personas (Candidate practice)
- Legal copy pages
- Default Google web client ID fallback (public browser client)
- Interviewer client hard-checks Supabase project ref `fhcrxjrqtojixgqemofp`

### Not hardcoded

- Real users, bookings, profiles, verification state, interview sessions
- JWT issuance and refresh (Supabase Auth)

---

## Local ports (convention)

| App | Port |
|-----|------|
| Candidate | `5173` |
| Interviewer | `5174` |

Both must be listed in Supabase Auth redirect URLs and (for Google GIS) Google Cloud authorized JavaScript origins.

---

## Where to read next

| Need | Doc |
|------|-----|
| Candidate auth + API detail | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Candidate features | [FEATURES.md](./FEATURES.md) |
| Interviewer auth + API detail | Interviewer repo `docs/ARCHITECTURE.md` |
| Interviewer features | Interviewer repo `docs/FEATURES.md` |
| Env templates | Each repo `.env.example` |
