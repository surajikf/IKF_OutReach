# Business Requirements Document (BRD) - Client Communication App (Simple)

## 1) Executive Summary
The Client Communication App helps teams create, personalize, review, and send outreach emails at scale. It imports client data from common sources (Invoice, Zoho, Gmail), generates AI-personalized email drafts for the right audience, and supports test + batch sending with progress tracking and an archive of past outputs.

## 2) Objectives
1. Reduce manual effort in writing personalized outreach emails.
2. Increase relevance by tailoring subject + message to each client.
3. Provide a controlled workflow: review first, then test, then send.
4. Ensure better continuity with draft saving/restoration during edits.
5. Maintain visibility: users can track progress and review past campaign outputs.

## 3) Users & Roles
1. Regular User (Approved)
   - Builds campaigns, generates drafts, refines emails, sends test emails, and dispatches batches.
2. Admin
   - Manages integrations and system-level settings (connect sources, configure mapping, manage linked accounts).
3. Pending / Banned Users
   - Restricted from normal workflow until access is updated.

## 4) Problem Statement
Teams often struggle with:
- Writing personalized outreach manually for many clients.
- Keeping the message tone consistent across a campaign.
- Selecting the right recipients based on current CRM/service status.
- Verifying quality (subject + email body) before sending.
- Keeping an archive for auditing and re-use.

## 5) Scope
### In Scope
1. Access control workflow (Login/Register/Forgot password + Pending/Banned/Admin gating).
2. Data ingestion from:
   - Invoice system
   - Zoho Bigin
   - Gmail (connect multiple accounts; import client contacts from headers/activity)
3. Client management view (review and maintain the target audience list).
4. Campaign Builder workflow:
   - Choose campaign type
   - Enter master subject and master email draft
   - Choose tone and CTA (call to action)
   - Select audience using segmentation rules (with “match any / match all” style options)
   - Generate one sample first (for review)
5. Refinement and optimization:
   - Smart subject suggestions
   - Smart refinement for edited draft
   - Template-based email rendering (consistent output)
   - Draft continuity (save/restore during editing)
6. Dispatch workflow:
   - Send test email
   - Generate for all targeted clients and send in batch
   - Show progress and support partial failure reporting
7. History / archive:
   - Search/filter past outputs
   - Preview generated content
   - Copy content for re-use

### Out of Scope (for this BRD version)
1. Complex multi-language localization beyond the initial set.
2. A full marketing automation CRM (beyond client list + campaign outputs).
3. Deep analytics dashboarding for open/click rates (unless already available externally).

## 6) High-Level User Journeys
### Journey A: Build and send a campaign
1. Login (access check).
2. Go to Dashboard → see suggested next step.
3. Open Integrations Studio (optional if data already exists).
4. Open Campaign Builder:
   - Choose campaign type
   - Enter master subject + master email sample
   - Pick audience criteria
   - Generate 1 sample
5. Refine sample (subject/body).
6. Generate for all selected clients.
7. Review results; optionally send a test email.
8. Dispatch batch and monitor progress.
9. Check History for archived campaign outputs.

### Journey B: Import/update clients
1. Admin opens Integrations Studio.
2. Run sync for Invoice / Zoho / Gmail.
3. Clients list updates and becomes available for campaigns.

## 7) Functional Requirements (Simple)

### 7.1 Access & Permissions
1. Users must be able to log in and access the app only if status allows.
2. Pending users are restricted until approved.
3. Banned users cannot access normal workflow.
4. Admin-only operations are restricted to Admin role.

### 7.2 Integrations Studio (Data Import)
1. The app must allow syncing from:
   - Invoice
   - Zoho Bigin
   - Gmail
2. Gmail:
   - Admin can link multiple Gmail accounts.
   - Admin can trigger a sync per account.
3. The app must provide clear sync status feedback (idle/syncing/success/warning/error).
4. After sync, the client list should reflect imported/updated clients.

### 7.3 Clients (CRM View)
1. Users must be able to view the client list that campaigns will use.
2. Users must be able to add and update client entries.
3. Users must be able to remove clients if needed.

### 7.4 Campaign Builder (Composer)
1. Users must be able to select a campaign type:
   - Broadcast, Targeted, Cross-Sell, Reactivation
2. Users must be able to input:
   - Master subject line
   - Master email draft sample
   - Tone selection
   - CTA (call to action)
3. Users must be able to set audience targeting:
   - Choose service filters
   - Choose match logic (match any / match all)
   - Exclude specific clients (optional oversight step)
4. Users must be able to generate a single sample email first for review.
5. Users must be able to generate the full campaign for all targeted clients.

### 7.5 Smart Optimization & Refinement
1. Smart subject suggestions:
   - Provide alternative subject lines for better outcomes.
2. Smart refinement:
   - When the user edits the sample, the app refines for improved clarity/tone while keeping intent.
3. Template support:
   - Users can select a template to standardize email formatting.
4. Draft continuity:
   - If the user returns to refine a sample, drafts should be recoverable.

### 7.6 Test Send & Batch Dispatch
1. Users must be able to send a test email to a specified email address.
2. Users must be able to dispatch emails in batch to all targeted clients.
3. The UI must show dispatch/generation progress (so the user is not confused during long steps).
4. If some recipient emails fail, the system must report partial success and continue where possible.

### 7.7 Results Studio
1. Users must be able to review generated emails as a queue.
2. Users must be able to select a generated item and edit the subject/body.
3. Users must be able to save “evolution” (store updated content).

### 7.8 History / Archive
1. Users must be able to search history by keyword (company/topic/content).
2. Users must be able to filter history by campaign type.
3. Users must be able to preview archived outputs.
4. Users must be able to copy the generated output from history.

## 8) Non-Functional Requirements (Business View)
1. Usability: simple step-by-step workflow with clear buttons and feedback.
2. Reliability: background work should not freeze the UI; progress should be visible.
3. Security: sensitive integration credentials must be stored securely.
4. Deliverability safety: the app must include quality checks to reduce poor outreach formatting/tone.
5. Auditability: history provides a trace of what was generated/sent.

## 9) Success Metrics (How we measure)
1. Time saved: reduce time to produce a campaign vs manual writing.
2. Campaign completion rate: % of campaigns that reach “dispatch”.
3. Quality perception: user satisfaction with “sample → refine → final” workflow.
4. Operational reliability: % of jobs that succeed; rate of partial failures.
5. Usage of archive: % of users who view/copy from history after dispatch.

## 10) Assumptions & Dependencies
1. Users have access to at least one email sending identity (via connected Gmail accounts).
2. Client sources (Invoice/Zoho/Gmail) are reachable and configured by Admin.
3. AI generation is available through configured providers (internal settings).

## 11) Risks & Mitigations
1. Risk: Poor email quality leading to deliverability issues.
   - Mitigation: quality checks + correction/refinement before sending.
2. Risk: Long processing causing user confusion.
   - Mitigation: clear progress states + polling/updates.
3. Risk: Incorrect targeting due to segmentation rules.
   - Mitigation: sample-first workflow and optional exclusions/oversight.

## 12) Open Questions (for Ashish Sir)
1. Which team is the primary user group (Sales, Partnerships, Marketing Ops)?
2. What is the “success” definition: more meetings, better replies, or faster campaign execution?
3. Do we need additional roles (e.g., Reviewer/Approver separate from Admin)?
4. Any compliance requirement on stored email content retention?

