# IKF Solutions Hub - Consolidated System SPEC

Version: 1.0  
Date: 2026-04-15  
Status: Draft for implementation

## 1) Purpose
Build a single product platform, **IKF Solutions Hub**, that hosts multiple mini-apps:
- Mail Merge
- Inbox IQ
- Outreach

Users authenticate once, see app catalog + entitlements, and can open apps in new windows without repeated logins.

---

## 2) Final Stack Decisions
- Frontend: **Next.js 16 App Router**
- BFF layer: **Next.js Route Handlers** (`app/api/bff/*`)
- Request gateway logic: **`proxy.ts`** (Next.js 16 convention)
- Backend core APIs: **FastAPI**
- Database: **Supabase Postgres** (single DB)
- Identity provider: **Firebase Auth**
- Payments: Provider abstraction (primary: Stripe; secondary adapter-ready: Razorpay)

---

## 2.1 Compatibility Policy (Authoritative)
- The codebase must not carry legacy/backward-compatibility layers.
- No compatibility shims, alias routes, duplicate old/new contracts, or preserved deprecated behavior.
- Migrations are hard cutovers into the target architecture.
- If an old path exists, it must be removed during migration unless architecture owners explicitly approve a temporary exception.

---

## 3) UX and Session Contract (Authoritative)
### 3.1 Login and Return Behavior
- If unauthenticated user hits `/apps/mail-merge`, redirect to:
  - `/login?next=/apps/mail-merge`
- After successful login, redirect to exact `next` target.
- Do **not** force user through Hub after login unless `next` missing/invalid.

### 3.2 Hub vs App Navigation
- Hub is control plane (catalog, billing, account, admin).
- App is work plane (actual product usage).
- If user has only one active app, default post-login redirect can be that app (configurable).

### 3.3 Identity Visibility
- Active identity (e.g., `hi@example.com`) is visible in each mini-app account menu/header.

### 3.4 Logout
- Logout from any app triggers **global logout** (Hub + all apps).
- Browser tabs/windows are synchronized by session invalidation and client event broadcast.

---

## 4) Access and State Model
### 4.1 Platform-level user state
- `ACTIVE`: full normal use
- `SUSPENDED`: can authenticate, cannot launch apps
- `BLOCKED`: cannot authenticate/use platform

### 4.2 App-level membership state (per user per app)
- `ACTIVE`: app can be opened
- `SUSPENDED`: app launch denied (other apps unaffected)
- `BLOCKED`: app launch denied (other apps unaffected)

### 4.3 Entitlement state (per user per app)
- `FREE`
- `TRIAL_ACTIVE`
- `TRIAL_EXPIRED`
- `PAID_ACTIVE`
- `PAID_PAST_DUE`
- `PAID_CANCELED`

Access decision order:
1. Platform user state
2. App membership state
3. Entitlement (free/trial/paid)
4. Feature flag / role checks

---

## 5) Backend Architecture (Scalable, FastAPI-native)
```text
ikf-solutions-backend/
├─ app/
│  ├─ main.py
│  ├─ core/
│  │  ├─ config.py
│  │  ├─ db.py
│  │  ├─ firebase.py
│  │  ├─ security.py
│  │  └─ logging.py
│  ├─ api/
│  │  └─ v1/
│  │     ├─ router.py
│  │     └─ deps.py
│  ├─ platform/
│  │  ├─ auth/
│  │  ├─ users/
│  │  ├─ catalog/
│  │  ├─ access/
│  │  ├─ billing/
│  │  └─ admin/
│  ├─ apps/
│  │  ├─ mail_merge/
│  │  │  ├─ routes/
│  │  │  ├─ services/
│  │  │  ├─ repositories/
│  │  │  ├─ schemas/
│  │  │  ├─ jobs/
│  │  │  └─ integrations/
│  │  ├─ inbox_iq/
│  │  └─ outreach/
│  └─ models/
├─ migrations/
└─ pyproject.toml
```

### 5.1 Why `platform/access` (not `launch`)
`platform/access` is the central policy gate:
- validates platform/app status
- validates entitlement/trial/subscription
- issues short-lived app-entry ticket/session grant

`launch` sounded UI-only; `access` explicitly means authorization + entitlement decision.

---

## 6) Frontend Architecture (Next.js 16 + BFF)
```text
ikf-solutions-frontend/
├─ proxy.ts
├─ app/
│  ├─ login/
│  ├─ hub/
│  │  ├─ page.tsx
│  ├─ apps/
│  │  ├─ mail-merge/
│  │  ├─ inbox-iq/
│  │  └─ outreach/
│  └─ api/
│     └─ bff/
│     └─ app-launch/
│     └─ auth/
├─ components/

├─ features/
└─ lib/
```

`proxy.ts` is only for lightweight route gating and redirect checks. Heavy business checks remain in BFF handlers + FastAPI.

---

## 7) Auth and Session Design
### 7.1 Login flow
1. User signs in with Firebase (client SDK).
2. Client sends Firebase ID token to BFF session exchange endpoint.
3. BFF forwards to FastAPI auth exchange endpoint.
4. FastAPI verifies token via Firebase admin/JWKS, upserts user, creates platform session.
5. BFF sets secure HttpOnly cookies for platform session.

### 7.2 Session characteristics
- Single SSO session for Hub + all mini-apps.
- Access token: short TTL.
- Refresh/session token: longer TTL, revocable server-side.
- Session revoked on global logout or admin block.

---

## 8) Billing and Trials
### 8.1 Billing components
- Checkout session creation
- Subscription lifecycle sync via webhooks
- Customer portal endpoint
- Payment event audit log

### 8.2 Trial policy
- Trial configured per app and plan.
- Starts on first successful app access.
- One trial per user per app (enforced in DB).
- On trial expiry, app access denied unless paid/free entitlement exists.

### 8.3 Payment provider abstraction
- `providers/base.py`: common contract
- `providers/stripe.py`: initial production provider
- `providers/razorpay.py`: optional/regional adapter

---

## 9) Core Data Model (Supabase Postgres)
Minimum platform tables:
- `users` (firebase_uid, email, platform_status)
- `sessions` (session_id, user_id, expires_at, revoked_at)
- `apps` (app_slug, name, visibility)
- `app_memberships` (user_id, app_id, status, role)
- `plans` (app_id, plan_code, billing_interval, price)
- `subscriptions` (user_id, app_id, plan_id, status, period_end)
- `trials` (user_id, app_id, started_at, expires_at, consumed)
- `payments` (provider, event_id, amount, status, metadata)
- `audit_logs` (actor, action, entity, payload, created_at)

Each mini-app also has its own domain tables in the same DB, namespaced by prefix/schema convention.

---

## 10) User Journey Diagram (Mermaid)
```mermaid
flowchart TD
    A[Open /apps/mail-merge] --> B{Session valid?}
    B -- No --> C[/login?next=/apps/mail-merge]
    C --> D[Firebase login]
    D --> E[BFF session exchange]
    E --> F[FastAPI verify token + create session]
    B -- Yes --> G[Call BFF access endpoint]
    F --> G

    G --> H{Platform status}
    H -- BLOCKED --> X1[Deny]
    H -- SUSPENDED --> X2[Login ok, app denied]
    H -- ACTIVE --> I{App membership status}

    I -- BLOCKED/SUSPENDED --> X3[App denied]
    I -- ACTIVE --> J{Entitlement valid?}
    J -- Yes --> K[Issue app-entry grant]
    J -- No --> L{Trial available?}
    L -- Yes --> M[Start trial + issue grant]
    L -- No --> N[Checkout]

    N --> O[Payment provider]
    O --> P[Webhook -> FastAPI billing]
    P --> Q[Subscription active]
    Q --> G

    K --> R[Open app window]
    M --> R
    R --> S[Mini-app dashboard shows user identity]
```

---

## 11) Migration Plan (Existing Repos -> Consolidated Targets)
### Phase 1: Platform foundation
- Implement `platform/auth`, `platform/users`, `platform/catalog`, `platform/access`, `platform/billing`.
- Add BFF contract and session exchange.

### Phase 2: Mail Merge migration
- Move business logic into `apps/mail_merge/*`.
- Remove local auth from migrated code; use platform session.

### Phase 3: Inbox IQ migration
- Move Inbox IQ features into `apps/inbox_iq/*`.
- Rebind all APIs through BFF + platform access checks.

### Phase 4: Outreach migration
- Move route/domain logic from Next API routes into FastAPI `apps/outreach/*`.
- Keep frontend pages, switch data source to BFF.

### Phase 5: hard cutover
- Turn off legacy auth paths.
- Freeze legacy repos to maintenance mode.
- Production monitoring + rollback windows.

---

## 12) Non-negotiable Security Rules
- No direct browser access to FastAPI from mini-app UI; go through BFF.
- All write endpoints require authenticated session and server-side policy checks.
- Webhooks require signature verification + idempotency keys.
- Audit logs for status changes, entitlement changes, login/logout, billing events.
- Admin actions are explicit, role-gated, and auditable.

---

## 13) Backend Modeling Conventions (Mandatory)
- Use **Pydantic models only** for request/response/internal service contracts.
- **Do not use `dataclass`** for API or service-layer data contracts.
- **No in-file local schema/model declarations** inside route/service files.
- All schema classes must live in dedicated module schema directories:
  - `app/platform/<module>/schemas/public.py`
  - `app/platform/<module>/schemas/internal.py` (if needed)
- Any deviation from these conventions is a spec violation.


