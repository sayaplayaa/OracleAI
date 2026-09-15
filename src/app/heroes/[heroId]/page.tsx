import Link from "next/link";
import { notFound } from "next/navigation";
import { getHeroMatchups } from "@/lib/opendota";
import { getHeroPositionStats } from "@/lib/stratz";
import { getHeroAbilityKit } from "@/lib/heroAbilities";
import { getHeroInternalName, getHeroName, getHeroPrimaryAttr } from "@/lib/constants";
import { computeHeroRoleOverview } from "@/lib/metrics/heroBuild";
import { computeDraftInsights } from "@/lib/metrics/draftInsights";
import { HeroSplashHeader } from "@/components/HeroSplashHeader";
import { HeroAbilityList } from "@/components/HeroAbilityList";
import { MatchupList } from "@/components/MatchupList";
import { HeroGuidePanel } from "@/components/HeroGuidePanel";
import { PageContainer } from "@/components/PageContainer";

export default async function HeroGuidePage({
  params,
}: {
  params: Promise<{ heroId: string }>;
}) {
  const { heroId: heroIdParam } = await params;
  const heroId = Number(heroIdParam);
  if (!Number.isInteger(heroId) || heroId <= 0 || !getHeroInternalName(heroId)) {
    notFound();
  }

  const abilities = getHeroAbilityKit(heroId);
  const [positionStats, matchups] = await Promise.all([
    getHeroPositionStats(heroId).catch(() => []),
    getHeroMatchups(heroId),
  ]);
  const roleOverview = computeHeroRoleOverview(heroId, positionStats);
  const draftInsights = computeDraftInsights(heroId, matchups);

  return (
    <PageContainer>
      <div className="space-y-6">
        <HeroSplashHeader
          heroId={heroId}
          eyebrow="Hero Guide"
          title={getHeroName(heroId)}
          subtitle={getHeroPrimaryAttr(heroId).toUpperCase()}
        >
          <Link
            href={`/drafts?hero=${heroId}`}
            className="text-xs text-accent hover:underline whitespace-nowrap"
          >
            Full item build & talents in Hero Explorer &rarr;
          </Link>
        </HeroSplashHeader>

        <div>
          <h2 className="text-sm font-semibold text-ink mb-3">Ability kit</h2>
          <HeroAbilityList abilities={abilities} />
        </div>

        {roleOverview.roles.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-ink mb-3">
              Role win rates (current week, STRATZ)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {roleOverview.roles.map((r) => (
                <div
                  key={r.position}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <div className="text-sm font-semibold text-ink">{r.roleLabel}</div>
                  <div className="text-xs font-mono text-ink-muted">
                    {r.games.toLocaleString()} ·{" "}
                    <span
                      style={{
                        color:
                          r.winRate >= 0.5
                            ? "var(--color-status-good)"
                            : "var(--color-status-critical)",
                      }}
                    >
                      {(r.winRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-ink mb-3">Matchups</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <MatchupList
              title={`${getHeroName(heroId)} struggles against`}
              matchups={draftInsights.toughestMatchups}
              emptyMessage="Not enough recorded games against any single hero."
            />
            <MatchupList
              title={`${getHeroName(heroId)} dominates`}
              matchups={draftInsights.bestMatchups}
              emptyMessage="Not enough recorded games against any single hero."
            />
          </div>
        </div>

        <HeroGuidePanel heroId={heroId} />
      </div>
    </PageContainer>
  );
}
