import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHeroMatchups } from "@/lib/opendota";
import { getHeroPositionStats, getLaneSynergy } from "@/lib/stratz";
import { getHeroAbilityKit } from "@/lib/heroAbilities";
import { getAllHeroes, getHeroImage, getHeroInternalName, getHeroName, getHeroPrimaryAttr } from "@/lib/constants";
import { computeHeroRoleOverview } from "@/lib/metrics/heroBuild";
import { computeDraftInsights } from "@/lib/metrics/draftInsights";
import { heroRoleTagRu } from "@/lib/heroTags";
import { pluralRu } from "@/lib/format";
import { attributeColor, attributeNameRu } from "@/components/AttributeBadge";
import { HeroGuideView } from "@/components/HeroGuideView";
import { PageContainer } from "@/components/PageContainer";
import { BannerStat, Breadcrumbs } from "@/components/PageHeader";
import type { RolePickStat } from "@/lib/types";

function parseHeroId(raw: string): number | null {
  const heroId = Number(raw);
  return Number.isInteger(heroId) && heroId > 0 && getHeroInternalName(heroId) ? heroId : null;
}

export async function generateMetadata({ params }: PageProps<"/heroes/[heroId]">): Promise<Metadata> {
  const heroId = parseHeroId((await params).heroId);
  return { title: heroId ? `${getHeroName(heroId)} - гайд и сборка - Dota Coach AI` : "Герой - Dota Coach AI" };
}

function HeroBanner({ heroId, roles }: { heroId: number; roles: RolePickStat[] }) {
  const image = getHeroImage(heroId);
  const attr = getHeroPrimaryAttr(heroId);
  const color = attributeColor(attr);
  const tags = getAllHeroes().find((h) => h.id === heroId)?.roles ?? [];
  const totalGames = roles.reduce((s, r) => s + r.games, 0);
  const totalWins = roles.reduce((s, r) => s + r.games * r.winRate, 0);
  const mainRole = [...roles].sort((a, b) => b.games - a.games)[0];
  const winRate = totalGames > 0 ? totalWins / totalGames : null;

  return (
    <div
      className="relative overflow-hidden bg-surface border border-border rounded-2xl"
      style={{ boxShadow: `inset 4px 0 0 0 ${color}` }}
    >
      {image && (
        <div className="absolute inset-y-0 right-0 w-2/3 opacity-30 pointer-events-none" aria-hidden>
          <Image src={image} alt="" fill className="object-cover object-center" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent" />
        </div>
      )}
      <div className="relative px-5 py-5 sm:px-7 sm:py-7 flex items-center gap-6 flex-wrap">
        {image && (
          <Image
            src={image}
            alt={getHeroName(heroId)}
            width={192}
            height={108}
            className="rounded-xl border border-border shrink-0 w-[144px] sm:w-[192px] h-auto shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]"
            unoptimized
            priority
          />
        )}
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase mb-2 flex items-center gap-2" style={{ color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden />
            {attributeNameRu(attr)}
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink leading-tight">{getHeroName(heroId)}</h1>
          {tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-3">
              {tags.map((tag) => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-page/50 text-ink-secondary">
                  {heroRoleTagRu(tag)}
                </span>
              ))}
            </div>
          )}
        </div>
        {totalGames > 0 && (
          <div className="flex gap-2 flex-wrap lg:ml-auto">
            <BannerStat
              label="Винрейт за неделю"
              value={winRate !== null ? `${(winRate * 100).toFixed(1)}%` : "-"}
              color={winRate !== null && winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)"}
            />
            <BannerStat
              label="Игр на Легенде+"
              value={totalGames.toLocaleString("ru-RU")}
              sub={pluralRu(totalGames, ["игра", "игры", "игр"]) + " за неделю"}
            />
            {mainRole && (
              <BannerStat
                label="Основная роль"
                value={mainRole.roleLabel}
                sub={`${Math.round((mainRole.games / totalGames) * 100)}% игр`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function HeroGuidePage({ params, searchParams }: PageProps<"/heroes/[heroId]">) {
  const heroId = parseHeroId((await params).heroId);
  if (!heroId) notFound();
  const { tab, pos } = await searchParams;

  const abilities = getHeroAbilityKit(heroId);
  const [positionStats, matchups, laneSynergy] = await Promise.all([
    getHeroPositionStats(heroId).catch(() => []),
    getHeroMatchups(heroId).catch(() => null),
    // Optional: only with STRATZ_API_KEY; never let it break the page.
    getLaneSynergy(heroId).catch(() => []),
  ]);
  const roleOverview = computeHeroRoleOverview(heroId, positionStats);
  const draftInsights = matchups ? computeDraftInsights(heroId, matchups, laneSynergy) : null;
  const heroName = getHeroName(heroId);

  const requested = typeof pos === "string" ? pos : null;
  const initialPosition =
    roleOverview.roles.find((r) => r.position === requested)?.position ??
    [...roleOverview.roles].sort((a, b) => b.games - a.games)[0]?.position ??
    null;
  // A ?pos= link (from the Meta page) is about the build: scroll to the items.
  const initialTab = typeof tab === "string" ? tab : requested ? "build" : null;

  return (
    <PageContainer className="space-y-6">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/heroes", label: "Гайды" }, { label: heroName }]} />

      <HeroBanner heroId={heroId} roles={roleOverview.roles} />

      <HeroGuideView
        heroId={heroId}
        heroName={heroName}
        roles={roleOverview.roles}
        initialPosition={initialPosition}
        initialTab={initialTab}
        abilities={abilities}
        matchups={draftInsights}
      />
    </PageContainer>
  );
}
