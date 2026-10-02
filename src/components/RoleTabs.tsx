import { pluralRu } from "@/lib/format";
import type { RolePickStat } from "@/lib/types";

/** Role picker for a hero's build: each role with its share of games and win rate. */
export function RoleTabs({
  roles,
  active,
  onSelect,
}: {
  roles: RolePickStat[];
  active: string | null;
  onSelect: (position: string) => void;
}) {
  const totalGames = roles.reduce((sum, r) => sum + r.games, 0) || 1;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2" role="group" aria-label="Позиция">
      {roles.map((r) => {
        const isActive = r.position === active;
        const share = r.games / totalGames;
        const color = r.winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)";
        return (
          <button
            key={r.position}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(r.position)}
            className={`text-left rounded-xl border px-3.5 py-3 transition ${
              isActive ? "border-accent bg-accent/10" : "border-border bg-page/50 hover:border-accent/40"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm font-semibold ${isActive ? "text-accent" : "text-ink"}`}>{r.roleLabel}</span>
              <span className="font-mono text-sm tabular-nums" style={{ color }}>
                {(r.winRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-page overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(3, share * 100)}%` }} />
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-ink-muted tabular-nums">
              {Math.round(share * 100)}% игр · {r.games.toLocaleString("ru-RU")} {pluralRu(r.games, ["игра", "игры", "игр"])}
            </div>
          </button>
        );
      })}
    </div>
  );
}
