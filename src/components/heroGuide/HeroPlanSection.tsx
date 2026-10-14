import Image from "next/image";
import type { GameLengthStat, HeroBuildOverview } from "@/lib/types";
import { AiActionCard } from "../AiActionCard";
import { PanelHeader } from "../PageHeader";
import type { BuildState, GuideState } from "./useHeroGuideData";

function lengthLabel(g: GameLengthStat): string {
  if (g.toMinute === null) return `дольше ${g.fromMinute} мин`;
  return g.fromMinute === 0 ? `до ${g.toMinute} мин` : `${g.fromMinute}-${g.toMinute} мин`;
}

// A swing this big between short and long games changes how the hero should play.
const LENGTH_SWING = 0.03;

function lengthVerdict(lengths: GameLengthStat[]): string | null {
  if (lengths.length < 2) return null;
  const swing = lengths[lengths.length - 1].winRate - lengths[0].winRate;
  if (swing >= LENGTH_SWING) return "Чем дольше игра, тем чаще герой побеждает: ранний проигрыш - ещё не поражение.";
  if (swing <= -LENGTH_SWING) return "Чем короче игра, тем чаще герой побеждает: выгодно закрывать игру, пока соперник не собрался.";
  return "Длина игры на винрейт почти не влияет.";
}

function GameLength({ lengths }: { lengths: GameLengthStat[] }) {
  if (lengths.length === 0) return null;
  const verdict = lengthVerdict(lengths);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Винрейт по длине игры</p>
      <ul className="space-y-1.5">
        {lengths.map((g) => {
          const color = g.winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)";
          // 40-60% fills the bar.
          const width = Math.max(4, Math.min(100, ((g.winRate - 0.4) / 0.2) * 100));
          return (
            <li key={g.fromMinute} className="grid grid-cols-[96px_1fr_44px] items-center gap-2">
              <span className="text-xs text-ink-secondary">{lengthLabel(g)}</span>
              <span className="h-1.5 rounded-full bg-page overflow-hidden" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${width}%`, background: color }} />
              </span>
              <span className="text-xs font-mono tabular-nums text-right" style={{ color }} title={`${g.games.toLocaleString("ru-RU")} игр`}>
                {(g.winRate * 100).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
      {verdict && <p className="text-xs text-ink-secondary mt-2 leading-relaxed">{verdict}</p>}
    </div>
  );
}

function SkillOrder({ steps }: { steps: HeroBuildOverview["skillOrder"] }) {
  if (steps.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Что качать в максимум</p>
      <ol className="flex gap-2 flex-wrap">
        {steps.map((s, i) => (
          <li key={s.abilityKey} className="flex items-center gap-2 rounded-xl border border-border bg-page/50 pl-1.5 pr-3 py-1.5">
            <span className="text-[10px] font-mono text-ink-muted w-3 text-right">{i + 1}</span>
            {s.iconUrl && (
              <Image src={s.iconUrl} alt="" width={26} height={26} className="rounded-md border border-border" unoptimized />
            )}
            <span className="min-w-0">
              <span className="block text-xs text-ink leading-tight">{s.abilityName}</span>
              <span className="block text-[10px] font-mono text-ink-muted tabular-nums">к {s.maxedAtLevel} ур.</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The top of the guide: the AI coach's plan for the hero in this role (or
 * the button that writes it), next to what the data says about how the hero
 * wins - by game length and by the order its abilities are maxed.
 */
export function HeroPlanSection({
  heroName,
  roleLabel,
  guide,
  onRunGuide,
  buildState,
}: {
  heroName: string;
  roleLabel: string | null;
  guide: GuideState;
  onRunGuide: () => void;
  buildState: BuildState | null;
}) {
  const build = buildState?.status === "done" ? buildState.build : null;
  const role = roleLabel ? ` - ${roleLabel.toLowerCase()}` : "";

  let coach;
  if (guide.status === "done") {
    coach = (
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 h-full rise-in" style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
          ИИ-тренер · {heroName} · {guide.report.roleLabel}
        </p>
        {guide.report.identity ? (
          <p className="font-display font-medium text-lg text-ink leading-snug">{guide.report.identity}</p>
        ) : (
          <p className="text-sm text-ink-secondary">Разборы предметов, фишки и советы по линии и дракам - в разделах ниже.</p>
        )}
      </div>
    );
  } else if (guide.status === "checking") {
    coach = <div className="h-[170px] rounded-2xl bg-surface border border-border animate-pulse" aria-busy="true" aria-label="Проверяю готовый гайд" />;
  } else {
    coach = (
      <AiActionCard
        title={`ИИ-гайд по ${heroName}${role}`}
        description="Тренер разберёт каждый предмет основы сборки (какую способность он усиливает и к какой минуте его успеть), подскажет, какой поздний предмет брать в какой игре, покажет фишки героя из официальных механик игры и даст советы по линии, дракам и матчапам. Всё - по реальным данным этой роли, без общих советов."
        actionLabel="Создать ИИ-гайд"
        loadingLabel="Пишу гайд…"
        startedAt={guide.status === "loading" ? guide.startedAt : null}
        error={guide.status === "idle" ? (guide.error ?? null) : null}
        onRun={onRunGuide}
      />
    );
  }

  const hasData = build && (build.gameLength.length > 0 || build.skillOrder.length > 0);
  return (
    <div className={`grid gap-4 items-stretch ${hasData ? "lg:grid-cols-[3fr_2fr]" : ""}`}>
      <div>{coach}</div>
      {hasData && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <PanelHeader title="Как герой выигрывает" note="Легенда и выше, эта неделя (STRATZ)." />
          <GameLength lengths={build.gameLength} />
          <SkillOrder steps={build.skillOrder} />
        </div>
      )}
    </div>
  );
}
