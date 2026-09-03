// frontend/src/pages/TransactionsPage.tsx
import React, { useState, useEffect } from "react";
import { fetchAuditEntries, AuditEntryPayload } from "../lib/api";
import { TransactionTable } from "../components/TransactionTable";
import { TransactionDrawer } from "../components/TransactionDrawer";
import { Filter, Search, RefreshCw } from "lucide-react";

export const TransactionsPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntryPayload[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntryPayload | null>(null);
  const [filterDecision, setFilterDecision] = useState<"all" | "allowed" | "blocked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAuditEntries(200);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEntries = entries.filter((e) => {
    const matchesDecision =
      filterDecision === "all" ? true : e.final_decision === filterDecision;
    const matchesSearch =
      searchQuery === ""
        ? true
        : (e.agent_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.raw_input || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDecision && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Transactions & Audit Events</h2>
          <p className="text-xs text-text-secondary">
            Inspect all autonomous purchases, verified gate trails, and cryptographic logs.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border text-xs rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition-colors self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-secondary" />
          <span className="text-xs text-text-secondary font-medium">Filter Decision:</span>
          <div className="flex gap-1">
            {(["all", "allowed", "blocked"] as const).map((dec) => (
              <button
                key={dec}
                onClick={() => setFilterDecision(dec)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  filterDecision === dec
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                {dec === "all" ? "All" : dec === "allowed" ? "Approved" : "Blocked"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search prompt, agent, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-bg border border-border rounded-lg text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-hidden focus:border-accent"
          />
        </div>
      </div>

      <TransactionTable
        entries={filteredEntries}
        onRowClick={(item) => setSelectedEntry(item)}
      />

      <TransactionDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
};
