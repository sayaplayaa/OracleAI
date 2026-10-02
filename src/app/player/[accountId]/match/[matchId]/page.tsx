import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch, getBenchmarks, OpenDotaError } from "@/lib/opendota";
import { getMatchPlayerPositions } from "@/lib/stratz";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { computeFullMatchOverview, NORMAL_LOBBY_NAME } from "@/lib/metrics/fullMatchMetrics";
import { computeRoleComparisons } from "@/lib/metrics/roleComparison";
import { computeMatchStory } from "@/lib/metrics/matchStory";
import { computeSkillBuild } from "@/lib/metrics/skillBuild";
import { computeMatchCoreItems } from "@/lib/metrics/matchItemContext";
import { HeroIcon } from "@/components/HeroIcon";
import { AttributeBadge } from "@/components/AttributeBadge";
import { StatBar } from "@/components/StatBar";
import { StatTile } from "@/components/StatTile";
import { AICoachPanel } from "@/components/AICoachPanel";
import { MatchItemTimeline } from "@/components/MatchItemTimeline";
import { MatchTabs } from "@/components/MatchTabs";
import { MatchOverviewInteractive, type PlayerDetail } from "@/components/MatchOverviewInteractive";
import { WardsMap } from "@/components/WardsMap";
import { MovementHeatmap } from "@/components/MovementHeatmap";
import { ParseMatchButton } from "@/components/ParseMatchButton";
import { RoleComparisonCard } from "@/components/RoleComparisonCard";
import { MatchStoryTimeline } from "@/components/MatchStoryTimeline";
import { HeroSplashHeader } from "@/components/HeroSplashHeader";
import { PageContainer } from "@/components/PageContainer";
import { getHeroPrimaryAttr } from "@/lib/constants";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ accountId: string; matchId: string }>;
}) {
  const { accountId: accountIdParam, matchId: matchIdParam } = await params;
  const accountId = Number(accountIdParam);
  const matchId = Number(matchIdParam);
  if (
    !Number.isInteger(accountId) ||
    accountId <= 0 ||
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    notFound();
  }

  let match;
  try {
    match = await getMatch(matchId);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) notFound();
    throw err;
  }

  const player = match.players.find((p) => p.account_id === accountId);
  if (!player) notFound();

  // Benchmarks are fetched once per distinct hero in the lobby so every
  // player's detail panel (not just the page owner's) gets real percentiles.
  const uniqueHeroIds = [...new Set(match.players.map((p) => p.hero_id))];
  const benchmarksByHero = new Map(
    await Promise.all(
      uniqueHeroIds.map(
        async (heroId) => [heroId, await getBenchmarks(heroId).catch(() => null)] as const
      )
    )
  );

  const metrics = computeMatchMetrics(match, accountId, benchmarksByHero.get(player.hero_id) ?? null);
  const fullMatch = computeFullMatchOverview(match);

  // Best-effort: STRATZ gives a real per-match position classifier, but has
  // shown intermittent failures, so a GPM-rank estimate is always the fallback.
  const stratzPositions = await getMatchPlayerPositions(matchId).catch(() => null);
  const coreItemsByAccount = await computeMatchCoreItems(match, stratzPositions);

  const playerDetails: Record<number, PlayerDetail> = {};
  for (const p of match.players) {
    if (!p.account_id) continue;
    playerDetails[p.account_id] = {
      metrics: computeMatchMetrics(match, p.account_id, benchmarksByHero.get(p.hero_id) ?? null),
      skillBuild: computeSkillBuild(p, p.hero_id),
      coreItemKeys: [...(coreItemsByAccount.get(p.account_id) ?? [])],
    };
  }

  const roleComparisons = computeRoleComparisons(
    fullMatch.radiantPlayers,
    fullMatch.direPlayers,
    stratzPositions
  );
  const matchStory = computeMatchStory(match);

  const fullMatchContent = (
    <>
      <MatchOverviewInteractive
        radiantPlayers={fullMatch.radiantPlayers}
        direPlayers={fullMatch.direPlayers}
        playerDetails={playerDetails}
        matchId={matchId}
        focusedAccountId={accountId}
        goldAdvantage={fullMatch.goldAdvTrend.map((p) => p.value)}
        xpAdvantage={fullMatch.xpAdvTrend.map((p) => p.value)}
      />
      {fullMatch.isParsed ? (
        <>
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <WardsMap
              radiantPlayers={fullMatch.radiantPlayers}
              direPlayers={fullMatch.direPlayers}
            />
            <MovementHeatmap
              radiantPlayers={fullMatch.radiantPlayers}
              direPlayers={fullMatch.direPlayers}
            />
          </div>
        </>
      ) : (
        <ParseMatchButton matchId={matchId} />
      )}
    </>
  );

  const myPerformanceContent = (
    <>
      <div className="flex items-center gap-4">
        <HeroIcon heroId={metrics.heroId} size={56} />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink">{metrics.heroName}</h2>
            <AttributeBadge primaryAttr={getHeroPrimaryAttr(metrics.heroId)} />
            <span
              className="text-sm font-semibold"
              style={{
                color: metrics.win
                  ? "var(--color-status-good)"
                  : "var(--color-status-critical)",
              }}
            >
              {metrics.win ? "Победа" : "Поражение"}
            </span>
          </div>
          <p className="text-sm text-ink-muted">
            {metrics.role} · {formatDuration(metrics.duration)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="KDA"
          value={`${metrics.kills}/${metrics.deaths}/${metrics.assists}`}
          sub={`коэффициент ${metrics.kda.toLocaleString("ru-RU")}`}
        />
        <StatTile
          label="Добивания к 10:00"
          value={metrics.lastHitsAt10 !== null ? `${metrics.lastHitsAt10}` : "-"}
        />
        <StatTile label="Поставлено вардов" value={`${metrics.wardsPlaced}`} />
        <StatTile label="Бай-беки" value={`${metrics.buybacks}`} />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-1">
            Сравнение со всеми играми на {metrics.heroName}
          </h3>
          <p className="text-xs text-ink-muted mb-2">
            Перцентиль показывает, как цифра из этой игры выглядит на фоне всех игр на{" "}
            {metrics.heroName}, записанных в OpenDota.
          </p>
          <div className="divide-y divide-border">
            {metrics.stats.map((stat) => (
              <StatBar key={stat.label} stat={stat} />
            ))}
          </div>
        </div>

        {(metrics.itemTimeline.length > 0 || metrics.startingItems.length > 0) && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-3">
              Покупки по времени
            </h3>
            <MatchItemTimeline
              items={metrics.itemTimeline}
              startingItems={metrics.startingItems}
              coreItemKeys={playerDetails[accountId]?.coreItemKeys}
            />
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-2 text-sm text-ink-secondary">
        <span className="text-accent font-semibold">AI</span>
        Хочешь личный разбор этой игры? Открой AI-коуча в правом нижнем
        углу.
      </div>
    </>
  );

  const matchStoryContent = (
    <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-start">
      <div className="space-y-4">
        {roleComparisons.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Не хватает данных, чтобы сравнить игроков по позициям в этом матче.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {roleComparisons.map((entry) => (
              <RoleComparisonCard key={entry.position} entry={entry} />
            ))}
          </div>
        )}
        <AICoachPanel
          endpoint="/api/coach/match-story"
          body={{ matchId }}
          label="Что решило исход игры?"
        />
      </div>
      <div className="lg:sticky lg:top-20">
        <MatchStoryTimeline story={matchStory} />
      </div>
    </div>
  );

  return (
    <PageContainer>
      <Link
        href={`/player/${accountId}`}
        className="text-sm text-accent hover:underline"
      >
        ← Назад к профилю
      </Link>

      <div className="mt-4 mb-6">
        <HeroSplashHeader
          heroId={metrics.heroId}
          eyebrow={fullMatch.radiantWin ? "Победа Сил Света" : "Победа Сил Тьмы"}
          accent={
            fullMatch.radiantWin ? "var(--color-status-good)" : "var(--color-status-critical)"
          }
          title={metrics.heroName}
          subtitle={
            <>
              {formatDuration(fullMatch.duration)}
              {fullMatch.radiantScore !== null &&
                ` · ${fullMatch.radiantScore} - ${fullMatch.direScore}`}
              {` · ${fullMatch.gameMode}`}
              {fullMatch.lobbyType !== NORMAL_LOBBY_NAME && ` (${fullMatch.lobbyType})`}
              {fullMatch.patch && ` · Патч ${fullMatch.patch}`}
            </>
          }
        />
      </div>

      <MatchTabs
        tabs={[
          { id: "full", label: "Весь матч", content: fullMatchContent },
          { id: "story", label: "Ход игры", content: matchStoryContent },
          { id: "mine", label: "Моя игра", content: myPerformanceContent },
        ]}
      />
    </PageContainer>
  );
}
