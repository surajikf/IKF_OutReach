# Frontend Changelogs

## 2026-05-05 - Pass 58 (Bug Fix: Outreach Wizard Module Resolution)
- **Import Resolution Fix:** Corrected a broken relative import path in the `OutreachCampaignWizard` (`page.tsx`) and re-routed `apiPath` to the correct internal library.

## 2026-04-21 - Pass 52 (User-isolated invoice integration & UI cleanup)
- **Invoice Configuration Modal:** Implemented a secure configuration modal in `import/page.tsx` for per-user API credential management (Active/Inactive streaming).
- **Integrations Studio UX:** Resolved structural JSX duplication and nesting errors, ensuring all modal components (Invoice, Zoho, Gmail) are correctly scoped and positioned.
- **Sync Orchestration:** Integrated real-time polling for background sync jobs with manual pulse triggers and status feedback.
- **User Isolation:** Refactored Zoho settings persistence to ensure configurations are strictly isolated to the authenticated user's account.
- Validation: `npm run build` (integrity verification).

## 2026-04-21 - Pass 51 (Mail Merge route simplification)
- **Consolidated Entry Point:** Removed legacy `/apps/mail-merge/home` route and `Home.tsx` landing page.
- **Start Campaign:** Rebranded the Build page (`/apps/mail-merge`) as the primary start page with updated "Start Campaign" labelling and a welcoming hero section.
- **Smart Redirects:** Added a 301 redirect in `next.config.ts` from `/apps/mail-merge/home` to the root `/apps/mail-merge` to handle legacy links securely.
- **UX Alignment:** Removed "Main" from sidebar navigation; "Build" renamed to "Start Campaign" in both sidebar and header breadcrumbs for better user guidance.
- Validation: `npm run build` (path verification).

## 2026-04-17 - Pass 50 (Agent card buttons + Mail Merge single scroll)
- **Inbox IQ `AgentCard`:** Replaced raw square controls with **`Button`** and **`Badge`** (`rounded-lg` / `rounded-md`); status/active chip uses outline **`Badge`**; toggle uses **`rounded-full`** track + circular thumb; “Connection required” uses **`rounded-lg`**.
- **Mail Merge Build (`FileUpload`):** **`studio-viewport--document`** — composer grows with content; **`AppLayout` `main`** is the only vertical scroller on upload step (removed **`studio-scroll-content`**). Media-query padding for short viewports skips the document viewport variant.
- Validation: `npm run build`.

## 2026-04-17 - Pass 49 (Remove empty `app/(platform)` route group)
- Deleted legacy empty directories `app/(platform)/hub` and `app/(platform)/login` (no `page.tsx`; routes are `app/hub` and `app/login`).
- Validation: `npm run build`.

## 2026-04-17 - Pass 48 (Design docs consolidation)
- **Documentation:** Merged `docs/DESIGN_SYSTEM_UNIFICATION_PLAN.md` and `docs/DESIGN_SYSTEM_DEBT.md` into a single root [`DESIGN.md`](DESIGN.md). Removed the `docs/` folder. Updated [`AGENTS.md`](AGENTS.md) to link to `DESIGN.md`.
- **Tooling:** Removed `lint:design-tokens` from `package.json` (it pointed at `scripts/check-no-arbitrary-tailwind-hex.mjs`; the `scripts/` directory was not present in the tree). Dropped `scripts/**` from ESLint `globalIgnores`.
- Validation: `npm run build`.

## 2026-04-17 - Pass 47 (Light palette: lavender canvas + indigo primary)
- **`app/globals.css`:** Replaced the light theme’s **`--primary: blue`** (browser default / harsh electric blue) with a defined **indigo** `hsl(241, 58%, 44%)` and **`--primary-foreground: #ffffff`**. Page canvas is **`#F4F4FE`** (`--background`) with **white** cards, harmonized **muted / border / secondary** tints, **ring** aligned to primary, **chart** hues adjusted to the same family, and **mesh blobs** softened to low-alpha violets. Documented semantic roles in a short palette comment block.
- Validation: `npm run build`.

## 2026-04-17 - Pass 46 (Hub + mini-app shell: mesh, floating main, sidebar account)
- **Hub (`HubShell` / `HubCatalog`):** Removed the nested `ikf-floating-stage` “device frame.” Catalogue is **centered** on the mesh background with **three app tiles**; copy references signed-in email while **account + logout stay in `UnifiedHeader`** (top right). Header bar uses a lighter treatment on the mesh.
- **Inbox IQ chrome:** **Gradient mesh** full-screen; **naked** sidebar (no `sidebar-surface`) with **collapsible** rail (`localStorage` `ikf-inbox-sidebar-collapsed`), **account pill + logout bottom-left**. Main column uses **`ikf-floating-stage`** with **top / right / bottom** inset padding so the work surface reads as a **single floating panel**. Command Center is **chat-only** (blocked domains removed from this route).
- **Blocked domains:** Moved to **Settings** via `BlockedDomainsSettings` (`addToBlockList` / `removeFromBlockList` unchanged).
- **`ControllerChat`:** Full-bleed inside the floating panel (no inner card border in full mode).
- **Mail Merge + Outreach:** Same **mesh + naked collapsible sidebar + floating main + bottom account** pattern (`ikf-mailmerge-sidebar-collapsed`, `ikf-outreach-sidebar-collapsed`). Mail Merge keeps header + scroll **inside** the floating stage.
- Validation: `npm run build`.

## 2026-04-17 - Pass 45 (Corner radius token alignment)
- **Design contract:** `app/globals.css` already documents the radius tier ladder (`rounded-sm` … `rounded-4xl`, `rounded-full`); this pass applies it across Mail Merge, Inbox IQ Command Assistant, and Outreach so panels/composers/modals use **`rounded-2xl`**, nested controls use **`rounded-lg` / `rounded-xl`**, and **`rounded-3xl`** is reserved for dashed empty-state / hero blocks only.
- **Mail Merge:** `Dashboard` arbitrary pixel radii → token classes; `ContactsHub` stepped nested surfaces (search/org/dialog/inner panels); `ConfigurationStudio` integration cards + skeletons use `rounded-2xl` to match other panels.
- **Inbox IQ:** `ControllerChat` outer shell and composer input shell use `rounded-2xl` (was `rounded-3xl`).
- **Outreach:** Section cards, modals, and sticky shells on `page`, `import`, `clients`, and `history` (detail modal) use `rounded-2xl`; history empty-state dashed zone keeps `rounded-3xl` as the hero empty tier.
- Validation: `npm run build`.

## 2026-04-17 - Pass 44 (Mail Merge chrome + Contact Intel hierarchy; Inbox IQ typography)
- **Mail Merge `AppLayout`:** Removed Radix sidebar and header tooltips that rendered as dark “helper flags” (`TooltipContent` uses inverted `bg-foreground`). Navigation links are plain `Link`s; “Start new” uses `title` only; sender status chip uses `title` + keyboard support instead of a tooltip.
- **Header bar:** `min-w-0`, wrapping, and flex basis so the page title and actions stay on-screen on narrow widths without clipping off the right edge.
- **Contact Intel (`ContactsHub`):** Replaced source filter `Badge` components with native `<button>`s so `variant="default"` / `bg-primary` no longer forced every chip to the same primary blue (`#0202FE`-class tokens). Inactive chips use light tinted backgrounds per source (violet / indigo / sky / emerald); active states use matching solid fills with **white** label text for contrast. Segment tabs use `border-foreground` for the active indicator instead of primary-only. Organizations list uses `secondary` for the selected domain instead of primary. Search/sync row stacks on small viewports; search input uses `border-border` / `bg-background`.
- **Inbox IQ overview:** Dropped `font-serif` display styling; applied a clear scale (`h1` 3xl/4xl semibold, `h2` xl/2xl, body `text-base` / `text-sm`) and a single section border with stats + “Add agent” aligned on large screens.
- Validation: `npm run build`.

## 2026-04-15 - Pass 1 (Auth + Hub + Mail Merge Vertical Slice)
- Replaced starter Next.js scaffold with IKF Solutions Hub app-shell and routing:
  - `/login`
  - `/hub`
  - `/apps/mail-merge`
  - `/apps/[slug]` placeholder for non-migrated mini-apps
- Implemented centralized auth session flow via Next.js BFF:
  - `POST /api/auth/session/exchange`
  - `POST /api/auth/session/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/logout-all`
  - session cookies (`ikf_at`, `ikf_rt`, `ikf_user`)
- Implemented generic BFF proxy route:
  - `/api/bff/[...path]` forwarding to FastAPI `/api/v1/*`
  - automatic token forwarding (`x-access-token`)
  - refresh-token retry on `401`
  - cookie rotation after refresh
- Added route protection with Next `proxy.ts` matcher for `/hub/*` and `/apps/*`.
- Built Hub catalog UI connected to backend APIs:
  - loads current user + app catalog
  - performs launch access check
  - opens mini-app in a new tab on success
- Built Mail Merge UI connected through BFF APIs:
  - settings fetch/update
  - campaign import from file upload
  - campaign list and basic state actions (pause/resume/queue send)
  - recipient viewer
  - contacts listing + search
  - campaign creation from contacts + quick launch campaign
- Added frontend env contract file `.env.example`.

## 2026-04-15 - Pass 2 (Proper Firebase Frontend Auth)
- Replaced token-paste login with real Firebase Web SDK authentication:
  - email/password sign-in
  - email/password sign-up
  - Google provider sign-in (popup with redirect fallback)
- Added Firebase client bootstrap:
  - `lib/firebase/client.ts` for app/auth initialization
  - strict env-based configuration checks (`NEXT_PUBLIC_FIREBASE_*`)
- Added Firebase-to-platform session bridge:
  - `lib/auth/firebase-exchange.ts` exchanges Firebase ID token via `/api/auth/session/exchange`
  - login bootstrap now handles redirect result + existing Firebase user session
- Updated logout behavior:
  - backend logout endpoint call
  - Firebase `signOut` to clear frontend identity state
- Updated frontend env contract to Firebase config keys and removed local test-token login path.

## 2026-04-15 - Pass 3 (Google-only Firebase Auth Enforcement)
- Removed all email/password auth paths from frontend login flow.
- Enforced Google provider as the only interactive login method.
- Kept popup auth with redirect fallback and session exchange bootstrap.
- Updated login copy to explicitly state Google-only authentication policy.

## 2026-04-15 - Pass 4 (Mail Merge UX Parity Expansion)
- Expanded Mail Merge app UI to cover newly migrated backend capabilities through Next BFF only:
  - campaign preflight validation (`/campaigns/{id}/validate`)
  - test email dispatch (`/campaigns/{id}/test-email`)
  - AI drafting tools (`/ai/help-me-write`, `/ai/polish-draft`)
  - manual contact sync trigger (`/contacts/sync`)
- Added sender-account management UX:
  - create SMTP account
  - activate account
  - delete account
  - active-account visibility in dashboard
- Added template management UX:
  - create template
  - list template catalog with version/type/category visibility
- Expanded campaign actions in UI:
  - cancel
  - retry failed
- Extended shared frontend types for all new Mail Merge response contracts.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-15 - Pass 5 (Mail Merge Frontend Port Correction)
- Replaced the drifted simplified Mail Merge UI route with a Next.js App Router port of the existing Mail Merge frontend screens.
- Moved Mail Merge app-specific frontend code into `features/mail-merge/`:
  - `screens/` for ported product screens
  - `utils/` for app-local helpers and API adaptation
  - app-specific `AppLayout` and platform-session `AuthContext`
- Removed the duplicate bad route structure under `app/(apps)/apps/*` and moved the app to the real launch URL:
  - `/apps/mail-merge`
  - `/apps/mail-merge/home`
  - `/apps/mail-merge/contacts`
  - `/apps/mail-merge/dashboard`
  - `/apps/mail-merge/settings`
  - `/apps/mail-merge/users`
- Removed local Mail Merge login/protected-route screens from the migrated frontend path; app access now relies on IKF platform session and launch gating.
- Added a Mail Merge client API adapter so the ported screens call the consolidated BFF path `/api/bff/apps/mail-merge/*` instead of the standalone backend API paths.
- Updated `proxy.ts` to convert a validated launch ticket into a scoped app-grant cookie so in-app Next navigation does not lose access after the initial `/apps/mail-merge?lt=...` launch.
- Preserved original Mail Merge UI screens and styling instead of rebuilding the product UI.
- Validation:
  - `npm run lint` passed with warnings only from broad eslint-disable comments on ported source files.
  - `npm run build` passed and verified the generated routes are under `/apps/mail-merge/*`.

## 2026-04-15 - Pass 6 (Route-local Mail Merge Next.js Structure)
- Moved the Mail Merge frontend port from root-level `features/mail-merge/` into the Next.js App Router route subtree:
  - `app/apps/mail-merge/_components/`
  - `app/apps/mail-merge/_lib/`
  - `app/apps/mail-merge/_styles/`
- Kept public route files under `app/apps/mail-merge/**/page.tsx`, with private route-local folders excluded from routing by the `_` prefix.
- Replaced remaining route imports with route-local relative imports.
- Fixed app-local navigation leaks that could send users to platform-root paths:
  - `Connect Now` now opens `/apps/mail-merge/settings` instead of `/settings`.
  - access-pending back button now returns to `/apps/mail-merge` instead of `/`.
  - login prompts redirect to `/login?next=/apps/mail-merge` instead of a removed local `/auth` route.
  - empty dashboard CTA now returns to the Mail Merge composer instead of `/build`.
- Validation:
  - `npm run lint` passed with warnings only from broad eslint-disable comments on ported source files.
  - `npm run build` passed and verified generated routes remain under `/apps/mail-merge/*`.

## 2026-04-15 - Pass 7 (Stale Mail Merge Route Cleanup)
- Deleted stale empty/source route folders from the previous drifted attempts:
  - `app/(apps)/`
  - `app/(apps)/apps/[slug]/`
  - `app/(apps)/apps/mail-merge/`
  - empty `app/apps/mail-merge/config/`
- Removed stale generated `.next` cache so old `(apps)` chunks no longer appear in local searches.
- Confirmed no source references remain to stale Mail Merge locations:
  - `features/mail-merge`
  - `components/mail-merge`
  - `utils/mail-merge`
- Validation:
  - `npm run lint` passed with warnings only from broad eslint-disable comments on ported source files.
  - `npm run build` passed and generated only the intended `/apps/mail-merge/*` routes.

## 2026-04-15 - Pass 8 (Platform Route Group Login Move)
- Moved the login route into the platform route group:
  - from `app/login/page.tsx`
  - to `app/(platform)/login/page.tsx`
- Kept the public URL unchanged as `/login`; route groups remain filesystem organization only.
- Validation:
  - `npm run lint` passed with warnings only from broad eslint-disable comments on ported Mail Merge files.
  - `npm run build` passed and confirmed `/login`, `/hub`, and `/apps/mail-merge/*` routes remain intact.

## 2026-04-15 - Pass 9 (Mail Merge Native Next.js Internals Cleanup)
- Replaced Mail Merge's Axios-style browser client dependency with a route-local `fetch` wrapper in `app/apps/mail-merge/_lib/http.ts`.
- Removed `axios` and `react-router-dom` from frontend dependencies; Mail Merge now uses Next.js App Router navigation primitives only.
- Tightened Mail Merge client/BFF response typing across preserved ported screens so strict TypeScript builds validate the route-local app internals.
- Removed malformed broad eslint-disable comments and eliminated remaining Mail Merge lint errors/warnings without changing the product UI.
- Removed stale app-local user-management route/component from the Mail Merge port.
- Fixed stale post-send navigation from the removed `/status/:id` route to the existing Mail Merge dashboard flow.
- Preserved the existing Mail Merge product screens and behavior while removing duplicate/stale port artifacts.
- Validation:
  - `npm run lint` passed with no warnings.
  - `npm run build` passed with Next.js App Router routes generated for `/apps/mail-merge/*`, `/hub`, and `/login`.
  - Searched for stale Mail Merge Axios/React Router/Vite/launch-token URL/status-route patterns in source.

## 2026-04-16 - Pass 10 (Mail Merge Global Logout Fix)
- Fixed Mail Merge account-menu logout to call the BFF logout endpoint with `POST` instead of navigating to the POST-only route with browser `GET`.
- Changed app logout to use global logout (`/api/auth/logout-all`) to match the hub session contract.
- Added a local-storage logout broadcast so other same-origin tabs can react to app-initiated global logout.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-16 - Pass 11 (Mail Merge True Signout + Client Header Cleanup)
- Hardened Mail Merge app logout so it now clears Firebase client auth state in addition to backend session invalidation.
- Ensured Firebase signout is enforced even if backend logout call fails, preventing auto-login loops when landing on `/login`.
- Added cross-tab handling to clear Firebase state before redirect when logout is broadcast.
- Removed browser-side admin header injection from Mail Merge API helper to avoid leaking admin-key patterns in public client requests.
- Aligned Mail Merge account settings client typing for SMTP account IDs with backend UUID/string IDs.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-16 - Pass 12 (Mail Merge OAuth Callback UX + MUI Hydration Stability)
- Added Emotion SSR registry/cache provider at app root to stabilize MUI style insertion during Next.js App Router hydration.
- Fixed Mail Merge settings OAuth callback handling:
  - server page now reads `auth`/`error` query params and passes them to the client component
  - settings UI now surfaces OAuth success/failure feedback and refreshes account list on successful Gmail connect
  - callback query params are cleaned from URL after handling.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-16 - Pass 13 (RichTextEditor AI Draft Blur Null-Target Fix)
- Fixed Mail Merge AI draft editor runtime error `Cannot read properties of null (reading 'innerHTML')` in the content-editable blur handler.
- Captured `innerHTML` from the blur event synchronously before state update instead of reading `e.currentTarget` inside the state-updater callback.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-16 - Pass 14 (Hub Launch Check Stops Implicit Trial Start)
- Updated Hub app-launch access check request to send `auto_start_trial=false`.
- Prevents implicit trial creation on simple app-open attempts; trial activation now requires explicit opt-in request path.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-16 - Pass 15 (Session/Cookie Hardening + Access Gate Contract Alignment)
- Removed legacy trial field from hub access-check payload:
  - Hub launch now posts only `{ app_slug }` to `/platform/access/check`.
- Hardened session cookie policy:
  - `ikf_at`, `ikf_rt`, and `ikf_user` cookies now use `HttpOnly` + `SameSite=strict`.
  - Removed non-httpOnly exposure of user-session cookie payload.
- Tightened BFF auth failure handling:
  - Session exchange/refresh failures now clear all platform session cookies.
  - Also clears any residual app-grant scoped cookies during failed auth transitions and logout flows.
- Strengthened app-route entitlement gating:
  - Proxy now performs server-side `/platform/access/check` for `/apps/{slug}` requests and only allows navigation when backend says `allowed=true`.
  - Eliminates stale/weak app-grant cookie-only gating for privileged app routes.
- Removed localhost backend fallback from server proxy client:
  - `BACKEND_API_BASE_URL` is now required for BFF backend forwarding.
- Updated frontend `.env.example` to use non-localhost example API base URL.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## 2026-04-16 - Pass 16 (Secure App Launch Grants + Mail Merge Send Scheduling Payload)
- Hardened hub/app launch flow so launch-ticket material no longer passes through browser payloads:
  - Hub now calls `/api/app-launch` with only `{ app_slug }`.
  - BFF route performs server-side access check + launch-ticket validation and sets app-grant cookie as `HttpOnly`.
- Strengthened app-route gate in `proxy.ts`:
  - Requires a valid per-app launch grant on `/apps/{slug}` routes.
  - Auto-recovers expired/missing grants by re-checking backend entitlement server-side and minting a fresh grant.
  - Redirects to `/hub` when entitlement/launch validation fails.
- Improved app-grant cookie lifecycle:
  - Added safe app-slug validation helpers.
  - Added path-aware grant-cookie cleanup on logout/logout-all/session exchange failure/session refresh failure so `/apps/{slug}` scoped cookies are explicitly invalidated.
- Wired Mail Merge frontend send request to backend orchestration contract:
  - `/campaigns/{id}/recipients/send` now includes `scheduled_for` (all-at-once scheduled send) and `campaign_pacing` (batched send windows) based on composer delivery mode.
- Updated frontend env contract with `APP_GRANT_COOKIE_TTL_SECONDS`.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 17 (Inbox IQ Frontend Entry Route Bootstrap)
- Added initial Inbox IQ app route so Hub launch to `/apps/inbox-iq` no longer lands on a missing page:
  - `app/apps/inbox-iq/layout.tsx`
  - `app/apps/inbox-iq/page.tsx`
- Wired page to BFF-only backend access (`/api/bff/apps/inbox-iq/onboarding/state`) to preserve the no direct browser-to-FastAPI contract.
- Exposed live onboarding stage/status readout from backend as the first functional shell for incremental lift-and-drop porting of source Inbox IQ screens.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 18 (Inbox IQ Agents Workspace Lift/Drop + BFF API Client)
- Replaced Inbox IQ placeholder page with a lifted agents workspace shell aligned to source structure and copy:
  - Added `/apps/inbox-iq`, `/apps/inbox-iq/overview`, and `/apps/inbox-iq/agents` work pages backed by the same workspace component.
  - Added `/apps/inbox-iq/onboarding` with functional onboarding write flows to the new backend onboarding endpoints.
- Added Inbox IQ app-local layout/header navigation for Onboarding/Overview/Agents routes.
- Added app-local Inbox IQ API client at `app/apps/inbox-iq/_lib/api.ts`:
  - all requests route through Next BFF (`/api/bff/apps/inbox-iq/*`)
  - no direct browser-to-FastAPI calls.
- Added lifted Inbox IQ components:
  - `AgentCard` (status/readiness UI and activation/pause actions)
  - `CreateAgentModal` (agent creation form)
  - `AgentsWorkspace` (load onboarding + analytics + agents, readiness fan-out, create/pause/resume interactions)
- Wired workspace actions to new backend routes for agents and analytics overview.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 19 (Inbox IQ Settings Completion + Activity + Command Center Pages)
- Expanded Inbox IQ app navigation to match source workflow slices now ported:
  - added links for `Command Center`, `Activity`, and `Settings` in `app/apps/inbox-iq/layout.tsx`.
- Completed Inbox IQ app-local BFF API client contract (`app/apps/inbox-iq/_lib/api.ts`) for:
  - email activity feed/detail + draft approve/discard
  - Gmail viewer list/detail
  - command-center block-list/global-rules/master-kb
  - command assistant chat.
- Added new Inbox IQ pages:
  - `app/apps/inbox-iq/emails/page.tsx` (inbox/sent viewer + drafted reply actions)
  - `app/apps/inbox-iq/command-center/page.tsx` (blocked values, global rules, master KB, assistant chat).
- All browser calls in this slice continue to go only through Next.js BFF (`/api/bff/apps/inbox-iq/*`), with no direct browser-to-backend API calls.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 20 (Inbox IQ Command Center Lift-and-Refactor From Source)
- Replaced custom Command Center frontend implementation with lifted source structure from `IKF-Email-Automation` and refactored only for Next.js app-local wiring:
  - added lifted `ControllerChat` component at `app/apps/inbox-iq/_components/ControllerChat.tsx`
  - replaced `app/apps/inbox-iq/command-center/page.tsx` with source-like blocked-domains sidebar + assistant layout.
- Preserved architecture constraints:
  - no direct browser calls to backend
  - all frontend API access remains through `/api/bff/apps/inbox-iq/*`.
- Refactored source component integrations to current target contracts:
  - uses `getOnboardingState()` for resolved `company_id`
  - uses app-local BFF API helpers (`getAgents`, `sentinelChat`, instruction-module endpoints)
  - retained module command workflows (`modules list`, `modules preview`, `module add`, two-step `module delete`).
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 21 (Inbox IQ BFF API Contract: Agent Builder + Draft Preview)
- Extended app-local Inbox IQ API client (`app/apps/inbox-iq/_lib/api.ts`) to align with source Agent Builder contracts:
  - updated `sentinelChat` payload to support `mode`, `agent_builder_draft`, and `agent_builder_history`
  - expanded `InboxIQSentinelChat` type with `agent_builder` and orchestration payload shapes.
- Added new app-local API client contract for draft preview:
  - `previewAgentDraftReply(payload)` -> `/api/bff/apps/inbox-iq/command-center/agent-draft/preview-reply`.
- This keeps all browser traffic on the Next.js BFF boundary (`/api/bff/apps/inbox-iq/*`) with no direct browser-to-backend calls.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 22 (Inbox IQ Lifted Create/Configure Modal + Builder/Preview UX)
- Replaced simplified Inbox IQ create modal with lifted source-style create/configure workflow:
  - added builder conversation panel wired to `sentinelChat(mode="agent_builder")`
  - added draft preview panel wired to `previewAgentDraftReply(...)`
  - added required-field progress/missing tracking based on source field set.
- Updated agents workspace wiring:
  - card click now opens configure modal for existing agents
  - create modal and configure modal now both route through the lifted form contract
  - form keyword fields map to backend arrays (`subject_examples`, `ignored_domains`) for create/update calls.
- Added lifted overview composer interaction in agents workspace:
  - floating Command Assistant toggle with `ControllerChat mode="composer"` wired to resolved company context.
- Updated `AgentCard` interaction model:
  - card supports keyboard/click open for configure flow
  - status toggle action now stops propagation to avoid accidental modal opens.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 23 (Inbox IQ One-View Response Modal + Simulation API Wiring)
- Extended app-local Inbox IQ API client with simulation run contracts:
  - request/response types for dry-run simulation
  - `runSimulation(...)` wired to `/api/bff/apps/inbox-iq/simulation/run`.
- Added lifted `AgentViewResponseModal` component for saved-agent response preview:
  - sample sender/subject/body inputs
  - renders simulation action/intent/reasoning/rules
  - renders HTML preview and raw HTML output.
- Updated agent workspace/card wiring:
  - added `View Response` action on cards
  - opens new one-view response modal for selected agent.
- Preserved architecture constraints:
  - all browser calls remain routed through Next.js BFF (`/api/bff/apps/inbox-iq/*`)
  - no direct browser-to-backend API calls.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 24 (Inbox IQ Process Email BFF Contract)
- Extended Inbox IQ frontend API contract (`app/apps/inbox-iq/_lib/api.ts`) with source-parity process endpoint types:
  - `InboxIQProcessEmailRequest`
  - `InboxIQProcessEmailResponse`.
- Added `processEmail(payload)` helper wired through Next.js BFF:
  - `POST /api/bff/apps/inbox-iq/emails/process`.
- Preserved architecture boundary:
  - browser continues to call only Next.js BFF routes (no direct browser-to-backend calls).
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 25 (Inbox IQ API Contract Parity: Analytics + Agent Metrics)
- Extended Inbox IQ frontend API contracts in `app/apps/inbox-iq/_lib/api.ts` for newly ported backend parity routes:
  - analytics point types (`volume`, `intent`, `agent-performance`, `tone`, `thread-depth`, `language`)
  - agent metrics types (`agent emails`, `agent stats`).
- Added app-local API helpers (BFF-only):
  - `getAnalyticsVolume`, `getAnalyticsIntent`, `getAnalyticsAgentPerformance`
  - `getAnalyticsTone`, `getAnalyticsThreadDepth`, `getAnalyticsLanguage`
  - `getAgentEmails`, `getAgentStats`.
- All new calls remain scoped to Next.js BFF routes (`/api/bff/apps/inbox-iq/*`), preserving no direct browser-to-backend access.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 26 (Inbox IQ API Contract Parity: KB + Studio + Orchestrate)
- Extended Inbox IQ app-local BFF API contract in `app/apps/inbox-iq/_lib/api.ts` with source-parity types and helpers for:
  - Sentinel orchestrate endpoint (`orchestrateInstruction`)
  - Intelligence Studio (`processStudioInstruction`, `getStudioHistory`)
  - Knowledge Base categories/entries CRUD (`get/create/update/delete`).
- Added explicit shared orchestration response type for consistent usage across:
  - direct orchestrate call
  - `sentinelChat(...).orchestration`.
- Preserved architecture boundary:
  - all new browser-facing calls route through Next.js BFF (`/api/bff/apps/inbox-iq/*`)
  - no direct browser-to-backend requests.
- Validation:
  - `npm run build` passed

## 2026-04-16 - Pass 27 (Inbox IQ Gmail OAuth API Contract: Add POST Callback Helper)
- Extended Inbox IQ frontend BFF contract in `app/apps/inbox-iq/_lib/api.ts` with source-parity POST callback support:
  - added `InboxIQGmailCallbackResponse` type
  - added `postGmailCallback({ code, state, refresh_token?, expires_in? })`
  - routed through Next.js BFF path: `POST /api/bff/apps/inbox-iq/gmail/callback`.
- This keeps callback completion support available in app-local API contracts without introducing any direct browser-to-backend calls.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 28 (Inbox IQ Unexpected Diverts Fix: Shell, Routing, Agents Flow)
- Replaced the Inbox IQ app shell with a source-parity dashboard chrome:
  - added `app/apps/inbox-iq/_components/AppChrome.tsx`
  - updated `app/apps/inbox-iq/layout.tsx` to server-wrap chrome with session user cookie context
  - restored source-style top nav, user menu, light/dark toggle, onboarding-nav hide behavior, and app-local sign-out action via `/api/auth/logout-all`.
- Fixed route behavior drift:
  - updated `app/apps/inbox-iq/page.tsx` to redirect to `/apps/inbox-iq/overview` (source parity).
- Replaced custom `agents` implementation with source-style behavior:
  - rewrote `app/apps/inbox-iq/_components/AgentsWorkspace.tsx`
  - restored configure/create/view-response modal flows and source page copy
  - kept all data access routed through Inbox IQ BFF API helpers.
- Restored source-style agent card behavior:
  - rewrote `app/apps/inbox-iq/_components/AgentCard.tsx`
  - reinstated activation gating + connect CTA behavior (Gmail auth launch), toggle affordance, and card presentation.
- Added activation helper parity:
  - `app/apps/inbox-iq/_lib/agentActivation.ts`.
- Added source agent artwork assets:
  - `public/agent-images/support.png`
  - `public/agent-images/sales.png`
  - `public/agent-images/hr.png`.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 29 (Inbox IQ Design Token Parity with IKF-Email-Automation)
- Ported Inbox IQ design-system tokens and themed utility styling from source design language into target frontend:
  - updated `app/globals.css` with Inbox IQ token block and source-style utility classes/light-mode parity overrides used by Inbox IQ pages/components.
- Scoped app token application at the Inbox IQ shell level:
  - updated `app/apps/inbox-iq/_components/AppChrome.tsx` root wrapper class to `inboxiq-theme`.
- Why:
  - previous token drift caused Inbox IQ palette/readability mismatch versus IKF-Email-Automation.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 30 (Inbox IQ UX Fixes: Theme Application + Modal Responsiveness)
- Fixed token application behavior for Inbox IQ app shell:
  - adjusted app chrome theme bootstrapping to start in dark mode consistently (prevent stale light-theme local state from overriding Inbox IQ token palette).
  - file: `app/apps/inbox-iq/_components/AppChrome.tsx`.
- Improved agent configure/create modal responsiveness and viewport behavior:
  - reduced outer padding at small breakpoints
  - switched modal height to viewport-relative constraints (`100dvh` minus shell padding)
  - moved dual-column layout to `lg+` breakpoints
  - constrained builder panel height on smaller screens
  - tightened internal spacing for mobile/tablet fit.
  - file: `app/apps/inbox-iq/_components/CreateAgentModal.tsx`.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 31 (Outreach Frontend Lift: Hub/BFF Architecture Alignment + Secret Exposure Removal)
- Lifted Outreach source frontend into app namespace routes under `app/apps/outreach/*`:
  - pages: dashboard, clients, campaigns, campaigns/results, history, import, settings
  - components: sidebar, wrappers, modals, rich editor, smart loader, UI atoms
  - app-local shared libs/types copied under `app/apps/outreach/shared/*`.
- Added Outreach app layout wired to Hub session cookie model:
  - new `app/apps/outreach/layout.tsx`
  - uses `decodeUserCookie(...)` from platform auth session utilities
  - no `next-auth` session provider usage.
- Rewired app routing + API path strategy for architecture compliance:
  - replaced source base-path helper with fixed app/bff paths:
    - app routes => `/apps/outreach/*`
    - API routes => `/api/bff/apps/outreach/*`
  - file: `app/apps/outreach/_lib/app-path.ts`.
- Removed source auth/provider coupling and browser-side secret controls:
  - removed `next-auth` usage from Outreach app components/pages
  - replaced logout with Hub session endpoint (`/api/auth/logout-all`)
  - replaced Google connect actions with backend OAuth start endpoint via BFF (`/api/bff/apps/outreach/auth/google/start`)
  - replaced Zoho auth-link action with env-readiness indicator (avoids dead client-auth route while Zoho creds are env-owned)
  - removed Settings UI controls for LLM provider/model and API key entry; retained backend connectivity test only.
- Removed direct non-BFF import call in Outreach import flow:
  - Gmail import now calls `apiPath("/import/gmail")` instead of source `/api/import/gmail`.
- Added required frontend dependencies for lifted source UI/runtime:
  - `framer-motion`, `sonner`, `date-fns`, `clsx`, `tailwind-merge`
  - `@tiptap/react` + required tiptap extensions used by Outreach rich editor.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 32 (Outreach Dashboard Runtime Hardening for Partial Stats Payloads)
- Fixed Outreach dashboard runtime crash in `app/apps/outreach/page.tsx` caused by partial API payloads missing nested blocks such as `audienceState`.
- Added stable default dashboard contract object and deep merge normalization for fetched stats data:
  - nested fallbacks for `stats.trends.sparklines`, `sourceStats`, `dataHealth`, `audienceState`, `campaignState`, `recommendedAction`
  - array guards for `chartData`, `industryDistribution`, `serviceUtilization`, `recentCampaigns`, `processChecklist`.
- Why:
  - prevents UI crashes when backend returns a partial/older response shape during migration and keeps dashboard render-safe under incremental backend rollout.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 33 (Outreach Campaign Payload Resilience + TipTap Extension Collision Fix)
- Fixed Outreach campaign preview/results parsing resilience for legacy history rows:
  - upgraded shared parser `app/apps/outreach/shared/lib/campaign-output.ts` to support fallback subject and tolerant body extraction from legacy payload shapes.
  - parser now normalizes/sanitizes email body before returning to UI state.
- Updated Outreach campaign screens to consume shared parser:
  - `app/apps/outreach/campaigns/page.tsx` sample generation parse now uses shared parser instead of raw `JSON.parse`.
  - `app/apps/outreach/campaigns/results/page.tsx` now parses with `fallbackSubject` (`campaignTopic`) and no longer hard-fails on legacy rows.
- Removed TipTap duplicate extension registration warning:
  - `app/apps/outreach/_components/RichTextEditor.tsx`
  - configured `StarterKit` with `link: false` and `underline: false` while retaining explicit `Link`/`Underline` extensions.
- Why:
  - resolved user-facing “Campaign payloads are invalid. Please regenerate campaigns.” for legacy payloads.
  - removed editor runtime warnings caused by duplicate extension names.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 34 (Outreach Results Toast Spam Fix + App-Scoped Results Redirect)
- Fixed repeated false-negative error toasts on Outreach campaign results screen:
  - updated `app/apps/outreach/campaigns/results/page.tsx` fetch processing so empty result sets are no longer treated as invalid payload by default.
  - now only shows the invalid-payload toast when rows exist but none are parseable.
  - added toast deduping via stable toast id (`outreach-invalid-campaign-payload`) to prevent stacked duplicate banners.
- Fixed app routing drift after batch generation:
  - updated `app/apps/outreach/campaigns/page.tsx` to navigate using app-scoped paths via `appPath(...)` instead of hardcoded root `/campaigns/results`.
- Why:
  - eliminated noisy “Campaign payloads are invalid...” banner spam when backend responses are valid but filtered/empty.
  - ensured results navigation stays within `/apps/outreach/*` route namespace.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 35 (Outreach History Route Namespace Drift Fix)
- Fixed remaining app-route drift in Outreach history actions:
  - updated `app/apps/outreach/history/page.tsx` record action navigation from hardcoded `/clients` to app-scoped `appPath("/clients")`.
- Why:
  - preserves app namespace routing (`/apps/outreach/*`) and avoids redirecting to a non-existent root route in the unified hub architecture.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 37 (Hub Root + Remove Cross-App Shell + Per-App Nav)
- **Hub is `/`**: `app/page.tsx` now renders the signed-in catalogue inside `HubShell` + `HubCatalog`; unauthenticated visits redirect to `/login?next=/`.
- **Removed wrong global shell**: deleted `AppShell`, `UnifiedSidebar`, and the `(platform)` hub route; `app/apps/layout.tsx` is **AuthProvider + min-height canvas only** (no shared product sidebar/header).
- **Legacy `/hub`**: `app/hub/page.tsx` permanently redirects to `/`; `proxy.ts` denial/invalid slug redirects now target `/` and matcher includes `/` instead of `/hub/*`.
- **Outreach**: new `OutreachAppChrome` (local glass sidebar + route chrome) replaces `ClientWrapper`; navigation is Outreach-only via `appPath`.
- **Inbox IQ**: new `InboxAppChrome` (local sidebar + onboarding redirect logic) replaces `AppChrome`.
- **Catalogue UX**: `HubCatalog` uses shadcn `Button` (“Open in new tab”); launches remain `window.open(..., noopener,noreferrer)`.
- **Login**: default post-login `next` is `/`; Google CTA uses shadcn `Button` (real control sizing).
- Why:
  - aligns routing with the super-app model (catalogue at `/`, each mini-app in its own tab with its own nav), and removes the mistaken “four apps including hub” sidebar.
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 36 (Shell Routing + PMS-Style Canvas)
- Split **control plane** vs **work plane** chrome:
  - added `app/login/` with its own layout (mesh only, no sidebar) and moved login UI out of `(platform)` so `/login` never mounts `AppShell`.
  - replaced `(platform)/layout` app shell with new `HubShell` (`components/hub-shell.tsx`): mesh + **floating** `ikf-floating-stage` panel + header without sidebar trigger; `/hub` no longer shows the product sidebar.
  - `AppShell` (`components/app-shell.tsx`) now keeps the product sidebar only under `/apps/*`, with the header + scroll region inside a **raised** floating stage beside the glass sidebar (margin/gap from mesh), matching the intended “content on top of the canvas” language.
- Visual tokens (light): shifted **mesh** and sidebar wash toward **soft blue** radial gradients; sidebar glass blobs use blue/cyan mixes instead of violet-forward fills; `input-ribbon` leans blue→violet for accent only.
- Global base: relaxed `html, body` from `h-full overflow-hidden` to `min-h-full` + horizontal clip so public/login pages can scroll when needed; app routes still use `h-screen` + internal overflow on shells.
- Hub and login copy/layout polish: semantic Tailwind tokens, `flex`/`gap` instead of `space-y`, proper ellipsis in loading/processing strings.
- Why:
  - login and hub are not mini-apps; forcing the full product sidebar was incorrect IA and matched neither SPEC intent nor the reference PMS layout (mesh field + elevated content, sidebar only where product switching matters).
- Validation:
  - `npm run build` passed

## 2026-04-17 - Pass 37 (Mail Merge ContactsHub UI migration)
- Migrated `app/apps/mail-merge/_components/ContactsHub.tsx` off `@mui/material`, `@mui/icons-material`, and `sweetalert2` to Tailwind + shadcn (`Button`, `Input`, `Card`, `Table`, `Badge`, `Dialog`, `Sheet`, `Skeleton`, `Tooltip`, `Separator`, `Textarea`, `Avatar`) and `lucide-react` icons.
- Replaced SweetAlert toasts with `mmToast` from `app/apps/mail-merge/_lib/mm-toast.ts` (sonner); 409 sync conflict uses `mmToast.info` with title + description.
- Replaced Swal bulk-tag prompt with a shadcn `Dialog` + `Input` and Confirm/Cancel (same `POST /contacts/bulk-tag` on confirm).
- Replaced `TablePagination` with Prev/Next controls plus a native rows-per-page select (10/25/50) to preserve paging behavior.
- Replaced MUI `Stepper` in quick-send with a numbered two-step header; detail drawer uses `Sheet`; floating selection bar uses fixed Tailwind layout.
- Why: align Mail Merge contacts UI with the rest of the shadcn/Tailwind stack and remove MUI/Swal dependencies from this surface.
- Validation:
  - `npx tsc --noEmit` (no `ContactsHub` diagnostics); `read_lints` clean for `ContactsHub.tsx`.

## 2026-04-17 - Pass 38 (Theme script fix + remove dead Mail Merge deps)
- **React 19 / Next 16:** Removed `next-themes` `ThemeProvider` because `next-themes` renders an inline `<script>` that triggers the dev warning *“Encountered a script tag while rendering React component”* (scripts from React trees are not executed as real scripts). Root layout now wraps children with `TooltipProvider` only; global theme stays **light** via app tokens.
- **`components/ui/sonner.tsx`:** Toaster uses fixed `theme="light"` (no `useTheme`).
- **Deleted** `components/theme-provider.tsx` (unused after the above).
- **Dependencies:** Dropped `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `sweetalert2`, and `next-themes` from `package.json` — Mail Merge UI no longer imports these; keeping them was misleading and bloated install.
- Why: clear the console error on every navigation and finish the dependency cleanup for the Mail Merge → shadcn migration.
- Validation: `npm install`, `npm run build` (frontend).

## 2026-04-17 - Pass 39 (Mail Merge FileUpload — intent stack completion)
- **`FileUpload.tsx`:** Removed remaining MUI-era JSX (`TextField`, `Autocomplete`, `Chip`, `CircularProgress`, `IconButton`, `Alert` with `severity`, `Button` `startIcon` / `fullWidth` / `variant="contained"`) and replaced with shadcn `Button`, `Input`, `Textarea`, `Badge`, `Dialog`, `AlertDialog`, and `lucide-react` icons (`Loader2`, `Sparkles`, `Send`, `Trash2`, etc.). Added `StudioTip` wrappers for hover help on controls that need tooltips.
- **Flows:** Wired **guest gate**, **re-upload confirm**, **send confirm** (with snapshot summary), **campaign name**, and **category** modals so `Promise`-based launch/re-upload paths resolve instead of hanging when the UI was missing.
- **`components/ui/input.tsx` & `textarea.tsx`:** Forward refs so subject/HTML fields work with merge-tag insertion helpers.
- **`app/globals.css`:** Dropped unused `.MuiPaper-root` and SweetAlert2 (`.swal2-*`) rules; updated Mail Merge section comments to describe Tailwind/token-backed studio styling (no MUI framing).
- Why: `package.json` already had no MUI/Emotion; this pass finishes the composer UI so the repo matches the intended Next + Tailwind + shadcn + Radix + lucide stack end-to-end.
- Validation: `npm run build` (frontend).

## 2026-04-17 - Pass 40 (Mail Merge Build route — empty composer fix)
- **`app/apps/layout.tsx`:** Wrapped mini-apps in `flex min-h-dvh flex-col` so child shells can use `flex-1` / `min-h-0` correctly (previously only `min-h-screen` with no flex, so `main`’s `flex-1 min-h-0` could collapse and hide the upload/composer).
- **`AppLayout.tsx` (mail-merge):** `main` is a column flex container (`flex flex-col flex-1`) and no longer relies on `animate-in fade-in` for visibility (avoids any enter-opacity edge cases).
- **`globals.css`:** `.studio-viewport` now uses `position: relative`, `flex: 1 1 0%`, `height: 100%`, and `min-height: 0` instead of a bare `100vh` height, so the studio fills the allocated main region inside the app shell.
- **`FileUpload.tsx`:** Content column uses `relative z-10 flex min-h-0 flex-1 flex-col` so copy and dropzone sit above the mesh background.
- Why: Build (`/apps/mail-merge`) looked empty because the flex height chain and viewport sizing left the scroll/composer region with no drawable area.
- Validation: `npm run build` (frontend).

## 2026-04-17 - Pass 41 (Mail Merge Build — upload hero layout + copy spacing)
- **`FileUpload.tsx` (stage 1):** Restored layout for the upload screen: step rail with borders/typography, `hero-canvas` + `hero-title`, body copy as a paragraph, stat cards in a responsive grid (fixes adjacent inline spans running together like “Fast Setup2 min”), chip row, and **`dropzone`** styling via `getRootProps({ className: cn(...) })` plus Tailwind for padding/centering; drag-active uses `isDragActive`.
- Why: The MUI migration had stripped wrapper classes; React also does not insert spaces between sibling text nodes, which caused “fileor” / “computer.Max” style glitches.
- Validation: `npm run build` (frontend).

## 2026-04-17 - Pass 43 (Unified design system — global light theme, no per-app skins)
- **Governance / inventory:** Already documented in `AGENTS.md` and design debt notes from earlier passes; this pass completes UI migration. (Consolidated later into root `DESIGN.md`.)
- **Inbox IQ:** Reskinned onboarding (prior pass), settings, command center, overview flyout, emails activity feed, `ControllerChat`, `CreateAgentModal`, `AgentCard`, `AgentsWorkspace`, and `AgentViewResponseModal` to token-backed surfaces (`bg-card`, `bg-background`, `border-border`, `text-muted-foreground`, `Button`/`Input` where appropriate) and removed dark panels, glass gradients, and blue–purple CTA gradients in favor of `primary` / shadcn patterns.
- **Mail Merge:** Added `app/apps/mail-merge/_lib/preview-email-html.ts` for iframe preview palette + HTML shell; `FileUpload` uses it for merge highlights and preview doc; replaced `mesh-gradient-bg` with `bg-muted/30`; tokenized `ContactsHub` source filters and AI tag chips (Tailwind semantic classes instead of hex maps), progress/health bars, and quick-send chrome; aligned `RichTextEditor`, `Dashboard`, and `ConfigurationStudio` surfaces to remove arbitrary Tailwind hex classes.
- **Hub:** `HubCatalog` entitlement chips use shadcn `Badge` + default/secondary variants with the primary launch `Button`.
- **Lint guard:** A Node script under `scripts/` scanned TS/TSX/CSS for arbitrary hex in classes (later removed; use `rg` per `DESIGN.md` debt section if needed).
- **Dead CSS:** Removed unused `.chat-shell`, `.chat-main-panel`, and `.mesh-gradient-bg` (+ related keyframes / reduced-motion hooks) from `app/globals.css` after migrations.
- Why: one light-first design system across mini-apps per product direction; previews keep inline email colors in a single module.
- Validation: `npm run build`; `npm run lint:design-tokens`; spot-check of edited components (no runtime server started in CI).

## 2026-04-17 - Pass 42 (Mail Merge — sidebar chrome aligned with Outreach / Inbox IQ)
- **`AppLayout.tsx`:** Replaced the single top nav strip with a **left rail** using the shared `sidebar-surface` pattern (`w-64`, border, brand block, vertical links with the same active/hover styles as Outreach). Top bar on the right column shows the current section title, **Start new**, and sender status; **main** scrolls inside `overflow-y-auto` with header shadow driven by **main** `scrollTop` (not `window`, since content scrolls in the pane).
- **Nav:** Distinct icons (`Home`, `PenLine`, …); **Build** active only on exact `/apps/mail-merge` via `isNavActive`.
- Why: Mail Merge previously had no sidebar while other mini-apps used the glass sidebar design; this aligns IA and visuals.
- Validation: `npm run build` (frontend).
## [2026-04-22] - Mail Merge Stability Hardening
- **Fixed**: State reset in \FileUpload.tsx\ now clears mapping on new file uploads.
- **Fixed**: Implemented variable guard in campaign launch to prevent unresolved placeholders.
- **Improved**: Mobile responsiveness in \Dashboard.tsx\ by adding overflow scrolling to logs table.
- **Improved**: Optimized API polling in \AppLayout.tsx\ to reduce cross-module noise.
- **Validation**: Manual UI layout audit and logic flow verification.


## 2026-04-23 - Pass 44 (Inbox IQ agent creation UI custom-label strategy)
- Extended the existing Inbox IQ `CreateAgentModal` so custom labels can be configured during agent creation and agent editing without introducing a new screen.
- Added a `Label Strategy` section directly under `Role Description` to keep inbox meaning setup near the agent identity fields.
- Added a preset dropdown for suggested labels:
  - `Business`
  - `Friends`
  - `Family`
  - `Billing`
  - `Partners`
  - plus `Custom label…` for manual entry.
- Added inline editable label cards so users can rename, refine descriptions, and remove labels before saving.
- Wired the Inbox IQ frontend to the agent custom-label backend endpoints through new API helpers, including label replacement/sync after agent create and configure saves.
- Applied the same modal behavior in both `AgentsWorkspace` and `overview/page.tsx`.
- Validation:
  - local static review completed
  - automated frontend lint/build could not be executed in this environment because frontend dependencies are not installed (`eslint` / `node_modules` unavailable)

## 2026-04-24 - Pass 45 (staging -> pre-prod merge conflict resolution)
- Resolved the staging-to-pre-prod merge conflict on `components/dashboard-subscribe-card.tsx` as a `modify/delete` hard-cutover decision.
- Kept the `pre-prod` side deletion because the file is no longer referenced anywhere in the current codebase and retaining it would reintroduce dead UI code.
- Why: complete the branch integration without reintroducing deprecated/unused components, aligned with no-compatibility-shim governance.
- Validation: `npm run build` (Next.js production build + TypeScript) completed successfully.

## 2026-04-24 - Pass 46 (pre-prod catalog UI restoration after revert)
- Restored hub/catalog redesign assets on `pre-prod` by aligning these files to `origin/staging` versions:
  - `app/globals.css`
  - `components/hub-catalog.tsx`
  - `components/login-form.tsx`
  - `components/subscribe-premium-button.tsx`
  - `components/ui/split-text.tsx`
- Why: `pre-prod` contained `f6e1a70` (`Revert "dashboard re-design UI"`) and the later staging PR (#16) only touched `components/dashboard-subscribe-card.tsx`, so the intended catalog UI never got reapplied on pre-prod.
- Validation: `npm run build` succeeded (Next.js production build + TypeScript).

## 2026-04-29 - Pass 67 (staging <- FrontEndMailmerge02 merge conflict resolution)
- Resolved the `origin/FrontEndMailmerge02` into `origin/staging` merge conflicts for:
  - `app/apps/inbox-iq/_lib/api.ts`
  - `app/apps/mail-merge/_components/StageDrafting.tsx`
  - `CHANGELOGS.md`
- Kept the shared `InboxIQLabelMode` alias in the agent builder draft contract to avoid duplicate literal unions.
- Kept the nullable `editorRef` contract in `StageDrafting` so the compose-stage ref typing remains compatible with the current Mail Merge editor wiring.
- Preserved staging changelog history and recorded the merged feature-branch outcomes in this clean append-only entry instead of carrying forward corrupted conflict text.
- Merged feature branch outcomes included:
  - Mail Merge test-email restoration in drafting preview.
  - Gmail category parity fixes and selective sync/contact-intel UX refinements.
  - Mail Merge composer reset handling, token bar wrapping, and AI sender-context/signature polish.
- Validation:
  - merge conflict scan cleared for the conflicted files
  - `cmd /c npm run build`

## 2026-04-29 - Pass 68 (Mail Merge Sender Placeholder UX Guardrails)
- Updated `app/apps/mail-merge/_components/StageDrafting.tsx` to show an explicit authoring hint:
  - `{{...}}` is for spreadsheet fields only
  - `[Your Email]`, `[Your Phone]`, `[Your Company]` are for sender-side details to be filled manually
- Updated `app/apps/mail-merge/_components/FileUpload.tsx` to block send/review continuation when sender-side contact language appears to use recipient sheet tags such as `{{mobile number}}` or `{{email id}}`.
- Why:
  - prevent campaign drafts from mistakenly presenting recipient/client sheet data as the sender's own contact details.
- Validation:
  - `cmd /c npm run build`
  - `npx tsc -p tsconfig.json --noEmit` still reports pre-existing `vitest` module resolution errors in frontend test files, but the production build TypeScript pass succeeds

## 2026-04-29 - Pass 69 (Mail Merge Compose Placeholder UI Simplification)
- Simplified the placeholder area in `app/apps/mail-merge/_components/StageDrafting.tsx` for layman users:
  - replaced the crowded header controls with one primary `Add from sheet` action
  - moved explanation behind a single `How to use this` help action
  - kept `Copy All` inside the expanded field tray instead of showing it all the time
  - rewrote the help dialog in plain language around sheet data vs sender details
- Why:
  - reduce visual clutter in the compose header and make the field-insertion flow clearer for non-technical users.
- Validation:
  - `cmd /c npm run build`

## 2026-04-29 - Pass 70 (Mail Merge Launch Review Plain-Language Cleanup)
- Simplified the launch-stage UI in `app/apps/mail-merge/_components/FileUpload.tsx` for non-technical users:
  - changed stage language from internal/system wording like `Mission Control`, `Deployment Settings`, and `Payload Summary` to plain review/send wording
  - added short helper text under campaign name, category, delivery mode, and schedule fields
  - simplified the right-side summary to only show recipient count, attachment count, send timing, and blocking checks
  - updated the launch CTA and warning text to use clearer send-focused wording
- Why:
  - make the final send screen easier to scan and understand without crowding it with internal jargon or duplicate status cards.
- Validation:
  - `cmd /c npm run build`

## 2026-04-30 - Pass 71 (Mail Merge History Workflow Simplification and Draft Recovery)
- Updated `app/apps/mail-merge/_components/Dashboard.tsx` to keep the history page practical and less crowded:
  - replaced the status-chip filter cluster with a compact status dropdown
  - changed the campaign summary area to a single state-driven overview instead of repeated fixed cards
  - added recipient activity filters that adapt the log view without introducing more page sections
- Added Mail Merge-only draft recovery and resend workflow support:
  - `Continue draft` now rebuilds the composer session from campaign data and opens the editor
  - `Resend as new draft` now creates a duplicated Mail Merge campaign and opens it in the editor for review before launch
- Updated `app/apps/mail-merge/_components/FileUpload.tsx` to autosave draft subject/body and lightweight composer state back to the Mail Merge campaign record while users work.
- Updated `app/apps/mail-merge/_lib/api.ts` to expose the shared composer session key and expanded campaign response fields needed for history-based draft recovery.
- Why:
  - turn campaign history into a working queue where users can continue unfinished drafts or reuse old campaigns, while keeping the page easier to scan for layman users.
- Validation:
  - `cmd /c npm run build`

## 2026-04-30 - Pass 72 (Mail Merge History Delete Flow and Status Corrections)
- Updated `app/apps/mail-merge/_components/Dashboard.tsx` so the history delete flow now works instead of showing the old dead-end purge warning:
  - added `Delete` for the selected campaign
  - changed the left-side action to `Delete shown campaigns`
  - wired both actions to the new Mail Merge delete APIs with confirmation and success/error feedback
- Simplified deletion behavior for layman users without adding more clutter:
  - active sending campaigns are skipped by the backend and reported back instead of being deleted mid-send
  - the delete dialog now explains exactly what will be removed
- Corrected history behavior:
  - `Continue draft` is now limited to editable states (`draft`, `paused`, `scheduled`)
  - recipient activity filtering now treats `queued` recipients as pending so active sends remain visible in the pending view
- Why:
  - users needed a practical way to remove drafts and old campaigns directly from history, and the previous flow was non-functional.
- Validation:
  - `cmd /c npm run build`

## 2026-04-30 - Pass 73 (Mail Merge Dashboard 502 Error Handling)
- Updated `app/apps/mail-merge/_lib/api.ts` so Mail Merge error parsing now understands the BFF proxy error envelope (`error.message` / `error.code`) instead of falling back to the generic `Request failed (502)` string.
- Updated `app/apps/mail-merge/_components/Dashboard.tsx` so the campaign-history fetch:
  - retries once after a short delay when the BFF returns a transient `502`
  - shows a user-facing error toast with the parsed backend/proxy message if the request still fails
- Why:
  - the dashboard was surfacing an opaque `502` with no useful explanation, and a short retry helps smooth over transient backend/proxy hiccups during local development.
- Validation:
  - `cmd /c npm run build`

## 2026-04-30 - Pass 74 (Mail Merge Dashboard Layout Rebalance)
- Updated `app/apps/mail-merge/_components/Dashboard.tsx` to reduce empty-vs-crowded imbalance on the history page:
  - added a compact `Selected` snapshot card above the left campaign list to use the previously empty top-left area
  - simplified the right summary panel by removing the dense metadata chip row and keeping a short status/schedule line
  - compressed overview tiles sizing and spacing so the status block reads faster and uses less vertical space
- Removed now-unused metadata parsing/types tied to the old dense summary section.
- Why:
  - the previous layout had visible dead space on the left and too much repeated detail on the right, making the screen feel both empty and crowded at once.
- Validation:
  - `cmd /c npx tsc -p tsconfig.json --noEmit` (still reports pre-existing `vitest` module-resolution errors in test files)

## 2026-04-30 - Pass 75 (Mail Merge AI Uses Only Uploaded Sheet Tags)
- Updated `app/apps/mail-merge/_components/FileUpload.tsx` so AI help-me-write requests now send the current uploaded `columns` list to backend.
- Why:
  - backend AI placeholder enforcement requires the detected sheet columns to guarantee output only uses valid `{{...}}` tags from the upload.
- Validation:
  - `cmd /c npx tsc -p tsconfig.json --noEmit` (still reports pre-existing `vitest` module-resolution errors in test files)

## 2026-04-30 - Pass 76 (Mail Merge Send-Ready Placeholder Rules)
- Updated `app/apps/mail-merge/_components/FileUpload.tsx` so test send and campaign launch now block square-bracket placeholders such as `[bracket placeholders]` if they remain in the subject/body.
- Updated sender-tag misuse messaging to tell users to remove the sender-contact line or type final text directly, instead of suggesting `[Your ...]` placeholders.
- Updated `app/apps/mail-merge/_components/StageDrafting.tsx` placeholder help copy so it no longer teaches square-bracket sender placeholders.
- Why:
  - Mail Merge emails should be ready to send before launch, and AI-generated drafts should not depend on manual placeholder replacement.
- Validation:
  - `cmd /c npx tsc -p tsconfig.json --noEmit` (still reports pre-existing `vitest` module-resolution errors in test files)

## 2026-04-30 - Pass 77 (Mail Merge Placeholder Error Audit)
- Removed the invented subject placeholder example from the compose UI and replaced it with plain text.
- Updated the placeholder help dialog so it says the final email should only use fields from the uploaded file and should not contain manual placeholders.
- Changed `{{Name}}` alias fallback to plain `Customer` when no matching uploaded name column exists.
- Simplified sender-detail send blocking to use the same plain `Email is not ready to send` language as other placeholder failures.
- Why:
  - non-technical users should not see examples that imply they can invent merge tags or leave manual placeholders for later.
- Validation:
  - `cmd /c npx tsc -p tsconfig.json --noEmit` (still reports pre-existing `vitest` module-resolution errors in test files)

## 2026-04-30 - Pass 76 (Mail Merge Non-Blocking Content Validation)
- **Validation Refactor:** Converted strict blocking checks into non-blocking warnings in `FileUpload.tsx`.
  - `validateSenderPlaceholderUsage`: Now allows sending even if sender/recipient detail confusion is detected.
  - `validateNoManualPlaceholders`: Now allows sending with manual placeholders (e.g., `[bracketed text]`).
  - `validateResolvedTemplate`: Now allows sending with unresolved merge tags (e.g., `{{missing}}`).
- **UI Enhancement:** Added a `contentWarnings` state to track and display specific validation issues in the Stage 3 "Checks" list.
- **UX Improvement:** Replaced error icons with amber `AlertCircle` warnings for non-critical content issues, while still providing a confirmation step to ensure user awareness.
- **Why:** To make the application "production ready" by giving users full creative control and the ability to override safety guards when necessary, while still providing helpful hints for potential errors.
- **Validation:** Verified `FileUpload.tsx` integrity and manual check for warning display in the launch stage.

## [2026-04-30] Dashboard Animations and Dispatch Safety
- Added status-pulse animation to Dashboard sidebar, header, and activity log.
- Enhanced 'Confirm Send' dialog with detailed pacing breakdown and estimated completion time.
- Enforced minimum constraints (15m interval, 1 row batch) to prevent accidental misconfiguration.
- Defaulted resumption logic to Visual editor (is_html: false).

## 2026-05-04 - Pass 78 (Mail Merge Prod Typecheck Fixes)
- Updated `app/apps/mail-merge/_components/Dashboard.tsx` to handle `validation_summary` as either:
  - a structured object (current backend shape), or
  - a legacy JSON string (parsed safely)
- Updated `app/apps/mail-merge/_components/FileUpload.tsx` draft restore typing to remove `unknown` state from API responses:
  - added typed `http.get<CampaignLike>` and `http.get<RecipientListResponse>` calls
  - added guarded `DraftSession` parsing from `validation_summary.draft_session`
  - normalized restored mapping values before `setMapping`
  - fixed optional `batch_id` assignment with `setBatchId(campaign.batch_id || null)`
  - removed `any` in recipient row mapping (`RecipientLike`)
- Why:
  - production build failed on strict TypeScript checks due to mismatched assumptions around `validation_summary` and untyped campaign fetch responses.
- Validation:
  - `npm run build` (passes on Next.js 16.2.3; TypeScript completed, static pages generated)
## 2026-05-05 - Pass 75 (Invoice Infrastructure Decommissioning)
- **Final Decommissioning**: Completed the total removal of all residual invoice-related fields, UI mappings, and data dependencies across the Mail Merge platform.
- **Data Model Sanitization**: Purged `invoice_amount` and `due_date` from `MailMergeRecipient` type definitions and API response mapping logic in `app/apps/mail-merge/_lib/api.ts`.
- **UI/UX Cleanup**:
  - Removed invoice-specific category suggestions ("Billing & Payment") and sample data generation logic from the `FileUpload` component.
  - Purged automatic template aliasing for payment-related tokens (e.g., `amount`, `pending_amount`, `invoice_number`).
  - Renamed all internal state and fetch functions in the `Dashboard` component to use generic `Recipient` terminology.
  - Updated the compose-stage placeholder guide to use generic campaign examples instead of invoice tags.
- **Documentation & Samples**:
  - Replaced the legacy invoice-based sample CSV in `public/mail-merge-sample.csv` with a professional outreach dataset (Name, Email, Company, Region).
  - Cleaned up cross-module references to "invoices" in Inbox IQ and Outreach shared utilities.
- **Validation**: Verified that the codebase is exclusively focused on core Mail Merge and Outreach functionality, with no orphaned invoice artifacts remaining in the production-ready build.

## 2026-05-05 - Pass 79 (Outreach Phase 1 Onboarding Gate + Guided Setup)
- Added first-time onboarding gate in `app/apps/outreach/page.tsx`:
  - Dashboard now checks `/onboarding/status` first.
  - Users with incomplete onboarding are redirected to `/apps/outreach/setup`.
- Added new guided setup page `app/apps/outreach/setup/page.tsx` implementing a 4-step flow:
  - Connect
  - Select People
  - Write Email
  - Preview & Send
- Added automatic progress save hooks to backend onboarding APIs (`/onboarding/start`, `/onboarding/step`) from setup flow actions.
- Added user-friendly onboarding defaults and no-empty fallback preview content for first-time users.
- Fixed Outreach compile regression in `app/apps/outreach/campaigns/page.tsx` by adding missing `Loader2` import.
- Why:
  - Align Outreach UX with process-driven onboarding and reduce first-run confusion.
  - Enforce onboarding-first behavior before dashboard usage.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` (Outreach changes compile; command still fails due to pre-existing Mail Merge errors in `FileUpload.tsx` and missing `vitest` typings)

## 2026-05-05 - Pass 80 (Outreach Phase 2: Smart Audience + Fast Actions)
- Upgraded `app/apps/outreach/setup/page.tsx` step 2 into a real guided audience selector:
  - Smart segment cards driven by backend counts (`Recent Leads`, `Past Clients`, `Inactive Contacts`, `All Contacts`).
  - Manual contact list with multi-select, search, and select-all.
  - Valid-email-aware selection guard before continuing.
  - Sticky feedback message now reflects selected valid recipients.
- Added fast-mode support in setup page:
  - `mode=last-email` preloads previous message and jumps to write step.
  - `mode=last-audience` jumps to audience step.
- Added existing-user quick actions to Outreach dashboard in `app/apps/outreach/page.tsx`:
  - Run Campaign
  - Use Last Email
  - Use Last Audience
- Why:
  - Reduce decision load for new users while enabling sub-60s execution path for returning users.
  - Align setup behavior more closely with process-driven UX requirements.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` (still fails on pre-existing Mail Merge issues unrelated to Outreach)
## 2026-05-05 - Pass 81 (Outreach UX Reconstruction & Resilience)
- **Onboarding/Setup (`outreach/setup/page.tsx`)**: Realigned the connection and data sync flow with dynamic status feedback and simplified terminology.
- **Campaign Builder (`outreach/campaigns/page.tsx`)**: Updated all headers, labels, and loading states to use non-technical, outcome-oriented language. Added personalization hints.
- **Results Studio (`outreach/campaigns/results/page.tsx`)**: Renamed "Neural Composer" to "Review Emails" and added a placeholder detection warning (`{{name}}`, etc.).
- **Dashboard (`outreach/page.tsx` & `Launchpad.tsx`)**: Purged jargon like "Neural queue", "Calibration", and "Strategic Dispatches".
- **Global Components (`_components/SmartLoader.tsx`)**: Standardized loading labels to be more human-centric.
- **Why it Changed**: To align with the new 5-step process-driven specifications and achieve the "2-minute onboarding" target by reducing cognitive load and removing technical jargon.
- **Validation**: Manual walkthrough of the 5-step onboarding and campaign creation flow; verified placeholder detection; verified "Sent vs Failed" breakdown.
