# AgentGuard — Dashboard & Landing Page Design Specification

> **Product:** AgentGuard  
> **Positioning:** Agentic Commerce Trust & Policy Gateway — a payment firewall for AI buyers  
> **Design direction:** Dark, minimal, technical, security-first fintech infrastructure  
> **Primary principle:** **The LLM explains. The policy engine decides.**

---

## 1. Design Vision

AgentGuard should feel like infrastructure used by a serious security/fintech engineering team—not a generic AI SaaS dashboard.

The interface must communicate three things immediately:

1. **Control** — AI agents cannot freely spend money.
2. **Verification** — every transaction passes deterministic security gates.
3. **Proof** — every decision is recorded in a tamper-evident audit chain.

The visual language should be:
- Dark-first
- High contrast
- Minimal but information-dense
- Technical without becoming visually complicated
- Similar to modern security operations and fintech infrastructure products

Avoid:
- Excessive gradients
- Large decorative illustrations
- Excessive glassmorphism
- Cartoon AI imagery
- Too many colors
- Marketing-heavy dashboard components

---

## 2. Core User Story

The dashboard should tell this story in under 10 seconds:

```text
AI AGENT
   ↓
Purchase Request
   ↓
AGENTGUARD
   ↓
Policy → Cart → Risk → Replay
   ↓
ALLOW / BLOCK
   ↓
RAZORPAY
   ↓
AUDIT PROOF
```

A judge should be able to understand the product without opening a technical document.

---

## 3. Color System

Use a near-black foundation.

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#080B14` | Main background |
| `--surface` | `#11161D` | Cards/panels |
| `--surface-2` | `#161C24` | Elevated cards |
| `--border` | `#26303A` | Borders/dividers |
| `--text-primary` | `#E6E7EB` | Main text |
| `--text-secondary` | `#A1A7B3` | Secondary text |
| `--success` | `#22C55E` | Allowed / healthy |
| `--danger` | `#EF4444` | Blocked / failure |
| `--warning` | `#F59E0B` | Flagged / advisory |
| `--info` | `#3B82F6` | Information |
| `--accent` | `#7C3AED` | AgentGuard brand accent |

### Color rules

Green:
- Allowed
- Chain intact
- Service healthy

Red:
- Blocked
- Policy violation
- Cart tampering
- Replay detection

Yellow:
- Advisory risk
- Human review
- Warning

Blue:
- Informational states

Purple:
- AgentGuard brand elements and selected navigation

Do not use status colors as decoration. Every status color must communicate meaning.

---

## 4. Typography

### Primary font

Use **Inter**, Geist, or a similar modern sans-serif.

### Technical font

Use **JetBrains Mono** for:
- Intent IDs
- Agent IDs
- Hashes
- API paths
- Policy versions
- Timestamps
- Transaction IDs

### Suggested scale

```text
H1       48px / 56px / 600
H2       32px / 40px / 600
H3       20px / 28px / 600
Body     14px / 22px / 400
Small    12px / 18px / 400
Mono     12–13px
Metric   28–32px / 600
```

---

## 5. Layout

Use a responsive 12-column grid.

```text
Desktop
┌──────────────┬─────────────────────────────────────────────┐
│              │                                             │
│   SIDEBAR    │              MAIN CONTENT                   │
│    240px     │                                             │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

### Desktop

- Sidebar: 240px
- Main content max width: 1440px
- Page padding: 24px
- Card gap: 16–24px

### Tablet

- Collapsible sidebar
- 2-column metric layout
- Stack larger dashboard sections

### Mobile

- Bottom navigation or compact drawer
- Single-column cards
- Horizontally scrollable tables
- Security pipeline becomes vertical

---

# 6. Landing Page

## 6.1 Navbar

```text
[ Shield ] AgentGuard

Overview   Security   How it Works   Audit

                         [ Open Dashboard ]
```

Keep it extremely clean.

---

## 6.2 Hero

### Primary headline

**AI can shop. AgentGuard decides what it's allowed to buy.**

### Supporting copy

AgentGuard is the authorization firewall between AI agents and payment infrastructure. It converts natural-language intent into bounded authorization, verifies every transaction, and blocks unauthorized spending before money moves.

### CTA

Primary:
**Open Security Dashboard**

Secondary:
**View Architecture**

### Hero visual

Show a compact animated pipeline:

```text
┌─────────────┐
│  AI AGENT   │
│             │
│ "Buy shoes  │
│  under ₹7k" │
└──────┬──────┘
       ↓
┌─────────────────────┐
│     AGENTGUARD      │
│                     │
│ ✓ Policy            │
│ ✓ Cart Integrity    │
│ ✓ Risk              │
│ ✓ Replay Protection │
└──────────┬──────────┘
           ↓
     ┌───────────┐
     │ RAZORPAY  │
     └───────────┘
```

---

# 7. Dashboard Information Architecture

Navigation:

```text
Overview
Transactions
Agents
Policies
Audit Chain
Attack Simulator
Settings
```

The most important screens for the MVP are:

1. Overview
2. Transactions
3. Audit Chain
4. Attack Simulator

---

# 8. Dashboard — Overview

## Header

```text
AgentGuard                              ● LIVE
Security monitoring for AI-powered payments

                         Last 24 hours ▼
```

Include a prominent **Verify Chain** action.

---

## 8.1 Summary Cards

Four cards:

### Total Transactions
```text
1,284
+12.4%
```

### Blocked Attempts
```text
96
7.5% of requests
```

### Adversarial Tests
```text
12
12/12 blocked
```

### Audit Chain
```text
✓ INTACT
1,284 entries verified
```

Cards should have small trend lines where useful, but never overpower the main information.

---

# 9. Live Agent Activity

This is one of the most important dashboard sections.

```text
LIVE AGENT ACTIVITY                         ● LIVE

TIME       AGENT          ACTION   AMOUNT    STATUS       REASON
21:54:32   AgentBot-001   BUY      ₹4,299    ✓ ALLOWED    Running Shoes
21:54:29   AgentBot-001   BUY      ₹9,999    ✕ BLOCKED    Spend limit
21:54:21   AgentBot-001   BUY      ₹5,000    ✕ BLOCKED    Cart integrity
21:54:12   AgentBot-002   BUY      ₹2,499    ✓ ALLOWED    Sports Shoes
21:54:01   AgentBot-001   BUY      ₹1,799    ✓ ALLOWED    Socks
```

### Interaction

Clicking a row opens a right-side transaction drawer.

---

# 10. Transaction Detail Drawer

The drawer should show the complete decision trail.

```text
TRANSACTION #AG-82931

BLOCKED
₹9,999
AgentBot-001

Request
"Buy running shoes for 9,999"

Security Pipeline

✓ Intent Parser
  Parsed max amount: ₹9,999

✕ Policy Engine
  max_transaction_amount
  Allowed: ₹7,000
  Requested: ₹9,999

○ Cart Integrity
  Not executed

○ Risk Check
  Not executed

○ Replay Protection
  Not executed

Decision
SPEND LIMIT EXCEEDED

Audit
Hash: 7f3a...91bc
```

The blocked gate should visually dominate.

---

# 11. Security Pipeline

Use a horizontal pipeline on desktop:

```text
[✓]
POLICY
   →
[✓]
CART
   →
[✓]
RISK
   →
[✓]
REPLAY
   →
[✓]
PAYMENT
```

For a blocked transaction:

```text
[✓] POLICY → [✕] CART → [—] RISK → [—] REPLAY → [—] PAYMENT
```

Each gate should display:
- Status
- Rule name
- Execution time
- Short result

Example:

```text
POLICY ENGINE
✓ PASS
8ms

max_transaction_amount
₹4,299 ≤ ₹7,000
```

---

# 12. Attack Simulator

This should be a major demo feature.

## Title

**Attack Simulator**

Subtitle:

Test whether AgentGuard blocks common AI-commerce authorization attacks.

### Scenario cards

#### 1. Exceed Spend Limit

```text
Authorized limit: ₹7,000
Attack amount: ₹9,999

[ Run Attack ]
```

Expected result:

```text
✕ BLOCKED
Reason: exceeds_transaction_cap
```

#### 2. Cart Tampering

```text
Original: ₹2,000
Modified: ₹5,000

[ Run Attack ]
```

Expected result:

```text
✕ BLOCKED
Reason: cart_integrity_failure
Changed field: price
```

#### 3. Replay Authorization

```text
Intent: AG-82931
Status: Already Executed

[ Run Attack ]
```

Expected result:

```text
✕ BLOCKED
Reason: replay_detected
```

### Demo behavior

When the user clicks **Run Attack**:

1. Show request being sent
2. Animate through the gates
3. Stop at the failing gate
4. Display BLOCKED
5. Add the event to the live feed
6. Add an audit entry
7. Update metrics

This is one of the highest-value interactions in the entire product.

---

# 13. Audit Chain

The Audit Chain screen should feel like a lightweight security ledger.

```text
AUDIT CHAIN

✓ CHAIN INTACT
1,284 entries verified

[ Verify Chain ]

ENTRY 1284
Hash: 8a31...2dbc
Prev: 914c...ab21

ENTRY 1283
Hash: 914c...ab21
Prev: f821...33fc

ENTRY 1282
Hash: f821...33fc
Prev: a921...bb90
```

### Verification interaction

Clicking **Verify Chain** should show:

```text
> Loading audit entries...
> Verifying entry 1281...
> Verifying entry 1282...
> Verifying entry 1283...
> Verifying entry 1284...

✓ Chain intact — 1,284 entries verified
```

If tampered:

```text
✕ Chain broken at entry 823
Possible tampering detected
```

Use a terminal-like presentation for this interaction.

---

# 14. Policy Center

Show the active policy as a readable configuration panel.

```text
ACTIVE POLICY                    ● ACTIVE

Version                  policy-v1.4
Policy Hash              7f3a...91bc

Maximum transaction      ₹7,000
Daily spending limit     ₹15,000
Confirmation above       ₹5,000
Requests / minute       5
Intent TTL               24h

Allowed categories
✓ Footwear
✓ Groceries
✓ Electronics accessories
```

A blocked transaction should highlight the exact policy rule responsible.

---

# 15. Agent Spend Tracker

Use horizontal progress bars.

```text
AGENT SPENDING

AgentBot-001
₹8,200 / ₹15,000
███████████░░░░░░░

AgentBot-002
₹2,500 / ₹15,000
████░░░░░░░░░░░░░
```

Also show:
- Requests today
- Total spend
- Blocked requests
- Current status

---

# 16. Block Reason Analytics

Use a simple donut or horizontal bar chart.

Example:

```text
TOP BLOCKED REASONS

Spend limit exceeded       45%
Cart integrity violation   25%
Replay detected            15%
High risk                  10%
Other                       5%
```

Do not use a rainbow palette. Use semantic status colors only.

---

# 17. System Health

Show operational dependencies.

```text
SYSTEM HEALTH

API                    Operational   ✓
LLM Service            Operational   ✓
PostgreSQL             Operational   ✓
Audit Service          Operational   ✓
Razorpay Test Mode     Operational   ✓
```

If something fails:

```text
Razorpay Test Mode      Degraded      !
```

---

# 18. Request Status Model

Use these statuses consistently:

```text
RECEIVED
PARSED
POLICY_CHECKED
CART_VERIFIED
RISK_CHECKED
AUTHORIZED
EXECUTING
PAYMENT_PENDING
PAID

REJECTED_POLICY
REJECTED_CART
REJECTED_REPLAY
REJECTED_EXPIRED
REJECTED_INVALID
PAYMENT_FAILED
```

Never use vague statuses such as:
- "Something went wrong"
- "AI rejected"
- "Security issue"

Always show a deterministic reason.

---

# 19. Design Principle: LLM Boundary

This should appear somewhere prominent in the product.

```text
AI / LLM
────────────────────────
Understands intent
Explains decisions
        ↓
   Structured JSON
        ↓
DETERMINISTIC SYSTEM
────────────────────────
Policy
Cart Integrity
Risk Rules
Replay Protection
Payment Execution
Audit
```

Suggested callout:

> **The LLM explains. The policy engine decides.**

This is a key product differentiator and should be visible in the landing page and dashboard.

---

# 20. Components

Build reusable components:

```text
<AppShell />
<Sidebar />
<Topbar />

<MetricCard />
<StatusBadge />
<TransactionTable />
<TransactionDrawer />

<SecurityPipeline />
<GateResult />
<PolicyCard />

<AgentSpendCard />
<BlockReasonChart />

<AuditChain />
<AuditEntry />
<VerifyChainButton />

<AttackSimulator />
<AttackScenario />

<SystemHealth />
```

---

# 21. Interaction Rules

### Hover

Cards:
- Slight border emphasis
- No large movement
- 150–200ms transition

### Click

Rows:
- Open detail drawer
- Preserve current dashboard state

### Live updates

Use WebSocket or Server-Sent Events.

New transactions should:
- Appear at the top
- Briefly highlight
- Update summary metrics
- Update block-reason analytics

### Loading

Use skeleton states rather than spinners everywhere.

### Errors

Errors must explain:
- What failed
- Why it failed
- Whether money moved
- What the user can do next

---

# 22. Accessibility

Requirements:

- WCAG-friendly contrast
- Keyboard navigation
- Visible focus states
- Status should never rely on color alone
- Use icons + text for allowed/blocked states
- Tables must remain readable at 200% zoom
- Buttons must have clear labels

Example:

```text
✓ ALLOWED
✕ BLOCKED
! FLAGGED
```

not just colored dots.

---

# 23. Responsive Behavior

### ≥ 1280px

Full dashboard:
- Sidebar
- 4 metric cards
- Multi-column sections
- Horizontal security pipeline

### 768–1279px

- Collapsible sidebar
- 2-column metrics
- Stacked charts
- Horizontal scrolling tables

### < 768px

- Compact navigation
- 1-column layout
- Vertical pipeline
- Transaction drawer becomes full-screen
- Charts simplify

---

# 24. Animation

Keep motion purposeful.

Use:
- 150–250ms transitions
- Gate progress animations
- Live transaction insertion
- Subtle chart updates
- Chain verification terminal animation

Avoid:
- Constant pulsing
- Excessive parallax
- Large page transitions
- Decorative particle backgrounds

Security software should feel controlled, not flashy.

---

# 25. Landing Page Section Order

Recommended final order:

```text
NAVBAR
   ↓
HERO
   ↓
AI AGENT → AGENTGUARD → RAZORPAY PIPELINE
   ↓
SECURITY METRICS
   ↓
LIVE TRANSACTION ACTIVITY
   ↓
SECURITY GATES
   ↓
ATTACK SIMULATOR
   ↓
AUDIT CHAIN
   ↓
POLICY CENTER
   ↓
ARCHITECTURE
   ↓
"The LLM explains. The policy engine decides."
   ↓
CTA
```

---

# 26. Visual Hierarchy

Priority order:

### P0 — Must dominate
- Allowed / blocked decision
- Security gates
- Attack simulator
- Audit chain status

### P1 — Important
- Transaction activity
- Spend limits
- Policy configuration
- Block reasons

### P2 — Supporting
- Charts
- System health
- Technical metadata

### P3 — Secondary
- Decorative elements
- Long explanations
- Non-critical statistics

---

# 27. Recommended Tech Implementation

### Frontend

```text
React
Tailwind CSS
shadcn/ui
Lucide Icons
Recharts
Framer Motion
```

### Data

```text
REST API
WebSocket / SSE
```

### Design implementation

Prefer:
- CSS variables for design tokens
- Reusable components
- Responsive grid
- Semantic status components
- Consistent spacing

---

# 28. Dashboard MVP

Build these first:

```text
[x] Dark dashboard shell
[x] Sidebar navigation
[x] Summary metrics
[x] Live transaction table
[x] Transaction detail drawer
[x] Five-gate security pipeline
[x] Policy summary
[x] Attack simulator
[x] Audit chain viewer
[x] Verify Chain button
[x] Block reason chart
[x] Agent spend tracker
```

Do not spend hackathon time building:
- Complex user management
- Advanced billing
- Multi-tenant administration
- Huge analytics suites
- Multiple payment adapters

---

# 29. The Golden Demo Screen

If only one screen can be shown to a judge, show:

```text
┌───────────────────────────────────────────────────────────────┐
│ AGENTGUARD                              ● LIVE   Verify Chain │
├─────────────┬─────────────────────────────────────────────────┤
│ Overview    │  TOTAL    ALLOWED    BLOCKED     CHAIN          │
│ Transactions│  1,284     1,188       96       ✓ INTACT         │
│ Policies    │                                                 │
│ Audit Chain │  LIVE AGENT ACTIVITY                            │
│ Attack Sim. │  ┌───────────────────────────────────────────┐  │
│             │  │ AgentBot-001   ₹9,999   ✕ BLOCKED          │  │
│             │  │ AgentBot-001   ₹4,299   ✓ ALLOWED          │  │
│             │  └───────────────────────────────────────────┘  │
│             │                                                 │
│             │  SECURITY PIPELINE                              │
│             │  ✓ Policy → ✕ Cart → — Risk → — Replay         │
│             │                                                 │
│             │  ATTACK SIMULATOR       AUDIT CHAIN             │
│             │  [Spend Limit]          ✓ INTACT                 │
│             │  [Cart Tamper]          1,284 verified           │
│             │  [Replay]               [Verify Chain]           │
└─────────────┴─────────────────────────────────────────────────┘
```

This screen directly demonstrates the product's core value.

---

# 30. Final Design Rule

AgentGuard should never look like:

> "Another AI dashboard."

It should look like:

> **"The security control plane for AI-powered payments."**

The UI should make the architecture visible:

**AI proposes → AgentGuard verifies → Policy decides → Payment executes → Audit proves.**
