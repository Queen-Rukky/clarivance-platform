# Clarivance platform

A mobile-first dashboard for running a business with AI agents. Clarivance is
the first business using it. Phase 1 is the **Lead Agent**: answer enquiries
from approved business information, qualify leads, draft quotes for owner
approval, and follow up.

The full plan is in the project's "Clarivance Lead Agent: Phase 1 build plan" doc.

## Status

| Workflow | State |
| --- | --- |
| 1. Foundation: login, businesses, team roles, tenant isolation, activity log | Built, tested locally |
| 2–9 | Not started |

## Stack

- Next.js 16 (App Router, server actions), TypeScript, Tailwind CSS 4
- Supabase Auth and Postgres, in its own `clarivance` schema
- Vitest for unit tests and database (RLS) tests

## How tenant isolation works

Every business-owned table carries `business_id`. Row-level security policies
allow access only when `clarivance.has_business_role(business_id, roles)` is
true for the signed-in user. Memberships and the activity log can't be written
directly. They change only through the SQL functions in the migration, which
check roles, keep at least one owner, and log each change. The browser only
ever holds the public Supabase key and the user's own session.

The knowledge base (business profile, services and prices, Q&A) uses the same
rules: members can read it, only owners and admins can change it, and a trigger
logs every change. Items start as drafts. `clarivance.approved_knowledge()`
returns only approved items, and it is the only source the AI agent will use.

Invites: adding an email with no account saves an invite. When someone signs
in with that confirmed email, `accept_my_invites()` adds them to the business.
No email is sent by the app yet; the owner tells the person to sign up.

`tests/db/tenant-isolation.test.ts` runs the real migrations on a throwaway
Postgres and checks these rules as the `authenticated` role.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase values.
3. In Supabase:
   - Apply `supabase/migrations/*.sql` in filename order (SQL editor or `supabase db push`).
   - **Project Settings → Data API → Exposed schemas**: add `clarivance`.
   - **Authentication → URL Configuration**: add `<APP_URL>/**` to Redirect URLs (used by sign-up confirmation and password reset).
4. `npm run dev`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm test` | Unit tests, plus DB tests when `TEST_DATABASE_URL` is set |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Production build |

## Environment variables

See `.env.example`. Only `NEXT_PUBLIC_*` values reach the browser. Everything
else is set in the hosting dashboard and never committed.

## Shared Supabase project

This app shares the `parishconnect` Supabase project but keeps all its tables
in the `clarivance` schema. Things that are shared: the `auth.users` list (the
ParishConnect sign-up trigger also creates an empty `public.profiles` row for
Clarivance users, which grants no ParishConnect access), auth email templates,
and free-tier limits.
