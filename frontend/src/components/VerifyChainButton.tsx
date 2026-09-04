// frontend/src/components/VerifyChainButton.tsx
import React, { useState } from "react";
import { verifyAuditChain, ChainVerificationResponse } from "../lib/api";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface VerifyChainButtonProps {
  onVerified?: (res: ChainVerificationResponse) => void;
}

export const VerifyChainButton: React.FC<VerifyChainButtonProps> = ({ onVerified }) => {
  const [verifying, setVerifying] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ChainVerificationResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    setModalOpen(true);
    setResult(null);
    setTerminalLogs([
      "> Initializing AgentGuard audit verification...",
      "> Connecting to tamper-evident SQLite hash-chain ledger...",
    ]);

    await new Promise((r) => setTimeout(r, 400));
    setTerminalLogs((prev) => [...prev, "> Validating SHA-256 genesis pointer: 0000000000000000000000000000000000000000000000000000000000000000"]);

    const res = await verifyAuditChain();

    await new Promise((r) => setTimeout(r, 400));
    if (res.intact) {
      setTerminalLogs((prev) => [
        ...prev,
        `> Checked ${res.entries_checked} sequential hash blocks...`,
        "> All mathematical hashes valid and cryptographically linked.",
        `✓ ${res.message || "Audit chain is fully intact. Zero tampering detected."}`,
      ]);
    } else {
      setTerminalLogs((prev) => [
        ...prev,
        `✕ Verification error: ${res.message}`,
        "> WARNING: Audit ledger contains broken hash links or unauthorized modifications.",
      ]);
    }

    setResult(res);
    setVerifying(false);
    if (onVerified) onVerified(res);
  };

  return (
    <>
      <button
        onClick={handleVerify}
        disabled={verifying}
        className="inline-flex items-center gap-2 px-4 py-1.5 bg-neon-pulse/15 border border-neon-pulse/40 text-neon-pulse hover:bg-neon-pulse/25 rounded-full text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(61,220,145,0.15)] focus:outline-hidden disabled:opacity-50"
      >
        {verifying ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5" />
        )}
        <span>{verifying ? "Verifying Ledger..." : "Verify Audit Chain"}</span>
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-surface border border-border rounded-[20px] w-full max-w-lg p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-neon-pulse" />
                <h3 className="text-base font-bold text-text-primary">
                  Cryptographic Audit Chain Verification
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-secondary hover:text-text-primary text-sm p-1 rounded-full hover:bg-surface-2"
                aria-label="Close verification modal"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary mb-3">
              Independent mathematical verification running on the SHA-256 hash pointer chain.
            </p>

            {/* Terminal-like output display */}
            <div className="bg-[#0e1a19] border border-border/80 rounded-[14px] p-4 font-mono text-xs text-text-primary/90 space-y-1.5 max-h-56 overflow-y-auto mb-4">
              {terminalLogs.map((log, i) => (
                <div
                  key={i}
                  className={`${
                    log.startsWith("✓")
                      ? "text-neon-pulse font-semibold"
                      : log.startsWith("✕")
                      ? "text-danger font-semibold"
                      : "text-text-secondary"
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>

            {result && (
              <div
                className={`p-3.5 rounded-[14px] border text-xs flex items-start gap-2.5 ${
                  result.intact
                    ? "bg-neon-pulse/10 border-neon-pulse/30 text-neon-pulse"
                    : "bg-danger/10 border-danger/30 text-danger"
                }`}
              >
                {result.intact ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold mb-0.5">
                    {result.intact ? "Tamper Proof Confirmed" : "Integrity Failure"}
                  </div>
                  <div className="text-text-primary text-[11px] leading-relaxed">
                    {result.intact
                      ? "Every recorded decision has a verified sequential cryptographic signature. No record was modified, injected, or dropped."
                      : "The ledger contains an invalid hash pointer. The security gateway has halted trust."}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 bg-surface-2 border border-border hover:bg-surface rounded-full text-xs font-semibold text-text-primary transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
