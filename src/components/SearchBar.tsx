"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { resolveAccountId } from "@/lib/steamId";
import type { OpenDotaSearchResult } from "@/lib/types";

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenDotaSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const accountId = resolveAccountId(query);
    if (accountId !== null) {
      router.push(`/player/${accountId}`);
      return;
    }

    setLoading(true);
    setResults(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      if (data.length === 0) setError("No players found. Try a Steam ID or profile URL instead.");
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Steam ID, profile URL, or player name"
          className="flex-1 bg-surface border border-border rounded-md px-4 py-2.5 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-accent hover:brightness-110 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-md transition"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-status-critical mt-3">{error}</p>}

      {results && results.length > 0 && (
        <ul className="mt-3 bg-surface border border-border rounded-md divide-y divide-border overflow-hidden">
          {results.map((r) => (
            <li key={r.account_id}>
              <button
                onClick={() => router.push(`/player/${r.account_id}`)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-raised transition text-left"
              >
                <Image
                  src={r.avatarfull}
                  alt={r.personaname}
                  width={28}
                  height={28}
                  className="rounded"
                  unoptimized
                />
                <span className="text-sm text-ink">{r.personaname}</span>
                <span className="text-xs text-ink-muted ml-auto font-mono">
                  {r.account_id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
