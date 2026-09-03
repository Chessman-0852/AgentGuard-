// frontend/src/components/TransactionTable.tsx
import React from "react";
import { AuditEntryPayload } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { getBlockReasonDetail } from "../lib/statusTranslations";

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
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-secondary text-sm">
        No transactions recorded yet. Use the Attack Simulator or run a scenario to populate activity.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" role="table">
          <thead className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary font-mono">
            <tr>
              <th scope="col" className="py-3 px-4">Status</th>
              <th scope="col" className="py-3 px-4">Time</th>
              <th scope="col" className="py-3 px-4">Agent</th>
              <th scope="col" className="py-3 px-4">Category</th>
              <th scope="col" className="py-3 px-4 text-right">Amount</th>
              <th scope="col" className="py-3 px-4">Security Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {displayEntries.map((item) => {
              const reasonDetail = getBlockReasonDetail(item.block_reason);
              const timeString = new Date(item.timestamp).toLocaleTimeString();

              return (
                <tr
                  key={item.entry_id}
                  onClick={() => onRowClick(item)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View transaction ${item.entry_id} for ${item.agent_id}, status ${item.final_decision}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  }}
                  className="hover:bg-surface-2/80 cursor-pointer transition-colors focus:outline-hidden focus:bg-surface-2"
                >
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge decision={item.final_decision} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {timeString}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-primary font-semibold whitespace-nowrap">
                    {item.agent_id}
                  </td>
                  <td className="py-3.5 px-4 text-text-secondary capitalize text-xs whitespace-nowrap">
                    {item.category}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-primary font-semibold text-right whitespace-nowrap">
                    ₹{item.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary max-w-xs truncate">
                    {item.final_decision === "allowed" ? (
                      <span className="text-success/90 font-medium">All gates passed</span>
                    ) : (
                      <span className="text-danger/90 font-medium">{reasonDetail.short}</span>
                    )}
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
