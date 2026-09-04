// frontend/src/components/AuditChain.tsx
import React, { useState } from "react";
import { AuditEntryPayload } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { VerifyChainButton } from "./VerifyChainButton";
import { Link2, Copy, Check } from "lucide-react";

interface AuditChainProps {
  entries: AuditEntryPayload[];
  onEntryClick?: (entry: AuditEntryPayload) => void;
  maxEntries?: number;
  showVerifyButton?: boolean;
}

export const AuditChain: React.FC<AuditChainProps> = ({
  entries,
  onEntryClick,
  maxEntries = 10,
  showVerifyButton = true,
}) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const displayList = entries.slice(0, maxEntries);

  const handleCopy = (id: number, hash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-[20px] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border mb-4 gap-3">
        <div>
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Link2 className="w-4 h-4 text-neon-pulse" />
            <span>Cryptographic Audit Proof Chain</span>
          </h3>
          <span className="text-xs text-text-secondary">
            Append-only SHA-256 hash pointer linkage
          </span>
        </div>
        {showVerifyButton && <VerifyChainButton />}
      </div>

      <div className="space-y-3">
        {displayList.map((entry) => {
          const hashShort = entry.entry_hash
            ? `${entry.entry_hash.slice(0, 8)}...${entry.entry_hash.slice(-6)}`
            : "Genesis Block (0000...0000)";

          return (
            <div
              key={entry.entry_id}
              onClick={() => onEntryClick && onEntryClick(entry)}
              className={`p-3.5 rounded-[14px] border border-border/70 bg-[#0e1a19] transition-all duration-150 ${
                onEntryClick ? "hover:border-neon-pulse/40 cursor-pointer" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-neon-pulse font-bold">
                    Block #{entry.entry_id}
                  </span>
                  <StatusBadge decision={entry.final_decision} size="sm" />
                </div>
                <span className="font-mono text-text-secondary text-[11px]">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-text-secondary">
                <div className="truncate max-w-[240px] sm:max-w-xs">
                  <span className="text-text-primary font-mono">{entry.agent_id}</span>: "
                  {entry.raw_input}"
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0 pl-2">
                  <span className="text-text-primary font-medium">{hashShort}</span>
                  {entry.entry_hash && (
                    <button
                      onClick={(e) => handleCopy(entry.entry_id, entry.entry_hash!, e)}
                      className="text-text-secondary hover:text-neon-pulse p-1"
                      aria-label="Copy SHA-256 fingerprint"
                    >
                      {copiedId === entry.entry_id ? (
                        <Check className="w-3.5 h-3.5 text-neon-pulse" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {displayList.length === 0 && (
          <div className="p-4 text-center text-xs text-text-secondary">
            No entries currently registered in audit ledger.
          </div>
        )}
      </div>
    </div>
  );
};
