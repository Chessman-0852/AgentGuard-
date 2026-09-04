# AgentGuard — Phase 7 · Frontend Build (Clean & Minimal)

`🟢 In Progress` &nbsp;·&nbsp; `⏱ 5 hours` &nbsp;·&nbsp; `📅 Day 2, second block` &nbsp;·&nbsp; `🔗 Depends on Phase 6`

Build the complete AgentGuard frontend — a public **Landing Page** and a multi-page **Security Command Center** — that communicates the product value in under 10 seconds, with zero technical jargon on the primary view.

> **Core Philosophy:** *The LLM explains. The policy engine decides.*  
> This is a high-assurance commerce firewall for autonomous AI agents. The main dashboard highlights high-signal activity at a glance. Deeper cryptographic proofs, JSON payloads, and internal latencies are tucked cleanly into clickable drawers, modals, and dedicated inspection pages.

---

## At a Glance

| 📄 Pages | 🧩 Components | 🏗️ Architecture | 🎨 Visual Style | 🔄 Polling |
|:---:|:---:|:---:|:---:|:---:|
| 8 | 15 shared | Vite · React (TS) · Tailwind | Obsidian Shell + Neon Pulse | 3s live polling |

### Route Directory

| Route | Page Name | Primary Objective |
|---|---|---|
| `/` | Landing Page | Public story, animated 6-stage pipeline, architecture callout |
| `/dashboard` | **Overview** *(Golden Demo)* | High-signal Agentic Activity console, 5 stat cards, swimlane feed, 6-gate pipeline, attack sim, audit status |
| `/dashboard/transactions` | Transactions | Clean essential ledger with clickable detail drawers |
| `/dashboard/attack` | Attack Simulator | One-click adversarial scenarios (Spend cap, Unauthorized category, Replay, etc.) |
| `/dashboard/audit` | Audit Chain | Cryptographic hash chain ledger + live in-browser verification |
| `/dashboard/policies` | Policy Center | Plain-English spending caps, allowed merchants & categories |
| `/dashboard/agents` | Agent Controls | Daily spending progress, request rates, per-agent caps |
| `/dashboard/settings` | System Health | Live API health, model guardrail status, active configuration |

---

## 🎨 Visual System & Tokens (Obsidian Command Console)

Inspired by `08-design.md` and the *Agentic Activity* neon console design reference.

### Color Palette

| Token | Hex Value | Role & Meaning |
|---|---|---|
| `--color-obsidian-shell` | `#132322` | Primary page & card surface; deep dark teal-obsidian |
| `--color-deep-abyss` | `#0e1a19` | Main page background canvas; maximum contrast void |
| `--color-charcoal` | `#070f0f` | Deepest surface for modals, code drawers, and overlays |
| `--color-border` | `#1e3835` | Hairline borders, dividers, subtle card frames |
| `--color-neon-pulse` | `#3ddc91` | Vivid green live action; primary status, toggle switch, pass state |
| `--color-mint-whisper` | `#97ddbc` | Soft green wash for badges and highlight backgrounds |
| `--color-danger` | `#ef4444` | Policy violation alert; glowing red card, blocked state |
| `--color-signal-yellow` | `#ffcd48` | Flagged advisory warnings; human review required |
| `--color-text-primary` | `#ffffff` | Primary headings, large metrics, active labels |
| `--color-text-secondary` | `#828786` | Subtitles, metadata, tracked eyebrow labels |

### Golden Typography & Hierarchy

- **Display & Headings:** `AeonikFono` (Fallback: `Inter Display` / `Inter`, 500 weight)
  - Page titles: 32px – 40px with subtle green glow
  - Eyebrow labels: 9px – 11px uppercase with `0.05em` letter spacing
- **Body & UI:** `Aeonik` (Fallback: `Inter`, 400 weight, -0.08px letter spacing)
- **Monospace & Data:** `JetBrains Mono` (Amounts in ₹, transaction IDs, hashes)

### Radii & Spacing

- **Cards:** 20px (`rounded-[20px]`)
- **Pills & Buttons:** 56px (`rounded-full`)
- **Small Badges & Elements:** 10px (`rounded-lg`)
- **Atmosphere:** Generous whitespace, luminance layering over heavy drop shadows.

---

## 🧭 The 6-Stage Security Pipeline

Every autonomous purchase intent flows strictly through 6 deterministic checkpoints:

```text
[ 1. Intent ] ──> [ 2. Policy ] ──> [ 3. Cart ] ──> [ 4. Risk ] ──> [ 5. Replay ] ──> [ 6. Payment ]
```

1. **Intent Analysis:** Natural language parsed into typed purchase intent by AI model.
2. **Policy Check:** Hard mathematical validation of per-transaction & daily caps and merchant whitelist.
3. **Cart Verification:** HMAC SHA-256 cart integrity check ensuring item price or contents weren't modified.
4. **Risk Assessment:** Velocity anomaly and adversarial prompt detection.
5. **Replay Protection:** 15-minute deterministic idempotency cache preventing double-charges.
6. **Payment Execution:** Razorpay test-mode execution with cryptographic reference tracking.

---

## 🖥️ Overview Screen Architecture (The Golden Demo)

Inspired by the provided *Agentic Activity* UI reference:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Agentic Activity                                                    [ ● LIVE Monitor ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐  │
│  │ 🤖 Agents │  │ 🧠 Models │  │ 🖥️ MCP     │  │ 🛡️ Passed │  │ 🚨 Violations (Red)   │  │
│  │    247    │  │    12     │  │    38     │  │   1,188   │  │         17            │  │
│  │ Active    │  │ Approved  │  │ Connected │  │ Approved  │  │ Blocked Today         │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────────────────┘  │
│                                                                                        │
│  RECENT ACTIVITY                                                                       │
│  🔴 BLOCKED   [■■■■]  [■■■]  [■■■■■]  [■■]                              17 blocked     │
│  🟡 FLAGGED   [■■]    [■■■■]                                             2 review      │
│  🟢 LOGGED    [■■■■■] [■■■■] [■■■]   [■■■■■■]                           128 approved   │
│                                                                                        │
│  SECURITY INTERCEPTION PIPELINE                                                        │
│  [ ✓ Intent ] ──> [ ✕ Policy ] ──> [ — Cart ] ──> [ — Risk ] ──> [ — Replay ] ──> [ — ] │
│                                                                                        │
│  LIVE TRANSACTIONS (Essential Only)                      AUDIT CHAIN & ATTACK SUITE    │
│  ┌─────────────────────────────────────────────────────┐ ┌───────────────────────────┐ │
│  │ 16:20  AgentBot  Nike Pegasus  ₹9,999  ✕ BLOCKED    │ │ ✓ CRYPTOGRAPHIC CHAIN     │ │
│  │ 16:18  Claude    Groceries     ₹2,400  ✓ ALLOWED    │ │ Status: 1,284 Intact      │ │
│  │ 16:15  AutoDev   AWS Credits   ₹4,500  ✓ ALLOWED    │ │ [ Verify Chain Now ]      │ │
│  │ 16:12  AgentBot  Jewellery     ₹1,500  ✕ BLOCKED    │ │                           │ │
│  │ (Click any row to open Technical Detail Drawer)     │ │ ATTACK SIMULATOR          │ │
│  └─────────────────────────────────────────────────────┘ │ [ Spend ] [ Cart ] [ Replay]│ │
│                                                          └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Status Translation & Technical Isolation Rule

1. **Zero Snake Case:** Backend terms like `category_not_allowed` or `replay_detected` never appear in the main UI. All terms map through `statusTranslations.ts` to clear, non-technical English.
2. **Isolation of Heavy Data:**
   - On the main page: Show only Agent, Request Action, Amount (₹), and Status Badge (✓ Approved / ✕ Blocked).
   - In the clickable `TransactionDrawer`: Show the full cryptographic hash, entry ID, raw timestamps, exact failure explanation ("No money was moved"), and actionable next steps.

---

## 📦 Deliverables & Implementation Checklist

- [x] **Design Tokens & Theme:** Configured in `frontend/src/index.css` and `frontend/tailwind.config.js`.
- [x] **Status Translation:** 6-gate model and human explanations in `frontend/src/lib/statusTranslations.ts`.
- [x] **Security Pipeline:** 6-stage interactive component in `frontend/src/components/SecurityPipeline.tsx`.
- [x] **Metric Cards:** 20px rounded cards with glowing circular icon pills and dedicated alert card style in `frontend/src/components/MetricCard.tsx`.
- [x] **Overview Page:** Clean, minimal high-signal dashboard with swimlane activity visualizer in `frontend/src/pages/OverviewPage.tsx`.
- [x] **Technical Detail Drawer:** Deep audit inspection isolated cleanly in `frontend/src/components/TransactionDrawer.tsx`.
- [x] **Responsive Shell:** Obsidian command console in `frontend/src/layouts/AppShell.tsx`.
