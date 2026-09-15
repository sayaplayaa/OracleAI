"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendMetrics } from "@/lib/types";

const BLUE = "#3987e5";
const ORANGE = "#d95926";
const GRID = "#2c2c2a";
const MUTED = "#898781";
const SURFACE = "#1a1a19";
const BORDER = "rgba(255,255,255,0.1)";

export function TrendChart({ metrics }: { metrics: TrendMetrics }) {
  const data = metrics.gpmTrend.map((g, i) => ({
    match: g.match,
    gpm: g.value,
    xpm: metrics.xpmTrend[i]?.value ?? null,
  }));

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-secondary">
          GPM / XPM - last {metrics.sampleSize} games (oldest to newest)
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="match"
            tick={{ fill: MUTED, fontSize: 12 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: MUTED, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: MUTED }}
            labelFormatter={(v) => `Match ${v}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: MUTED }}
            formatter={(value) => (value === "gpm" ? "GPM" : "XPM")}
          />
          <Line
            type="monotone"
            dataKey="gpm"
            stroke={BLUE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="xpm"
            stroke={ORANGE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
