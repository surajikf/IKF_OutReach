# Client Communication App (Simple Visual Explainer)

This is a non-technical, easy-to-read “start to finish” flow you can share with Ashish Sir.

## 1) What a user does (end-to-end)

```mermaid
flowchart TD
  A[Open App] --> B{Access allowed?}
  B -->|Yes| D[Dashboard]
  B -->|Pending| P[Pending]
  B -->|No (restricted)| X[Banned]

  D --> I[Integrations Studio]
  I -->|Import clients| CLIs[Clients added/updated]

  D --> C[Clients]
  C --> BLD[Campaign Builder]

  BLD -->|Generate 1 example| S[Refine Sample]
  S -->|Generate for all| G[Campaign Generated]

  G --> R[Results Studio]
  R -->|Send emails| SEND[Dispatch Batch]

  SEND --> H[History (search + preview)]

  note[Long steps run in the background; progress is shown.]
  G -.-> note
  SEND -.-> note
```

## 2) Core screens (what to show in demo)

- **Dashboard**: quick status + “what to do next”
- **Integrations Studio**: bring clients in from Invoice / Zoho / Gmail
- **Clients**: view the target database
- **Campaign Builder**: choose campaign type, add master email draft, choose audience
- **Refine Sample**: correct tone/wording once (this becomes the style for the whole batch)
- **Results Studio**: review generated emails, edit, test, then send
- **History**: search past campaign outputs and preview content
- **Pending / Banned**: access-status pages
- **Admin (if needed)**: only for managing integrations/system settings

## 3) Key features (simple bullets)

- **AI-personalized emails**
  - You give the “master” email idea
  - The app generates personalized versions per client

- **Smart refinement**
  - You edit the sample once
  - The rest of the batch follows that refined direction

- **Smart subject suggestions**
  - Helps improve subject lines for better outreach

- **Audience selection**
  - Choose who gets the email using service filters and campaign rules

- **Templates**
  - Consistent email formatting using selectable templates

- **Test email**
  - Send to a test address before the full batch

- **Batch sending with progress**
  - Generation and dispatch run in background
  - UI shows progress and keeps you updated

- **Archive / History**
  - Keep a searchable record of outputs for later use

## 4) One-liner to say to Ashish Sir

“This app imports your clients from Invoice/Zoho/Gmail, helps you generate and refine AI-personalized outreach for the right audience, and then sends in batches with progress tracking and a searchable history.”

