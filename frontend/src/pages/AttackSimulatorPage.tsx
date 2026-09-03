// frontend/src/pages/AttackSimulatorPage.tsx
import React, { useState, useEffect } from "react";
import { AttackSimulator } from "../components/AttackSimulator";
import { fetchAuditEntries, AuditEntryPayload } from "../lib/api";
import { TransactionTable } from "../components/TransactionTable";
import { TransactionDrawer } from "../components/TransactionDrawer";
import { Swords, ShieldAlert, Sparkles } from "lucide-react";

export const AttackSimulatorPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntryPayload[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntryPayload | null>(null);

  const loadData = async () => {
    const data = await fetchAuditEntries(20);
    setEntries(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Swords className="w-5 h-5 text-danger" />
          <h2 className="text-xl font-bold text-text-primary">Commerce Attack Simulator</h2>
        </div>
        <p className="text-xs text-text-secondary max-w-2xl">
          Execute simulated autonomous agent attacks against AgentGuard's live deterministic pipeline.
          Observe real-time interception, cryptographic proof generation, and zero dollar leakage.
        </p>
      </div>

      <AttackSimulator onAttackExecuted={loadData} />

      <div className="pt-4 border-t border-border space-y-3">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-warning" />
          <span>Real-Time Audit Records From Recent Simulations</span>
        </h3>
        <TransactionTable entries={entries} onRowClick={(item) => setSelectedEntry(item)} maxRows={8} />
      </div>

      <TransactionDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
};
