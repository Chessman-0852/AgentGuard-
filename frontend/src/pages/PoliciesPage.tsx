// frontend/src/pages/PoliciesPage.tsx
import React, { useState, useEffect } from "react";
import { fetchPolicy, PolicyResponse } from "../lib/api";
import { PolicyCard } from "../components/PolicyCard";
import { SlidersHorizontal, Info } from "lucide-react";

export const PoliciesPage: React.FC = () => {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicy()
      .then((data) => setPolicy(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-accent" />
          <span>Commerce Policy Controls</span>
        </h2>
        <p className="text-xs text-text-secondary">
          Configure deterministic spending limits, permitted category whitelists, and velocity boundaries.
        </p>
      </div>

      <PolicyCard policy={policy} loading={loading} />

      <div className="bg-surface-2 border border-border rounded-xl p-5 text-xs text-text-secondary space-y-2">
        <h4 className="font-semibold text-text-primary flex items-center gap-2 text-xs">
          <Info className="w-4 h-4 text-accent" />
          <span>Deterministic Enforcement Architecture</span>
        </h4>
        <p className="leading-relaxed">
          Unlike stochastic AI agent guardrails that rely on prompt engineering, AgentGuard evaluates
          all incoming intents against hardcoded, mathematically deterministic logic before issuing an order.
          If a rule is tripped, the gateway halts execution without spending real capital.
        </p>
      </div>
    </div>
  );
};
