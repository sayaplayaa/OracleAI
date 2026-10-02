"use client";

import { useState } from "react";
import Image from "next/image";
import type { MapPoi, MapPoiType } from "@/lib/mapGuides";

const TYPE_STYLE: Record<MapPoiType, { label: string; color: string }> = {
  ward: { label: "Обзор", color: "var(--color-series-aqua)" },
  farm: { label: "Фарм", color: "var(--color-series-orange)" },
  objective: { label: "Цель", color: "var(--color-accent)" },
};

/** The real minimap with numbered points; picking a point on the map or in the list opens its explanation. */
export function DotaMapSchematic({ pois }: { pois: MapPoi[] }) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  return (
    <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <div>
        <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-border">
          <Image src="/minimap.png" alt="Миникарта Dota 2" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-page/20" aria-hidden />
          {pois.map((poi, i) => {
            const active = activeIndex === i;
            const color = TYPE_STYLE[poi.type].color;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={poi.label}
                aria-pressed={active}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono font-bold transition-all ${
                  active ? "w-7 h-7 text-xs z-10" : "w-5 h-5 text-[10px] hover:scale-110"
                }`}
                style={{
                  left: `${poi.x}%`,
                  top: `${poi.y}%`,
                  background: active ? color : "var(--color-page)",
                  color: active ? "var(--color-page)" : color,
                  border: `2px solid ${color}`,
                  boxShadow: active ? `0 0 0 5px color-mix(in srgb, ${color} 30%, transparent)` : "0 0 0 1.5px rgba(10,8,6,0.8)",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2.5 text-[11px] text-ink-muted">
          {(Object.keys(TYPE_STYLE) as MapPoiType[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: TYPE_STYLE[t].color }} />
              {TYPE_STYLE[t].label}
            </span>
          ))}
        </div>
      </div>

      <ol className="space-y-2">
        {pois.map((poi, i) => {
          const active = activeIndex === i;
          const style = TYPE_STYLE[poi.type];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-expanded={active}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                  active ? "border-accent/50 bg-surface-raised" : "border-border bg-page/40 hover:border-accent/30"
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-mono font-bold mt-0.5"
                    style={{ background: active ? style.color : "transparent", color: active ? "var(--color-page)" : style.color, border: `1.5px solid ${style.color}` }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-ink leading-snug">{poi.label}</span>
                    {active && <span className="block text-xs text-ink-secondary mt-1.5 leading-relaxed">{poi.detail}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
