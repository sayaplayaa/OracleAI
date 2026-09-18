"use client";

import { HeroIcon } from "./HeroIcon";
import type { FullMatchPlayer } from "@/lib/types";

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
  const all = [...radiantPlayers, ...direPlayers].sort((a, b) => b.netWorth - a.netWorth);
  const maxNetWorth = Math.max(1, ...all.map((p) => p.netWorth));

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
        Net worth
      </h3>
      <div className="space-y-1.5">
        {all.map((p) => {
          const pct = (p.netWorth / maxNetWorth) * 100;
          const accent = p.isRadiant
            ? "var(--color-status-good)"
            : "var(--color-status-critical)";
          const isSelected = p.accountId !== null && p.accountId === selectedAccountId;
          return (
            <button
              key={`${p.heroId}-${p.accountId ?? "anon"}`}
              onClick={() => p.accountId !== null && onSelect(p.accountId)}
              disabled={p.accountId === null}
              className={`w-full flex items-center gap-2 rounded-md px-1.5 py-1 transition text-left disabled:cursor-default ${
                isSelected ? "bg-surface-raised ring-1 ring-accent" : "hover:bg-surface-raised"
              }`}
            >
              <HeroIcon heroId={p.heroId} size={24} />
              <span className="text-xs text-ink-secondary w-28 truncate shrink-0">
                {p.heroName}
              </span>
              <div className="flex-1 h-4 rounded bg-baseline overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${Math.max(2, pct)}%`, background: accent }}
                />
              </div>
              <span className="text-xs font-mono text-ink w-14 text-right shrink-0">
                {p.netWorth.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
