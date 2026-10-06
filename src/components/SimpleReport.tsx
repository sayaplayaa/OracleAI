import Link from "next/link";
import type {
  CoachFinding,
  CoachPhaseReport,
  CoachReport,
  GameContext,
  PhaseId,
  PhaseVerdict,
} from "@/lib/types";
import { DeathVisionMap } from "./DeathVisionMap";
import { GameFlowCard } from "./GameFlowCard";
import { NetWorthDiffChart } from "./NetWorthDiffChart";

const PHASE_TITLES: Record<PhaseId, string> = {
  laning: "Линия",
  midGame: "Мидгейм",
  lateGame: "Лейтгейм",
};

const VERDICTS: Record<PhaseVerdict, { label: string; color: string; icon: string }> = {
  won: { label: "Выиграл", color: "var(--color-status-good)", icon: "▲" },
  even: { label: "Наравне", color: "var(--color-highlight-text)", icon: "■" },
  lost: { label: "Проиграл", color: "var(--color-status-critical)", icon: "▼" },
};

function SectionTitle({ title, note, right }: { title: string; note?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
      <div>
        <h2 className="font-display font-bold text-lg sm:text-xl text-ink">{title}</h2>
        {note && <p className="text-sm text-ink-muted mt-1 max-w-3xl">{note}</p>}
      </div>
      {right}
    </div>
  );
}

function Label({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${
        accent ? "text-accent" : "text-ink-muted"
      }`}
    >
      {children}
    </p>
  );
}

function ColumnHeader({
  icon,
  title,
  count,
  color,
}: {
  icon: string;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        aria-hidden
      >
        {icon}
      </span>
      <h2 className="font-display font-bold text-lg text-ink flex-1">{title}</h2>
      <span className="font-mono text-xs text-ink-muted">{count}</span>
    </div>
  );
}

function StrengthsColumn({ strengths }: { strengths: CoachFinding[] }) {
  const color = "var(--color-status-good)";
  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6"
      style={{ boxShadow: `inset 0 3px 0 0 ${color}` }}
    >
      <ColumnHeader icon="✓" title="Что получилось хорошо" count={strengths.length} color={color} />
      {strengths.length === 0 ? (
        <p className="text-sm text-ink-muted leading-relaxed">
          В этой игре данные не показали явного преимущества над соперником. Это нормально -
          сфокусируйся на пунктах справа, и плюсы появятся здесь в следующих разборах.
        </p>
      ) : (
        <ul className="space-y-3">
          {strengths.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-page/50 border border-border p-3.5">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-page" style={{ background: color }}>
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink leading-relaxed">{s.point}</p>
                <p className="text-xs text-ink-muted font-mono mt-1 leading-relaxed">{s.metric}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ImprovementsColumn({ tips }: { tips: CoachFinding[] }) {
  const color = "var(--color-highlight-text)";
  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6"
      style={{ boxShadow: `inset 0 3px 0 0 ${color}` }}
    >
      <ColumnHeader icon="↑" title="Что подтянуть" count={tips.length} color={color} />
      {tips.length === 0 ? (
        <p className="text-sm text-ink-muted leading-relaxed">
          Серьёзных ошибок по данным матча не нашлось - отличная игра.
        </p>
      ) : (
        <ol className="space-y-3">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-page/50 border border-border p-3.5">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-accent text-page text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-2">
                <div>
                  <Label>Что случилось</Label>
                  <p className="text-sm text-ink-secondary leading-relaxed">{tip.metric}</p>
                </div>
                <div>
                  <Label accent>Как исправить</Label>
                  <p className="text-sm text-ink leading-relaxed">{tip.point}</p>
                </div>
                {tip.target && (
                  <div className="rounded-lg border border-accent/30 bg-accent/8 px-3 py-2">
                    <Label accent>Цель на следующую игру</Label>
                    <p className="text-sm text-ink font-medium leading-snug">{tip.target}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PhaseCard({ phase }: { phase: CoachPhaseReport }) {
  const verdict = phase.verdict ? VERDICTS[phase.verdict] : null;
  const evidenceCount = phase.catalysts.length + phase.evidence.length;
  return (
    <li
      className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: `inset 0 3px 0 0 ${verdict?.color ?? "var(--color-border)"}` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-display font-bold text-ink">{PHASE_TITLES[phase.id] ?? phase.label}</h3>
        <span className="text-xs font-mono text-ink-muted bg-page px-1.5 py-0.5 rounded">{phase.window}</span>
        {verdict && (
          <span
            className="ml-auto text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
            style={{ color: verdict.color, borderColor: verdict.color }}
          >
            {verdict.icon} {verdict.label}
          </span>
        )}
      </div>

      <p className="text-sm text-ink leading-relaxed">{phase.whatWentWrong}</p>

      {phase.decision && (
        <div>
          <Label>Почему так вышло</Label>
          <p className="text-sm text-ink-secondary leading-relaxed">{phase.decision}</p>
        </div>
      )}

      {phase.doInstead && (
        <div className="rounded-xl bg-accent/8 border border-accent/20 p-3">
          <Label accent>Что делать иначе</Label>
          <p className="text-sm text-ink leading-relaxed">{phase.doInstead}</p>
        </div>
      )}

      {evidenceCount > 0 && (
        <details className="mt-auto">
          <summary className="text-xs text-ink-muted cursor-pointer select-none hover:text-ink-secondary">
            Цифры из реплея ({evidenceCount})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {phase.catalysts.map((c, i) => (
              <li key={`c${i}`} className="text-xs text-highlight-text leading-snug">
                {c}
              </li>
            ))}
            {phase.evidence.map((e, i) => (
              <li key={`e${i}`} className="text-xs text-ink-muted font-mono leading-snug">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function VerdictStrip({ phases, counterpart }: { phases: CoachPhaseReport[]; counterpart?: string }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 flex flex-col">
      <Label>Фазы против {counterpart ?? "соперника"}</Label>
      <ol className="mt-2 grid grid-cols-3 gap-2 flex-1">
        {phases.map((p) => {
          const v = p.verdict ? VERDICTS[p.verdict] : null;
          return (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-page/50 px-3 py-3 flex flex-col items-center justify-center text-center gap-1"
            >
              <span className="text-lg leading-none" style={{ color: v?.color ?? "var(--color-ink-muted)" }} aria-hidden>
                {v?.icon ?? "·"}
              </span>
              <span className="text-xs font-semibold text-ink">{PHASE_TITLES[p.id] ?? p.label}</span>
              <span className="text-[11px]" style={{ color: v?.color ?? "var(--color-ink-muted)" }}>
                {v?.label ?? "нет данных"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Turbo and players who left change how the whole report reads - said first. */
export function GameContextNotice({ context }: { context?: GameContext }) {
  if (!context || context.notes.length === 0) return null;
  const color = context.leavers.length > 0 ? "var(--color-status-critical)" : "var(--color-highlight-text)";
  return (
    <section
      className="bg-surface border border-border rounded-2xl px-5 py-4"
      style={{ boxShadow: `inset 4px 0 0 0 ${color}` }}
      aria-label="Особенности этой игры"
    >
      <Label>Особенности этой игры</Label>
      <ul className="space-y-1.5 mt-1">
        {context.notes.map((note) => (
          <li key={note} className="text-sm text-ink-secondary leading-relaxed">
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatsButton({
  accountId,
  matchId,
  primary = false,
}: {
  accountId: number;
  matchId: number;
  primary?: boolean;
}) {
  return (
    <Link
      href={`/player/${accountId}/match/${matchId}`}
      className={
        primary
          ? "inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-page hover:brightness-110 transition"
          : "inline-flex items-center justify-center rounded-xl border border-border bg-page/40 px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink hover:border-accent/60 transition whitespace-nowrap"
      }
    >
      Подробная статистика матча
    </Link>
  );
}

export function SimpleReport({
  report,
  accountId,
  matchId,
}: {
  report: CoachReport;
  accountId: number;
  matchId: number;
}) {
  const phases = report.phases ?? [];
  const comparison = report.comparison;
  const deaths = report.deathVision ?? [];

  return (
    <div className="space-y-10 rise-in">
      <GameContextNotice context={report.context} />
      {phases.length === 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4 text-sm text-ink-secondary leading-relaxed">
          У OpenDota нет разобранного реплея этой игры (возможно, он уже устарел), поэтому
          разбор по фазам недоступен - ниже только выводы по итоговым цифрам матча.
        </div>
      )}

      <div className={`grid gap-4 ${phases.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]" : ""}`}>
        <section
          className="bg-surface border border-border rounded-2xl p-6"
          style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}
        >
          <Label accent>Итог от ИИ-тренера</Label>
          <p className="font-display font-medium text-lg sm:text-xl text-ink leading-snug">{report.summary}</p>
          {comparison && (
            <p className="text-xs text-ink-muted mt-3">
              Ты сравниваешься только с {comparison.counterpartHero} - вражеским игроком на твоей позиции (
              {comparison.positionLabel}).
            </p>
          )}
        </section>
        {phases.length > 0 && <VerdictStrip phases={phases} counterpart={comparison?.counterpartHero} />}
      </div>

      {report.gameFlow && <GameFlowCard flow={report.gameFlow} />}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <StrengthsColumn strengths={report.strengths} />
        <ImprovementsColumn tips={report.tips} />
      </div>

      {phases.length > 0 && (
        <section>
          <SectionTitle title="Как прошла игра" note="Каждая фаза - что произошло, почему и что делать иначе." />
          <ol className={`grid gap-4 ${phases.length >= 3 ? "lg:grid-cols-3" : phases.length === 2 ? "lg:grid-cols-2" : ""}`}>
            {phases.map((p) => (
              <PhaseCard key={p.id} phase={p} />
            ))}
          </ol>
        </section>
      )}

      {deaths.length > 0 && (
        <section>
          <SectionTitle
            title="Смерти: где, почему и под чьим вардом"
            note="Каждая смерть на карте: место, кто и чем убил, какие варды стояли в эту секунду и чей обзор тебя видел. Выбери смерть на карте или в списке."
          />
          <DeathVisionMap moments={deaths} />
        </section>
      )}

      {comparison && comparison.netWorth.length > 0 && (
        <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
          <SectionTitle title="Нетворс против соперника" />
          <NetWorthDiffChart checkpoints={comparison.netWorth} counterpartHero={comparison.counterpartHero} />
        </section>
      )}

      <div className="flex justify-center pt-2">
        <StatsButton accountId={accountId} matchId={matchId} primary />
      </div>
    </div>
  );
}
