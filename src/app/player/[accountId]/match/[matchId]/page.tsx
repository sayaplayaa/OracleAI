import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch, getBenchmarks, OpenDotaError } from "@/lib/opendota";
import { getMatchPlayerPositions } from "@/lib/stratz";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { computeFullMatchOverview } from "@/lib/metrics/fullMatchMetrics";
import { computeRoleComparisons } from "@/lib/metrics/roleComparison";
import { computeMatchStory } from "@/lib/metrics/matchStory";
import { computeSkillBuild } from "@/lib/metrics/skillBuild";
import { HeroIcon } from "@/components/HeroIcon";
import { ItemIcon } from "@/components/ItemIcon";
import { AttributeBadge } from "@/components/AttributeBadge";
import { StatBar } from "@/components/StatBar";
import { StatTile } from "@/components/StatTile";
import { AICoachPanel } from "@/components/AICoachPanel";
import { MatchTabs } from "@/components/MatchTabs";
import { MatchOverviewInteractive, type PlayerDetail } from "@/components/MatchOverviewInteractive";
import { TeamAdvantageChart } from "@/components/TeamAdvantageChart";
import { FarmSmallMultiples } from "@/components/FarmSmallMultiples";
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

  const playerDetails: Record<number, PlayerDetail> = {};
  for (const p of match.players) {
    if (!p.account_id) continue;
    playerDetails[p.account_id] = {
      metrics: computeMatchMetrics(match, p.account_id, benchmarksByHero.get(p.hero_id) ?? null),
      skillBuild: computeSkillBuild(p, p.hero_id),
    };
  }

  // Best-effort: STRATZ gives a real per-match position classifier, but has
  // shown intermittent failures, so a GPM-rank estimate is always the fallback.
  const stratzPositions = await getMatchPlayerPositions(matchId).catch(() => null);
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
      />
      {fullMatch.isParsed ? (
        <>
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <TeamAdvantageChart
              goldAdvTrend={fullMatch.goldAdvTrend}
              xpAdvTrend={fullMatch.xpAdvTrend}
            />
            <FarmSmallMultiples
              radiantPlayers={fullMatch.radiantPlayers}
              direPlayers={fullMatch.direPlayers}
            />
          </div>
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
              {metrics.win ? "Victory" : "Defeat"}
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
          sub={`${metrics.kda} ratio`}
        />
        <StatTile
          label="Last hits @10"
          value={metrics.lastHitsAt10 !== null ? `${metrics.lastHitsAt10}` : "-"}
        />
        <StatTile label="Wards placed" value={`${metrics.wardsPlaced}`} />
        <StatTile label="Buybacks" value={`${metrics.buybacks}`} />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-1">
            Performance vs {metrics.heroName} benchmarks
          </h3>
          <p className="text-xs text-ink-muted mb-2">
            Percentile is this game&apos;s rate compared to all recorded {metrics.heroName} games on OpenDota.
          </p>
          <div className="divide-y divide-border">
            {metrics.stats.map((stat) => (
              <StatBar key={stat.label} stat={stat} />
            ))}
          </div>
        </div>

        {metrics.itemTimeline.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-3">
              Key item timeline
            </h3>
            <div className="flex flex-wrap gap-3">
              {metrics.itemTimeline.map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <ItemIcon itemKey={item.itemKey} size={32} />
                  <span className="text-[11px] text-ink-muted font-mono">
                    {formatDuration(item.time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-2 text-sm text-ink-secondary">
        <span className="text-accent font-semibold">AI</span>
        Want a personal breakdown of this match? Open the AI Coach in the
        bottom-right corner.
      </div>
    </>
  );

  const matchStoryContent = (
    <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-start">
      <div className="space-y-4">
        {roleComparisons.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Not enough data to build position-by-position comparisons for this match.
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
          label="What decided this game?"
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
        ← Back to profile
      </Link>

      <div className="mt-4 mb-6">
        <HeroSplashHeader
          heroId={metrics.heroId}
          eyebrow={fullMatch.radiantWin ? "Radiant victory" : "Dire victory"}
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
              {fullMatch.lobbyType !== "Normal" && ` (${fullMatch.lobbyType})`}
              {fullMatch.patch && ` · Patch ${fullMatch.patch}`}
            </>
          }
        />
      </div>

      <MatchTabs
        tabs={[
          { id: "full", label: "Full Match", content: fullMatchContent },
          { id: "story", label: "Match Story", content: matchStoryContent },
          { id: "mine", label: "My Performance", content: myPerformanceContent },
        ]}
      />
    </PageContainer>
  );
}
