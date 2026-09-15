const ROLE_ORDER = ["Safe Lane", "Mid Lane", "Off Lane", "Jungle", "Unknown"];

export function RoleDistribution({
  distribution,
  totalGames,
}: {
  distribution: Record<string, number>;
  totalGames: number;
}) {
  const entries = ROLE_ORDER.filter((role) => distribution[role] > 0).map((role) => ({
    role,
    games: distribution[role],
  }));

  if (entries.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
          Lane distribution
        </h3>
        <p className="text-sm text-ink-muted">No lane data recorded for these games.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
        Lane distribution
      </h3>
      <ul className="space-y-2.5">
        {entries.map(({ role, games }) => {
          const pct = totalGames > 0 ? (games / totalGames) * 100 : 0;
          return (
            <li key={role}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-secondary">{role}</span>
                <span className="font-mono text-ink-muted">
                  {games}g · {Math.round(pct)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-baseline overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
