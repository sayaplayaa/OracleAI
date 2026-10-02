import { HeroIcon } from "./HeroIcon";
import type { RoleComparisonEntry } from "@/lib/types";

const RADIANT_GREEN = "var(--color-status-good)";
const DIRE_RED = "var(--color-status-critical)";

// entry.position is a lib-side key ("Position 1".."Position 5"); only the
// displayed text is translated here.
const POSITION_TITLES: Record<string, string> = {
  "1": "Керри",
  "2": "Мид",
  "3": "Оффлейн",
  "4": "Поддержка",
  "5": "Хард-саппорт",
};

function positionNumber(position: string): string | null {
  return position.match(/\d/)?.[0] ?? null;
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
  color,
}: {
  heroId: number;
  heroName: string;
  personaname: string | null;
  align: "left" | "right";
  color: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="rounded-lg overflow-hidden shrink-0" style={{ boxShadow: `0 0 0 2px ${color}` }}>
        <HeroIcon heroId={heroId} size={40} />
      </span>
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
          className={`text-sm font-mono tabular-nums text-right ${radiantWins ? "font-semibold" : ""}`}
          style={{ color: radiantWins ? RADIANT_GREEN : "var(--color-ink-secondary)" }}
        >
          {formatStatValue(radiantValue, unit)}
        </span>
        <span className="text-[11px] text-ink-muted uppercase tracking-wide whitespace-nowrap">{label}</span>
        <span
          className={`text-sm font-mono tabular-nums text-left ${!radiantWins ? "font-semibold" : ""}`}
          style={{ color: !radiantWins ? DIRE_RED : "var(--color-ink-secondary)" }}
        >
          {formatStatValue(direValue, unit)}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5 bg-page gap-px">
        <div style={{ width: `${radiantShare}%`, background: RADIANT_GREEN, opacity: radiantWins ? 1 : 0.45 }} />
        <div className="flex-1" style={{ background: DIRE_RED, opacity: radiantWins ? 0.45 : 1 }} />
      </div>
    </div>
  );
}

export function RoleComparisonCard({ entry }: { entry: RoleComparisonEntry }) {
  const radiantAhead = entry.radiantStatsWon > entry.direStatsWon;
  const tied = entry.radiantStatsWon === entry.direStatsWon;
  const n = positionNumber(entry.position);
  const winnerColor = tied ? "var(--color-border)" : radiantAhead ? RADIANT_GREEN : DIRE_RED;

  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5"
      style={{ boxShadow: `inset 0 3px 0 0 ${winnerColor}` }}
    >
      <div className="flex items-center gap-2 mb-4">
        {n && (
          <span className="w-6 h-6 rounded-md bg-surface-raised text-ink-secondary text-xs font-mono font-bold flex items-center justify-center">
            {n}
          </span>
        )}
        <h3 className="text-sm font-semibold text-ink">{(n && POSITION_TITLES[n]) || entry.position}</h3>
        <span className="ml-auto text-[10px] text-ink-muted uppercase tracking-wide">
          {entry.positionConfirmed ? "Роль подтверждена" : "Оценка по GPM"}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 mb-3">
        <PlayerHeader
          heroId={entry.radiant.heroId}
          heroName={entry.radiant.heroName}
          personaname={entry.radiant.personaname}
          align="left"
          color={RADIANT_GREEN}
        />
        <span className="font-display font-bold text-lg tabular-nums text-ink px-1">
          <span style={{ color: radiantAhead ? RADIANT_GREEN : undefined }}>{entry.radiantStatsWon}</span>
          <span className="text-ink-muted">:</span>
          <span style={{ color: !radiantAhead && !tied ? DIRE_RED : undefined }}>{entry.direStatsWon}</span>
        </span>
        <PlayerHeader
          heroId={entry.dire.heroId}
          heroName={entry.dire.heroName}
          personaname={entry.dire.personaname}
          align="right"
          color={DIRE_RED}
        />
      </div>

      <div className="divide-y divide-border">
        {entry.stats.map((stat) => (
          <StatRow key={stat.label} {...stat} />
        ))}
      </div>

      <p className="text-xs text-ink-muted mt-3 text-center">
        {tied ? (
          "Ничья по числу выигранных показателей"
        ) : (
          <>
            <span className="font-semibold" style={{ color: winnerColor }}>
              {radiantAhead ? entry.radiant.heroName : entry.dire.heroName}
            </span>{" "}
            выиграл больше показателей
          </>
        )}
      </p>
    </section>
  );
}
