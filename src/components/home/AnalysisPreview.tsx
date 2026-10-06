import Image from "next/image";
import { HeroIcon } from "../HeroIcon";

// A static illustration of what a finished analysis looks like - clearly
// labelled as an example, never presented as anyone's real game.
const DEATHS = [
  { n: 1, x: 31, y: 44, active: false },
  { n: 2, x: 58, y: 37, active: true },
  { n: 3, x: 72, y: 66, active: false },
];

export function AnalysisPreview() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 rounded-[2rem] opacity-60 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(closest-side, rgba(232,184,75,0.18), transparent)" }}
        aria-hidden
      />
      <div className="relative bg-surface/90 backdrop-blur border border-border rounded-2xl p-4 sm:p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 mb-4">
          <HeroIcon heroId={70} size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Ursa · Керри</p>
            <p className="text-[11px] text-ink-muted">Пример разбора</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-status-critical text-status-critical">
            Поражение
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="rounded-xl bg-page/60 border border-border p-3" style={{ boxShadow: "inset 0 2px 0 0 var(--color-status-good)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-status-good mb-1.5">Хорошо</p>
            <p className="text-xs text-ink leading-snug">Выиграл линию: +620 нетворса к 10:00</p>
          </div>
          <div className="rounded-xl bg-page/60 border border-border p-3" style={{ boxShadow: "inset 0 2px 0 0 var(--color-highlight-text)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-highlight-text mb-1.5">Подтянуть</p>
            <p className="text-xs text-ink leading-snug">3 смерти вне тимфайтов - фарм без обзора</p>
            <p className="text-[10px] text-accent leading-snug mt-1">Цель: 0 смертей вне драк</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1.15fr] gap-2.5">
          <div className="relative aspect-square rounded-xl overflow-hidden border border-border">
            <Image src="/minimap.png" alt="" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-page/30" />
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: "54%",
                top: "33%",
                width: "34%",
                height: "34%",
                background: "color-mix(in srgb, var(--color-status-critical) 20%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-status-critical) 70%, transparent)",
              }}
            />
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
              style={{ left: "54%", top: "33%", background: "var(--color-status-critical)", boxShadow: "0 0 0 1.5px rgba(10,8,6,0.8)" }}
            />
            {DEATHS.map((d) => (
              <span
                key={d.n}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono font-bold ${
                  d.active ? "w-5 h-5 text-[10px] bg-accent text-page ring-4 ring-accent/30" : "w-4 h-4 text-[9px] bg-page text-ink border border-ink-muted"
                }`}
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
              >
                {d.n}
              </span>
            ))}
          </div>
          <div className="rounded-xl bg-page/60 border border-accent/40 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-accent text-page text-[10px] font-mono font-bold flex items-center justify-center">2</span>
              <span className="font-mono text-xs text-ink">18:42</span>
            </div>
            <p className="text-xs font-semibold text-ink leading-snug">вражеский лес у оффлейна (верх карты)</p>
            <p className="text-[11px] text-ink-secondary leading-snug">
              Ты стоял в радиусе вражеского Observer Ward (поставил Lion в 16:10) - по нему тебя и нашли: убил Lion
              (Finger of Death).
            </p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-status-critical/12 text-status-critical border-status-critical/30">
                Под вражеским Observer Ward
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-highlight-bg text-highlight-text border-highlight-text/25">
                Вне тимфайта
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
