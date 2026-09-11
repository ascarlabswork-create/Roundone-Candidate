# RoundOne — candidate website

Candidate-facing prototype for finding verified interviewers, booking mock interviews, and tracking feedback. This is **not** the interviewer product: there is no interviewer dashboard, earnings, host calendar, or interviewer registration.

**Repo:** https://github.com/ascarlabs/roundone-candidate

## Stack

React, TypeScript, Vite, Tailwind CSS, React Router, Lucide. Data is mocked in the client — no backend.

## Candidate journey

Home → goal → matching → search/compare → interviewer profile → service → availability → book/pay → confirmation → My Interviews → interview room → feedback → rating → progress → next recommendation.

## Routes

- `/` — home and goal form
- `/candidate/find` — matching inputs
- `/candidate/matches` — ranked matches
- `/candidate/interviewers` — search, filters, compare
- `/candidate/interviewers/:id` — interviewer profile (browse/book)
- `/candidate/interviewers/:id/book` — service, slot, pay
- `/candidate/booking/confirmation`
- `/candidate/interviews` — My Interviews
- `/candidate/interview/:id` — interview room
- `/candidate/feedback/:id`
- `/candidate/progress`
- `/candidate/practice`, `/candidate/interview-types`, `/candidate/resources`, `/candidate/notifications`, `/candidate/profile`

## Local development

```bash
npm install
npm run dev -- --host localhost --port 5173
```

Open http://localhost:5173/

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck and production build
- `npm run preview` — serve the production build
- `npm run lint` — Oxlint
