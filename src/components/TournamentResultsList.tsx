"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { OpenDotaProMatch } from "@/lib/types";
import { timeAgoRu } from "@/lib/format";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TournamentResultsList({ matches }: { matches: OpenDotaProMatch[] }) {
  const [league, setLeague] = useState("all");
  // Date.now() differs between server render and client hydration, so
  // relative time is only computed after mount to avoid a hydration
  // mismatch (same fix pattern as the Riddles page's random pick).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const leagues = useMemo(() => {
    const names = new Set(matches.map((m) => m.league_name));
    return [...names].sort();
  }, [matches]);

  const filtered =
    league === "all" ? matches : matches.filter((m) => m.league_name === league);

  return (
    <div className="space-y-3">
      <select
        value={league}
        onChange={(e) => setLeague(e.target.value)}
        className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="all">Все лиги ({matches.length})</option>
        {leagues.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <div className="bg-surface border border-border rounded-lg divide-y divide-border overflow-hidden">
        {filtered.map((m) => (
          <Link
            key={m.match_id}
            href={`/matches/${m.match_id}`}
            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-raised transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={
                    m.radiant_win ? "text-status-good font-semibold" : "text-ink-secondary"
                  }
                >
                  {m.radiant_name ?? "Силы Света"}
                </span>
                <span className="text-ink-muted">vs</span>
                <span
                  className={
                    !m.radiant_win ? "text-status-good font-semibold" : "text-ink-secondary"
                  }
                >
                  {m.dire_name ?? "Силы Тьмы"}
                </span>
              </div>
              <p className="text-xs text-ink-muted truncate">{m.league_name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-ink-secondary text-xs">
                {m.radiant_score}-{m.dire_score} · {formatDuration(m.duration)}
              </p>
              <p className="text-[11px] text-ink-muted">
                {mounted ? timeAgoRu(m.start_time) : " "}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
