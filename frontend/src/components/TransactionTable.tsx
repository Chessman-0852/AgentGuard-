// frontend/src/components/TransactionTable.tsx
import React from "react";
import { AuditEntryPayload } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { ChevronRight } from "lucide-react";

interface TransactionTableProps {
  entries: AuditEntryPayload[];
  onRowClick: (entry: AuditEntryPayload) => void;
  maxRows?: number;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  entries,
  onRowClick,
  maxRows,
}) => {
  const displayEntries = maxRows ? entries.slice(0, maxRows) : entries;

  if (entries.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-[20px] p-8 text-center text-text-secondary text-sm">
        No transactions recorded yet. Fire a test scenario in the Attack Simulator to see live traffic.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-[20px] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" role="table">
          <thead className="bg-[#0e1a19]/60 border-b border-border text-[11px] uppercase tracking-wider text-text-secondary font-mono">
            <tr>
              <th scope="col" className="py-3 px-5">Status</th>
              <th scope="col" className="py-3 px-4">Time</th>
              <th scope="col" className="py-3 px-4">Agent</th>
              <th scope="col" className="py-3 px-4">Action / Item</th>
              <th scope="col" className="py-3 px-4 text-right">Amount</th>
              <th scope="col" className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {displayEntries.map((item) => {
              const timeString = new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <tr
                  key={item.entry_id}
                  onClick={() => onRowClick(item)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${item.agent_id}, status ${item.final_decision}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  }}
                  className="hover:bg-surface-2/60 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <StatusBadge decision={item.final_decision} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {timeString}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-neon-pulse font-medium whitespace-nowrap">
                    {item.agent_id}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-primary max-w-xs truncate">
                    {item.raw_input || item.category || "Autonomous Purchase"}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-primary font-semibold text-right whitespace-nowrap">
                    ₹{item.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center text-xs text-text-secondary group-hover:text-neon-pulse transition-colors">
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
