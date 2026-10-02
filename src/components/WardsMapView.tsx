"use client";

import { useState } from "react";
import Image from "next/image";
import { formatMatchTime } from "@/lib/format";

export interface WardDot {
  x: number;
  y: number;
  time: number;
  team: "radiant" | "dire";
  kind: "observer" | "sentry";
  heroName: string;
}

// Same team pair as the post-game graphs.
const TEAM_COLOR = { radiant: "#3fa34d", dire: "#e34948" };

type KindFilter = "observer" | "sentry" | "both";
type PhaseId = "all" | "lane" | "mid" | "late";

const PHASES: { id: PhaseId; label: string; from: number; to: number }[] = [
  { id: "all", label: "Вся игра", from: -Infinity, to: Infinity },
  { id: "lane", label: "0-10′", from: -Infinity, to: 600 },
  { id: "mid", label: "10-25′", from: 600, to: 1500 },
  { id: "late", label: "25′+", from: 1500, to: Infinity },
];

const KINDS: { id: KindFilter; label: string }[] = [
  { id: "observer", label: "Observer" },
  { id: "sentry", label: "Sentry" },
  { id: "both", label: "Оба" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-1 bg-page/60 border border-border rounded-xl p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition ${
            value === o.id ? "bg-accent text-page font-medium" : "text-ink-secondary hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Every ward of the match on the real minimap, filterable by type, side and game phase. */
export function WardsMapView({ wards }: { wards: WardDot[] }) {
  const [kind, setKind] = useState<KindFilter>("observer");
  const [phase, setPhase] = useState<PhaseId>("all");
  const [teams, setTeams] = useState({ radiant: true, dire: true });

  const range = PHASES.find((p) => p.id === phase)!;
  const shown = wards.filter(
    (w) => (kind === "both" || w.kind === kind) && teams[w.team] && w.time >= range.from && w.time < range.to
  );
  const count = (team: "radiant" | "dire") => shown.filter((w) => w.team === team).length;

  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="font-display font-bold text-base text-ink">Расстановка вардов</h3>
        <p className="text-xs text-ink-muted mt-1">Реальные точки из лога вардов этой игры. Наведи на точку - кто и когда поставил.</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <Segmented options={KINDS} value={kind} onChange={setKind} label="Тип варда" />
        <Segmented options={PHASES} value={phase} onChange={setPhase} label="Фаза игры" />
      </div>

      {wards.length === 0 ? (
        <p className="text-sm text-ink-muted">В этой игре варды не записаны.</p>
      ) : (
        <>
          <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-border">
            <Image src="/minimap.png" alt="Миникарта Dota 2" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-page/25" aria-hidden />
            {shown.map((w, i) => {
              const color = TEAM_COLOR[w.team];
              const label = `${w.kind === "observer" ? "Observer Ward" : "Sentry Ward"} · ${w.heroName} · ${formatMatchTime(w.time)}`;
              return (
                <span
                  key={i}
                  title={label}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${w.x}%`,
                    top: `${w.y}%`,
                    width: w.kind === "observer" ? 11 : 10,
                    height: w.kind === "observer" ? 11 : 10,
                    background: w.kind === "observer" ? color : "transparent",
                    border: `2px ${w.kind === "observer" ? "solid" : "dashed"} ${color}`,
                    boxShadow: "0 0 0 1.5px rgba(10,8,6,0.8)",
                  }}
                >
                  <span className="sr-only">{label}</span>
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(["radiant", "dire"] as const).map((team) => (
              <button
                key={team}
                type="button"
                aria-pressed={teams[team]}
                onClick={() => setTeams((t) => ({ ...t, [team]: !t[team] }))}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                  teams[team] ? "border-border bg-page/50 text-ink" : "border-border text-ink-muted opacity-60"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TEAM_COLOR[team] }} aria-hidden />
                {team === "radiant" ? "Radiant" : "Dire"}
                <span className="font-mono text-ink-muted">{count(team)}</span>
              </button>
            ))}
            <span className="text-[11px] text-ink-muted ml-auto">● Observer · ◌ Sentry</span>
          </div>
        </>
      )}
    </section>
  );
}
