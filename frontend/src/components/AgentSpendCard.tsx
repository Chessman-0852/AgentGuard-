// frontend/src/components/AgentSpendCard.tsx
import React from "react";
import { Bot, AlertTriangle } from "lucide-react";

interface AgentSpendCardProps {
  agentId: string;
  spendInr: number;
  dailyCapInr: number;
  requestsToday: number;
  blockedToday?: number;
}

export const AgentSpendCard: React.FC<AgentSpendCardProps> = ({
  agentId,
  spendInr,
  dailyCapInr,
  requestsToday,
  blockedToday = 0,
}) => {
  const percentage = Math.min((spendInr / (dailyCapInr || 1)) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isMaxedOut = percentage >= 100;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 transition-all hover:border-[#3d4b5a]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-primary">
            <Bot className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h4 className="font-mono text-sm font-bold text-text-primary">{agentId}</h4>
            <span className="text-xs text-text-secondary">Autonomous AI Agent</span>
          </div>
        </div>

        <span
          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
            isMaxedOut
              ? "bg-danger/20 text-danger border-danger/30"
              : isNearLimit
              ? "bg-warning/20 text-warning border-warning/30"
              : "bg-success/20 text-success border-success/30"
          }`}
        >
          {isMaxedOut ? "Daily Cap Reached" : isNearLimit ? "Near Limit" : "Active & Healthy"}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1.5 text-xs">
          <span className="text-text-secondary">Cumulative Spend Today</span>
          <span className="font-mono font-semibold text-text-primary">
            ₹{spendInr.toLocaleString("en-IN")} / ₹{dailyCapInr.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Accessible Progress Bar (§22) */}
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Daily spending progress for ${agentId}: ${Math.round(percentage)} percent`}
          className="h-2 w-full bg-surface-2 rounded-full overflow-hidden border border-border/40"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isMaxedOut ? "bg-danger" : isNearLimit ? "bg-warning" : "bg-accent"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
        <div>
          <span className="text-text-secondary block text-[11px]">Total Requests</span>
          <span className="font-mono font-semibold text-text-primary">{requestsToday}</span>
        </div>
        <div>
          <span className="text-text-secondary block text-[11px]">Blocked Requests</span>
          <span className="font-mono font-semibold text-danger">{blockedToday}</span>
        </div>
      </div>
    </div>
  );
};
