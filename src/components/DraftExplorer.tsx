"use client";

import { useMemo, useState } from "react";
import { HeroIcon } from "./HeroIcon";
import { MatchupList } from "./MatchupList";
import { RoleTabs } from "./RoleTabs";
import { ItemBuildList } from "./ItemBuildList";
import { ItemTimeline } from "./ItemTimeline";
import { NeutralItemTiers } from "./NeutralItemTiers";
import { TalentTable } from "./TalentTable";
import type {
  DraftInsights,
  HeroBuildOverview,
  HeroRoleOverview,
  HeroSummary,
} from "@/lib/types";

export function DraftExplorer({ heroes }: { heroes: HeroSummary[] }) {
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
      if (!res.ok) throw new Error(data.error ?? "Failed to load build data");
      setBuild(data as HeroBuildOverview);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : "Failed to load build data");
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
        if (!matchupsRes.ok) throw new Error(data.error ?? "Failed to load matchups");
        setInsights(data as DraftInsights);
      })
      .catch((err) =>
        setInsightsError(err instanceof Error ? err.message : "Failed to load matchups")
      );

    rolesRes
      .json()
      .then((data) => {
        if (!rolesRes.ok) throw new Error(data.error ?? "Failed to load role data");
        const overview = data as HeroRoleOverview;
        setRoles(overview);
        const defaultRole = [...overview.roles].sort((a, b) => b.games - a.games)[0];
        if (defaultRole) loadBuild(hero.id, defaultRole.position);
      })
      .catch((err) =>
        setRolesError(err instanceof Error ? err.message : "Failed to load role data")
      );
  }

  return (
    <div className="space-y-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter heroes..."
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
                {selected.primaryAttr.toUpperCase()} ·{" "}
                {selected.roles.join(", ")}
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
                <p className="text-sm text-ink-muted">Loading build data...</p>
              )}
              {buildError && <p className="text-sm text-status-critical">{buildError}</p>}

              {build && (
                <div className="space-y-4">
                  <div className="grid lg:grid-cols-2 gap-4 items-start">
                    <ItemBuildList
                      title="Starting items"
                      description="Most common opening inventory."
                      items={build.startingItems}
                    />
                    <div className="bg-surface border border-border rounded-lg p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
                        Core item progression
                      </h3>
                      <ItemTimeline items={build.coreProgression} />
                    </div>
                  </div>

                  <ItemBuildList
                    title="Situational items"
                    description="Picked less often, by average purchase rate."
                    items={build.situationalItems}
                  />

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
                      Neutral items by tier
                    </h3>
                    <NeutralItemTiers tiers={build.neutralTiers} />
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-3">
                      Talents
                    </h3>
                    <TalentTable levels={build.talents} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <h3 className="text-sm font-semibold text-ink mb-3">Matchups</h3>
            {insightsError && <p className="text-sm text-status-critical">{insightsError}</p>}
            {insights && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <MatchupList
                    title={`${selected.name} struggles against`}
                    matchups={insights.toughestMatchups}
                    emptyMessage="Not enough recorded games against any single hero."
                  />
                  <MatchupList
                    title={`${selected.name} dominates`}
                    matchups={insights.bestMatchups}
                    emptyMessage="Not enough recorded games against any single hero."
                  />
                </div>
                <div>
                  <MatchupList
                    title={
                      insights.lanePosition
                        ? `Best lane partners (${insights.lanePosition}, this week)`
                        : "Best lane partners"
                    }
                    matchups={insights.bestLanePartners}
                    emptyMessage={
                      insights.lanePosition
                        ? "Not enough games this week for any single pairing."
                        : "No lane-synergy data available (requires a STRATZ_API_KEY)."
                    }
                  />
                  {insights.lanePosition && (
                    <p className="text-xs text-ink-muted mt-2">
                      From STRATZ, current week only - reflects the live meta
                      rather than an all-time average.
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
