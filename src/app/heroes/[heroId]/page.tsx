import Link from "next/link";
import { notFound } from "next/navigation";
import { getHeroMatchups } from "@/lib/opendota";
import { getHeroPositionStats } from "@/lib/stratz";
import { getHeroAbilityKit } from "@/lib/heroAbilities";
import { getHeroInternalName, getHeroName, getHeroPrimaryAttr } from "@/lib/constants";
import { computeHeroRoleOverview } from "@/lib/metrics/heroBuild";
import { computeDraftInsights } from "@/lib/metrics/draftInsights";
import { pluralRu } from "@/lib/format";
import { HeroSplashHeader } from "@/components/HeroSplashHeader";
import { attributeNameRu } from "@/components/AttributeBadge";
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
          eyebrow="Гайд по герою"
          title={getHeroName(heroId)}
          subtitle={attributeNameRu(getHeroPrimaryAttr(heroId))}
        >
          <Link
            href={`/drafts?hero=${heroId}`}
            className="text-xs text-accent hover:underline whitespace-nowrap"
          >
            Полная сборка и таланты в «Обзоре героя» &rarr;
          </Link>
        </HeroSplashHeader>

        <div>
          <h2 className="text-sm font-semibold text-ink mb-3">Способности</h2>
          <HeroAbilityList abilities={abilities} />
        </div>

        {roleOverview.roles.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-ink mb-3">
              Винрейт по ролям (эта неделя, STRATZ)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {roleOverview.roles.map((r) => (
                <div
                  key={r.position}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <div className="text-sm font-semibold text-ink">{r.roleLabel}</div>
                  <div className="text-xs font-mono text-ink-muted">
                    {r.games.toLocaleString("ru-RU")}{" "}
                    {pluralRu(r.games, ["игра", "игры", "игр"])} ·{" "}
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
          <h2 className="text-sm font-semibold text-ink mb-3">Матчапы</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <MatchupList
              title={`Против кого ${getHeroName(heroId)} слаб`}
              matchups={draftInsights.toughestMatchups}
              emptyMessage="Пока ни против одного героя не набралось достаточно игр."
            />
            <MatchupList
              title={`Против кого ${getHeroName(heroId)} силён`}
              matchups={draftInsights.bestMatchups}
              emptyMessage="Пока ни против одного героя не набралось достаточно игр."
            />
          </div>
        </div>

        <HeroGuidePanel heroId={heroId} />
      </div>
    </PageContainer>
  );
}
