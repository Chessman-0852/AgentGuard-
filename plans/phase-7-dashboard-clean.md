# AgentGuard — Phase 7 · Frontend Build

`🔴 Not started` &nbsp;·&nbsp; `⏱ 5 hours` &nbsp;·&nbsp; `📅 Day 2, second block` &nbsp;·&nbsp; `🔗 Depends on Phase 6`

Build the complete AgentGuard frontend — a public **Landing Page** and a multi-page **Security Dashboard** — that tells the whole product story in under 10 seconds, with zero technical jargon.

> **Design principle:** *The LLM explains. The policy engine decides.*
> This isn't a developer tool — every label, state, and message must read clearly to a non-technical business owner. Backend terms never reach the screen.

---

## At a Glance

| 📄 Pages | 🧩 Components | 🏗️ Build Stages | 🎨 Stack | 🔄 Data |
|:---:|:---:|:---:|:---:|:---:|
| 8 | 15 shared | 12 | React · Vite · Tailwind · shadcn/ui | Poll every 3s |

| Stage | Focus | Route |
|---|---|---|
| 1 | Project scaffolding | — |
| 2 | Shared component library | — |
| 3 | Landing page (11 sections) | `/` |
| 4 | Dashboard shell & nav | `/dashboard/*` |
| 5 | Overview page ⭐ golden demo | `/dashboard` |
| 6 | Transactions page | `/dashboard/transactions` |
| 7 | Attack Simulator | `/dashboard/attack` |
| 8 | Agents page | `/dashboard/agents` |
| 9 | Policies page | `/dashboard/policies` |
| 10 | Audit Chain page | `/dashboard/audit` |
| 11 | Settings page | `/dashboard/settings` |
| 12 | Responsive & accessibility pass | all pages |

---

## 🎨 Design System

> **Note:** fonts below follow the *Sauce Labs* style reference (`DESIGN.md`). Functional status colors (green/red/yellow/blue) are kept from the original spec since they carry security meaning — swapping them would break the "never rely on color alone" rule.

### Fonts

| Role | Typeface | Fallback | Used for |
|---|---|---|---|
| Headings & display | **AeonikFono** (500) | Inter Display | Page titles, section headers, eyebrow labels |
| Body & UI text | **Aeonik** (400) | Inter | Paragraphs, buttons, nav, form fields, table text |
| Data & identifiers | **JetBrains Mono** | — | Amounts, hashes, agent IDs, timestamps |

### Color tokens

| Token | Value | Meaning |
|---|---|---|
| `--bg` | `#080B14` | Page background |
| `--surface` | `#11161D` | Card background |
| `--surface-2` | `#161C24` | Nested card background |
| `--border` | `#26303A` | Dividers, card borders |
| `--text-primary` | `#E6E7EB` | Main text |
| `--text-secondary` | `#A1A7B3` | Muted text, captions |
| 🟢 `--success` | `#22C55E` | Allowed · healthy · chain intact |
| 🔴 `--danger` | `#EF4444` | Blocked · policy violation · tampering |
| 🟡 `--warning` | `#F59E0B` | Advisory risk · needs review |
| 🔵 `--info` | `#3B82F6` | Informational states |
| 🟣 `--accent` | `#7C3AED` | Brand elements, selected nav item |

**Golden rule:** status color is never the only signal — always pair color with an icon **and** a text label.

---

## 🧭 Status Translation Layer — do this first

Every task in this doc depends on it. **No raw backend value may ever reach the screen.**

**The problem:** the backend returns internal values like `category_not_allowed`, `cart_integrity_failure`, `replay_detected`. These must never appear in the UI.

**The fix:** one file, `frontend/src/lib/statusTranslations.ts`, is the single source of truth for all user-facing copy. It exports four lookup tables:

| Export | Purpose |
|---|---|
| `DECISION_LABELS` | `allowed` / `blocked` / `pending` → icon + label |
| `BLOCK_REASON_LABELS` | backend reason → short label, headline, plain-English explanation, "was money moved?", next step |
| `GATE_LABELS` | pipeline gate → display name, pass/fail verbs |
| `STATUS_PIPELINE_LABELS` | raw pipeline status → human sentence |

Every block reason (spending cap, wrong category, needs approval, cart changed, duplicate request, daily cap, too many requests, service paused) gets a **headline**, a **plain-English explanation**, and a **next step** — no exceptions.

**Done when:**
- [ ] Every known `block_reason` value is covered
- [ ] Every component that shows a decision, gate result, or reason imports from this file — never the raw backend string
- [ ] Zero snake_case values (e.g. `replay_detected`) appear anywhere in the rendered page

---

## Stage 1 — Project Scaffolding

Set up Vite + React (TypeScript) + Tailwind, install routing/animation/chart libraries, and wire the dev proxy to the FastAPI backend on port 8000.

- **Design tokens** → CSS custom properties in `index.css`, fonts loaded, background/text defaults set
- **API proxy** → `/api`, `/webhooks`, `/health` all forward to `localhost:8000`
- **Routes**

  | Path | Page |
  |---|---|
  | `/` | Landing |
  | `/dashboard` | Overview *(default)* |
  | `/dashboard/transactions` | Transactions |
  | `/dashboard/agents` | Agents |
  | `/dashboard/policies` | Policies |
  | `/dashboard/audit` | Audit Chain |
  | `/dashboard/attack` | Attack Simulator |
  | `/dashboard/settings` | Settings |

- **API client** (`lib/api.ts`) — typed wrapper for every backend call (audit entries, chain verify, agent spend, policy, post intent, health). Every error is translated to plain English before it reaches a component — no raw HTTP codes on screen.

**Done when:**
- [ ] `npm run dev` runs clean on `localhost:5173`
- [ ] Design tokens visible in browser
- [ ] All routes resolve, no 404s
- [ ] `/api/*` proxies correctly

---

## Stage 2 — Shared Component Library

Build every reusable piece once, before any page uses it.

| Component | What it does |
|---|---|
| **`StatusBadge`** | `allowed / blocked / pending` → ✓ Approved / ✕ Blocked / ○ Reviewing. Icon + text always, never color-only. |
| **`MetricCard`** | Label, big number (Mono), trend, subtext. Skeleton loading state, no spinners. |
| **`SecurityPipeline`** | Horizontal (desktop) / vertical (mobile) run of gates, lighting up left-to-right. Failing gate is visually loud (red border, bigger icon). |
| **`GateResult`** | Single gate tile, used inside the pipeline and the transaction drawer. |
| **`TransactionTable`** | Time · Agent · Action · Amount · Status · Reason. New rows highlight briefly; scrollable on mobile; readable at 200% zoom. |
| **`TransactionDrawer`** | Full decision trail for one transaction — see breakdown below. |
| **`PolicyCard`** | One policy rule, human-readable, INR values, sentence-case categories. |
| **`AgentSpendCard`** | Spend vs. cap progress bar (turns red past 80%), requests today, blocked today. |
| **`BlockReasonChart`** | Horizontal bar chart of block reasons, semantic colors only. |
| **`AuditEntry`** | One audit row — decision badge, agent, amount, timestamp, truncated hash with copy button. |
| **`AuditChain`** | List of entries + chain-intact banner + Verify Chain button. |
| **`VerifyChainButton`** | Terminal-style verification animation, line-by-line output. |
| **`AttackSimulator` / `AttackScenario`** | Runs a scenario, animates the pipeline, shows the translated result. |
| **`SystemHealth`** | Live health-check status. |

**`TransactionDrawer` — the six sections, in order**

1. Decision header — badge, amount, agent ID, timestamp
2. Original request, in plain English (*"Buy running shoes for ₹9,999"*)
3. Why it was blocked — headline + explanation + **"No money was moved."**
4. What you can do next
5. Security pipeline for this transaction
6. *Advanced → Technical Details* (collapsed by default) — hash, entry ID, raw timestamp

---

## Stage 3 — Landing Page

11 sections, in order, each pulling **live data** — nothing mocked.

| # | Section | Content |
|---|---|---|
| 1 | Hero | Animated, looping security pipeline |
| 2–6 | Product story | *(see original spec §3.1–§3.6 for exact copy)* |
| 6 | Attack preview | 3 read-only `AttackScenario` cards → CTA to `/dashboard/attack` |
| 7 | **Audit Chain** | *"Every decision is permanently recorded"* — last 5 live entries + working Verify Chain button. Hashes shown small, secondary, labeled "Entry fingerprint" |
| 8 | **Policy Center preview** | Live `PolicyCard`, plain-English meaning under every value |
| 9 | **Architecture** | Two-column diagram — *AI / LLM* (understands intent, explains decisions) vs. *Deterministic Engine* (policy limits, cart integrity, risk, replay protection, payment, audit). Caption: *"The AI understands what the agent wants to buy. AgentGuard's policy engine decides whether it's allowed. The two never overlap."* |
| 10 | **Callout** | *"The LLM explains. The policy engine decides."* — *"Natural language is not a security boundary."* |
| 11 | **CTA** | Primary: *Open Security Dashboard →* · Secondary: *View on GitHub →* |

**Done when:**
- [ ] All 11 sections render in order, live data throughout
- [ ] Hero pipeline animation loops smoothly
- [ ] Navbar scroll-spy tracks the right section
- [ ] Single-column, fully readable on mobile
- [ ] Zero snake_case strings anywhere in the DOM
- [ ] "Open Dashboard" → `/dashboard`; Verify Chain works end-to-end

---

## Stage 4 — Dashboard Shell & Navigation

`AppShell` = `Sidebar` (240px) + `Topbar` + page content. A `● LIVE` indicator polls `/health` every 5s and turns gray + "Offline" if the API is unreachable.

**Done when:**
- [ ] Nav between all 7 dashboard pages works
- [ ] Active item shows the purple accent
- [ ] Sidebar collapses to icons at 768–1279px, becomes a bottom sheet on mobile

---

## Stage 5 — Overview Page ⭐ *(golden demo screen)*

**Route:** `/dashboard`

```
[ 4 Metric Cards — Total · Allowed · Blocked · Chain Status ]

[ Transaction Table (60%) ]   [ Security Pipeline of latest blocked tx (40%) ]

[ Attack Simulator preview ]  [ Audit Chain status + Verify button ]
```

Auto-refreshes every 3 seconds. Clicking any transaction updates the pipeline panel; skeletons show on first load.

---

## Stage 6 — Transactions Page

**Route:** `/dashboard/transactions`

Full paginated log (50/page) with filters by decision, agent, and date. Row click opens the `TransactionDrawer`. Empty state: *"No transactions have been recorded yet."*

---

## Stage 7 — Attack Simulator

**Route:** `/dashboard/attack` — one of the highest-value demo moments.

| # | Scenario | What it tests |
|---|---|---|
| 1 | Over Spending Limit | Purchase above the authorized amount |
| 2 | Unauthorized Category | Item type the agent can't buy |
| 3 | Replay Attack | Same request sent twice |
| 4 | Daily Limit Breach | Exceeds the daily spending cap |
| 5 | Human Approval Required | Large purchase without confirmation |

**Run Attack flow:** button → "Sending request…" → pipeline animates gate-by-gate → stops (red) at the failing gate → result banner with the translated reason → plain-English "what happened" → **"No money was moved."** → link to the audit log.

If a scenario unexpectedly passes, it shows a clean "Approved" state — never a broken one.

---

## Stage 8 — Agents Page

**Route:** `/dashboard/agents` — one `AgentSpendCard` per agent (spend, cap, requests, blocked today). Empty state: *"No agent activity yet."*

---

## Stage 9 — Policies Page

**Route:** `/dashboard/policies`

| Field | Example |
|---|---|
| Maximum per transaction | ₹7,000 |
| Daily spending limit | ₹15,000 |
| Approval required above | ₹5,000 |
| Max requests per minute | 5 |
| Allowed categories | Footwear, Groceries, Electronics accessories |

All values in INR, categories sentence-case. Policy hash lives in a collapsible *Advanced* section — never in the main view. Every field has a plain-English explanation.

---

## Stage 10 — Audit Chain Page

**Route:** `/dashboard/audit` — chain-status banner (✓ intact / ✕ possible tampering), working Verify Chain terminal animation, paginated entry list newest-first. Hashes are visible but secondary ("Entry fingerprint").

---

## Stage 11 — Settings Page

**Route:** `/dashboard/settings` — live `SystemHealth`, API endpoint (display-only), version string, and the AI model shown by human name ("AI Intent Parser") — never a raw model ID.

---

## Stage 12 — Responsive & Accessibility Pass

**Breakpoints**

| Width | Layout |
|---|---|
| ≥ 1280px | Sidebar open, 4-across metric cards, horizontal pipeline |
| 768–1279px | Icon-only sidebar, 2-column metrics, scrollable tables |
| < 768px | Bottom nav, single column, vertical pipeline, full-screen drawer |

**Accessibility checklist**
- [ ] WCAG AA contrast (≥ 4.5:1 body text)
- [ ] Full keyboard reachability, logical tab order, visible focus ring
- [ ] Status always icon + text, never color alone
- [ ] Pipeline gates carry `aria-label`s
- [ ] Drawer traps focus, closes on `Esc`
- [ ] Table headers use `scope="col"`
- [ ] Progress bars expose `role="progressbar"` + `aria-value*`
- [ ] Charts have a text-alternative summary
- [ ] Readable at 200% browser zoom
- [ ] Every icon-only button has a descriptive `aria-label`

**Motion checklist**
- [ ] All transitions 150–250ms
- [ ] `prefers-reduced-motion` disables Framer Motion animation
- [ ] Only the `● LIVE` dot pulses (2s) — no other looping motion, no particle effects

---

## ✅ Phase 7 Complete — Final Checklist

**Landing**
- [ ] All 11 sections in order, live data, working hero animation, mobile-clean

**Dashboard**
- [ ] Overview matches the golden demo layout
- [ ] All 7 pages load without error, polling every 3s
- [ ] Attack Simulator: 5 working scenarios
- [ ] Verify Chain: animated + plain-English result
- [ ] Drawer always shows "No money was moved" on blocked states

**Translation**
- [ ] Zero snake_case strings in the rendered DOM
- [ ] Every blocked decision has a human explanation

**Accessibility & Responsive**
- [ ] Icon + text on every status, full keyboard support, visible focus rings
- [ ] Clean at 1440 / 1024 / 768 / 375px

---

## Deliverables

```
frontend/src/
├── lib/            api.ts · statusTranslations.ts  (build first)
├── components/      15 shared components (see Stage 2)
├── layouts/          AppShell · Sidebar · Topbar
├── pages/             8 pages (see routing table)
├── index.css           design tokens + globals
└── main.tsx              router setup
```

**Docs to update:** `README.md` (Running the Frontend), `BUILD_LOG.md` (attack scenarios tested), and a note that `statusTranslations.ts` is the single source of truth for all user-facing copy.
