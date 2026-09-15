import { HeroIcon } from "./HeroIcon";

export function HeroRankList({
  title,
  heroes,
}: {
  title: string;
  heroes: { heroId: number; heroName: string; games: number; winRate: number }[];
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
        {title}
      </h3>
      {heroes.length === 0 ? (
        <p className="text-sm text-ink-muted">Not enough games played.</p>
      ) : (
        <ul className="space-y-2.5">
          {heroes.map((h) => (
            <li key={h.heroId} className="flex items-center gap-3">
              <HeroIcon heroId={h.heroId} size={28} />
              <span className="text-sm text-ink flex-1 truncate">
                {h.heroName}
              </span>
              <span className="text-xs text-ink-muted font-mono">
                {h.games}g
              </span>
              <span
                className="text-xs font-mono font-semibold w-12 text-right"
                style={{
                  color:
                    h.winRate >= 0.5
                      ? "var(--color-status-good)"
                      : "var(--color-status-critical)",
                }}
              >
                {Math.round(h.winRate * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
