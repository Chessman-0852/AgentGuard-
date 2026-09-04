// frontend/src/components/MetricCard.tsx
import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  trendPositive?: boolean;
  statusIcon?: React.ReactNode;
  variant?: "default" | "danger" | "neon";
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  trendPositive,
  statusIcon,
  variant = "default",
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-[20px] p-5 animate-pulse min-h-[140px] flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-2"></div>
          <div className="h-3.5 bg-surface-2 rounded w-1/3"></div>
        </div>
        <div className="h-9 bg-surface-2 rounded w-1/2 my-2"></div>
        <div className="h-3 bg-surface-2 rounded w-2/3"></div>
      </div>
    );
  }

  const isDanger = variant === "danger";

  return (
    <div
      className={`rounded-[20px] p-5 transition-all duration-300 flex flex-col justify-between min-h-[140px] ${
        isDanger
          ? "bg-[#141214] border border-danger/50 shadow-[0_0_25px_rgba(239,68,68,0.15)] hover:border-danger/80"
          : "bg-surface border border-border hover:border-neon-pulse/40 hover:shadow-[0_0_20px_rgba(61,220,145,0.08)]"
      }`}
    >
      {/* Top row: Circular icon pill + Label */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          {statusIcon && (
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                isDanger
                  ? "bg-danger/15 text-danger border border-danger/30"
                  : "bg-neon-pulse/10 text-neon-pulse border border-neon-pulse/30"
              }`}
            >
              {statusIcon}
            </div>
          )}
          <span
            className={`text-sm font-medium tracking-tight ${
              isDanger ? "text-danger" : "text-neon-pulse font-medium"
            }`}
          >
            {label}
          </span>
        </div>

        {trend && (
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
              trendPositive
                ? "text-neon-pulse bg-neon-pulse/10 border border-neon-pulse/20"
                : "text-danger bg-danger/10 border border-danger/20"
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {/* Metric value */}
      <div className="my-1">
        <span
          className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight block ${
            isDanger ? "text-danger" : "text-text-primary"
          }`}
        >
          {value}
        </span>
      </div>

      {/* Subtext */}
      {subtext && (
        <div
          className={`text-xs truncate font-sans ${
            isDanger ? "text-danger/80" : "text-text-secondary"
          }`}
        >
          {subtext}
        </div>
      )}
    </div>
  );
};
