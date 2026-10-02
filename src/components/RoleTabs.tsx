import { pluralRu } from "@/lib/format";
import type { RolePickStat } from "@/lib/types";

export function RoleTabs({
  roles,
  active,
  onSelect,
}: {
  roles: RolePickStat[];
  active: string | null;
  onSelect: (position: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {roles.map((r) => {
        const isActive = r.position === active;
        return (
          <button
            key={r.position}
            onClick={() => onSelect(r.position)}
            className={`text-left rounded-lg border px-3 py-2.5 transition ${
              isActive
                ? "border-accent bg-accent/10"
                : "border-border bg-surface hover:border-ink-muted/40"
            }`}
          >
            <div className="text-sm font-semibold text-ink">{r.roleLabel}</div>
            <div className="text-xs font-mono text-ink-muted">
              {r.games.toLocaleString("ru-RU")} {pluralRu(r.games, ["игра", "игры", "игр"])} ·{" "}
              <span
                style={{
                  color:
                    r.winRate >= 0.5
                      ? "var(--color-status-good)"
                      : "var(--color-status-critical)",
                }}
              >
                {(r.winRate * 100).toFixed(1)}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
