# ClickUp → TenderFlow Design Adaptation

> Goal: **inspire from ClickUp, do not copy.** Adopt ClickUp's *structural intelligence*
> (hierarchy, views bar, collapsible tree, AI-as-first-class, page-load motion) while keeping
> TenderFlow's mandated identity: **dark, executive, text-only sidebar, no icons, max 6 items,
> Inter/Geist typography, the spec color palette.**

References studied:
- ClickUp brand: Plus Jakarta Sans typeface; vibrant blue `#0091FF` + purple/pink/yellow accents; light backgrounds.
- ClickUp hierarchy: Workspace → Spaces → Folders → Lists → Tasks (collapsible left tree).
- ClickUp Views Bar: tabbed views (List/Board/Calendar/Gantt/Table) at the top of any context.
- ClickUp AI: Brain MAX + AI Agents elevated to top-level tabs.

---

## 1. What we ADOPT (translated, not copied)

| ClickUp pattern | TenderFlow translation |
|---|---|
| **Hierarchy** Workspace→Space→Folder→List→Task | **Company → Workspaces (Tenders) → Deliverables/Files.** A shallow, clean tree — max 2 nesting levels, never ClickUp's 5. |
| **Collapsible left tree** with expand arrows | A **secondary contextual panel** that opens beside the primary rail (see §3). Reconciles "tree" with "text-only, 6-item sidebar." |
| **Views Bar** (tabs at top of a context) | **Tender Workspace tabs**: Overview · Requirements · AI Agents · Documents · Compliance · Commercial · Submission Package. This is the single strongest pattern to borrow. |
| **Multiple views of the same data** | Applied to *documents*, not tasks: Preview / Edit / Version History / Compare. (No Kanban/Gantt.) |
| **AI as a first-class tab** (Brain MAX) | AI Agents tab + persistent right-hand "AI Bid Department" panel. |
| **Quick-create `+`** everywhere | Contextual "+ New" (upload RFP, new task, new knowledge item) + ⌘K command bar. |
| **Card grids + generous whitespace** | Same spatial generosity, restyled dark/enterprise with `#111827` cards and `rgba(255,255,255,0.06)` borders. |
| **Staggered page-load motion** | Framer Motion staggered fade/slide-in of cards + skeleton loaders (see §5). |
| **Typographic hierarchy** (big bold headings) | Same *approach*, but with **Inter/Geist** (spec), not Plus Jakarta Sans. |

---

## 2. What we REJECT (ClickUp has it, we do NOT need it)

- Light theme & vibrant multi-color palette → we keep the **dark enterprise palette**.
- Kanban boards, Gantt charts, Sprints, Whiteboards, Time tracking, Mind maps.
- Task-management-as-product (statuses, dependencies as the core object).
- Icon-heavy, deeply nested (5-level) sidebar.
- "100+ features" surface clutter; ClickUp's Plus Jakarta Sans font.
- Forms builder, generic Docs wiki sprawl (we have a focused Knowledge Hub + Document Library instead).

> TenderFlow tasks exist **only** to complete tender submission work — never a standalone PM tool.

---

## 3. Navigation reconciliation (the key design move)

Two-tier navigation (à la Linear/Vercel) lets us honor *both* the ClickUp tree and the
"text-only, max-6, no-icons" mandate:

```
┌───────────────┬─────────────────────────┬──────────────────────────────┐
│ PRIMARY RAIL  │ CONTEXT PANEL           │ MAIN CONTENT                  │
│ (text only)   │ (collapsible tree)      │                               │
│               │                         │                               │
│ HOME          │  WORKSPACES             │  [ Views Bar / Tabs ]         │
│ WORKSPACES ●  │   › ADNOC FM 2026       │  ───────────────────────     │
│ KNOWLEDGE     │   › Mubadala HQ FM      │   ...page content...          │
│ DOCUMENTS     │   › Dubai Airports FM   │                               │
│ ORGANIZATION  │     • Documents         │                               │
│ SETTINGS      │     • Files             │                               │
│               │     • Tasks             │                               │
│ collapsed 80px│  expanded 240px         │                               │
└───────────────┴─────────────────────────┴──────────────────────────────┘
```

- **Primary rail** = the mandated 6 text-only items (HOME, WORKSPACES, KNOWLEDGE, DOCUMENTS, ORGANIZATION, SETTINGS). Collapsed `80px` / expanded `240px`. Active = left accent border + subtle highlight + heavier weight. **No icons.**
- **Context panel** = the ClickUp-style collapsible tree, but only shown for sections that need it (WORKSPACES, KNOWLEDGE, DOCUMENTS). It is a *second* column, so the primary rail stays clean and rule-compliant.
- Sections that don't need a tree (HOME, SETTINGS) render directly in main content with no context panel.

---

## 4. Pages & their tabs/views (the artifacts)

### HOME — AI Command Center  *(no tabs)*
- Hero greeting + "What would you like to create today?"
- Large upload area (40–50% of screen).
- Example prompt chips (Generate Technical Proposal, Commercial Proposal, Manpower Plan, PPM Schedule, SLA Matrix, Executive Presentation, Analyze Tender).
- Live "AI Bid Department" agent strip.

### WORKSPACES — list view + per-tender workspace
- **List view:** card grid of tenders (name, client, deadline, contract value, readiness score, win probability). Inspired by ClickUp's space cards.
- **Tender Workspace tabs (Views Bar):**
  | Tab | Artifacts on the tab |
  |---|---|
  | **Overview** | Tender summary, submission requirements, executive insights, key risks, key opportunities, readiness + win-probability header. |
  | **Requirements** | Auto-extracted: scope of work, mandatory/technical/commercial requirements, evaluation criteria, submission conditions, deadlines. Read-only extraction, editable annotations. |
  | **AI Agents** | Live agent cards (status: Waiting/Running/Completed, progress bar, current task) + each agent's generated outputs. |
  | **Documents** | Generated deliverables list (Technical Proposal.docx, Commercial.xlsx, PPM.xlsx, Risk Register.xlsx, Executive Presentation.pptx, Compliance Matrix.xlsx) → Preview / Edit / Version history / Regenerate / Compare. |
  | **Compliance** | Compliance matrix, submission checklist, missing-documents report. |
  | **Commercial** | Pricing model, BOQ analysis, commercial submission, cost sheet. |
  | **Submission Package** | Package builder, final readiness check, export (ZIP/PDF/DOCX/XLSX/PPTX). |

### KNOWLEDGE — Knowledge Hub  *(context tree by category)*
- Tree: Technical Proposals, Method Statements, SOPs, PPM Libraries, SLA/KPI Libraries, HSE Plans, Risk Registers, Mobilization Plans, Company Profiles, Certifications, Past Projects, References, Case Studies.
- Main: searchable card grid; item detail shows content + "used by N tenders".

### DOCUMENTS — Document Library  *(generated outputs only)*
- Filters: by tender, by type, by review status.
- Per-doc: Preview · Download · Version History · Regenerate · Compare Versions.

### ORGANIZATION — Company  *(tabs)*
- Tabs: Company Profile · Certifications · Staff · Equipment · Suppliers · Past Projects · References · Case Studies · HSE Documents · Templates.
- (Single-company: this is the org-level knowledge base, no org switching.)

### SETTINGS  *(tabs)*
- Tabs: Members & Roles (RBAC) · Integrations · AI (OpenAI config) · Notifications · Appearance.

### Document Editor (modal/route) — Notion/Docs-inspired
- Rich text, tables, headings, comments, mentions.
- AI actions: rewrite / expand / shorten / make professional / make technical / translate / regenerate section.
- Track changes, version control, approval status, export.

---

## 5. Motion & animation spec (page-load + interactions)

ClickUp's app feels alive via staggered entrance + skeletons. TenderFlow (Framer Motion):

| Moment | Animation |
|---|---|
| **Page mount** | Container `staggerChildren: 0.05`; each card/section fades + slides up `y: 12 → 0`, `opacity 0 → 1`, `220ms`, ease `[0.16,1,0.3,1]`. |
| **Sidebar collapse/expand** | Width `80px ↔ 240px`, `200ms` spring; labels fade with the width. |
| **Tab switch (Views Bar)** | Active underline slides (`layoutId` shared element); content cross-fades `120ms`. |
| **RFP upload** | Drag-over scales the dropzone `1.0 → 1.02` + accent glow; on drop, files animate into a list with stagger. |
| **Agent activity** | Pulsing AI-accent dot while Running; progress bar tween; on Complete, check-fade + row settle. |
| **AI typing / thinking** | 3-dot shimmer in AI accent `#00E5FF`; streamed text reveals token-by-token. |
| **Document generation** | Skeleton blocks shimmer → real content cross-fades in section by section. |
| **Loading states** | Skeleton loaders everywhere (never spinners-only); cards keep layout to avoid shift. |
| **Toasts/notifications** | Slide in from top-right, `spring`, auto-dismiss. |
| **Command bar (⌘K)** | Scale `0.96 → 1` + fade, `140ms`; backdrop blur. |

Principles: subtle, fast (≤250ms), purposeful. No bounce-heavy or cyberpunk effects — enterprise restraint.

---

## 6. Net adds vs. the base plan

These items are **added/sharpened** in `IMPLEMENTATION_PLAN.md` as a result of the ClickUp study:
1. **Two-tier navigation** (primary rail + collapsible context tree) — added to Phase 0/3.
2. **Views Bar component** (shared `layoutId` animated tabs) — reusable across Tender Workspace, Organization, Settings.
3. **Tender card grid** (WORKSPACES list view) inspired by ClickUp space cards.
4. **Full motion spec** (§5) — feeds Phase 8 polish but applied incrementally from Phase 0.
5. Explicit **per-tab artifact map** (§4) so each tab's content is unambiguous before build.
