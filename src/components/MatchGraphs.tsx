"use client";

import { useEffect, useRef, useState } from "react";
import { HeroIcon } from "./HeroIcon";
import type { FullMatchPlayer } from "@/lib/types";

// The in-game player slot colors, in slot order - the same colors Dota's own
// post-game graphs and minimap use, so every line reads as "that player".
// Several pairs are close for color-blind readers, so every line also carries
// its hero icon at the end and in the legend.
const RADIANT_SLOT_COLORS = ["#3375ff", "#66ffbf", "#bf00bf", "#f3f00b", "#ff6b00"];
const DIRE_SLOT_COLORS = ["#fe86c2", "#a1b447", "#65d9f7", "#008321", "#a46900"];
const RADIANT = "#3fa34d";
const DIRE = "#e34948";
// Team-advantage pair (validated for CVD separation and contrast on the surface).
const GOLD_LINE = "#b8891a";
const XP_LINE = "#4a8ae0";

const CHART_HEIGHT = 320;
const PAD = { top: 14, bottom: 26, left: 46 };

type PlayerMetric = "netWorth" | "xp" | "lastHits" | "denies";
type GraphId = "advantage" | PlayerMetric;

const GRAPHS: { id: GraphId; label: string }[] = [
  { id: "advantage", label: "Преимущество команд" },
  { id: "netWorth", label: "Нетворс" },
  { id: "xp", label: "Опыт" },
  { id: "lastHits", label: "Добивания" },
  { id: "denies", label: "Денаи" },
];

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const n = raw / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * power;
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}k`;
  return Math.round(value).toLocaleString("ru-RU");
}

function full(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function minuteTicks(lastMinute: number): number[] {
  const step = lastMinute <= 30 ? 5 : lastMinute <= 60 ? 10 : 15;
  const ticks: number[] = [];
  for (let m = 0; m <= lastMinute; m += step) ticks.push(m);
  return ticks;
}

function linePath(values: number[], x: (m: number) => number, y: (v: number) => number): string {
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
}

interface Frame {
  width: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  lastMinute: number;
  x: (minute: number) => number;
  y: (value: number) => number;
}

function makeFrame(width: number, padRight: number, lastMinute: number, min: number, max: number): Frame {
  const plotLeft = PAD.left;
  const plotRight = Math.max(plotLeft + 10, width - padRight);
  const plotTop = PAD.top;
  const plotBottom = CHART_HEIGHT - PAD.bottom;
  return {
    width,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    lastMinute,
    x: (m) => plotLeft + (lastMinute === 0 ? 0 : (m / lastMinute) * (plotRight - plotLeft)),
    y: (v) => plotBottom - ((v - min) / (max - min || 1)) * (plotBottom - plotTop),
  };
}

function Axes({ frame, yTicks, format }: { frame: Frame; yTicks: number[]; format: (v: number) => string }) {
  return (
    <g>
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={frame.plotLeft}
            x2={frame.plotRight}
            y1={frame.y(t)}
            y2={frame.y(t)}
            stroke={t === 0 ? "var(--color-baseline)" : "var(--color-grid)"}
            strokeWidth={1}
          />
          <text x={frame.plotLeft - 8} y={frame.y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-muted)">
            {format(t)}
          </text>
        </g>
      ))}
      {minuteTicks(frame.lastMinute).map((m) => (
        <text key={m} x={frame.x(m)} y={CHART_HEIGHT - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink-muted)">
          {m}′
        </text>
      ))}
    </g>
  );
}

// Maps a pointer position over the chart to the nearest whole minute.
function usePointerMinute(frame: Frame | null) {
  const [minute, setMinute] = useState<number | null>(null);
  const handlers = {
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!frame) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const ratio = (px - frame.plotLeft) / (frame.plotRight - frame.plotLeft);
      setMinute(Math.max(0, Math.min(frame.lastMinute, Math.round(ratio * frame.lastMinute))));
    },
    onPointerLeave: () => setMinute(null),
  };
  return [minute, handlers] as const;
}

function Crosshair({ frame, minute }: { frame: Frame; minute: number }) {
  return (
    <line
      x1={frame.x(minute)}
      x2={frame.x(minute)}
      y1={frame.plotTop}
      y2={frame.plotBottom}
      stroke="var(--color-ink-muted)"
      strokeWidth={1}
      strokeDasharray="3 3"
    />
  );
}

function Dot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />;
}

// ---- Team advantage (gold + XP lead, Radiant above zero, Dire below) ----

function leadText(value: number): { team: string; color: string; amount: string } {
  return value >= 0
    ? { team: "Radiant", color: RADIANT, amount: `+${full(value)}` }
    : { team: "Dire", color: DIRE, amount: `+${full(-value)}` };
}

function AdvantageGraph({
  gold,
  xp,
}: {
  gold: number[];
  xp: number[];
}) {
  const [ref, width] = useWidth();
  const [show, setShow] = useState({ gold: true, xp: true });
  const lastMinute = Math.max(gold.length, xp.length) - 1;
  const maxAbs = Math.max(1000, ...gold.map(Math.abs), ...xp.map(Math.abs));
  const step = niceStep(maxAbs / 2);
  const bound = Math.ceil(maxAbs / step) * step;
  const frame = width > 0 ? makeFrame(width, 14, lastMinute, -bound, bound) : null;
  const [hover, handlers] = usePointerMinute(frame);
  const minute = hover ?? lastMinute;

  const yTicks: number[] = [];
  for (let t = -bound; t <= bound; t += step) yTicks.push(t);

  const peak = (values: number[], sign: 1 | -1) =>
    values.reduce<{ value: number; minute: number } | null>(
      (best, v, m) => (sign * v > 0 && (!best || sign * v > sign * best.value) ? { value: v, minute: m } : best),
      null
    );
  const radiantPeak = peak(gold, 1);
  const direPeak = peak(gold, -1);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
      <div ref={ref} className="relative min-w-0 touch-none select-none" style={{ height: CHART_HEIGHT }} {...handlers}>
        {frame && (
          <svg width={frame.width} height={CHART_HEIGHT} role="img" aria-label="Преимущество команд по золоту и опыту по минутам">
            <rect x={frame.plotLeft} y={frame.plotTop} width={frame.plotRight - frame.plotLeft} height={frame.y(0) - frame.plotTop} fill={RADIANT} opacity={0.07} />
            <rect x={frame.plotLeft} y={frame.y(0)} width={frame.plotRight - frame.plotLeft} height={frame.plotBottom - frame.y(0)} fill={DIRE} opacity={0.07} />
            <Axes frame={frame} yTicks={yTicks} format={(v) => compact(Math.abs(v))} />
            <g fontSize={11} fontWeight={600} letterSpacing="0.08em">
              <rect x={frame.plotLeft + 10} y={frame.plotTop + 9} width={8} height={8} rx={2} fill={RADIANT} />
              <text x={frame.plotLeft + 24} y={frame.plotTop + 17} fill="var(--color-ink-secondary)">RADIANT</text>
              <rect x={frame.plotLeft + 10} y={frame.plotBottom - 17} width={8} height={8} rx={2} fill={DIRE} />
              <text x={frame.plotLeft + 24} y={frame.plotBottom - 9} fill="var(--color-ink-secondary)">DIRE</text>
            </g>
            {show.xp && xp.length > 1 && (
              <path d={linePath(xp, frame.x, frame.y)} fill="none" stroke={XP_LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {show.gold && gold.length > 1 && (
              <path d={linePath(gold, frame.x, frame.y)} fill="none" stroke={GOLD_LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {hover !== null && <Crosshair frame={frame} minute={hover} />}
            {hover !== null && show.xp && xp[hover] !== undefined && <Dot cx={frame.x(hover)} cy={frame.y(xp[hover])} color={XP_LINE} />}
            {hover !== null && show.gold && gold[hover] !== undefined && <Dot cx={frame.x(hover)} cy={frame.y(gold[hover])} color={GOLD_LINE} />}
          </svg>
        )}
      </div>

      <aside className="space-y-3">
        <p className="text-xs text-ink-muted">
          {hover === null ? "Конец игры" : "Минута"} <span className="font-mono text-ink">{minute}′</span>
          {hover === null && <span> · наведи на график, чтобы увидеть любую минуту</span>}
        </p>
        {(
          [
            ["gold", "Золото", GOLD_LINE, gold[minute]],
            ["xp", "Опыт", XP_LINE, xp[minute]],
          ] as const
        ).map(([key, label, color, value]) => {
          const lead = value !== undefined ? leadText(value) : null;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={show[key]}
              onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
              className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                show[key] ? "border-border bg-page/50" : "border-border/50 opacity-50"
              }`}
            >
              <span className="w-4 h-1 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-sm text-ink flex-1">{label}</span>
              {lead && (
                <span className="text-right">
                  <span className="flex items-center justify-end gap-1.5 text-[11px] text-ink-muted">
                    <span className="w-2 h-2 rounded-sm" style={{ background: lead.color }} />
                    {lead.team}
                  </span>
                  <span className="font-mono text-sm text-ink tabular-nums">{lead.amount}</span>
                </span>
              )}
            </button>
          );
        })}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-border bg-page/50 px-3 py-2.5">
            <dt className="text-ink-muted flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: RADIANT }} /> Пик Radiant, золото
            </dt>
            <dd className="font-mono text-ink mt-1">{radiantPeak ? `+${compact(radiantPeak.value)} · ${radiantPeak.minute}′` : "-"}</dd>
          </div>
          <div className="rounded-xl border border-border bg-page/50 px-3 py-2.5">
            <dt className="text-ink-muted flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: DIRE }} /> Пик Dire, золото
            </dt>
            <dd className="font-mono text-ink mt-1">{direPeak ? `+${compact(-direPeak.value)} · ${direPeak.minute}′` : "-"}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-ink-muted leading-relaxed">Выше нуля - впереди Radiant, ниже - Dire. Нажми на линию в списке, чтобы скрыть её.</p>
      </aside>
    </div>
  );
}

// ---- Per-player lines (net worth / XP / last hits / denies) ----

interface PlayerLine {
  key: string;
  player: FullMatchPlayer;
  color: string;
  values: number[];
}

// Spreads end-of-line hero icons so they don't overlap, keeping each as
// close to its line's last value as possible; a leader line connects them.
function spreadLabels(targets: { key: string; y: number }[], min: number, max: number, gap: number) {
  const sorted = [...targets].sort((a, b) => a.y - b.y).map((t) => ({ ...t, placed: t.y }));
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    sorted[i].placed = Math.max(sorted[i].placed, min, prev ? prev.placed + gap : min);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const next = sorted[i + 1];
    sorted[i].placed = Math.min(sorted[i].placed, max, next ? next.placed - gap : max);
  }
  return new Map(sorted.map((s) => [s.key, s.placed]));
}

function PlayerGraph({
  metric,
  radiantPlayers,
  direPlayers,
  selectedAccountId,
  onSelect,
}: {
  metric: PlayerMetric;
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  selectedAccountId: number | null;
  onSelect: (accountId: number) => void;
}) {
  const [ref, width] = useWidth();
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const lines: PlayerLine[] = [
    ...radiantPlayers.map((p, i) => ({ player: p, color: RADIANT_SLOT_COLORS[i % 5] })),
    ...direPlayers.map((p, i) => ({ player: p, color: DIRE_SLOT_COLORS[i % 5] })),
  ].map(({ player, color }, i) => ({ key: `${i}-${player.heroId}`, player, color, values: player.series[metric] }));

  const lastMinute = Math.max(1, ...lines.map((l) => l.values.length - 1));
  const maxValue = Math.max(10, ...lines.flatMap((l) => l.values));
  const step = niceStep(maxValue / 4);
  const top = Math.ceil(maxValue / step) * step;
  const frame = width > 0 ? makeFrame(width, 40, lastMinute, 0, top) : null;
  const [hover, handlers] = usePointerMinute(frame);
  const minute = hover ?? lastMinute;

  const yTicks: number[] = [];
  for (let t = 0; t <= top; t += step) yTicks.push(t);

  const selectedKey = lines.find((l) => l.player.accountId !== null && l.player.accountId === selectedAccountId)?.key ?? null;
  const emphasized = focusKey ?? selectedKey;
  const valueAt = (l: PlayerLine) => l.values[Math.min(minute, l.values.length - 1)] ?? 0;

  const endY = frame
    ? spreadLabels(
        lines.filter((l) => l.values.length > 0).map((l) => ({ key: l.key, y: frame.y(l.values[l.values.length - 1]) })),
        frame.plotTop + 4,
        frame.plotBottom - 4,
        17
      )
    : new Map<string, number>();
  const drawOrder = [...lines].sort((a, b) => (a.key === emphasized ? 1 : b.key === emphasized ? -1 : 0));

  const legendGroup = (title: string, color: string, group: PlayerLine[]) => (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
        <span className="w-2 h-2 rounded-sm" style={{ background: color }} /> {title}
      </p>
      <ul className="space-y-0.5">
        {group.map((l) => {
            const selected = l.key === selectedKey;
            return (
              <li key={l.key}>
                <button
                  type="button"
                  onMouseEnter={() => setFocusKey(l.key)}
                  onMouseLeave={() => setFocusKey(null)}
                  onFocus={() => setFocusKey(l.key)}
                  onBlur={() => setFocusKey(null)}
                  onClick={() => l.player.accountId !== null && onSelect(l.player.accountId)}
                  disabled={l.player.accountId === null}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                    selected ? "bg-surface-raised ring-1 ring-accent/60" : "hover:bg-surface-raised"
                  } disabled:cursor-default`}
                >
                  <span className="w-1 h-6 rounded-full shrink-0" style={{ background: l.color }} />
                  <HeroIcon heroId={l.player.heroId} size={24} />
                  <span className="text-sm text-ink truncate flex-1 min-w-0">{l.player.heroName}</span>
                  <span className="font-mono text-sm text-ink tabular-nums">{full(valueAt(l))}</span>
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
      <div ref={ref} className="relative min-w-0 touch-none select-none" style={{ height: CHART_HEIGHT }} {...handlers}>
        {frame && (
          <>
            <svg width={frame.width} height={CHART_HEIGHT} role="img" aria-label={`${GRAPHS.find((g) => g.id === metric)?.label} каждого игрока по минутам`}>
              <Axes frame={frame} yTicks={yTicks} format={compact} />
              {drawOrder.map((l) => {
                if (l.values.length < 2) return null;
                const strong = focusKey === null || l.key === focusKey;
                const endX = frame.x(l.values.length - 1);
                const endYValue = frame.y(l.values[l.values.length - 1]);
                const labelY = endY.get(l.key) ?? endYValue;
                return (
                  <g key={l.key} opacity={strong ? 1 : 0.15}>
                    <path
                      d={linePath(l.values, frame.x, frame.y)}
                      fill="none"
                      stroke={l.color}
                      strokeWidth={l.key === emphasized ? 3 : 2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <line x1={endX} y1={endYValue} x2={frame.plotRight + 8} y2={labelY} stroke={l.color} strokeWidth={1} opacity={0.6} />
                  </g>
                );
              })}
              {hover !== null && <Crosshair frame={frame} minute={hover} />}
              {hover !== null &&
                lines.map((l) =>
                  l.values[hover] !== undefined && (focusKey === null || l.key === focusKey) ? (
                    <Dot key={l.key} cx={frame.x(hover)} cy={frame.y(l.values[hover])} color={l.color} />
                  ) : null
                )}
            </svg>
            {lines.map((l) => {
              const labelY = endY.get(l.key);
              if (labelY === undefined) return null;
              const strong = focusKey === null || l.key === focusKey;
              return (
                <span
                  key={l.key}
                  className="absolute rounded-[5px] overflow-hidden transition-opacity"
                  style={{
                    left: frame.plotRight + 9,
                    top: labelY - 8,
                    width: 16,
                    height: 16,
                    boxShadow: `0 0 0 1.5px ${l.color}`,
                    opacity: strong ? 1 : 0.2,
                  }}
                  aria-hidden
                >
                  <HeroIcon heroId={l.player.heroId} size={16} />
                </span>
              );
            })}
          </>
        )}
      </div>

      <aside className="space-y-3">
        <p className="text-xs text-ink-muted">
          {hover === null ? "Конец игры" : "Минута"} <span className="font-mono text-ink">{minute}′</span>
          {hover === null && <span> · наведи на график, чтобы увидеть любую минуту</span>}
        </p>
        {legendGroup("Radiant", RADIANT, lines.filter((l) => l.player.isRadiant))}
        {legendGroup("Dire", DIRE, lines.filter((l) => !l.player.isRadiant))}
      </aside>
    </div>
  );
}

/**
 * The match's post-game graphs, laid out like Dota 2's own: a selector of
 * graph types, the chart on the left and the players (or teams) with their
 * values at the hovered minute on the right.
 */
export function MatchGraphs({
  goldAdvantage,
  xpAdvantage,
  radiantPlayers,
  direPlayers,
  selectedAccountId,
  onSelect,
}: {
  goldAdvantage: number[];
  xpAdvantage: number[];
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  selectedAccountId: number | null;
  onSelect: (accountId: number) => void;
}) {
  const [graph, setGraph] = useState<GraphId>("advantage");
  const players = [...radiantPlayers, ...direPlayers];
  const available = GRAPHS.filter(({ id }) =>
    id === "advantage" ? goldAdvantage.length > 1 : players.some((p) => p.series[id].length > 1)
  );
  if (available.length === 0) return null;
  const active = available.some((g) => g.id === graph) ? graph : available[0].id;

  return (
    <section className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Графики матча</h3>
        <div className="flex gap-1 bg-page/60 border border-border rounded-xl p-1 overflow-x-auto scrollbar-none" role="tablist">
          {available.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active === g.id}
              onClick={() => setGraph(g.id)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                active === g.id ? "bg-accent text-page font-medium" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      {active === "advantage" ? (
        <AdvantageGraph gold={goldAdvantage} xp={xpAdvantage} />
      ) : (
        <PlayerGraph
          metric={active}
          radiantPlayers={radiantPlayers}
          direPlayers={direPlayers}
          selectedAccountId={selectedAccountId}
          onSelect={onSelect}
        />
      )}
    </section>
  );
}
