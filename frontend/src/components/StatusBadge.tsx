// frontend/src/components/StatusBadge.tsx
import React from "react";
import { DECISION_LABELS } from "../lib/statusTranslations";

interface StatusBadgeProps {
  decision: "allowed" | "blocked" | "pending" | string;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ decision, size = "md" }) => {
  const normDecision = (decision || "").toLowerCase();
  const config = DECISION_LABELS[normDecision] || {
    label: decision || "Unknown",
    icon: "•",
    style: "bg-surface-2 text-text-secondary border-border",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-xs font-semibold px-2.5 py-1 gap-1.5",
    lg: "text-sm font-semibold px-3 py-1.5 gap-2",
  };

  return (
    <span
      role="status"
      aria-label={`Transaction status: ${config.label}`}
      className={`inline-flex items-center rounded-full border tracking-wide uppercase font-mono ${sizeStyles[size]} ${config.style}`}
    >
      <span aria-hidden="true" className="text-[1.1em] font-bold">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </span>
  );
};
