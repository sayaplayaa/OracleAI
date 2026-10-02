"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FullMatchPlayer } from "@/lib/types";

// Same team pair as the post-game graphs (MatchGraphs).
const RADIANT_GREEN = "#3fa34d";
const DIRE_RED = "#e34948";
const GRID = "var(--color-grid)";
const MUTED = "var(--color-ink-muted)";

export function NetWorthChart({
  radiantPlayers,
  direPlayers,
  selectedAccountId,
  onSelect,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  selectedAccountId: number | null;
  onSelect: (accountId: number) => void;
}) {
  const data = [...radiantPlayers, ...direPlayers]
    .sort((a, b) => b.netWorth - a.netWorth)
    .map((p) => ({
      name: p.heroName,
      netWorth: p.netWorth,
      accountId: p.accountId,
      isRadiant: p.isRadiant,
    }));

  return (
    <section className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Нетворс в конце игры</h3>
        <p className="text-xs text-ink-muted mt-1">
          Реплей не разобран, поэтому графиков по минутам нет - только итог. Нажми на полосу, чтобы открыть игрока.
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            tickFormatter={(v) => Number(v).toLocaleString("ru-RU")}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: MUTED, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-ink)" }}
            formatter={(value) => [Number(value).toLocaleString("ru-RU"), "Нетворс"]}
            cursor={{ fill: "rgba(255,214,170,0.05)" }}
          />
          <Bar
            dataKey="netWorth"
            radius={[0, 4, 4, 0]}
            onClick={(_entry, index) => {
              const accountId = data[index]?.accountId;
              if (accountId !== null && accountId !== undefined) onSelect(accountId);
            }}
            cursor="pointer"
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.isRadiant ? RADIANT_GREEN : DIRE_RED}
                fillOpacity={d.accountId === selectedAccountId ? 1 : 0.7}
                stroke={d.accountId === selectedAccountId ? "var(--color-accent)" : "transparent"}
                strokeWidth={2}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-ink-muted mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: RADIANT_GREEN }} />
          Radiant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: DIRE_RED }} />
          Dire
        </span>
      </div>
    </section>
  );
}
