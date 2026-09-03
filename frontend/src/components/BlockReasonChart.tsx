// frontend/src/components/BlockReasonChart.tsx
import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { AuditEntryPayload } from "../lib/api";
import { getBlockReasonDetail } from "../lib/statusTranslations";

interface BlockReasonChartProps {
  entries: AuditEntryPayload[];
}

export const BlockReasonChart: React.FC<BlockReasonChartProps> = ({ entries }) => {
  const blockedEntries = entries.filter((e) => e.final_decision === "blocked");

  if (blockedEntries.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center text-text-secondary text-xs h-[280px] flex items-center justify-center">
        No blocked requests to analyze. Run an Attack Simulator scenario to observe security distribution.
      </div>
    );
  }

  // Count blocked reasons with translation
  const countMap: Record<string, number> = {};
  blockedEntries.forEach((e) => {
    const detail = getBlockReasonDetail(e.block_reason);
    countMap[detail.short] = (countMap[detail.short] || 0) + 1;
  });

  const data = Object.entries(countMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Interception Breakdown
        </h3>
        <span className="font-mono text-xs text-text-secondary">
          {blockedEntries.length} total blocked
        </span>
      </div>

      <div className="h-[220px] w-full" aria-label="Horizontal bar chart of security block reasons">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: "#A1A7B3", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              contentStyle={{
                backgroundColor: "#11161D",
                borderColor: "#26303A",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#E6E7EB",
              }}
              formatter={(val: any) => [`${val} requests`, "Count"]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? "#EF4444" : "#F59E0B"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
