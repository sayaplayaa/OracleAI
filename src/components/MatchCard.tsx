import Link from "next/link";
import { HeroIcon } from "./HeroIcon";
import { timeAgoRu } from "@/lib/format";
import type { TrendMatchSummary } from "@/lib/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
            {match.win ? "Победа" : "Поражение"}
          </span>
        </div>
        <div
          className="text-xs text-ink-muted font-mono tabular-nums"
          title="Киллы/смерти/помощи · GPM - золото в минуту · XPM - опыт в минуту"
        >
          {match.kills}/{match.deaths}/{match.assists}
          {match.gpm !== null && ` · ${match.gpm} GPM`}
          {match.xpm !== null && ` · ${match.xpm} XPM`}
        </div>
      </div>
      <div className="text-right text-xs text-ink-muted shrink-0">
        <div>{formatDuration(match.duration)}</div>
        <div>{timeAgoRu(match.startTime)}</div>
      </div>
    </Link>
  );
}
