# Architecture

## Goal

This repository keeps only two application folders at the top level:

- `frontend/`: the browser-facing Next.js app
- `backend/`: the API-only Next.js app plus worker and Prisma ownership

They are separated for deployment, but meant to sit behind one reverse proxy so auth cookies and `/api/*` remain same-origin.

## Canonical Folders

```text
frontend/
  app/
  components/
  hooks/
  lib/
  public/
  Browser-only code and UI composition.

backend/
  app/api/
  domain/
  lib/
  prisma/
  scripts/
  shared/
  tests/
  Server-side infrastructure and business workflows.
```

## Placement Rules

- `frontend`
  - Allowed: page/layout implementation, client components, hooks, path helpers, browser Supabase client, frontend middleware.
  - Avoid: Prisma, server cookies, provider secrets, mail dispatch.

- `backend`
  - Allowed: API route implementation, Prisma, Supabase server/admin helpers, validation, encryption, integrations, domain logic, worker processes, and shared runtime-neutral helpers under `backend/shared`.
  - Avoid: browser state, UI components, DOM helpers.

## Deployment Shape

- Public `/` traffic: `frontend`
- Public `/api/*` traffic: `backend`
- Background jobs: `backend/scripts/job-worker.ts`

Do not deploy frontend and backend to unrelated public origins unless you also redesign auth cookie handling. The intended setup is same-origin reverse proxying.
