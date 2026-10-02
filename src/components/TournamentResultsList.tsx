"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { OpenDotaProMatch } from "@/lib/types";
import { formatMatchTime, pluralRu, timeAgoRu } from "@/lib/format";
import { inputField } from "./buttonStyles";

const subscribeNothing = () => () => {};

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function TeamName({ name, won, align }: { name: string; won: boolean; align: "left" | "right" }) {
  return (
    <span
      className={`flex items-center gap-2 min-w-0 ${align === "right" ? "justify-end text-right" : ""} ${
        won ? "text-ink font-semibold" : "text-ink-secondary"
      }`}
    >
      {align === "left" && won && <span className="w-1.5 h-1.5 rounded-full bg-status-good shrink-0" aria-label="Победитель" />}
      <span className="truncate">{name}</span>
      {align === "right" && won && <span className="w-1.5 h-1.5 rounded-full bg-status-good shrink-0" aria-label="Победитель" />}
    </span>
  );
}

function ResultRow({ match, mounted }: { match: OpenDotaProMatch; mounted: boolean }) {
  return (
    <li>
      <Link
        href={`/matches/${match.match_id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_150px] items-center gap-3 px-4 py-3 text-sm hover:bg-surface-raised transition"
      >
        <TeamName name={match.radiant_name ?? "Силы Света"} won={match.radiant_win} align="right" />
        <span
          className="font-mono text-sm tabular-nums rounded-lg bg-page/60 border border-border px-2.5 py-1 text-center min-w-[68px]"
          title="Счёт по убийствам"
        >
          <span className={match.radiant_win ? "text-ink" : "text-ink-muted"}>{match.radiant_score}</span>
          <span className="text-ink-muted"> : </span>
          <span className={!match.radiant_win ? "text-ink" : "text-ink-muted"}>{match.dire_score}</span>
        </span>
        <TeamName name={match.dire_name ?? "Силы Тьмы"} won={!match.radiant_win} align="left" />
        <span className="hidden sm:flex items-center justify-end gap-2 text-xs text-ink-muted">
          <span className="font-mono tabular-nums">{formatMatchTime(match.duration)}</span>
          <span>·</span>
          <span className="whitespace-nowrap">{mounted ? timeAgoRu(match.start_time) : ""}</span>
          <span className="text-accent opacity-0 group-hover:opacity-100 transition" aria-hidden>
            →
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Recent pro results grouped by league, with a team/league search and league chips. */
export function TournamentResultsList({ matches }: { matches: OpenDotaProMatch[] }) {
  const [league, setLeague] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Relative time depends on Date.now(), which differs between the server
  // render and hydration - so it's filled in on the client only.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // Leagues ordered by how many recent games they have.
  const leagues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.league_name, (counts.get(m.league_name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = matches.filter(
      (m) =>
        (!league || m.league_name === league) &&
        (!q ||
          m.league_name.toLowerCase().includes(q) ||
          (m.radiant_name ?? "").toLowerCase().includes(q) ||
          (m.dire_name ?? "").toLowerCase().includes(q))
    );
    const byLeague = new Map<string, OpenDotaProMatch[]>();
    for (const m of [...shown].sort((a, b) => b.start_time - a.start_time)) {
      const list = byLeague.get(m.league_name) ?? [];
      list.push(m);
      byLeague.set(m.league_name, list);
    }
    return [...byLeague.entries()];
  }, [matches, league, query]);

  if (matches.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-ink-secondary">
        OpenDota не вернул ни одного недавнего про-матча. Обнови страницу через минуту.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <label className="relative lg:w-80 shrink-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Команда или лига…"
            aria-label="Поиск по командам и лигам"
            className={`${inputField} pl-10`}
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0" role="group" aria-label="Лига">
          {[[null, matches.length] as const, ...leagues].map(([name, count]) => {
            const active = league === name;
            return (
              <button
                key={name ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setLeague(name)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition max-w-[260px] ${
                  active ? "border-accent bg-accent text-page font-semibold" : "border-border text-ink-secondary hover:text-ink hover:border-accent/40"
                }`}
              >
                <span className="truncate">{name ?? "Все лиги"}</span>
                <span className={`font-mono ${active ? "text-page/70" : "text-ink-muted"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-ink-secondary">
          Ничего не нашлось. Попробуй другое название команды или лиги.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([name, list]) => (
            <section key={name} className="bg-surface border border-border rounded-2xl overflow-hidden">
              <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-page/30">
                <span className="w-8 h-8 rounded-lg bg-accent/12 text-accent flex items-center justify-center shrink-0" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
                  </svg>
                </span>
                <h3 className="font-semibold text-ink truncate flex-1 min-w-0">{name}</h3>
                <span className="text-xs text-ink-muted font-mono shrink-0">
                  {list.length} {pluralRu(list.length, ["матч", "матча", "матчей"])}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {list.map((m) => (
                  <ResultRow key={m.match_id} match={m} mounted={mounted} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
