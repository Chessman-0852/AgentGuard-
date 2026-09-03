// frontend/src/pages/SettingsPage.tsx
import React, { useState, useEffect } from "react";
import { fetchHealth } from "../lib/api";
import { SystemHealth } from "../components/SystemHealth";
import { Settings, Shield, Server, Database } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    fetchHealth().then(setHealthy);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent" />
          <span>Gateway Settings & Node Infrastructure</span>
        </h2>
        <p className="text-xs text-text-secondary">
          Review operational parameters, gateway status, and cryptographic engine configurations.
        </p>
      </div>

      <SystemHealth apiHealthy={healthy} />

      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Server className="w-4 h-4 text-accent" />
          <span>Active Deployment Parameters</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-surface-2 rounded-lg border border-border/80">
            <span className="text-text-secondary block mb-1">Gateway Endpoint</span>
            <span className="font-mono text-text-primary font-semibold">http://localhost:8000</span>
          </div>
          <div className="p-3 bg-surface-2 rounded-lg border border-border/80">
            <span className="text-text-secondary block mb-1">Environment</span>
            <span className="font-mono text-success font-semibold">Test Sandbox (rzp_test_ active)</span>
          </div>
          <div className="p-3 bg-surface-2 rounded-lg border border-border/80">
            <span className="text-text-secondary block mb-1">Audit Mode</span>
            <span className="font-mono text-text-primary font-semibold">SQLite WAL (Append-Only)</span>
          </div>
          <div className="p-3 bg-surface-2 rounded-lg border border-border/80">
            <span className="text-text-secondary block mb-1">Fail-Closed Invariant</span>
            <span className="font-mono text-accent font-semibold">STRICT ENFORCEMENT</span>
          </div>
        </div>
      </div>
    </div>
  );
};
