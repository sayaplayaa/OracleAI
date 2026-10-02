"use client";

import { useState } from "react";
import { MatchCard } from "./MatchCard";
import type { TrendMatchSummary } from "@/lib/types";

const PAGE_SIZE = 20;

export function MatchHistory({
  accountId,
  initialMatches,
}: {
  accountId: number;
  initialMatches: TrendMatchSummary[];
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [hasMore, setHasMore] = useState(initialMatches.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/player/${accountId}/matches?limit=${PAGE_SIZE}&offset=${matches.length}`
      );
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

  return (
    <div>
      <div className="bg-surface border border-border rounded-lg divide-y divide-border overflow-hidden">
        {matches.map((m) => (
          <MatchCard key={m.matchId} accountId={accountId} match={m} />
        ))}
      </div>
      {error && <p className="text-sm text-status-critical mt-3">{error}</p>}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full mt-3 text-sm text-ink-secondary hover:text-ink border border-border rounded-md py-2 transition disabled:opacity-50"
        >
          {loading ? "Загрузка..." : "Показать ещё игры"}
        </button>
      )}
    </div>
  );
}
