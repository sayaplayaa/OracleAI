"use client";

import { useState } from "react";
import Image from "next/image";
import type { MapPoi, MapPoiType } from "@/lib/mapGuides";

const TYPE_COLORS: Record<MapPoiType, string> = {
  ward: "#2dd4bf",
  farm: "#d95926",
  objective: "#d9c46a",
};

const TYPE_LABELS: Record<MapPoiType, string> = {
  ward: "Vision",
  farm: "Farm",
  objective: "Objective",
};

export function DotaMapSchematic({ pois }: { pois: MapPoi[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex !== null ? pois[activeIndex] : null;

  return (
    <div>
      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-border">
        <Image
          src="/minimap.png"
          alt="Dota 2 minimap"
          fill
          className="object-cover"
          unoptimized
        />

        {pois.map((poi, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all"
            style={{
              left: `${poi.x}%`,
              top: `${poi.y}%`,
              width: activeIndex === i ? 16 : 12,
              height: activeIndex === i ? 16 : 12,
              background: TYPE_COLORS[poi.type],
              borderColor: "rgba(10,11,13,0.8)",
              boxShadow: "0 0 0 2px rgba(10,11,13,0.4)",
            }}
            title={poi.label}
          >
            <span className="sr-only">{poi.label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-2 text-[11px] text-ink-muted">
        {(Object.keys(TYPE_LABELS) as MapPoiType[]).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
            {TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {pois.map((poi, i) => (
          <li key={i}>
            <button
              onClick={() => setActiveIndex(i)}
              className="w-full text-left flex items-start gap-2 px-2.5 py-1.5 rounded-md transition"
              style={{
                background: activeIndex === i ? "var(--color-surface-raised)" : undefined,
              }}
            >
              <span
                className="w-2 h-2 rounded-full mt-1 shrink-0"
                style={{ background: TYPE_COLORS[poi.type] }}
              />
              <span className="text-sm text-ink">{poi.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <p className="text-xs text-ink-secondary mt-2 px-2.5">{active.detail}</p>
      )}
    </div>
  );
}
