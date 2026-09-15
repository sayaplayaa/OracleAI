import { HeroIcon } from "./HeroIcon";
import type { HeroMatchup } from "@/lib/types";

export function MatchupList({
  title,
  matchups,
  emptyMessage,
}: {
  title: string;
  matchups: HeroMatchup[];
  emptyMessage: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
        {title}
      </h3>
      {matchups.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2.5">
          {matchups.map((m) => (
            <li key={m.heroId} className="flex items-center gap-3">
              <HeroIcon heroId={m.heroId} size={28} />
              <span className="text-sm text-ink flex-1 truncate">{m.heroName}</span>
              <span className="text-xs text-ink-muted font-mono">{m.gamesPlayed}g</span>
              <span
                className="text-xs font-mono font-semibold w-12 text-right"
                style={{
                  color:
                    m.winRate >= 0.5
                      ? "var(--color-status-good)"
                      : "var(--color-status-critical)",
                }}
              >
                {Math.round(m.winRate * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
