"use client";

import { HeroIcon } from "./HeroIcon";
import { ItemIcon } from "./ItemIcon";
import type { FullMatchPlayer } from "@/lib/types";

const TEAM = {
  radiant: { name: "Силы Света", short: "Radiant", color: "var(--color-status-good)" },
  dire: { name: "Силы Тьмы", short: "Dire", color: "var(--color-status-critical)" },
};

function compact(value: number): string {
  return value >= 10000 ? `${(value / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}k` : value.toLocaleString("ru-RU");
}

function TeamTable({
  players,
  team,
  won,
  focusedAccountId,
  focusLabel,
  selectedAccountId,
  onSelectPlayer,
}: {
  players: FullMatchPlayer[];
  team: "radiant" | "dire";
  won: boolean;
  focusedAccountId: number | null;
  focusLabel: string;
  selectedAccountId?: number | null;
  onSelectPlayer?: (accountId: number) => void;
}) {
  const meta = TEAM[team];
  const kills = players.reduce((s, p) => s + p.kills, 0);
  const netWorth = players.reduce((s, p) => s + p.netWorth, 0);

  return (
    <section className="bg-surface border border-border rounded-2xl overflow-hidden" style={{ boxShadow: `inset 0 3px 0 0 ${meta.color}` }}>
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 flex-wrap">
        <h3 className="font-display font-bold text-ink" style={{ color: meta.color }}>
          {meta.name}
        </h3>
        {won && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border" style={{ color: meta.color, borderColor: meta.color }}>
            Победа
          </span>
        )}
        <span className="ml-auto text-xs text-ink-muted font-mono tabular-nums">
          {kills} убийств · {netWorth.toLocaleString("ru-RU")} нетворса
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[860px]">
          <thead>
            <tr className="text-[11px] text-ink-muted uppercase tracking-wide text-left border-y border-border bg-page/30">
              <th className="py-2 pl-5 pr-3 font-medium">Игрок</th>
              <th className="py-2 px-2 font-medium text-right" title="Уровень">Ур.</th>
              <th className="py-2 px-2 font-medium" title="Убийства / смерти / помощь">K / D / A</th>
              <th className="py-2 px-2 font-medium text-right" title="Добивания / денаи">Доб. / Ден.</th>
              <th className="py-2 px-2 font-medium text-right" title="Золото в минуту">GPM</th>
              <th className="py-2 px-2 font-medium text-right" title="Опыт в минуту">XPM</th>
              <th className="py-2 px-2 font-medium text-right">Нетворс</th>
              <th className="py-2 px-2 font-medium text-right" title="Урон по героям">Урон</th>
              <th className="py-2 px-2 font-medium text-right" title="Урон по постройкам">Здания</th>
              <th className="py-2 px-2 font-medium text-right" title="Observer Ward / Sentry Ward">Варды</th>
              <th className="py-2 pl-2 pr-5 font-medium">Предметы</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((p) => {
              const isFocused = focusedAccountId !== null && p.accountId === focusedAccountId;
              const isSelected = !!selectedAccountId && p.accountId === selectedAccountId;
              const clickable = onSelectPlayer && p.accountId !== null;
              return (
                <tr
                  key={`${p.heroId}-${p.accountId ?? "anon"}`}
                  onClick={() => clickable && onSelectPlayer(p.accountId!)}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelectPlayer(p.accountId!);
                    }
                  }}
                  tabIndex={clickable ? 0 : undefined}
                  aria-selected={clickable ? isSelected : undefined}
                  className={`transition-colors outline-none ${clickable ? "cursor-pointer hover:bg-surface-raised/70 focus-visible:bg-surface-raised" : ""} ${
                    isSelected ? "bg-accent/8" : isFocused ? "bg-surface-raised/50" : ""
                  }`}
                  style={isSelected ? { boxShadow: "inset 3px 0 0 0 var(--color-accent)" } : undefined}
                >
                  <td className="py-2.5 pl-5 pr-3">
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      <HeroIcon heroId={p.heroId} size={32} />
                      <div className="min-w-0">
                        <div className="text-ink font-medium truncate">{p.heroName}</div>
                        <div className="text-xs text-ink-muted truncate">
                          {p.personaname ?? "Аноним"}
                          {isFocused && <span className="text-accent font-semibold"> · {focusLabel}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">{p.level}</td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink whitespace-nowrap">
                    {p.kills}/<span className="text-status-critical">{p.deaths}</span>/{p.assists}
                  </td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">
                    {p.lastHits}/{p.denies}
                  </td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">{p.gpm}</td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">{p.xpm}</td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-accent text-right">{compact(p.netWorth)}</td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">{compact(p.heroDamage)}</td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">{compact(p.towerDamage)}</td>
                  <td className="py-2.5 px-2 font-mono tabular-nums text-ink-secondary text-right">
                    {p.obsPlaced}/{p.senPlaced}
                  </td>
                  <td className="py-2.5 pl-2 pr-5">
                    <div className="flex gap-1">
                      {p.itemKeys.length === 0 ? (
                        <span className="text-ink-muted">-</span>
                      ) : (
                        p.itemKeys.map((key, i) => <ItemIcon key={i} itemKey={key} size={26} />)
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FullMatchScoreboard({
  radiantPlayers,
  direPlayers,
  radiantWin,
  focusedAccountId,
  focusLabel = "это ты",
  selectedAccountId,
  onSelectPlayer,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  radiantWin: boolean;
  focusedAccountId: number | null;
  focusLabel?: string;
  selectedAccountId?: number | null;
  onSelectPlayer?: (accountId: number) => void;
}) {
  return (
    <div className="space-y-4">
      {onSelectPlayer && (
        <p className="text-xs text-ink-muted">Нажми на игрока - ниже откроются его перцентили, покупки, прокачка и ИИ-разбор.</p>
      )}
      <TeamTable
        players={radiantPlayers}
        team="radiant"
        won={radiantWin}
        focusedAccountId={focusedAccountId}
        focusLabel={focusLabel}
        selectedAccountId={selectedAccountId}
        onSelectPlayer={onSelectPlayer}
      />
      <TeamTable
        players={direPlayers}
        team="dire"
        won={!radiantWin}
        focusedAccountId={focusedAccountId}
        focusLabel={focusLabel}
        selectedAccountId={selectedAccountId}
        onSelectPlayer={onSelectPlayer}
      />
    </div>
  );
}
