// frontend/src/components/SecurityPipeline.tsx
import React from "react";
import { GATE_DISPLAY_INFO } from "../lib/statusTranslations";
import { Check, X, Minus, ArrowRight } from "lucide-react";

export interface GateExecution {
  id: "intent" | "policy" | "cart" | "risk" | "idempotency" | "payment";
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
      <div className="hidden lg:flex items-center justify-between gap-1.5">
        {gates.map((gate, idx) => {
          const info = GATE_DISPLAY_INFO[gate.id] || {
            name: gate.id,
            description: "",
            passText: "Passed",
            failText: "Blocked",
          };

          const isPass = gate.status === "pass";
          const isFail = gate.status === "fail";
          const isSkipped = gate.status === "skipped";

          return (
            <React.Fragment key={gate.id}>
              <div
                className={`flex-1 rounded-[16px] border p-3 transition-all duration-200 ${
                  isFail
                    ? "bg-danger/10 border-danger text-danger shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    : isPass
                    ? "bg-surface border-border hover:border-neon-pulse/40"
                    : "bg-surface/30 border-border/40 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary truncate">
                    {info.name}
                  </span>
                  <div
                    aria-label={`Gate ${info.name}: ${
                      isPass ? "Passed" : isFail ? "Blocked" : "Not reached"
                    }`}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPass
                        ? "bg-neon-pulse/20 text-neon-pulse"
                        : isFail
                        ? "bg-danger text-white animate-pulse"
                        : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    {isPass && <Check className="w-3 h-3" />}
                    {isFail && <X className="w-3 h-3" />}
                    {isSkipped && <Minus className="w-3 h-3" />}
                  </div>
                </div>

                <div className={`text-xs font-medium truncate ${isFail ? "text-danger font-semibold" : "text-text-primary"}`}>
                  {isPass ? info.passText : isFail ? info.failText : "Standby"}
                </div>

                {!compact && gate.latencyMs !== undefined && gate.latencyMs !== null && (
                  <div className="text-[10px] font-mono text-text-secondary mt-1">
                    {gate.latencyMs}ms
                  </div>
                )}
              </div>

              {idx < gates.length - 1 && (
                <div className="text-border px-0.5 select-none shrink-0" aria-hidden="true">
                  <ArrowRight className="w-3.5 h-3.5 text-text-secondary/40" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile & Tablet layout: 2-column or vertical sequence */}
      <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-2">
        {gates.map((gate) => {
          const info = GATE_DISPLAY_INFO[gate.id] || {
            name: gate.id,
            description: "",
            passText: "Passed",
            failText: "Blocked",
          };
          const isPass = gate.status === "pass";
          const isFail = gate.status === "fail";
          const isSkipped = gate.status === "skipped";

          return (
            <div
              key={gate.id}
              className={`rounded-[14px] border p-2.5 ${
                isFail
                  ? "bg-danger/10 border-danger text-danger"
                  : isPass
                  ? "bg-surface border-border"
                  : "bg-surface/30 border-border/40 opacity-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary truncate">
                  {info.name}
                </span>
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                    isPass
                      ? "bg-neon-pulse/20 text-neon-pulse"
                      : isFail
                      ? "bg-danger text-white"
                      : "bg-surface-2 text-text-secondary"
                  }`}
                >
                  {isPass && <Check className="w-2.5 h-2.5" />}
                  {isFail && <X className="w-2.5 h-2.5" />}
                  {isSkipped && <Minus className="w-2.5 h-2.5" />}
                </div>
              </div>
              <div className="text-xs font-medium text-text-primary truncate">
                {isPass ? info.passText : isFail ? info.failText : "Standby"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
