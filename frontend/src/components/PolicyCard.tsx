// frontend/src/components/PolicyCard.tsx
import React from "react";
import { PolicyResponse } from "../lib/api";
import { Shield, Clock, AlertCircle } from "lucide-react";

interface PolicyCardProps {
  policy: PolicyResponse | null;
  loading?: boolean;
}

export const PolicyCard: React.FC<PolicyCardProps> = ({ policy, loading }) => {
  if (loading || !policy) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 animate-pulse">
        <div className="h-5 bg-surface-2 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-surface-2 rounded w-full"></div>
          <div className="h-4 bg-surface-2 rounded w-3/4"></div>
          <div className="h-4 bg-surface-2 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  const categoryHumanMap: Record<string, string> = {
    footwear: "Footwear & Shoes",
    groceries: "Fresh Groceries & Pantry",
    "electronics-accessories": "Electronics & Accessories",
    general: "General Supplies",
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-base font-bold text-text-primary">Autonomous Spending Rules</h3>
            <span className="text-xs text-text-secondary">Enforced deterministically without LLM intervention</span>
          </div>
        </div>
        <span
          className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${
            policy.all_blocked
              ? "bg-danger/20 text-danger border-danger/30"
              : "bg-success/20 text-success border-success/30"
          }`}
        >
          {policy.all_blocked ? "✕ Global Freeze Active" : "● Active Enforcement"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        <div className="bg-surface-2 p-4 rounded-lg border border-border/80">
          <span className="text-xs text-text-secondary uppercase tracking-wider block mb-1">
            Max Single Purchase
          </span>
          <div className="font-mono text-xl font-bold text-text-primary">
            ₹{policy.max_transaction_amount_inr.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            Hard limit per transaction. Any single purchase higher than this is blocked.
          </p>
        </div>

        <div className="bg-surface-2 p-4 rounded-lg border border-border/80">
          <span className="text-xs text-text-secondary uppercase tracking-wider block mb-1">
            Daily Agent Limit
          </span>
          <div className="font-mono text-xl font-bold text-text-primary">
            ₹{policy.max_daily_spend_per_agent_inr.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            Maximum cumulative expenditure permitted per autonomous agent each day.
          </p>
        </div>

        <div className="bg-surface-2 p-4 rounded-lg border border-border/80">
          <span className="text-xs text-text-secondary uppercase tracking-wider block mb-1">
            Human Approval Level
          </span>
          <div className="font-mono text-xl font-bold text-text-primary">
            ₹{policy.requires_human_confirmation_above_inr.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            Transactions above this value require explicit human authorization before execution.
          </p>
        </div>
      </div>

      {/* Allowed Categories List */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
          Authorized Purchase Categories
        </h4>
        <div className="flex flex-wrap gap-2">
          {policy.allowed_categories.map((cat) => (
            <span
              key={cat}
              className="px-3 py-1 bg-surface-2 border border-border rounded-lg text-xs font-medium text-text-primary"
            >
              ✓ {categoryHumanMap[cat] || cat}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-secondary pt-4 border-t border-border/60">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Rate Limit: {policy.max_requests_per_minute_per_agent} requests / minute</span>
        </div>
        <div>•</div>
        <div>Idempotency TTL: {policy.idempotency_key_ttl_seconds / 3600} hours</div>
      </div>
    </div>
  );
};
