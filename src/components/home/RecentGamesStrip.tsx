import Image from "next/image";
import Link from "next/link";
import { getRecentMatches } from "@/lib/opendota";
import { getHeroImage, getHeroName } from "@/lib/constants";
import { formatMatchTime, timeAgoRu } from "@/lib/format";
import { AnalyzedBadge } from "../AnalyzedBadge";

const SHOWN = 8;

/** The signed-in player's latest games as a horizontal strip, newest first. */
export async function RecentGamesStrip({ accountId }: { accountId: number }) {
  const matches = await getRecentMatches(accountId, 20).catch(() => null);
  if (!matches || matches.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary">
        {matches === null
          ? "OpenDota сейчас не отвечает - список игр появится через минуту."
          : "Пока не видно ни одной игры. Включи в Dota 2 опцию «Expose Public Match Data» и сыграй матч."}
      </div>
    );
  }

  const latest = matches[0];
  const wins = matches.filter((m) => (m.player_slot < 128) === m.radiant_win).length;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-xl text-ink">Твои последние игры</h2>
          <p className="text-sm text-ink-muted mt-1">
            {wins} побед из {matches.length} · выбери матч для разбора
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/analysis/${latest.match_id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-page hover:brightness-110 transition"
          >
            Разобрать последнюю игру
          </Link>
          <Link
            href="/games"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink hover:border-accent/60 transition"
          >
            Все игры →
          </Link>
        </div>
      </div>

      <ul className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {matches.slice(0, SHOWN).map((game) => {
          const won = (game.player_slot < 128) === game.radiant_win;
          const color = won ? "var(--color-status-good)" : "var(--color-status-critical)";
          const image = getHeroImage(game.hero_id);
          return (
            <li key={game.match_id} className="snap-start shrink-0 w-[240px]">
              <Link
                href={`/analysis/${game.match_id}`}
                className="group block bg-surface border border-border hover:border-accent/60 rounded-2xl overflow-hidden transition hover:-translate-y-0.5"
              >
                <div className="relative h-[100px] bg-surface-raised">
                  {image && (
                    <Image src={image} alt="" fill sizes="240px" className="object-cover group-hover:scale-105 transition duration-300" unoptimized />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                  <span className="absolute left-0 inset-y-0 w-1" style={{ background: color }} aria-hidden />
                  <span className="absolute right-2 top-2">
                    <AnalyzedBadge accountId={accountId} matchId={game.match_id} />
                  </span>
                </div>
                <div className="px-3.5 pb-3.5 -mt-3 relative">
                  <p className="font-semibold text-sm text-ink truncate">{getHeroName(game.hero_id)}</p>
                  <p className="text-[11px] mt-1 flex items-center gap-1.5 text-ink-muted font-mono tabular-nums">
                    <span className="font-sans font-bold uppercase tracking-wide" style={{ color }}>
                      {won ? "Победа" : "Поражение"}
                    </span>
                    · {game.kills}/{game.deaths}/{game.assists} · {formatMatchTime(game.duration)}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">{timeAgoRu(game.start_time)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RecentGamesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-7 w-64 rounded bg-surface animate-pulse" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[240px] h-[168px] rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
