// frontend/src/pages/AuditChainPage.tsx
import React, { useState, useEffect } from "react";
import { fetchAuditEntries, AuditEntryPayload } from "../lib/api";
import { AuditChain } from "../components/AuditChain";
import { TransactionDrawer } from "../components/TransactionDrawer";
import { Link2, ShieldCheck, RefreshCw } from "lucide-react";

export const AuditChainPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntryPayload[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntryPayload | null>(null);

  const loadData = async () => {
    const data = await fetchAuditEntries(100);
    setEntries(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent" />
            <span>Cryptographic Proof Ledger</span>
          </h2>
          <p className="text-xs text-text-secondary">
            Immutable SHA-256 hash pointer record. Proves no decision was modified or omitted.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border text-xs rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl p-4 text-xs text-text-secondary space-y-1.5">
        <div className="font-semibold text-text-primary flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span>How AgentGuard Proof Verification Works</span>
        </div>
        <p className="leading-relaxed">
          Every decision payload (input intent, individual gate verdicts, and Razorpay payment details) is
          canonically serialized into JSON and cryptographically hashed with the previous block's SHA-256 digest.
          Altering even a single byte anywhere in history invalidates all subsequent blocks immediately.
        </p>
      </div>

      <AuditChain
        entries={entries}
        onEntryClick={(item) => setSelectedEntry(item)}
        maxEntries={100}
        showVerifyButton={true}
      />

      <TransactionDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
};
