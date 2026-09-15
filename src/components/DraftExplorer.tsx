"use client";

import { useMemo, useState } from "react";
import { HeroIcon } from "./HeroIcon";
import { MatchupList } from "./MatchupList";
import type { DraftInsights, HeroSummary } from "@/lib/types";

export function DraftExplorer({ heroes }: { heroes: HeroSummary[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HeroSummary | null>(null);
  const [insights, setInsights] = useState<DraftInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter((h) => h.name.toLowerCase().includes(q));
  }, [heroes, query]);

  async function selectHero(hero: HeroSummary) {
    setSelected(hero);
    setInsights(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/hero/${hero.id}/matchups`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load matchups");
      setInsights(data as DraftInsights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matchups");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter heroes..."
        className="w-full max-w-sm bg-surface border border-border rounded-md px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-series-blue"
      />

      <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
        {filtered.map((hero) => (
          <button
            key={hero.id}
            onClick={() => selectHero(hero)}
            title={hero.name}
            className={`rounded-md p-1 transition ${
              selected?.id === hero.id
                ? "ring-2 ring-series-blue bg-surface-raised"
                : "hover:bg-surface-raised"
            }`}
          >
            <HeroIcon heroId={hero.id} size={40} className="w-full h-auto" />
          </button>
        ))}
      </div>

      {selected && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <HeroIcon heroId={selected.id} size={40} />
            <div>
              <h2 className="text-lg font-bold text-ink">{selected.name}</h2>
              <p className="text-xs text-ink-muted">
                {selected.primaryAttr.toUpperCase()} ·{" "}
                {selected.roles.join(", ")}
              </p>
            </div>
          </div>

          {loading && <p className="text-sm text-ink-muted">Loading matchup data...</p>}
          {error && <p className="text-sm text-status-critical">{error}</p>}

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
      )}
    </div>
  );
}
