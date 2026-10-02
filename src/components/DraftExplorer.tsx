"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeroIcon } from "./HeroIcon";
import { MatchupList } from "./MatchupList";
import { RoleTabs } from "./RoleTabs";
import { ItemBuildList } from "./ItemBuildList";
import { ItemTimeline } from "./ItemTimeline";
import { NeutralItemTiers } from "./NeutralItemTiers";
import { TalentTable } from "./TalentTable";
import { attributeNameRu } from "./AttributeBadge";
import type {
  DraftInsights,
  HeroBuildOverview,
  HeroRoleOverview,
  HeroSummary,
} from "@/lib/types";

// OpenDota's hero role tags, shown under the selected hero's name.
const HERO_ROLE_TAGS_RU: Record<string, string> = {
  Carry: "Керри",
  Support: "Саппорт",
  Nuker: "Нюкер",
  Disabler: "Контроль",
  Initiator: "Инициатор",
  Durable: "Живучесть",
  Escape: "Побег",
  Pusher: "Пушер",
  Jungler: "Лесник",
};

export function DraftExplorer({ heroes }: { heroes: HeroSummary[] }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HeroSummary | null>(null);

  const [insights, setInsights] = useState<DraftInsights | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [roles, setRoles] = useState<HeroRoleOverview | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [activePosition, setActivePosition] = useState<string | null>(null);

  const [build, setBuild] = useState<HeroBuildOverview | null>(null);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter((h) => h.name.toLowerCase().includes(q));
  }, [heroes, query]);

  async function loadBuild(heroId: number, position: string) {
    setActivePosition(position);
    setBuild(null);
    setBuildError(null);
    setBuildLoading(true);
    try {
      const res = await fetch(`/api/hero/${heroId}/build?position=${position}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить сборку");
      setBuild(data as HeroBuildOverview);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : "Не удалось загрузить сборку");
    } finally {
      setBuildLoading(false);
    }
  }

  async function selectHero(hero: HeroSummary) {
    setSelected(hero);
    setInsights(null);
    setInsightsError(null);
    setRoles(null);
    setRolesError(null);
    setActivePosition(null);
    setBuild(null);
    setBuildError(null);

    const [matchupsRes, rolesRes] = await Promise.all([
      fetch(`/api/hero/${hero.id}/matchups`),
      fetch(`/api/hero/${hero.id}/roles`),
    ]);

    matchupsRes
      .json()
      .then((data) => {
        if (!matchupsRes.ok) throw new Error(data.error ?? "Не удалось загрузить матчапы");
        setInsights(data as DraftInsights);
      })
      .catch((err) =>
        setInsightsError(err instanceof Error ? err.message : "Не удалось загрузить матчапы")
      );

    rolesRes
      .json()
      .then((data) => {
        if (!rolesRes.ok) throw new Error(data.error ?? "Не удалось загрузить данные по ролям");
        const overview = data as HeroRoleOverview;
        setRoles(overview);
        const defaultRole = [...overview.roles].sort((a, b) => b.games - a.games)[0];
        if (defaultRole) loadBuild(hero.id, defaultRole.position);
      })
      .catch((err) =>
        setRolesError(err instanceof Error ? err.message : "Не удалось загрузить данные по ролям")
      );
  }

  // Deep-link support: /drafts?hero=74 auto-selects that hero, e.g. from a
  // Hero Guide page's "Полная сборка и таланты" link.
  useEffect(() => {
    const heroIdParam = Number(searchParams.get("hero"));
    if (!Number.isInteger(heroIdParam) || heroIdParam <= 0) return;
    const match = heroes.find((h) => h.id === heroIdParam);
    if (match) selectHero(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, heroes]);

  return (
    <div className="space-y-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найти героя..."
        className="w-full max-w-sm bg-surface border border-border rounded-md px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
        {filtered.map((hero) => (
          <button
            key={hero.id}
            onClick={() => selectHero(hero)}
            title={hero.name}
            className={`flex flex-col items-center gap-1 rounded-md p-1.5 transition ${
              selected?.id === hero.id
                ? "ring-1 ring-accent bg-surface-raised"
                : "hover:bg-surface-raised"
            }`}
          >
            <HeroIcon heroId={hero.id} size={36} />
            <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-1 w-full">
              {hero.name}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <HeroIcon heroId={selected.id} size={40} />
            <div>
              <h2 className="text-lg font-bold text-ink">{selected.name}</h2>
              <p className="text-xs text-ink-muted">
                {attributeNameRu(selected.primaryAttr)} ·{" "}
                {selected.roles.map((r) => HERO_ROLE_TAGS_RU[r] ?? r).join(", ")}
              </p>
            </div>
          </div>

          {rolesError && <p className="text-sm text-status-critical">{rolesError}</p>}

          {roles && roles.roles.length > 0 && (
            <div className="space-y-4">
              <RoleTabs
                roles={roles.roles}
                active={activePosition}
                onSelect={(position) => loadBuild(selected.id, position)}
              />

              {buildLoading && (
                <p className="text-sm text-ink-muted">Загружаю сборку...</p>
              )}
              {buildError && <p className="text-sm text-status-critical">{buildError}</p>}

              {build && (
                <div className="space-y-4">
                  <div className="grid lg:grid-cols-2 gap-4 items-start">
                    <ItemBuildList
                      title="Стартовые предметы"
                      description="Самый частый стартовый закуп."
                      items={build.startingItems}
                    />
                    <div className="bg-surface border border-border rounded-lg p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-0.5">
                        Ключевые предметы по порядку
                      </h3>
                      <p className="text-xs text-ink-muted mb-3">
                        Предметы, которые на этой неделе купили хотя бы 25% реальных игроков
                        на этом герое и позиции (STRATZ), в их реальном среднем порядке и
                        тайминге. Это не полная сборка: дальше игры расходятся в зависимости от
                        матчапа - частые поздние покупки смотри в ситуативных предметах ниже.
                      </p>
                      <ItemTimeline items={build.coreProgression} />
                    </div>
                  </div>

                  <ItemBuildList
                    title="Ситуативные предметы"
                    description="Берут реже, чем в 25% игр - реальные покупки под лейтгейм и конкретный матчап (STRATZ), сначала самые частые."
                    items={build.situationalItems}
                  />

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
                      Нейтральные предметы по тирам
                    </h3>
                    <NeutralItemTiers tiers={build.neutralTiers} />
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
                      Таланты
                    </h3>
                    <TalentTable levels={build.talents} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <h3 className="text-sm font-semibold text-ink mb-3">Матчапы</h3>
            {insightsError && <p className="text-sm text-status-critical">{insightsError}</p>}
            {insights && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <MatchupList
                    title={`Против кого ${selected.name} слаб`}
                    matchups={insights.toughestMatchups}
                    emptyMessage="Пока ни против одного героя не набралось достаточно игр."
                  />
                  <MatchupList
                    title={`Против кого ${selected.name} силён`}
                    matchups={insights.bestMatchups}
                    emptyMessage="Пока ни против одного героя не набралось достаточно игр."
                  />
                </div>
                <div>
                  <MatchupList
                    title={
                      insights.lanePosition
                        ? `Лучшие напарники по линии (${insights.lanePosition}, эта неделя)`
                        : "Лучшие напарники по линии"
                    }
                    matchups={insights.bestLanePartners}
                    emptyMessage={
                      insights.lanePosition
                        ? "На этой неделе ни с одним напарником не набралось достаточно игр."
                        : "Нет данных о синергии на линии (нужен ключ STRATZ_API_KEY)."
                    }
                  />
                  {insights.lanePosition && (
                    <p className="text-xs text-ink-muted mt-2">
                      Данные STRATZ только за текущую неделю - это живая мета, а не
                      среднее за всё время.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
