import { HeroIcon } from "./HeroIcon";
import { AttributeBadge } from "./AttributeBadge";
import { StatBar } from "./StatBar";
import { MatchItemTimeline } from "./MatchItemTimeline";
import { SkillBuildTimeline } from "./SkillBuildTimeline";
import { AICoachPanel } from "./AICoachPanel";
import { PowerSpikePanel } from "./PowerSpikePanel";
import { getHeroPrimaryAttr } from "@/lib/constants";
import type { FullMatchPlayer, MatchMetrics, SkillBuildEntry } from "@/lib/types";

export function PlayerDetailPanel({
  player,
  matchId,
  metrics,
  skillBuild,
}: {
  player: FullMatchPlayer;
  matchId: number;
  metrics: MatchMetrics;
  skillBuild: SkillBuildEntry[];
}) {
  if (player.accountId === null) return null;
  const accountId = player.accountId;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-3">
        <HeroIcon heroId={player.heroId} size={44} />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">{player.heroName}</h3>
            <AttributeBadge primaryAttr={getHeroPrimaryAttr(player.heroId)} />
            <span
              className="text-xs font-semibold"
              style={{
                color: metrics.win
                  ? "var(--color-status-good)"
                  : "var(--color-status-critical)",
              }}
            >
              {metrics.win ? "Victory" : "Defeat"}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            {player.personaname ?? "Anonymous"} · {metrics.role}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">
            Performance vs {player.heroName} benchmarks
          </h4>
          <div className="divide-y divide-border">
            {metrics.stats.map((stat) => (
              <StatBar key={stat.label} stat={stat} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">
              Item timeline
            </h4>
            <MatchItemTimeline items={metrics.itemTimeline} />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">
              Skill build
            </h4>
            <SkillBuildTimeline skillBuild={skillBuild} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <AICoachPanel
          key={`coach-${accountId}`}
          endpoint="/api/coach/match"
          body={{ matchId, accountId }}
          label="Find mistakes & strengths"
        />
        <PowerSpikePanel key={`spike-${accountId}`} matchId={matchId} accountId={accountId} />
      </div>
    </div>
  );
}
