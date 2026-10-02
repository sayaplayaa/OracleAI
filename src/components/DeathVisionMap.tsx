"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { HeroIcon } from "./HeroIcon";
import { formatMatchTime } from "@/lib/format";
import type { DeathTag, DeathVisionMoment, WardPoint } from "@/lib/types";

// Wards are colored relative to the player (own vs enemy), not Radiant/Dire:
// "whose ward saw me" is the question this map answers.
const OWN = "var(--color-series-aqua)";
const ENEMY = "var(--color-status-critical)";

const TAG_STYLE: Record<DeathTag["tone"], string> = {
  bad: "bg-status-critical/12 text-status-critical border-status-critical/30",
  warn: "bg-highlight-bg text-highlight-text border-highlight-text/25",
  info: "bg-surface-raised text-ink-secondary border-border",
};

type FilterId = "all" | "ward" | "alone" | "creeps";

const FILTERS: { id: FilterId; label: string; test: (m: DeathVisionMoment) => boolean }[] = [
  { id: "all", label: "Все смерти", test: () => true },
  { id: "ward", label: "Под вражеским вардом", test: (m) => m.enemyWard !== null },
  { id: "alone", label: "Вне тимфайта", test: (m) => !m.inTeamfight && m.killer.kind === "hero" },
  {
    id: "creeps",
    label: "Крипы и башни",
    test: (m) => m.killer.kind === "creeps" || m.killer.kind === "tower" || m.killer.kind === "neutrals",
  },
];

function WardMarker({ ward }: { ward: WardPoint }) {
  const own = ward.own === true;
  const color = own ? OWN : ENEMY;
  const isObserver = ward.kind === "observer";
  const label = `${ward.kind === "observer" ? "Observer Ward" : "Sentry Ward"} ${own ? "твоей команды" : "врага"}${
    ward.placedBy ? ` (${ward.placedBy})` : ""
  }, поставлен в ${formatMatchTime(ward.time)}`;
  return (
    <>
      {isObserver && ward.radius && (ward.coversDeath || !own) && (
        <span
          aria-hidden
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            left: `${ward.x}%`,
            top: `${ward.y}%`,
            width: `${ward.radius * 2}%`,
            height: `${ward.radius * 2}%`,
            background: ward.coversDeath ? `color-mix(in srgb, ${color} 22%, transparent)` : `color-mix(in srgb, ${color} 8%, transparent)`,
            border: `1px ${ward.coversDeath ? "solid" : "dashed"} color-mix(in srgb, ${color} ${ward.coversDeath ? 80 : 40}%, transparent)`,
          }}
        />
      )}
      <span
        title={label}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${ward.x}%`,
          top: `${ward.y}%`,
          width: isObserver ? 11 : 9,
          height: isObserver ? 11 : 9,
          background: isObserver ? color : "transparent",
          border: `2px ${isObserver ? "solid" : "dashed"} ${color}`,
          boxShadow: "0 0 0 1.5px rgba(10,8,6,0.8)",
        }}
      >
        <span className="sr-only">{label}</span>
      </span>
    </>
  );
}

function DeathMarker({
  moment,
  index,
  selected,
  onSelect,
}: {
  moment: DeathVisionMoment;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!moment.position) return null;
  return (
    <button
      onClick={onSelect}
      aria-label={`Смерть ${index + 1}, ${moment.timeLabel}`}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono font-bold transition-all ${
        selected
          ? "w-7 h-7 text-[12px] bg-accent text-page z-20 ring-4 ring-accent/30"
          : "w-5 h-5 text-[10px] bg-page/90 text-ink border border-ink-muted/70 z-10 hover:border-accent hover:text-accent"
      }`}
      style={{ left: `${moment.position.x}%`, top: `${moment.position.y}%` }}
    >
      {index + 1}
    </button>
  );
}

function Tags({ tags }: { tags: DeathTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t.text} className={`text-[11px] leading-none px-2 py-1 rounded-full border ${TAG_STYLE[t.tone]}`}>
          {t.text}
        </span>
      ))}
    </div>
  );
}

function KillerAvatars({ moment }: { moment: DeathVisionMoment }) {
  if (moment.enemiesInvolved.length === 0) {
    return (
      <span className="text-xs text-ink-secondary">
        {moment.killer.kind === "roshan" ? "Roshan" : moment.killer.name}
      </span>
    );
  }
  return (
    <div className="flex items-center -space-x-1.5">
      {moment.enemiesInvolved.slice(0, 5).map((e) => (
        <span key={e.heroId} title={e.name} className="rounded ring-2 ring-surface">
          <HeroIcon heroId={e.heroId} size={22} />
        </span>
      ))}
    </div>
  );
}

function DeathCard({
  moment,
  index,
  selected,
  onSelect,
}: {
  moment: DeathVisionMoment;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const extra = [
    moment.timeDead ? `мёртв ${moment.timeDead} сек` : null,
    moment.goldLost ? `потерял ${moment.goldLost.toLocaleString("ru-RU")} золота` : null,
  ].filter(Boolean);

  return (
    <li>
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full text-left rounded-xl border p-3.5 transition ${
          selected
            ? "bg-surface-raised border-accent/70 shadow-[0_0_0_1px_var(--color-accent)]"
            : "bg-surface border-border hover:border-ink-muted/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-mono font-bold ${
              selected ? "bg-accent text-page" : "bg-page text-ink-secondary border border-border"
            }`}
          >
            {index + 1}
          </span>
          <span className="font-mono text-sm text-ink tabular-nums">{moment.timeLabel}</span>
          <span className="text-sm font-semibold text-ink truncate flex-1 min-w-0">
            {moment.place ?? "место неизвестно"}
          </span>
          <KillerAvatars moment={moment} />
        </div>
        <p className="text-sm text-ink-secondary leading-relaxed mt-2">{moment.reason}</p>
        <div className="mt-2.5">
          <Tags tags={moment.tags} />
        </div>
        {extra.length > 0 && <p className="text-[11px] text-ink-muted font-mono mt-2">{extra.join(" · ")}</p>}
      </button>
    </li>
  );
}

function SelectedDetails({ moment }: { moment: DeathVisionMoment }) {
  const enemyWards = moment.wards.filter((w) => !w.own);
  const ownWards = moment.wards.filter((w) => w.own);
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg bg-page/60 border border-border px-3 py-2">
        <p className="text-ink-muted">Убийца</p>
        <p className="text-ink font-medium mt-0.5">
          {moment.killer.name}
          {moment.killingBlow && <span className="text-ink-secondary font-normal"> · {moment.killingBlow}</span>}
        </p>
      </div>
      <div className="rounded-lg bg-page/60 border border-border px-3 py-2">
        <p className="text-ink-muted">Варды в этот момент</p>
        <p className="text-ink font-medium mt-0.5">
          <span style={{ color: ENEMY }}>{enemyWards.length} вражеских</span>
          {" · "}
          <span style={{ color: OWN }}>{ownWards.length} твоих</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Every death of the player on the real minimap, with the place, the cause
 * and the wards that were really standing at that second. Horizontal: the
 * map on the left, the list of deaths on the right; picking a death in
 * either one selects it in both.
 */
export function DeathVisionMap({ moments }: { moments: DeathVisionMoment[] }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [selected, setSelected] = useState(0);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, moments.filter(f.test).length])) as Record<FilterId, number>,
    [moments]
  );
  const visible = moments.map((m, i) => ({ m, i })).filter(({ m }) => FILTERS.find((f) => f.id === filter)!.test(m));

  if (moments.length === 0) return null;
  const current = moments[selected] ?? moments[0];
  const withPosition = moments.filter((m) => m.position).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Фильтр смертей">
        {FILTERS.map((f) =>
          counts[f.id] > 0 || f.id === "all" ? (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                const first = moments.findIndex(f.test);
                if (first >= 0) setSelected(first);
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                filter === f.id
                  ? "bg-accent text-page border-accent"
                  : "bg-surface text-ink-secondary border-border hover:text-ink hover:border-ink-muted/60"
              }`}
            >
              {f.label} <span className="font-mono opacity-80">{counts[f.id]}</span>
            </button>
          ) : null
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 items-start">
        <div className="space-y-3 lg:sticky lg:top-20">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-border bg-page">
            <Image src="/minimap.png" alt="Миникарта Dota 2" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-page/25" aria-hidden />
            {current.wards.map((w, i) => (
              <WardMarker key={`${w.time}-${i}`} ward={w} />
            ))}
            {moments.map((m, i) => (
              <DeathMarker key={i} moment={m} index={i} selected={i === selected} onSelect={() => setSelected(i)} />
            ))}
            <div className="absolute left-3 top-3 rounded-lg bg-page/85 backdrop-blur px-2.5 py-1.5 text-xs">
              <span className="font-mono text-accent font-bold">#{selected + 1}</span>
              <span className="text-ink-secondary"> · {current.timeLabel}</span>
            </div>
          </div>

          <SelectedDetails moment={current} />

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENEMY }} /> Observer Ward врага
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: OWN }} /> Observer Ward твоей команды
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-ink-muted" /> Sentry Ward
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-dashed" style={{ borderColor: ENEMY }} /> радиус обзора
            </span>
          </div>
          {withPosition < moments.length && (
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Для {moments.length - withPosition} из {moments.length} смертей точного места в данных реплея нет - они
              есть в списке, но не на карте.
            </p>
          )}
        </div>

        <ol className="space-y-2.5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          {visible.map(({ m, i }) => (
            <DeathCard key={i} moment={m} index={i} selected={i === selected} onSelect={() => setSelected(i)} />
          ))}
        </ol>
      </div>
    </div>
  );
}
