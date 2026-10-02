"use client";

import { useState } from "react";
import { GAME_PHASE_GUIDES } from "@/lib/mapGuides";
import { DotaMapSchematic } from "./DotaMapSchematic";

export function MapGuidePanel() {
  const [phaseId, setPhaseId] = useState(GAME_PHASE_GUIDES[0].id);
  const phase = GAME_PHASE_GUIDES.find((p) => p.id === phaseId) ?? GAME_PHASE_GUIDES[0];

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-display font-bold text-lg text-ink">Гид по карте</h2>
          <p className="text-xs text-ink-muted mt-1">Куда смотреть и где стоять в каждой фазе игры.</p>
        </div>
        <div className="flex gap-1 bg-page/60 border border-border rounded-xl p-1" role="tablist" aria-label="Фаза игры">
          {GAME_PHASE_GUIDES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={phaseId === p.id}
              onClick={() => setPhaseId(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                phaseId === p.id ? "bg-accent text-page" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-accent/8 border border-accent/20 px-4 py-3 mb-4 flex gap-3 items-start">
        <span className="font-mono text-xs text-accent whitespace-nowrap pt-0.5">{phase.minuteRange}</span>
        <p className="text-sm text-ink leading-relaxed">{phase.summary}</p>
      </div>

      <DotaMapSchematic key={phase.id} pois={phase.pois} />

      <p className="text-[11px] text-ink-muted mt-4">Метки стоят примерно - это ориентиры, а не точные координаты в игре.</p>
    </section>
  );
}
