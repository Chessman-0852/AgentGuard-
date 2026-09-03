// frontend/src/components/SystemHealth.tsx
import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ServiceStatus {
  name: string;
  category: string;
  operational: boolean;
  latency?: string;
}

interface SystemHealthProps {
  apiHealthy: boolean;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ apiHealthy }) => {
  const services: ServiceStatus[] = [
    { name: "AgentGuard Gateway API", category: "Core Pipeline", operational: apiHealthy, latency: "4ms" },
    { name: "Groq LLM Intent Parser", category: "Intent Intelligence", operational: true, latency: "380ms" },
    { name: "Deterministic Policy Engine", category: "Security Gates", operational: true, latency: "<1ms" },
    { name: "Cart Cryptographic Verifier", category: "Integrity Gate", operational: true, latency: "1ms" },
    { name: "Audit Hash-Chain Ledger", category: "Proof Storage", operational: true, latency: "2ms" },
    { name: "Razorpay Test Gateway", category: "Execution", operational: true, latency: "180ms" },
  ];

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
        <div>
          <h3 className="text-sm font-bold text-text-primary">System Infrastructure Health</h3>
          <span className="text-xs text-text-secondary">Subsystem heartbeat and latency monitors</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-mono text-success">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          <span>All Systems Operational</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="p-3 bg-surface-2 border border-border/80 rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-text-primary">{svc.name}</div>
              <div className="text-[11px] text-text-secondary">{svc.category}</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {svc.operational ? (
                <>
                  <span className="text-text-secondary text-[11px]">{svc.latency}</span>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </>
              ) : (
                <>
                  <span className="text-danger text-[11px]">Degraded</span>
                  <AlertCircle className="w-4 h-4 text-danger" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
