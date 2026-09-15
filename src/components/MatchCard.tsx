import Link from "next/link";
import { HeroIcon } from "./HeroIcon";
import type { TrendMatchSummary } from "@/lib/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.floor(diffMs / 60_000);
  return `${Math.max(mins, 1)}m ago`;
}

export function MatchCard({
  accountId,
  match,
}: {
  accountId: number;
  match: TrendMatchSummary;
}) {
  return (
    <Link
      href={`/player/${accountId}/match/${match.matchId}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-surface-raised transition border-l-2"
      style={{
        borderColor: match.win
          ? "var(--color-status-good)"
          : "var(--color-status-critical)",
      }}
    >
      <HeroIcon heroId={match.heroId} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink truncate">
            {match.heroName}
          </span>
          <span
            className="text-xs font-semibold"
            style={{
              color: match.win
                ? "var(--color-status-good)"
                : "var(--color-status-critical)",
            }}
          >
            {match.win ? "Win" : "Loss"}
          </span>
        </div>
        <div className="text-xs text-ink-muted font-mono tabular-nums">
          {match.kills}/{match.deaths}/{match.assists} · {match.gpm} GPM ·{" "}
          {match.xpm} XPM
        </div>
      </div>
      <div className="text-right text-xs text-ink-muted shrink-0">
        <div>{formatDuration(match.duration)}</div>
        <div>{timeAgo(match.startTime)}</div>
      </div>
    </Link>
  );
}
