// frontend/src/pages/AgentsPage.tsx
import React, { useState, useEffect } from "react";
import { fetchAuditEntries, fetchAgentSpend, AgentSpendResponse } from "../lib/api";
import { AgentSpendCard } from "../components/AgentSpendCard";
import { Bot, Plus, RefreshCw } from "lucide-react";

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentSpendResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const auditEntries = await fetchAuditEntries(100);
    // Unique agents from audit
    const uniqueAgentIds = Array.from(new Set(auditEntries.map((e) => e.agent_id)));
    if (!uniqueAgentIds.includes("AgentBot-001")) uniqueAgentIds.push("AgentBot-001");
    if (!uniqueAgentIds.includes("AgentBot-002")) uniqueAgentIds.push("AgentBot-002");

    const spends = await Promise.all(
      uniqueAgentIds.map(async (id) => {
        const res = await fetchAgentSpend(id);
        if (res) return res;
        return {
          agent_id: id,
          date: new Date().toISOString().split("T")[0],
          daily_spend_paise: 0,
          daily_spend_inr: 0,
          daily_cap_paise: 1500000,
          daily_cap_inr: 15000,
          request_count_today: auditEntries.filter((e) => e.agent_id === id).length,
        };
      })
    );

    setAgents(spends);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            <span>Autonomous Agent Governance</span>
          </h2>
          <p className="text-xs text-text-secondary">
            Live quota tracking, identity validation, and per-agent cumulative spend caps.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((ag) => (
          <AgentSpendCard
            key={ag.agent_id}
            agentId={ag.agent_id}
            spendInr={ag.daily_spend_inr}
            dailyCapInr={ag.daily_cap_inr}
            requestsToday={ag.request_count_today}
          />
        ))}
      </div>
    </div>
  );
};
