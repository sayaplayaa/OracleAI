import { HeroIcon } from "./HeroIcon";
import { AttributeBadge } from "./AttributeBadge";
import { StatBar } from "./StatBar";
import { MatchItemTimeline } from "./MatchItemTimeline";
import { SkillBuildTimeline } from "./SkillBuildTimeline";
import { AICoachPanel } from "./AICoachPanel";
import { PowerSpikePanel } from "./PowerSpikePanel";
import { PanelHeader } from "./PageHeader";
import { getHeroPrimaryAttr } from "@/lib/constants";
import type { FullMatchPlayer, MatchMetrics, SkillBuildEntry } from "@/lib/types";

export function PlayerDetailPanel({
  player,
  matchId,
  metrics,
  skillBuild,
  coreItemKeys,
}: {
  player: FullMatchPlayer;
  matchId: number;
  metrics: MatchMetrics;
  skillBuild: SkillBuildEntry[];
  coreItemKeys?: string[];
}) {
  if (player.accountId === null) return null;
  const accountId = player.accountId;
  const color = metrics.win ? "var(--color-status-good)" : "var(--color-status-critical)";

  return (
    <section className="space-y-4 rise-in" aria-label={`Подробно: ${player.heroName}`}>
      <div
        className="bg-surface border border-border rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap"
        style={{ boxShadow: `inset 4px 0 0 0 var(--color-accent)` }}
      >
        <HeroIcon heroId={player.heroId} size={48} className="rounded-lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-lg text-ink">{player.heroName}</h3>
            <AttributeBadge primaryAttr={getHeroPrimaryAttr(player.heroId)} />
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: color }}
            >
              {metrics.win ? "Победа" : "Поражение"}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            {player.personaname ?? "Аноним"} · {metrics.role}
          </p>
        </div>
        <div className="flex gap-2 ml-auto font-mono tabular-nums text-sm">
          <span className="rounded-lg bg-page/50 border border-border px-2.5 py-1 text-ink">
            {player.kills}/<span className="text-status-critical">{player.deaths}</span>/{player.assists}
          </span>
          <span className="rounded-lg bg-page/50 border border-border px-2.5 py-1 text-ink-secondary">{player.gpm} GPM</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <PanelHeader
            title={`На фоне всех игр на ${player.heroName}`}
            note="Перцентиль показывает, как цифра из этой игры выглядит на фоне всех игр на этом герое в OpenDota. Вертикальная черта - медиана."
          />
          <div className="divide-y divide-border">
            {metrics.stats.map((stat) => (
              <StatBar key={stat.label} stat={stat} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5">
            <PanelHeader title="Покупки по времени" />
            <MatchItemTimeline items={metrics.itemTimeline} startingItems={metrics.startingItems} coreItemKeys={coreItemKeys} />
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5">
            <PanelHeader title="Прокачка способностей" />
            <SkillBuildTimeline skillBuild={skillBuild} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <AICoachPanel
          key={`coach-${accountId}`}
          endpoint="/api/coach/match"
          body={{ matchId, accountId }}
          label="Найти ошибки"
          title={`Ошибки и сильные стороны: ${player.heroName}`}
          description="Сравнение с врагом на той же позиции по фазам игры, разбор смертей и конкретные советы - по данным реплея."
        />
        <PowerSpikePanel key={`spike-${accountId}`} matchId={matchId} accountId={accountId} />
      </div>
    </section>
  );
}
