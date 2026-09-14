"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";

interface ForecastChartProps {
  data: Array<{ date: string; balance: number; inflows: number; outflows: number; threshold?: number }>;
  currencySymbol?: string;
  showThreshold?: boolean;
}

function fmt(v: number, sym: string) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${sym}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${sign}${sym}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

// Only show every ~10th label to avoid crowding
function tickFormatter(value: string, index: number) {
  return index % 10 === 0 ? value : "";
}

export function ForecastChart({ data, currencySymbol = "₹", showThreshold = false }: ForecastChartProps) {
  const thresholdValue = data[0]?.threshold ?? 0;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={tickFormatter}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => fmt(v, currencySymbol)}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${currencySymbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
            name === "balance" ? "Projected Balance" : name,
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        {showThreshold && thresholdValue > 0 && (
          <ReferenceLine
            y={thresholdValue}
            stroke="#ef4444"
            strokeDasharray="5 3"
            label={{ value: "Min Threshold", position: "right", fill: "#ef4444", fontSize: 10 }}
          />
        )}
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#balanceGrad)"
          dot={false}
          activeDot={{ r: 4 }}
          name="balance"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
