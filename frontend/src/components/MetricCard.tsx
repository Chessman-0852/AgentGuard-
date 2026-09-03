// frontend/src/components/MetricCard.tsx
import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  trendPositive?: boolean;
  statusIcon?: React.ReactNode;
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  trendPositive,
  statusIcon,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 animate-pulse min-h-[120px]">
        <div className="h-3.5 bg-surface-2 rounded w-1/2 mb-4"></div>
        <div className="h-7 bg-surface-2 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-surface-2 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 transition-all duration-200 hover:border-[#3d4b5a] shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between text-text-secondary text-xs font-medium uppercase tracking-wider mb-2">
        <span>{label}</span>
        {statusIcon && <span className="text-text-primary">{statusIcon}</span>}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium font-mono px-1.5 py-0.5 rounded ${
              trendPositive
                ? "text-success bg-success/10"
                : "text-text-secondary bg-surface-2"
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtext && (
        <div className="text-xs text-text-secondary line-clamp-1 mt-1 font-sans">
          {subtext}
        </div>
      )}
    </div>
  );
};
