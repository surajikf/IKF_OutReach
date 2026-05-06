# IKF Outreach

The repository root is intentionally minimal:

- `.git/`
- `frontend/`
- `backend/`

IKF Outreach runs as two deployable applications:

- `frontend/`: the browser-facing Next.js app
- `backend/`: the API-only Next.js app, Prisma layer, and worker runtime

They are designed to run as separate processes behind one reverse proxy so the browser still reaches `/api/*` on the same public origin.

## App Commands

```bash
cd frontend && npm install && npm run dev
cd backend && npm install && npm run dev
cd backend && npm run worker
```

## Project Layout

```text
frontend/   Standalone Next.js UI app
backend/    Standalone Next.js API app + Prisma + worker
backend/shared/  Pure utilities and shared contracts consumed by both apps
backend/tests/   Backend unit and integration tests
```

## Conventions

- `frontend/` owns pages, layouts, components, hooks, middleware, and browser-side helpers.
- `backend/` owns API routes, Prisma, job workers, encryption, mail, validation, third-party integrations, and shared runtime-neutral helpers under `backend/shared/`.
- Frontend should talk to backend over `/api/*`, not by importing backend modules.
- Deploy frontend and backend as separate services, but keep one public origin by routing `/api/*` to backend.

See [ARCHITECTURE.md](/E:/Cursor/FINAL/IKF_OutReach/backend/docs/ARCHITECTURE.md) for the folder rules.
