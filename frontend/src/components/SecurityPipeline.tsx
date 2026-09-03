// frontend/src/components/SecurityPipeline.tsx
import React from "react";
import { GATE_DISPLAY_INFO } from "../lib/statusTranslations";
import { Check, X, Minus } from "lucide-react";

export interface GateExecution {
  id: "policy" | "cart" | "risk" | "idempotency" | "payment";
  status: "pass" | "fail" | "skipped";
  latencyMs?: number | null;
  detail?: string;
}

interface SecurityPipelineProps {
  gates: GateExecution[];
  compact?: boolean;
}

export const SecurityPipeline: React.FC<SecurityPipelineProps> = ({ gates, compact = false }) => {
  return (
    <div className="w-full">
      {/* Desktop layout: horizontal sequence */}
      <div className="hidden md:flex items-center justify-between gap-2">
        {gates.map((gate, idx) => {
          const info = GATE_DISPLAY_INFO[gate.id] || {
            name: gate.id,
            description: "",
            passText: "Passed",
            failText: "Failed",
          };

          const isPass = gate.status === "pass";
          const isFail = gate.status === "fail";
          const isSkipped = gate.status === "skipped";

          return (
            <React.Fragment key={gate.id}>
              <div
                className={`flex-1 rounded-lg border p-3 transition-all duration-200 ${
                  isFail
                    ? "bg-danger/10 border-danger/40 ring-1 ring-danger/30"
                    : isPass
                    ? "bg-surface border-border/80"
                    : "bg-surface/40 border-border/40 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary truncate">
                    {info.name}
                  </span>
                  <div
                    aria-label={`Gate ${info.name}: ${
                      isPass ? "Passed" : isFail ? "Blocked" : "Not reached"
                    }`}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPass
                        ? "bg-success/20 text-success"
                        : isFail
                        ? "bg-danger text-white animate-pulse"
                        : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    {isPass && <Check className="w-3.5 h-3.5" />}
                    {isFail && <X className="w-3.5 h-3.5" />}
                    {isSkipped && <Minus className="w-3.5 h-3.5" />}
                  </div>
                </div>

                <div className="text-xs font-medium text-text-primary truncate">
                  {isPass ? info.passText : isFail ? info.failText : "Not reached"}
                </div>

                {!compact && gate.latencyMs !== undefined && gate.latencyMs !== null && (
                  <div className="text-[11px] font-mono text-text-secondary mt-1">
                    {gate.latencyMs}ms
                  </div>
                )}
              </div>

              {idx < gates.length - 1 && (
                <div className="text-border text-xs px-0.5 select-none" aria-hidden="true">
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile layout: vertical stack */}
      <div className="md:hidden flex flex-col gap-2">
        {gates.map((gate) => {
          const info = GATE_DISPLAY_INFO[gate.id] || {
            name: gate.id,
            description: "",
            passText: "Passed",
            failText: "Failed",
          };
          const isPass = gate.status === "pass";
          const isFail = gate.status === "fail";

          return (
            <div
              key={gate.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                isFail
                  ? "bg-danger/10 border-danger/40 text-danger"
                  : isPass
                  ? "bg-surface border-border text-text-primary"
                  : "bg-surface/30 border-border/30 text-text-secondary opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{info.name}</span>
                <span className="text-[11px] text-text-secondary">
                  — {isPass ? info.passText : isFail ? info.failText : "Skipped"}
                </span>
              </div>
              <div>
                {isPass && <Check className="w-4 h-4 text-success" />}
                {isFail && <X className="w-4 h-4 text-danger" />}
                {!isPass && !isFail && <Minus className="w-4 h-4 text-text-secondary" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
