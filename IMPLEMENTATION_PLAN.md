# TenderFlow AI — Implementation Plan

> **Product thesis:** TenderFlow is not a dashboard, CRM, ERP, or ChatGPT clone.
> It is an **AI Bid Department** for a single Facility Management (FM) company.
> The entire product serves one loop:
>
> **Upload RFP → AI understands the tender → specialized FM agents collaborate → deliverables generated → team reviews & approves → export submission package.**

This document is the authoritative build plan. It is derived from three source specs
(see `_specs/`): the *Codex Master Instruction*, the *Enterprise Workspace Redesign*,
and the *Team Workspace, File Editing & Integration System*.

---

## 1. Scope decision: single company (single-tenant)

This platform is for **one company only**. That removes a large class of complexity:

| Spec concept | Single-tenant decision |
|---|---|
| Organization → Team → Tender hierarchy | Organization is **implicit and fixed**. No org switcher, no multi-org. |
| Billing / subscriptions / plans | **Removed.** |
| Multi-tenant data isolation | Not needed. RLS is scoped to **roles**, not tenants. |
| Public signup | **Removed.** Admin invites internal staff only. |
| "ORGANIZATION" sidebar item | Becomes the **Company profile + Knowledge base** (certs, staff, past projects, libraries). |

Everything else from the specs is retained.

---

> **ClickUp study:** see [`DESIGN_CLICKUP_ADAPTATION.md`](DESIGN_CLICKUP_ADAPTATION.md) for what we
> adopt (hierarchy logic, Views Bar tabs, collapsible context tree, page-load motion) vs. reject
> (Kanban/Gantt/light theme), the two-tier navigation reconciliation, per-tab artifact map, and the
> full motion spec.

## 2. Design system (non-negotiable from spec)

### Colors
| Token | Hex |
|---|---|
| Background (primary) | `#050816` |
| Secondary background | `#0B1220` |
| Card / workspace background | `#111827` |
| Primary accent | `#3B82F6` |
| AI accent | `#00E5FF` |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |
| Text primary | `#FFFFFF` |
| Text secondary | `#94A3B8` |
| Border | `rgba(255,255,255,0.06)` |

Rules: no flashy gradients, no cyberpunk effects, enterprise-grade, generous whitespace.

### Typography
- Primary font: **Inter**. Secondary: **Geist**.
- Hero `64px` · Page title `40px` · Workspace header `28px` · Section title `20–24px` · Body `16px` · Labels `14px`.
- Typography is the **primary visual hierarchy**. Avoid excessive borders and visual noise.

### Sidebar (critical)
- **Text only. No icons. No emojis.** Max 6 items.
- Items: `HOME · WORKSPACES · KNOWLEDGE · DOCUMENTS · ORGANIZATION · SETTINGS`
- Width: collapsed `80px`, expanded `240px`, smooth transitions.
- Active state: left accent border + subtle background highlight + accent color + heavier font weight.

### Animations
Framer Motion: smooth transitions, AI typing indicators, agent progress animations, generation progress, skeleton loaders, premium loading states. The platform should "feel alive."

### What NOT to build
No KPI dashboards, statistics cards, ERP layouts, multi-level sidebars, empty widgets, Kanban/Gantt, time tracking, project scheduling, issue/ticketing, generic ChatGPT UI, traditional CRM/ERP navigation. Never show "Active Tenders = 0" style empty counters.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server actions + route handlers for agents |
| Styling | Tailwind CSS + design tokens | Exact color/type system above |
| UI primitives | shadcn/ui (restyled) + Framer Motion | Accessible base, mandated animations |
| Rich editor | TipTap (ProseMirror) | Notion / Google-Docs-style editing, comments, track changes |
| DB / Auth / Storage / Realtime | Supabase (Postgres + RLS) | Required by spec |
| AI provider | **OpenAI** (behind a provider abstraction) | Chosen. Abstraction keeps swap-ability. |
| RFP parsing | pdf-parse, mammoth (DOCX), xlsx/exceljs, officeparser, OCR for images | Multi-format extraction |
| Doc generation | docx, exceljs, pptxgenjs, PDF (Puppeteer/react-pdf) | DOCX / XLSX / PPTX / PDF |
| Agent orchestration | Server pipeline + background jobs (Inngest or Supabase functions) | Async; progress streamed via Realtime |
| Embeddings / retrieval | OpenAI embeddings + pgvector | Knowledge base RAG feeding agents |

### AI provider abstraction
All model calls go through `lib/ai/provider.ts` exposing `complete()`, `stream()`, `embed()`.
OpenAI is the concrete implementation. Swapping providers later touches only this module.

---

## 4. Data model (Supabase / Postgres)

```
users
  id, email, full_name, role, status, invited_by, created_at
  role ∈ {owner, admin, bid_manager, commercial_manager, operations_manager, reviewer, viewer}

company_profile            -- single row
  id, name, logo_url, profile_json, updated_at

knowledge_items            -- company knowledge base (AI source)
  id, type, title, content, file_url, embedding(vector), tags[], created_by, created_at
  type ∈ {technical_proposal, method_statement, sop, ppm_library, sla_library,
          kpi_library, hse_plan, risk_register, mobilization_plan, company_profile,
          certification, past_project, reference, case_study}

tenders                    -- each tender = one workspace
  id, name, client, submission_deadline, contract_duration, contract_value,
  status, readiness_score, win_probability, executive_summary, created_by, created_at
  status ∈ {analyzing, in_progress, in_review, ready, submitted, archived}

tender_files               -- uploaded RFP source files
  id, tender_id, name, original_name, category, description, important,
  version, storage_path, mime, extraction_status, used_by_agents[], created_at
  category ∈ {rfp_main, boq, technical_spec, contract_conditions, drawings,
              appendices, compliance_docs, pricing_docs, client_forms, other}

tender_extractions         -- structured tender intelligence
  id, tender_id, client_name, tender_name, deadline, contract_duration,
  scope_of_work, technical_requirements, commercial_requirements,
  evaluation_criteria, boq_data, asset_information, staffing_requirements, raw_json

agent_runs                 -- one row per agent per tender
  id, tender_id, agent_type, status, progress, current_task, output_doc_id,
  started_at, completed_at, error
  agent_type ∈ {intelligence, qualification, compliance, technical, commercial,
                manpower, ppm, risk, hse, presentation, executive_review}
  status ∈ {waiting, running, completed, failed}

documents                  -- generated deliverables (outputs only)
  id, tender_id, type, title, current_version_id, review_status, assigned_reviewer,
  locked, created_by, created_at
  review_status ∈ {draft, ai_generated, in_review, changes_requested, approved, final}

document_versions
  id, document_id, version_no, content_json, content_html, created_by, created_at, note

comments
  id, target_type, target_id, anchor, author_id, body, mentions[], resolved, created_at

tasks
  id, tender_id, title, description, assignee_id, due_date, priority, status,
  related_document_id, related_agent_run_id, created_by, created_at
  priority ∈ {low, medium, high, critical}
  status   ∈ {todo, in_progress, in_review, approved, blocked, completed}

activity_log
  id, actor_id, action, target_type, target_id, metadata, created_at

notifications
  id, user_id, type, title, body, link, read, created_at

integrations               -- architecture-ready connectors
  id, provider, status, config_json, connected_by, connected_at
```

RLS: every table keyed by role permissions (section 6). pgvector on `knowledge_items.embedding`.

---

## 5. The 11 AI agents

Orchestrated **automatically** on RFP upload — the user does not trigger each step.

| Agent | Primary outputs |
|---|---|
| Tender Intelligence | Reads all files, extracts structured fields, builds tender knowledge base, executive summary |
| Qualification | Go/No-Go recommendation, eligibility assessment, qualification matrix |
| Compliance | Compliance matrix, submission checklist, missing-documents report |
| Technical Proposal | Technical proposal, method statements, operational strategy, service delivery plan |
| Commercial | Pricing model, BOQ analysis, commercial submission |
| Manpower | Org chart, staffing plan, shift matrix, mobilization plan |
| PPM | PPM schedule, maintenance matrix, asset schedule |
| Risk | Risk register, mitigation plan, risk assessment |
| HSE | HSE plan, emergency procedures, training matrix |
| Presentation | PowerPoint / executive deck / client presentation |
| Executive Review | Submission readiness score, win probability, executive summary, final review report |

**Orchestration flow:** Intelligence runs first (produces extractions) → Qualification → then
Compliance/Technical/Commercial/Manpower/PPM/Risk/HSE run in parallel where dependencies allow →
Presentation consumes their outputs → Executive Review runs last. Status streams live to the
workspace via Supabase Realtime: `waiting → running → completed`.

Each agent: a server-side function that pulls (a) tender extractions, (b) relevant knowledge_items
via RAG, builds a structured prompt through the OpenAI provider abstraction, and writes its output
as a `documents` + `document_versions` record, updating its `agent_runs` row as it progresses.

---

## 6. Roles & permissions (RBAC)

| Role | Key permissions |
|---|---|
| Owner | Everything: manage org, invite users, delete workspaces, configure integrations, approve final submissions |
| Admin | Invite users, create tenders, edit knowledge, manage docs, assign tasks, approve docs |
| Bid Manager | Upload RFP, generate docs, edit proposals, assign tasks, review agent outputs, export packages |
| Commercial Manager | View RFP, edit BOQ/commercial proposal/pricing, approve commercial docs |
| Operations Manager | Edit technical proposal/manpower/PPM/mobilization, approve operational content |
| Reviewer | View, comment, request changes, approve assigned docs |
| Viewer | View workspace & docs, download approved docs only |

Enforced at three layers: Supabase RLS policies, server-side guards, and UI affordances.

---

## 7. Review & approval workflow

Document statuses: `Draft → AI Generated → In Review → Changes Requested → Approved → Final`.
Users can request changes, approve, reject, assign reviewer, add review comments, compare versions,
and lock the final version. All transitions write to `activity_log` and fire notifications.

---

## 8. Phased delivery

### Phase 0 — Foundation
- Next.js 15 + TS + Tailwind; design tokens (colors, fonts, spacing).
- Supabase project, schema + RLS, pgvector.
- Invite-only auth; seed Owner.
- App shell: text-only collapsible sidebar (6 items), layout, theme.

### Phase 1 — Home / AI Command Center
- Hero: "Good morning, [User] / What would you like to create today?"
- Large upload area (40–50% of screen), example prompts.
- Live "AI Bid Department" agent strip beneath the upload.

### Phase 2 — RFP upload + Tender Intelligence Engine
- Multi-file / drag-drop / folder / batch upload to Supabase Storage.
- Parsing pipeline (PDF/DOCX/XLSX/PPTX/ZIP/images/BOQ).
- Auto-extraction → `tender_extractions`; auto-create tender workspace + executive summary.
- File management: rename, describe, categorize, mark important, replace version, delete, preview, download, extraction status, "used by agents".

### Phase 3 — Tender Workspace
- 3-panel layout: left (sources/knowledge/generated) · center (conversation) · right (agents/progress/deliverables).
- Tabs: Overview · Requirements · AI Agents · Documents · Compliance · Commercial · Submission Package.
- Workspace header: name, client, deadline, contract value, readiness score, win probability.

### Phase 4 — Agent orchestration
- Async pipeline + background jobs; dependency graph (section 5).
- Real-time progress via Supabase Realtime; outputs persisted as documents.

### Phase 5 — Document generation + editor
- TipTap editor: rich text, tables, headings, comments, mentions.
- AI actions: rewrite selection, expand, shorten, make professional, make technical, translate, regenerate section.
- Version history, track changes, compare, approval status.
- Export: DOCX / XLSX / PPTX / PDF.

### Phase 6 — Team collaboration
- RBAC enforcement (section 6).
- Tasks (title, assignee, due date, priority, status, related doc/agent, comments, attachments).
- Comments, mentions, activity feed, presence, audit logs, notifications (in-app first).
- Review/approval workflow (section 7).

### Phase 7 — Knowledge Hub + Company (Organization)
- Company profile + knowledge libraries (SOPs, PPM, SLA, KPI, HSE, past projects, certs, case studies).
- Embedding + retrieval feeding the agents (RAG).

### Phase 8 — Command Bar (⌘K) + Final Export + polish
- Global command center: generate proposal/presentation/SLA/risk, analyze tender, search knowledge, open workspace, find docs.
- Submission package builder + final readiness check + ZIP export (PDF/DOCX/XLSX/PPTX).
- Framer Motion polish: transitions, skeletons, AI typing/agent animations.

### Phase 9 — Integrations (architecture-ready, wired incrementally)
- Google Drive, OneDrive/SharePoint, Gmail/Outlook, Slack/Teams, Calendar.
- All behind a common integration interface; notification fan-out channels.

---

## 9. Repository layout (target)

```
/app                     Next.js App Router (routes, layouts, server actions)
  /(auth)                invite + sign-in
  /home                  AI Command Center
  /workspaces/[id]       Tender Workspace (tabbed)
  /knowledge             Knowledge Hub
  /documents             Document Library
  /organization          Company profile + libraries
  /settings
/components              UI (sidebar, editor, agent panels, upload, command bar)
/lib
  /ai                    provider abstraction (OpenAI), prompts, agent definitions
  /parsing               file extractors
  /generation            docx/xlsx/pptx/pdf builders
  /supabase              client, queries, RLS helpers
/supabase                migrations, seed
/styles                  tokens, tailwind config
/_specs                  source PDFs + extracted text (reference)
```

---

## 10. Environment / secrets (to provision)

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Integration credentials added per connector in Phase 9.

---

## 11. Company / brand (confirmed)

- **Company:** Etihad International Hospitality (EIH) — single tenant.
- **Logo:** gold palm/crown + brown arch + "EIH" wordmark (asset to be added to `/public/brand/`).
- **Brand colors:** gold/amber ≈ `#C8A24A`, brown ≈ `#8B4226` (to be sampled exactly from the logo file).
- **Languages:** English + Arabic, full **RTL** support (i18n from Phase 0).
- **Supabase project URL:** `https://mjtzqtvwfpumlopdarae.supabase.co`

### Palette reconciliation (brand vs. spec)
The spec mandates a dark enterprise base (`#050816` background) — **kept**. The accent layer is
brand-aligned:
- **Brand accent (gold `#C8A24A`)** → primary actions, active nav state, highlights, logo. Replaces
  the spec's generic blue as the *brand* accent.
- **AI accent (cyan `#00E5FF`)** → reserved for AI-specific surfaces (agents, AI typing, generation)
  so "AI" stays visually distinct from "brand".
- **Brown `#8B4226`** → sparingly, for depth/borders/secondary emphasis.
- Success/Warning/Danger/text tokens unchanged from spec.
> **CONFIRMED** by user: Gold brand + cyan AI. Gold replaces blue as the primary/brand accent.

### i18n / RTL
- `next-intl` (or equivalent), locale `en` + `ar`, `dir="rtl"` flip for Arabic.
- All deliverables generated in the tender's language; documents support EN/AR output and AI translate.

## 12. Still needed before/early in Phase 0
1. Supabase **anon key** + **service role key** (URL already provided).
2. Deployment target — Vercel? (recommended).
3. Exact logo file (PNG/SVG) to drop into `/public/brand/` and sample colors.
4. Initial **Owner** account email.
5. First set of **knowledge documents** to seed the knowledge base (can come later).
