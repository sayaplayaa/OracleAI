"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RADIANT_GREEN = "#008300";
const DIRE_RED = "#e34948";
const GRID = "#2c2c2a";
const MUTED = "#898781";
const SURFACE = "#1a1a19";
const BORDER = "rgba(255,255,255,0.1)";

export function TeamAdvantageChart({
  goldAdvTrend,
  xpAdvTrend,
}: {
  goldAdvTrend: { minute: number; value: number }[];
  xpAdvTrend: { minute: number; value: number }[];
}) {
  const [metric, setMetric] = useState<"gold" | "xp">("gold");
  const trend = metric === "gold" ? goldAdvTrend : xpAdvTrend;

  const data = trend.map((d) => ({
    minute: d.minute,
    radiantLead: Math.max(0, d.value),
    direLead: Math.min(0, d.value),
  }));

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-secondary">
          Team {metric === "gold" ? "net worth" : "experience"} advantage
        </h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setMetric("gold")}
            className={`px-2.5 py-1 rounded ${metric === "gold" ? "bg-accent text-white" : "text-ink-muted hover:text-ink"}`}
          >
            Gold
          </button>
          <button
            onClick={() => setMetric("xp")}
            className={`px-2.5 py-1 rounded ${metric === "xp" ? "bg-accent text-white" : "text-ink-muted hover:text-ink"}`}
          >
            XP
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="minute"
            tick={{ fill: MUTED, fontSize: 12 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            label={{ value: "minute", position: "insideBottom", offset: -2, fill: MUTED, fontSize: 11 }}
          />
          <YAxis tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke={MUTED} />
          <Tooltip
            contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: MUTED }}
            labelFormatter={(v) => `Minute ${v}`}
            formatter={(value, key) => [
              Math.abs(Number(value)).toLocaleString(),
              key === "radiantLead" ? "Radiant lead" : "Dire lead",
            ]}
          />
          <Area
            type="monotone"
            dataKey="radiantLead"
            stroke={RADIANT_GREEN}
            fill={RADIANT_GREEN}
            fillOpacity={0.25}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="direLead"
            stroke={DIRE_RED}
            fill={DIRE_RED}
            fillOpacity={0.25}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-ink-muted mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: RADIANT_GREEN }} />
          Radiant lead
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: DIRE_RED }} />
          Dire lead
        </span>
      </div>
    </div>
  );
}
