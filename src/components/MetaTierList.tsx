"use client";

import { useEffect, useState } from "react";
import { HeroIcon } from "./HeroIcon";
import type { MetaTierEntry } from "@/lib/types";

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "POSITION_1", label: "Carry" },
  { value: "POSITION_2", label: "Mid" },
  { value: "POSITION_3", label: "Offlane" },
  { value: "POSITION_4", label: "Support" },
  { value: "POSITION_5", label: "Hard Support" },
];

export function MetaTierList() {
  const [role, setRole] = useState("all");
  const [entries, setEntries] = useState<MetaTierEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/meta?role=${role}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load meta data");
        setEntries(data as MetaTierEntry[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load meta data"))
      .finally(() => setLoading(false));
  }, [role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setRole(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition ${
              role === f.value
                ? "border-accent bg-accent/10 text-ink"
                : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading current-week meta...</p>}
      {error && <p className="text-sm text-status-critical">{error}</p>}

      {entries && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
            <span>#</span>
            <span>Hero</span>
            <span className="text-right">Role</span>
            <span className="text-right">Games</span>
            <span className="text-right">Win rate</span>
          </div>
          <div className="divide-y divide-border">
            {entries.map((e, i) => (
              <div
                key={`${e.heroId}-${e.position}`}
                className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem] gap-2 px-3 py-2 items-center hover:bg-surface-raised/60 transition"
              >
                <span className="text-xs font-mono text-ink-muted">{i + 1}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <HeroIcon heroId={e.heroId} size={26} />
                  <span className="text-sm text-ink truncate">{e.heroName}</span>
                </span>
                <span className="text-xs text-ink-muted text-right">{e.roleLabel}</span>
                <span className="text-xs font-mono text-ink-muted text-right">
                  {e.games.toLocaleString()}
                </span>
                <span
                  className="text-xs font-mono font-semibold text-right"
                  style={{
                    color:
                      e.winRate >= 0.5
                        ? "var(--color-status-good)"
                        : "var(--color-status-critical)",
                  }}
                >
                  {(e.winRate * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
