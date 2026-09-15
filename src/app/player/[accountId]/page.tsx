import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProfile,
  getWinLoss,
  getRecentMatches,
  getHeroStats,
  OpenDotaError,
} from "@/lib/opendota";
import { computeTrendMetrics } from "@/lib/metrics/trendMetrics";
import { StatTile } from "@/components/StatTile";
import { TrendChart } from "@/components/TrendChart";
import { HeroRankList } from "@/components/HeroRankList";
import { MatchCard } from "@/components/MatchCard";
import { AICoachPanel } from "@/components/AICoachPanel";

const MATCH_SAMPLE_SIZE = 20;

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
      getRecentMatches(accountId, MATCH_SAMPLE_SIZE),
      getHeroStats(accountId),
    ]);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) notFound();
    throw err;
  }

  const trends = computeTrendMetrics(accountId, matches, heroStats);
  const lifetimeTotal = winLoss.win + winLoss.lose;
  const lifetimeWinRate = lifetimeTotal > 0 ? winLoss.win / lifetimeTotal : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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
            Lifetime {winLoss.win}W - {winLoss.lose}L (
            {Math.round(lifetimeWinRate * 100)}%)
          </p>
        </div>
        <Link
          href={profile.profile.profileurl}
          target="_blank"
          className="ml-auto text-xs text-series-blue hover:underline"
        >
          Steam profile ↗
        </Link>
      </div>

      {trends.sampleSize === 0 ? (
        <p className="text-ink-secondary">
          No recent match data found for this player.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label={`Win rate (last ${trends.sampleSize})`}
              value={`${Math.round(trends.winRate * 100)}%`}
            />
            <StatTile label="Avg KDA" value={`${trends.avgKda}`} />
            <StatTile label="Avg GPM" value={`${trends.avgGpm}`} />
            <StatTile label="Avg XPM" value={`${trends.avgXpm}`} />
          </div>

          <TrendChart metrics={trends} />

          <div className="grid sm:grid-cols-2 gap-4">
            <HeroRankList title="Best heroes" heroes={trends.topHeroes} />
            <HeroRankList title="Worst heroes" heroes={trends.worstHeroes} />
          </div>

          <AICoachPanel
            endpoint="/api/coach/trends"
            body={{ accountId, limit: MATCH_SAMPLE_SIZE }}
            label="Get AI Trend Report"
          />

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-3">
              Recent matches
            </h2>
            <div className="bg-surface border border-border rounded-lg divide-y divide-border overflow-hidden">
              {trends.recentMatches.map((m) => (
                <MatchCard key={m.matchId} accountId={accountId} match={m} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
