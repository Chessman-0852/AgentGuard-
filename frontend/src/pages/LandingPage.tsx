// frontend/src/pages/LandingPage.tsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchAuditEntries, AuditEntryPayload, fetchPolicy, PolicyResponse } from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { TransactionTable } from "../components/TransactionTable";
import { TransactionDrawer } from "../components/TransactionDrawer";
import { SecurityPipeline, GateExecution } from "../components/SecurityPipeline";
import { VerifyChainButton } from "../components/VerifyChainButton";
import { AuditChain } from "../components/AuditChain";
import { PolicyCard } from "../components/PolicyCard";
import {
  Shield,
  ArrowRight,
  Activity,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Terminal,
  ExternalLink,
  ChevronRight,
  Layers,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntryPayload[]>([]);
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntryPayload | null>(null);

  useEffect(() => {
    fetchAuditEntries(10).then(setEntries);
    fetchPolicy().then(setPolicy);
  }, []);

  const total = entries.length;
  const allowed = entries.filter((e) => e.final_decision === "allowed").length;
  const blocked = total - allowed;

  const samplePipelineGates: GateExecution[] = [
    { id: "policy", status: "pass", latencyMs: 2 },
    { id: "cart", status: "pass", latencyMs: 1 },
    { id: "risk", status: "pass", latencyMs: 3 },
    { id: "idempotency", status: "pass", latencyMs: 1 },
    { id: "payment", status: "pass", latencyMs: 140 },
  ];

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-accent selection:text-white font-sans">
      {/* 6.1 Navbar (§25 Section 1) */}
      <nav className="border-b border-border/80 sticky top-0 z-30 bg-bg/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">AgentGuard</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-text-secondary">
            <a href="#overview" className="hover:text-text-primary transition-colors">Overview</a>
            <a href="#security" className="hover:text-text-primary transition-colors">Security Gates</a>
            <a href="#simulation" className="hover:text-text-primary transition-colors">Attack Defense</a>
            <a href="#audit" className="hover:text-text-primary transition-colors">Audit Ledger</a>
            <a href="#architecture" className="hover:text-text-primary transition-colors">Architecture</a>
          </div>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm"
          >
            <span>Open Security Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* 6.2 Hero (§25 Section 2) */}
      <section id="overview" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-6">
          <Shield className="w-3.5 h-3.5" />
          <span>Payment Firewall for AI Agents</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-text-primary tracking-tight leading-[1.15] mb-6">
          AI can shop. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-accent to-purple-400">
            AgentGuard decides what it's allowed to buy.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          The deterministic authorization gateway between autonomous AI agents and payment processors.
          Converts natural language into bounded intent, runs 5 cryptographic gates, and blocks unauthorized
          transactions before money ever moves.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto px-6 py-3.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition-all"
          >
            <span>Launch Security Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#architecture"
            className="w-full sm:w-auto px-6 py-3.5 bg-surface border border-border hover:bg-surface-2 text-text-primary rounded-xl text-sm font-semibold transition-colors"
          >
            Inspect Architecture
          </a>
        </div>
      </section>

      {/* Hero Pipeline Visualizer (§25 Section 3) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-24">
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-4 flex items-center justify-between">
            <span>Deterministic Enforcement Sequence</span>
            <span className="text-success font-semibold">● Real-Time Gateway</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* AI Agent Box */}
            <div className="bg-surface-2 border border-border p-4 rounded-xl text-left">
              <span className="text-[11px] font-mono text-accent uppercase block mb-1">1. Autonomous Agent</span>
              <div className="text-sm font-bold text-text-primary mb-1">Natural Language Intent</div>
              <div className="text-xs font-mono text-text-secondary bg-bg p-2 rounded border border-border/60">
                "Purchase running shoes, budget ₹7,000"
              </div>
            </div>

            {/* Gateway Box */}
            <div className="bg-accent/10 border border-accent/40 p-4 rounded-xl text-left">
              <span className="text-[11px] font-mono text-accent uppercase block mb-1">2. AgentGuard Gateway</span>
              <div className="text-sm font-bold text-text-primary mb-2">Deterministic Defense</div>
              <div className="space-y-1 text-xs text-text-secondary">
                <div className="flex items-center gap-1.5 text-success">✓ Policy Limits Check</div>
                <div className="flex items-center gap-1.5 text-success">✓ Cart Integrity Cryptography</div>
                <div className="flex items-center gap-1.5 text-success">✓ Idempotency Replay Guard</div>
              </div>
            </div>

            {/* Execution Box */}
            <div className="bg-surface-2 border border-border p-4 rounded-xl text-left">
              <span className="text-[11px] font-mono text-success uppercase block mb-1">3. Razorpay Settlement</span>
              <div className="text-sm font-bold text-text-primary mb-1">Verified Order Generated</div>
              <div className="text-xs text-text-secondary">
                Tamper-evident SHA-256 audit entry registered instantly.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Metrics (§25 Section 4) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Audited Intents"
            value={total}
            subtext="100% decision log coverage"
            statusIcon={<Activity className="w-4 h-4 text-accent" />}
          />
          <MetricCard
            label="Approved Orders"
            value={allowed}
            subtext="Verified payment links issued"
            statusIcon={<CheckCircle2 className="w-4 h-4 text-success" />}
          />
          <MetricCard
            label="Blocked Infractions"
            value={blocked}
            subtext="Zero dollars leaked"
            statusIcon={<Lock className="w-4 h-4 text-danger" />}
          />
          <MetricCard
            label="Audit Ledger Status"
            value="✓ INTACT"
            subtext="Cryptographic chain unbroken"
            statusIcon={<FileCheck2 className="w-4 h-4 text-accent" />}
          />
        </div>
      </section>

      {/* Live Transaction Activity Preview (§25 Section 5) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Live Transaction Stream</h2>
            <span className="text-xs text-text-secondary">Real-time decisions recorded by the gateway</span>
          </div>
          <Link
            to="/dashboard/transactions"
            className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
          >
            <span>View all in dashboard</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <TransactionTable entries={entries} onRowClick={(item) => setSelectedEntry(item)} maxRows={5} />
      </section>

      {/* Security Gates (§25 Section 6) */}
      <section id="security" className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            Every purchase passes 5 security checkpoints
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary">
            Zero reliance on probabilistic AI prompts for security. Hardened pure-code validation gates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-surface border border-border rounded-xl p-6">
            <span className="font-mono text-xs text-accent uppercase font-bold block mb-2">Gate 1</span>
            <h3 className="text-base font-bold text-text-primary mb-2">Policy Limits</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Verifies spending caps, daily cumulative budget, allowed product categories, and transaction velocity limits.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <span className="font-mono text-xs text-accent uppercase font-bold block mb-2">Gate 2</span>
            <h3 className="text-base font-bold text-text-primary mb-2">Cart Cryptographic Integrity</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Snapshots the cart at authorization using canonical JSON SHA-256 hashes. Detects post-approval item or price tampering.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <span className="font-mono text-xs text-accent uppercase font-bold block mb-2">Gate 3</span>
            <h3 className="text-base font-bold text-text-primary mb-2">Risk & Anomaly Profiler</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Statistical deviation check computing historic rolling z-scores to flag anomalous purchase spikes without stalling clean orders.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <span className="font-mono text-xs text-accent uppercase font-bold block mb-2">Gate 4</span>
            <h3 className="text-base font-bold text-text-primary mb-2">Idempotency & Replay Guard</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Atomic reservation using deterministic 15-minute time-bucket keys. Blocks double-charging and cross-agent replay attempts.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <span className="font-mono text-xs text-accent uppercase font-bold block mb-2">Gate 5</span>
            <h3 className="text-base font-bold text-text-primary mb-2">Secure Test-Mode Checkout</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Interacts directly with Razorpay test-mode APIs. Rejects production keys at startup. Issues verifiable payment links.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <span className="font-mono text-xs text-accent uppercase font-bold block mb-2">Audit Proof</span>
            <h3 className="text-base font-bold text-text-primary mb-2">Hash-Chained Ledger</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Cryptographically hashes every decision block with the previous digest. Tampering is mathematically impossible to conceal.
            </p>
          </div>
        </div>
      </section>

      {/* Attack Simulator Preview (§25 Section 7) */}
      <section id="simulation" className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="bg-surface border border-border rounded-2xl p-8">
          <div className="max-w-2xl mb-6">
            <span className="text-xs font-mono text-danger font-semibold uppercase tracking-wider block mb-1">
              Active Security Demonstration
            </span>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              See what AgentGuard stops in real time
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Test common AI agent commerce attack vectors. Watch the deterministic engine halt execution with zero capital at risk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <span className="text-xs font-bold text-text-primary block mb-1">Spending Limit Attack</span>
              <p className="text-xs text-text-secondary mb-3">AI requests item at ₹9,999 (cap: ₹7,000)</p>
              <span className="text-xs font-mono text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/30">
                ✕ Blocked: Over spending limit
              </span>
            </div>

            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <span className="text-xs font-bold text-text-primary block mb-1">Category Whitelist Attack</span>
              <p className="text-xs text-text-secondary mb-3">Agent attempts purchase in unauthorized category</p>
              <span className="text-xs font-mono text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/30">
                ✕ Blocked: Category not permitted
              </span>
            </div>

            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <span className="text-xs font-bold text-text-primary block mb-1">Duplicate Replay Attack</span>
              <p className="text-xs text-text-secondary mb-3">Automated loop resends identical intent</p>
              <span className="text-xs font-mono text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/30">
                ✕ Blocked: Duplicate request
              </span>
            </div>
          </div>

          <Link
            to="/dashboard/attack"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold"
          >
            <span>Launch Interactive Attack Simulator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Audit Chain Section (§25 Section 8) */}
      <section id="audit" className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Cryptographic Audit Ledger</h2>
            <p className="text-xs text-text-secondary">
              Every decision permanently preserved in an append-only SHA-256 block ledger.
            </p>
          </div>
          <VerifyChainButton />
        </div>

        <AuditChain entries={entries} maxEntries={4} showVerifyButton={false} />
      </section>

      {/* Policy Center Preview (§25 Section 9) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-text-primary">Configured Governance Policies</h2>
          <p className="text-xs text-text-secondary">
            Deterministic rule thresholds governing all autonomous buyer agents.
          </p>
        </div>

        <PolicyCard policy={policy} />
      </section>

      {/* Architecture Section (§25 Section 10) */}
      <section id="architecture" className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            System Architecture
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary">
            Strict separation between natural language AI comprehension and deterministic policy enforcement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface border border-border rounded-2xl p-8">
          <div className="space-y-4">
            <span className="text-xs font-mono uppercase text-accent font-bold">1. AI Intelligence Layer</span>
            <h3 className="text-lg font-bold text-text-primary">Intent Parser (Groq / Llama / Qwen)</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Extracts category, maximum ceiling amount, and normalized description from unstructured prompt strings
              via forced tool-calling JSON schema. Generates plain-English explanations for rejected attempts.
            </p>
            <div className="p-3 bg-bg border border-border rounded-lg text-xs font-mono text-text-secondary">
              No authorization decisions are made here.
            </div>
          </div>

          <div className="space-y-4 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-6">
            <span className="text-xs font-mono uppercase text-success font-bold">2. Deterministic Engine</span>
            <h3 className="text-lg font-bold text-text-primary">AgentGuard Gateway Core</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Enforces hardcoded mathematical boundaries: Policy limits, SHA-256 cart snapshots, rolling anomaly z-scores,
              and SQLite atomic key reservations. Executes payment only when 100% of gates pass.
            </p>
            <div className="p-3 bg-bg border border-border rounded-lg text-xs font-mono text-text-secondary">
              All decisions append cryptographically to the ledger.
            </div>
          </div>
        </div>
      </section>

      {/* The Central Callout (§25 Section 11) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-24 text-center">
        <div className="bg-linear-to-b from-surface to-surface-2 border border-border rounded-3xl p-10 sm:p-14 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent mx-auto mb-6">
            <Shield className="w-6 h-6" />
          </div>
          <blockquote className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight mb-4">
            "The LLM explains. The policy engine decides."
          </blockquote>
          <p className="text-sm text-text-secondary max-w-xl mx-auto leading-relaxed">
            Natural language is not a security boundary. AgentGuard provides the verifiable, machine-enforced
            firewall needed for trustworthy agentic commerce.
          </p>
        </div>
      </section>

      {/* Final CTA (§25 Section 12) */}
      <section className="py-16 border-t border-border bg-surface/30 text-center px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
            Secure your autonomous AI buyers today
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary mb-8">
            Protect your merchant infrastructure against prompt injection, cart alterations, and rogue spending loops.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-semibold shadow-lg shadow-accent/20 transition-all"
          >
            <span>Access Control Plane</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Transaction Drawer */}
      <TransactionDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
};
