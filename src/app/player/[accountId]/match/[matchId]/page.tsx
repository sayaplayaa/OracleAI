import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch, getBenchmarks, OpenDotaError } from "@/lib/opendota";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { computeFullMatchOverview } from "@/lib/metrics/fullMatchMetrics";
import { HeroIcon } from "@/components/HeroIcon";
import { ItemIcon } from "@/components/ItemIcon";
import { StatBar } from "@/components/StatBar";
import { StatTile } from "@/components/StatTile";
import { AICoachPanel } from "@/components/AICoachPanel";
import { MatchTabs } from "@/components/MatchTabs";
import { FullMatchScoreboard } from "@/components/FullMatchScoreboard";
import { TeamAdvantageChart } from "@/components/TeamAdvantageChart";
import { FarmSmallMultiples } from "@/components/FarmSmallMultiples";
import { WardsMap } from "@/components/WardsMap";
import { MovementHeatmap } from "@/components/MovementHeatmap";
import { ParseMatchButton } from "@/components/ParseMatchButton";

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

  const benchmarks = await getBenchmarks(player.hero_id).catch(() => null);
  const metrics = computeMatchMetrics(match, accountId, benchmarks);
  const fullMatch = computeFullMatchOverview(match);

  const fullMatchContent = (
    <>
      <FullMatchScoreboard
        radiantPlayers={fullMatch.radiantPlayers}
        direPlayers={fullMatch.direPlayers}
        focusedAccountId={accountId}
      />
      {fullMatch.isParsed ? (
        <>
          <TeamAdvantageChart
            goldAdvTrend={fullMatch.goldAdvTrend}
            xpAdvTrend={fullMatch.xpAdvTrend}
          />
          <FarmSmallMultiples
            radiantPlayers={fullMatch.radiantPlayers}
            direPlayers={fullMatch.direPlayers}
          />
          <WardsMap
            radiantPlayers={fullMatch.radiantPlayers}
            direPlayers={fullMatch.direPlayers}
          />
          <MovementHeatmap
            radiantPlayers={fullMatch.radiantPlayers}
            direPlayers={fullMatch.direPlayers}
          />
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

      <AICoachPanel endpoint="/api/coach/match" body={{ matchId, accountId }} />
    </>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href={`/player/${accountId}`}
        className="text-sm text-series-blue hover:underline"
      >
        ← Back to profile
      </Link>

      <div className="flex items-center gap-3 mt-4 mb-2">
        <HeroIcon heroId={metrics.heroId} size={40} />
        <div>
          <h1 className="text-lg font-bold text-ink">
            {fullMatch.radiantWin ? "Radiant victory" : "Dire victory"}
          </h1>
          <p className="text-sm text-ink-muted">
            {formatDuration(fullMatch.duration)}
            {fullMatch.radiantScore !== null &&
              ` · ${fullMatch.radiantScore} - ${fullMatch.direScore}`}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <MatchTabs
          tabs={[
            { id: "full", label: "Full Match", content: fullMatchContent },
            { id: "mine", label: "My Performance", content: myPerformanceContent },
          ]}
        />
      </div>
    </div>
  );
}
