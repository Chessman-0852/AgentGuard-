// frontend/src/components/TransactionDrawer.tsx
import React, { useEffect } from "react";
import { AuditEntryPayload } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { SecurityPipeline, GateExecution } from "./SecurityPipeline";
import { getBlockReasonDetail } from "../lib/statusTranslations";
import { X, ShieldAlert, CheckCircle2, Copy, Check } from "lucide-react";

interface TransactionDrawerProps {
  entry: AuditEntryPayload | null;
  onClose: () => void;
}

export const TransactionDrawer: React.FC<TransactionDrawerProps> = ({ entry, onClose }) => {
  const [copiedHash, setCopiedHash] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!entry) return null;

  const isBlocked = entry.final_decision === "blocked";
  const reasonDetail = getBlockReasonDetail(entry.block_reason);

  // 6-stage pipeline reconstruction
  const gates: GateExecution[] = [
    {
      id: "intent",
      status: "pass",
    },
    {
      id: "policy",
      status: entry.policy_result ? (entry.policy_result.passed ? "pass" : "fail") : "skipped",
      detail: entry.policy_result?.reason || undefined,
    },
    {
      id: "cart",
      status: entry.cart_result ? (entry.cart_result.passed ? "pass" : "fail") : "skipped",
      detail: entry.cart_result?.reason || undefined,
    },
    {
      id: "risk",
      status: entry.risk_result ? (entry.risk_result.passed ? "pass" : "fail") : "skipped",
      detail: entry.risk_result?.anomaly_score ? `Anomaly: ${entry.risk_result.anomaly_score}` : undefined,
    },
    {
      id: "idempotency",
      status: entry.idempotency_result
        ? entry.idempotency_result.passed
          ? "pass"
          : "fail"
        : "skipped",
      detail: entry.idempotency_result?.reason || undefined,
    },
    {
      id: "payment",
      status: entry.payment_result?.payment_link_url ? "pass" : isBlocked ? "skipped" : "pass",
      detail: entry.payment_result?.status || undefined,
    },
  ];

  const handleCopyHash = () => {
    if (entry.entry_hash) {
      navigator.clipboard.writeText(entry.entry_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in"
    >
      <div className="w-full max-w-xl bg-surface border-l border-border h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
            <div>
              <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-1">
                Transaction Record #{entry.entry_id}
              </div>
              <h2 id="drawer-title" className="text-xl font-bold text-text-primary">
                Technical Audit Inspection
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close transaction details"
              className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Decision Summary */}
          <div className="bg-[#0e1a19] border border-border rounded-[20px] p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <StatusBadge decision={entry.final_decision} size="lg" />
              <div className="font-mono text-2xl font-bold text-text-primary">
                ₹{entry.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-border/60">
              <div>
                <span className="text-text-secondary block">Agent Identifier</span>
                <span className="font-mono text-neon-pulse font-semibold">{entry.agent_id}</span>
              </div>
              <div>
                <span className="text-text-secondary block">Category</span>
                <span className="capitalize text-text-primary font-semibold">{entry.category}</span>
              </div>
              <div>
                <span className="text-text-secondary block">Timestamp</span>
                <span className="font-mono text-text-primary">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block">Financial Impact</span>
                <span
                  className={`font-semibold ${
                    isBlocked ? "text-neon-pulse" : "text-text-primary"
                  }`}
                >
                  {isBlocked ? "No — ₹0.00 transferred" : "Authorized with Razorpay"}
                </span>
              </div>
            </div>
          </div>

          {/* Original User Request */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 font-mono">
              Autonomous Purchase Intent
            </h3>
            <div className="p-3.5 bg-[#0e1a19] border border-border rounded-[14px] text-sm text-text-primary italic">
              "{entry.raw_input || entry.bounded_intent?.raw_input || "Autonomous intent execution"}"
            </div>
          </div>

          {/* Human-Centric Explanation */}
          {isBlocked ? (
            <div className="mb-6 bg-danger/10 border border-danger/40 rounded-[20px] p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-danger mb-1">
                    {reasonDetail.headline}
                  </h4>
                  <p className="text-xs text-text-primary leading-relaxed mb-3">
                    {reasonDetail.explanation}
                  </p>
                  <div className="text-xs bg-[#0e1a19] border border-border p-3 rounded-[12px] text-text-secondary">
                    <span className="font-semibold text-text-primary block mb-1">Recommended Next Step:</span>
                    {reasonDetail.nextStep}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-neon-pulse/10 border border-neon-pulse/30 rounded-[20px] p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-neon-pulse shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-neon-pulse mb-1">
                    Transaction Fully Approved
                  </h4>
                  <p className="text-xs text-text-primary leading-relaxed">
                    This autonomous purchase satisfied all deterministic policy rules, cart integrity validation, velocity limits, and replay checks.
                  </p>
                  {entry.payment_result?.payment_link_url && (
                    <div className="mt-3">
                      <a
                        href={entry.payment_result.payment_link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neon-pulse hover:underline font-mono"
                      >
                        Open Razorpay Test Payment Link →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6-Stage Security Pipeline */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3 font-mono">
              6-Stage Gate Inspection
            </h3>
            <SecurityPipeline gates={gates} />
          </div>

          {/* Collapsible Cryptographic Audit Details */}
          <details className="group border border-border rounded-[16px] bg-[#0e1a19] p-4 text-xs">
            <summary className="cursor-pointer font-semibold text-text-secondary hover:text-text-primary select-none flex items-center justify-between">
              <span>Cryptographic Proof & Fingerprints (Advanced)</span>
              <span className="text-border group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 pt-3 border-t border-border space-y-2.5 text-text-secondary font-mono text-[11px]">
              <div>
                <span className="text-text-primary block mb-0.5 font-sans font-medium">Intent UUID:</span>
                <span className="break-all">{entry.intent_id}</span>
              </div>
              <div>
                <span className="text-text-primary block mb-0.5 font-sans font-medium">SHA-256 Block Fingerprint:</span>
                <div className="flex items-center justify-between bg-surface p-2 rounded-lg border border-border">
                  <span className="truncate mr-2 text-neon-pulse">{entry.entry_hash || "Genesis entry"}</span>
                  <button
                    onClick={handleCopyHash}
                    className="p-1 hover:text-text-primary text-text-secondary"
                    aria-label="Copy hash"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-neon-pulse" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {entry.prev_hash && (
                <div>
                  <span className="text-text-primary block mb-0.5 font-sans font-medium">Previous Block Hash:</span>
                  <span className="break-all text-text-secondary">{entry.prev_hash}</span>
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="pt-6 border-t border-border mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-surface-2 border border-border rounded-full text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
          >
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
};
