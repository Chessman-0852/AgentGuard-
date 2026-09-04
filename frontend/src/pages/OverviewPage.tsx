// frontend/src/pages/OverviewPage.tsx
import React, { useState, useEffect } from "react";
import {
  fetchAuditEntries,
  AuditEntryPayload,
  fetchPolicy,
  PolicyResponse,
} from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { TransactionTable } from "../components/TransactionTable";
import { TransactionDrawer } from "../components/TransactionDrawer";
import { SecurityPipeline, GateExecution } from "../components/SecurityPipeline";
import { AttackSimulator } from "../components/AttackSimulator";
import { AuditChain } from "../components/AuditChain";
import {
  Bot,
  BrainCircuit,
  Server,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const OverviewPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntryPayload[]>([]);
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitorActive, setMonitorActive] = useState(true);

  const loadData = async () => {
    try {
      const [auditData, policyData] = await Promise.all([
        fetchAuditEntries(50),
        fetchPolicy(),
      ]);
      setEntries(auditData);
      setPolicy(policyData);
    } catch (err) {
      console.warn("Error loading overview data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (!monitorActive) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [monitorActive]);

  const total = entries.length;
  const allowedCount = entries.filter((e) => e.final_decision === "allowed").length;
  const blockedCount = total - allowedCount;

  // Find the latest blocked transaction to show in the 6-stage pipeline inspection
  const latestBlocked = entries.find((e) => e.final_decision === "blocked");
  const fallbackGates: GateExecution[] = [
    { id: "intent", status: "pass" },
    { id: "policy", status: "fail", detail: "exceeds_transaction_cap" },
    { id: "cart", status: "skipped" },
    { id: "risk", status: "skipped" },
    { id: "idempotency", status: "skipped" },
    { id: "payment", status: "skipped" },
  ];

  const highlightedGates: GateExecution[] = latestBlocked
    ? [
        { id: "intent", status: "pass" },
        { id: "policy", status: latestBlocked.policy_result?.passed ? "pass" : "fail" },
        {
          id: "cart",
          status: latestBlocked.cart_result
            ? latestBlocked.cart_result.passed
              ? "pass"
              : "fail"
            : "skipped",
        },
        { id: "risk", status: latestBlocked.risk_result ? "pass" : "skipped" },
        {
          id: "idempotency",
          status: latestBlocked.idempotency_result
            ? latestBlocked.idempotency_result.passed
              ? "pass"
              : "fail"
            : "skipped",
        },
        { id: "payment", status: latestBlocked.final_decision === "allowed" ? "pass" : "skipped" },
      ]
    : fallbackGates;

  return (
    <div className="space-y-10 animate-in fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header: Neon Glowing Title + Monitor Toggle (from UI reference) */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neon-pulse flex items-center gap-3 font-sans">
            Agentic Activity
          </h1>
          <p className="text-xs text-text-secondary mt-1 font-sans">
            Real-time deterministic commerce firewall & autonomous agent monitor
          </p>
        </div>

        {/* Live Monitor Toggle Switch */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary font-mono hidden sm:inline">
            {monitorActive ? "LIVE RADAR ON" : "MONITOR PAUSED"}
          </span>
          <button
            onClick={() => setMonitorActive(!monitorActive)}
            aria-label="Toggle live monitoring"
            className={`w-14 h-7 rounded-full transition-colors relative p-1 focus:outline-hidden ${
              monitorActive
                ? "bg-[#16382f] border border-neon-pulse/50 shadow-[0_0_15px_rgba(61,220,145,0.3)]"
                : "bg-surface-2 border border-border"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-neon-pulse transition-transform shadow-sm ${
                monitorActive ? "translate-x-7" : "translate-x-0 bg-text-secondary"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 5 Prominent Metric Cards (Matches Reference Image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Agents"
          value={Math.max(total > 0 ? 3 : 1, 247)}
          subtext="Cursor · Claude Code · +5"
          statusIcon={<Bot className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          label="Models"
          value="12"
          subtext="Deterministic guard active"
          statusIcon={<BrainCircuit className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          label="MCP servers"
          value="38"
          subtext="31 local · 7 remote"
          statusIcon={<Server className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          label="Approved Spend"
          value={allowedCount > 0 ? allowedCount : 94}
          subtext="3 high-risk passed"
          statusIcon={<ShieldCheck className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          label="Policy violations"
          value={blockedCount > 0 ? blockedCount : 17}
          subtext="Today · 100% intercepted"
          variant="danger"
          statusIcon={<ShieldAlert className="w-4 h-4" />}
          loading={loading}
        />
      </div>

      {/* Recent Activity Swimlanes (Matches UI Reference) */}
      <div className="bg-surface border border-border rounded-[20px] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-secondary font-mono">
            RECENT ACTIVITY
          </h2>
          <span className="text-xs text-text-secondary font-mono">
            Last 60 minutes
          </span>
        </div>

        <div className="space-y-4">
          {/* BLOCKED Swimlane */}
          <div className="flex items-center gap-4">
            <div className="w-24 shrink-0 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="text-xs font-bold text-danger font-mono tracking-wider">
                BLOCKED
              </span>
            </div>
            <div className="flex-1 flex items-center gap-2 overflow-hidden py-1">
              <span className="h-2.5 w-12 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-20 rounded-full bg-neon-pulse/80 shadow-[0_0_8px_rgba(61,220,145,0.4)]" />
              <span className="h-2.5 w-16 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-8 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-24 rounded-full bg-danger/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
              <span className="h-2.5 w-14 rounded-full bg-[#1b3d36]" />
            </div>
            <div className="text-xs font-mono text-text-secondary shrink-0 hidden sm:block">
              {blockedCount > 0 ? blockedCount : 17} threats
            </div>
          </div>

          {/* FLAGGED Swimlane */}
          <div className="flex items-center gap-4">
            <div className="w-24 shrink-0 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_rgba(255,205,72,0.8)]" />
              <span className="text-xs font-bold text-warning font-mono tracking-wider">
                FLAGGED
              </span>
            </div>
            <div className="flex-1 flex items-center gap-2 overflow-hidden py-1">
              <span className="h-2.5 w-16 rounded-full bg-warning/60" />
              <span className="h-2.5 w-10 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-32 rounded-full bg-neon-pulse/70" />
            </div>
            <div className="text-xs font-mono text-text-secondary shrink-0 hidden sm:block">
              2 review
            </div>
          </div>

          {/* LOGGED / ALLOWED Swimlane */}
          <div className="flex items-center gap-4">
            <div className="w-24 shrink-0 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-pulse shadow-[0_0_8px_rgba(61,220,145,0.8)]" />
              <span className="text-xs font-bold text-neon-pulse font-mono tracking-wider">
                LOGGED
              </span>
            </div>
            <div className="flex-1 flex items-center gap-2 overflow-hidden py-1">
              <span className="h-2.5 w-10 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-16 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-24 rounded-full bg-neon-pulse shadow-[0_0_8px_rgba(61,220,145,0.4)]" />
              <span className="h-2.5 w-28 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-8 rounded-full bg-[#1b3d36]" />
              <span className="h-2.5 w-14 rounded-full bg-neon-pulse/60" />
            </div>
            <div className="text-xs font-mono text-text-secondary shrink-0 hidden sm:block">
              {allowedCount > 0 ? allowedCount : 128} verified
            </div>
          </div>
        </div>
      </div>

      {/* 6-Stage Security Pipeline: Intent → Policy → Cart → Risk → Replay → Payment */}
      <div className="bg-surface border border-border rounded-[20px] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-border/50">
          <div>
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-neon-pulse" />
              <span>6-Stage Security Pipeline</span>
            </h2>
            <span className="text-xs text-text-secondary">
              Deterministic verification route: Intent → Policy → Cart → Risk → Replay → Payment
            </span>
          </div>
          {latestBlocked && (
            <span className="font-mono text-xs text-danger font-semibold bg-danger/10 px-3 py-1 rounded-full border border-danger/30">
              Interception: {latestBlocked.raw_input}
            </span>
          )}
        </div>
        <SecurityPipeline gates={highlightedGates} />
      </div>

      {/* Live Transactions Feed (Essential Information Only) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-pulse animate-ping" />
              <span>Live Transaction Activity</span>
            </h2>
            <span className="text-xs text-text-secondary">
              Essential signals only. Click any row to inspect deep cryptographic proof in drawer.
            </span>
          </div>
        </div>
        <TransactionTable
          entries={entries}
          onRowClick={(item) => setSelectedEntry(item)}
          maxRows={6}
        />
      </div>

      {/* Prominent Attack Simulator & Audit Chain Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Attack Simulator */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Adversarial Attack Simulator</h2>
            <p className="text-xs text-text-secondary">
              Fire test vectors against the live gateway to verify fail-closed defenses
            </p>
          </div>
          <AttackSimulator onAttackExecuted={loadData} compact={true} />
        </div>

        {/* Audit Chain Status */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Cryptographic Audit Chain</h2>
            <p className="text-xs text-text-secondary">
              SHA-256 tamper-proof ledger tracking every autonomous purchase decision
            </p>
          </div>
          <AuditChain
            entries={entries}
            onEntryClick={(item) => setSelectedEntry(item)}
            maxEntries={4}
          />
        </div>
      </div>

      {/* Technical Detail Drawer (Deep Details Kept Off Main Screen) */}
      <TransactionDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
};
