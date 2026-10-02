"use client";

import { useState } from "react";
import { MatchCard } from "./MatchCard";
import { secondaryButton } from "./buttonStyles";
import type { TrendMatchSummary } from "@/lib/types";

const PAGE_SIZE = 20;

type Filter = "all" | "wins" | "losses";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "wins", label: "Победы" },
  { id: "losses", label: "Поражения" },
];

export function MatchHistory({
  accountId,
  initialMatches,
  analyzable = false,
}: {
  accountId: number;
  initialMatches: TrendMatchSummary[];
  analyzable?: boolean;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [hasMore, setHasMore] = useState(initialMatches.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/player/${accountId}/matches?limit=${PAGE_SIZE}&offset=${matches.length}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMatches((prev) => [...prev, ...data.matches]);
      setHasMore(data.hasMore);
    } catch {
      // The API/network error text is English and technical - show the
      // player a plain Russian message instead.
      setError("Не удалось загрузить игры. Попробуй ещё раз через минуту.");
    } finally {
      setLoading(false);
    }
  }

  const wins = matches.filter((m) => m.win).length;
  const shown = matches.filter((m) => (filter === "wins" ? m.win : filter === "losses" ? !m.win : true));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1" role="group" aria-label="Фильтр игр">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === f.id ? "bg-accent text-page" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted">
          Загружено {matches.length} ·{" "}
          <span className="text-status-good font-mono">{wins}</span> -{" "}
          <span className="text-status-critical font-mono">{matches.length - wins}</span>
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-ink-secondary">
          Среди загруженных игр таких нет{hasMore ? " - загрузи ещё" : ""}.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {shown.map((m) => (
            <MatchCard key={m.matchId} accountId={accountId} match={m} analyzable={analyzable} />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-critical">
          {error}
        </p>
      )}
      {hasMore && (
        <button type="button" onClick={loadMore} disabled={loading} className={`${secondaryButton} w-full`}>
          {loading && <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />}
          {loading ? "Загружаю…" : "Показать ещё 20 игр"}
        </button>
      )}
    </div>
  );
}
