# jobround.ai — Candidate application

Candidate-facing app for finding verified interviewers, booking mock interviews, viewing private feedback, practicing with AI, and preparing for interviews.

**Repo:** https://github.com/ascarlabswork-create/Roundone-Candidate  
**Production:** https://www.jobround.ai/

> **Everything in one file:** **[docs/JOBROUND_FULL_DOCUMENTATION.md](./docs/JOBROUND_FULL_DOCUMENTATION.md)**  
> (auth/JWT, both signups, APIs, Edge Functions, features, hardcoded vs env)  
>  
> Split docs (optional): [PROJECT_OVERVIEW](./docs/PROJECT_OVERVIEW.md) · [ARCHITECTURE](./docs/ARCHITECTURE.md) · [FEATURES](./docs/FEATURES.md)

---

## Stack

React, TypeScript, Vite, Tailwind CSS, React Router, Supabase Auth / PostgreSQL / RLS / Edge Functions. LiveKit for interview rooms. Deployed on Vercel.

## Authentication (summary)

This app uses **Supabase Auth**, not a custom JWT server.

| Mechanism | How |
|-----------|-----|
| Session | Supabase `access_token` (JWT) + `refresh_token` in **localStorage** |
| Email signup / password login | `src/services/auth.ts` → `signUpCandidate` / `signInCandidate` |
| Email 6-digit OTP login | `signInWithOtp` + `verifyOtp` (existing accounts only) |
| Google | Google Identity Services → `signInWithIdToken` |
| Route protection | `RequireCandidateAuth` → redirects to `/?auth=login&next=…` |
| Role | DB profiles + `claim_candidate_persona` for dual-persona emails; **admin blocked** |

**Interviewer signup** is **not** in this repo — it uses the sister Interviewer frontend against the **same** Supabase project. Shared redirects and `claim_interviewer_persona` are documented in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## API architecture (summary)

```
UI pages → src/services/* (and practice/resume/matching modules)
        → supabase.from / .rpc / .functions.invoke
        → Postgres (RLS) or Edge Functions
```

There is no separate custom REST backend for core product flows. The browser always sends the user’s Supabase JWT; RLS and `verify_jwt` Edge Functions enforce access.

Key Edge Functions: `assist-matching` (AI), `analyze-job`, `create-interview-token` (LiveKit), `interview-recording`, `send-email` (auth hook), `notification-worker`.

## Required frontend environment

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Copy `.env.example` to `.env.local`. Never expose `SUPABASE_SERVICE_ROLE_KEY` or AI provider secrets through `VITE_*`.

Server-side AI (Edge Function `assist-matching`) uses:

- `MATCHING_AI_API_KEY` (required)
- `MATCHING_AI_MODEL` (default `gpt-4o-mini`)
- `MATCHING_AI_BASE_URL` (default OpenAI)

Optional: `VITE_GOOGLE_CLIENT_ID`, demo video vars (see `.env.example`).

## Local development

```bash
npm install
npm run dev -- --host localhost --port 5173
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck and production build
- `npm run preview` — serve the production build
- `npm run lint` — Oxlint

## Main routes

**Public:** `/`, login/register, auth callback, legal pages  

**Protected (candidate JWT required):**

- `/` — dashboard (when signed in)
- `/candidate/find`, `/candidate/matches` — matching
- `/candidate/interviewers`, `/candidate/interviewers/:id`, `.../book`
- `/candidate/interviews`, `/candidate/interview/:id`
- `/candidate/feedback/:id`, `/candidate/reviews/:id`
- `/candidate/practice`, `/candidate/practice/mock`, `/candidate/practice/history`
- `/candidate/preparation`, `/candidate/resume-skills`
- `/candidate/ats-check`, `/candidate/ats-check/studio`
- `/candidate/notifications`, `/candidate/profile`, `/candidate/progress`

## Documentation map

| Doc | Contents |
|-----|----------|
| [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md) | Overall project: Candidate + Interviewer + shared Supabase, auth comparison, feature map |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Auth flows, JWT/session, signup, API/Edge Functions, RLS, hardcoded catalogs, security |
| [docs/FEATURES.md](./docs/FEATURES.md) | Candidate feature inventory |
| This README | Quick start, env, routes, short auth/API summary |
