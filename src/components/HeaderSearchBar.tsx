"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveAccountId, resolveMatchId } from "@/lib/steamId";
import type { OpenDotaSearchResult } from "@/lib/types";

export function HeaderSearchBar({
  sessionAccountId,
}: {
  sessionAccountId: number | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenDotaSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function reset() {
    setResults(null);
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const accountId = resolveAccountId(query);
    if (accountId !== null) {
      reset();
      setQuery("");
      router.push(`/player/${accountId}`);
      return;
    }

    const matchId = resolveMatchId(query);
    if (matchId !== null) {
      reset();
      setQuery("");
      router.push(
        sessionAccountId ? `/player/${sessionAccountId}/match/${matchId}` : `/matches/${matchId}`
      );
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data);
      setOpen(true);
      if (data.length === 0) setError("No players found.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setOpen(true);
    }
  }

  return (
    <div className="relative w-full max-w-xs">
      <form onSubmit={handleSubmit}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) reset();
          }}
          placeholder="Search player, match ID..."
          className="w-full bg-surface border border-border rounded-md pl-3 pr-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </form>

      {open && (results?.length || error) && (
        <div className="absolute right-0 mt-1.5 w-72 bg-surface border border-border rounded-md shadow-xl z-20 overflow-hidden">
          {error && <p className="text-xs text-status-critical px-3 py-2">{error}</p>}
          {results && results.length > 0 && (
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.account_id}>
                  <button
                    onClick={() => {
                      reset();
                      setQuery("");
                      router.push(`/player/${r.account_id}`);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-raised transition text-left"
                  >
                    <span className="text-sm text-ink truncate">{r.personaname}</span>
                    <span className="text-[11px] text-ink-muted ml-auto font-mono">
                      {r.account_id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
