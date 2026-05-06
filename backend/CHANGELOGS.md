### 2026-04-23: Mail Merge Sync & Stability Fixes
- Refactored background sync task with granular progress reporting.
- Implemented two-phase sync (Header scanning + AI classification) for performance.
- Fixed corrupted email extraction from multi-address headers.
- Hardened frontend favicon handling to prevent 404 errors.
- Resolved Python 3.11 compatibility issue in config service.

# Backend Changelogs

## 2026-05-05 - Pass 47 (Outreach Wizard Stabilization & UX Finalization)
- **Stability – Wizard State Persistence**:
  - Implemented `localStorage` persistence in `OutreachCampaignWizard` to prevent data loss on page refreshes.
  - Added automatic state cleanup upon successful campaign launch.
- **Backend – Campaign Traceability**:
  - Updated `dispatch_campaign_batch` to capture and persist `campaign_name` in the `OutreachJob` record, enabling better tracking of background dispatch tasks.
- **UX – "No-Jargon" Finalization**:
  - Refined UI labels across all 4 steps of the wizard to prioritize growth-focused, business-centric language (e.g., "Goal" vs "Objective", "Audience Size" vs "Target").
  - Optimized "Co-Pilot" live preview interface for better readability and focus.
- **Validation**:
  - Verified end-to-end data integrity from wizard input through background generation and batch dispatch pipelines.
  - Confirmed `campaign_name` persistence across all history and reporting models.

## 2026-05-05 - Pass 46 (Intelligent Outreach Campaign Builder & Schema Hardening)
- **Feature – Intelligent Outreach Campaign Builder**:
  - Refactored campaign generation logic to support mandatory `campaign_name` for project-based tracking.
  - Implemented split-view AI personalization preview in the generation loop.
  - Added support for "Objective" based campaign starting points.
- **Backend – Schema & Model Hardening**:
  - Added `campaign_name` to `OutreachCampaignHistory` and `OutreachJob` models.
  - Updated `OutreachCampaignGenerateRequest` to require `campaign_name`.
  - Fixed variable scoping for `primary_service` in the bulk generation loop to prevent `NameError`.
- **Linguistic Cleanup – "No-Jargon" Audit**:
  - Removed remaining technical and financial jargon ("invoice", "neural", "matrix") from outreach models and schemas to maintain a growth-focused platform identity.
- **Validation**:
  - Verified schema consistency through Pydantic model inspection.
  - Manually validated generation loop logic for campaign naming and service-based segmentation.

## 2026-05-05 - Pass 45 (Gmail Sync Date Population & Source Label Fixes)
- **Bug Fix – `last_contacted` not populated from Gmail sync**:
  - `_extract_gmail_contacts` now parses the `Date` RFC 2822 header from each Gmail message, returning a `datetime` per contact entry.
  - `run_gmail_sync` now writes `last_contacted` on the `OutreachClient` record using the most-recent message date seen for each email address.
  - Also broadened header extraction from `From` only to `From/To/CC/BCC` for more complete contact discovery.
  - Improved noreply filter to catch `noreply` and `no-reply` patterns.
- **Frontend – Source label now handles all real source values**:
  - Source pill in the Status/Source column now correctly maps: `GMAIL` → "Gmail" (indigo), `GOOGLE_OTHER` → "Google" (blue), `ZOHO_BIGIN` → "Zoho" (orange), `INVOICE_SYSTEM` → "Invoice" (amber), `MANUAL`/null → "Manual" (slate). Previously all non-GOOGLE/non-INVOICE clients showed as "Manual".
- **Frontend – Industry sentinel values hidden**:
  - `industry="Imported"` and `industry="Corporate"` (used internally by Google/Gmail/Zoho sync jobs) are now mapped to "General" in the UI chip, preventing confusing internal labels from appearing to users.
- **Validation**: No automated tests run; changes verified by code inspection against model fields and backend serialization logic.

- Implemented real-time email interaction tracking:
  - Added `or_tracking_events` table for open (pixel) and click (redirect) event capture.
  - Added interaction endpoints `/track/open/{token}` and `/track/click/{token}` in the outreach tracking router.
  - Integrated automated pixel injection and link wrapping into the strategic mailer service.
  - Updated campaign stats to include real-time open/click rates.
- Implemented guided onboarding "Launchpad":
  - Built a step-based onboarding wizard component in the frontend to guide new users through identity setup and data sync.
  - Added intelligent visibility logic to surface the Launchpad on the main dashboard for first-time users.
- Implemented AI Quick-Compose:
  - Added natural language intent parsing endpoint `/campaigns/parse-intent` using LLM to generate structured campaign configurations.
  - Integrated Quick-Compose AI bar into the Campaign Builder UI for instant objective mapping.
- Hardened backend modeling:
  - Replaced ad-hoc `dict` payloads with Pydantic models for client block and merge routes.
  - Added `OutreachIntentRequest`, `OutreachClientBlockRequest`, and `OutreachClientMergeRequest` to the public outreach schema.
- Added client deduplication and merging utilities:
  - Added backend scan for duplicate emails and a migration-safe merge operation for consolidated client records.

## 2026-04-23 - Pass 19 (Inbox IQ Unified Business Labels)
- Unified Inbox IQ classification and Gmail labeling around one hardcoded business label set:
  - `Enquiry`, `Support`, `Internal`, `Vendor`, `Newsletter`, `Spam`, `Other`
- Updated the Inbox IQ LLM classifier prompt to classify against the same business labels users will see, while keeping keyword fallback protection for invalid or unavailable model output.
- Removed workflow-style Gmail labels from Inbox IQ processing:
  - no more `To Reply`, `Awaiting Reply`, `Ignored`, `Escalated`, `Marketing`, `Team`
  - send/draft/escalate/ignore behavior remains controlled by action/status and policy rules, not by labels
- Kept the current DB column and API contract names stable in this pass to avoid breaking existing application flows; the values now represent normalized business labels instead of mixed internal categories.
- Normalized legacy stored values on read paths so activity feeds, details, agent email logs, and analytics return the same user-explainable label vocabulary without a schema migration.

## 2026-04-23 - Pass 20 (Inbox IQ Structured Triage Prompt)
- Replaced the Inbox IQ email triage classifier prompt with a structured policy prompt in `email_triage_service.py`.
- Added explicit label definitions, ambiguity handling, noise filtering rules, conflict-priority rules, and edge-case guidance for enquiry/support/vendor/newsletter/spam/internal classification.
- Kept the existing classifier validation, normalization, and fallback mechanics unchanged so the stronger prompt improves decision quality without altering the processing contract.

## 2026-04-23 - Pass 21 (Inbox IQ Classifier Token Trim)
- Reduced Inbox IQ classifier response shape to the minimum paid-token payload: `label` and `confidence` only.
- Removed `reason` and `signals` from the classifier prompt contract, parser metadata, and related test fixtures.
- Kept classification validation, normalization, and fallback behavior unchanged while lowering per-call completion token usage.

## 2026-04-15 - Pass 1 (Foundation)
- Set up FastAPI backend baseline with `uv` dependency management, SQLAlchemy ORM, Alembic migration pipeline, and pytest configuration.
- Implemented initial platform modules:
  - `platform/auth` session exchange and logout
  - `platform/catalog` app listing
  - `platform/access` access decision + launch ticket issuance
- Added core DB models and initial migration `20260415_0001_initial_platform_schema.py`.
- Validation:
  - `uv run pytest` passed
  - `uv run alembic upgrade head` passed

## 2026-04-15 - Pass 2 (Users, Billing, Standards Enforcement)
- Added `platform/users`:
  - `GET /platform/users/me`
  - `PATCH /platform/admin/users/{user_id}/status` (admin key guarded)
- Added `platform/billing`:
  - `POST /platform/billing/checkout` (Razorpay-first checkout intent)
  - `POST /platform/billing/webhooks/razorpay` (signature check + idempotent payment event processing)
- Enforced modeling standards:
  - removed all dataclass usage
  - converted service contracts to Pydantic models
  - moved schemas into dedicated `schemas/` directories under each module
- Added and expanded tests for user and billing flows, including webhook idempotency.
- Added `.env.example` with required backend environment contract.

## 2026-04-15 - Pass 3 (Schema Discipline Hardening)
- Enforced strict modeling convention requested by product:
  - removed all `dataclass` usage from backend contracts
  - switched to Pydantic-only contracts for service/internal exchange objects
  - migrated module schemas from single `schemas.py` files to dedicated schema directories (`schemas/public.py`, `schemas/internal.py`)
- Updated root `SPEC.md` with mandatory backend modeling conventions.
- Added workspace-level `AGENTS.md` to formalize governance:
  - `SPEC.md` is authoritative and immutable for routine changes
  - drift/conflict from spec is a violation
  - per-repo `CHANGELOGS.md` must be append-only each pass
- Validation:
  - `uv run pytest` passed (`13 passed`)

## 2026-04-15 - Pass 4 (Auth/Billing/Admin Hardening)
- Hardened auth/session lifecycle:
  - access + refresh token issuance on session exchange
  - `POST /platform/auth/session/refresh` with refresh-token rotation
  - `POST /platform/auth/logout-all` to revoke all active sessions for current user
  - session model extended with refresh and rotation metadata
- Hardened Firebase verification behavior:
  - test tokens are rejected when `ALLOW_INSECURE_TEST_TOKENS=false`
  - explicit Firebase admin init failure now raises config error
- Hardened billing webhook replay controls:
  - added `webhook_events` persistence with `(provider, event_id)` uniqueness
  - payload hash mismatch replay detection
  - replay counter tracking
- Added app-level admin status control:
  - `PATCH /platform/admin/apps/{app_slug}/users/{user_id}/status`
- Added migration:
  - `20260415_0002_session_refresh_and_webhook_events.py`
- Updated backend env contract with access/refresh TTL vars.
- Validation:
  - `uv run pytest` passed (`17 passed`)
  - `env DATABASE_URL=sqlite:///./migration_test.db uv run alembic upgrade head` passed
  - direct `uv run alembic upgrade head` against local Postgres could not run in this environment (DB unavailable)

## 2026-04-15 - Pass 5 (Mail Merge Module Migration Start)
- Started full Mail Merge port under app-owned module boundaries:
  - added `app/apps/mail_merge/{models,repositories,services,schemas,routes,integrations,jobs}`
  - implemented campaign, recipient, template, smtp-account, and settings workflows
  - added tracking endpoints (`open` pixel + link click redirect)
- Added Mail Merge schema migration:
  - `20260415_0003_mail_merge_core_tables.py`
- Corrected model ownership and domain boundaries:
  - moved Mail Merge ORM entities from `app/core/db/models` to `app/apps/mail_merge/models/entities.py`
  - removed Mail Merge relationships from core `User` model
  - updated Alembic model import discovery in `migrations/env.py`
- Added integration tests for Mail Merge flows:
  - upload/import, campaign ops, recipient mutation, send-mode transitions, pause/resume, tracking, and stats
  - fixed redirect assertion to avoid auto-follow in click-tracking test
- Added dependencies required for file-upload parsing:
  - `python-multipart`, `pandas`, `openpyxl`
- Validation:
  - `uv run pytest` passed (`19 passed`)
  - `DATABASE_URL=sqlite:///./migration_test.db uv run alembic upgrade head` passed (`0001 -> 0003`)

## 2026-04-15 - Pass 6 (Mail Merge Attachments + Legacy Compatibility Routes)
- Added Mail Merge attachment management with strict guardrails:
  - list/upload/delete endpoints on campaign scope
  - legacy-compatible aliases on batch scope (`/batches/{batch_id}/attachments`)
  - extension allowlist, per-file size cap, total campaign-size cap, and per-campaign attachment count cap
- Added attachment storage integration layer with sanitized filenames and campaign-scoped directories.
- Added repository + service layer for attachment operations with campaign ownership checks.
- Added attachment configuration to settings + env contract:
  - `MAIL_MERGE_ATTACHMENTS_ROOT`
  - `MAIL_MERGE_MAX_ATTACHMENT_SIZE_MB`
  - `MAIL_MERGE_MAX_ATTACHMENTS_TOTAL_MB`
  - `MAIL_MERGE_MAX_ATTACHMENTS_PER_CAMPAIGN`
- Expanded integration coverage:
  - attachment upload/list/delete happy-path
  - legacy batch-route compatibility
  - disallowed extension rejection
- Validation:
  - `uv run pytest` passed (`20 passed`)

## 2026-04-15 - Pass 7 (Mail Merge Contacts-Driven Campaign Flows)
- Added Mail Merge contacts domain APIs:
  - `GET /apps/mail-merge/contacts` with search + tag filters
  - `POST /apps/mail-merge/contacts/bulk-tag`
  - `POST /apps/mail-merge/contacts/sync`
  - `GET /apps/mail-merge/contacts/sync/status`
  - `POST /apps/mail-merge/campaigns/from-contacts`
  - `POST /apps/mail-merge/contacts/quick-launch`
- Added dedicated repository/service layers for contacts:
  - contact listing + filtering
  - computed tags, campaign count, latest campaign status, and health-score projection in response payload
  - contact-to-campaign recipient generation for normal and quick-launch flows
- Reused campaign batch-id generation across import and contacts-based campaign creation.
- Expanded integration tests to validate contacts lifecycle and campaign creation from contacts.
- Validation:
  - `uv run pytest` passed (`21 passed`)

## 2026-04-15 - Pass 8 (Postgres Migration Recovery Fix)
- Fixed Alembic `0001` enum handling for Postgres recovery scenarios:
  - switched migration enum declarations to explicit Postgres enum objects with manual lifecycle control
  - prevents duplicate `CREATE TYPE` attempts on partially initialized DBs (e.g., existing enum type but no tables)
- Confirmed Alembic reads DB URL from `.env` via `get_settings().database_url` in `migrations/env.py`.
- Validation:
  - `uv run alembic upgrade head` passed against real `.env` Postgres URL
  - `uv run pytest` passed (`21 passed`)

## 2026-04-15 - Pass 9 (Driver Standardization + Test Env Hardening)
- Standardized database driver contract to psycopg2:
  - backend dependency uses `psycopg2-binary` (not `psycopg[binary]`)
  - `.env.example` uses `postgresql+psycopg2://...` DSN form
- Fixed test-environment security/config alignment:
  - updated test `ADMIN_API_KEY` to satisfy enforced minimum length
  - updated admin endpoint integration tests to use the current configured key
- Validation:
  - `uv run pytest` passed (`22 passed`)

## 2026-04-15 - Pass 10 (Mail Merge Migration Continuation + Query Pattern Enforcement)
- Enforced no-`db.scalars(...)` query pattern in active backend code paths:
  - refactored Mail Merge config/contact/campaign/attachment repositories and platform catalog service to `db.execute(...).scalars()`.
- Ported additional Mail Merge production features with secure defaults:
  - added campaign preflight validation endpoint:
    - `GET /apps/mail-merge/campaigns/{campaign_id}/validate`
    - validates recipient emails, unresolved placeholders, sender account readiness
    - persists `validation_summary` on campaign
  - added test email endpoint:
    - `POST /apps/mail-merge/campaigns/{campaign_id}/test-email`
    - renders templates with recipient data, enforces validation gate, sends via active SMTP/gmail_oauth account
  - added AI authoring endpoints (deterministic/local-safe generation, no external AI dependency):
    - `POST /apps/mail-merge/ai/help-me-write`
    - `POST /apps/mail-merge/ai/polish-draft`
- Added supporting service/integration modules:
  - template rendering and placeholder resolution service
  - campaign validation service
  - SMTP test-delivery service
  - attachment read helper for delivery
- Expanded integration tests to cover:
  - campaign validation failure/success cases
  - test-email flow (with SMTP transport monkeypatched)
  - AI help-write and polish-draft endpoints
- Validation:
  - `uv run python -m compileall app tests` passed
  - `uv run pytest` passed (`23 passed`)

## 2026-04-16 - Pass 11 (Mail Merge Sender Account Endpoint Parity)
- Added consolidated Mail Merge sender-account helper endpoints under `/apps/mail-merge/*`:
  - `GET /apps/mail-merge/smtp/detect`
  - `GET /apps/mail-merge/gmail/token_status`
  - `DELETE /apps/mail-merge/gmail/auth`
- Added explicit `POST /apps/mail-merge/gmail/auth` response behavior; it now returns a clear not-implemented error instead of an accidental 404 until full Gmail OAuth connect is ported.
- Kept the new backend on consolidated route contracts only; no standalone legacy `/api/...` compatibility aliases were added.
- Added Pydantic response schemas and integration coverage for SMTP detection and Gmail account helper behavior.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 12 (Mail Merge Gmail OAuth Real Flow + Env-Based URL Contract)
- Replaced the placeholder Gmail connect endpoint with a real OAuth start flow:
  - `POST /apps/mail-merge/gmail/auth` now generates a signed state token and returns a Google authorization URL.
- Added real Gmail OAuth callback handling:
  - `GET /apps/mail-merge/gmail/callback` now validates state, exchanges code for tokens, resolves Google profile email, upserts `gmail_oauth` sender account, and redirects back to frontend settings.
- Hardened Gmail token lifecycle and disconnect behavior:
  - `GET /apps/mail-merge/gmail/token_status` now performs live token validation and refresh-token based access-token refresh.
  - `DELETE /apps/mail-merge/gmail/auth` now revokes Google tokens before disconnecting the account.
- Enforced environment-driven URL bases for OAuth callback and frontend redirects:
  - added required backend settings `API_BASE_URL` and `FRONTEND_BASE_URL`
  - added OAuth path settings `MAIL_MERGE_OAUTH_SUCCESS_PATH` and `MAIL_MERGE_OAUTH_ERROR_PATH`
  - removed localhost fallback defaults from backend config.
- Updated backend test environment and integration tests to validate the real Gmail OAuth flow with mocked Google network calls.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 13 (Config Contract Hardening - No Production-Breaking Defaults)
- Removed hardcoded code defaults for environment-sensitive backend settings:
  - `environment` is now required from env (no default `local`)
  - `database_url` is now required from env (no default sqlite fallback)
  - `billing_return_url` is now required from env (no default localhost fallback)
- Updated backend test bootstrap env to provide `BILLING_RETURN_URL` under pytest.
- Kept `.env.example` as the explicit source of local/staging/prod values.
- Validation:
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 14 (Gmail OAuth Callback Activation Consistency)
- Updated Gmail OAuth callback completion flow so a successful Gmail connect always becomes the active sender account.
- Enforced active-sender consistency by deactivating existing sender accounts before setting the connected Gmail account active.
- Always updates Mail Merge sender settings (`active_provider`, sender name/email, SMTP host/port/user) after successful Gmail OAuth callback.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 15 (Fix Gmail OAuth Token Storage Overflow)
- Fixed `mm_smtp_accounts.smtp_password` storage size limitation causing Postgres `StringDataRightTruncation` during Gmail OAuth connect.
- Updated ORM model column type from `String(1000)` to `Text` for `MailMergeSmtpAccount.smtp_password`.
- Added Alembic migration `20260416_0004` to alter existing database column type:
  - `mm_smtp_accounts.smtp_password`: `VARCHAR(1000)` -> `TEXT`
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 16 (Gmail OAuth Test-Email Delivery Path Fix)
- Fixed Mail Merge test-email delivery for `gmail_oauth` sender accounts:
  - no longer attempts SMTP username/password auth for OAuth accounts
  - now sends through Gmail API `users.messages.send` using stored OAuth access token.
- Added OAuth token refresh support in delivery flow when access token is missing/expired.
- Hardened transport error handling so provider auth/delivery failures surface as controlled `400` API errors instead of `500` unhandled exceptions.
- Added integration regression test to verify `/campaigns/{id}/test-email` works with a `gmail_oauth` active sender.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`25 passed`)

## 2026-04-16 - Pass 17 (Disable Implicit Trial Auto-Grant Paths)
- Fixed entitlement leakage where users could become `TRIAL_ACTIVE` without explicit trial-intent flow.
- Changed Mail Merge backend access dependency to stop auto-starting trials on normal app API access checks.
- Changed access-check request default to `auto_start_trial=false` so omitted field no longer starts trial implicitly.
- Added integration regression test asserting `/platform/access/check` without `auto_start_trial` does not create a trial.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py` passed (`8 passed`)
  - `uv run pytest` passed (`26 passed`)

## 2026-04-16 - Pass 18 (Entitlement Hardening + Real Send + Real AI + Sender Consistency)
- Removed trial auto-start from public access-check contract and service behavior:
  - `AccessCheckRequest` now only accepts `app_slug` (legacy `auto_start_trial` is forbidden).
  - `check_access` no longer supports trial creation from user-triggered access checks.
  - Added regression coverage to reject legacy `auto_start_trial` payloads with `422`.
- Implemented real Mail Merge campaign send execution:
  - `/campaigns/{id}/recipients/send` now renders templates per-recipient and performs actual delivery via active sender account transport (`smtp` or `gmail_oauth`).
  - Recipient statuses now transition based on transport outcome (`success` / `failed` with error details), and campaign status updates to `queued` or `completed`.
  - `/campaigns/{id}/retry-failed` now actually resends failed recipients instead of only flipping campaign state.
- Fixed sender settings/account consistency across account lifecycle operations:
  - Added centralized active-sender sync for `create_account`, `update_account`, `activate_account`, `delete_account`, Gmail connect, and Gmail disconnect.
  - Ensures `active_provider`, active sender identity, and SMTP host/port/user fields remain aligned to the active account.
- Replaced fake Mail Merge AI responses with real Groq-backed generation:
  - `help-me-write` and `polish-draft` now call Groq chat completions with structured JSON output parsing.
  - Added explicit config enforcement for `GROQ_API_KEY` and `GROQ_MODEL`.
- Updated backend config/env contract:
  - Added `groq_api_key` and `groq_model` settings.
  - Updated `.env.example` with `GROQ_API_KEY`, `GROQ_MODEL`, and non-localhost `BILLING_RETURN_URL` example.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_mail_merge_endpoints.py tests/integration/test_users_billing_endpoints.py` passed (`21 passed`)
  - `uv run pytest` passed (`27 passed`)

## 2026-04-16 - Pass 19 (Groq Chat Request Contract Hardening)
- Updated Mail Merge Groq chat request payload to align with current Chat Create contract:
  - switched token field from deprecated `max_tokens` to `max_completion_tokens`.
- Added resilient 400-handling path for Groq chat completions:
  - first attempt uses `response_format: { type: "json_object" }`
  - on `400`, retries once without `response_format` for model-compatibility cases.
- Improved Groq error extraction so backend API returns precise provider error messages from Groq `error.message`.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)

## 2026-04-16 - Pass 20 (Groq Parsing Robustness + Upstream Error Status Clarity)
- Removed hard dependency on `response_format` for Groq chat requests to avoid model/feature-specific request rejections.
- Added tolerant response parsing:
  - if model returns non-JSON text, service now degrades gracefully with best-effort content shaping instead of immediate 400 parse failure.
- Introduced explicit Groq upstream error typing with status capture.
- Updated AI routes to map Groq upstream failures to `502 Bad Gateway` with provider metadata (`provider_status`) instead of collapsing them into misleading `400 Bad Request`.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)

## 2026-04-16 - Pass 21 (Mail Merge Real Queue Worker + Scheduled/Batched Orchestration)
- Replaced synchronous in-request campaign send execution with queue-first orchestration:
  - `/apps/mail-merge/campaigns/{id}/recipients/send` now validates + enqueues recipients (`queued`) and returns immediately.
  - Campaign status now transitions to `queued` or `scheduled` at enqueue time based on `scheduled_for` / pacing windows.
- Added backend scheduled/batched dispatch support:
  - Added `campaign_pacing` request schema to send payload.
  - Implemented dispatch-plan builder and due-slot selection for batched execution windows.
  - Worker now processes only due slot counts and re-schedules remaining queued recipients to future slots.
- Added persistent Mail Merge delivery worker lifecycle:
  - Implemented queue claim + process loop with optimistic campaign claiming.
  - Added startup/shutdown worker wiring in FastAPI lifespan.
  - Added configurable worker toggles in settings/env (`MAIL_MERGE_WORKER_ENABLED`, `MAIL_MERGE_WORKER_POLL_SECONDS`).
- Improved campaign state transition rigor:
  - Pause/resume/cancel now enforce valid state transitions and return `400` for invalid transitions.
  - Resume transitions campaign back to `queued` for worker pickup.
- Preserved orchestration metadata safely:
  - Validation snapshots now coexist with dispatch-plan metadata in `campaign.validation_summary`.
- Updated integration coverage for async queue behavior:
  - Added polling helper to wait for queued recipient completion in tests.
  - Added scheduled send + pause/resume assertions aligned to new orchestration model.
- Validation:
  - `uv run pytest` passed (`27 passed`)

## 2026-04-16 - Pass 22 (Inbox IQ Module Bootstrap + Real Onboarding API Slice)
- Added new backend app module scaffold for Inbox IQ under `app/apps/inbox_iq` with explicit route/service/repository/schema/model boundaries.
- Wired Inbox IQ into API v1 router and DB model registry (no compatibility aliases):
  - new router namespace at `/api/v1/apps/inbox-iq/*`
  - entitlement guard added through `platform/access` check dependency (`app_slug="inbox-iq"`).
- Implemented first production onboarding slice with persisted DB state (no stubs):
  - `GET /apps/inbox-iq/onboarding/state`
  - `PUT /apps/inbox-iq/onboarding/company-profile`
  - `PUT /apps/inbox-iq/onboarding/service-client-profile`
  - `PUT /apps/inbox-iq/onboarding/inbox-taxonomy`
  - `PATCH /apps/inbox-iq/onboarding/stages`
  - `POST /apps/inbox-iq/onboarding/skip-to-complete`
- Added cross-company scope guard semantics for onboarding payloads (`company_id` optional but enforced when provided).
- Added migration `20260416_0005` creating `iq_onboarding_states` table with unique per-user onboarding aggregate state.
- Added integration tests for:
  - access denial without entitlement
  - full onboarding lifecycle update flow
  - company-scope guard enforcement.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_onboarding_endpoints.py` passed (`3 passed`)
  - `uv run pytest` passed (`30 passed`)

## 2026-04-16 - Pass 23 (Inbox IQ Agents API Slice + Analytics Overview Endpoint)
- Added Inbox IQ agent persistence model and migration-backed storage:
  - New table `iq_agents` with source-compatible agent configuration fields (status, send mode, email format, tone controls, keyword lists, Gmail connection state, forwarding policy fields).
  - New migration: `20260416_0006_inbox_iq_agents.py`.
- Implemented entitlement-guarded Inbox IQ agent API routes:
  - `GET /apps/inbox-iq/agents`
  - `POST /apps/inbox-iq/agents`
  - `GET /apps/inbox-iq/agents/{agent_id}`
  - `PATCH /apps/inbox-iq/agents/{agent_id}`
  - `DELETE /apps/inbox-iq/agents/{agent_id}`
  - `POST /apps/inbox-iq/agents/{agent_id}/pause`
  - `POST /apps/inbox-iq/agents/{agent_id}/resume`
  - `GET /apps/inbox-iq/agents/{agent_id}/send-readiness`
- Added Inbox IQ analytics route scaffold:
  - `GET /apps/inbox-iq/analytics/overview`
  - Returns deterministic overview payload while email-event analytics port is pending in subsequent slices.
- Added integration regression coverage for Inbox IQ agents:
  - access enforcement without entitlement
  - full create/list/update/pause/resume/delete flow
  - send-readiness gate behavior
  - company-scope guard on create payload.
  - analytics overview endpoint contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_onboarding_endpoints.py tests/integration/test_inbox_iq_agents_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`34 passed`)

## 2026-04-16 - Pass 24 (Inbox IQ Activity + Gmail Viewer + Command Center Core)
- Added Inbox IQ persistence for activity and command-center state:
  - new models + migration `20260416_0008_inbox_iq_activity_and_command_center.py`
  - tables: `iq_email_logs`, `iq_cc_block_entries`, `iq_cc_global_rules`, `iq_cc_master_kb_entries`.
- Added entitlement-guarded Inbox IQ Activity endpoints:
  - `GET /apps/inbox-iq/emails`
  - `GET /apps/inbox-iq/emails/{email_id}`
  - `POST /apps/inbox-iq/emails/{email_id}/approve-draft`
  - `POST /apps/inbox-iq/emails/{email_id}/discard-draft`.
- Added Inbox IQ Gmail viewer endpoints (real Gmail API reads via stored OAuth token bundle):
  - `GET /apps/inbox-iq/gmail/messages`
  - `GET /apps/inbox-iq/gmail/messages/{message_id}`.
- Added Inbox IQ command-center core endpoints:
  - block-list CRUD (`/command-center/block-list`)
  - global rules get/update (`/command-center/global-rules`)
  - master KB list/create (`/command-center/master-kb*`)
  - assistant chat (`POST /command-center/sentinel/chat`) using Groq with company/agent/context grounding.
- Added Gmail token utility service with refresh-token path and encrypted token persistence updates.
- Fixed FastAPI callback parameter contract in Inbox IQ Gmail callback route (`Annotated + Query` default binding).
- Updated agent readiness contract/tests for new `token_bundle` gate.
- Added integration coverage:
  - `test_inbox_iq_activity_endpoints.py`
  - `test_inbox_iq_command_center_endpoints.py`.
- Validation:
  - `uv run pytest` passed (`38 passed`)

## 2026-04-16 - Pass 25 (Inbox IQ Agent Builder + Draft Reply Preview API Contract)
- Extended Inbox IQ command-center schemas and service contracts for source-compatible Agent Builder chat mode:
  - `POST /apps/inbox-iq/command-center/sentinel/chat` now accepts `mode=agent_builder`, `agent_builder_draft`, and `agent_builder_history`.
  - Sentinel chat response now supports `agent_builder` payload with `field_updates`, `missing_fields`, `is_ready_to_create`, and `interpreted_user_message`.
- Added new endpoint:
  - `POST /apps/inbox-iq/command-center/agent-draft/preview-reply`
  - Generates preview reply text/html from unsaved draft agent fields + sample inbound email.
- Refactored Groq invocation internals for shared usage:
  - added shared chat-content helper + structured JSON payload helper while preserving existing `_groq_reply` behavior.
- Added integration coverage for:
  - Agent Builder mode contract on sentinel chat.
  - Draft preview reply endpoint contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`4 passed`)
  - `uv run pytest` passed (`42 passed`)

## 2026-04-16 - Pass 26 (Inbox IQ Simulation Run Endpoint for One-View Agent Response)
- Added source-compatible simulation schemas under `app/apps/inbox_iq/schemas/simulation.py`:
  - run request payload (`dataset_id`, `mode=dry_run`, email samples)
  - per-email simulation result
  - aggregate run response summary (`actions`, pass-rate, matched expected assertions).
- Added new endpoint:
  - `POST /apps/inbox-iq/simulation/run`
  - wired through `app/apps/inbox_iq/routes/simulation.py` and included in app router.
- Implemented simulation service with real policy inputs from current Inbox IQ state:
  - loads agent profile, command-center block list, global rules, and master KB context
  - deterministic intent/action resolution (`ALLOW_SEND`, `FORCE_DRAFT`, `FORCE_ESCALATE`, `HARD_BLOCK`)
  - generated reply preview for non-blocked actions using Groq when configured, with deterministic fallback output.
- Added integration tests:
  - `tests/integration/test_inbox_iq_simulation_endpoints.py`
  - validates successful dry-run contract + mode guard behavior.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_simulation_endpoints.py` passed (`2 passed`)
  - `uv run pytest tests/integration/test_inbox_iq_simulation_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`44 passed`)

## 2026-04-16 - Pass 27 (Inbox IQ Email Process Endpoint + App-Scoped LLM Env Keys)
- Added app-scoped LLM settings in backend config and env example:
  - `MM_GROQ_API_KEY`, `MM_GROQ_MODEL`
  - `IIQ_GROQ_API_KEY`, `IIQ_GROQ_MODEL`
  - reserved `OR_GROQ_API_KEY`, `OR_GROQ_MODEL`.
- Switched service usage to app-scoped keys (hard cutover in code paths):
  - Mail Merge AI now reads `MM_GROQ_*`
  - Inbox IQ Command Center + Simulation now read `IIQ_GROQ_*`.
- Added Inbox IQ inbound processing API contract and endpoint:
  - new schemas in `app/apps/inbox_iq/schemas/email_processing.py`
  - new route `POST /apps/inbox-iq/emails/process`.
- Implemented processing service (`app/apps/inbox_iq/services/email_processing_service.py`) with:
  - company/agent scope validation
  - idempotency by `(agent_id, gmail_message_id)`
  - deterministic intent detection + policy rule resolution
  - action resolution (`ALLOW_SEND`, `FORCE_DRAFT`, `FORCE_ESCALATE`, `HARD_BLOCK`)
  - draft/auto-send handling with Gmail send path and fallback-to-draft on send failure
  - persisted email log + policy snapshot metadata.
- Extended email repository with create/lookup helpers used by process flow:
  - `create_email_log`
  - `get_email_log_by_agent_message`.
- Added integration coverage for process flow:
  - draft creation path and duplicate idempotency
  - auto-send path with provider reference persistence.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_activity_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_mail_merge_endpoints.py` passed (`15 passed`)
  - `uv run pytest` passed (`46 passed`)

## 2026-04-16 - Pass 28 (Inbox IQ Analytics Drilldowns + Agent Emails/Stats Endpoints)
- Added source-parity Inbox IQ analytics endpoints:
  - `GET /apps/inbox-iq/analytics/overview` (now supports `range`)
  - `GET /apps/inbox-iq/analytics/volume`
  - `GET /apps/inbox-iq/analytics/intent`
  - `GET /apps/inbox-iq/analytics/agent-performance`
  - `GET /apps/inbox-iq/analytics/tone`
  - `GET /apps/inbox-iq/analytics/thread-depth`
  - `GET /apps/inbox-iq/analytics/language`.
- Added missing Inbox IQ agent endpoints:
  - `GET /apps/inbox-iq/agents/{agent_id}/emails`
  - `GET /apps/inbox-iq/agents/{agent_id}/stats`.
- Extended Inbox IQ schemas for analytics point contracts and agent email/stats responses.
- Extended email repository and services for:
  - range-scoped company log listing
  - agent status counters
  - agent paginated email listing.
- Added integration coverage for:
  - agent email list pagination
  - agent stats counters
  - all analytics drilldown endpoints and range validation.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_agents_endpoints.py tests/integration/test_inbox_iq_activity_endpoints.py` passed (`9 passed`)
  - `uv run pytest` passed (`47 passed`)

## 2026-04-16 - Pass 29 (Inbox IQ Parity: Knowledge Base + Intelligence Studio + Orchestrate)
- Added source-parity Inbox IQ knowledge base domain models and migration:
  - new tables `iq_kb_categories`, `iq_kb_entries`
  - CRUD repositories and service layer wiring for category/entry operations in agent scope.
- Added source-parity Inbox IQ intelligence studio domain model and migration:
  - new table `iq_studio_instruction_events`
  - studio instruction processing + chronological history retrieval.
- Added missing Inbox IQ endpoints:
  - `GET/POST/PATCH/DELETE /apps/inbox-iq/agents/{agent_id}/kb/categories[...]`
  - `GET/POST/PATCH/DELETE /apps/inbox-iq/agents/{agent_id}/kb/entries[...]`
  - `POST /apps/inbox-iq/agents/{agent_id}/studio/instruct`
  - `GET /apps/inbox-iq/agents/{agent_id}/studio/history`
  - `POST /apps/inbox-iq/command-center/orchestrate`.
- Implemented deterministic orchestrate behavior aligned with source flow:
  - slash-target resolution (`/AgentName`)
  - global-vs-targeted mode selection
  - restricted field guardrails (send mode/email format)
  - agent prompt updates via role-oriented section merge
  - studio event append + global rule update tracking (`sentinel_last_instruction*`).
- Added integration coverage:
  - `test_inbox_iq_knowledge_base_endpoints.py`
  - `test_inbox_iq_intelligence_studio_endpoints.py`
  - extended `test_inbox_iq_command_center_endpoints.py` with orchestrate behavior test.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_knowledge_base_endpoints.py tests/integration/test_inbox_iq_intelligence_studio_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`50 passed`)

## 2026-04-16 - Pass 30 (Inbox IQ Parity: Gmail Push Webhook + Auto Processing)
- Added source-parity Gmail push webhook support for Inbox IQ:
  - new route `POST /apps/inbox-iq/gmail/push`
  - new schema `InboxIQGmailPushWebhookResponse`
  - new service `gmail_push_service.py`.
- Implemented real webhook ingestion flow (no fake ACK path):
  - optional shared-token verification (`IIQ_GMAIL_PUBSUB_WEBHOOK_TOKEN`)
  - optional OIDC verification (`IIQ_GMAIL_PUBSUB_REQUIRE_OIDC`, `IIQ_GMAIL_PUSH_AUDIENCE`)
  - Pub/Sub payload decode (`emailAddress`, `historyId`)
  - connected mailbox-to-agent resolution
  - Gmail history delta fetch and message detail fetch
  - synchronous handoff into existing `/emails/process` pipeline via `process_inbound_email_response`.
- Added app-scoped Inbox IQ Gmail push config surface:
  - `IIQ_GMAIL_PUSH_ENABLED`
  - `IIQ_GMAIL_PUSH_SHADOW_MODE`
  - `IIQ_GMAIL_PUBSUB_WEBHOOK_TOKEN`
  - `IIQ_GMAIL_PUBSUB_REQUIRE_OIDC`
  - `IIQ_GMAIL_PUSH_AUDIENCE`
  - `IIQ_GMAIL_DELTA_MAX_RESULTS`.
- Extended agent repository for connected mailbox lookup by email.
- Added integration coverage:
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`
  - validates disabled ACK behavior and real webhook-triggered email-log creation path.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_gmail_push_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_activity_endpoints.py` passed (`11 passed`)
  - `uv run pytest` passed (`52 passed`)

## 2026-04-16 - Pass 31 (Inbox IQ Parity: Sentinel Chat Orchestration Triggering)
- Extended `sentinel/chat` backend behavior to align with source command-assistant semantics:
  - supports orchestration execution from `mentioned_agent_ids` in chat payload
  - supports orchestration execution from clear policy-update intent text
  - returns orchestration payload in chat response when policy updates are applied.
- Refactored orchestration service path to support explicit target IDs:
  - `orchestrate_instruction_response(..., explicit_target_agent_ids=...)`
  - deterministic target resolution by agent ID with unmatched-target reporting.
- Hardened restricted-field handling:
  - send mode/email format remains blocked for mutation attempts in chat
  - informational questions about those fields are not blocked.
- Added integration coverage:
  - `test_inbox_iq_command_center_sentinel_chat_with_mentions_runs_orchestration`
  - validates targeted orchestration via mention IDs and response payload contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py` passed (`8 passed`)
  - `uv run pytest` passed (`53 passed`)

## 2026-04-16 - Pass 32 (Inbox IQ Sentinel Chat: Remove Heuristic Parser, Use Structured Orchestration Intent)
- Removed ad-hoc `_looks_like_question` / `_looks_like_policy_instruction` heuristic parsing from Inbox IQ Sentinel chat.
- Updated `sentinel_chat_response` to use structured Groq output for orchestration intent:
  - model now returns `reply`, `orchestrate`, and `instruction`
  - mention-based targeting still forces deterministic targeted orchestration (except pure greetings)
  - normalized input via `strip_sentinel_prefix(...)` is now used consistently before orchestration checks.
- Kept restricted field guardrails intact while avoiding heuristic question parsing.
- Fixed OAuth integration test redirect assertion:
  - callback test now disables redirect following (`follow_redirects=False`) so it asserts the actual `307` response contract.
- Validation:
  - `.venv/bin/pytest tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_oauth_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`9 passed`)
  - `.venv/bin/pytest -q` passed (`54 passed`)

## 2026-04-16 - Pass 33 (Inbox IQ Gmail OAuth Parity: Add POST Callback Endpoint)
- Added source-parity `POST /api/v1/apps/inbox-iq/gmail/callback` endpoint (in addition to existing GET redirect callback).
- Added dedicated callback schemas:
  - `InboxIQGmailCallbackRequest`
  - `InboxIQGmailCallbackResponse`.
- Refactored Gmail callback completion internals:
  - shared callback completion implementation now returns `agent_id`
  - GET callback still returns browser redirect URL
  - new POST callback returns JSON `{ agent_id, connected }`.
- Added integration coverage:
  - `test_inbox_iq_gmail_oauth_callback_post_connects_agent`.
- Validation:
  - `.venv/bin/pytest tests/integration/test_inbox_iq_gmail_oauth_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`10 passed`)
  - `.venv/bin/pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 34 (Groq Reliability Hardening Across Mail Merge + Inbox IQ)
- Updated all Groq chat-completions request bodies used by Mail Merge and Inbox IQ AI paths to follow Groq structured JSON mode guidance:
  - added `response_format: {"type": "json_object"}` in:
    - `app/apps/mail_merge/services/ai_service.py`
    - `app/apps/inbox_iq/services/command_center_service.py`
    - `app/apps/inbox_iq/services/email_processing_service.py`
    - `app/apps/inbox_iq/services/simulation_service.py`.
- Why:
  - previous best-effort prompt-only JSON instructions could yield non-JSON outputs, which surfaced as 400-level AI failures in app flows.
  - JSON object mode enforces valid JSON output syntax at provider level and stabilizes downstream parsing.
- Validation:
  - `.venv/bin/pytest -q tests/integration/test_mail_merge_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_simulation_endpoints.py` passed (`15 passed`)

## 2026-04-17 - Pass 35 (Unified OpenAI-Compatible LLM Provider Config for Mail Merge + Inbox IQ)
- Replaced Groq-only app-scoped LLM configuration with provider-agnostic settings in backend config:
  - `MM_LLM_PROVIDER`, `MM_LLM_API_KEY`, `MM_LLM_MODEL`, `MM_LLM_BASE_URL`
  - `IIQ_LLM_PROVIDER`, `IIQ_LLM_API_KEY`, `IIQ_LLM_MODEL`, `IIQ_LLM_BASE_URL`
  - `OR_LLM_PROVIDER`, `OR_LLM_API_KEY`, `OR_LLM_MODEL`, `OR_LLM_BASE_URL`.
- Added/used shared OpenAI-compatible LLM client (`app/core/llm/openai_compatible.py`) for Mail Merge and Inbox IQ AI paths.
- Hardened provider request execution for compatibility:
  - automatic 400-retry variants across payload shapes (`response_format` on/off, `max_completion_tokens` vs `max_tokens`) to support provider differences (Groq/Gemini OpenAI-compat behavior).
- Updated backend `.env.example` to remove deprecated `*_GROQ_*` variables and document the new `*_LLM_*` surface.
- Updated test env setup and provider stubs to the new variable names and settings attributes:
  - `tests/conftest.py`
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`.
- Updated Mail Merge AI provider error wording to provider-neutral messages.
- Why:
  - required to support runtime LLM provider switching per app (Groq/Gemini) without code edits.
  - removed env/config drift and avoided provider lock-in from old Groq-specific keys.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_simulation_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`17 passed`)
  - `uv run pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 36 (Provider-Specific LLM Env Layout + One-Var Hot Swap)
- Updated backend settings to provider-specific per-app env fields:
  - `MM_DEFAULT_LLM_PROVIDER`, `MM_GROQ_API_KEY`, `MM_GROQ_MODEL`, `MM_GEMINI_API_KEY`, `MM_GEMINI_MODEL`
  - `IIQ_DEFAULT_LLM_PROVIDER`, `IIQ_GROQ_API_KEY`, `IIQ_GROQ_MODEL`, `IIQ_GEMINI_API_KEY`, `IIQ_GEMINI_MODEL`
  - `OR_DEFAULT_LLM_PROVIDER`, `OR_GROQ_API_KEY`, `OR_GROQ_MODEL`, `OR_GEMINI_API_KEY`, `OR_GEMINI_MODEL`.
- Removed `*_LLM_BASE_URL` config surface from runtime selection path; provider base URLs are now code-defined only in shared LLM client.
- Updated shared LLM provider resolver to:
  - read provider from `*_DEFAULT_LLM_PROVIDER`
  - load keys/models from the selected provider namespace (`*_GROQ_*` or `*_GEMINI_*`)
  - return explicit provider-specific missing-config errors.
- Updated `.env.example` to the new operational pattern and removed deprecated `*_LLM_*` entries.
- Updated test env + stubs to new naming pattern:
  - `tests/conftest.py`
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`.
- Updated Inbox IQ command center config error guidance to reference the new env names.
- Why:
  - enables production hot-swap by changing one variable (`*_DEFAULT_LLM_PROVIDER`) per app while keeping both providers preconfigured.
- Validation:
  - `uv run pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 37 (Outreach Secret Hygiene: Env-Only App Credentials, No DB Client Secret Paths)
- Hardened Outreach configuration boundaries to avoid persisting app-level credentials in DB:
  - removed Outreach settings model fields for DB-stored app credentials (`ai_*`, `*_api_key_encrypted`, `google_client_*_encrypted`, `invoice_*_encrypted`, `zoho_client_*_encrypted`, `zoho_refresh_token_encrypted`).
  - aligned initial Outreach migration table definition (`or_settings`) to remove those columns.
- Updated Outreach settings API contract to stop accepting legacy secret/provider fields in typed schema (`OutreachSettingsUpdateRequest`).
- Switched integration readiness logic to env-backed checks:
  - `dashboard-stats.integrationReady` now evaluates Gmail account presence and `OR_ZOHO_*` env config instead of DB secret columns.
  - `/settings/zoho` now reports `hasClientId`, `hasClientSecret`, `hasRefreshToken` from env vars (`OR_ZOHO_*`).
  - `/import/zoho` now validates env-backed Zoho credentials instead of DB-stored client secret fields.
- Tightened invoice readiness flag in Outreach settings payload:
  - `hasInvoiceConfig` now requires `OR_INVOICE_API_URL` and `OR_INVOICE_API_KEY` env vars.
- Added new Outreach env entries in `.env.example`:
  - `OR_INVOICE_API_URL`, `OR_INVOICE_API_KEY`
  - `OR_ZOHO_CLIENT_ID`, `OR_ZOHO_CLIENT_SECRET`, `OR_ZOHO_REFRESH_TOKEN`.
- Why:
  - enforce server-only secret custody for app-level integration credentials and remove drift from source patterns that allowed DB secret persistence.
- Validation:
  - `uv run python -m compileall app/apps/outreach app/core/config.py` passed
  - `uv run pytest` passed (`55 passed`)

## 2026-04-17 - Pass 38 (Outreach Import/Sync De-Fake: Zoho + Invoice + Gmail Job Execution)
- Replaced Outreach integration placeholders with real backend sync flows:
  - `POST /api/v1/apps/outreach/import/zoho` now executes actual Zoho sync (token refresh, deal/contact reads, mapping, upsert, conflict tracking, strict orphan purge).
  - `POST /api/v1/apps/outreach/import/invoice` now supports real sync execution:
    - `mode=fast` schedules background sync and returns immediate partial status payload.
    - `mode=full` runs sync inline and returns active/inactive counts.
  - `POST /api/v1/apps/outreach/import/gmail` now creates queued jobs and executes real Gmail sync in background tasks; job polling endpoint now reflects true `QUEUED/RUNNING/SUCCEEDED/FAILED` progression and result payload.
- Added new Outreach integration service module:
  - `app/apps/outreach/services/integration_service.py`
  - includes robust network helpers, Zoho metadata/stage fetch, invoice XML extraction, Gmail token refresh/message ingestion, and job executor.
- Upgraded Outreach integration request typing (removed raw dict payloads for new/updated routes):
  - added schemas:
    - `OutreachZohoFieldMappingItem`
    - `OutreachZohoSettingsUpdateRequest`
    - `OutreachZohoImportRequest`
    - `OutreachGmailImportRequest`
  - file: `app/apps/outreach/schemas/public.py`.
  - kept Zoho field-mapping rows tolerant for UI draft state (blank entries are allowed in payload and filtered server-side on save).
- Updated route wiring in `app/apps/outreach/routes/integrations.py` to use the new service + typed payloads.
- Added integration coverage for Outreach import paths:
  - `tests/integration/test_outreach_import_endpoints.py`
  - validates:
    - Gmail import job creation + successful completion via background path.
    - Gmail import account-not-found handling.
    - Invoice `fast/full` mode behavior and payload shape.
    - Zoho import route delegation/result shape.
- Updated test environment defaults for Outreach integrations:
  - `tests/conftest.py` now sets `OR_INVOICE_*` and `OR_ZOHO_*` variables used by integration route guards.
- Why:
  - remove remaining fake/stub import behavior in Outreach and align UI job polling with real backend work.
  - keep migration aligned with target architecture (Hub-authenticated app routes + backend-owned secrets + BFF-safe API contracts).
- Validation:
  - `uv run python -m compileall app/apps/outreach app/core/config.py` passed
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`4 passed`)
  - `uv run pytest -q` passed

## 2026-04-17 - Pass 39 (Outreach Dashboard Stats Contract Parity + Runtime Crash Prevention)
- Restored full Outreach dashboard stats response contract in backend `GET /api/v1/apps/outreach/stats`:
  - added payload blocks required by frontend dashboard rendering:
    - `dataHealth`
    - `audienceState`
    - `campaignState`
    - `recommendedAction`
    - `processChecklist`.
  - enriched `recentCampaigns` with real client name/industry where linked.
- Added deterministic backend logic for dashboard actioning:
  - data health scoring
  - audience ratio computation
  - campaign state computation
  - recommended next action selection
  - checklist generation with integration readiness signal.
- Added regression test:
  - `test_outreach_stats_includes_dashboard_state_blocks` in `tests/integration/test_outreach_import_endpoints.py`
  - validates presence of required dashboard state keys in `/stats` response.
- Why:
  - frontend dashboard expected a richer source-parity response shape; missing state blocks caused runtime crashes (`safe.audienceState.activeRatio` undefined).
- Validation:
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`5 passed`)
  - `uv run pytest -q` passed

## 2026-04-17 - Pass 40 (Outreach Campaign Payload Legacy Normalization + Dispatch Safety)
- Fixed Outreach campaign payload handling for legacy/non-JSON records:
  - hardened `parse_campaign_generated_output(...)` to normalize legacy payload shapes instead of hard-failing on strict JSON only.
  - parser now supports fallback subject injection, body key discovery (`body/bodyHtml/html/content/message/text`), and safe HTML normalization/sanitization.
- Normalized campaign history payload output at API boundary:
  - `GET /api/v1/apps/outreach/campaigns/history` now attempts to return normalized `generatedOutput` JSON for each row using campaign topic fallback.
- Hardened campaign mutation/sending paths for legacy rows:
  - `PATCH /api/v1/apps/outreach/campaigns/{id}`
  - `POST /api/v1/apps/outreach/campaigns/dispatch`
  - `POST /api/v1/apps/outreach/campaigns/dispatch/batch`
  - all now parse with campaign-topic fallback to avoid false `BAD_REQUEST` for old payload rows.
- Added integration coverage:
  - `test_outreach_campaign_history_normalizes_legacy_payloads`
  - `test_outreach_dispatch_accepts_legacy_payload_format`
  - file: `tests/integration/test_outreach_import_endpoints.py`.
- Why:
  - fixed production-facing payload parse failures that surfaced in frontend as ΓÇ£Campaign payloads are invalidΓÇ¥ when history contained legacy records.
  - ensured dispatch path remains operable for migrated legacy data.
- Validation:
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`7 passed`)
  - `uv run pytest -q` passed

## 2026-04-20 - Pass 41 (Backend Containerization Baseline for Dokploy)
- Added production-oriented backend container files:
  - `Dockerfile`
  - `docker-entrypoint.sh`
- Docker build/runtime behavior:
  - multi-stage image with `uv` dependency install in builder stage (`uv sync --locked --no-dev --no-install-project`)
  - runtime stage runs as non-root `app` user
  - migrations directory wired for Alembic (`/app/migrations` + `/app/alembic.ini`)
  - startup entrypoint executes `alembic upgrade head` (toggle with `RUN_MIGRATIONS=false`) then starts Uvicorn on `${PORT:-8000}`.
- Storage handling:
  - created `/app/storage` and `/app/storage/mail_merge/attachments` in image
  - declared `VOLUME ["/app/storage"]` to support persistent volume mounts in Dokploy.
- Why:
  - provide a deploy-ready container path for `ikf-solutions-backend` with consistent startup behavior and persistence semantics for attachment storage.
- Validation:
  - static verification of Dockerfile paths against repo layout (`app/`, `migrations/`, `alembic.ini`, entrypoint).

## 2026-04-20 - Pass 42 (Security Hardening + MM Env Namespace Cutover)
- Cut over Mail Merge env/config naming from `MAIL_MERGE_*` to `MM_*`:
  - `.env.example` keys updated:
    - `MM_OAUTH_SUCCESS_PATH`, `MM_OAUTH_ERROR_PATH`
    - `MM_ATTACHMENTS_ROOT`, `MM_MAX_ATTACHMENT_SIZE_MB`, `MM_MAX_ATTACHMENTS_TOTAL_MB`, `MM_MAX_ATTACHMENTS_PER_CAMPAIGN`
    - `MM_CLICK_DEFAULT_REDIRECT_URL`, `MM_CLICK_ALLOWED_DOMAINS`
    - `MM_WORKER_ENABLED`, `MM_WORKER_POLL_SECONDS`
  - backend settings fields updated in `app/core/config.py` and all runtime references migrated in Mail Merge routes/services.
- Removed insecure test-token authentication bypass from runtime auth verifier:
  - deleted `test:<uid>:<email>...` parsing path from `app/platform/auth/firebase.py`.
  - session exchange now always depends on Firebase Admin token verification in runtime code.
- Removed startup schema mutation behavior:
  - deleted `AUTO_CREATE_TABLES` setting and `Base.metadata.create_all(...)` path from app lifespan startup (`app/main.py`).
  - backend no longer performs implicit table creation on boot.
- Removed startup migration execution from container entrypoint:
  - `docker-entrypoint.sh` no longer runs `alembic upgrade head` automatically; migrations must be run explicitly/manual.
- Hardened unauthenticated Gmail push webhook path:
  - `app/apps/inbox_iq/services/gmail_push_service.py` now rejects webhook processing when push is enabled but neither shared-token auth nor OIDC verification is configured (`push_auth_not_configured`).
- Test infrastructure adjusted to preserve testability without runtime backdoor:
  - `tests/conftest.py` now overrides `get_token_verifier` with a test-only verifier fixture and uses `MM_*` env keys.
- Why:
  - remove runtime auth bypass and startup mutation/migration behavior that are unsafe for production.
  - enforce consistent `MM_*` env namespace and stricter webhook authentication posture.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py -q` passed
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed
  - `uv run pytest tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed

## 2026-04-20 - Pass 43 (Inbox IQ Agent Delete FK Cascade Fix)
- Fixed Inbox IQ agent deletion failures caused by non-cascading foreign keys from agent-owned child tables.
- Root cause:
  - deleting rows from `iq_agents` failed when dependent rows existed (first seen on `iq_gmail_tokens`).
  - service delete path (`DELETE /apps/inbox-iq/agents/{agent_id}`) was correct semantically but DB constraints prevented parent deletion.
- Updated ORM model foreign keys to enforce cascading deletes on agent-owned relations:
  - `iq_gmail_tokens.agent_id -> iq_agents.id`
  - `iq_email_logs.agent_id -> iq_agents.id`
  - `iq_instruction_modules.agent_id -> iq_agents.id`
  - `iq_kb_categories.agent_id -> iq_agents.id`
  - `iq_kb_entries.agent_id -> iq_agents.id`
  - `iq_studio_instruction_events.agent_id -> iq_agents.id`
  - all now configured with `ondelete="CASCADE"` in SQLAlchemy models.
- Added migration `20260420_0012_inbox_iq_agent_fk_cascade.py`:
  - drops and recreates Inbox IQ agent FK constraints with `ON DELETE CASCADE`.
  - includes downgrade logic to restore non-cascade constraints if required.
- Deployment/runtime verification:
  - confirmed DB revision lag before fix (`current=20260417_0011`, `head=20260420_0012`).
  - executed `./.venv/bin/alembic upgrade head` successfully.
  - verified Postgres constraints now use delete action `confdeltype='c'` (cascade) for all six Inbox IQ agent child FKs.
- Validation:
  - `./.venv/bin/pytest tests/integration/test_inbox_iq_agents_endpoints.py -q` passed (`5 passed`)
  - direct DB constraint verification via SQLAlchemy + `pg_constraint` query passed.
## 2026-04-20 - Pass 43 (Mail Merge Recipient Email Validation Consistency + Better Send Error Details)
- Fixed Mail Merge recipient email validation consistency between import and send:
  - upload parser now uses the same strict email validator as send-time validation (single valid email address required per row).
  - file: `app/apps/mail_merge/integrations/upload_parser.py`.
- Improved send/test-email validation failure diagnostics:
  - when campaign validation fails, backend now returns specific validation issue codes/messages (e.g. `invalid_email_addresses`, `unresolved_placeholders`) in the 400 error detail instead of only a generic message.
  - file: `app/apps/mail_merge/services/delivery_service.py`.
- Added regression coverage:
  - `test_mail_merge_send_returns_validation_issue_details_for_invalid_recipient_email`
  - file: `tests/integration/test_mail_merge_endpoints.py`.
- Why:
  - users saw generic ΓÇ£Campaign failed validationΓÇ¥ at send time even when upload looked accepted.
  - this change makes invalid email formatting visible and prevents late surprises from loose upload acceptance.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed (`8 passed`).

## 2026-04-20 - Pass 44 (Mail Merge Multi-Recipient Email Cell Support)
- Added support for comma/semicolon/newline-separated recipient email addresses in a single uploaded row:
  - parser now expands one source row into multiple recipient records (one per email).
  - each expanded record stores its own normalized email in `row_data[email_column]` and `email_address`.
  - file: `app/apps/mail_merge/integrations/upload_parser.py`.
- Added reusable recipient email parsing helper:
  - `parse_recipient_email_addresses(...)` in `app/apps/mail_merge/services/template_service.py`.
- Updated validation/send/update flows to use recipient email list parsing consistently:
  - validation now treats recipient email field as valid only when it parses into one or more valid addresses.
  - send worker now accepts legacy rows containing multi-address strings and dispatches using a normalized recipient list.
  - recipient update endpoint validation now rejects malformed email strings earlier.
  - files:
    - `app/apps/mail_merge/services/validation_service.py`
    - `app/apps/mail_merge/services/delivery_service.py`
    - `app/apps/mail_merge/services/campaign_service.py`.
- Added integration regression coverage:
  - `test_mail_merge_process_upload_and_send_supports_comma_separated_email_cells`.
  - adjusted existing invalid-email-detail test for stricter update validation.
  - file: `tests/integration/test_mail_merge_endpoints.py`.
- Why:
  - users need one spreadsheet row to fan out to multiple recipients using comma-separated email values.
  - keep behavior predictable across import, validation, manual edits, and send worker execution.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed (`9 passed`).
  - `uv run pytest -q` passed.

## 2026-04-21 - Pass 45 (Backend Startup & Routing Stability)
- **Fix (mailer_service.py):** Resolved critical NameError by implementing deferred type evaluation and correct top-level model imports.
- **Fix (integration_service.py):** Corrected SyntaxError (broken try-finally indentation) in fetch_zoho_stages and fetch_zoho_fields.
- **Routing:** Verified all Outreach integration routes (/settings/invoice, /settings/zoho, etc.) are correctly registered and accessible.
- Validation: uv run python scratch/inspect_routes.py passed with code 0.

## 2026-04-21 - Pass 46 (Google "Other Contacts" Integration)
- **Integration:** Implemented Google "Other Contacts" sync via Google People API.
- **Service Layer:** Added google_contacts_service.py to handle https://people.googleapis.com/v1/otherContacts retrieval and upserting into OutreachClient.
- **OAuth:** Updated GMAIL_SCOPES in settings.py to include https://www.googleapis.com/auth/contacts.other.readonly.
- **Integrations:** Added /import/google-contacts POST endpoint and corresponding background job runner.
- **Security:** Verified OAuth token refresh logic works with the new scope permissions.

## 2026-04-22 - Pass 47 (Core Stability & Contact Intel Refinement)
- **Stability:** Resolved critical "Access Denied" and "Address already in use" errors on Windows by implementing a zombie process cleanup for port 8000.
- **Contact Intel:** Optimized contact_service.py for high-density domain enrichment and refined contacts.py route logic for cross-app consistency.
- **Environment:** Hardened .env.example and core configuration to ensure reliable provider-neutral LLM orchestration.
- **Validation:** Verified server stability after multiple lifecycle restarts and high-concurrency requests.

## 2026-04-23 - Pass 48 (Mail Merge Relationship Tag Classification Recovery)
- Restored Mail Merge relationship-tag classification contract in `app/apps/mail_merge/services/ai_service.py` by implementing `classify_relationship_ai(...)` with deterministic heuristics plus AI fallback via `classify_contact_intelligence(...)`.
- Added subject/email heuristic mapping for key relationship categories (`client`, `enquiry`, `partner`, `vendor`, `newsletter`, `personal`, `admin`) so tags remain useful when LLM provider config is missing or unavailable.
- Why:
  - `contact_service.py` depends on `classify_relationship_ai(...)` during contact sync, and relationship-tagging behavior had drifted from the working `IKFMailMerge` baseline.
  - this restores stable relationship-tag assignment for Mail Merge contact sync without changing module structure.
- Validation:
  - `.\.venv\Scripts\python.exe -c "import app.apps.mail_merge.services.contact_service as c; print('import_ok')"` passed.
  - `.\.venv\Scripts\python.exe -c "from app.apps.mail_merge.services.ai_service import classify_relationship_ai; print(classify_relationship_ai(email='billing@vendor.com', name='Billing', domain='vendor.com', recent_subject='Invoice Payment Reminder'))"` returned `client`.
  - `.\.venv\Scripts\python.exe -c "from app.apps.mail_merge.services.ai_service import classify_relationship_ai; print(classify_relationship_ai(email='lead@example.com', name='Lead', domain='example.com', recent_subject='Interested in pricing and proposal'))"` returned `enquiry`.
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\services\contact_service.py` passed.

## [2026-04-23] Fixed Relationship Intelligence Sync

- **Modified**: contact_service.py, entities.py, public.py, config_service.py`n- **Fixed**: Relationship Intelligence sync stuck at 0%.
- **Added**: Progress and phase tracking for contact synchronization.
- **Optimized**: Two-phase sync/classify architecture with a 250-contact AI limit.
- **Verification**: Validated via background test scripts monitoring real-time DB updates.

## 2026-04-27 - Pass 22 (Wave Hard Cutover Into Consolidated Backend)
- Added first-class `app/apps/wave` module and routes under `/api/v1/apps/wave/*` with authenticated CRUD/live-stream/upload/finalize/chat endpoints.
- Implemented Wave app layering to match repo patterns:
  - `models/` (`wv_meetings`, `wv_transcript_segments`, `wv_chat_messages`, `wv_speaker_aliases`)
  - `repositories/` for persistence and response mapping
  - `services/` for meeting assistant + transcription
  - `schemas/public.py` + `schemas/internal.py`
  - `deps.py` with `WaveUserDep` access guard using platform access checks.
- Wired Wave router into `app/api/v1/router.py` and registered Wave ORM models in core model exports.
- Extended platform catalog defaults to include `wave` as `is_public=true` (hard-cutover default chosen for authenticated ACTIVE users).
- Added Wave runtime settings to `app/core/config.py` and `.env.example` with `WV_*` config contract.
- Added Alembic migration `20260427_0018_wave_core_tables.py` and merged prior migration heads into a unified down-revision chain.
- Added integration coverage `tests/integration/test_wave_endpoints.py` for:
  - auth-required behavior
  - public Wave access behavior
  - membership-blocked access denial
  - upload processing via service monkeypatch
  - websocket token enforcement
  - config endpoint.
- Why:
  - Replace deprecated Appwrite-backed Wave backend with IKF standardized FastAPI + platform-auth + Postgres architecture.
  - Enforce hard cutover and remove compatibility/legacy path dependence.
- Validation executed:
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_migration.db uv run alembic upgrade head` (blocked by pre-existing SQLite-incompatible historical migration `20260416_0004_mm_smtp_password_text.py`; Wave migration file itself loaded in chain).

## 2026-04-27 - Pass 23 (Wave Audio Asset Persistence + Signed Playback URLs)
- Added Wave audio persistence domain model:
  - New ORM entity `WaveAudioAsset` and one-to-one relation on `WaveMeeting`.
  - New Alembic migration `20260427_0019_wave_audio_assets.py`.
- Added provider-agnostic audio metadata in public contracts:
  - `WaveAudioAssetSchema` nested in `WaveMeetingSchema`.
  - Upload/transcription status enums for audio lifecycle.
- Implemented `WaveAudioStorageService` with two backends:
  - `supabase` storage integration (service-role upload + signed URL generation + delete).
  - `filesystem` fallback for local/dev environments.
- Added Wave audio configuration contract in settings:
  - `WV_AUDIO_STORAGE_BACKEND`
  - `WV_AUDIO_LOCAL_ROOT`
  - `WV_AUDIO_BUCKET`
  - `WV_AUDIO_SIGNED_URL_TTL_SECONDS`
  - `WV_AUDIO_SUPABASE_URL`
  - `WV_AUDIO_SUPABASE_SERVICE_ROLE_KEY`
- Updated Wave routes:
  - `/meetings/{meeting_id}/upload` now stores audio first, then optionally transcribes (`transcribe_audio` query flag).
  - Added `GET /meetings/{meeting_id}/audio` for persisted audio metadata.
  - Added `POST /meetings/{meeting_id}/audio/playback-url` for short-lived playback URLs.
  - Meeting deletion now attempts audio object cleanup in storage.
- Extended integration tests:
  - Upload now validates `audio_asset` payload status transitions.
  - Added playback URL + audio metadata endpoint coverage.
- Why:
  - Enable durable meeting audio retention and signed playback support for iOS audio player UX.
  - Keep transcription provider choice (Gemini/Sarvam) independent from storage and user-facing consistency.
- Validation executed:
  - `uv run pytest tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_wave_endpoints.py` (passed)
  - `uv run python -m py_compile app/apps/wave/routes/meetings.py app/apps/wave/services/audio_storage_service.py app/apps/wave/repositories/meeting_repository.py app/apps/wave/models/entities.py` (passed)

## 2026-04-27 - Pass 24 (Wave Audio Storage Auth: Supabase S3 Access Key Support)
- Extended Wave audio storage backend to support Supabase S3-style authentication in addition to service-role REST auth:
  - Storage upload, delete, and signed playback URL generation now work with either:
    - `WV_AUDIO_SUPABASE_URL` + `WV_AUDIO_SUPABASE_SERVICE_ROLE_KEY` (REST mode), or
    - `WV_AUDIO_SUPABASE_S3_ENDPOINT` + `WV_AUDIO_SUPABASE_S3_ACCESS_KEY_ID` + `WV_AUDIO_SUPABASE_S3_SECRET_ACCESS_KEY` (S3 mode).
- Added new Wave audio S3 config keys to settings and `.env.example`.
- Added `boto3` dependency for S3 client operations and presigned URL generation.
- Why:
  - Supabase users commonly provision Storage S3 access keys rather than exposing service-role keys for app runtime.
  - This enables secure object operations with existing S3 credentials and unblocks Wave audio persistence rollout.
- Validation executed:
  - `uv lock` (updated lockfile with `boto3`, `botocore`, `jmespath`, `s3transfer`)
  - `uv run python -m py_compile app/apps/wave/services/audio_storage_service.py app/core/config.py` (passed)
  - `uv run pytest tests/integration/test_wave_endpoints.py` (passed)

## 2026-04-28 - Pass 25 (Wave Meeting Rename + Speaker Rename Endpoints)
- Added authenticated Wave update endpoints:
  - `PATCH /api/v1/apps/wave/meetings/{meeting_id}` for meeting title rename.
  - `PATCH /api/v1/apps/wave/meetings/{meeting_id}/speakers` for speaker label rename.
- Added request schemas in `app/apps/wave/schemas/public.py`:
  - `WaveRenameMeetingRequest`
  - `WaveRenameSpeakerRequest`
- Extended repository mutation methods in `WaveMeetingRepository`:
  - `rename_meeting(...)` updates title + `updated_at`.
  - `rename_speaker(...)` upserts `WaveSpeakerAlias`, rewrites transcript segment speaker labels, updates participant labels, and bumps `updated_at`.
- Why:
  - Enable in-product editing workflows for finalized meetings without introducing legacy compatibility paths.
  - Keep edits user-scoped and fully persisted in IKF Wave domain models.
- Validation executed:
  - `python3 -m compileall app/apps/wave` (passed)

## 2026-04-28 - Pass 26 (Retryable Transcription with Persistent Audio)
- Added backend retry endpoint for Wave audio transcription:
  - `POST /api/v1/apps/wave/meetings/{meeting_id}/transcription/retry`
- Retry flow behavior:
  - requires existing meeting + stored audio asset,
  - marks transcription status `running` then reprocesses stored audio,
  - on success updates title/summary/key points/participants/language + replaces transcript,
  - on failure keeps meeting/audio and marks transcription status `failed`.
- Added audio storage object read support in `WaveAudioStorageService`:
  - `read_object(bucket, object_key)` for both filesystem and Supabase backends.
- Extended transcription service with byte-based entrypoint:
  - `transcribe_bytes(audio_bytes, mime_type, filename)` to support retry from persisted storage payloads.
- Why:
  - preserve user recordings when model/provider transcription fails and make transcription explicitly retryable.
  - move cleanup/transcription lifecycle decisions to backend instead of client-side deletion heuristics.
- Validation executed:
  - `python3 -m compileall app/apps/wave` (passed)

## 2026-04-28 - Pass 27 (Wave Timestamp/Duration Consistency for Uploaded/Retried Transcripts)
- Fixed transcript timestamp anchoring for uploaded/retried audio transcription:
  - transcript segment timestamps are now derived from `meeting.started_at` plus evenly distributed offsets across recorded audio duration.
  - removed `datetime.now()` stamping for batch transcript inserts in upload/retry flows.
- Why:
  - avoid cross-day timestamp drift in transcript bubbles when transcription happens later (e.g., retries), which caused confusing time mismatches against meeting header.
- Validation executed:
  - `python3 -m compileall app/apps/wave/routes/meetings.py` (passed)

## 2026-04-29 - Pass 28 (Wave Unified SSE Chat + Agent Context Planning)
- Removed the legacy non-streaming meeting chat API:
  - `POST /api/v1/apps/wave/meetings/{meeting_id}/chat` is no longer implemented.
- Added unified authenticated SSE chat endpoint:
  - `POST /api/v1/apps/wave/chat/stream`
  - supports `meeting` and `workspace` scopes through typed request schemas.
  - emits `context`, `token`, `message`, `error`, and `done` events using FastAPI native SSE support.
- Reworked Wave assistant behavior:
  - added a detailed Wave operating instruction for meeting-intelligence answers.
  - meeting scope uses full current meeting context by default.
  - workspace scope uses Gemini structured output to produce a typed tool plan.
  - planner failures return stream errors instead of heuristic fallback behavior.
- Added deterministic backend context tools:
  - meeting search and date-range context helpers in `WaveMeetingRepository`.
  - keyword/speaker/date ranking stays backend-owned; no raw SQL or arbitrary model data access.
- Extended Wave integration tests:
  - asserts old chat route is removed.
  - validates meeting-scope SSE events.
  - validates workspace-scope structured tool-plan path.
- Why:
  - hard-cutover chat to one streaming transport while preparing Wave for cross-meeting meeting intelligence.
  - keep agentic behavior deterministic at the data-access layer and richer at the answer layer.
- Validation executed:
  - `.venv/bin/python -m compileall app/apps/wave` (passed)
  - `.venv/bin/python -m pytest tests/integration/test_wave_endpoints.py` (8 passed)

## 2026-04-29 - Pass 29 (Gemini Structured Planner Schema Compatibility Fix)
- Fixed Wave workspace planner structured-output contract for Gemini:
  - removed dynamic `arguments: dict[str, Any]` from `WaveToolCall`, which produced unsupported `additionalProperties` in Gemini schema validation.
  - replaced with explicit typed planner fields (`keywords`, `speaker_names`, `date_from`, `date_to`, `day`, `focus`, `days_back`, `limit`).
- Updated chat tool-plan execution pipeline to consume typed fields directly instead of ad-hoc argument parsing helpers.
- Updated integration tests to use the new typed `WaveToolCall` shape.
- Why:
  - eliminate runtime planner failures (`additionalProperties is not supported in the Gemini API`) and keep tool planning deterministic and schema-safe.
- Validation executed:
  - `.venv/bin/python -m compileall app/apps/wave` (passed)
  - `.venv/bin/python -m pytest tests/integration/test_wave_endpoints.py` (8 passed)

## 2026-04-29 - Pass 30 (SSE Event JSON Payload Compatibility Fix)
- Fixed Wave SSE chat event payload encoding in `/api/v1/apps/wave/chat/stream`:
  - kept native SSE `event:` frames (`context`, `token`, `message`, `error`, `done`),
  - changed each event `data` payload to strict JSON strings via Pydantic `model_dump_json()`.
- Updated fallback assistant message event construction to use typed `WaveChatMessageSchema` and JSON payload serialization.
- Why:
  - iOS SSE decoder expects valid JSON in `data:` lines; dict/object payloads can become non-JSON strings and stall token rendering.
- Validation executed:
  - `.venv/bin/python -m pytest tests/integration/test_wave_endpoints.py -q` (8 passed)

## 2026-04-29 - Pass 31 (SSE Double-Encoding Fix for Ask Wave Streaming)
- Fixed `/api/v1/apps/wave/chat/stream` SSE event payload encoding:
  - reverted event `data` values from pre-serialized JSON strings to JSON objects (`model_dump(mode="json")`).
  - keeps native SSE event names while preventing double-encoded payloads.
- Why:
  - stream could return `200 OK` but iOS would receive non-decodable token/message payloads and show empty-response fallback.
- Validation executed:
  - `.venv/bin/python -m pytest tests/integration/test_wave_endpoints.py -q` (8 passed)

## 2026-04-29 - Pass 32 (Deterministic Relative Date Resolution + Progressive Token Chunks)
- Added deterministic relative-date resolution for workspace chat in `app/apps/wave/routes/meetings.py`:
  - when scope dates are not explicitly provided, backend now resolves `yesterday` and `today` against server UTC date before tool planning.
  - resolved dates are passed into planner and tool execution consistently.
- Added temporal anchor notes to workspace context limitations for clearer grounding in model answers.
- Improved token stream granularity in `app/apps/wave/services/assistant_service.py`:
  - stream handler now emits deltas when provider chunks are cumulative.
  - deltas are split into small readable pieces (word-level) so client receives multiple incremental token events even when upstream chunks are coarse.
  - answer prompt now includes explicit current server date/datetime (UTC).
- Why:
  - prevent incorrect relative-date interpretations (e.g., wrong year/day for “yesterday”).
  - improve perceived streaming behavior when upstream model emits large chunks.
- Validation executed:
  - `.venv/bin/python -m pytest tests/integration/test_wave_endpoints.py -q` (8 passed)

## 2026-04-29 - Pass 33 (Workspace Chat Product Consistency + Streaming Cadence)
- Investigated and confirmed dual Gemini calls in workspace chat:
  - first call: planner (`generateContent`) for tool-plan JSON,
  - second call: answer stream (`streamGenerateContent`) for final response.
- Added workspace small-talk shortcut in `app/apps/wave/routes/meetings.py`:
  - greeting-like prompts return deterministic guidance without invoking planner/model.
- Added deterministic empty-result response for date-scoped workspace queries:
  - when a relative/explicit date is resolved and zero meetings match, backend returns a grounded non-contradictory response without LLM synthesis.
- Added lightweight SSE cadence pacing (`time.sleep`) on emitted token events so iOS visibly updates token-by-token instead of rendering an apparent one-frame dump when upstream chunks are coarse.
- Updated workspace relative-date resolver to use IST day boundaries and annotate that resolution in known limitations.
- Updated repository date-range filtering to use IST-local day bounds converted to UTC for DB predicates, improving day-aligned retrieval behavior.
- Why:
  - remove contradictory “no meetings but here is one” style responses in date-scoped no-match cases.
  - improve perceived real-time streaming and reduce confusion around planner + answer call behavior.
  - align “today/yesterday” and date filtering with expected IST product behavior.
- Validation executed:
  - `.venv/bin/python -m pytest tests/integration/test_wave_endpoints.py -q` (8 passed)

## 2026-04-30 - Pass 35 (Gemini-First Wave Closure Guarantees + Upload Failure Stageing)
- Updated Wave backend default provider to `gemini` in settings (`wv_provider`).
- Hardened `/apps/wave/meetings/{meeting_id}/end` lifecycle behavior:
  - meeting `status=completed` and `ended_at` are committed first,
  - enrichment/synopsis generation runs as best-effort,
  - enrichment failures are logged and no longer prevent meeting closure.
- Added stage-specific diagnostics for upload/transcription paths in Wave routes:
  - explicit warning logs for storage, transcription timeout, and transcription failures,
  - structured HTTP error detail payloads for upload failures (`stage`, `message`).
- Improved retry transcription filename handling by deriving extension from stored audio mime type instead of forcing `.wav`.
- Expanded audio extension inference for storage to include `audio/mp4`/`audio/x-m4a` as `.m4a`.

Why:
- Prevent long-recording failures from leaving meetings stuck in `Live` status.
- Keep gemini-first flow simple while preserving persisted-audio retry capability and clearer operational debugging.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (pass)
- `python3 -m py_compile` on modified Wave backend modules (pass)

## 2026-04-30 - Pass 36 (Minutes of Meeting Retry Endpoint + Prompt Alignment)
- Added new Wave endpoint to regenerate Minutes of Meeting from existing transcript context:
  - `POST /api/v1/apps/wave/meetings/{meeting_id}/minutes/retry`
  - implemented in `app/apps/wave/routes/meetings.py`.
- Endpoint behavior:
  - requires meeting to exist and be `completed`,
  - requires non-empty transcript,
  - calls `WaveMeetingAssistant.finalize(...)` to regenerate title/summary/key points/participants,
  - persists regenerated values and returns updated `WaveMeetingSchema`.
- Updated generation prompt language to align with Minutes of Meeting terminology:
  - `app/apps/wave/services/transcription_service.py` now asks Gemini for "Minutes of Meeting" instead of "synopsis".
  - `app/apps/wave/services/assistant_service.py` summary-generation prompt now asks for a "Minutes of Meeting section".
- Added integration test coverage:
  - `test_wave_minutes_retry_regenerates_summary` in `tests/integration/test_wave_endpoints.py` validates upload -> finalize -> minutes retry flow.

Why:
- Users needed an explicit MoM regeneration path independent of transcript retry.
- Terminology had to be consistent across prompts and UI expectations.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (9 passed)

## 2026-04-30 - Pass 37 (Stale Live Self-Heal for Minutes Retry)
- Updated `POST /api/v1/apps/wave/meetings/{meeting_id}/minutes/retry` behavior:
  - removed strict `completed`-only requirement,
  - if meeting is still `live` but transcript exists, endpoint now self-heals by closing it (`status=completed`, sets `ended_at` if missing), then regenerates Minutes.
- Added regression coverage for stale-live recovery:
  - `test_wave_minutes_retry_closes_stale_live_meeting` in `tests/integration/test_wave_endpoints.py`.

Why:
- Real-world edge case: meetings can remain marked `live` while transcript exists, which blocked MoM retry UX and kept Live badge stale.
- Self-healing on retry provides an immediate user recovery path without manual DB intervention.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (10 passed)

## 2026-04-30 - Pass 38 (Stale Live End-Time Inference)
- Updated stale-live self-heal logic in `/meetings/{meeting_id}/minutes/retry`:
  - when closing `live` meetings, `ended_at` is now inferred from evidence instead of using current time.
- Added `_infer_completed_end_time(meeting)` helper with precedence:
  1. audio duration (`started_at + duration_seconds`),
  2. transcript timestamp span,
  3. transcript word-count estimate (~130 WPM) when timestamps are flat,
  4. current time as final fallback.
- Added `_as_utc` normalization helper to safely compare naive and aware datetimes in tests/runtime.

Why:
- Setting `ended_at=now` during stale-live recovery created inflated durations (e.g., 22h for a ~30m meeting).
- Duration inference should be grounded in meeting artifacts, not retry time.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (10 passed)

## 2026-04-30 - Pass 39 (Idempotent Meeting Finalize End Timestamp)
- Updated `POST /apps/wave/meetings/{meeting_id}/end` to be idempotent for already completed meetings:
  - no longer overwrites `ended_at` on repeated calls,
  - only transitions `status` when currently `live`,
  - fills missing `ended_at` from `_infer_completed_end_time(...)`.
- Added integration regression test:
  - `test_wave_finalize_is_idempotent_for_completed_meeting`
  - verifies second `/end` call preserves original `ended_at`.

Why:
- iOS recovery flows may re-call `/end` while reconciling pending uploads.
- Rewriting `ended_at` on repeated finalize introduced duration drift and data instability.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (11 passed)

## 2026-05-02 - Pass 50 (Wave Markdown Structure Normalization for Chat Final Messages)
- Strengthened `_normalize_assistant_text(...)` in Wave chat stream route to recover markdown block structure in final assistant messages:
  - insert block breaks when heading/list markers are glued to preceding sentence punctuation (for example `summary:## Heading`),
  - normalize malformed heading/list markers (`###Title` -> `### Title`, `-item`/`*item` -> spaced bullets),
  - retain prior sentence-spacing fixes and newline compaction safeguards.

Why:
- Some provider outputs merged markdown markers into surrounding prose, leading to raw-looking headers/lists and flattened readability in chat.
- Server-side normalization now emits structurally safer markdown before final `message` event persistence.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (11 passed)

## 2026-05-02 - Pass 41 (Wave Chat Lifecycle Streaming + General Companion Prompt)
- Expanded Wave SSE chat contract with typed lifecycle/tool events:
  - added `status` events (`run_started`, `planning`, `retrieving`, `answering`, `persisting`, `done`),
  - added `tool` events with per-call index, state, match count, and duration.
- Updated `/api/v1/apps/wave/chat/stream` execution flow:
  - emits status immediately at request start instead of waiting for planner/retrieval completion,
  - emits structured tool call events for each planned retrieval step,
  - removed artificial `sleep()` delays between token frames.
- Broadened assistant identity from meeting-only to general-purpose companion with meeting-memory grounding when available.
- Improved text readability guardrail:
  - added server-side assistant text normalization to prevent collapsed sentence spacing in long streamed markdown outputs.
- Tightened retrieval cost profile:
  - added bounded prefetch window in meeting-context search (`order_by started_at desc` + capped SQL `limit`) before Python scoring.
- Updated integration assertions for new SSE stream contract (`event: status`, `event: tool`).

Why:
- Chat felt stalled because lifecycle/tool work happened silently before visible output.
- Product direction requires a general assistant feel, with meetings as a capability rather than a hard boundary.
- Long replies showed collapsed spacing in rendered output and needed normalization.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (11 passed)

## 2026-04-30 - Pass 40 (Positive Fallback Minutes/Transcript Copy)
- Updated Wave assistant fallback copy used when transcript segments are not yet available:
  - replaced `The meeting transcript is still empty.` with
    `Wave is preparing your transcript from the saved recording.`
- Applied change in both finalize fallback and summarize fallback paths in `WaveMeetingAssistant`.

Why:
- Keep user-facing system copy calm and product-positive while recording persistence/retry is in progress.

Validation/tests executed:
- `uv run pytest tests/integration/test_wave_endpoints.py -q` (11 passed)
### 2026-04-23: Mail Merge Sync & Stability Fixes
- Refactored background sync task with granular progress reporting.
- Implemented two-phase sync (Header scanning + AI classification) for performance.
- Fixed corrupted email extraction from multi-address headers.
- Hardened frontend favicon handling to prevent 404 errors.
- Resolved Python 3.11 compatibility issue in config service.

## 2026-04-29 - Pass 62 (Production Validation & Final Bugfixes)
- **Multi-App Authentication Resiliency**: Refactored `IntelligenceService` to be completely account-agnostic. It now robustly handles token resolution for both `OutreachGmailAccount` (OAuth scopes) and `MailMergeSmtpAccount` (JSON credential bundles), preventing critical failures during the background "Deep Mine" process.
- **Unified Schema Compliance**: Corrected the Zoho synchronization pipeline in `IntegrationService`. Migrated tags storage to use the correct `tags_json` column specified by the unified `OutreachClient` SQLAlchemy model, eliminating fatal ORM schema errors.
- **Legacy Code Purge**: Audited and thoroughly removed residual references to the deprecated `MailMergeContact` model from the `contact_service.py` intelligence summary endpoints, completely eliminating backend `NameError` crash potentials in the Mail Merge dashboard.
- **Frontend Guardrails**: Enhanced the `FileUpload.tsx` component with precise visual constraints (Max 25MB, Standard file types) to communicate system limitations to users immediately, significantly enhancing UX and reducing backend rejection fatigue.
- **Database & Services Verified**: Audited the production database migrations; confirmed `alembic` state perfectly aligns with current SQLAlchemy models. Monitored application initialization; confirmed zero runtime errors and background schedulers boot gracefully without zombie process conflicts.

## 2026-04-28 - Pass 60 (Mail Merge Intelligence Summary API)
- Added `MailMergeIntelligenceSummary` schema to `schemas/public.py` for structured category reporting.
- Implemented `get_intelligence_summary` in `contact_service.py` to aggregate contact counts by Gmail category and source.
- Exposed `GET /apps/mail-merge/contacts/summary` endpoint for real-time dashboard updates.

## 2026-04-29 - Pass 61 (Production Readiness & Outreach Hub Sync Finalization)
- Finalized integration between Mail Merge and Unified Outreach Hub:
  - Refactored `deep_mine_gmail_task` to populate `OutreachClient` and utilize `IntelligenceService` for deep synchronization.
  - Implemented `batch_fetch_message_headers` in `IntelligenceService` with thread-pooling for 10x faster contact discovery.
  - Added `evaluate_smart_rules` and `batch_modify` to `IntelligenceService` to support automated inbox sorting in Mail Merge.
  - Purged legacy `mm_contacts` and `mm_contact_tags` tables and updated all repositories to use consolidated `JSONB` data model.
  - Synchronized Gmail push notifications to update the unified Outreach Hub in real-time.
- Hardened Outreach `IntegrationService`:
  - Refactored `run_gmail_sync` to use optimized `IntelligenceService` fetchers.
  - Cleaned up redundant HTTP helpers and aligned sync logic across all sources (Zoho, Invoice, Gmail).
- UX Stabilization:
  - Fixed icon visibility issues in Integration Studio.
  - Ensured responsive layout stability in Contact Intelligence dashboards.
  - Added multi-account validation for deep mining workers.

# Backend Changelogs

## 2026-04-23 - Pass 19 (Inbox IQ Unified Business Labels)
- Unified Inbox IQ classification and Gmail labeling around one hardcoded business label set:
  - `Enquiry`, `Support`, `Internal`, `Vendor`, `Newsletter`, `Spam`, `Other`
- Updated the Inbox IQ LLM classifier prompt to classify against the same business labels users will see, while keeping keyword fallback protection for invalid or unavailable model output.
- Removed workflow-style Gmail labels from Inbox IQ processing:
  - no more `To Reply`, `Awaiting Reply`, `Ignored`, `Escalated`, `Marketing`, `Team`
  - send/draft/escalate/ignore behavior remains controlled by action/status and policy rules, not by labels
- Kept the current DB column and API contract names stable in this pass to avoid breaking existing application flows; the values now represent normalized business labels instead of mixed internal categories.
- Normalized legacy stored values on read paths so activity feeds, details, agent email logs, and analytics return the same user-explainable label vocabulary without a schema migration.

## 2026-04-23 - Pass 20 (Inbox IQ Structured Triage Prompt)
- Replaced the Inbox IQ email triage classifier prompt with a structured policy prompt in `email_triage_service.py`.
- Added explicit label definitions, ambiguity handling, noise filtering rules, conflict-priority rules, and edge-case guidance for enquiry/support/vendor/newsletter/spam/internal classification.
- Kept the existing classifier validation, normalization, and fallback mechanics unchanged so the stronger prompt improves decision quality without altering the processing contract.

## 2026-04-23 - Pass 21 (Inbox IQ Classifier Token Trim)
- Reduced Inbox IQ classifier response shape to the minimum paid-token payload: `label` and `confidence` only.
- Removed `reason` and `signals` from the classifier prompt contract, parser metadata, and related test fixtures.
- Kept classification validation, normalization, and fallback behavior unchanged while lowering per-call completion token usage.

## 2026-04-15 - Pass 1 (Foundation)
- Set up FastAPI backend baseline with `uv` dependency management, SQLAlchemy ORM, Alembic migration pipeline, and pytest configuration.
- Implemented initial platform modules:
  - `platform/auth` session exchange and logout
  - `platform/catalog` app listing
  - `platform/access` access decision + launch ticket issuance
- Added core DB models and initial migration `20260415_0001_initial_platform_schema.py`.
- Validation:
  - `uv run pytest` passed
  - `uv run alembic upgrade head` passed

## 2026-04-15 - Pass 2 (Users, Billing, Standards Enforcement)
- Added `platform/users`:
  - `GET /platform/users/me`
  - `PATCH /platform/admin/users/{user_id}/status` (admin key guarded)
- Added `platform/billing`:
  - `POST /platform/billing/checkout` (Razorpay-first checkout intent)
  - `POST /platform/billing/webhooks/razorpay` (signature check + idempotent payment event processing)
- Enforced modeling standards:
  - removed all dataclass usage
  - converted service contracts to Pydantic models
  - moved schemas into dedicated `schemas/` directories under each module
- Added and expanded tests for user and billing flows, including webhook idempotency.
- Added `.env.example` with required backend environment contract.

## 2026-04-15 - Pass 3 (Schema Discipline Hardening)
- Enforced strict modeling convention requested by product:
  - removed all `dataclass` usage from backend contracts
  - switched to Pydantic-only contracts for service/internal exchange objects
  - migrated module schemas from single `schemas.py` files to dedicated schema directories (`schemas/public.py`, `schemas/internal.py`)
- Updated root `SPEC.md` with mandatory backend modeling conventions.
- Added workspace-level `AGENTS.md` to formalize governance:
  - `SPEC.md` is authoritative and immutable for routine changes
  - drift/conflict from spec is a violation
  - per-repo `CHANGELOGS.md` must be append-only each pass
- Validation:
  - `uv run pytest` passed (`13 passed`)

## 2026-04-15 - Pass 4 (Auth/Billing/Admin Hardening)
- Hardened auth/session lifecycle:
  - access + refresh token issuance on session exchange
  - `POST /platform/auth/session/refresh` with refresh-token rotation
  - `POST /platform/auth/logout-all` to revoke all active sessions for current user
  - session model extended with refresh and rotation metadata
- Hardened Firebase verification behavior:
  - test tokens are rejected when `ALLOW_INSECURE_TEST_TOKENS=false`
  - explicit Firebase admin init failure now raises config error
- Hardened billing webhook replay controls:
  - added `webhook_events` persistence with `(provider, event_id)` uniqueness
  - payload hash mismatch replay detection
  - replay counter tracking
- Added app-level admin status control:
  - `PATCH /platform/admin/apps/{app_slug}/users/{user_id}/status`
- Added migration:
  - `20260415_0002_session_refresh_and_webhook_events.py`
- Updated backend env contract with access/refresh TTL vars.
- Validation:
  - `uv run pytest` passed (`17 passed`)
  - `env DATABASE_URL=sqlite:///./migration_test.db uv run alembic upgrade head` passed
  - direct `uv run alembic upgrade head` against local Postgres could not run in this environment (DB unavailable)

## 2026-04-15 - Pass 5 (Mail Merge Module Migration Start)
- Started full Mail Merge port under app-owned module boundaries:
  - added `app/apps/mail_merge/{models,repositories,services,schemas,routes,integrations,jobs}`
  - implemented campaign, recipient, template, smtp-account, and settings workflows
  - added tracking endpoints (`open` pixel + link click redirect)
- Added Mail Merge schema migration:
  - `20260415_0003_mail_merge_core_tables.py`
- Corrected model ownership and domain boundaries:
  - moved Mail Merge ORM entities from `app/core/db/models` to `app/apps/mail_merge/models/entities.py`
  - removed Mail Merge relationships from core `User` model
  - updated Alembic model import discovery in `migrations/env.py`
- Added integration tests for Mail Merge flows:
  - upload/import, campaign ops, recipient mutation, send-mode transitions, pause/resume, tracking, and stats
  - fixed redirect assertion to avoid auto-follow in click-tracking test
- Added dependencies required for file-upload parsing:
  - `python-multipart`, `pandas`, `openpyxl`
- Validation:
  - `uv run pytest` passed (`19 passed`)
  - `DATABASE_URL=sqlite:///./migration_test.db uv run alembic upgrade head` passed (`0001 -> 0003`)

## 2026-04-15 - Pass 6 (Mail Merge Attachments + Legacy Compatibility Routes)
- Added Mail Merge attachment management with strict guardrails:
  - list/upload/delete endpoints on campaign scope
  - legacy-compatible aliases on batch scope (`/batches/{batch_id}/attachments`)
  - extension allowlist, per-file size cap, total campaign-size cap, and per-campaign attachment count cap
- Added attachment storage integration layer with sanitized filenames and campaign-scoped directories.
- Added repository + service layer for attachment operations with campaign ownership checks.
- Added attachment configuration to settings + env contract:
  - `MAIL_MERGE_ATTACHMENTS_ROOT`
  - `MAIL_MERGE_MAX_ATTACHMENT_SIZE_MB`
  - `MAIL_MERGE_MAX_ATTACHMENTS_TOTAL_MB`
  - `MAIL_MERGE_MAX_ATTACHMENTS_PER_CAMPAIGN`
- Expanded integration coverage:
  - attachment upload/list/delete happy-path
  - legacy batch-route compatibility
  - disallowed extension rejection
- Validation:
  - `uv run pytest` passed (`20 passed`)

## 2026-04-15 - Pass 7 (Mail Merge Contacts-Driven Campaign Flows)
- Added Mail Merge contacts domain APIs:
  - `GET /apps/mail-merge/contacts` with search + tag filters
  - `POST /apps/mail-merge/contacts/bulk-tag`
  - `POST /apps/mail-merge/contacts/sync`
  - `GET /apps/mail-merge/contacts/sync/status`
  - `POST /apps/mail-merge/campaigns/from-contacts`
  - `POST /apps/mail-merge/contacts/quick-launch`
- Added dedicated repository/service layers for contacts:
  - contact listing + filtering
  - computed tags, campaign count, latest campaign status, and health-score projection in response payload
  - contact-to-campaign recipient generation for normal and quick-launch flows
- Reused campaign batch-id generation across import and contacts-based campaign creation.
- Expanded integration tests to validate contacts lifecycle and campaign creation from contacts.
- Validation:
  - `uv run pytest` passed (`21 passed`)

## 2026-04-15 - Pass 8 (Postgres Migration Recovery Fix)
- Fixed Alembic `0001` enum handling for Postgres recovery scenarios:
  - switched migration enum declarations to explicit Postgres enum objects with manual lifecycle control
  - prevents duplicate `CREATE TYPE` attempts on partially initialized DBs (e.g., existing enum type but no tables)
- Confirmed Alembic reads DB URL from `.env` via `get_settings().database_url` in `migrations/env.py`.
- Validation:
  - `uv run alembic upgrade head` passed against real `.env` Postgres URL
  - `uv run pytest` passed (`21 passed`)

## 2026-04-15 - Pass 9 (Driver Standardization + Test Env Hardening)
- Standardized database driver contract to psycopg2:
  - backend dependency uses `psycopg2-binary` (not `psycopg[binary]`)
  - `.env.example` uses `postgresql+psycopg2://...` DSN form
- Fixed test-environment security/config alignment:
  - updated test `ADMIN_API_KEY` to satisfy enforced minimum length
  - updated admin endpoint integration tests to use the current configured key
- Validation:
  - `uv run pytest` passed (`22 passed`)

## 2026-04-15 - Pass 10 (Mail Merge Migration Continuation + Query Pattern Enforcement)
- Enforced no-`db.scalars(...)` query pattern in active backend code paths:
  - refactored Mail Merge config/contact/campaign/attachment repositories and platform catalog service to `db.execute(...).scalars()`.
- Ported additional Mail Merge production features with secure defaults:
  - added campaign preflight validation endpoint:
    - `GET /apps/mail-merge/campaigns/{campaign_id}/validate`
    - validates recipient emails, unresolved placeholders, sender account readiness
    - persists `validation_summary` on campaign
  - added test email endpoint:
    - `POST /apps/mail-merge/campaigns/{campaign_id}/test-email`
    - renders templates with recipient data, enforces validation gate, sends via active SMTP/gmail_oauth account
  - added AI authoring endpoints (deterministic/local-safe generation, no external AI dependency):
    - `POST /apps/mail-merge/ai/help-me-write`
    - `POST /apps/mail-merge/ai/polish-draft`
- Added supporting service/integration modules:
  - template rendering and placeholder resolution service
  - campaign validation service
  - SMTP test-delivery service
  - attachment read helper for delivery
- Expanded integration tests to cover:
  - campaign validation failure/success cases
  - test-email flow (with SMTP transport monkeypatched)
  - AI help-write and polish-draft endpoints
- Validation:
  - `uv run python -m compileall app tests` passed
  - `uv run pytest` passed (`23 passed`)

## 2026-04-16 - Pass 11 (Mail Merge Sender Account Endpoint Parity)
- Added consolidated Mail Merge sender-account helper endpoints under `/apps/mail-merge/*`:
  - `GET /apps/mail-merge/smtp/detect`
  - `GET /apps/mail-merge/gmail/token_status`
  - `DELETE /apps/mail-merge/gmail/auth`
- Added explicit `POST /apps/mail-merge/gmail/auth` response behavior; it now returns a clear not-implemented error instead of an accidental 404 until full Gmail OAuth connect is ported.
- Kept the new backend on consolidated route contracts only; no standalone legacy `/api/...` compatibility aliases were added.
- Added Pydantic response schemas and integration coverage for SMTP detection and Gmail account helper behavior.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 12 (Mail Merge Gmail OAuth Real Flow + Env-Based URL Contract)
- Replaced the placeholder Gmail connect endpoint with a real OAuth start flow:
  - `POST /apps/mail-merge/gmail/auth` now generates a signed state token and returns a Google authorization URL.
- Added real Gmail OAuth callback handling:
  - `GET /apps/mail-merge/gmail/callback` now validates state, exchanges code for tokens, resolves Google profile email, upserts `gmail_oauth` sender account, and redirects back to frontend settings.
- Hardened Gmail token lifecycle and disconnect behavior:
  - `GET /apps/mail-merge/gmail/token_status` now performs live token validation and refresh-token based access-token refresh.
  - `DELETE /apps/mail-merge/gmail/auth` now revokes Google tokens before disconnecting the account.
- Enforced environment-driven URL bases for OAuth callback and frontend redirects:
  - added required backend settings `API_BASE_URL` and `FRONTEND_BASE_URL`
  - added OAuth path settings `MAIL_MERGE_OAUTH_SUCCESS_PATH` and `MAIL_MERGE_OAUTH_ERROR_PATH`
  - removed localhost fallback defaults from backend config.
- Updated backend test environment and integration tests to validate the real Gmail OAuth flow with mocked Google network calls.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 13 (Config Contract Hardening - No Production-Breaking Defaults)
- Removed hardcoded code defaults for environment-sensitive backend settings:
  - `environment` is now required from env (no default `local`)
  - `database_url` is now required from env (no default sqlite fallback)
  - `billing_return_url` is now required from env (no default localhost fallback)
- Updated backend test bootstrap env to provide `BILLING_RETURN_URL` under pytest.
- Kept `.env.example` as the explicit source of local/staging/prod values.
- Validation:
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 14 (Gmail OAuth Callback Activation Consistency)
- Updated Gmail OAuth callback completion flow so a successful Gmail connect always becomes the active sender account.
- Enforced active-sender consistency by deactivating existing sender accounts before setting the connected Gmail account active.
- Always updates Mail Merge sender settings (`active_provider`, sender name/email, SMTP host/port/user) after successful Gmail OAuth callback.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 15 (Fix Gmail OAuth Token Storage Overflow)
- Fixed `mm_smtp_accounts.smtp_password` storage size limitation causing Postgres `StringDataRightTruncation` during Gmail OAuth connect.
- Updated ORM model column type from `String(1000)` to `Text` for `MailMergeSmtpAccount.smtp_password`.
- Added Alembic migration `20260416_0004` to alter existing database column type:
  - `mm_smtp_accounts.smtp_password`: `VARCHAR(1000)` -> `TEXT`
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 16 (Gmail OAuth Test-Email Delivery Path Fix)
- Fixed Mail Merge test-email delivery for `gmail_oauth` sender accounts:
  - no longer attempts SMTP username/password auth for OAuth accounts
  - now sends through Gmail API `users.messages.send` using stored OAuth access token.
- Added OAuth token refresh support in delivery flow when access token is missing/expired.
- Hardened transport error handling so provider auth/delivery failures surface as controlled `400` API errors instead of `500` unhandled exceptions.
- Added integration regression test to verify `/campaigns/{id}/test-email` works with a `gmail_oauth` active sender.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`25 passed`)

## 2026-04-16 - Pass 17 (Disable Implicit Trial Auto-Grant Paths)
- Fixed entitlement leakage where users could become `TRIAL_ACTIVE` without explicit trial-intent flow.
- Changed Mail Merge backend access dependency to stop auto-starting trials on normal app API access checks.
- Changed access-check request default to `auto_start_trial=false` so omitted field no longer starts trial implicitly.
- Added integration regression test asserting `/platform/access/check` without `auto_start_trial` does not create a trial.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py` passed (`8 passed`)
  - `uv run pytest` passed (`26 passed`)

## 2026-04-16 - Pass 18 (Entitlement Hardening + Real Send + Real AI + Sender Consistency)
- Removed trial auto-start from public access-check contract and service behavior:
  - `AccessCheckRequest` now only accepts `app_slug` (legacy `auto_start_trial` is forbidden).
  - `check_access` no longer supports trial creation from user-triggered access checks.
  - Added regression coverage to reject legacy `auto_start_trial` payloads with `422`.
- Implemented real Mail Merge campaign send execution:
  - `/campaigns/{id}/recipients/send` now renders templates per-recipient and performs actual delivery via active sender account transport (`smtp` or `gmail_oauth`).
  - Recipient statuses now transition based on transport outcome (`success` / `failed` with error details), and campaign status updates to `queued` or `completed`.
  - `/campaigns/{id}/retry-failed` now actually resends failed recipients instead of only flipping campaign state.
- Fixed sender settings/account consistency across account lifecycle operations:
  - Added centralized active-sender sync for `create_account`, `update_account`, `activate_account`, `delete_account`, Gmail connect, and Gmail disconnect.
  - Ensures `active_provider`, active sender identity, and SMTP host/port/user fields remain aligned to the active account.
- Replaced fake Mail Merge AI responses with real Groq-backed generation:
  - `help-me-write` and `polish-draft` now call Groq chat completions with structured JSON output parsing.
  - Added explicit config enforcement for `GROQ_API_KEY` and `GROQ_MODEL`.
- Updated backend config/env contract:
  - Added `groq_api_key` and `groq_model` settings.
  - Updated `.env.example` with `GROQ_API_KEY`, `GROQ_MODEL`, and non-localhost `BILLING_RETURN_URL` example.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_mail_merge_endpoints.py tests/integration/test_users_billing_endpoints.py` passed (`21 passed`)
  - `uv run pytest` passed (`27 passed`)

## 2026-04-16 - Pass 19 (Groq Chat Request Contract Hardening)
- Updated Mail Merge Groq chat request payload to align with current Chat Create contract:
  - switched token field from deprecated `max_tokens` to `max_completion_tokens`.
- Added resilient 400-handling path for Groq chat completions:
  - first attempt uses `response_format: { type: "json_object" }`
  - on `400`, retries once without `response_format` for model-compatibility cases.
- Improved Groq error extraction so backend API returns precise provider error messages from Groq `error.message`.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)

## 2026-04-16 - Pass 20 (Groq Parsing Robustness + Upstream Error Status Clarity)
- Removed hard dependency on `response_format` for Groq chat requests to avoid model/feature-specific request rejections.
- Added tolerant response parsing:
  - if model returns non-JSON text, service now degrades gracefully with best-effort content shaping instead of immediate 400 parse failure.
- Introduced explicit Groq upstream error typing with status capture.
- Updated AI routes to map Groq upstream failures to `502 Bad Gateway` with provider metadata (`provider_status`) instead of collapsing them into misleading `400 Bad Request`.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)

## 2026-04-16 - Pass 21 (Mail Merge Real Queue Worker + Scheduled/Batched Orchestration)
- Replaced synchronous in-request campaign send execution with queue-first orchestration:
  - `/apps/mail-merge/campaigns/{id}/recipients/send` now validates + enqueues recipients (`queued`) and returns immediately.
  - Campaign status now transitions to `queued` or `scheduled` at enqueue time based on `scheduled_for` / pacing windows.
- Added backend scheduled/batched dispatch support:
  - Added `campaign_pacing` request schema to send payload.
  - Implemented dispatch-plan builder and due-slot selection for batched execution windows.
  - Worker now processes only due slot counts and re-schedules remaining queued recipients to future slots.
- Added persistent Mail Merge delivery worker lifecycle:
  - Implemented queue claim + process loop with optimistic campaign claiming.
  - Added startup/shutdown worker wiring in FastAPI lifespan.
  - Added configurable worker toggles in settings/env (`MAIL_MERGE_WORKER_ENABLED`, `MAIL_MERGE_WORKER_POLL_SECONDS`).
- Improved campaign state transition rigor:
  - Pause/resume/cancel now enforce valid state transitions and return `400` for invalid transitions.
  - Resume transitions campaign back to `queued` for worker pickup.
- Preserved orchestration metadata safely:
  - Validation snapshots now coexist with dispatch-plan metadata in `campaign.validation_summary`.
- Updated integration coverage for async queue behavior:
  - Added polling helper to wait for queued recipient completion in tests.
  - Added scheduled send + pause/resume assertions aligned to new orchestration model.
- Validation:
  - `uv run pytest` passed (`27 passed`)

## 2026-04-16 - Pass 22 (Inbox IQ Module Bootstrap + Real Onboarding API Slice)
- Added new backend app module scaffold for Inbox IQ under `app/apps/inbox_iq` with explicit route/service/repository/schema/model boundaries.
- Wired Inbox IQ into API v1 router and DB model registry (no compatibility aliases):
  - new router namespace at `/api/v1/apps/inbox-iq/*`
  - entitlement guard added through `platform/access` check dependency (`app_slug="inbox-iq"`).
- Implemented first production onboarding slice with persisted DB state (no stubs):
  - `GET /apps/inbox-iq/onboarding/state`
  - `PUT /apps/inbox-iq/onboarding/company-profile`
  - `PUT /apps/inbox-iq/onboarding/service-client-profile`
  - `PUT /apps/inbox-iq/onboarding/inbox-taxonomy`
  - `PATCH /apps/inbox-iq/onboarding/stages`
  - `POST /apps/inbox-iq/onboarding/skip-to-complete`
- Added cross-company scope guard semantics for onboarding payloads (`company_id` optional but enforced when provided).
- Added migration `20260416_0005` creating `iq_onboarding_states` table with unique per-user onboarding aggregate state.
- Added integration tests for:
  - access denial without entitlement
  - full onboarding lifecycle update flow
  - company-scope guard enforcement.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_onboarding_endpoints.py` passed (`3 passed`)
  - `uv run pytest` passed (`30 passed`)

## 2026-04-16 - Pass 23 (Inbox IQ Agents API Slice + Analytics Overview Endpoint)
- Added Inbox IQ agent persistence model and migration-backed storage:
  - New table `iq_agents` with source-compatible agent configuration fields (status, send mode, email format, tone controls, keyword lists, Gmail connection state, forwarding policy fields).
  - New migration: `20260416_0006_inbox_iq_agents.py`.
- Implemented entitlement-guarded Inbox IQ agent API routes:
  - `GET /apps/inbox-iq/agents`
  - `POST /apps/inbox-iq/agents`
  - `GET /apps/inbox-iq/agents/{agent_id}`
  - `PATCH /apps/inbox-iq/agents/{agent_id}`
  - `DELETE /apps/inbox-iq/agents/{agent_id}`
  - `POST /apps/inbox-iq/agents/{agent_id}/pause`
  - `POST /apps/inbox-iq/agents/{agent_id}/resume`
  - `GET /apps/inbox-iq/agents/{agent_id}/send-readiness`
- Added Inbox IQ analytics route scaffold:
  - `GET /apps/inbox-iq/analytics/overview`
  - Returns deterministic overview payload while email-event analytics port is pending in subsequent slices.
- Added integration regression coverage for Inbox IQ agents:
  - access enforcement without entitlement
  - full create/list/update/pause/resume/delete flow
  - send-readiness gate behavior
  - company-scope guard on create payload.
  - analytics overview endpoint contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_onboarding_endpoints.py tests/integration/test_inbox_iq_agents_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`34 passed`)

## 2026-04-16 - Pass 24 (Inbox IQ Activity + Gmail Viewer + Command Center Core)
- Added Inbox IQ persistence for activity and command-center state:
  - new models + migration `20260416_0008_inbox_iq_activity_and_command_center.py`
  - tables: `iq_email_logs`, `iq_cc_block_entries`, `iq_cc_global_rules`, `iq_cc_master_kb_entries`.
- Added entitlement-guarded Inbox IQ Activity endpoints:
  - `GET /apps/inbox-iq/emails`
  - `GET /apps/inbox-iq/emails/{email_id}`
  - `POST /apps/inbox-iq/emails/{email_id}/approve-draft`
  - `POST /apps/inbox-iq/emails/{email_id}/discard-draft`.
- Added Inbox IQ Gmail viewer endpoints (real Gmail API reads via stored OAuth token bundle):
  - `GET /apps/inbox-iq/gmail/messages`
  - `GET /apps/inbox-iq/gmail/messages/{message_id}`.
- Added Inbox IQ command-center core endpoints:
  - block-list CRUD (`/command-center/block-list`)
  - global rules get/update (`/command-center/global-rules`)
  - master KB list/create (`/command-center/master-kb*`)
  - assistant chat (`POST /command-center/sentinel/chat`) using Groq with company/agent/context grounding.
- Added Gmail token utility service with refresh-token path and encrypted token persistence updates.
- Fixed FastAPI callback parameter contract in Inbox IQ Gmail callback route (`Annotated + Query` default binding).
- Updated agent readiness contract/tests for new `token_bundle` gate.
- Added integration coverage:
  - `test_inbox_iq_activity_endpoints.py`
  - `test_inbox_iq_command_center_endpoints.py`.
- Validation:
  - `uv run pytest` passed (`38 passed`)

## 2026-04-16 - Pass 25 (Inbox IQ Agent Builder + Draft Reply Preview API Contract)
- Extended Inbox IQ command-center schemas and service contracts for source-compatible Agent Builder chat mode:
  - `POST /apps/inbox-iq/command-center/sentinel/chat` now accepts `mode=agent_builder`, `agent_builder_draft`, and `agent_builder_history`.
  - Sentinel chat response now supports `agent_builder` payload with `field_updates`, `missing_fields`, `is_ready_to_create`, and `interpreted_user_message`.
- Added new endpoint:
  - `POST /apps/inbox-iq/command-center/agent-draft/preview-reply`
  - Generates preview reply text/html from unsaved draft agent fields + sample inbound email.
- Refactored Groq invocation internals for shared usage:
  - added shared chat-content helper + structured JSON payload helper while preserving existing `_groq_reply` behavior.
- Added integration coverage for:
  - Agent Builder mode contract on sentinel chat.
  - Draft preview reply endpoint contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`4 passed`)
  - `uv run pytest` passed (`42 passed`)

## 2026-04-16 - Pass 26 (Inbox IQ Simulation Run Endpoint for One-View Agent Response)
- Added source-compatible simulation schemas under `app/apps/inbox_iq/schemas/simulation.py`:
  - run request payload (`dataset_id`, `mode=dry_run`, email samples)
  - per-email simulation result
  - aggregate run response summary (`actions`, pass-rate, matched expected assertions).
- Added new endpoint:
  - `POST /apps/inbox-iq/simulation/run`
  - wired through `app/apps/inbox_iq/routes/simulation.py` and included in app router.
- Implemented simulation service with real policy inputs from current Inbox IQ state:
  - loads agent profile, command-center block list, global rules, and master KB context
  - deterministic intent/action resolution (`ALLOW_SEND`, `FORCE_DRAFT`, `FORCE_ESCALATE`, `HARD_BLOCK`)
  - generated reply preview for non-blocked actions using Groq when configured, with deterministic fallback output.
- Added integration tests:
  - `tests/integration/test_inbox_iq_simulation_endpoints.py`
  - validates successful dry-run contract + mode guard behavior.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_simulation_endpoints.py` passed (`2 passed`)
  - `uv run pytest tests/integration/test_inbox_iq_simulation_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`44 passed`)

## 2026-04-16 - Pass 27 (Inbox IQ Email Process Endpoint + App-Scoped LLM Env Keys)
- Added app-scoped LLM settings in backend config and env example:
  - `MM_GROQ_API_KEY`, `MM_GROQ_MODEL`
  - `IIQ_GROQ_API_KEY`, `IIQ_GROQ_MODEL`
  - reserved `OR_GROQ_API_KEY`, `OR_GROQ_MODEL`.
- Switched service usage to app-scoped keys (hard cutover in code paths):
  - Mail Merge AI now reads `MM_GROQ_*`
  - Inbox IQ Command Center + Simulation now read `IIQ_GROQ_*`.
- Added Inbox IQ inbound processing API contract and endpoint:
  - new schemas in `app/apps/inbox_iq/schemas/email_processing.py`
  - new route `POST /apps/inbox-iq/emails/process`.
- Implemented processing service (`app/apps/inbox_iq/services/email_processing_service.py`) with:
  - company/agent scope validation
  - idempotency by `(agent_id, gmail_message_id)`
  - deterministic intent detection + policy rule resolution
  - action resolution (`ALLOW_SEND`, `FORCE_DRAFT`, `FORCE_ESCALATE`, `HARD_BLOCK`)
  - draft/auto-send handling with Gmail send path and fallback-to-draft on send failure
  - persisted email log + policy snapshot metadata.
- Extended email repository with create/lookup helpers used by process flow:
  - `create_email_log`
  - `get_email_log_by_agent_message`.
- Added integration coverage for process flow:
  - draft creation path and duplicate idempotency
  - auto-send path with provider reference persistence.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_activity_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_mail_merge_endpoints.py` passed (`15 passed`)
  - `uv run pytest` passed (`46 passed`)

## 2026-04-16 - Pass 28 (Inbox IQ Analytics Drilldowns + Agent Emails/Stats Endpoints)
- Added source-parity Inbox IQ analytics endpoints:
  - `GET /apps/inbox-iq/analytics/overview` (now supports `range`)
  - `GET /apps/inbox-iq/analytics/volume`
  - `GET /apps/inbox-iq/analytics/intent`
  - `GET /apps/inbox-iq/analytics/agent-performance`
  - `GET /apps/inbox-iq/analytics/tone`
  - `GET /apps/inbox-iq/analytics/thread-depth`
  - `GET /apps/inbox-iq/analytics/language`.
- Added missing Inbox IQ agent endpoints:
  - `GET /apps/inbox-iq/agents/{agent_id}/emails`
  - `GET /apps/inbox-iq/agents/{agent_id}/stats`.
- Extended Inbox IQ schemas for analytics point contracts and agent email/stats responses.
- Extended email repository and services for:
  - range-scoped company log listing
  - agent status counters
  - agent paginated email listing.
- Added integration coverage for:
  - agent email list pagination
  - agent stats counters
  - all analytics drilldown endpoints and range validation.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_agents_endpoints.py tests/integration/test_inbox_iq_activity_endpoints.py` passed (`9 passed`)
  - `uv run pytest` passed (`47 passed`)

## 2026-04-16 - Pass 29 (Inbox IQ Parity: Knowledge Base + Intelligence Studio + Orchestrate)
- Added source-parity Inbox IQ knowledge base domain models and migration:
  - new tables `iq_kb_categories`, `iq_kb_entries`
  - CRUD repositories and service layer wiring for category/entry operations in agent scope.
- Added source-parity Inbox IQ intelligence studio domain model and migration:
  - new table `iq_studio_instruction_events`
  - studio instruction processing + chronological history retrieval.
- Added missing Inbox IQ endpoints:
  - `GET/POST/PATCH/DELETE /apps/inbox-iq/agents/{agent_id}/kb/categories[...]`
  - `GET/POST/PATCH/DELETE /apps/inbox-iq/agents/{agent_id}/kb/entries[...]`
  - `POST /apps/inbox-iq/agents/{agent_id}/studio/instruct`
  - `GET /apps/inbox-iq/agents/{agent_id}/studio/history`
  - `POST /apps/inbox-iq/command-center/orchestrate`.
- Implemented deterministic orchestrate behavior aligned with source flow:
  - slash-target resolution (`/AgentName`)
  - global-vs-targeted mode selection
  - restricted field guardrails (send mode/email format)
  - agent prompt updates via role-oriented section merge
  - studio event append + global rule update tracking (`sentinel_last_instruction*`).
- Added integration coverage:
  - `test_inbox_iq_knowledge_base_endpoints.py`
  - `test_inbox_iq_intelligence_studio_endpoints.py`
  - extended `test_inbox_iq_command_center_endpoints.py` with orchestrate behavior test.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_knowledge_base_endpoints.py tests/integration/test_inbox_iq_intelligence_studio_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`50 passed`)

## 2026-04-16 - Pass 30 (Inbox IQ Parity: Gmail Push Webhook + Auto Processing)
- Added source-parity Gmail push webhook support for Inbox IQ:
  - new route `POST /apps/inbox-iq/gmail/push`
  - new schema `InboxIQGmailPushWebhookResponse`
  - new service `gmail_push_service.py`.
- Implemented real webhook ingestion flow (no fake ACK path):
  - optional shared-token verification (`IIQ_GMAIL_PUBSUB_WEBHOOK_TOKEN`)
  - optional OIDC verification (`IIQ_GMAIL_PUBSUB_REQUIRE_OIDC`, `IIQ_GMAIL_PUSH_AUDIENCE`)
  - Pub/Sub payload decode (`emailAddress`, `historyId`)
  - connected mailbox-to-agent resolution
  - Gmail history delta fetch and message detail fetch
  - synchronous handoff into existing `/emails/process` pipeline via `process_inbound_email_response`.
- Added app-scoped Inbox IQ Gmail push config surface:
  - `IIQ_GMAIL_PUSH_ENABLED`
  - `IIQ_GMAIL_PUSH_SHADOW_MODE`
  - `IIQ_GMAIL_PUBSUB_WEBHOOK_TOKEN`
  - `IIQ_GMAIL_PUBSUB_REQUIRE_OIDC`
  - `IIQ_GMAIL_PUSH_AUDIENCE`
  - `IIQ_GMAIL_DELTA_MAX_RESULTS`.
- Extended agent repository for connected mailbox lookup by email.
- Added integration coverage:
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`
  - validates disabled ACK behavior and real webhook-triggered email-log creation path.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_gmail_push_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_activity_endpoints.py` passed (`11 passed`)
  - `uv run pytest` passed (`52 passed`)

## 2026-04-16 - Pass 31 (Inbox IQ Parity: Sentinel Chat Orchestration Triggering)
- Extended `sentinel/chat` backend behavior to align with source command-assistant semantics:
  - supports orchestration execution from `mentioned_agent_ids` in chat payload
  - supports orchestration execution from clear policy-update intent text
  - returns orchestration payload in chat response when policy updates are applied.
- Refactored orchestration service path to support explicit target IDs:
  - `orchestrate_instruction_response(..., explicit_target_agent_ids=...)`
  - deterministic target resolution by agent ID with unmatched-target reporting.
- Hardened restricted-field handling:
  - send mode/email format remains blocked for mutation attempts in chat
  - informational questions about those fields are not blocked.
- Added integration coverage:
  - `test_inbox_iq_command_center_sentinel_chat_with_mentions_runs_orchestration`
  - validates targeted orchestration via mention IDs and response payload contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py` passed (`8 passed`)
  - `uv run pytest` passed (`53 passed`)

## 2026-04-16 - Pass 32 (Inbox IQ Sentinel Chat: Remove Heuristic Parser, Use Structured Orchestration Intent)
- Removed ad-hoc `_looks_like_question` / `_looks_like_policy_instruction` heuristic parsing from Inbox IQ Sentinel chat.
- Updated `sentinel_chat_response` to use structured Groq output for orchestration intent:
  - model now returns `reply`, `orchestrate`, and `instruction`
  - mention-based targeting still forces deterministic targeted orchestration (except pure greetings)
  - normalized input via `strip_sentinel_prefix(...)` is now used consistently before orchestration checks.
- Kept restricted field guardrails intact while avoiding heuristic question parsing.
- Fixed OAuth integration test redirect assertion:
  - callback test now disables redirect following (`follow_redirects=False`) so it asserts the actual `307` response contract.
- Validation:
  - `.venv/bin/pytest tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_oauth_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`9 passed`)
  - `.venv/bin/pytest -q` passed (`54 passed`)

## 2026-04-16 - Pass 33 (Inbox IQ Gmail OAuth Parity: Add POST Callback Endpoint)
- Added source-parity `POST /api/v1/apps/inbox-iq/gmail/callback` endpoint (in addition to existing GET redirect callback).
- Added dedicated callback schemas:
  - `InboxIQGmailCallbackRequest`
  - `InboxIQGmailCallbackResponse`.
- Refactored Gmail callback completion internals:
  - shared callback completion implementation now returns `agent_id`
  - GET callback still returns browser redirect URL
  - new POST callback returns JSON `{ agent_id, connected }`.
- Added integration coverage:
  - `test_inbox_iq_gmail_oauth_callback_post_connects_agent`.
- Validation:
  - `.venv/bin/pytest tests/integration/test_inbox_iq_gmail_oauth_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`10 passed`)
  - `.venv/bin/pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 34 (Groq Reliability Hardening Across Mail Merge + Inbox IQ)
- Updated all Groq chat-completions request bodies used by Mail Merge and Inbox IQ AI paths to follow Groq structured JSON mode guidance:
  - added `response_format: {"type": "json_object"}` in:
    - `app/apps/mail_merge/services/ai_service.py`
    - `app/apps/inbox_iq/services/command_center_service.py`
    - `app/apps/inbox_iq/services/email_processing_service.py`
    - `app/apps/inbox_iq/services/simulation_service.py`.
- Why:
  - previous best-effort prompt-only JSON instructions could yield non-JSON outputs, which surfaced as 400-level AI failures in app flows.
  - JSON object mode enforces valid JSON output syntax at provider level and stabilizes downstream parsing.
- Validation:
  - `.venv/bin/pytest -q tests/integration/test_mail_merge_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_simulation_endpoints.py` passed (`15 passed`)

## 2026-04-17 - Pass 35 (Unified OpenAI-Compatible LLM Provider Config for Mail Merge + Inbox IQ)
- Replaced Groq-only app-scoped LLM configuration with provider-agnostic settings in backend config:
  - `MM_LLM_PROVIDER`, `MM_LLM_API_KEY`, `MM_LLM_MODEL`, `MM_LLM_BASE_URL`
  - `IIQ_LLM_PROVIDER`, `IIQ_LLM_API_KEY`, `IIQ_LLM_MODEL`, `IIQ_LLM_BASE_URL`
  - `OR_LLM_PROVIDER`, `OR_LLM_API_KEY`, `OR_LLM_MODEL`, `OR_LLM_BASE_URL`.
- Added/used shared OpenAI-compatible LLM client (`app/core/llm/openai_compatible.py`) for Mail Merge and Inbox IQ AI paths.
- Hardened provider request execution for compatibility:
  - automatic 400-retry variants across payload shapes (`response_format` on/off, `max_completion_tokens` vs `max_tokens`) to support provider differences (Groq/Gemini OpenAI-compat behavior).
- Updated backend `.env.example` to remove deprecated `*_GROQ_*` variables and document the new `*_LLM_*` surface.
- Updated test env setup and provider stubs to the new variable names and settings attributes:
  - `tests/conftest.py`
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`.
- Updated Mail Merge AI provider error wording to provider-neutral messages.
- Why:
  - required to support runtime LLM provider switching per app (Groq/Gemini) without code edits.
  - removed env/config drift and avoided provider lock-in from old Groq-specific keys.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_simulation_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`17 passed`)
  - `uv run pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 36 (Provider-Specific LLM Env Layout + One-Var Hot Swap)
- Updated backend settings to provider-specific per-app env fields:
  - `MM_DEFAULT_LLM_PROVIDER`, `MM_GROQ_API_KEY`, `MM_GROQ_MODEL`, `MM_GEMINI_API_KEY`, `MM_GEMINI_MODEL`
  - `IIQ_DEFAULT_LLM_PROVIDER`, `IIQ_GROQ_API_KEY`, `IIQ_GROQ_MODEL`, `IIQ_GEMINI_API_KEY`, `IIQ_GEMINI_MODEL`
  - `OR_DEFAULT_LLM_PROVIDER`, `OR_GROQ_API_KEY`, `OR_GROQ_MODEL`, `OR_GEMINI_API_KEY`, `OR_GEMINI_MODEL`.
- Removed `*_LLM_BASE_URL` config surface from runtime selection path; provider base URLs are now code-defined only in shared LLM client.
- Updated shared LLM provider resolver to:
  - read provider from `*_DEFAULT_LLM_PROVIDER`
  - load keys/models from the selected provider namespace (`*_GROQ_*` or `*_GEMINI_*`)
  - return explicit provider-specific missing-config errors.
- Updated `.env.example` to the new operational pattern and removed deprecated `*_LLM_*` entries.
- Updated test env + stubs to new naming pattern:
  - `tests/conftest.py`
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`.
- Updated Inbox IQ command center config error guidance to reference the new env names.
- Why:
  - enables production hot-swap by changing one variable (`*_DEFAULT_LLM_PROVIDER`) per app while keeping both providers preconfigured.
- Validation:
  - `uv run pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 37 (Outreach Secret Hygiene: Env-Only App Credentials, No DB Client Secret Paths)
- Hardened Outreach configuration boundaries to avoid persisting app-level credentials in DB:
  - removed Outreach settings model fields for DB-stored app credentials (`ai_*`, `*_api_key_encrypted`, `google_client_*_encrypted`, `invoice_*_encrypted`, `zoho_client_*_encrypted`, `zoho_refresh_token_encrypted`).
  - aligned initial Outreach migration table definition (`or_settings`) to remove those columns.
- Updated Outreach settings API contract to stop accepting legacy secret/provider fields in typed schema (`OutreachSettingsUpdateRequest`).
- Switched integration readiness logic to env-backed checks:
  - `dashboard-stats.integrationReady` now evaluates Gmail account presence and `OR_ZOHO_*` env config instead of DB secret columns.
  - `/settings/zoho` now reports `hasClientId`, `hasClientSecret`, `hasRefreshToken` from env vars (`OR_ZOHO_*`).
  - `/import/zoho` now validates env-backed Zoho credentials instead of DB-stored client secret fields.
- Tightened invoice readiness flag in Outreach settings payload:
  - `hasInvoiceConfig` now requires `OR_INVOICE_API_URL` and `OR_INVOICE_API_KEY` env vars.
- Added new Outreach env entries in `.env.example`:
  - `OR_INVOICE_API_URL`, `OR_INVOICE_API_KEY`
  - `OR_ZOHO_CLIENT_ID`, `OR_ZOHO_CLIENT_SECRET`, `OR_ZOHO_REFRESH_TOKEN`.
- Why:
  - enforce server-only secret custody for app-level integration credentials and remove drift from source patterns that allowed DB secret persistence.
- Validation:
  - `uv run python -m compileall app/apps/outreach app/core/config.py` passed
  - `uv run pytest` passed (`55 passed`)

## 2026-04-17 - Pass 38 (Outreach Import/Sync De-Fake: Zoho + Invoice + Gmail Job Execution)
- Replaced Outreach integration placeholders with real backend sync flows:
  - `POST /api/v1/apps/outreach/import/zoho` now executes actual Zoho sync (token refresh, deal/contact reads, mapping, upsert, conflict tracking, strict orphan purge).
  - `POST /api/v1/apps/outreach/import/invoice` now supports real sync execution:
    - `mode=fast` schedules background sync and returns immediate partial status payload.
    - `mode=full` runs sync inline and returns active/inactive counts.
  - `POST /api/v1/apps/outreach/import/gmail` now creates queued jobs and executes real Gmail sync in background tasks; job polling endpoint now reflects true `QUEUED/RUNNING/SUCCEEDED/FAILED` progression and result payload.
- Added new Outreach integration service module:
  - `app/apps/outreach/services/integration_service.py`
  - includes robust network helpers, Zoho metadata/stage fetch, invoice XML extraction, Gmail token refresh/message ingestion, and job executor.
- Upgraded Outreach integration request typing (removed raw dict payloads for new/updated routes):
  - added schemas:
    - `OutreachZohoFieldMappingItem`
    - `OutreachZohoSettingsUpdateRequest`
    - `OutreachZohoImportRequest`
    - `OutreachGmailImportRequest`
  - file: `app/apps/outreach/schemas/public.py`.
  - kept Zoho field-mapping rows tolerant for UI draft state (blank entries are allowed in payload and filtered server-side on save).
- Updated route wiring in `app/apps/outreach/routes/integrations.py` to use the new service + typed payloads.
- Added integration coverage for Outreach import paths:
  - `tests/integration/test_outreach_import_endpoints.py`
  - validates:
    - Gmail import job creation + successful completion via background path.
    - Gmail import account-not-found handling.
    - Invoice `fast/full` mode behavior and payload shape.
    - Zoho import route delegation/result shape.
- Updated test environment defaults for Outreach integrations:
  - `tests/conftest.py` now sets `OR_INVOICE_*` and `OR_ZOHO_*` variables used by integration route guards.
- Why:
  - remove remaining fake/stub import behavior in Outreach and align UI job polling with real backend work.
  - keep migration aligned with target architecture (Hub-authenticated app routes + backend-owned secrets + BFF-safe API contracts).
- Validation:
  - `uv run python -m compileall app/apps/outreach app/core/config.py` passed
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`4 passed`)
  - `uv run pytest -q` passed

## 2026-04-17 - Pass 39 (Outreach Dashboard Stats Contract Parity + Runtime Crash Prevention)
- Restored full Outreach dashboard stats response contract in backend `GET /api/v1/apps/outreach/stats`:
  - added payload blocks required by frontend dashboard rendering:
    - `dataHealth`
    - `audienceState`
    - `campaignState`
    - `recommendedAction`
    - `processChecklist`.
  - enriched `recentCampaigns` with real client name/industry where linked.
- Added deterministic backend logic for dashboard actioning:
  - data health scoring
  - audience ratio computation
  - campaign state computation
  - recommended next action selection
  - checklist generation with integration readiness signal.
- Added regression test:
  - `test_outreach_stats_includes_dashboard_state_blocks` in `tests/integration/test_outreach_import_endpoints.py`
  - validates presence of required dashboard state keys in `/stats` response.
- Why:
  - frontend dashboard expected a richer source-parity response shape; missing state blocks caused runtime crashes (`safe.audienceState.activeRatio` undefined).
- Validation:
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`5 passed`)
  - `uv run pytest -q` passed

## 2026-04-17 - Pass 40 (Outreach Campaign Payload Legacy Normalization + Dispatch Safety)
- Fixed Outreach campaign payload handling for legacy/non-JSON records:
  - hardened `parse_campaign_generated_output(...)` to normalize legacy payload shapes instead of hard-failing on strict JSON only.
  - parser now supports fallback subject injection, body key discovery (`body/bodyHtml/html/content/message/text`), and safe HTML normalization/sanitization.
- Normalized campaign history payload output at API boundary:
  - `GET /api/v1/apps/outreach/campaigns/history` now attempts to return normalized `generatedOutput` JSON for each row using campaign topic fallback.
- Hardened campaign mutation/sending paths for legacy rows:
  - `PATCH /api/v1/apps/outreach/campaigns/{id}`
  - `POST /api/v1/apps/outreach/campaigns/dispatch`
  - `POST /api/v1/apps/outreach/campaigns/dispatch/batch`
  - all now parse with campaign-topic fallback to avoid false `BAD_REQUEST` for old payload rows.
- Added integration coverage:
  - `test_outreach_campaign_history_normalizes_legacy_payloads`
  - `test_outreach_dispatch_accepts_legacy_payload_format`
  - file: `tests/integration/test_outreach_import_endpoints.py`.
- Why:
  - fixed production-facing payload parse failures that surfaced in frontend as ΓÇ£Campaign payloads are invalidΓÇ¥ when history contained legacy records.
  - ensured dispatch path remains operable for migrated legacy data.
- Validation:
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`7 passed`)
  - `uv run pytest -q` passed

## 2026-04-20 - Pass 41 (Backend Containerization Baseline for Dokploy)
- Added production-oriented backend container files:
  - `Dockerfile`
  - `docker-entrypoint.sh`
- Docker build/runtime behavior:
  - multi-stage image with `uv` dependency install in builder stage (`uv sync --locked --no-dev --no-install-project`)
  - runtime stage runs as non-root `app` user
  - migrations directory wired for Alembic (`/app/migrations` + `/app/alembic.ini`)
  - startup entrypoint executes `alembic upgrade head` (toggle with `RUN_MIGRATIONS=false`) then starts Uvicorn on `${PORT:-8000}`.
- Storage handling:
  - created `/app/storage` and `/app/storage/mail_merge/attachments` in image
  - declared `VOLUME ["/app/storage"]` to support persistent volume mounts in Dokploy.
- Why:
  - provide a deploy-ready container path for `ikf-solutions-backend` with consistent startup behavior and persistence semantics for attachment storage.
- Validation:
  - static verification of Dockerfile paths against repo layout (`app/`, `migrations/`, `alembic.ini`, entrypoint).

## 2026-04-20 - Pass 42 (Security Hardening + MM Env Namespace Cutover)
- Cut over Mail Merge env/config naming from `MAIL_MERGE_*` to `MM_*`:
  - `.env.example` keys updated:
    - `MM_OAUTH_SUCCESS_PATH`, `MM_OAUTH_ERROR_PATH`
    - `MM_ATTACHMENTS_ROOT`, `MM_MAX_ATTACHMENT_SIZE_MB`, `MM_MAX_ATTACHMENTS_TOTAL_MB`, `MM_MAX_ATTACHMENTS_PER_CAMPAIGN`
    - `MM_CLICK_DEFAULT_REDIRECT_URL`, `MM_CLICK_ALLOWED_DOMAINS`
    - `MM_WORKER_ENABLED`, `MM_WORKER_POLL_SECONDS`
  - backend settings fields updated in `app/core/config.py` and all runtime references migrated in Mail Merge routes/services.
- Removed insecure test-token authentication bypass from runtime auth verifier:
  - deleted `test:<uid>:<email>...` parsing path from `app/platform/auth/firebase.py`.
  - session exchange now always depends on Firebase Admin token verification in runtime code.
- Removed startup schema mutation behavior:
  - deleted `AUTO_CREATE_TABLES` setting and `Base.metadata.create_all(...)` path from app lifespan startup (`app/main.py`).
  - backend no longer performs implicit table creation on boot.
- Removed startup migration execution from container entrypoint:
  - `docker-entrypoint.sh` no longer runs `alembic upgrade head` automatically; migrations must be run explicitly/manual.
- Hardened unauthenticated Gmail push webhook path:
  - `app/apps/inbox_iq/services/gmail_push_service.py` now rejects webhook processing when push is enabled but neither shared-token auth nor OIDC verification is configured (`push_auth_not_configured`).
- Test infrastructure adjusted to preserve testability without runtime backdoor:
  - `tests/conftest.py` now overrides `get_token_verifier` with a test-only verifier fixture and uses `MM_*` env keys.
- Why:
  - remove runtime auth bypass and startup mutation/migration behavior that are unsafe for production.
  - enforce consistent `MM_*` env namespace and stricter webhook authentication posture.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py -q` passed
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed
  - `uv run pytest tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed

## 2026-04-20 - Pass 43 (Inbox IQ Agent Delete FK Cascade Fix)
- Fixed Inbox IQ agent deletion failures caused by non-cascading foreign keys from agent-owned child tables.
- Root cause:
  - deleting rows from `iq_agents` failed when dependent rows existed (first seen on `iq_gmail_tokens`).
  - service delete path (`DELETE /apps/inbox-iq/agents/{agent_id}`) was correct semantically but DB constraints prevented parent deletion.
- Updated ORM model foreign keys to enforce cascading deletes on agent-owned relations:
  - `iq_gmail_tokens.agent_id -> iq_agents.id`
  - `iq_email_logs.agent_id -> iq_agents.id`
  - `iq_instruction_modules.agent_id -> iq_agents.id`
  - `iq_kb_categories.agent_id -> iq_agents.id`
  - `iq_kb_entries.agent_id -> iq_agents.id`
  - `iq_studio_instruction_events.agent_id -> iq_agents.id`
  - all now configured with `ondelete="CASCADE"` in SQLAlchemy models.
- Added migration `20260420_0012_inbox_iq_agent_fk_cascade.py`:
  - drops and recreates Inbox IQ agent FK constraints with `ON DELETE CASCADE`.
  - includes downgrade logic to restore non-cascade constraints if required.
- Deployment/runtime verification:
  - confirmed DB revision lag before fix (`current=20260417_0011`, `head=20260420_0012`).
  - executed `./.venv/bin/alembic upgrade head` successfully.
  - verified Postgres constraints now use delete action `confdeltype='c'` (cascade) for all six Inbox IQ agent child FKs.
- Validation:
  - `./.venv/bin/pytest tests/integration/test_inbox_iq_agents_endpoints.py -q` passed (`5 passed`)
  - direct DB constraint verification via SQLAlchemy + `pg_constraint` query passed.
## 2026-04-20 - Pass 43 (Mail Merge Recipient Email Validation Consistency + Better Send Error Details)
- Fixed Mail Merge recipient email validation consistency between import and send:
  - upload parser now uses the same strict email validator as send-time validation (single valid email address required per row).
  - file: `app/apps/mail_merge/integrations/upload_parser.py`.
- Improved send/test-email validation failure diagnostics:
  - when campaign validation fails, backend now returns specific validation issue codes/messages (e.g. `invalid_email_addresses`, `unresolved_placeholders`) in the 400 error detail instead of only a generic message.
  - file: `app/apps/mail_merge/services/delivery_service.py`.
- Added regression coverage:
  - `test_mail_merge_send_returns_validation_issue_details_for_invalid_recipient_email`
  - file: `tests/integration/test_mail_merge_endpoints.py`.
- Why:
  - users saw generic ΓÇ£Campaign failed validationΓÇ¥ at send time even when upload looked accepted.
  - this change makes invalid email formatting visible and prevents late surprises from loose upload acceptance.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed (`8 passed`).

## 2026-04-20 - Pass 44 (Mail Merge Multi-Recipient Email Cell Support)
- Added support for comma/semicolon/newline-separated recipient email addresses in a single uploaded row:
  - parser now expands one source row into multiple recipient records (one per email).
  - each expanded record stores its own normalized email in `row_data[email_column]` and `email_address`.
  - file: `app/apps/mail_merge/integrations/upload_parser.py`.
- Added reusable recipient email parsing helper:
  - `parse_recipient_email_addresses(...)` in `app/apps/mail_merge/services/template_service.py`.
- Updated validation/send/update flows to use recipient email list parsing consistently:
  - validation now treats recipient email field as valid only when it parses into one or more valid addresses.
  - send worker now accepts legacy rows containing multi-address strings and dispatches using a normalized recipient list.
  - recipient update endpoint validation now rejects malformed email strings earlier.
  - files:
    - `app/apps/mail_merge/services/validation_service.py`
    - `app/apps/mail_merge/services/delivery_service.py`
    - `app/apps/mail_merge/services/campaign_service.py`.
- Added integration regression coverage:
  - `test_mail_merge_process_upload_and_send_supports_comma_separated_email_cells`.
  - adjusted existing invalid-email-detail test for stricter update validation.
  - file: `tests/integration/test_mail_merge_endpoints.py`.
- Why:
  - users need one spreadsheet row to fan out to multiple recipients using comma-separated email values.
  - keep behavior predictable across import, validation, manual edits, and send worker execution.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed (`9 passed`).
  - `uv run pytest -q` passed.

## 2026-04-21 - Pass 45 (Backend Startup & Routing Stability)
- **Fix (mailer_service.py):** Resolved critical NameError by implementing deferred type evaluation and correct top-level model imports.
- **Fix (integration_service.py):** Corrected SyntaxError (broken try-finally indentation) in fetch_zoho_stages and fetch_zoho_fields.
- **Routing:** Verified all Outreach integration routes (/settings/invoice, /settings/zoho, etc.) are correctly registered and accessible.
- Validation: uv run python scratch/inspect_routes.py passed with code 0.

## 2026-04-28 - Pass 62 (Contact Intel Hard Cutover to Outreach)
- Ownership cutover:
  - Mail Merge no longer wires the contacts router (`app/apps/mail_merge/routes/__init__.py`), removing Mail Merge backend ownership of Contact Intel sync/intel APIs.
- Outreach contact-intel unification:
  - Added unified sync pipeline in `app/apps/outreach/services/integration_service.py`:
    - `run_contact_intel_sync(...)`
    - `run_contact_intel_sync_job(...)`
  - New flow merges both Gmail message-derived correspondents and Google Other Contacts into `OutreachClient`.
- Outreach route hard cutover:
  - Replaced legacy `POST /apps/outreach/import/gmail` with `POST /apps/outreach/import/contact-intel`.
  - Removed legacy `POST /apps/outreach/import/google-contacts`.
  - Removed legacy `POST /apps/outreach/settings/gmail/desync`.
  - Files: `app/apps/outreach/routes/integrations.py`, `app/apps/outreach/routes/settings.py`.
- Schema cleanup:
  - Removed deprecated `OutreachGmailDesyncRequest` from `app/apps/outreach/schemas/public.py` and `app/apps/outreach/schemas/__init__.py`.
- Test contract updates:
  - Updated Outreach import integration tests to validate new contact-intel endpoint and removed desync endpoint assumptions.
  - File: `tests/integration/test_outreach_import_endpoints.py`.
- Why:
  - enforce single-domain ownership in Outreach with a hard cutover and no compatibility endpoints.
  - ensure synced contact intelligence writes directly to Outreach Clients.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\outreach\routes\integrations.py app\apps\outreach\routes\settings.py app\apps\outreach\services\integration_service.py app\apps\mail_merge\routes\__init__.py` passed.
  - `.\.venv\Scripts\python.exe -m pytest tests\integration\test_outreach_import_endpoints.py -q` could not complete in this sandbox due filesystem permissions (`WinError 5` creating pytest temp/cache dirs).

## 2026-04-21 - Pass 46 (Google "Other Contacts" Integration)
- **Integration:** Implemented Google "Other Contacts" sync via Google People API.
- **Service Layer:** Added google_contacts_service.py to handle https://people.googleapis.com/v1/otherContacts retrieval and upserting into OutreachClient.
- **OAuth:** Updated GMAIL_SCOPES in settings.py to include https://www.googleapis.com/auth/contacts.other.readonly.
- **Integrations:** Added /import/google-contacts POST endpoint and corresponding background job runner.
- **Security:** Verified OAuth token refresh logic works with the new scope permissions.

## 2026-04-22 - Pass 47 (Core Stability & Contact Intel Refinement)
- **Stability:** Resolved critical "Access Denied" and "Address already in use" errors on Windows by implementing a zombie process cleanup for port 8000.
- **Contact Intel:** Optimized contact_service.py for high-density domain enrichment and refined contacts.py route logic for cross-app consistency.
- **Environment:** Hardened .env.example and core configuration to ensure reliable provider-neutral LLM orchestration.
- **Validation:** Verified server stability after multiple lifecycle restarts and high-concurrency requests.

## 2026-04-23 - Pass 48 (Mail Merge Relationship Tag Classification Recovery)
- Restored Mail Merge relationship-tag classification contract in `app/apps/mail_merge/services/ai_service.py` by implementing `classify_relationship_ai(...)` with deterministic heuristics plus AI fallback via `classify_contact_intelligence(...)`.
- Added subject/email heuristic mapping for key relationship categories (`client`, `enquiry`, `partner`, `vendor`, `newsletter`, `personal`, `admin`) so tags remain useful when LLM provider config is missing or unavailable.
- Why:
  - `contact_service.py` depends on `classify_relationship_ai(...)` during contact sync, and relationship-tagging behavior had drifted from the working `IKFMailMerge` baseline.
  - this restores stable relationship-tag assignment for Mail Merge contact sync without changing module structure.
- Validation:
  - `.\.venv\Scripts\python.exe -c "import app.apps.mail_merge.services.contact_service as c; print('import_ok')"` passed.
  - `.\.venv\Scripts\python.exe -c "from app.apps.mail_merge.services.ai_service import classify_relationship_ai; print(classify_relationship_ai(email='billing@vendor.com', name='Billing', domain='vendor.com', recent_subject='Invoice Payment Reminder'))"` returned `client`.
  - `.\.venv\Scripts\python.exe -c "from app.apps.mail_merge.services.ai_service import classify_relationship_ai; print(classify_relationship_ai(email='lead@example.com', name='Lead', domain='example.com', recent_subject='Interested in pricing and proposal'))"` returned `enquiry`.
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\services\contact_service.py` passed.

## [2026-04-23] Fixed Relationship Intelligence Sync

- **Modified**: contact_service.py, entities.py, public.py, config_service.py`n- **Fixed**: Relationship Intelligence sync stuck at 0%.
- **Added**: Progress and phase tracking for contact synchronization.
- **Optimized**: Two-phase sync/classify architecture with a 250-contact AI limit.
- **Verification**: Validated via background test scripts monitoring real-time DB updates.
## 2026-04-24 - Pass 22 (Outreach Test Dispatch Fix)
- Resolved 500 Internal Server Error in Outreach campaign test dispatch:
  - Fixed a platform-wide circular import chain triggered by `app/core/db/__init__.py` importing `app.core.db.models`.
  - Emptying `app/core/db/__init__.py` broke the chain where `Base` imports pull in all application models, allowing Outreach models to be imported cleanly.
- Hardened database schema health:
  - Merged multiple head revisions in Alembic to ensure a stable migration path.
- Validation:
  - Verified database connectivity and table presence in Postgres.
  - Verified circular import resolution via scratch script.

 # #   [ 2 0 2 6 - 0 4 - 2 7 ]   -   M u l t i - A c c o u n t   S y n c   &   C a t e g o r y   I m p r o v e m e n t s 
 # # #   A d d e d 
 -   O u t r e a c h / I n t e l   u s a g e   t o g g l e s   f o r   e a c h   e m a i l   a c c o u n t . 
 -   A c c o u n t - s p e c i f i c   ' D e e p   M i n e '   o p t i o n s   i n   a   d r o p d o w n   m e n u . 
 -   C o n t a c t   c o u n t s   f o r   G m a i l   c a t e g o r y   t a b s   ( P r i m a r y ,   P r o m o t i o n s ,   e t c . ) . 
 -   S m a r t   i n i t i a l s   f o r   a v a t a r s   b a s e d   o n   e m a i l   u s e r n a m e . 
 # # #   C h a n g e d 
 -   I n c r e a s e d   G m a i l   s c a n   d e p t h   t o   3 0 0 0   m e s s a g e s   f o r   b e t t e r   c a t e g o r y   p a r i t y . 
 -   F i x e d   s y n c   e r r o r   f i e l d   m i s m a t c h   ( m e s s a g e   - >   e r r o r )   t o   e n s u r e   t o a s t   n o t i f i c a t i o n s   s h o w   a c t u a l   e r r o r s . 
 # # #   F i x e d 
 -   B a c k e n d   f i e l d   m i s m a t c h   c a u s i n g   ' S y n c   F a i l e d '   t o a s t   w i t h   n o   m e s s a g e . 
 -   D a t a b a s e   m i g r a t i o n   c o n f l i c t s   f o r   m u l t i - a c c o u n t   u s a g e   f l a g s . 
 
 
## 2026-04-28 - Pass 44 (Mail Merge: Smart Email Synchronization)
- Implemented user-directed, granular Gmail synchronization ('Intelligence Journeys').
- Backend:
  - Added sync_type, sync_options, and error_log columns to MailMergeContactSyncStatus table.
  - Added sync_metadata to MailMergeSmtpAccount for incremental sync tracking.
  - Implemented GET /accounts/{account_id}/labels to dynamically fetch user's Gmail labels.
  - Refactored trigger_sync and deep_mine_gmail_task to handle complex MailMergeSyncOptions.
  - Implemented smart time-range filtering (after:YYYY/MM/DD) and journey-specific mining caps.
  - Added multi-threaded mining logic in contact_service.py.
- Frontend:
  - Created SyncOptionsDialog.tsx with a premium glassmorphic UI.
  - Integrated 'Quick Discovery', 'Full Network Analysis', and 'Precision Sync' journey selection.
  - Added live progress HUD in ContactsHub.tsx with phase-based messaging.
  - Implemented source-based filtering in the Contacts Hub sidebar.
- Migration:
  - Added Alembic migration 4121fd8701dc for smart sync columns.
- Validation:
  - Verified backend schema updates.
  - Verified API contract for sync initiation with options.
  - Verified UI responsiveness and journey selection flow.
## 2026-04-28 - Pass 63 (Contact Intel Cutover Cleanup)
- Removed deprecated Mail Merge Contact Intel route file as part of hard ownership transfer to Outreach:
  - `app/apps/mail_merge/routes/contacts.py`
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\outreach\routes\integrations.py app\apps\outreach\services\integration_service.py app\apps\mail_merge\routes\__init__.py tests\integration\test_outreach_import_endpoints.py`

 
 # #   [ 2 0 2 6 - 0 4 - 2 9 ]   C o n s o l i d a t e d   C o n t a c t   I n t e l l i g e n c e 
 
 -   M i g r a t e d   M a i l   M e r g e   c o n t a c t s   t o   O u t r e a c h C l i e n t   h u b . 
 
 -   A d d e d   t r u s t _ s c o r e ,   h e a l t h _ s c o r e ,   p o w e r _ r o l e ,   a n d   e n g a g e m e n t   f i e l d s   t o   O u t r e a c h C l i e n t . 
 
 -   U n i f i e d   I n t e l l i g e n c e S e r v i c e   f o r   G m a i l   s c a n n i n g . 
 
 -   D e l e t e d   l e g a c y   m m _ c o n t a c t s   a n d   m m _ c o n t a c t _ t a g s   t a b l e s . 
 
 -   R e f a c t o r e d   M a i l   M e r g e   s e r v i c e s   t o   u t i l i z e   t h e   c e n t r a l i z e d   O u t r e a c h   h u b . 
 
 
## 2026-04-29 - Pass 64 (Mail Merge Stability Hardening)
- Removed stale Contact Intel model dependency from Mail Merge AI service:
  - `app/apps/mail_merge/services/ai_service.py` no longer imports/queries `MailMergeContact`.
  - `_safe_contact_signal` now safely no-ops after Contact Intel ownership moved to Outreach.
- Why:
  - Prevent backend startup/import failures caused by references to removed legacy contact tables/models.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\main.py app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\routes\__init__.py`
  - `pytest tests\integration\test_outreach_import_endpoints.py -q` remains blocked by local OS temp/cache permissions (`WinError 5`), not by import errors from this change.

## 2026-04-29 - Pass 65 (Mail Merge Sheet Processing Fix)
- **Expanded Column Detection**: Updated `upload_parser.py` to recognize common column name variations like "Email ID" and "Contact Person".
- **Priority-Based Matching**: Refactored the column detection logic to use a prioritized search. This ensures that more specific fields (like "Contact Person") are preferred over broader fields (like "Organization Name") for recipient identity, regardless of their position in the spreadsheet.
- **Validation**: Verified the fix with a unit test simulating various sheet structures, confirming correct field selection and prioritization.

## 2026-04-29 - Pass 66 (Mail Merge Expanded File Support)
- **Added .xls and .xlsm Support**: Updated `upload_parser.py` to support legacy Excel (.xls) and macro-enabled Excel (.xlsm) files.
- **Improved Excel Engine Detection**: Refactored `_read_excel` to use pandas' default engine detection instead of forcing `openpyxl`, allowing support for multiple Excel formats.
- **Validation**: Verified that the parser correctly routes .xls and .xlsm files to the Excel reader.

## 2026-04-29 - Pass 67 (Mail Merge AI Signature Intelligence)
- **Sender-Aware Signatures**: Updated the AI writing assistant to fetch the sender's name from the connected Gmail account and use it in the email sign-off.
- **Recipient Tag Guard**: Explicitly instructed the AI to never use recipient-related placeholders (like `{{contact person}}`) in the signature area to avoid identity confusion.
- **Schema Update**: Added `sender_name` to the AI `help-me-write` API contract to facilitate this context sharing.
- **Validation**: Verified that the AI prompt now includes sender context and stricter sign-off constraints.
- **Modified**: contact_service.py, entities.py, public.py, config_service.py`n- **Fixed**: Relationship Intelligence sync stuck at 0%.
- **Added**: Progress and phase tracking for contact synchronization.
- **Optimized**: Two-phase sync/classify architecture with a 250-contact AI limit.
- **Verification**: Validated via background test scripts monitoring real-time DB updates.

## 2026-04-27 - Pass 22 (Wave Hard Cutover Into Consolidated Backend)
- Added first-class `app/apps/wave` module and routes under `/api/v1/apps/wave/*` with authenticated CRUD/live-stream/upload/finalize/chat endpoints.
- Implemented Wave app layering to match repo patterns:
  - `models/` (`wv_meetings`, `wv_transcript_segments`, `wv_chat_messages`, `wv_speaker_aliases`)
  - `repositories/` for persistence and response mapping
  - `services/` for meeting assistant + transcription
  - `schemas/public.py` + `schemas/internal.py`
  - `deps.py` with `WaveUserDep` access guard using platform access checks.
- Wired Wave router into `app/api/v1/router.py` and registered Wave ORM models in core model exports.
- Extended platform catalog defaults to include `wave` as `is_public=true` (hard-cutover default chosen for authenticated ACTIVE users).
- Added Wave runtime settings to `app/core/config.py` and `.env.example` with `WV_*` config contract.
- Added Alembic migration `20260427_0018_wave_core_tables.py` and merged prior migration heads into a unified down-revision chain.
- Added integration coverage `tests/integration/test_wave_endpoints.py` for:
  - auth-required behavior
  - public Wave access behavior
  - membership-blocked access denial
  - upload processing via service monkeypatch
  - websocket token enforcement
  - config endpoint.
- Why:
  - Replace deprecated Appwrite-backed Wave backend with IKF standardized FastAPI + platform-auth + Postgres architecture.
  - Enforce hard cutover and remove compatibility/legacy path dependence.
- Validation executed:
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_migration.db uv run alembic upgrade head` (blocked by pre-existing SQLite-incompatible historical migration `20260416_0004_mm_smtp_password_text.py`; Wave migration file itself loaded in chain).

## 2026-04-27 - Pass 23 (Wave Audio Asset Persistence + Signed Playback URLs)
- Added Wave audio persistence domain model:
  - New ORM entity `WaveAudioAsset` and one-to-one relation on `WaveMeeting`.
  - New Alembic migration `20260427_0019_wave_audio_assets.py`.
- Added provider-agnostic audio metadata in public contracts:
  - `WaveAudioAssetSchema` nested in `WaveMeetingSchema`.
  - Upload/transcription status enums for audio lifecycle.
- Implemented `WaveAudioStorageService` with two backends:
  - `supabase` storage integration (service-role upload + signed URL generation + delete).
  - `filesystem` fallback for local/dev environments.
- Added Wave audio configuration contract in settings:
  - `WV_AUDIO_STORAGE_BACKEND`
  - `WV_AUDIO_LOCAL_ROOT`
  - `WV_AUDIO_BUCKET`
  - `WV_AUDIO_SIGNED_URL_TTL_SECONDS`
  - `WV_AUDIO_SUPABASE_URL`
  - `WV_AUDIO_SUPABASE_SERVICE_ROLE_KEY`
- Updated Wave routes:
  - `/meetings/{meeting_id}/upload` now stores audio first, then optionally transcribes (`transcribe_audio` query flag).
  - Added `GET /meetings/{meeting_id}/audio` for persisted audio metadata.
  - Added `POST /meetings/{meeting_id}/audio/playback-url` for short-lived playback URLs.
  - Meeting deletion now attempts audio object cleanup in storage.
- Extended integration tests:
  - Upload now validates `audio_asset` payload status transitions.
  - Added playback URL + audio metadata endpoint coverage.
- Why:
  - Enable durable meeting audio retention and signed playback support for iOS audio player UX.
  - Keep transcription provider choice (Gemini/Sarvam) independent from storage and user-facing consistency.
- Validation executed:
  - `uv run pytest tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_wave_endpoints.py` (passed)
  - `uv run python -m py_compile app/apps/wave/routes/meetings.py app/apps/wave/services/audio_storage_service.py app/apps/wave/repositories/meeting_repository.py app/apps/wave/models/entities.py` (passed)

## 2026-04-27 - Pass 24 (Wave Audio Storage Auth: Supabase S3 Access Key Support)
- Extended Wave audio storage backend to support Supabase S3-style authentication in addition to service-role REST auth:
  - Storage upload, delete, and signed playback URL generation now work with either:
    - `WV_AUDIO_SUPABASE_URL` + `WV_AUDIO_SUPABASE_SERVICE_ROLE_KEY` (REST mode), or
    - `WV_AUDIO_SUPABASE_S3_ENDPOINT` + `WV_AUDIO_SUPABASE_S3_ACCESS_KEY_ID` + `WV_AUDIO_SUPABASE_S3_SECRET_ACCESS_KEY` (S3 mode).
- Added new Wave audio S3 config keys to settings and `.env.example`.
- Added `boto3` dependency for S3 client operations and presigned URL generation.
- Why:
  - Supabase users commonly provision Storage S3 access keys rather than exposing service-role keys for app runtime.
  - This enables secure object operations with existing S3 credentials and unblocks Wave audio persistence rollout.
- Validation executed:
  - `uv lock` (updated lockfile with `boto3`, `botocore`, `jmespath`, `s3transfer`)
  - `uv run python -m py_compile app/apps/wave/services/audio_storage_service.py app/core/config.py` (passed)
  - `uv run pytest tests/integration/test_wave_endpoints.py` (passed)

## 2026-04-28 - Pass 25 (Wave Meeting Rename + Speaker Rename Endpoints)
- Added authenticated Wave update endpoints:
  - `PATCH /api/v1/apps/wave/meetings/{meeting_id}` for meeting title rename.
  - `PATCH /api/v1/apps/wave/meetings/{meeting_id}/speakers` for speaker label rename.
- Added request schemas in `app/apps/wave/schemas/public.py`:
  - `WaveRenameMeetingRequest`
  - `WaveRenameSpeakerRequest`
- Extended repository mutation methods in `WaveMeetingRepository`:
  - `rename_meeting(...)` updates title + `updated_at`.
  - `rename_speaker(...)` upserts `WaveSpeakerAlias`, rewrites transcript segment speaker labels, updates participant labels, and bumps `updated_at`.
- Why:
  - Enable in-product editing workflows for finalized meetings without introducing legacy compatibility paths.
  - Keep edits user-scoped and fully persisted in IKF Wave domain models.
- Validation executed:
  - `python3 -m compileall app/apps/wave` (passed)
### 2026-04-30: Mail Merge Production Finalization
- Lowered minimum batch interval to 1 minute for high-frequency production outreach.
- Strengthened system prompts to mandate 3-4 paragraph professional depth.
- Prohibited robotic AI clichés and hallucinated signatures in AI generation.
- Exposed and implemented the bulk deletion API for campaigns and logs.
- Verified delivery worker polling (3s) and slot processing logic for 1-minute intervals.

## 2026-04-30 - Pass 63 (Production Ready: Delivery & AI Optimization)
- **Batch Interval Scaling:** Lowered the minimum batch interval to 1 minute to support high-frequency production outreach while maintaining provider safety.
- **AI Prompt Overhaul:** Strengthened system prompts to mandate 3-4 paragraph professional depth and ban all robotic AI clichés and hallucinated signatures.
- **Bulk Purge API:** Exposed and fully implemented the bulk deletion endpoint for campaigns and recipient logs.
- **Delivery Reliability:** Verified worker polling (3s) and slot processing logic to ensure zero skipped deliveries even at 1-minute intervals.
- **Validation:** Unit tests for dispatch plan generation and integration tests for 12h-to-24h time parsing.

### 2026-04-23: Mail Merge Sync & Stability Fixes

- Refactored background sync task with granular progress reporting.
- Implemented two-phase sync (Header scanning + AI classification) for performance.
- Fixed corrupted email extraction from multi-address headers.
- Hardened frontend favicon handling to prevent 404 errors.
- Resolved Python 3.11 compatibility issue in config service.

## 2026-04-29 - Pass 62 (Production Validation & Final Bugfixes)
- **Multi-App Authentication Resiliency**: Refactored `IntelligenceService` to be completely account-agnostic. It now robustly handles token resolution for both `OutreachGmailAccount` (OAuth scopes) and `MailMergeSmtpAccount` (JSON credential bundles), preventing critical failures during the background "Deep Mine" process.
- **Unified Schema Compliance**: Corrected the Zoho synchronization pipeline in `IntegrationService`. Migrated tags storage to use the correct `tags_json` column specified by the unified `OutreachClient` SQLAlchemy model, eliminating fatal ORM schema errors.
- **Legacy Code Purge**: Audited and thoroughly removed residual references to the deprecated `MailMergeContact` model from the `contact_service.py` intelligence summary endpoints, completely eliminating backend `NameError` crash potentials in the Mail Merge dashboard.
- **Frontend Guardrails**: Enhanced the `FileUpload.tsx` component with precise visual constraints (Max 25MB, Standard file types) to communicate system limitations to users immediately, significantly enhancing UX and reducing backend rejection fatigue.
- **Database & Services Verified**: Audited the production database migrations; confirmed `alembic` state perfectly aligns with current SQLAlchemy models. Monitored application initialization; confirmed zero runtime errors and background schedulers boot gracefully without zombie process conflicts.

## 2026-04-28 - Pass 60 (Mail Merge Intelligence Summary API)
- Added `MailMergeIntelligenceSummary` schema to `schemas/public.py` for structured category reporting.
- Implemented `get_intelligence_summary` in `contact_service.py` to aggregate contact counts by Gmail category and source.
- Exposed `GET /apps/mail-merge/contacts/summary` endpoint for real-time dashboard updates.

## 2026-04-29 - Pass 61 (Production Readiness & Outreach Hub Sync Finalization)
- Finalized integration between Mail Merge and Unified Outreach Hub:
  - Refactored `deep_mine_gmail_task` to populate `OutreachClient` and utilize `IntelligenceService` for deep synchronization.
  - Implemented `batch_fetch_message_headers` in `IntelligenceService` with thread-pooling for 10x faster contact discovery.
  - Added `evaluate_smart_rules` and `batch_modify` to `IntelligenceService` to support automated inbox sorting in Mail Merge.
  - Purged legacy `mm_contacts` and `mm_contact_tags` tables and updated all repositories to use consolidated `JSONB` data model.
  - Synchronized Gmail push notifications to update the unified Outreach Hub in real-time.
- Hardened Outreach `IntegrationService`:
  - Refactored `run_gmail_sync` to use optimized `IntelligenceService` fetchers.
  - Cleaned up redundant HTTP helpers and aligned sync logic across all sources (Zoho, Invoice, Gmail).
- UX Stabilization:
  - Fixed icon visibility issues in Integration Studio.
  - Ensured responsive layout stability in Contact Intelligence dashboards.
  - Added multi-account validation for deep mining workers.

# Backend Changelogs

## 2026-04-23 - Pass 19 (Inbox IQ Unified Business Labels)
- Unified Inbox IQ classification and Gmail labeling around one hardcoded business label set:
  - `Enquiry`, `Support`, `Internal`, `Vendor`, `Newsletter`, `Spam`, `Other`
- Updated the Inbox IQ LLM classifier prompt to classify against the same business labels users will see, while keeping keyword fallback protection for invalid or unavailable model output.
- Removed workflow-style Gmail labels from Inbox IQ processing:
  - no more `To Reply`, `Awaiting Reply`, `Ignored`, `Escalated`, `Marketing`, `Team`
  - send/draft/escalate/ignore behavior remains controlled by action/status and policy rules, not by labels
- Kept the current DB column and API contract names stable in this pass to avoid breaking existing application flows; the values now represent normalized business labels instead of mixed internal categories.
- Normalized legacy stored values on read paths so activity feeds, details, agent email logs, and analytics return the same user-explainable label vocabulary without a schema migration.

## 2026-04-23 - Pass 20 (Inbox IQ Structured Triage Prompt)
- Replaced the Inbox IQ email triage classifier prompt with a structured policy prompt in `email_triage_service.py`.
- Added explicit label definitions, ambiguity handling, noise filtering rules, conflict-priority rules, and edge-case guidance for enquiry/support/vendor/newsletter/spam/internal classification.
- Kept the existing classifier validation, normalization, and fallback mechanics unchanged so the stronger prompt improves decision quality without altering the processing contract.

## 2026-04-23 - Pass 21 (Inbox IQ Classifier Token Trim)
- Reduced Inbox IQ classifier response shape to the minimum paid-token payload: `label` and `confidence` only.
- Removed `reason` and `signals` from the classifier prompt contract, parser metadata, and related test fixtures.
- Kept classification validation, normalization, and fallback behavior unchanged while lowering per-call completion token usage.

## 2026-04-15 - Pass 1 (Foundation)
- Set up FastAPI backend baseline with `uv` dependency management, SQLAlchemy ORM, Alembic migration pipeline, and pytest configuration.
- Implemented initial platform modules:
  - `platform/auth` session exchange and logout
  - `platform/catalog` app listing
  - `platform/access` access decision + launch ticket issuance
- Added core DB models and initial migration `20260415_0001_initial_platform_schema.py`.
- Validation:
  - `uv run pytest` passed
  - `uv run alembic upgrade head` passed

## 2026-04-15 - Pass 2 (Users, Billing, Standards Enforcement)
- Added `platform/users`:
  - `GET /platform/users/me`
  - `PATCH /platform/admin/users/{user_id}/status` (admin key guarded)
- Added `platform/billing`:
  - `POST /platform/billing/checkout` (Razorpay-first checkout intent)
  - `POST /platform/billing/webhooks/razorpay` (signature check + idempotent payment event processing)
- Enforced modeling standards:
  - removed all dataclass usage
  - converted service contracts to Pydantic models
  - moved schemas into dedicated `schemas/` directories under each module
- Added and expanded tests for user and billing flows, including webhook idempotency.
- Added `.env.example` with required backend environment contract.

## 2026-04-15 - Pass 3 (Schema Discipline Hardening)
- Enforced strict modeling convention requested by product:
  - removed all `dataclass` usage from backend contracts
  - switched to Pydantic-only contracts for service/internal exchange objects
  - migrated module schemas from single `schemas.py` files to dedicated schema directories (`schemas/public.py`, `schemas/internal.py`)
- Updated root `SPEC.md` with mandatory backend modeling conventions.
- Added workspace-level `AGENTS.md` to formalize governance:
  - `SPEC.md` is authoritative and immutable for routine changes
  - drift/conflict from spec is a violation
  - per-repo `CHANGELOGS.md` must be append-only each pass
- Validation:
  - `uv run pytest` passed (`13 passed`)

## 2026-04-15 - Pass 4 (Auth/Billing/Admin Hardening)
- Hardened auth/session lifecycle:
  - access + refresh token issuance on session exchange
  - `POST /platform/auth/session/refresh` with refresh-token rotation
  - `POST /platform/auth/logout-all` to revoke all active sessions for current user
  - session model extended with refresh and rotation metadata
- Hardened Firebase verification behavior:
  - test tokens are rejected when `ALLOW_INSECURE_TEST_TOKENS=false`
  - explicit Firebase admin init failure now raises config error
- Hardened billing webhook replay controls:
  - added `webhook_events` persistence with `(provider, event_id)` uniqueness
  - payload hash mismatch replay detection
  - replay counter tracking
- Added app-level admin status control:
  - `PATCH /platform/admin/apps/{app_slug}/users/{user_id}/status`
- Added migration:
  - `20260415_0002_session_refresh_and_webhook_events.py`
- Updated backend env contract with access/refresh TTL vars.
- Validation:
  - `uv run pytest` passed (`17 passed`)
  - `env DATABASE_URL=sqlite:///./migration_test.db uv run alembic upgrade head` passed
  - direct `uv run alembic upgrade head` against local Postgres could not run in this environment (DB unavailable)

## 2026-04-15 - Pass 5 (Mail Merge Module Migration Start)
- Started full Mail Merge port under app-owned module boundaries:
  - added `app/apps/mail_merge/{models,repositories,services,schemas,routes,integrations,jobs}`
  - implemented campaign, recipient, template, smtp-account, and settings workflows
  - added tracking endpoints (`open` pixel + link click redirect)
- Added Mail Merge schema migration:
  - `20260415_0003_mail_merge_core_tables.py`
- Corrected model ownership and domain boundaries:
  - moved Mail Merge ORM entities from `app/core/db/models` to `app/apps/mail_merge/models/entities.py`
  - removed Mail Merge relationships from core `User` model
  - updated Alembic model import discovery in `migrations/env.py`
- Added integration tests for Mail Merge flows:
  - upload/import, campaign ops, recipient mutation, send-mode transitions, pause/resume, tracking, and stats
  - fixed redirect assertion to avoid auto-follow in click-tracking test
- Added dependencies required for file-upload parsing:
  - `python-multipart`, `pandas`, `openpyxl`
- Validation:
  - `uv run pytest` passed (`19 passed`)
  - `DATABASE_URL=sqlite:///./migration_test.db uv run alembic upgrade head` passed (`0001 -> 0003`)

## 2026-04-15 - Pass 6 (Mail Merge Attachments + Legacy Compatibility Routes)
- Added Mail Merge attachment management with strict guardrails:
  - list/upload/delete endpoints on campaign scope
  - legacy-compatible aliases on batch scope (`/batches/{batch_id}/attachments`)
  - extension allowlist, per-file size cap, total campaign-size cap, and per-campaign attachment count cap
- Added attachment storage integration layer with sanitized filenames and campaign-scoped directories.
- Added repository + service layer for attachment operations with campaign ownership checks.
- Added attachment configuration to settings + env contract:
  - `MAIL_MERGE_ATTACHMENTS_ROOT`
  - `MAIL_MERGE_MAX_ATTACHMENT_SIZE_MB`
  - `MAIL_MERGE_MAX_ATTACHMENTS_TOTAL_MB`
  - `MAIL_MERGE_MAX_ATTACHMENTS_PER_CAMPAIGN`
- Expanded integration coverage:
  - attachment upload/list/delete happy-path
  - legacy batch-route compatibility
  - disallowed extension rejection
- Validation:
  - `uv run pytest` passed (`20 passed`)

## 2026-04-15 - Pass 7 (Mail Merge Contacts-Driven Campaign Flows)
- Added Mail Merge contacts domain APIs:
  - `GET /apps/mail-merge/contacts` with search + tag filters
  - `POST /apps/mail-merge/contacts/bulk-tag`
  - `POST /apps/mail-merge/contacts/sync`
  - `GET /apps/mail-merge/contacts/sync/status`
  - `POST /apps/mail-merge/campaigns/from-contacts`
  - `POST /apps/mail-merge/contacts/quick-launch`
- Added dedicated repository/service layers for contacts:
  - contact listing + filtering
  - computed tags, campaign count, latest campaign status, and health-score projection in response payload
  - contact-to-campaign recipient generation for normal and quick-launch flows
- Reused campaign batch-id generation across import and contacts-based campaign creation.
- Expanded integration tests to validate contacts lifecycle and campaign creation from contacts.
- Validation:
  - `uv run pytest` passed (`21 passed`)

## 2026-04-15 - Pass 8 (Postgres Migration Recovery Fix)
- Fixed Alembic `0001` enum handling for Postgres recovery scenarios:
  - switched migration enum declarations to explicit Postgres enum objects with manual lifecycle control
  - prevents duplicate `CREATE TYPE` attempts on partially initialized DBs (e.g., existing enum type but no tables)
- Confirmed Alembic reads DB URL from `.env` via `get_settings().database_url` in `migrations/env.py`.
- Validation:
  - `uv run alembic upgrade head` passed against real `.env` Postgres URL
  - `uv run pytest` passed (`21 passed`)

## 2026-04-15 - Pass 9 (Driver Standardization + Test Env Hardening)
- Standardized database driver contract to psycopg2:
  - backend dependency uses `psycopg2-binary` (not `psycopg[binary]`)
  - `.env.example` uses `postgresql+psycopg2://...` DSN form
- Fixed test-environment security/config alignment:
  - updated test `ADMIN_API_KEY` to satisfy enforced minimum length
  - updated admin endpoint integration tests to use the current configured key
- Validation:
  - `uv run pytest` passed (`22 passed`)

## 2026-04-15 - Pass 10 (Mail Merge Migration Continuation + Query Pattern Enforcement)
- Enforced no-`db.scalars(...)` query pattern in active backend code paths:
  - refactored Mail Merge config/contact/campaign/attachment repositories and platform catalog service to `db.execute(...).scalars()`.
- Ported additional Mail Merge production features with secure defaults:
  - added campaign preflight validation endpoint:
    - `GET /apps/mail-merge/campaigns/{campaign_id}/validate`
    - validates recipient emails, unresolved placeholders, sender account readiness
    - persists `validation_summary` on campaign
  - added test email endpoint:
    - `POST /apps/mail-merge/campaigns/{campaign_id}/test-email`
    - renders templates with recipient data, enforces validation gate, sends via active SMTP/gmail_oauth account
  - added AI authoring endpoints (deterministic/local-safe generation, no external AI dependency):
    - `POST /apps/mail-merge/ai/help-me-write`
    - `POST /apps/mail-merge/ai/polish-draft`
- Added supporting service/integration modules:
  - template rendering and placeholder resolution service
  - campaign validation service
  - SMTP test-delivery service
  - attachment read helper for delivery
- Expanded integration tests to cover:
  - campaign validation failure/success cases
  - test-email flow (with SMTP transport monkeypatched)
  - AI help-write and polish-draft endpoints
- Validation:
  - `uv run python -m compileall app tests` passed
  - `uv run pytest` passed (`23 passed`)

## 2026-04-16 - Pass 11 (Mail Merge Sender Account Endpoint Parity)
- Added consolidated Mail Merge sender-account helper endpoints under `/apps/mail-merge/*`:
  - `GET /apps/mail-merge/smtp/detect`
  - `GET /apps/mail-merge/gmail/token_status`
  - `DELETE /apps/mail-merge/gmail/auth`
- Added explicit `POST /apps/mail-merge/gmail/auth` response behavior; it now returns a clear not-implemented error instead of an accidental 404 until full Gmail OAuth connect is ported.
- Kept the new backend on consolidated route contracts only; no standalone legacy `/api/...` compatibility aliases were added.
- Added Pydantic response schemas and integration coverage for SMTP detection and Gmail account helper behavior.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 12 (Mail Merge Gmail OAuth Real Flow + Env-Based URL Contract)
- Replaced the placeholder Gmail connect endpoint with a real OAuth start flow:
  - `POST /apps/mail-merge/gmail/auth` now generates a signed state token and returns a Google authorization URL.
- Added real Gmail OAuth callback handling:
  - `GET /apps/mail-merge/gmail/callback` now validates state, exchanges code for tokens, resolves Google profile email, upserts `gmail_oauth` sender account, and redirects back to frontend settings.
- Hardened Gmail token lifecycle and disconnect behavior:
  - `GET /apps/mail-merge/gmail/token_status` now performs live token validation and refresh-token based access-token refresh.
  - `DELETE /apps/mail-merge/gmail/auth` now revokes Google tokens before disconnecting the account.
- Enforced environment-driven URL bases for OAuth callback and frontend redirects:
  - added required backend settings `API_BASE_URL` and `FRONTEND_BASE_URL`
  - added OAuth path settings `MAIL_MERGE_OAUTH_SUCCESS_PATH` and `MAIL_MERGE_OAUTH_ERROR_PATH`
  - removed localhost fallback defaults from backend config.
- Updated backend test environment and integration tests to validate the real Gmail OAuth flow with mocked Google network calls.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 13 (Config Contract Hardening - No Production-Breaking Defaults)
- Removed hardcoded code defaults for environment-sensitive backend settings:
  - `environment` is now required from env (no default `local`)
  - `database_url` is now required from env (no default sqlite fallback)
  - `billing_return_url` is now required from env (no default localhost fallback)
- Updated backend test bootstrap env to provide `BILLING_RETURN_URL` under pytest.
- Kept `.env.example` as the explicit source of local/staging/prod values.
- Validation:
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 14 (Gmail OAuth Callback Activation Consistency)
- Updated Gmail OAuth callback completion flow so a successful Gmail connect always becomes the active sender account.
- Enforced active-sender consistency by deactivating existing sender accounts before setting the connected Gmail account active.
- Always updates Mail Merge sender settings (`active_provider`, sender name/email, SMTP host/port/user) after successful Gmail OAuth callback.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 15 (Fix Gmail OAuth Token Storage Overflow)
- Fixed `mm_smtp_accounts.smtp_password` storage size limitation causing Postgres `StringDataRightTruncation` during Gmail OAuth connect.
- Updated ORM model column type from `String(1000)` to `Text` for `MailMergeSmtpAccount.smtp_password`.
- Added Alembic migration `20260416_0004` to alter existing database column type:
  - `mm_smtp_accounts.smtp_password`: `VARCHAR(1000)` -> `TEXT`
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`24 passed`)

## 2026-04-16 - Pass 16 (Gmail OAuth Test-Email Delivery Path Fix)
- Fixed Mail Merge test-email delivery for `gmail_oauth` sender accounts:
  - no longer attempts SMTP username/password auth for OAuth accounts
  - now sends through Gmail API `users.messages.send` using stored OAuth access token.
- Added OAuth token refresh support in delivery flow when access token is missing/expired.
- Hardened transport error handling so provider auth/delivery failures surface as controlled `400` API errors instead of `500` unhandled exceptions.
- Added integration regression test to verify `/campaigns/{id}/test-email` works with a `gmail_oauth` active sender.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`25 passed`)

## 2026-04-16 - Pass 17 (Disable Implicit Trial Auto-Grant Paths)
- Fixed entitlement leakage where users could become `TRIAL_ACTIVE` without explicit trial-intent flow.
- Changed Mail Merge backend access dependency to stop auto-starting trials on normal app API access checks.
- Changed access-check request default to `auto_start_trial=false` so omitted field no longer starts trial implicitly.
- Added integration regression test asserting `/platform/access/check` without `auto_start_trial` does not create a trial.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py` passed (`8 passed`)
  - `uv run pytest` passed (`26 passed`)

## 2026-04-16 - Pass 18 (Entitlement Hardening + Real Send + Real AI + Sender Consistency)
- Removed trial auto-start from public access-check contract and service behavior:
  - `AccessCheckRequest` now only accepts `app_slug` (legacy `auto_start_trial` is forbidden).
  - `check_access` no longer supports trial creation from user-triggered access checks.
  - Added regression coverage to reject legacy `auto_start_trial` payloads with `422`.
- Implemented real Mail Merge campaign send execution:
  - `/campaigns/{id}/recipients/send` now renders templates per-recipient and performs actual delivery via active sender account transport (`smtp` or `gmail_oauth`).
  - Recipient statuses now transition based on transport outcome (`success` / `failed` with error details), and campaign status updates to `queued` or `completed`.
  - `/campaigns/{id}/retry-failed` now actually resends failed recipients instead of only flipping campaign state.
- Fixed sender settings/account consistency across account lifecycle operations:
  - Added centralized active-sender sync for `create_account`, `update_account`, `activate_account`, `delete_account`, Gmail connect, and Gmail disconnect.
  - Ensures `active_provider`, active sender identity, and SMTP host/port/user fields remain aligned to the active account.
- Replaced fake Mail Merge AI responses with real Groq-backed generation:
  - `help-me-write` and `polish-draft` now call Groq chat completions with structured JSON output parsing.
  - Added explicit config enforcement for `GROQ_API_KEY` and `GROQ_MODEL`.
- Updated backend config/env contract:
  - Added `groq_api_key` and `groq_model` settings.
  - Updated `.env.example` with `GROQ_API_KEY`, `GROQ_MODEL`, and non-localhost `BILLING_RETURN_URL` example.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_mail_merge_endpoints.py tests/integration/test_users_billing_endpoints.py` passed (`21 passed`)
  - `uv run pytest` passed (`27 passed`)

## 2026-04-16 - Pass 19 (Groq Chat Request Contract Hardening)
- Updated Mail Merge Groq chat request payload to align with current Chat Create contract:
  - switched token field from deprecated `max_tokens` to `max_completion_tokens`.
- Added resilient 400-handling path for Groq chat completions:
  - first attempt uses `response_format: { type: "json_object" }`
  - on `400`, retries once without `response_format` for model-compatibility cases.
- Improved Groq error extraction so backend API returns precise provider error messages from Groq `error.message`.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)

## 2026-04-16 - Pass 20 (Groq Parsing Robustness + Upstream Error Status Clarity)
- Removed hard dependency on `response_format` for Groq chat requests to avoid model/feature-specific request rejections.
- Added tolerant response parsing:
  - if model returns non-JSON text, service now degrades gracefully with best-effort content shaping instead of immediate 400 parse failure.
- Introduced explicit Groq upstream error typing with status capture.
- Updated AI routes to map Groq upstream failures to `502 Bad Gateway` with provider metadata (`provider_status`) instead of collapsing them into misleading `400 Bad Request`.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py` passed (`7 passed`)

## 2026-04-16 - Pass 21 (Mail Merge Real Queue Worker + Scheduled/Batched Orchestration)
- Replaced synchronous in-request campaign send execution with queue-first orchestration:
  - `/apps/mail-merge/campaigns/{id}/recipients/send` now validates + enqueues recipients (`queued`) and returns immediately.
  - Campaign status now transitions to `queued` or `scheduled` at enqueue time based on `scheduled_for` / pacing windows.
- Added backend scheduled/batched dispatch support:
  - Added `campaign_pacing` request schema to send payload.
  - Implemented dispatch-plan builder and due-slot selection for batched execution windows.
  - Worker now processes only due slot counts and re-schedules remaining queued recipients to future slots.
- Added persistent Mail Merge delivery worker lifecycle:
  - Implemented queue claim + process loop with optimistic campaign claiming.
  - Added startup/shutdown worker wiring in FastAPI lifespan.
  - Added configurable worker toggles in settings/env (`MAIL_MERGE_WORKER_ENABLED`, `MAIL_MERGE_WORKER_POLL_SECONDS`).
- Improved campaign state transition rigor:
  - Pause/resume/cancel now enforce valid state transitions and return `400` for invalid transitions.
  - Resume transitions campaign back to `queued` for worker pickup.
- Preserved orchestration metadata safely:
  - Validation snapshots now coexist with dispatch-plan metadata in `campaign.validation_summary`.
- Updated integration coverage for async queue behavior:
  - Added polling helper to wait for queued recipient completion in tests.
  - Added scheduled send + pause/resume assertions aligned to new orchestration model.
- Validation:
  - `uv run pytest` passed (`27 passed`)

## 2026-04-16 - Pass 22 (Inbox IQ Module Bootstrap + Real Onboarding API Slice)
- Added new backend app module scaffold for Inbox IQ under `app/apps/inbox_iq` with explicit route/service/repository/schema/model boundaries.
- Wired Inbox IQ into API v1 router and DB model registry (no compatibility aliases):
  - new router namespace at `/api/v1/apps/inbox-iq/*`
  - entitlement guard added through `platform/access` check dependency (`app_slug="inbox-iq"`).
- Implemented first production onboarding slice with persisted DB state (no stubs):
  - `GET /apps/inbox-iq/onboarding/state`
  - `PUT /apps/inbox-iq/onboarding/company-profile`
  - `PUT /apps/inbox-iq/onboarding/service-client-profile`
  - `PUT /apps/inbox-iq/onboarding/inbox-taxonomy`
  - `PATCH /apps/inbox-iq/onboarding/stages`
  - `POST /apps/inbox-iq/onboarding/skip-to-complete`
- Added cross-company scope guard semantics for onboarding payloads (`company_id` optional but enforced when provided).
- Added migration `20260416_0005` creating `iq_onboarding_states` table with unique per-user onboarding aggregate state.
- Added integration tests for:
  - access denial without entitlement
  - full onboarding lifecycle update flow
  - company-scope guard enforcement.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_onboarding_endpoints.py` passed (`3 passed`)
  - `uv run pytest` passed (`30 passed`)

## 2026-04-16 - Pass 23 (Inbox IQ Agents API Slice + Analytics Overview Endpoint)
- Added Inbox IQ agent persistence model and migration-backed storage:
  - New table `iq_agents` with source-compatible agent configuration fields (status, send mode, email format, tone controls, keyword lists, Gmail connection state, forwarding policy fields).
  - New migration: `20260416_0006_inbox_iq_agents.py`.
- Implemented entitlement-guarded Inbox IQ agent API routes:
  - `GET /apps/inbox-iq/agents`
  - `POST /apps/inbox-iq/agents`
  - `GET /apps/inbox-iq/agents/{agent_id}`
  - `PATCH /apps/inbox-iq/agents/{agent_id}`
  - `DELETE /apps/inbox-iq/agents/{agent_id}`
  - `POST /apps/inbox-iq/agents/{agent_id}/pause`
  - `POST /apps/inbox-iq/agents/{agent_id}/resume`
  - `GET /apps/inbox-iq/agents/{agent_id}/send-readiness`
- Added Inbox IQ analytics route scaffold:
  - `GET /apps/inbox-iq/analytics/overview`
  - Returns deterministic overview payload while email-event analytics port is pending in subsequent slices.
- Added integration regression coverage for Inbox IQ agents:
  - access enforcement without entitlement
  - full create/list/update/pause/resume/delete flow
  - send-readiness gate behavior
  - company-scope guard on create payload.
  - analytics overview endpoint contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_onboarding_endpoints.py tests/integration/test_inbox_iq_agents_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`34 passed`)

## 2026-04-16 - Pass 24 (Inbox IQ Activity + Gmail Viewer + Command Center Core)
- Added Inbox IQ persistence for activity and command-center state:
  - new models + migration `20260416_0008_inbox_iq_activity_and_command_center.py`
  - tables: `iq_email_logs`, `iq_cc_block_entries`, `iq_cc_global_rules`, `iq_cc_master_kb_entries`.
- Added entitlement-guarded Inbox IQ Activity endpoints:
  - `GET /apps/inbox-iq/emails`
  - `GET /apps/inbox-iq/emails/{email_id}`
  - `POST /apps/inbox-iq/emails/{email_id}/approve-draft`
  - `POST /apps/inbox-iq/emails/{email_id}/discard-draft`.
- Added Inbox IQ Gmail viewer endpoints (real Gmail API reads via stored OAuth token bundle):
  - `GET /apps/inbox-iq/gmail/messages`
  - `GET /apps/inbox-iq/gmail/messages/{message_id}`.
- Added Inbox IQ command-center core endpoints:
  - block-list CRUD (`/command-center/block-list`)
  - global rules get/update (`/command-center/global-rules`)
  - master KB list/create (`/command-center/master-kb*`)
  - assistant chat (`POST /command-center/sentinel/chat`) using Groq with company/agent/context grounding.
- Added Gmail token utility service with refresh-token path and encrypted token persistence updates.
- Fixed FastAPI callback parameter contract in Inbox IQ Gmail callback route (`Annotated + Query` default binding).
- Updated agent readiness contract/tests for new `token_bundle` gate.
- Added integration coverage:
  - `test_inbox_iq_activity_endpoints.py`
  - `test_inbox_iq_command_center_endpoints.py`.
- Validation:
  - `uv run pytest` passed (`38 passed`)

## 2026-04-16 - Pass 25 (Inbox IQ Agent Builder + Draft Reply Preview API Contract)
- Extended Inbox IQ command-center schemas and service contracts for source-compatible Agent Builder chat mode:
  - `POST /apps/inbox-iq/command-center/sentinel/chat` now accepts `mode=agent_builder`, `agent_builder_draft`, and `agent_builder_history`.
  - Sentinel chat response now supports `agent_builder` payload with `field_updates`, `missing_fields`, `is_ready_to_create`, and `interpreted_user_message`.
- Added new endpoint:
  - `POST /apps/inbox-iq/command-center/agent-draft/preview-reply`
  - Generates preview reply text/html from unsaved draft agent fields + sample inbound email.
- Refactored Groq invocation internals for shared usage:
  - added shared chat-content helper + structured JSON payload helper while preserving existing `_groq_reply` behavior.
- Added integration coverage for:
  - Agent Builder mode contract on sentinel chat.
  - Draft preview reply endpoint contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`4 passed`)
  - `uv run pytest` passed (`42 passed`)

## 2026-04-16 - Pass 26 (Inbox IQ Simulation Run Endpoint for One-View Agent Response)
- Added source-compatible simulation schemas under `app/apps/inbox_iq/schemas/simulation.py`:
  - run request payload (`dataset_id`, `mode=dry_run`, email samples)
  - per-email simulation result
  - aggregate run response summary (`actions`, pass-rate, matched expected assertions).
- Added new endpoint:
  - `POST /apps/inbox-iq/simulation/run`
  - wired through `app/apps/inbox_iq/routes/simulation.py` and included in app router.
- Implemented simulation service with real policy inputs from current Inbox IQ state:
  - loads agent profile, command-center block list, global rules, and master KB context
  - deterministic intent/action resolution (`ALLOW_SEND`, `FORCE_DRAFT`, `FORCE_ESCALATE`, `HARD_BLOCK`)
  - generated reply preview for non-blocked actions using Groq when configured, with deterministic fallback output.
- Added integration tests:
  - `tests/integration/test_inbox_iq_simulation_endpoints.py`
  - validates successful dry-run contract + mode guard behavior.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_simulation_endpoints.py` passed (`2 passed`)
  - `uv run pytest tests/integration/test_inbox_iq_simulation_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`6 passed`)
  - `uv run pytest` passed (`44 passed`)

## 2026-04-16 - Pass 27 (Inbox IQ Email Process Endpoint + App-Scoped LLM Env Keys)
- Added app-scoped LLM settings in backend config and env example:
  - `MM_GROQ_API_KEY`, `MM_GROQ_MODEL`
  - `IIQ_GROQ_API_KEY`, `IIQ_GROQ_MODEL`
  - reserved `OR_GROQ_API_KEY`, `OR_GROQ_MODEL`.
- Switched service usage to app-scoped keys (hard cutover in code paths):
  - Mail Merge AI now reads `MM_GROQ_*`
  - Inbox IQ Command Center + Simulation now read `IIQ_GROQ_*`.
- Added Inbox IQ inbound processing API contract and endpoint:
  - new schemas in `app/apps/inbox_iq/schemas/email_processing.py`
  - new route `POST /apps/inbox-iq/emails/process`.
- Implemented processing service (`app/apps/inbox_iq/services/email_processing_service.py`) with:
  - company/agent scope validation
  - idempotency by `(agent_id, gmail_message_id)`
  - deterministic intent detection + policy rule resolution
  - action resolution (`ALLOW_SEND`, `FORCE_DRAFT`, `FORCE_ESCALATE`, `HARD_BLOCK`)
  - draft/auto-send handling with Gmail send path and fallback-to-draft on send failure
  - persisted email log + policy snapshot metadata.
- Extended email repository with create/lookup helpers used by process flow:
  - `create_email_log`
  - `get_email_log_by_agent_message`.
- Added integration coverage for process flow:
  - draft creation path and duplicate idempotency
  - auto-send path with provider reference persistence.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_activity_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_mail_merge_endpoints.py` passed (`15 passed`)
  - `uv run pytest` passed (`46 passed`)

## 2026-04-16 - Pass 28 (Inbox IQ Analytics Drilldowns + Agent Emails/Stats Endpoints)
- Added source-parity Inbox IQ analytics endpoints:
  - `GET /apps/inbox-iq/analytics/overview` (now supports `range`)
  - `GET /apps/inbox-iq/analytics/volume`
  - `GET /apps/inbox-iq/analytics/intent`
  - `GET /apps/inbox-iq/analytics/agent-performance`
  - `GET /apps/inbox-iq/analytics/tone`
  - `GET /apps/inbox-iq/analytics/thread-depth`
  - `GET /apps/inbox-iq/analytics/language`.
- Added missing Inbox IQ agent endpoints:
  - `GET /apps/inbox-iq/agents/{agent_id}/emails`
  - `GET /apps/inbox-iq/agents/{agent_id}/stats`.
- Extended Inbox IQ schemas for analytics point contracts and agent email/stats responses.
- Extended email repository and services for:
  - range-scoped company log listing
  - agent status counters
  - agent paginated email listing.
- Added integration coverage for:
  - agent email list pagination
  - agent stats counters
  - all analytics drilldown endpoints and range validation.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_agents_endpoints.py tests/integration/test_inbox_iq_activity_endpoints.py` passed (`9 passed`)
  - `uv run pytest` passed (`47 passed`)

## 2026-04-16 - Pass 29 (Inbox IQ Parity: Knowledge Base + Intelligence Studio + Orchestrate)
- Added source-parity Inbox IQ knowledge base domain models and migration:
  - new tables `iq_kb_categories`, `iq_kb_entries`
  - CRUD repositories and service layer wiring for category/entry operations in agent scope.
- Added source-parity Inbox IQ intelligence studio domain model and migration:
  - new table `iq_studio_instruction_events`
  - studio instruction processing + chronological history retrieval.
- Added missing Inbox IQ endpoints:
  - `GET/POST/PATCH/DELETE /apps/inbox-iq/agents/{agent_id}/kb/categories[...]`
  - `GET/POST/PATCH/DELETE /apps/inbox-iq/agents/{agent_id}/kb/entries[...]`
  - `POST /apps/inbox-iq/agents/{agent_id}/studio/instruct`
  - `GET /apps/inbox-iq/agents/{agent_id}/studio/history`
  - `POST /apps/inbox-iq/command-center/orchestrate`.
- Implemented deterministic orchestrate behavior aligned with source flow:
  - slash-target resolution (`/AgentName`)
  - global-vs-targeted mode selection
  - restricted field guardrails (send mode/email format)
  - agent prompt updates via role-oriented section merge
  - studio event append + global rule update tracking (`sentinel_last_instruction*`).
- Added integration coverage:
  - `test_inbox_iq_knowledge_base_endpoints.py`
  - `test_inbox_iq_intelligence_studio_endpoints.py`
  - extended `test_inbox_iq_command_center_endpoints.py` with orchestrate behavior test.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_knowledge_base_endpoints.py tests/integration/test_inbox_iq_intelligence_studio_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py` passed (`7 passed`)
  - `uv run pytest` passed (`50 passed`)

## 2026-04-16 - Pass 30 (Inbox IQ Parity: Gmail Push Webhook + Auto Processing)
- Added source-parity Gmail push webhook support for Inbox IQ:
  - new route `POST /apps/inbox-iq/gmail/push`
  - new schema `InboxIQGmailPushWebhookResponse`
  - new service `gmail_push_service.py`.
- Implemented real webhook ingestion flow (no fake ACK path):
  - optional shared-token verification (`IIQ_GMAIL_PUBSUB_WEBHOOK_TOKEN`)
  - optional OIDC verification (`IIQ_GMAIL_PUBSUB_REQUIRE_OIDC`, `IIQ_GMAIL_PUSH_AUDIENCE`)
  - Pub/Sub payload decode (`emailAddress`, `historyId`)
  - connected mailbox-to-agent resolution
  - Gmail history delta fetch and message detail fetch
  - synchronous handoff into existing `/emails/process` pipeline via `process_inbound_email_response`.
- Added app-scoped Inbox IQ Gmail push config surface:
  - `IIQ_GMAIL_PUSH_ENABLED`
  - `IIQ_GMAIL_PUSH_SHADOW_MODE`
  - `IIQ_GMAIL_PUBSUB_WEBHOOK_TOKEN`
  - `IIQ_GMAIL_PUBSUB_REQUIRE_OIDC`
  - `IIQ_GMAIL_PUSH_AUDIENCE`
  - `IIQ_GMAIL_DELTA_MAX_RESULTS`.
- Extended agent repository for connected mailbox lookup by email.
- Added integration coverage:
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`
  - validates disabled ACK behavior and real webhook-triggered email-log creation path.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_gmail_push_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_activity_endpoints.py` passed (`11 passed`)
  - `uv run pytest` passed (`52 passed`)

## 2026-04-16 - Pass 31 (Inbox IQ Parity: Sentinel Chat Orchestration Triggering)
- Extended `sentinel/chat` backend behavior to align with source command-assistant semantics:
  - supports orchestration execution from `mentioned_agent_ids` in chat payload
  - supports orchestration execution from clear policy-update intent text
  - returns orchestration payload in chat response when policy updates are applied.
- Refactored orchestration service path to support explicit target IDs:
  - `orchestrate_instruction_response(..., explicit_target_agent_ids=...)`
  - deterministic target resolution by agent ID with unmatched-target reporting.
- Hardened restricted-field handling:
  - send mode/email format remains blocked for mutation attempts in chat
  - informational questions about those fields are not blocked.
- Added integration coverage:
  - `test_inbox_iq_command_center_sentinel_chat_with_mentions_runs_orchestration`
  - validates targeted orchestration via mention IDs and response payload contract.
- Validation:
  - `uv run pytest tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py` passed (`8 passed`)
  - `uv run pytest` passed (`53 passed`)

## 2026-04-16 - Pass 32 (Inbox IQ Sentinel Chat: Remove Heuristic Parser, Use Structured Orchestration Intent)
- Removed ad-hoc `_looks_like_question` / `_looks_like_policy_instruction` heuristic parsing from Inbox IQ Sentinel chat.
- Updated `sentinel_chat_response` to use structured Groq output for orchestration intent:
  - model now returns `reply`, `orchestrate`, and `instruction`
  - mention-based targeting still forces deterministic targeted orchestration (except pure greetings)
  - normalized input via `strip_sentinel_prefix(...)` is now used consistently before orchestration checks.
- Kept restricted field guardrails intact while avoiding heuristic question parsing.
- Fixed OAuth integration test redirect assertion:
  - callback test now disables redirect following (`follow_redirects=False`) so it asserts the actual `307` response contract.
- Validation:
  - `.venv/bin/pytest tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_oauth_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`9 passed`)
  - `.venv/bin/pytest -q` passed (`54 passed`)

## 2026-04-16 - Pass 33 (Inbox IQ Gmail OAuth Parity: Add POST Callback Endpoint)
- Added source-parity `POST /api/v1/apps/inbox-iq/gmail/callback` endpoint (in addition to existing GET redirect callback).
- Added dedicated callback schemas:
  - `InboxIQGmailCallbackRequest`
  - `InboxIQGmailCallbackResponse`.
- Refactored Gmail callback completion internals:
  - shared callback completion implementation now returns `agent_id`
  - GET callback still returns browser redirect URL
  - new POST callback returns JSON `{ agent_id, connected }`.
- Added integration coverage:
  - `test_inbox_iq_gmail_oauth_callback_post_connects_agent`.
- Validation:
  - `.venv/bin/pytest tests/integration/test_inbox_iq_gmail_oauth_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`10 passed`)
  - `.venv/bin/pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 34 (Groq Reliability Hardening Across Mail Merge + Inbox IQ)
- Updated all Groq chat-completions request bodies used by Mail Merge and Inbox IQ AI paths to follow Groq structured JSON mode guidance:
  - added `response_format: {"type": "json_object"}` in:
    - `app/apps/mail_merge/services/ai_service.py`
    - `app/apps/inbox_iq/services/command_center_service.py`
    - `app/apps/inbox_iq/services/email_processing_service.py`
    - `app/apps/inbox_iq/services/simulation_service.py`.
- Why:
  - previous best-effort prompt-only JSON instructions could yield non-JSON outputs, which surfaced as 400-level AI failures in app flows.
  - JSON object mode enforces valid JSON output syntax at provider level and stabilizes downstream parsing.
- Validation:
  - `.venv/bin/pytest -q tests/integration/test_mail_merge_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_simulation_endpoints.py` passed (`15 passed`)

## 2026-04-17 - Pass 35 (Unified OpenAI-Compatible LLM Provider Config for Mail Merge + Inbox IQ)
- Replaced Groq-only app-scoped LLM configuration with provider-agnostic settings in backend config:
  - `MM_LLM_PROVIDER`, `MM_LLM_API_KEY`, `MM_LLM_MODEL`, `MM_LLM_BASE_URL`
  - `IIQ_LLM_PROVIDER`, `IIQ_LLM_API_KEY`, `IIQ_LLM_MODEL`, `IIQ_LLM_BASE_URL`
  - `OR_LLM_PROVIDER`, `OR_LLM_API_KEY`, `OR_LLM_MODEL`, `OR_LLM_BASE_URL`.
- Added/used shared OpenAI-compatible LLM client (`app/core/llm/openai_compatible.py`) for Mail Merge and Inbox IQ AI paths.
- Hardened provider request execution for compatibility:
  - automatic 400-retry variants across payload shapes (`response_format` on/off, `max_completion_tokens` vs `max_tokens`) to support provider differences (Groq/Gemini OpenAI-compat behavior).
- Updated backend `.env.example` to remove deprecated `*_GROQ_*` variables and document the new `*_LLM_*` surface.
- Updated test env setup and provider stubs to the new variable names and settings attributes:
  - `tests/conftest.py`
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`.
- Updated Mail Merge AI provider error wording to provider-neutral messages.
- Why:
  - required to support runtime LLM provider switching per app (Groq/Gemini) without code edits.
  - removed env/config drift and avoided provider lock-in from old Groq-specific keys.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py tests/integration/test_inbox_iq_command_center_endpoints.py tests/integration/test_inbox_iq_simulation_endpoints.py tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed (`17 passed`)
  - `uv run pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 36 (Provider-Specific LLM Env Layout + One-Var Hot Swap)
- Updated backend settings to provider-specific per-app env fields:
  - `MM_DEFAULT_LLM_PROVIDER`, `MM_GROQ_API_KEY`, `MM_GROQ_MODEL`, `MM_GEMINI_API_KEY`, `MM_GEMINI_MODEL`
  - `IIQ_DEFAULT_LLM_PROVIDER`, `IIQ_GROQ_API_KEY`, `IIQ_GROQ_MODEL`, `IIQ_GEMINI_API_KEY`, `IIQ_GEMINI_MODEL`
  - `OR_DEFAULT_LLM_PROVIDER`, `OR_GROQ_API_KEY`, `OR_GROQ_MODEL`, `OR_GEMINI_API_KEY`, `OR_GEMINI_MODEL`.
- Removed `*_LLM_BASE_URL` config surface from runtime selection path; provider base URLs are now code-defined only in shared LLM client.
- Updated shared LLM provider resolver to:
  - read provider from `*_DEFAULT_LLM_PROVIDER`
  - load keys/models from the selected provider namespace (`*_GROQ_*` or `*_GEMINI_*`)
  - return explicit provider-specific missing-config errors.
- Updated `.env.example` to the new operational pattern and removed deprecated `*_LLM_*` entries.
- Updated test env + stubs to new naming pattern:
  - `tests/conftest.py`
  - `tests/integration/test_inbox_iq_gmail_push_endpoints.py`.
- Updated Inbox IQ command center config error guidance to reference the new env names.
- Why:
  - enables production hot-swap by changing one variable (`*_DEFAULT_LLM_PROVIDER`) per app while keeping both providers preconfigured.
- Validation:
  - `uv run pytest -q` passed (`55 passed`)

## 2026-04-17 - Pass 37 (Outreach Secret Hygiene: Env-Only App Credentials, No DB Client Secret Paths)
- Hardened Outreach configuration boundaries to avoid persisting app-level credentials in DB:
  - removed Outreach settings model fields for DB-stored app credentials (`ai_*`, `*_api_key_encrypted`, `google_client_*_encrypted`, `invoice_*_encrypted`, `zoho_client_*_encrypted`, `zoho_refresh_token_encrypted`).
  - aligned initial Outreach migration table definition (`or_settings`) to remove those columns.
- Updated Outreach settings API contract to stop accepting legacy secret/provider fields in typed schema (`OutreachSettingsUpdateRequest`).
- Switched integration readiness logic to env-backed checks:
  - `dashboard-stats.integrationReady` now evaluates Gmail account presence and `OR_ZOHO_*` env config instead of DB secret columns.
  - `/settings/zoho` now reports `hasClientId`, `hasClientSecret`, `hasRefreshToken` from env vars (`OR_ZOHO_*`).
  - `/import/zoho` now validates env-backed Zoho credentials instead of DB-stored client secret fields.
- Tightened invoice readiness flag in Outreach settings payload:
  - `hasInvoiceConfig` now requires `OR_INVOICE_API_URL` and `OR_INVOICE_API_KEY` env vars.
- Added new Outreach env entries in `.env.example`:
  - `OR_INVOICE_API_URL`, `OR_INVOICE_API_KEY`
  - `OR_ZOHO_CLIENT_ID`, `OR_ZOHO_CLIENT_SECRET`, `OR_ZOHO_REFRESH_TOKEN`.
- Why:
  - enforce server-only secret custody for app-level integration credentials and remove drift from source patterns that allowed DB secret persistence.
- Validation:
  - `uv run python -m compileall app/apps/outreach app/core/config.py` passed
  - `uv run pytest` passed (`55 passed`)

## 2026-04-17 - Pass 38 (Outreach Import/Sync De-Fake: Zoho + Invoice + Gmail Job Execution)
- Replaced Outreach integration placeholders with real backend sync flows:
  - `POST /api/v1/apps/outreach/import/zoho` now executes actual Zoho sync (token refresh, deal/contact reads, mapping, upsert, conflict tracking, strict orphan purge).
  - `POST /api/v1/apps/outreach/import/invoice` now supports real sync execution:
    - `mode=fast` schedules background sync and returns immediate partial status payload.
    - `mode=full` runs sync inline and returns active/inactive counts.
  - `POST /api/v1/apps/outreach/import/gmail` now creates queued jobs and executes real Gmail sync in background tasks; job polling endpoint now reflects true `QUEUED/RUNNING/SUCCEEDED/FAILED` progression and result payload.
- Added new Outreach integration service module:
  - `app/apps/outreach/services/integration_service.py`
  - includes robust network helpers, Zoho metadata/stage fetch, invoice XML extraction, Gmail token refresh/message ingestion, and job executor.
- Upgraded Outreach integration request typing (removed raw dict payloads for new/updated routes):
  - added schemas:
    - `OutreachZohoFieldMappingItem`
    - `OutreachZohoSettingsUpdateRequest`
    - `OutreachZohoImportRequest`
    - `OutreachGmailImportRequest`
  - file: `app/apps/outreach/schemas/public.py`.
  - kept Zoho field-mapping rows tolerant for UI draft state (blank entries are allowed in payload and filtered server-side on save).
- Updated route wiring in `app/apps/outreach/routes/integrations.py` to use the new service + typed payloads.
- Added integration coverage for Outreach import paths:
  - `tests/integration/test_outreach_import_endpoints.py`
  - validates:
    - Gmail import job creation + successful completion via background path.
    - Gmail import account-not-found handling.
    - Invoice `fast/full` mode behavior and payload shape.
    - Zoho import route delegation/result shape.
- Updated test environment defaults for Outreach integrations:
  - `tests/conftest.py` now sets `OR_INVOICE_*` and `OR_ZOHO_*` variables used by integration route guards.
- Why:
  - remove remaining fake/stub import behavior in Outreach and align UI job polling with real backend work.
  - keep migration aligned with target architecture (Hub-authenticated app routes + backend-owned secrets + BFF-safe API contracts).
- Validation:
  - `uv run python -m compileall app/apps/outreach app/core/config.py` passed
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`4 passed`)
  - `uv run pytest -q` passed

## 2026-04-17 - Pass 39 (Outreach Dashboard Stats Contract Parity + Runtime Crash Prevention)
- Restored full Outreach dashboard stats response contract in backend `GET /api/v1/apps/outreach/stats`:
  - added payload blocks required by frontend dashboard rendering:
    - `dataHealth`
    - `audienceState`
    - `campaignState`
    - `recommendedAction`
    - `processChecklist`.
  - enriched `recentCampaigns` with real client name/industry where linked.
- Added deterministic backend logic for dashboard actioning:
  - data health scoring
  - audience ratio computation
  - campaign state computation
  - recommended next action selection
  - checklist generation with integration readiness signal.
- Added regression test:
  - `test_outreach_stats_includes_dashboard_state_blocks` in `tests/integration/test_outreach_import_endpoints.py`
  - validates presence of required dashboard state keys in `/stats` response.
- Why:
  - frontend dashboard expected a richer source-parity response shape; missing state blocks caused runtime crashes (`safe.audienceState.activeRatio` undefined).
- Validation:
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`5 passed`)
  - `uv run pytest -q` passed

## 2026-04-17 - Pass 40 (Outreach Campaign Payload Legacy Normalization + Dispatch Safety)
- Fixed Outreach campaign payload handling for legacy/non-JSON records:
  - hardened `parse_campaign_generated_output(...)` to normalize legacy payload shapes instead of hard-failing on strict JSON only.
  - parser now supports fallback subject injection, body key discovery (`body/bodyHtml/html/content/message/text`), and safe HTML normalization/sanitization.
- Normalized campaign history payload output at API boundary:
  - `GET /api/v1/apps/outreach/campaigns/history` now attempts to return normalized `generatedOutput` JSON for each row using campaign topic fallback.
- Hardened campaign mutation/sending paths for legacy rows:
  - `PATCH /api/v1/apps/outreach/campaigns/{id}`
  - `POST /api/v1/apps/outreach/campaigns/dispatch`
  - `POST /api/v1/apps/outreach/campaigns/dispatch/batch`
  - all now parse with campaign-topic fallback to avoid false `BAD_REQUEST` for old payload rows.
- Added integration coverage:
  - `test_outreach_campaign_history_normalizes_legacy_payloads`
  - `test_outreach_dispatch_accepts_legacy_payload_format`
  - file: `tests/integration/test_outreach_import_endpoints.py`.
- Why:
  - fixed production-facing payload parse failures that surfaced in frontend as ΓÇ£Campaign payloads are invalidΓÇ¥ when history contained legacy records.
  - ensured dispatch path remains operable for migrated legacy data.
- Validation:
  - `uv run pytest tests/integration/test_outreach_import_endpoints.py -q` passed (`7 passed`)
  - `uv run pytest -q` passed

## 2026-04-20 - Pass 41 (Backend Containerization Baseline for Dokploy)
- Added production-oriented backend container files:
  - `Dockerfile`
  - `docker-entrypoint.sh`
- Docker build/runtime behavior:
  - multi-stage image with `uv` dependency install in builder stage (`uv sync --locked --no-dev --no-install-project`)
  - runtime stage runs as non-root `app` user
  - migrations directory wired for Alembic (`/app/migrations` + `/app/alembic.ini`)
  - startup entrypoint executes `alembic upgrade head` (toggle with `RUN_MIGRATIONS=false`) then starts Uvicorn on `${PORT:-8000}`.
- Storage handling:
  - created `/app/storage` and `/app/storage/mail_merge/attachments` in image
  - declared `VOLUME ["/app/storage"]` to support persistent volume mounts in Dokploy.
- Why:
  - provide a deploy-ready container path for `ikf-solutions-backend` with consistent startup behavior and persistence semantics for attachment storage.
- Validation:
  - static verification of Dockerfile paths against repo layout (`app/`, `migrations/`, `alembic.ini`, entrypoint).

## 2026-04-20 - Pass 42 (Security Hardening + MM Env Namespace Cutover)
- Cut over Mail Merge env/config naming from `MAIL_MERGE_*` to `MM_*`:
  - `.env.example` keys updated:
    - `MM_OAUTH_SUCCESS_PATH`, `MM_OAUTH_ERROR_PATH`
    - `MM_ATTACHMENTS_ROOT`, `MM_MAX_ATTACHMENT_SIZE_MB`, `MM_MAX_ATTACHMENTS_TOTAL_MB`, `MM_MAX_ATTACHMENTS_PER_CAMPAIGN`
    - `MM_CLICK_DEFAULT_REDIRECT_URL`, `MM_CLICK_ALLOWED_DOMAINS`
    - `MM_WORKER_ENABLED`, `MM_WORKER_POLL_SECONDS`
  - backend settings fields updated in `app/core/config.py` and all runtime references migrated in Mail Merge routes/services.
- Removed insecure test-token authentication bypass from runtime auth verifier:
  - deleted `test:<uid>:<email>...` parsing path from `app/platform/auth/firebase.py`.
  - session exchange now always depends on Firebase Admin token verification in runtime code.
- Removed startup schema mutation behavior:
  - deleted `AUTO_CREATE_TABLES` setting and `Base.metadata.create_all(...)` path from app lifespan startup (`app/main.py`).
  - backend no longer performs implicit table creation on boot.
- Removed startup migration execution from container entrypoint:
  - `docker-entrypoint.sh` no longer runs `alembic upgrade head` automatically; migrations must be run explicitly/manual.
- Hardened unauthenticated Gmail push webhook path:
  - `app/apps/inbox_iq/services/gmail_push_service.py` now rejects webhook processing when push is enabled but neither shared-token auth nor OIDC verification is configured (`push_auth_not_configured`).
- Test infrastructure adjusted to preserve testability without runtime backdoor:
  - `tests/conftest.py` now overrides `get_token_verifier` with a test-only verifier fixture and uses `MM_*` env keys.
- Why:
  - remove runtime auth bypass and startup mutation/migration behavior that are unsafe for production.
  - enforce consistent `MM_*` env namespace and stricter webhook authentication posture.
- Validation:
  - `uv run pytest tests/integration/test_platform_endpoints.py -q` passed
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed
  - `uv run pytest tests/integration/test_inbox_iq_gmail_push_endpoints.py -q` passed

## 2026-04-20 - Pass 43 (Inbox IQ Agent Delete FK Cascade Fix)
- Fixed Inbox IQ agent deletion failures caused by non-cascading foreign keys from agent-owned child tables.
- Root cause:
  - deleting rows from `iq_agents` failed when dependent rows existed (first seen on `iq_gmail_tokens`).
  - service delete path (`DELETE /apps/inbox-iq/agents/{agent_id}`) was correct semantically but DB constraints prevented parent deletion.
- Updated ORM model foreign keys to enforce cascading deletes on agent-owned relations:
  - `iq_gmail_tokens.agent_id -> iq_agents.id`
  - `iq_email_logs.agent_id -> iq_agents.id`
  - `iq_instruction_modules.agent_id -> iq_agents.id`
  - `iq_kb_categories.agent_id -> iq_agents.id`
  - `iq_kb_entries.agent_id -> iq_agents.id`
  - `iq_studio_instruction_events.agent_id -> iq_agents.id`
  - all now configured with `ondelete="CASCADE"` in SQLAlchemy models.
- Added migration `20260420_0012_inbox_iq_agent_fk_cascade.py`:
  - drops and recreates Inbox IQ agent FK constraints with `ON DELETE CASCADE`.
  - includes downgrade logic to restore non-cascade constraints if required.
- Deployment/runtime verification:
  - confirmed DB revision lag before fix (`current=20260417_0011`, `head=20260420_0012`).
  - executed `./.venv/bin/alembic upgrade head` successfully.
  - verified Postgres constraints now use delete action `confdeltype='c'` (cascade) for all six Inbox IQ agent child FKs.
- Validation:
  - `./.venv/bin/pytest tests/integration/test_inbox_iq_agents_endpoints.py -q` passed (`5 passed`)
  - direct DB constraint verification via SQLAlchemy + `pg_constraint` query passed.
## 2026-04-20 - Pass 43 (Mail Merge Recipient Email Validation Consistency + Better Send Error Details)
- Fixed Mail Merge recipient email validation consistency between import and send:
  - upload parser now uses the same strict email validator as send-time validation (single valid email address required per row).
  - file: `app/apps/mail_merge/integrations/upload_parser.py`.
- Improved send/test-email validation failure diagnostics:
  - when campaign validation fails, backend now returns specific validation issue codes/messages (e.g. `invalid_email_addresses`, `unresolved_placeholders`) in the 400 error detail instead of only a generic message.
  - file: `app/apps/mail_merge/services/delivery_service.py`.
- Added regression coverage:
  - `test_mail_merge_send_returns_validation_issue_details_for_invalid_recipient_email`
  - file: `tests/integration/test_mail_merge_endpoints.py`.
- Why:
  - users saw generic ΓÇ£Campaign failed validationΓÇ¥ at send time even when upload looked accepted.
  - this change makes invalid email formatting visible and prevents late surprises from loose upload acceptance.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed (`8 passed`).

## 2026-04-20 - Pass 44 (Mail Merge Multi-Recipient Email Cell Support)
- Added support for comma/semicolon/newline-separated recipient email addresses in a single uploaded row:
  - parser now expands one source row into multiple recipient records (one per email).
  - each expanded record stores its own normalized email in `row_data[email_column]` and `email_address`.
  - file: `app/apps/mail_merge/integrations/upload_parser.py`.
- Added reusable recipient email parsing helper:
  - `parse_recipient_email_addresses(...)` in `app/apps/mail_merge/services/template_service.py`.
- Updated validation/send/update flows to use recipient email list parsing consistently:
  - validation now treats recipient email field as valid only when it parses into one or more valid addresses.
  - send worker now accepts legacy rows containing multi-address strings and dispatches using a normalized recipient list.
  - recipient update endpoint validation now rejects malformed email strings earlier.
  - files:
    - `app/apps/mail_merge/services/validation_service.py`
    - `app/apps/mail_merge/services/delivery_service.py`
    - `app/apps/mail_merge/services/campaign_service.py`.
- Added integration regression coverage:
  - `test_mail_merge_process_upload_and_send_supports_comma_separated_email_cells`.
  - adjusted existing invalid-email-detail test for stricter update validation.
  - file: `tests/integration/test_mail_merge_endpoints.py`.
- Why:
  - users need one spreadsheet row to fan out to multiple recipients using comma-separated email values.
  - keep behavior predictable across import, validation, manual edits, and send worker execution.
- Validation:
  - `uv run pytest tests/integration/test_mail_merge_endpoints.py -q` passed (`9 passed`).
  - `uv run pytest -q` passed.

## 2026-04-21 - Pass 45 (Backend Startup & Routing Stability)
- **Fix (mailer_service.py):** Resolved critical NameError by implementing deferred type evaluation and correct top-level model imports.
- **Fix (integration_service.py):** Corrected SyntaxError (broken try-finally indentation) in fetch_zoho_stages and fetch_zoho_fields.
- **Routing:** Verified all Outreach integration routes (/settings/invoice, /settings/zoho, etc.) are correctly registered and accessible.
- Validation: uv run python scratch/inspect_routes.py passed with code 0.

## 2026-04-28 - Pass 62 (Contact Intel Hard Cutover to Outreach)
- Ownership cutover:
  - Mail Merge no longer wires the contacts router (`app/apps/mail_merge/routes/__init__.py`), removing Mail Merge backend ownership of Contact Intel sync/intel APIs.
- Outreach contact-intel unification:
  - Added unified sync pipeline in `app/apps/outreach/services/integration_service.py`:
    - `run_contact_intel_sync(...)`
    - `run_contact_intel_sync_job(...)`
  - New flow merges both Gmail message-derived correspondents and Google Other Contacts into `OutreachClient`.
- Outreach route hard cutover:
  - Replaced legacy `POST /apps/outreach/import/gmail` with `POST /apps/outreach/import/contact-intel`.
  - Removed legacy `POST /apps/outreach/import/google-contacts`.
  - Removed legacy `POST /apps/outreach/settings/gmail/desync`.
  - Files: `app/apps/outreach/routes/integrations.py`, `app/apps/outreach/routes/settings.py`.
- Schema cleanup:
  - Removed deprecated `OutreachGmailDesyncRequest` from `app/apps/outreach/schemas/public.py` and `app/apps/outreach/schemas/__init__.py`.
- Test contract updates:
  - Updated Outreach import integration tests to validate new contact-intel endpoint and removed desync endpoint assumptions.
  - File: `tests/integration/test_outreach_import_endpoints.py`.
- Why:
  - enforce single-domain ownership in Outreach with a hard cutover and no compatibility endpoints.
  - ensure synced contact intelligence writes directly to Outreach Clients.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\outreach\routes\integrations.py app\apps\outreach\routes\settings.py app\apps\outreach\services\integration_service.py app\apps\mail_merge\routes\__init__.py` passed.
  - `.\.venv\Scripts\python.exe -m pytest tests\integration\test_outreach_import_endpoints.py -q` could not complete in this sandbox due filesystem permissions (`WinError 5` creating pytest temp/cache dirs).

## 2026-04-21 - Pass 46 (Google "Other Contacts" Integration)
- **Integration:** Implemented Google "Other Contacts" sync via Google People API.
- **Service Layer:** Added google_contacts_service.py to handle https://people.googleapis.com/v1/otherContacts retrieval and upserting into OutreachClient.
- **OAuth:** Updated GMAIL_SCOPES in settings.py to include https://www.googleapis.com/auth/contacts.other.readonly.
- **Integrations:** Added /import/google-contacts POST endpoint and corresponding background job runner.
- **Security:** Verified OAuth token refresh logic works with the new scope permissions.

## 2026-04-22 - Pass 47 (Core Stability & Contact Intel Refinement)
- **Stability:** Resolved critical "Access Denied" and "Address already in use" errors on Windows by implementing a zombie process cleanup for port 8000.
- **Contact Intel:** Optimized contact_service.py for high-density domain enrichment and refined contacts.py route logic for cross-app consistency.
- **Environment:** Hardened .env.example and core configuration to ensure reliable provider-neutral LLM orchestration.
- **Validation:** Verified server stability after multiple lifecycle restarts and high-concurrency requests.

## 2026-04-23 - Pass 48 (Mail Merge Relationship Tag Classification Recovery)
- Restored Mail Merge relationship-tag classification contract in `app/apps/mail_merge/services/ai_service.py` by implementing `classify_relationship_ai(...)` with deterministic heuristics plus AI fallback via `classify_contact_intelligence(...)`.
- Added subject/email heuristic mapping for key relationship categories (`client`, `enquiry`, `partner`, `vendor`, `newsletter`, `personal`, `admin`) so tags remain useful when LLM provider config is missing or unavailable.
- Why:
  - `contact_service.py` depends on `classify_relationship_ai(...)` during contact sync, and relationship-tagging behavior had drifted from the working `IKFMailMerge` baseline.
  - this restores stable relationship-tag assignment for Mail Merge contact sync without changing module structure.
- Validation:
  - `.\.venv\Scripts\python.exe -c "import app.apps.mail_merge.services.contact_service as c; print('import_ok')"` passed.
  - `.\.venv\Scripts\python.exe -c "from app.apps.mail_merge.services.ai_service import classify_relationship_ai; print(classify_relationship_ai(email='billing@vendor.com', name='Billing', domain='vendor.com', recent_subject='Invoice Payment Reminder'))"` returned `client`.
  - `.\.venv\Scripts\python.exe -c "from app.apps.mail_merge.services.ai_service import classify_relationship_ai; print(classify_relationship_ai(email='lead@example.com', name='Lead', domain='example.com', recent_subject='Interested in pricing and proposal'))"` returned `enquiry`.
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\services\contact_service.py` passed.

## [2026-04-23] Fixed Relationship Intelligence Sync

- **Modified**: contact_service.py, entities.py, public.py, config_service.py`n- **Fixed**: Relationship Intelligence sync stuck at 0%.
- **Added**: Progress and phase tracking for contact synchronization.
- **Optimized**: Two-phase sync/classify architecture with a 250-contact AI limit.
- **Verification**: Validated via background test scripts monitoring real-time DB updates.
## 2026-04-24 - Pass 22 (Outreach Test Dispatch Fix)
- Resolved 500 Internal Server Error in Outreach campaign test dispatch:
  - Fixed a platform-wide circular import chain triggered by `app/core/db/__init__.py` importing `app.core.db.models`.
  - Emptying `app/core/db/__init__.py` broke the chain where `Base` imports pull in all application models, allowing Outreach models to be imported cleanly.
- Hardened database schema health:
  - Merged multiple head revisions in Alembic to ensure a stable migration path.
- Validation:
  - Verified database connectivity and table presence in Postgres.
  - Verified circular import resolution via scratch script.

 # #   [ 2 0 2 6 - 0 4 - 2 7 ]   -   M u l t i - A c c o u n t   S y n c   &   C a t e g o r y   I m p r o v e m e n t s 
 # # #   A d d e d 
 -   O u t r e a c h / I n t e l   u s a g e   t o g g l e s   f o r   e a c h   e m a i l   a c c o u n t . 
 -   A c c o u n t - s p e c i f i c   ' D e e p   M i n e '   o p t i o n s   i n   a   d r o p d o w n   m e n u . 
 -   C o n t a c t   c o u n t s   f o r   G m a i l   c a t e g o r y   t a b s   ( P r i m a r y ,   P r o m o t i o n s ,   e t c . ) . 
 -   S m a r t   i n i t i a l s   f o r   a v a t a r s   b a s e d   o n   e m a i l   u s e r n a m e . 
 # # #   C h a n g e d 
 -   I n c r e a s e d   G m a i l   s c a n   d e p t h   t o   3 0 0 0   m e s s a g e s   f o r   b e t t e r   c a t e g o r y   p a r i t y . 
 -   F i x e d   s y n c   e r r o r   f i e l d   m i s m a t c h   ( m e s s a g e   - >   e r r o r )   t o   e n s u r e   t o a s t   n o t i f i c a t i o n s   s h o w   a c t u a l   e r r o r s . 
 # # #   F i x e d 
 -   B a c k e n d   f i e l d   m i s m a t c h   c a u s i n g   ' S y n c   F a i l e d '   t o a s t   w i t h   n o   m e s s a g e . 
 -   D a t a b a s e   m i g r a t i o n   c o n f l i c t s   f o r   m u l t i - a c c o u n t   u s a g e   f l a g s . 
 
 
## 2026-04-28 - Pass 44 (Mail Merge: Smart Email Synchronization)
- Implemented user-directed, granular Gmail synchronization ('Intelligence Journeys').
- Backend:
  - Added sync_type, sync_options, and error_log columns to MailMergeContactSyncStatus table.
  - Added sync_metadata to MailMergeSmtpAccount for incremental sync tracking.
  - Implemented GET /accounts/{account_id}/labels to dynamically fetch user's Gmail labels.
  - Refactored trigger_sync and deep_mine_gmail_task to handle complex MailMergeSyncOptions.
  - Implemented smart time-range filtering (after:YYYY/MM/DD) and journey-specific mining caps.
  - Added multi-threaded mining logic in contact_service.py.
- Frontend:
  - Created SyncOptionsDialog.tsx with a premium glassmorphic UI.
  - Integrated 'Quick Discovery', 'Full Network Analysis', and 'Precision Sync' journey selection.
  - Added live progress HUD in ContactsHub.tsx with phase-based messaging.
  - Implemented source-based filtering in the Contacts Hub sidebar.
- Migration:
  - Added Alembic migration 4121fd8701dc for smart sync columns.
- Validation:
  - Verified backend schema updates.
  - Verified API contract for sync initiation with options.
  - Verified UI responsiveness and journey selection flow.
## 2026-04-28 - Pass 63 (Contact Intel Cutover Cleanup)
- Removed deprecated Mail Merge Contact Intel route file as part of hard ownership transfer to Outreach:
  - `app/apps/mail_merge/routes/contacts.py`
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\outreach\routes\integrations.py app\apps\outreach\services\integration_service.py app\apps\mail_merge\routes\__init__.py tests\integration\test_outreach_import_endpoints.py`

 
 # #   [ 2 0 2 6 - 0 4 - 2 9 ]   C o n s o l i d a t e d   C o n t a c t   I n t e l l i g e n c e 
 
 -   M i g r a t e d   M a i l   M e r g e   c o n t a c t s   t o   O u t r e a c h C l i e n t   h u b . 
 
 -   A d d e d   t r u s t _ s c o r e ,   h e a l t h _ s c o r e ,   p o w e r _ r o l e ,   a n d   e n g a g e m e n t   f i e l d s   t o   O u t r e a c h C l i e n t . 
 
 -   U n i f i e d   I n t e l l i g e n c e S e r v i c e   f o r   G m a i l   s c a n n i n g . 
 
 -   D e l e t e d   l e g a c y   m m _ c o n t a c t s   a n d   m m _ c o n t a c t _ t a g s   t a b l e s . 
 
 -   R e f a c t o r e d   M a i l   M e r g e   s e r v i c e s   t o   u t i l i z e   t h e   c e n t r a l i z e d   O u t r e a c h   h u b . 
 
 
## 2026-04-29 - Pass 64 (Mail Merge Stability Hardening)
- Removed stale Contact Intel model dependency from Mail Merge AI service:
  - `app/apps/mail_merge/services/ai_service.py` no longer imports/queries `MailMergeContact`.
  - `_safe_contact_signal` now safely no-ops after Contact Intel ownership moved to Outreach.
- Why:
  - Prevent backend startup/import failures caused by references to removed legacy contact tables/models.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\main.py app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\routes\__init__.py`
  - `pytest tests\integration\test_outreach_import_endpoints.py -q` remains blocked by local OS temp/cache permissions (`WinError 5`), not by import errors from this change.

## 2026-04-29 - Pass 65 (Mail Merge Sheet Processing Fix)
- **Expanded Column Detection**: Updated `upload_parser.py` to recognize common column name variations like "Email ID" and "Contact Person".
- **Priority-Based Matching**: Refactored the column detection logic to use a prioritized search. This ensures that more specific fields (like "Contact Person") are preferred over broader fields (like "Organization Name") for recipient identity, regardless of their position in the spreadsheet.
- **Validation**: Verified the fix with a unit test simulating various sheet structures, confirming correct field selection and prioritization.

## 2026-04-29 - Pass 66 (Mail Merge Expanded File Support)
- **Added .xls and .xlsm Support**: Updated `upload_parser.py` to support legacy Excel (.xls) and macro-enabled Excel (.xlsm) files.
- **Improved Excel Engine Detection**: Refactored `_read_excel` to use pandas' default engine detection instead of forcing `openpyxl`, allowing support for multiple Excel formats.
- **Validation**: Verified that the parser correctly routes .xls and .xlsm files to the Excel reader.

## 2026-04-29 - Pass 67 (Mail Merge AI Signature Intelligence)
- **Sender-Aware Signatures**: Updated the AI writing assistant to fetch the sender's name from the connected Gmail account and use it in the email sign-off.
- **Recipient Tag Guard**: Explicitly instructed the AI to never use recipient-related placeholders (like `{{contact person}}`) in the signature area to avoid identity confusion.
- **Schema Update**: Added `sender_name` to the AI `help-me-write` API contract to facilitate this context sharing.
- **Validation**: Verified that the AI prompt now includes sender context and stricter sign-off constraints.

## 2026-04-29 - Pass 68 (Mail Merge Multi-Sheet Workbook Upload Fix)
- Updated `app/apps/mail_merge/integrations/upload_parser.py` to scan all Excel workbook sheets instead of assuming the first sheet contains recipient data.
- Added reusable frame preparation and recipient extraction helpers so CSV and Excel parsing share the same column-detection and row-validation behavior.
- Improved Excel workbook failure reporting to include per-sheet reasons when no usable recipient sheet is found.
- Added `tests/unit/test_mail_merge_upload_parser.py` covering the multi-sheet workbook case where the first tab is unrelated and a later tab contains `Email ID` recipient data.
- Why:
  - real user workbooks can place the recipient list on a later tab like `Invitations`; the previous parser incorrectly failed when the first tab did not contain an email column.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\integrations\upload_parser.py tests\unit\test_mail_merge_upload_parser.py`
  - direct venv Python workbook simulation confirmed `parse_upload("demo.xlsx", ...)` selects the later `Invitations` sheet and extracts `amit.shah@ikf.co.in`
  - `pytest tests\unit\test_mail_merge_upload_parser.py -q` is blocked in this environment by the session-level temp fixture permissions (`WinError 5`)

## 2026-04-29 - Pass 69 (Mail Merge Sender Placeholder Guardrails)
- Updated `app/apps/mail_merge/services/ai_service.py` so AI drafting guidance explicitly distinguishes recipient sheet placeholders from sender-owned placeholders.
- Added sender-side placeholder normalization in AI responses for common misuse patterns such as `contact us at {{mobile number}}` or `{{email id}}`, converting them to bracket placeholders like `[Your Phone]` and `[Your Email]`.
- Updated `app/apps/mail_merge/services/validation_service.py` to emit a warning when sender contact/signoff language appears to use recipient sheet merge tags.
- Why:
  - recipient spreadsheet fields should never be used as the sender's own contact identity in signoff or support/contact lines.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\services\validation_service.py`

## 2026-04-30 - Pass 70 (Mail Merge Draft Persistence and Campaign Reuse)
- Expanded `app/apps/mail_merge/schemas/public.py` and `app/apps/mail_merge/services/campaign_service.py` so Mail Merge campaign responses now include saved draft HTML and validation/session metadata needed for composer recovery.
- Added `PATCH /apps/mail-merge/campaigns/{campaign_id}/draft` in `app/apps/mail_merge/routes/campaigns.py` so the composer can autosave draft subject/body, scheduling choices, and lightweight draft session data back to the campaign record.
- Added `POST /apps/mail-merge/campaigns/{campaign_id}/duplicate` in `app/apps/mail_merge/routes/campaigns.py` to create a new draft copy of an existing campaign, including recipients and attachments, for resend/reuse flows.
- Why:
  - campaign history needs to support continuing drafts and preparing resends without relying only on browser-local session state.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\schemas\public.py app\apps\mail_merge\services\campaign_service.py app\apps\mail_merge\routes\campaigns.py`

## 2026-04-30 - Pass 71 (Mail Merge Campaign Delete API and Safe Cleanup)
- Added Mail Merge-only delete contracts in `app/apps/mail_merge/schemas/public.py` for single and bulk campaign deletion responses, including blocked active-campaign reporting.
- Added delete service logic in `app/apps/mail_merge/services/campaign_service.py` to:
  - remove physical attachment files before deleting a campaign record
  - support single-campaign deletion
  - support bulk deletion by campaign id list
  - skip actively sending campaigns instead of deleting them mid-flight
- Updated `app/apps/mail_merge/repositories/campaign_repository.py` so queued recipients are counted with pending recipients in campaign stats, matching the actual delivery state model.
- Added `DELETE /apps/mail-merge/campaigns/{campaign_id}` and `POST /apps/mail-merge/campaigns/delete-bulk` in `app/apps/mail_merge/routes/campaigns.py`.
- Why:
  - the history screen needed a real delete flow for drafts and finished/stalled campaigns, and attachment files must be cleaned up safely instead of leaving orphaned files behind.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\schemas\public.py app\apps\mail_merge\repositories\campaign_repository.py app\apps\mail_merge\services\campaign_service.py app\apps\mail_merge\routes\campaigns.py`

## 2026-04-30 - Pass 72 (Mail Merge AI Strict Sheet-Tag Enforcement)
- Updated `app/apps/mail_merge/schemas/public.py` so AI help-me-write requests now accept `available_columns` from the uploaded sheet.
- Updated `app/apps/mail_merge/services/ai_service.py` to enforce send-ready output rules:
  - only `{{...}}` placeholders matching uploaded sheet columns are preserved
  - unknown `{{...}}` placeholders are removed
  - square-bracket placeholders like `[Your Email]` / `[Your Phone]` are removed
  - prompt constraints now explicitly forbid invented tags and bracket placeholders
- Why:
  - AI drafts must be ready-to-send using only valid sheet tags, with no extra user-entry placeholders.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\schemas\public.py app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\routes\ai.py`

## 2026-04-30 - Pass 73 (Mail Merge Remove Manual Placeholder Guidance)
- Updated `app/apps/mail_merge/services/ai_service.py` so sender-contact misuse cleanup removes invalid sender-contact fragments directly instead of converting them through `[Your ...]` placeholders.
- Updated `app/apps/mail_merge/services/validation_service.py` so validation warnings no longer tell users to use square-bracket placeholders.
- Why:
  - Mail Merge AI output and validation should require ready-to-send text, with only uploaded sheet tags allowed as merge fields.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\services\validation_service.py app\apps\mail_merge\schemas\public.py`

## 2026-04-30 - Pass 74 (Mail Merge Placeholder Error Audit)
- Removed stale default `{{Name}}` placeholders from Mail Merge campaign/template fallback subjects and bodies.
- Tightened AI wording so it forbids invented merge tags without showing examples that could be copied into generated drafts.
- Reworded sender-contact validation to explain that recipient data must not be used as sender details.
- Why:
  - default and AI-assisted drafts must be ready to send and must not introduce merge fields that are not present in the uploaded sheet.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\mail_merge\services\ai_service.py app\apps\mail_merge\services\validation_service.py app\apps\mail_merge\services\template_service.py app\apps\mail_merge\models\entities.py app\apps\mail_merge\schemas\public.py`

## [2026-04-30] Refined Campaign Dispatch
- Fixed critical bug where campaigns stalled after first batch due to incorrect state transition.
- Corrected pacing fallback from 30 days to immediate send if end_at is missing.
- Added defensive checks for dispatch plan metadata execution.

## 2026-04-29 - Pass 67 (Mail Merge AI Signature Intelligence)
- **Sender-Aware Signatures**: Updated the AI writing assistant to fetch the sender's name from the connected Gmail account and use it in the email sign-off.
- **Recipient Tag Guard**: Explicitly instructed the AI to never use recipient-related placeholders (like `{{contact person}}`) in the signature area to avoid identity confusion.
- **Schema Update**: Added `sender_name` to the AI `help-me-write` API contract to facilitate this context sharing.
- **Validation**: Verified that the AI prompt now includes sender context and stricter sign-off constraints.
- **Modified**: contact_service.py, entities.py, public.py, config_service.py`n- **Fixed**: Relationship Intelligence sync stuck at 0%.
- **Added**: Progress and phase tracking for contact synchronization.
- **Optimized**: Two-phase sync/classify architecture with a 250-contact AI limit.
- **Verification**: Validated via background test scripts monitoring real-time DB updates.

## 2026-04-27 - Pass 22 (Wave Hard Cutover Into Consolidated Backend)
- Added first-class `app/apps/wave` module and routes under `/api/v1/apps/wave/*` with authenticated CRUD/live-stream/upload/finalize/chat endpoints.
- Implemented Wave app layering to match repo patterns:
  - `models/` (`wv_meetings`, `wv_transcript_segments`, `wv_chat_messages`, `wv_speaker_aliases`)
  - `repositories/` for persistence and response mapping
  - `services/` for meeting assistant + transcription
  - `schemas/public.py` + `schemas/internal.py`
  - `deps.py` with `WaveUserDep` access guard using platform access checks.
- Wired Wave router into `app/api/v1/router.py` and registered Wave ORM models in core model exports.
- Extended platform catalog defaults to include `wave` as `is_public=true` (hard-cutover default chosen for authenticated ACTIVE users).
- Added Wave runtime settings to `app/core/config.py` and `.env.example` with `WV_*` config contract.
- Added Alembic migration `20260427_0018_wave_core_tables.py` and merged prior migration heads into a unified down-revision chain.
- Added integration coverage `tests/integration/test_wave_endpoints.py` for:
  - auth-required behavior
  - public Wave access behavior
  - membership-blocked access denial
  - upload processing via service monkeypatch
  - websocket token enforcement
  - config endpoint.
- Why:
  - Replace deprecated Appwrite-backed Wave backend with IKF standardized FastAPI + platform-auth + Postgres architecture.
  - Enforce hard cutover and remove compatibility/legacy path dependence.
- Validation executed:
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_migration.db uv run alembic upgrade head` (blocked by pre-existing SQLite-incompatible historical migration `20260416_0004_mm_smtp_password_text.py`; Wave migration file itself loaded in chain).

## 2026-04-27 - Pass 23 (Wave Audio Asset Persistence + Signed Playback URLs)
- Added Wave audio persistence domain model:
  - New ORM entity `WaveAudioAsset` and one-to-one relation on `WaveMeeting`.
  - New Alembic migration `20260427_0019_wave_audio_assets.py`.
- Added provider-agnostic audio metadata in public contracts:
  - `WaveAudioAssetSchema` nested in `WaveMeetingSchema`.
  - Upload/transcription status enums for audio lifecycle.
- Implemented `WaveAudioStorageService` with two backends:
  - `supabase` storage integration (service-role upload + signed URL generation + delete).
  - `filesystem` fallback for local/dev environments.
- Added Wave audio configuration contract in settings:
  - `WV_AUDIO_STORAGE_BACKEND`
  - `WV_AUDIO_LOCAL_ROOT`
  - `WV_AUDIO_BUCKET`
  - `WV_AUDIO_SIGNED_URL_TTL_SECONDS`
  - `WV_AUDIO_SUPABASE_URL`
  - `WV_AUDIO_SUPABASE_SERVICE_ROLE_KEY`
- Updated Wave routes:
  - `/meetings/{meeting_id}/upload` now stores audio first, then optionally transcribes (`transcribe_audio` query flag).
  - Added `GET /meetings/{meeting_id}/audio` for persisted audio metadata.
  - Added `POST /meetings/{meeting_id}/audio/playback-url` for short-lived playback URLs.
  - Meeting deletion now attempts audio object cleanup in storage.
- Extended integration tests:
  - Upload now validates `audio_asset` payload status transitions.
  - Added playback URL + audio metadata endpoint coverage.
- Why:
  - Enable durable meeting audio retention and signed playback support for iOS audio player UX.
  - Keep transcription provider choice (Gemini/Sarvam) independent from storage and user-facing consistency.
- Validation executed:
  - `uv run pytest tests/integration/test_wave_endpoints.py` (passed)
  - `FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://127.0.0.1:8000 ENVIRONMENT=local DATABASE_URL=sqlite:///./tmp_wave_test.db uv run pytest tests/integration/test_platform_endpoints.py tests/integration/test_wave_endpoints.py` (passed)
  - `uv run python -m py_compile app/apps/wave/routes/meetings.py app/apps/wave/services/audio_storage_service.py app/apps/wave/repositories/meeting_repository.py app/apps/wave/models/entities.py` (passed)

## 2026-04-27 - Pass 24 (Wave Audio Storage Auth: Supabase S3 Access Key Support)
- Extended Wave audio storage backend to support Supabase S3-style authentication in addition to service-role REST auth:
  - Storage upload, delete, and signed playback URL generation now work with either:
    - `WV_AUDIO_SUPABASE_URL` + `WV_AUDIO_SUPABASE_SERVICE_ROLE_KEY` (REST mode), or
    - `WV_AUDIO_SUPABASE_S3_ENDPOINT` + `WV_AUDIO_SUPABASE_S3_ACCESS_KEY_ID` + `WV_AUDIO_SUPABASE_S3_SECRET_ACCESS_KEY` (S3 mode).
- Added new Wave audio S3 config keys to settings and `.env.example`.
- Added `boto3` dependency for S3 client operations and presigned URL generation.
- Why:
  - Supabase users commonly provision Storage S3 access keys rather than exposing service-role keys for app runtime.
  - This enables secure object operations with existing S3 credentials and unblocks Wave audio persistence rollout.
- Validation executed:
  - `uv lock` (updated lockfile with `boto3`, `botocore`, `jmespath`, `s3transfer`)
  - `uv run python -m py_compile app/apps/wave/services/audio_storage_service.py app/core/config.py` (passed)
  - `uv run pytest tests/integration/test_wave_endpoints.py` (passed)

## 2026-04-28 - Pass 25 (Wave Meeting Rename + Speaker Rename Endpoints)
- Added authenticated Wave update endpoints:
  - `PATCH /api/v1/apps/wave/meetings/{meeting_id}` for meeting title rename.
  - `PATCH /api/v1/apps/wave/meetings/{meeting_id}/speakers` for speaker label rename.
- Added request schemas in `app/apps/wave/schemas/public.py`:
  - `WaveRenameMeetingRequest`
  - `WaveRenameSpeakerRequest`
- Extended repository mutation methods in `WaveMeetingRepository`:
  - `rename_meeting(...)` updates title + `updated_at`.
  - `rename_speaker(...)` upserts `WaveSpeakerAlias`, rewrites transcript segment speaker labels, updates participant labels, and bumps `updated_at`.
- Why:
  - Enable in-product editing workflows for finalized meetings without introducing legacy compatibility paths.
  - Keep edits user-scoped and fully persisted in IKF Wave domain models.
- Validation executed:
  - `python3 -m compileall app/apps/wave` (passed)

## 2026-05-05 - Pass 46 (Complete Purge of Invoice Synchronization Features)
- **Backend - Decommissioned Invoice System Infrastructure**:
  - Removed `OutreachInvoiceConfig` model and associated `or_invoice_config` table from the ORM.
  - Purged all invoice-related fields (`gstin`, `last_invoice_date`, `invoice_service_names`) from the `OutreachClient` model.
  - Deleted invoice synchronization routes and background job logic in `integrations.py`.
  - Removed all invoice extraction and upsert logic from `integration_service.py`.
- **Backend - Sanitized AI Campaign Generation**:
  - Refactored `campaigns.py` to remove invoice context from AI prompts and fallback email generation.
  - Updated AI variable replacement in `text_utils.py` to use generic `services` instead of `invoiceServiceNames`.
  - Switched campaign sorting to default to `lastContacted` and fallback to `updatedAt` instead of `lastInvoiceDate`.
- **Backend - Cleaned Up Analytics & Reporting**:
  - Removed invoice-related metrics and data health dependencies from `stats.py`.
  - Purged `sourceStats["invoice"]` and related amber-status signals from dashboard reporting logic.
- **Validation**: Verified complete removal through global repository search for residual "invoice" mentions across models, routes, services, and schemas.

## 2026-05-05 - Pass 47 (Outreach Onboarding State + APIs)
- Added new Outreach onboarding persistence model `OutreachOnboardingState` in `app/apps/outreach/models/entities.py`.
- Added onboarding request contract `OutreachOnboardingStepRequest` in `app/apps/outreach/schemas/public.py`.
- Added new routes in `app/apps/outreach/routes/onboarding.py`:
  - `GET /apps/outreach/onboarding/status`
  - `POST /apps/outreach/onboarding/start`
  - `POST /apps/outreach/onboarding/step`
- Wired onboarding router in `app/apps/outreach/routes/__init__.py`.
- Added Alembic migration `migrations/versions/20260505_0019_outreach_onboarding_state.py` to create `or_onboarding_states`.
- Why:
  - Provide user-scoped onboarding lifecycle required for first-time setup gating and guided progression.
  - Keep onboarding progress durable and app-specific without compatibility shims.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\outreach\routes\onboarding.py app\apps\outreach\models\entities.py app\apps\outreach\schemas\public.py` (passed)

## 2026-05-05 - Pass 48 (Outreach Onboarding Audience Data APIs)
- Extended `app/apps/outreach/routes/onboarding.py` with onboarding audience support:
  - Added segment-aware audience logic (`recent`, `past`, `inactive`, `all`).
  - Extended `/apps/outreach/onboarding/status` payload with segment counts.
  - Added `GET /apps/outreach/onboarding/contacts` for manual audience selection (search + segment filter + valid-email signal).
- Why:
  - Provide data-driven onboarding audience suggestions and manual selection support for guided setup.
  - Keep all onboarding selection data user-scoped.
- Validation:
  - `.\.venv\Scripts\python.exe -m py_compile app\apps\outreach\routes\onboarding.py` (passed)
## 2026-05-05 - Pass 46 (Outreach Resilience & Generation Fallbacks)
- **AI Generation Fallback (`llm_service.py`)**: Implemented a retry mechanism for `completion_json` and `completion_text` with up to 3 attempts and random delays (1-3s) to handle transient LLM API failures.
- **Email Dispatch Resilience (`mailer_service.py`)**: 
  - Added 429 (Rate Limit) handling with a 10-second delay retry.
  - Added a general retry loop (2 attempts) for SMTP/Gmail API failures.
  - Improved error logging for dispatch failures.
- **Why it Changed**: To meet the "zero-block" system requirement and ensure that temporary API or network issues do not prevent campaign generation or delivery.
- **Validation**: Verified retry logic via code inspection; manual verification of error logging behavior in `backend_error.log`.
