# RoundOne — Candidate application

Candidate-facing app for finding verified interviewers, booking mock interviews, viewing private feedback, practicing with AI, and preparing for interviews.

**Repo:** https://github.com/ascarlabswork-create/Roundone-Candidate  
**Production:** https://roundone-candidate-plum.vercel.app/

## Stack

React, TypeScript, Vite, Tailwind CSS, React Router, Supabase Auth / PostgreSQL / RLS / Edge Functions. Deployed on Vercel.

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

- `/` — dashboard
- `/candidate/find`, `/candidate/matches` — matching
- `/candidate/interviewers`, `/candidate/interviewers/:id`, `.../book`
- `/candidate/interviews`, `/candidate/interview/:id`
- `/candidate/feedback/:id`, `/candidate/reviews/:id`
- `/candidate/practice`, `/candidate/practice/mock`, `/candidate/practice/history`
- `/candidate/preparation`
- `/candidate/notifications`, `/candidate/profile`, `/candidate/progress`
