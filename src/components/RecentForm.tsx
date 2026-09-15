import Link from "next/link";
import { HeroIcon } from "./HeroIcon";
import type { TrendMatchSummary } from "@/lib/types";

export function RecentForm({
  accountId,
  matches,
}: {
  accountId: number;
  matches: TrendMatchSummary[];
}) {
  const wins = matches.filter((m) => m.win).length;

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          Recent form
        </h3>
        <span className="text-xs font-mono text-ink-muted">
          {wins}W - {matches.length - wins}L
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matches.map((m) => (
          <Link
            key={m.matchId}
            href={`/player/${accountId}/match/${m.matchId}`}
            title={`${m.heroName} - ${m.win ? "Win" : "Loss"} (${m.kills}/${m.deaths}/${m.assists})`}
            className="rounded-md p-0.5"
            style={{
              border: `1.5px solid ${m.win ? "var(--color-status-good)" : "var(--color-status-critical)"}`,
            }}
          >
            <HeroIcon heroId={m.heroId} size={30} />
          </Link>
        ))}
      </div>
    </div>
  );
}
