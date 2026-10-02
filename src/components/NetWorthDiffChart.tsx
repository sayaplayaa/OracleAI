"use client";

import { useState } from "react";
import { formatGold, formatSigned } from "@/lib/format";
import type { NetWorthCheckpoint } from "@/lib/types";

const PLOT_HEIGHT = 180;

/**
 * Net worth difference vs the same-position enemy at each checkpoint, as
 * diverging columns around a zero baseline: up (blue) = ahead, down (red) =
 * behind. Hover/focus a column for both players' values; the full numbers
 * are in the table under the chart.
 */
export function NetWorthDiffChart({
  checkpoints,
  counterpartHero,
}: {
  checkpoints: NetWorthCheckpoint[];
  counterpartHero: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (checkpoints.length === 0) return null;

  const max = Math.max(500, ...checkpoints.map((c) => Math.abs(c.diff)));
  const half = PLOT_HEIGHT / 2;
  // The tallest bar stops short of the plot edge so its value label fits inside.
  const reach = half - 16;
  const extreme = checkpoints.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a));
  const last = checkpoints[checkpoints.length - 1];
  const shown = active !== null ? checkpoints[active] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
        <p className="text-sm text-ink-secondary">
          Разница в нетворсе с {counterpartHero} по минутам
        </p>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-chart-ahead)" }} /> ты впереди
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-chart-behind)" }} /> ты позади
          </span>
        </div>
      </div>

      <div className="relative flex">
        <div
          className="flex flex-col justify-between text-[10px] font-mono text-ink-muted pr-2 text-right shrink-0 w-14"
          style={{ height: PLOT_HEIGHT }}
          aria-hidden
        >
          <span style={{ marginTop: 16 - 6 }}>{formatSigned(max)}</span>
          <span>0</span>
          <span style={{ marginBottom: 16 - 6 }}>{formatSigned(-max)}</span>
        </div>

        <div className="relative flex-1 min-w-0" style={{ height: PLOT_HEIGHT }} onMouseLeave={() => setActive(null)}>
          <div className="absolute inset-x-0 border-t border-grid" style={{ top: half - reach }} aria-hidden />
          <div className="absolute inset-x-0 border-t border-baseline" style={{ top: half }} aria-hidden />
          <div className="absolute inset-x-0 border-t border-grid" style={{ top: half + reach }} aria-hidden />

          <div className="absolute inset-0 flex">
            {checkpoints.map((c, i) => {
              const h = (Math.abs(c.diff) / max) * reach;
              const ahead = c.diff >= 0;
              const labelled = c === extreme || c === last;
              return (
                <button
                  key={c.minute}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${c.minute}:00 - ты ${formatGold(c.you)}, ${counterpartHero} ${formatGold(c.counterpart)}, разница ${formatSigned(c.diff)}`}
                  className={`relative flex-1 h-full rounded-md transition-colors ${active === i ? "bg-surface-raised/70" : ""}`}
                >
                  <span
                    className="absolute left-1/2 -translate-x-1/2 w-[min(24px,60%)]"
                    style={{
                      height: Math.max(2, h),
                      background: ahead ? "var(--color-chart-ahead)" : "var(--color-chart-behind)",
                      ...(ahead
                        ? { bottom: half, borderRadius: "4px 4px 0 0" }
                        : { top: half, borderRadius: "0 0 4px 4px" }),
                    }}
                  />
                  {labelled && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[10px] font-mono text-ink-secondary whitespace-nowrap"
                      style={ahead ? { bottom: half + h + 3 } : { top: half + h + 3 }}
                    >
                      {formatSigned(c.diff)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {shown && (
            <div
              className="absolute z-10 -translate-x-1/2 top-1 pointer-events-none rounded-lg border border-border bg-page/95 backdrop-blur px-3 py-2 text-xs shadow-lg whitespace-nowrap"
              style={{ left: `${((active! + 0.5) / checkpoints.length) * 100}%` }}
            >
              <p className="font-mono text-ink-muted">{shown.minute}:00</p>
              <p className="text-ink mt-0.5">Ты: <span className="font-mono">{formatGold(shown.you)}</span></p>
              <p className="text-ink">
                {counterpartHero}: <span className="font-mono">{formatGold(shown.counterpart)}</span>
              </p>
              <p className="text-ink-secondary mt-0.5">
                Разница: <span className="font-mono">{formatSigned(shown.diff)}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex ml-14 mt-1.5" aria-hidden>
        {checkpoints.map((c) => (
          <span key={c.minute} className="flex-1 text-center text-[10px] font-mono text-ink-muted">
            {c.minute}′
          </span>
        ))}
      </div>

      <details className="mt-3">
        <summary className="text-xs text-ink-muted cursor-pointer select-none hover:text-ink-secondary">
          Таблица значений
        </summary>
        <div className="overflow-x-auto mt-2">
          <table className="text-xs font-mono w-full min-w-max">
            <thead>
              <tr className="text-ink-muted">
                <th className="text-left font-normal pr-3 py-1">Минута</th>
                {checkpoints.map((c) => (
                  <th key={c.minute} className="text-right font-normal px-2 py-1">
                    {c.minute}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ink">
              <tr>
                <td className="pr-3 py-1 text-ink-secondary">Ты</td>
                {checkpoints.map((c) => (
                  <td key={c.minute} className="text-right px-2 py-1">{formatGold(c.you)}</td>
                ))}
              </tr>
              <tr>
                <td className="pr-3 py-1 text-ink-secondary">{counterpartHero}</td>
                {checkpoints.map((c) => (
                  <td key={c.minute} className="text-right px-2 py-1">{formatGold(c.counterpart)}</td>
                ))}
              </tr>
              <tr>
                <td className="pr-3 py-1 text-ink-secondary">Разница</td>
                {checkpoints.map((c) => (
                  <td key={c.minute} className="text-right px-2 py-1">{formatSigned(c.diff)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
