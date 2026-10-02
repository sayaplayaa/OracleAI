"use client";

import { useState } from "react";
import { GAME_PHASE_GUIDES } from "@/lib/mapGuides";
import { DotaMapSchematic } from "./DotaMapSchematic";

export function MapGuidePanel() {
  const [phaseId, setPhaseId] = useState(GAME_PHASE_GUIDES[0].id);
  const phase = GAME_PHASE_GUIDES.find((p) => p.id === phaseId) ?? GAME_PHASE_GUIDES[0];

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          Гид по карте
        </h3>
        <span className="text-[11px] font-mono text-ink-muted">{phase.minuteRange}</span>
      </div>

      <div className="flex gap-1.5 my-3">
        {GAME_PHASE_GUIDES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPhaseId(p.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition ${
              phaseId === p.id
                ? "border-accent bg-accent/10 text-ink"
                : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-muted mb-3">{phase.summary}</p>

      <DotaMapSchematic key={phase.id} pois={phase.pois} />

      <p className="text-[11px] text-ink-muted mt-3">
        Метки стоят примерно - это ориентиры, а не точные координаты в игре.
      </p>
    </div>
  );
}
