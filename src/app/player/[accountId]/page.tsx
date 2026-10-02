import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProfile,
  getWinLoss,
  getRecentMatches,
  getHeroStats,
  getProPlayers,
  getHeroLeagueMatches,
  getMatchesForHero,
  OpenDotaError,
} from "@/lib/opendota";
import { computeTrendMetrics, selectNotableMatches } from "@/lib/metrics/trendMetrics";
import { findSignatureHero } from "@/lib/metrics/signatureHero";
import { computeProHeroSpotlight, findProForHero } from "@/lib/metrics/proComparison";
import { getHeroName, getRankInfo } from "@/lib/constants";
import { pluralRu } from "@/lib/format";
import { StatTile } from "@/components/StatTile";
import { RankTile } from "@/components/RankTile";
import { MmrTile } from "@/components/MmrTile";
import { ProHeroSpotlightCard } from "@/components/ProHeroSpotlightCard";
import { RecentForm } from "@/components/RecentForm";
import { MatchCard } from "@/components/MatchCard";
import { MatchHistory } from "@/components/MatchHistory";
import { SignatureHeroCard } from "@/components/SignatureHeroCard";
import { AICoachPanel } from "@/components/AICoachPanel";
import { MatchTabs } from "@/components/MatchTabs";
import { PageContainer } from "@/components/PageContainer";

// Overview pulls from this larger pool so it can pick the matches most worth
// reviewing rather than just whatever happened most recently; Match History
// reuses the same pool as its first page so "Load more" continues correctly.
const POOL_SIZE = 20;
const HIGHLIGHT_COUNT = 10;

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId: accountIdParam } = await params;
  const accountId = Number(accountIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0) notFound();

  let profile, winLoss, matches, heroStats;
  try {
    [profile, winLoss, matches, heroStats] = await Promise.all([
      getProfile(accountId),
      getWinLoss(accountId),
      getRecentMatches(accountId, POOL_SIZE),
      getHeroStats(accountId),
    ]);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) notFound();
    throw err;
  }

  const trends = computeTrendMetrics(accountId, matches, heroStats);
  const notableMatches = selectNotableMatches(
    trends.recentMatches,
    trends.avgKda,
    HIGHLIGHT_COUNT
  );
  const signatureHero = findSignatureHero(heroStats);
  const rankInfo = getRankInfo(profile.computed_mmr, profile.leaderboard_rank);

  // Find a real, currently-active pro who has actually played the same
  // signature hero in a recent tournament game - never a ladder grinder
  // who happens to be tagged pro, and never a fabricated example.
  let proSpotlight = null;
  let proSpotlightUnavailable = false;
  if (signatureHero) {
    // Optional card: the pro roster is a very large response, so a flaky or
    // throttled connection must not take the whole player page down with it.
    try {
      const [proPlayers, leagueMatches] = await Promise.all([
        getProPlayers(),
        getHeroLeagueMatches(signatureHero.hero_id),
      ]);
      const found = findProForHero(leagueMatches, proPlayers);
      if (found) {
        const [proHeroStats, proMatches] = await Promise.all([
          getHeroStats(found.pro.accountId),
          getMatchesForHero(found.pro.accountId, signatureHero.hero_id, 20),
        ]);
        const proHeroStat = proHeroStats.find((h) => h.hero_id === signatureHero.hero_id);
        proSpotlight = computeProHeroSpotlight(
          signatureHero.hero_id,
          found.pro,
          proHeroStat,
          proMatches,
          found.leagueGames
        );
      }
    } catch (err) {
      if (!(err instanceof OpenDotaError)) throw err;
      proSpotlightUnavailable = true;
    }
  }
  const lifetimeTotal = winLoss.win + winLoss.lose;
  const lifetimeWinRate = lifetimeTotal > 0 ? winLoss.win / lifetimeTotal : 0;

  const overviewContent = trends.sampleSize === 0 ? (
    <p className="text-ink-secondary">Не нашли недавних игр этого игрока.</p>
  ) : (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label={`Винрейт (последние ${trends.sampleSize})`}
          value={`${Math.round(trends.winRate * 100)}%`}
        />
        <StatTile label="Средний KDA" value={`${trends.avgKda}`} />
        <RankTile rank={rankInfo} />
        <MmrTile rank={rankInfo} />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4 items-start">
        <div className="space-y-4">
          {signatureHero && (
            <SignatureHeroCard
              accountId={accountId}
              heroId={signatureHero.hero_id}
              heroName={getHeroName(signatureHero.hero_id)}
              games={signatureHero.games}
              winRate={signatureHero.games > 0 ? signatureHero.win / signatureHero.games : 0}
            />
          )}
          <AICoachPanel
            endpoint="/api/coach/trends"
            body={{ accountId, limit: POOL_SIZE }}
            label="Разбор трендов от ИИ"
          />
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {proSpotlight && signatureHero ? (
              <ProHeroSpotlightCard
                accountId={accountId}
                heroId={signatureHero.hero_id}
                spotlight={proSpotlight}
              />
            ) : (
              <div className="bg-surface border border-border rounded-lg p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">
                  Про-игрок на твоём герое
                </h3>
                <p className="text-sm text-ink-muted">
                  {proSpotlightUnavailable
                    ? "Сейчас не получилось загрузить данные про-игроков из OpenDota - попробуй ещё раз через минуту."
                    : signatureHero
                      ? "Пока не нашли недавних турнирных игр на этом герое."
                      : "Сыграй несколько игр, чтобы появился сигнатурный герой, - и посмотри, как на нём играет про-игрок."}
                </p>
              </div>
            )}
            <RecentForm accountId={accountId} matches={trends.recentMatches.slice(0, 10)} />
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-1">
              Игры, которые стоит разобрать
            </h2>
            <p className="text-xs text-ink-muted mb-3">
              Выбраны из твоих последних {trends.sampleSize}{" "}
              {pluralRu(trends.sampleSize, ["игры", "игр", "игр"])} - сначала поражения,
              потом игры, где KDA или число смертей заметно хуже твоего среднего.
              Полный список - во вкладке «История игр».
            </p>
            <div className="bg-surface border border-border rounded-lg divide-y divide-border overflow-hidden">
              {notableMatches.map((m) => (
                <MatchCard key={m.matchId} accountId={accountId} match={m} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {profile.profile.avatarfull && (
            <Image
              src={profile.profile.avatarfull}
              alt={profile.profile.personaname}
              width={64}
              height={64}
              className="rounded-lg"
              unoptimized
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-ink">
              {profile.profile.personaname}
            </h1>
            <p className="text-sm text-ink-muted">
              За всё время: {winLoss.win.toLocaleString("ru-RU")}{" "}
              {pluralRu(winLoss.win, ["победа", "победы", "побед"])} -{" "}
              {winLoss.lose.toLocaleString("ru-RU")}{" "}
              {pluralRu(winLoss.lose, ["поражение", "поражения", "поражений"])} (
              {Math.round(lifetimeWinRate * 100)}%)
            </p>
          </div>
          <Link
            href={profile.profile.profileurl}
            target="_blank"
            className="ml-auto text-xs text-accent hover:underline"
          >
            Профиль Steam ↗
          </Link>
        </div>

        <MatchTabs
          tabs={[
            { id: "overview", label: "Обзор", content: overviewContent },
            {
              id: "history",
              label: "История игр",
              content: (
                <MatchHistory accountId={accountId} initialMatches={trends.recentMatches} />
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}
