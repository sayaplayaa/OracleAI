"use client";

import { useState } from "react";
import { formatSigned } from "@/lib/format";
import type { GameFlow, GameFlowKind } from "@/lib/types";

const PLOT_HEIGHT = 150;

const KIND: Record<GameFlowKind, { label: string; icon: string; color: string }> = {
  throw: { label: "Упущенная победа", icon: "▼", color: "var(--color-status-critical)" },
  comeback: { label: "Камбэк", icon: "▲", color: "var(--color-status-good)" },
  "stomp-win": { label: "Уверенная победа", icon: "▲", color: "var(--color-status-good)" },
  "stomp-loss": { label: "Тяжёлое поражение", icon: "▼", color: "var(--color-status-critical)" },
  "close-win": { label: "Равная игра · победа", icon: "■", color: "var(--color-highlight-text)" },
  "close-loss": { label: "Равная игра · поражение", icon: "■", color: "var(--color-highlight-text)" },
};

/**
 * The team's gold lead over the whole game as one line around a zero
 * baseline (blue above = ahead, red below = behind), with the fights that
 * decided it numbered on the line. Hover anywhere for the lead at that minute.
 */
function TeamLeadChart({ flow }: { flow: GameFlow }) {
  const [hover, setHover] = useState<number | null>(null);
  const lead = flow.lead;
  if (lead.length < 2) return null;

  const max = Math.max(1000, ...lead.map((v) => Math.abs(v)));
  const last = lead.length - 1;
  const x = (minute: number) => (minute / last) * 100;
  const y = (value: number) => 50 - (value / max) * 44;
  const line = lead.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `0,50 ${line} 100,50`;
  const shown = hover !== null ? lead[hover] : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2 text-xs text-ink-muted">
        <span>Перевес твоей команды в золоте по минутам</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-chart-ahead)" }} /> впереди
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-chart-behind)" }} /> позади
          </span>
        </span>
      </div>
      <div className="relative flex">
        <div
          className="flex flex-col justify-between text-[10px] font-mono text-ink-muted pr-2 text-right shrink-0 w-14"
          style={{ height: PLOT_HEIGHT }}
          aria-hidden
        >
          <span>{formatSigned(max)}</span>
          <span>0</span>
          <span>{formatSigned(-max)}</span>
        </div>
        <div
          className="relative flex-1 min-w-0"
          style={{ height: PLOT_HEIGHT }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.round(((e.clientX - r.left) / r.width) * last));
          }}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`Перевес команды в золоте по минутам: от ${formatSigned(Math.min(...lead))} до ${formatSigned(Math.max(...lead))}, в конце ${formatSigned(lead[last])}`}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
            <defs>
              <clipPath id="gf-ahead">
                <rect x="0" y="0" width="100" height="50" />
              </clipPath>
              <clipPath id="gf-behind">
                <rect x="0" y="50" width="100" height="50" />
              </clipPath>
            </defs>
            <line x1="0" x2="100" y1="50" y2="50" stroke="var(--color-baseline)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <polygon points={area} fill="var(--color-chart-ahead)" opacity="0.18" clipPath="url(#gf-ahead)" />
            <polygon points={area} fill="var(--color-chart-behind)" opacity="0.18" clipPath="url(#gf-behind)" />
            <polyline points={line} fill="none" stroke="var(--color-chart-ahead)" strokeWidth="2" vectorEffect="non-scaling-stroke" clipPath="url(#gf-ahead)" strokeLinejoin="round" />
            <polyline points={line} fill="none" stroke="var(--color-chart-behind)" strokeWidth="2" vectorEffect="non-scaling-stroke" clipPath="url(#gf-behind)" strokeLinejoin="round" />
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1="0" y2="100" stroke="var(--color-ink-muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {flow.keyFights.map((f, i) => {
            const minute = Math.min(last, Math.max(0, f.time / 60));
            const value = lead[Math.round(minute)] ?? 0;
            return (
              <span
                key={f.time}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent text-page text-[10px] font-mono font-bold flex items-center justify-center"
                style={{ left: `${x(minute)}%`, top: `${y(value)}%`, boxShadow: "0 0 0 2px var(--color-surface)" }}
                title={`${f.timeLabel}: ${f.yourPart}`}
              >
                {i + 1}
              </span>
            );
          })}
          {hover !== null && shown !== null && (
            <div
              className="absolute z-10 top-0 -translate-x-1/2 pointer-events-none rounded-lg border border-border bg-page/95 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
              style={{ left: `${Math.min(90, Math.max(10, x(hover)))}%` }}
            >
              <span className="font-mono text-ink-muted">{hover}:00</span>{" "}
              <span className="font-mono text-ink">{formatSigned(shown)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between pl-14 mt-1 text-[10px] font-mono text-ink-muted" aria-hidden>
        <span>0:00</span>
        <span>{last}:00</span>
      </div>
    </div>
  );
}

/** How the whole game went and which fights decided it - read before the per-phase detail. */
export function GameFlowCard({ flow }: { flow: GameFlow }) {
  const kind = KIND[flow.kind];
  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-5"
      style={{ boxShadow: `inset 0 3px 0 0 ${kind.color}` }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-lg sm:text-xl text-ink">Как решилась игра</h2>
          <p className="text-sm text-ink-secondary mt-1 max-w-3xl leading-relaxed">{flow.headline}</p>
        </div>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0"
          style={{ color: kind.color, borderColor: kind.color }}
        >
          {kind.icon} {kind.label}
        </span>
      </div>

      <TeamLeadChart flow={flow} />

      {flow.keyFights.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {flow.kind === "throw"
              ? "Драки, в которых ушёл перевес"
              : flow.kind === "comeback"
                ? "Драки, которые развернули игру"
                : "Драки, которые решили игру"}
          </p>
          <ol className="grid gap-2 md:grid-cols-2">
            {flow.keyFights.map((f, i) => (
              <li key={f.time} className="flex gap-3 rounded-xl bg-page/50 border border-border p-3">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-accent text-page text-[10px] font-mono font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0 text-sm leading-relaxed">
                  <p className="text-ink">
                    <span className="font-mono text-ink-muted">{f.timeLabel}</span>
                    {f.place ? ` · ${f.place}` : ""}
                  </p>
                  <p className="text-ink-secondary">
                    Твоя команда потеряла {f.yourTeamDeaths}, враг - {f.enemyDeaths}
                    {f.aegis ? " · с Aegis" : ""}
                    {f.leadBefore !== null && f.leadAfter !== null && (
                      <span className="font-mono text-ink-muted">
                        {" "}
                        · {formatSigned(f.leadBefore)} → {formatSigned(f.leadAfter)}
                      </span>
                    )}
                  </p>
                  <p className="text-ink">Ты: {f.yourPart}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
