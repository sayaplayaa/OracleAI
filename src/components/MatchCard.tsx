import Image from "next/image";
import Link from "next/link";
import { getHeroImage } from "@/lib/constants";
import { formatMatchTime, timeAgoRu } from "@/lib/format";
import { modeTag } from "@/lib/metrics/gameContext";
import type { TrendMatchSummary } from "@/lib/types";

export function ModeChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0 px-1.5 py-px rounded border border-border text-ink-muted">
      {tag}
    </span>
  );
}

/**
 * One game in a player's list. The whole row opens the match stats; on the
 * signed-in player's own profile a second button opens the AI analysis.
 */
export function MatchCard({
  accountId,
  match,
  analyzable = false,
}: {
  accountId: number;
  match: TrendMatchSummary;
  analyzable?: boolean;
}) {
  const color = match.win ? "var(--color-status-good)" : "var(--color-status-critical)";
  const image = getHeroImage(match.heroId);

  return (
    <div className="group relative flex items-center gap-3 sm:gap-4 pl-4 pr-3 py-3 hover:bg-surface-raised transition">
      <span className="absolute left-0 inset-y-2 w-1 rounded-r" style={{ background: color }} aria-hidden />
      <div className="relative w-[64px] h-[36px] rounded-md overflow-hidden bg-surface-raised shrink-0 border border-border">
        {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" unoptimized />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/player/${accountId}/match/${match.matchId}`}
            className="text-sm font-semibold text-ink truncate after:absolute after:inset-0 after:content-[''] group-hover:text-accent transition"
          >
            {match.heroName}
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ color }}>
            {match.win ? "Победа" : "Поражение"}
          </span>
          <ModeChip tag={modeTag(match.gameMode)} />
        </div>
        <div
          className="text-xs text-ink-muted font-mono tabular-nums mt-0.5 truncate"
          title="Убийства/смерти/помощь · GPM - золото в минуту · XPM - опыт в минуту"
        >
          <span className="text-ink-secondary">
            {match.kills}/<span className="text-status-critical">{match.deaths}</span>/{match.assists}
          </span>
          {match.gpm !== null && ` · ${match.gpm} GPM`}
          {match.xpm !== null && ` · ${match.xpm} XPM`}
        </div>
      </div>
      <div className="text-right text-xs text-ink-muted shrink-0 hidden sm:block">
        <div className="font-mono tabular-nums">{formatMatchTime(match.duration)}</div>
        <div suppressHydrationWarning>{timeAgoRu(match.startTime)}</div>
      </div>
      {analyzable ? (
        <Link
          href={`/analysis/${match.matchId}`}
          className="relative z-10 shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-page transition"
        >
          Разбор
        </Link>
      ) : (
        <span className="text-accent opacity-0 group-hover:opacity-100 transition shrink-0" aria-hidden>
          →
        </span>
      )}
    </div>
  );
}
