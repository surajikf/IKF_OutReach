# Deployment Guide: IKF Outreach

This document provides instructions for hosting IKF Outreach as two separate services:

- `frontend` on port `3000`
- `backend` on port `3001`

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- PostgreSQL database (Supabase recommended)
- Environment variables configured for both apps

## 1. Environment Configuration

Use the split examples:

- `frontend/.env.example`
- `backend/.env.example`

Important settings:

- `backend`: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRATEGIC_SECRET`
- `frontend` and `backend`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `frontend`: `BACKEND_INTERNAL_URL=http://localhost:3001` for local development when frontend proxies API calls itself
- `backend`: `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` must point to the public frontend URL, for example `https://outreach.example.com`

## 2. Install Dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

## 3. Build

```bash
cd frontend && npm run build
cd ../backend && npm run build
```

## 4. Start Services

```bash
cd frontend && npm run start
cd ../backend && npm run start
cd ../backend && npm run worker
```

## 5. Database Tasks

```bash
cd backend && npm run prisma:generate
cd backend && npm run prisma:push
cd backend && npm run seed
```

## 6. Reverse Proxy Requirement

Expose one public origin and split traffic by path:

- `/` -> `http://localhost:3000`
- `/api/*` -> `http://localhost:3001/api/*`

This keeps Supabase session cookies and OAuth callbacks working without cross-origin breakage.

Reference deployment files:

- `backend/deploy/web.config`
- `backend/deploy/ecosystem.config.cjs`

## 7. Operational Troubleshooting

- **Prisma issues**: if `prisma generate` hits file-locking problems on Windows, ensure Node processes are stopped before regenerating.
- **Connection errors**: ensure your server IP is allowlisted in Supabase or your database firewall.
- **OAuth redirect errors**: verify backend `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` point to the public frontend URL, not the internal backend port.
- **IIS virtual directories**: if the UI loads from a subpath, set frontend `NEXT_PUBLIC_BASE_PATH` and rebuild the frontend app.
