import { HeroIcon } from "./HeroIcon";
import type { RoleComparisonEntry } from "@/lib/types";

const RADIANT_GREEN = "var(--color-status-good)";
const DIRE_RED = "var(--color-status-critical)";

// entry.position is a lib-side key ("Position 1".."Position 5"); only the
// displayed text is translated here.
const POSITION_TITLES: Record<string, string> = {
  "1": "Керри (Позиция 1)",
  "2": "Мид (Позиция 2)",
  "3": "Оффлейн (Позиция 3)",
  "4": "Поддержка (Позиция 4)",
  "5": "Хард-саппорт (Позиция 5)",
};

function positionTitle(position: string): string {
  const n = position.match(/\d/)?.[0];
  return (n && POSITION_TITLES[n]) || position;
}

function formatStatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  return unit ? `${rounded.toLocaleString("ru-RU")} ${unit}` : rounded.toLocaleString("ru-RU");
}

function PlayerHeader({
  heroId,
  heroName,
  personaname,
  align,
}: {
  heroId: number;
  heroName: string;
  personaname: string | null;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <HeroIcon heroId={heroId} size={40} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink truncate">{heroName}</div>
        <div className="text-xs text-ink-muted truncate">{personaname ?? "Аноним"}</div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  unit,
  radiantValue,
  direValue,
  radiantWins,
}: {
  label: string;
  unit?: string;
  radiantValue: number;
  direValue: number;
  radiantWins: boolean;
}) {
  const total = Math.abs(radiantValue) + Math.abs(direValue) || 1;
  const radiantShare = Math.max(6, Math.min(94, (Math.abs(radiantValue) / total) * 100));

  return (
    <div className="py-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span
          className="text-sm font-mono tabular-nums text-right"
          style={{ color: radiantWins ? RADIANT_GREEN : "var(--color-ink-secondary)" }}
        >
          {formatStatValue(radiantValue, unit)}
        </span>
        <span className="text-[11px] text-ink-muted uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
        <span
          className="text-sm font-mono tabular-nums text-left"
          style={{ color: !radiantWins ? DIRE_RED : "var(--color-ink-secondary)" }}
        >
          {formatStatValue(direValue, unit)}
        </span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden mt-1.5 bg-baseline">
        <div style={{ width: `${radiantShare}%`, background: RADIANT_GREEN }} />
        <div className="flex-1" style={{ background: DIRE_RED }} />
      </div>
    </div>
  );
}

export function RoleComparisonCard({ entry }: { entry: RoleComparisonEntry }) {
  const radiantAhead = entry.radiantStatsWon > entry.direStatsWon;
  const tied = entry.radiantStatsWon === entry.direStatsWon;

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink">{positionTitle(entry.position)}</h3>
        <span className="text-[11px] text-ink-muted uppercase tracking-wide">
          {entry.positionConfirmed ? "Роль подтверждена" : "Оценка по GPM"}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <PlayerHeader
          heroId={entry.radiant.heroId}
          heroName={entry.radiant.heroName}
          personaname={entry.radiant.personaname}
          align="left"
        />
        <span className="text-xs text-ink-muted font-mono px-2">
          {entry.radiantStatsWon}-{entry.direStatsWon}
        </span>
        <PlayerHeader
          heroId={entry.dire.heroId}
          heroName={entry.dire.heroName}
          personaname={entry.dire.personaname}
          align="right"
        />
      </div>

      <div className="divide-y divide-border">
        {entry.stats.map((stat) => (
          <StatRow key={stat.label} {...stat} />
        ))}
      </div>

      {!tied && (
        <p className="text-xs text-ink-muted mt-3 text-center">
          <span
            className="font-semibold"
            style={{ color: radiantAhead ? RADIANT_GREEN : DIRE_RED }}
          >
            {radiantAhead ? entry.radiant.heroName : entry.dire.heroName}
          </span>{" "}
          выиграл больше показателей в этом противостоянии
        </p>
      )}
    </div>
  );
}
