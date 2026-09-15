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
import { findSignatureHero } from "@/lib/metrics/signatureHero";
import { getHeroName } from "@/lib/constants";
import { StatTile } from "@/components/StatTile";
import { TrendChart } from "@/components/TrendChart";
import { HeroRankList } from "@/components/HeroRankList";
import { MatchCard } from "@/components/MatchCard";
import { MatchHistory } from "@/components/MatchHistory";
import { SignatureHeroCard } from "@/components/SignatureHeroCard";
import { AICoachPanel } from "@/components/AICoachPanel";
import { MatchTabs } from "@/components/MatchTabs";
import { PageContainer } from "@/components/PageContainer";

const MATCH_SAMPLE_SIZE = 10;

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
  const signatureHero = findSignatureHero(heroStats);
  const lifetimeTotal = winLoss.win + winLoss.lose;
  const lifetimeWinRate = lifetimeTotal > 0 ? winLoss.win / lifetimeTotal : 0;

  const overviewContent = trends.sampleSize === 0 ? (
    <p className="text-ink-secondary">No recent match data found for this player.</p>
  ) : (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label={`Win rate (last ${trends.sampleSize})`}
          value={`${Math.round(trends.winRate * 100)}%`}
        />
        <StatTile label="Avg KDA" value={`${trends.avgKda}`} />
        <StatTile label="Avg GPM" value={`${trends.avgGpm}`} />
        <StatTile label="Avg XPM" value={`${trends.avgXpm}`} />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr_1fr] gap-4 items-start">
        <TrendChart metrics={trends} />
        <HeroRankList title="Best heroes" heroes={trends.topHeroes} />
        <HeroRankList title="Worst heroes" heroes={trends.worstHeroes} />
      </div>

      {signatureHero && (
        <SignatureHeroCard
          accountId={accountId}
          heroId={signatureHero.hero_id}
          heroName={getHeroName(signatureHero.hero_id)}
          games={signatureHero.games}
          winRate={signatureHero.games > 0 ? signatureHero.win / signatureHero.games : 0}
        />
      )}

      <div className="grid lg:grid-cols-[1fr_2fr] gap-4 items-start">
        <AICoachPanel
          endpoint="/api/coach/trends"
          body={{ accountId, limit: MATCH_SAMPLE_SIZE }}
          label="Get AI Trend Report"
        />

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-3">
            Last {MATCH_SAMPLE_SIZE} matches
          </h2>
          <div className="bg-surface border border-border rounded-lg divide-y divide-border overflow-hidden">
            {trends.recentMatches.map((m) => (
              <MatchCard key={m.matchId} accountId={accountId} match={m} />
            ))}
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
              Lifetime {winLoss.win}W - {winLoss.lose}L (
              {Math.round(lifetimeWinRate * 100)}%)
            </p>
          </div>
          <Link
            href={profile.profile.profileurl}
            target="_blank"
            className="ml-auto text-xs text-accent hover:underline"
          >
            Steam profile ↗
          </Link>
        </div>

        <MatchTabs
          tabs={[
            { id: "overview", label: "Overview", content: overviewContent },
            {
              id: "history",
              label: "Match History",
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
