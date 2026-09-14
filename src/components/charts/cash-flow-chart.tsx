"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartDataPoint {
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
}

interface CashFlowChartProps {
  data: ChartDataPoint[];
  currencySymbol?: string;
}

function formatAxis(value: number, sym: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${sym}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${sign}${sym}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

export function CashFlowChart({ data, currencySymbol = "₹" }: CashFlowChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatAxis(v, currencySymbol)}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${currencySymbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
            name === "inflow" ? "Inflow" : name === "outflow" ? "Outflow" : "Balance",
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) =>
            value === "inflow" ? "Inflow" : value === "outflow" ? "Outflow" : "Balance"
          }
        />
        <Bar dataKey="inflow" fill="#22c55e" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="outflow" fill="#f97316" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#3b82f6" }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
