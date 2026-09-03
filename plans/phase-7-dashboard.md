# Phase 7 — Full Frontend: Landing Page & Dashboard

> **Status:** [ ] Not started  
> **Estimated time:** 5 hours  
> **Day:** 2, second block  
> **Depends on:** Phase 6 (FastAPI pipeline live, all REST endpoints returning data)

---

## Objective

Build the complete AgentGuard frontend: a public-facing **Landing Page** and a multi-page **Security Dashboard**. Together these two surfaces tell the full product story — what AgentGuard does, why it exists, and that it is working in real time — in under 10 seconds, without requiring a technical document.

This is not a developer tool. Every piece of copy, every state message, every interaction must be understood by a non-technical business owner. Internal backend terminology never appears on the frontend.

**Design principle: The LLM explains. The policy engine decides.**

---

## Stack

Per design spec §27, using:
- **React** (via Vite, single-page app with client-side routing)
- **Tailwind CSS v3** (design tokens as CSS custom properties)
- **shadcn/ui** component primitives
- **Lucide Icons**
- **Recharts** (charts)
- **Framer Motion** (purposeful animation only)
- **React Router v6** (routing between Landing / Dashboard pages)
- **REST polling** every 3 seconds (SSE stretch goal)

Frontend root: `frontend/`  
Dev server: `npm run dev` (port 5173)  
API proxied to: `http://localhost:8000`

---

## Design Tokens (from §3)

Implement as CSS custom properties in `frontend/src/index.css`:

```css
--bg:          #080B14
--surface:     #11161D
--surface-2:   #161C24
--border:      #26303A
--text-primary:   #E6E7EB
--text-secondary: #A1A7B3
--success:     #22C55E   /* Allowed / healthy */
--danger:      #EF4444   /* Blocked / failure */
--warning:     #F59E0B   /* Flagged / advisory */
--info:        #3B82F6   /* Informational */
--accent:      #7C3AED   /* AgentGuard brand */
```

Fonts:
- Body: **Inter** (Google Fonts)
- Mono: **JetBrains Mono** (intent IDs, hashes, amounts, timestamps)

Color rules:
- Green: allowed, chain intact, service healthy
- Red: blocked, policy violation, cart tampering, replay
- Yellow: advisory risk, human review required
- Blue: informational states
- Purple: brand elements and selected nav item
- **Status color must NEVER be the only indicator** — always pair with icon + text label

---

## Status Translation Layer (Task 7.0 — MUST DO FIRST)

> This task is a prerequisite for every other task. No backend status value may reach a UI component untranslated.

### Problem

The backend returns internal state values such as `category_not_allowed`, `exceeds_transaction_cap`, `cart_integrity_failure`, `replay_detected`, `confirmation_required`. These must never appear raw in the UI.

### Task

Create `frontend/src/lib/statusTranslations.ts`:

```typescript
// Maps backend status/reason values → human-readable UI labels and explanations

export const DECISION_LABELS: Record<string, { label: string; icon: string }> = {
  allowed:  { label: "Approved",  icon: "✓" },
  blocked:  { label: "Blocked",   icon: "✕" },
  pending:  { label: "Reviewing", icon: "○" },
};

export const BLOCK_REASON_LABELS: Record<string, {
  short: string;        // one line for table cell
  headline: string;     // bold line in drawer
  explanation: string;  // plain-English sentence for non-technical users
  moneyMoved: boolean;
  nextStep: string;
}> = {
  exceeds_transaction_cap: {
    short: "Over spending limit",
    headline: "Spending limit exceeded",
    explanation: "This purchase was blocked because the amount is higher than the maximum allowed for a single transaction. No money was moved.",
    moneyMoved: false,
    nextStep: "Try a lower amount, or contact your administrator to raise the spending limit.",
  },
  category_not_allowed: {
    short: "Category not permitted",
    headline: "Purchase category not permitted",
    explanation: "Your agent is not authorized to buy items in this category. No money was moved.",
    moneyMoved: false,
    nextStep: "Check the allowed purchase categories in the Policy Center.",
  },
  confirmation_required: {
    short: "Needs human approval",
    headline: "Human approval required",
    explanation: "This purchase is above the threshold that can be approved automatically. It needs a human to confirm it before money can move.",
    moneyMoved: false,
    nextStep: "Approve this request manually or reduce the amount below the auto-approval limit.",
  },
  cart_integrity_failure: {
    short: "Cart was changed",
    headline: "Cart contents changed after authorization",
    explanation: "The items or prices in the cart changed between when the purchase was approved and when payment was attempted. AgentGuard blocked it to prevent unauthorized charges. No money was moved.",
    moneyMoved: false,
    nextStep: "Start a new purchase request.",
  },
  replay_detected: {
    short: "Duplicate request",
    headline: "Duplicate purchase blocked",
    explanation: "This exact purchase request was already processed. Sending it again was blocked to prevent double-charging. No money was moved.",
    moneyMoved: false,
    nextStep: "If you intended a new purchase, submit a fresh request.",
  },
  exceeds_daily_cap: {
    short: "Daily limit reached",
    headline: "Daily spending limit reached",
    explanation: "This agent has reached its maximum allowed spending for today. No money was moved.",
    moneyMoved: false,
    nextStep: "Wait until tomorrow, or contact your administrator to adjust the daily limit.",
  },
  velocity_exceeded: {
    short: "Too many requests",
    headline: "Too many requests in a short time",
    explanation: "This agent sent too many purchase requests within a short period. AgentGuard paused new requests to prevent automated abuse. No money was moved.",
    moneyMoved: false,
    nextStep: "Wait a minute before sending another request.",
  },
  all_blocked: {
    short: "Service paused",
    headline: "All purchases temporarily paused",
    explanation: "An administrator has paused all purchases system-wide. No money was moved.",
    moneyMoved: false,
    nextStep: "Contact your administrator to re-enable purchasing.",
  },
};

export const GATE_LABELS: Record<string, { name: string; passVerb: string; failVerb: string }> = {
  policy:      { name: "Policy Check",       passVerb: "Passed",     failVerb: "Blocked by policy" },
  cart:        { name: "Cart Verification",  passVerb: "Verified",   failVerb: "Cart mismatch detected" },
  risk:        { name: "Risk Assessment",    passVerb: "Low risk",   failVerb: "Risk flag raised" },
  idempotency: { name: "Replay Protection",  passVerb: "Unique",     failVerb: "Duplicate detected" },
  payment:     { name: "Payment",            passVerb: "Processed",  failVerb: "Payment failed" },
};

export const STATUS_PIPELINE_LABELS: Record<string, string> = {
  RECEIVED:        "Request received",
  PARSED:          "Intent understood",
  POLICY_CHECKED:  "Policy check complete",
  CART_VERIFIED:   "Cart verified",
  RISK_CHECKED:    "Risk assessed",
  AUTHORIZED:      "Authorized",
  EXECUTING:       "Processing payment",
  PAYMENT_PENDING: "Payment pending",
  PAID:            "Payment complete",
  REJECTED_POLICY: "Blocked by policy",
  REJECTED_CART:   "Blocked — cart changed",
  REJECTED_REPLAY: "Blocked — duplicate request",
  REJECTED_EXPIRED:"Blocked — request expired",
  REJECTED_INVALID:"Blocked — invalid request",
  PAYMENT_FAILED:  "Payment failed",
};
```

This module is the **single source of truth** for all user-facing text. No component may import backend status strings directly.

### Acceptance Criteria

- [ ] `statusTranslations.ts` covers all known backend `block_reason` values
- [ ] Every UI component that displays a decision, gate result, or block reason imports from this module — never uses the raw backend string
- [ ] Phrase "category_not_allowed", "replay_detected", or any other snake_case backend value never appears in the rendered DOM

---

## Build Stages

---

### Stage 1: Project Scaffolding

**Task 7.1 — Initialize Vite + React + Tailwind**

```bash
cd frontend
npx -y create-vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npm install react-router-dom framer-motion recharts lucide-react
npm install -D @types/react @types/react-dom
npx tailwindcss init -p
```

**Task 7.2 — Design Token Setup (`frontend/src/index.css`)**

- Implement all CSS custom properties from §3
- Import Inter + JetBrains Mono from Google Fonts
- Reset body background to `var(--bg)`
- Set default font to Inter, `color: var(--text-primary)`

**Task 7.3 — Vite API Proxy (`vite.config.ts`)**

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:8000',
    '/webhooks': 'http://localhost:8000',
    '/health': 'http://localhost:8000',
  }
}
```

**Task 7.4 — Router Setup (`frontend/src/main.tsx`)**

```
/          → LandingPage
/dashboard → DashboardShell → OverviewPage (default)
/dashboard/transactions  → TransactionsPage
/dashboard/agents        → AgentsPage
/dashboard/policies      → PoliciesPage
/dashboard/audit         → AuditChainPage
/dashboard/attack        → AttackSimulatorPage
/dashboard/settings      → SettingsPage
```

**Task 7.5 — API Client (`frontend/src/lib/api.ts`)**

Typed wrapper for all backend calls:
- `getAuditEntries(limit, offset)` → `AuditEntry[]`
- `verifyAuditChain()` → `{ intact: boolean; entries_checked: number; message: string }`
- `getAgentSpend(agentId)` → `AgentSpend`
- `getPolicy()` → `Policy`
- `postIntent(agentId, rawInput)` → `IntentResponse`
- `getHealth()` → `{ status: string }`

All functions handle network errors and translate HTTP error responses to user-facing messages via `statusTranslations.ts`. Never surface HTTP status codes or raw error objects to the UI.

**Acceptance criteria (Stage 1)**:
- [ ] `npm run dev` starts without error at `localhost:5173`
- [ ] Design token CSS variables load in browser
- [ ] All routes resolve without 404
- [ ] API proxy forwards `/api/*` correctly to FastAPI

---

### Stage 2: Shared Component Library

Build all reusable components from §20 before building any page.

**Task 7.6 — `<StatusBadge />`**

```tsx
<StatusBadge decision="allowed" />  // → ✓ Approved (green)
<StatusBadge decision="blocked" />  // → ✕ Blocked  (red)
<StatusBadge decision="pending" />  // → ○ Reviewing (yellow)
```

Rules:
- Always renders icon + text label (NEVER color alone)
- Imports label from `statusTranslations.ts`
- `aria-label` includes the decision text for screen readers

**Task 7.7 — `<MetricCard />`**

```tsx
<MetricCard
  label="Total Transactions"
  value={1284}
  trend="+12.4%"
  trendUp={true}
  subtext="Last 24 hours"
/>
```

- Background: `var(--surface)`
- Border: `var(--border)`
- Value: 28–32px, weight 600, JetBrains Mono
- Hover: border brightens 150ms transition, no large movement (§24)
- Skeleton state when loading (no spinner)

**Task 7.8 — `<SecurityPipeline />`**

```tsx
<SecurityPipeline gates={[
  { id: "policy",      status: "pass",    name: "Policy Check",     ms: 8  },
  { id: "cart",        status: "fail",    name: "Cart Verification", ms: 3  },
  { id: "risk",        status: "skipped", name: "Risk Assessment",   ms: null },
  { id: "idempotency", status: "skipped", name: "Replay Protection", ms: null },
  { id: "payment",     status: "skipped", name: "Payment",           ms: null },
]} />
```

- Desktop: horizontal, connected by arrows
- Mobile: vertical stack (§23)
- Each gate: icon (✓ / ✕ / ○) + translated name + ms + short result
- Blocked gate is visually prominent (red border, larger icon)
- Gate names and results come from `statusTranslations.ts` — never backend keys
- Animation: gates light up left-to-right on mount (150–250ms, §24)

**Task 7.9 — `<GateResult />`**

Individual gate tile used inside `<SecurityPipeline />` and `<TransactionDrawer />`.

**Task 7.10 — `<TransactionTable />`**

```tsx
<TransactionTable entries={entries} onRowClick={(entry) => setDrawerOpen(entry)} />
```

Columns: Time | Agent | Action | Amount | Status | Reason  
- Amount: JetBrains Mono, right-aligned
- Status: `<StatusBadge />` — icon + text, never color only
- Reason: short human label from `statusTranslations.ts`
- New row insertion: brief highlight animation (§21)
- Hover row: border emphasis, 150ms
- Click: opens `<TransactionDrawer />`
- Empty state: "No transactions yet. Use the Attack Simulator to generate your first request."
- Table remains readable at 200% zoom (§22)
- Horizontally scrollable on mobile (§23)

**Task 7.11 — `<TransactionDrawer />`**

Right-panel drawer (full-screen on mobile) showing complete decision trail for one transaction.

Sections:
1. **Decision header** — `<StatusBadge />`, amount (Mono), agent ID (Mono), timestamp
2. **Original request** — `"Buy running shoes for ₹9,999"` (the raw_input, human-readable)
3. **Why it was blocked** — headline + full explanation from `statusTranslations.ts`. Includes: "**No money was moved.**" for all blocked states
4. **What you can do next** — `nextStep` from translation map
5. **Security Pipeline** — `<SecurityPipeline />` showing each gate's result
6. **Advanced: Audit Record** (collapsible by default) — shows hash (Mono, truncated with copy button), entry ID, timestamp. Labeled "Technical Details" so non-technical users skip it naturally.

Rules:
- Never show raw backend JSON in the default view
- Never show snake_case key names (e.g., `cart_integrity_failure`) in the rendered UI
- `money_moved` field always rendered explicitly for blocked states
- Keyboard accessible: Escape closes drawer, focus trap while open (§22)

**Task 7.12 — `<PolicyCard />`**

Displays one policy rule in human-readable format:
```
Maximum per transaction    ₹7,000
Daily spending limit       ₹15,000
Approval required above    ₹5,000
Max requests per minute    5
Allowed categories         Footwear, Groceries, Electronics accessories
```
- Values in INR (converted from paise by API client, never shown as paise)
- Categories: sentence-case, comma-separated — NOT the internal `electronics-accessories` key
- Highlighted border on the rule that caused a block (receives optional `highlightRule` prop)

**Task 7.13 — `<AgentSpendCard />`**

```tsx
<AgentSpendCard
  agentId="AgentBot-001"
  spendInr={8200}
  dailyCapInr={15000}
  requestsToday={12}
  blockedToday={3}
/>
```

- Horizontal progress bar, color shifts red when > 80% of cap
- Progress bar also has `aria-valuenow`, `aria-valuemax`, `aria-label` (§22)
- Shows: spend / cap, requests today, blocked today, "current status" (Active / Limit Reached)

**Task 7.14 — `<BlockReasonChart />`**

Horizontal bar chart (Recharts). Uses semantic colors only — no rainbow palette (§16).
- Labels: translated human labels, not backend snake_case
- Empty state: "No blocked requests to analyze. Run Attack Simulator scenarios to populate this chart."

**Task 7.15 — `<AuditEntry />`**

Single audit log row. Shows:
- Entry ID (Mono)
- Decision badge (`<StatusBadge />`)
- Agent ID (Mono)
- Amount (Mono)
- Timestamp (Mono)
- Hash: first 8 chars + `...` + last 4 chars (Mono, with copy button)
  - Labeled "Entry fingerprint" — not "hash" in the primary label, which goes in the Advanced section

**Task 7.16 — `<AuditChain />`**

List of `<AuditEntry />` components with hash linking. Shows:
- Chain status banner: "✓ Chain intact — N entries verified" (green) or "✕ Possible tampering at entry N" (red)
- `<VerifyChainButton />`

**Task 7.17 — `<VerifyChainButton />`**

Terminal-style verification UI (§13):
1. Click → button becomes "Verifying…" with progress indicator
2. Output appears line-by-line in a `<pre>` terminal panel:  
   ```
   > Connecting to audit service...
   > Loading entries...
   > Verifying entry 1,281...
   > Verifying entry 1,282...
   > ...
   ✓ Chain intact — 1,284 entries verified
   ```
3. If tampered: `✕ Chain broken at entry 823 — Possible tampering detected`
4. Human explanation below terminal: "Every approved and blocked decision has been recorded and verified. The record has not been modified."

**Task 7.18 — `<AttackSimulator />` + `<AttackScenario />`**

See Stage 7 (Attack Simulator page). Shared components used on both landing page preview and dashboard.

**Task 7.19 — `<SystemHealth />`**

```tsx
<SystemHealth services={[
  { name: "AgentGuard API",    status: "operational" },
  { name: "AI Intent Parser",  status: "operational" },
  { name: "Policy Engine",     status: "operational" },
  { name: "Audit Service",     status: "operational" },
  { name: "Razorpay (Test)",   status: "operational" },
]} />
```

- Status labels: "Operational" / "Degraded" / "Offline" (NOT internal enum values)
- Icon + text per row — never color alone (§22)
- `Degraded` → yellow `!` icon
- `Offline` → red `✕` icon

**Task 7.20 — `<AppShell />`, `<Sidebar />`, `<Topbar />`**

`<AppShell />`: wraps all dashboard pages with sidebar + topbar layout.

`<Sidebar />`:
```
[Shield icon] AgentGuard
──────────────────────
Overview
Transactions
Agents
Policies
Audit Chain
Attack Simulator
Settings
```
- Active item: purple left border + `var(--accent)` text
- Collapsible on tablet (768–1279px)
- Compact drawer on mobile (<768px)
- Keyboard navigable (§22)

`<Topbar />`:
- Left: current page title
- Right: `● LIVE` pulse indicator + `Verify Chain` quick-action button
- `LIVE` dot is green when API is reachable, gray when not (with text label "Live" / "Offline")
- Time range selector (stub for MVP: "Last 24 hours" dropdown, non-functional)

**Acceptance criteria (Stage 2)**:
- [ ] All 18 components render without error in isolation
- [ ] No component renders a raw backend status string (snake_case)
- [ ] `<StatusBadge />` always renders icon + text, never just a colored dot
- [ ] `<TransactionDrawer />` shows "No money was moved" for every blocked state
- [ ] All interactive components are keyboard accessible with visible focus states
- [ ] `<SecurityPipeline />` is horizontal ≥1280px, vertical <768px

---

### Stage 3: Landing Page

**Route:** `/`  
**File:** `frontend/src/pages/LandingPage.tsx`

Implements all 11 sections in the exact order from §25.

#### Section 3.1 — Navbar

```
[Shield] AgentGuard    Overview  Security  How it Works  Audit    [Open Dashboard →]
```

- Sticky on scroll
- Background becomes `var(--surface)` with border when scrolled past hero
- "Open Dashboard" → `navigate('/dashboard')`
- All nav links smooth-scroll to section anchors
- Mobile: hamburger menu with slide-in drawer

**Copy:** No developer language. "Overview", "Security", "How it Works", "Audit" — plain user-facing section names.

#### Section 3.2 — Hero

Headline: **"AI can shop. AgentGuard decides what it's allowed to buy."**

Supporting copy: *"AgentGuard is the authorization firewall between AI agents and payment infrastructure. It converts natural-language intent into bounded authorization, verifies every transaction, and blocks unauthorized spending before money moves."*

CTAs:
- Primary: `Open Security Dashboard` → `/dashboard`
- Secondary: `View Architecture` → scroll to Architecture section

**Hero Visual** — animated pipeline (Framer Motion):
```
┌─────────────────┐
│    AI AGENT     │
│  "Buy shoes     │
│   under ₹7k"   │
└────────┬────────┘
         ↓  (animated arrow)
┌─────────────────────────┐
│      AGENTGUARD         │
│  ✓ Policy               │
│  ✓ Cart Integrity       │
│  ✓ Risk Assessment      │
│  ✓ Replay Protection    │
└────────┬────────────────┘
         ↓  (animated arrow)
   ┌───────────────┐
   │   RAZORPAY    │
   └───────────────┘
```

- Gates appear sequentially with 200ms delay each
- On loop: one gate briefly turns red to show blocking behavior, then resets
- No decorative particles, no large illustrations (§1)

#### Section 3.3 — Security Metrics (live)

Four `<MetricCard />` components populated from `GET /api/v1/audit` + `POST /api/v1/audit/verify`:

1. **Total Requests** — count of audit entries
2. **Blocked Attempts** — count where final_decision = blocked + "X% of requests"
3. **Adversarial Tests Blocked** — count from attack simulator (blocked)
4. **Audit Chain** — `✓ INTACT` or `✕ BROKEN` + N entries verified

These are real live numbers, not mocked.

Loading state: skeleton placeholders (§21).

#### Section 3.4 — Live Transaction Activity Preview

`<TransactionTable />` showing the latest 5 entries from `GET /api/v1/audit`.  
Labeled: **"Live Transaction Activity"** with `● LIVE` badge.  
Clicking a row opens `<TransactionDrawer />`.

#### Section 3.5 — Security Gates

Section title: **"Every purchase passes 5 security checks"**

Show all 5 gates as cards in a grid:

| Gate | Label | Plain-English description |
|---|---|---|
| Policy | **Policy Limits** | Checks the purchase amount, category, and daily spending against your configured rules. |
| Cart | **Cart Integrity** | Verifies the items and prices haven't changed between authorization and payment. |
| Risk | **Anomaly Detection** | Flags purchases that deviate significantly from normal patterns. |
| Idempotency | **Replay Protection** | Blocks duplicate requests to prevent the same purchase from being processed twice. |
| Payment | **Payment Execution** | Sends an authorized payment request to Razorpay — only if all four checks pass. |

**Copy rule:** Gate descriptions must be written for a non-technical business owner. No mention of SHA-256, hash comparison, idempotency keys, or database lookups.

#### Section 3.6 — Attack Simulator Preview

Section title: **"See what AgentGuard blocks"**  
Subtitle: *"Common AI-commerce attacks — defeated in real time."*

Show 3 `<AttackScenario />` cards (read-only, no Run Attack button on landing page):
1. Exceed Spend Limit
2. Cart Tampering
3. Replay Attack

Each card shows: attack type name, plain-English description, expected result with translated block reason.

CTA: `Try the Attack Simulator →` → `/dashboard/attack`

#### Section 3.7 — Audit Chain

Section title: **"Every decision is permanently recorded"**  
Subtitle: *"AgentGuard maintains a tamper-evident log of every purchase decision — allowed or blocked. You can verify the full record hasn't been modified at any time."*

Show `<AuditChain />` with last 5 entries (live from API).  
`<VerifyChainButton />` fully functional.

Technical detail (hashes) visible but visually secondary — labeled "Entry fingerprint" in small mono text.

#### Section 3.8 — Policy Center Preview

Section title: **"You decide the rules. AgentGuard enforces them."**

Show `<PolicyCard />` (live from `GET /api/v1/policy`) in read-only mode.

Explain what each limit means in plain English beneath each value.

#### Section 3.9 — Architecture

Section title: **"How it works"**

Show the LLM boundary diagram from §19:

```
AI / LLM                         DETERMINISTIC ENGINE
──────────────────               ──────────────────────────
Understands intent               Policy limits
Explains decisions               Cart integrity
       ↓                         Risk rules
  Structured data                Replay protection
       ↓                         Payment execution
                                 Audit chain
```

Two columns, separated by a vertical line. This is the core differentiator diagram.

Plain-English caption: *"The AI understands what the agent wants to buy — in plain English. AgentGuard's deterministic policy engine decides whether it's allowed. The two systems never overlap."*

#### Section 3.10 — Callout Block

Full-width dark panel:

> **"The LLM explains. The policy engine decides."**

Subtext: *"Natural language is not a security boundary. AgentGuard enforces machine-readable, verifiable policy — not AI-generated approval."*

#### Section 3.11 — CTA

Section title: **"Ready to control what your AI agents can buy?"**

Primary CTA: `Open Security Dashboard →`  
Secondary CTA: `View on GitHub →` (link to repository)

**Acceptance criteria (Stage 3)**:
- [ ] All 11 sections render in correct order
- [ ] Live metrics (cards, transaction table, audit chain) populate from real API
- [ ] Hero pipeline animation runs on load and loops without jarring transitions
- [ ] Navbar scroll-spy highlights correct section
- [ ] Mobile: all sections readable in single-column layout
- [ ] No snake_case backend strings visible in rendered HTML
- [ ] "Open Dashboard" CTA navigates to `/dashboard`
- [ ] All `<TransactionDrawer />` opens show translated reason + "No money was moved" copy
- [ ] Verify Chain button on landing page works end-to-end

---

### Stage 4: Dashboard Shell & Navigation

**Route:** `/dashboard/*`  
**File:** `frontend/src/layouts/DashboardShell.tsx`

- `<AppShell />` with `<Sidebar />` (240px) + `<Topbar />` + `<Outlet />`
- `● LIVE` indicator polls `GET /health` every 5s
- `Verify Chain` in topbar → triggers `<VerifyChainButton />` modal

**Acceptance criteria (Stage 4)**:
- [ ] Sidebar navigation between all 7 pages works
- [ ] Active nav item shows purple accent indicator
- [ ] `LIVE` indicator goes gray if API unreachable, with text "Offline"
- [ ] Sidebar collapses to icon-only at 768–1279px
- [ ] Mobile: sidebar becomes bottom sheet drawer

---

### Stage 5: Overview Page

**Route:** `/dashboard`  
**File:** `frontend/src/pages/OverviewPage.tsx`

This is the **golden demo screen** (§29).

Layout:
```
[4 MetricCards — full width]

[TransactionTable 60%] | [SecurityPipeline of latest blocked tx 40%]

[AttackSimulator preview] | [AuditChain status + VerifyChain button]
```

- `<MetricCard />` × 4: Total, Allowed, Blocked, Chain Status (live)
- `<TransactionTable />` — latest 20, click → `<TransactionDrawer />`
- `<SecurityPipeline />` — shows the pipeline of the most recently clicked/selected transaction
  - Default: shows the most recent blocked transaction's pipeline
- Mini `<AttackSimulator />` — shows 3 scenario cards with "Run Attack" buttons
- Mini `<AuditChain />` — chain status + Verify Chain button

Auto-refresh every 3 seconds (poll API).

**Acceptance criteria (Stage 5)**:
- [ ] Renders the "golden demo screen" layout from §29
- [ ] All metrics are live (not mocked)
- [ ] Clicking a transaction row updates the SecurityPipeline panel
- [ ] Verify Chain button works
- [ ] Skeleton states show during initial load

---

### Stage 6: Transactions Page

**Route:** `/dashboard/transactions`  
**File:** `frontend/src/pages/TransactionsPage.tsx`

Full-page transaction log with search and filter.

Components:
- `<TransactionTable />` — paginated, 50 per page
- Filter bar: filter by decision (All / Approved / Blocked), by agent, by date
- `<TransactionDrawer />` opens on row click

Empty state copy: *"No transactions have been recorded yet. Start the AgentGuard server and send a purchase request to see activity here."*

**Acceptance criteria (Stage 6)**:
- [ ] Pagination works (Previous / Next)
- [ ] Filter by decision updates the table without page reload
- [ ] `<TransactionDrawer />` shows full decision trail with translated reason
- [ ] Table is horizontally scrollable on mobile

---

### Stage 7: Attack Simulator Page

**Route:** `/dashboard/attack`  
**File:** `frontend/src/pages/AttackSimulatorPage.tsx`

This is one of the highest-value demo interactions (§12).

**Section header:**
- Title: "Attack Simulator"
- Subtitle: *"Test whether AgentGuard blocks common AI-commerce authorization attacks."*

**Scenarios — 3 cards + 2 additional:**

| # | Scenario name | Plain-English description | Attack parameters |
|---|---|---|---|
| 1 | **Over Spending Limit** | *"The AI agent tries to buy something that costs more than its authorized limit."* | `raw_input: "buy running shoes for 9999"` |
| 2 | **Unauthorized Category** | *"The AI agent tries to purchase an item type it isn't authorized to buy."* | `raw_input: "buy jewellery for 3000"` |
| 3 | **Replay Attack** | *"The AI sends the same purchase request twice, trying to charge the card again."* | Same idempotency key, second POST |
| 4 | **Daily Limit Breach** | *"The AI tries to exceed the maximum spending allowed in a single day."* | `raw_input: "buy groceries for 14999"` (after earlier spend) |
| 5 | **Human Approval Required** | *"The AI tries to approve a large purchase without human confirmation."* | `raw_input: "buy running shoes for 6000"` |

**Each `<AttackScenario />` card:**
- Name + description
- Attack parameters shown as plain English (NOT as raw JSON)
- `[ Run Attack ]` button
- Result panel (hidden until run)

**`[ Run Attack ]` flow (§12):**
1. Button → "Sending request…" state
2. Show `<SecurityPipeline />` animating left-to-right (gates lighting up)
3. Pipeline stops at the failing gate (red, 300ms pause)
4. Result banner: `✕ Blocked — [translated reason]` (full explanation from `statusTranslations.ts`)
5. "What happened": plain-English summary — never raw JSON
6. "No money was moved." displayed explicitly for all blocked results
7. "View in Audit Log →" link to Audit Chain page

All 5 scenarios are expected to be blocked. The plan should note: if an "Over Spending Limit" request does NOT get blocked (e.g., amount ≤ 5,000 INR + under policy caps), the copy must handle that gracefully — not crash or show a confusing "allowed" result as a bug.

**Acceptance criteria (Stage 7)**:
- [ ] All 5 scenarios available as cards
- [ ] "Run Attack" actually calls `POST /api/v1/intents`
- [ ] Gate animation plays and stops at the correct failing gate
- [ ] Result displays human-translated block reason — never snake_case
- [ ] "No money was moved" appears for all blocked results
- [ ] Audit log updates after each attack (poll refreshes table)
- [ ] If a scenario unexpectedly passes, it shows "Approved" with the payment link — not a broken state

---

### Stage 8: Agents Page

**Route:** `/dashboard/agents`  
**File:** `frontend/src/pages/AgentsPage.tsx`

- List of agents from `GET /api/v1/agents/:id/spend` (discover from audit log)
- Each agent: `<AgentSpendCard />` with spend / cap / requests / blocked
- Empty state: *"No agent activity yet. Purchase requests will appear here when agents start sending requests."*

**Acceptance criteria (Stage 8)**:
- [ ] Agent list populates from real API data
- [ ] `<AgentSpendCard />` progress bar updates correctly
- [ ] Red color + "Limit Reached" label when agent hits 100% of daily cap — with text label, not color alone

---

### Stage 9: Policies Page

**Route:** `/dashboard/policies`  
**File:** `frontend/src/pages/PoliciesPage.tsx`

- Live `<PolicyCard />` from `GET /api/v1/policy`
- Plain-English explanation for every policy field
- "Last updated" timestamp
- Policy Hash shown in collapsible "Advanced" section (JetBrains Mono)
- Empty state: *"Unable to load policy configuration. Check that the AgentGuard server is running."*

**Acceptance criteria (Stage 9)**:
- [ ] All policy values display in INR (not paise)
- [ ] Category names are human-readable ("Footwear", not "footwear" or "electronics-accessories")
- [ ] Policy hash is in collapsible "Advanced Details" section — not in main view
- [ ] Plain-English explanation exists for every displayed field

---

### Stage 10: Audit Chain Page

**Route:** `/dashboard/audit`  
**File:** `frontend/src/pages/AuditChainPage.tsx`

Full audit ledger view (§13):
- Chain status banner: `✓ Chain intact — N entries verified` (or `✕ Possible tampering`)
- `<VerifyChainButton />` — full terminal animation
- Paginated `<AuditChain />` list — newest first
- Each `<AuditEntry />` shows: decision, agent, amount, time
- Hashes in "Entry fingerprint" (secondary / mono) — not the primary label
- Clicking an entry → `<TransactionDrawer />`

**Acceptance criteria (Stage 10)**:
- [ ] Verify Chain runs `POST /api/v1/audit/verify` and shows terminal animation
- [ ] "Chain intact" message in plain English below the terminal output
- [ ] Hashes visible but visually secondary (small mono, labeled "Entry fingerprint")
- [ ] Pagination loads correctly
- [ ] Chain broken state shows `✕` + plain-English explanation of what this means (not technical jargon)

---

### Stage 11: Settings Page

**Route:** `/dashboard/settings`  
**File:** `frontend/src/pages/SettingsPage.tsx`

Minimal MVP page:
- `<SystemHealth />` component (live health checks)
- API endpoint configuration (display only — shows `http://localhost:8000`)
- Version info: "AgentGuard v1.0.0"
- Groq model info: "AI Intent Parser: Qwen 27B via Groq" (human name, not model ID string)

**Acceptance criteria (Stage 11)**:
- [ ] `<SystemHealth />` shows real status from `GET /health`
- [ ] All service names use human-readable labels ("AI Intent Parser", not "qwen/qwen3.6-27b")
- [ ] No internal service names, environment variables, or model IDs visible

---

### Stage 12: Responsive & Accessibility Pass

Final pass across every page and component.

**Responsive checklist (§23):**

| Breakpoint | Requirement |
|---|---|
| ≥1280px | Sidebar visible, 4 metric cards in a row, horizontal pipeline, multi-column sections |
| 768–1279px | Sidebar collapsible (icon-only), 2-column metrics, stacked charts, scrollable tables |
| <768px | Bottom nav / compact drawer, single-column layout, vertical pipeline, drawer full-screen |

**Accessibility checklist (§22), applied to every page:**

- [ ] WCAG AA contrast ratio on all text (minimum 4.5:1 for body)
- [ ] All interactive elements reachable by keyboard (Tab order logical)
- [ ] Visible focus ring on all focusable elements (`outline: 2px solid var(--accent)`)
- [ ] `<StatusBadge />` always icon + text — never color alone
- [ ] `<SecurityPipeline />` gate icons have `aria-label` (e.g., `aria-label="Policy Check: Passed"`)
- [ ] `<TransactionDrawer />` has focus trap and closes on Escape
- [ ] `<TransactionTable />` has proper `<thead>` with `scope="col"` headers
- [ ] `<AgentSpendCard />` progress bar has `role="progressbar"`, `aria-valuenow`, `aria-valuemax`, `aria-label`
- [ ] All charts have text alternatives (screen-reader accessible summary below chart)
- [ ] Tables remain readable at 200% browser zoom (no horizontal clip of critical columns)
- [ ] All buttons have descriptive `aria-label` (not just icon-only)

**Animation checklist (§24):**

- [ ] All transitions: 150–250ms
- [ ] `prefers-reduced-motion` media query respected — all Framer Motion animations disabled when set
- [ ] No constant pulsing (the `● LIVE` indicator is the only repeating animation, 2s pulse)
- [ ] No particle backgrounds or decorative motion

---

## Validation Strategy

```bash
# 1. Start backend
uvicorn agentguard.api.main:app --port 8000

# 2. Start frontend
cd frontend && npm run dev

# 3. Manual acceptance walkthrough in browser at http://localhost:5173

# 4. Resize to 768px and <768px — verify responsive layouts
# 5. Tab through entire page — verify keyboard nav works
# 6. Browser zoom to 200% — verify tables and pipeline readable
# 7. Run all 5 attack scenarios — verify animation + block reason translation
# 8. Click Verify Chain — verify terminal animation + plain-English result
```

---

## Acceptance Criteria (Phase 7 Complete)

### Landing Page
- [ ] All 11 sections render in correct order (§25)
- [ ] Hero pipeline animation runs and loops
- [ ] Live metrics populate from API — no mocked data
- [ ] All block reason text is translated from backend values
- [ ] Mobile layout: single-column, all content accessible

### Dashboard
- [ ] Golden demo screen (§29) matches the design spec layout exactly
- [ ] All 7 navigation pages load without error
- [ ] All live data polled from API every 3 seconds
- [ ] Attack Simulator: 5 scenarios, each triggers real API call, animates correctly
- [ ] Verify Chain: terminal animation, plain-English result
- [ ] Transaction Drawer: full decision trail, translated reason, "No money was moved" for all blocked states

### Status Translation
- [ ] Zero snake_case backend strings visible in rendered DOM (inspect element verification)
- [ ] Every blocked decision shows a user-readable explanation
- [ ] "No money was moved" appears for every blocked state in the drawer

### Accessibility
- [ ] All Status indicators: icon + text (never color alone)
- [ ] All interactive elements keyboard accessible
- [ ] Visible focus rings on all focusable elements
- [ ] Tables readable at 200% zoom

### Responsive
- [ ] All pages functional at 1440px, 1024px, 768px, 375px

---

## Deliverables

```
frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts                    # Typed API client
│   │   └── statusTranslations.ts     # Status/reason translation map (MUST DO FIRST)
│   ├── components/
│   │   ├── StatusBadge.tsx
│   │   ├── MetricCard.tsx
│   │   ├── SecurityPipeline.tsx
│   │   ├── GateResult.tsx
│   │   ├── TransactionTable.tsx
│   │   ├── TransactionDrawer.tsx
│   │   ├── PolicyCard.tsx
│   │   ├── AgentSpendCard.tsx
│   │   ├── BlockReasonChart.tsx
│   │   ├── AuditEntry.tsx
│   │   ├── AuditChain.tsx
│   │   ├── VerifyChainButton.tsx
│   │   ├── AttackSimulator.tsx
│   │   ├── AttackScenario.tsx
│   │   └── SystemHealth.tsx
│   ├── layouts/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── OverviewPage.tsx
│   │   ├── TransactionsPage.tsx
│   │   ├── AgentsPage.tsx
│   │   ├── PoliciesPage.tsx
│   │   ├── AuditChainPage.tsx
│   │   ├── AttackSimulatorPage.tsx
│   │   └── SettingsPage.tsx
│   ├── index.css                     # Design tokens + global styles
│   └── main.tsx                      # Router setup
├── vite.config.ts                    # API proxy config
├── tailwind.config.js
└── package.json
```

---

## Documentation Updates

- `README.md`: Add "Running the Frontend" section with `npm run dev` command
- `BUILD_LOG.md`: Note which attack scenarios were tested and confirmed blocked
- Note that `statusTranslations.ts` is the single source of truth for all user-facing copy
