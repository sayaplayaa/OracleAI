import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/session";
import { getRecentMatches } from "@/lib/opendota";
import { getHeroImage, getHeroName } from "@/lib/constants";
import { formatMatchTime, timeAgoRu } from "@/lib/format";
import { AnalysisView } from "@/components/AnalysisView";
import { StatsButton } from "@/components/SimpleReport";
import type { OpenDotaRecentMatch } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-page/50 border border-border px-3.5 py-2.5 min-w-[88px]">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="font-mono text-base text-ink tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function MatchBanner({ game, matchId, accountId }: { game: OpenDotaRecentMatch | null; matchId: number; accountId: number }) {
  const won = game ? (game.player_slot < 128) === game.radiant_win : null;
  const color =
    won === null ? "var(--color-accent)" : won ? "var(--color-status-good)" : "var(--color-status-critical)";
  const image = game ? getHeroImage(game.hero_id) : "";

  return (
    <div
      className="relative overflow-hidden bg-surface border border-border rounded-2xl"
      style={{ boxShadow: `inset 4px 0 0 0 ${color}` }}
    >
      {image && (
        <div className="absolute inset-y-0 right-0 w-2/3 opacity-25 pointer-events-none" aria-hidden>
          <Image src={image} alt="" fill className="object-cover object-center" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent" />
        </div>
      )}
      <div className="relative px-5 py-5 sm:px-7 sm:py-6 flex items-center gap-6 flex-wrap">
        {game ? (
          <>
            {image && (
              <Image
                src={image}
                alt={getHeroName(game.hero_id)}
                width={160}
                height={90}
                className="rounded-xl border border-border shrink-0 w-[128px] sm:w-[160px] h-auto"
                unoptimized
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink">{getHeroName(game.hero_id)}</h1>
                <span
                  className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border"
                  style={{ color, borderColor: color }}
                >
                  {won ? "Победа" : "Поражение"}
                </span>
              </div>
              <p className="text-sm text-ink-muted mt-1.5">
                Матч #{matchId} · {timeAgoRu(game.start_time)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap lg:ml-auto">
              <Stat label="K / D / A" value={`${game.kills}/${game.deaths}/${game.assists}`} />
              <Stat label="Длительность" value={formatMatchTime(game.duration)} />
              {typeof game.gold_per_min === "number" && <Stat label="GPM" value={String(game.gold_per_min)} />}
              {typeof game.last_hits === "number" && <Stat label="Добивания" value={String(game.last_hits)} />}
            </div>
          </>
        ) : (
          <h1 className="font-display font-bold text-2xl text-ink">Матч #{matchId}</h1>
        )}
        <div className={game ? "w-full lg:w-auto flex lg:block" : "ml-auto"}>
          <StatsButton accountId={accountId} matchId={matchId} />
        </div>
      </div>
    </div>
  );
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  // The list is small and cached; older games that fell out of it just get a
  // plain header - the analysis itself doesn't depend on it.
  const recent = await getRecentMatches(accountId, 20).catch(() => []);
  const game = recent.find((m) => m.match_id === matchId) ?? null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <nav className="flex items-center gap-2 text-sm text-ink-muted" aria-label="Навигация">
        <Link href="/" className="hover:text-accent transition">
          Главная
        </Link>
        <span aria-hidden>/</span>
        <Link href="/games" className="hover:text-accent transition">
          Мои игры
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink-secondary">Разбор</span>
      </nav>

      <MatchBanner game={game} matchId={matchId} accountId={accountId} />

      <AnalysisView accountId={accountId} matchId={matchId} />
    </div>
  );
}
