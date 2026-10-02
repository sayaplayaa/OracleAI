import type {
  CoachComparison,
  CoachFinding,
  CoachPhaseReport,
  CoachReport as CoachReportType,
  PhaseId,
  PhaseVerdict,
  PositionSource,
} from "@/lib/types";
import { formatSigned } from "@/lib/format";
import { DeathVisionMap } from "./DeathVisionMap";

export function FindingList({
  title,
  findings,
  accent,
  boxed = false,
}: {
  title: string;
  findings: CoachFinding[];
  accent: string;
  /** Render as a standalone card (with the colored top edge) instead of a bare list. */
  boxed?: boolean;
}) {
  if (findings.length === 0) return null;
  const body = (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {title}
        </h3>
        <span className="ml-auto font-mono text-xs text-ink-muted">{findings.length}</span>
      </div>
      <ul className="space-y-2">
        {findings.map((f, i) => (
          <li
            key={i}
            className="rounded-xl bg-page/50 border border-border px-3.5 py-3"
            style={{ boxShadow: `inset 2px 0 0 0 ${accent}` }}
          >
            <p className="text-sm text-ink leading-relaxed">{f.point}</p>
            <p className="text-xs text-ink-muted mt-1 font-mono leading-relaxed">{f.metric}</p>
          </li>
        ))}
      </ul>
    </>
  );
  if (!boxed) return <div>{body}</div>;
  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5"
      style={{ boxShadow: `inset 0 3px 0 0 ${accent}` }}
    >
      {body}
    </section>
  );
}

function Label({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${accent ? "text-accent" : "text-ink-muted"}`}>
      {children}
    </p>
  );
}

function KeyMomentsTimeline({ report }: { report: CoachReportType }) {
  if (!report.keyMoments || report.keyMoments.length === 0) return null;
  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <Label accent>Ход матча</Label>
      <ol className="mt-3 space-y-3 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border">
        {report.keyMoments.map((m, i) => (
          <li key={i} className="relative flex gap-3">
            <span className="relative z-10 w-5 h-5 rounded-full bg-accent text-page text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0 space-y-1">
              <span className="text-xs font-mono text-ink-muted bg-page px-1.5 py-0.5 rounded">{m.time}</span>
              <p className="text-sm text-ink leading-relaxed">{m.whatHappened}</p>
              <p className="text-sm text-accent leading-relaxed">→ {m.whatToDoDifferently}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const PHASE_TITLES: Record<PhaseId, string> = {
  laning: "Линия",
  midGame: "Мидгейм",
  lateGame: "Лейтгейм",
};

const VERDICT_STYLE: Record<PhaseVerdict, { label: string; color: string; icon: string }> = {
  won: { label: "Выиграл", color: "var(--color-status-good)", icon: "▲" },
  even: { label: "Наравне", color: "var(--color-highlight-text)", icon: "■" },
  lost: { label: "Проиграл", color: "var(--color-status-critical)", icon: "▼" },
};

const POSITION_SOURCE_LABEL: Record<PositionSource, string> = {
  stratz: "позиция подтверждена STRATZ",
  opendota: "позиция по оценке OpenDota",
  "lane-estimate": "позиция определена по линии и фарму",
};

function PhaseCard({ phase }: { phase: CoachPhaseReport }) {
  const verdict = phase.verdict ? VERDICT_STYLE[phase.verdict] : null;
  const evidenceCount = phase.catalysts.length + phase.evidence.length;
  return (
    <li
      className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: `inset 0 3px 0 0 ${verdict?.color ?? "var(--color-border)"}` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-display font-bold text-ink">{PHASE_TITLES[phase.id] ?? phase.label}</h4>
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

function ComparisonTable({ comparison }: { comparison: CoachComparison }) {
  if (comparison.netWorth.length === 0) return null;
  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <Label accent>Нетворс: ты и {comparison.counterpartHero}</Label>
      <p className="text-xs text-ink-muted mb-3">
        Вражеский игрок на твоей позиции ({comparison.positionLabel}) - сравнение только с ним (
        {POSITION_SOURCE_LABEL[comparison.positionSource]}).
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="text-xs font-mono w-full min-w-max tabular-nums">
          <thead>
            <tr className="text-ink-muted bg-page/50">
              <th className="text-left font-normal px-3 py-2"></th>
              {comparison.netWorth.map((c) => (
                <th key={c.minute} className="text-right font-normal px-3 py-2">
                  {c.minute}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="text-ink">
              <td className="px-3 py-2 text-ink-secondary font-sans">Ты</td>
              {comparison.netWorth.map((c) => (
                <td key={c.minute} className="text-right px-3 py-2">
                  {c.you.toLocaleString("ru-RU")}
                </td>
              ))}
            </tr>
            <tr className="text-ink">
              <td className="px-3 py-2 text-ink-secondary font-sans">{comparison.counterpartHero}</td>
              {comparison.netWorth.map((c) => (
                <td key={c.minute} className="text-right px-3 py-2">
                  {c.counterpart.toLocaleString("ru-RU")}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 text-ink-secondary font-sans">Разница</td>
              {comparison.netWorth.map((c) => (
                <td
                  key={c.minute}
                  className="text-right px-3 py-2 font-semibold"
                  style={{ color: c.diff >= 0 ? "var(--color-status-good)" : "var(--color-status-critical)" }}
                >
                  {formatSigned(c.diff)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * A coach report in the same visual language as the match analysis. It sits
 * in wide page columns and in the narrow floating widget alike, so the grid
 * follows the container width, not the viewport.
 */
export function CoachReport({ report }: { report: CoachReportType }) {
  const lists = [
    { title: "Сильные стороны", findings: report.strengths, accent: "var(--color-status-good)" },
    { title: "Слабые стороны", findings: report.weaknesses, accent: "var(--color-status-critical)" },
    {
      title: report.phases ? "Что исправить в следующей игре" : "Советы",
      findings: report.tips,
      accent: "var(--color-accent)",
    },
  ].filter((l) => l.findings.length > 0);
  const phases = report.phases ?? [];

  return (
    <div className="@container space-y-4 rise-in">
      <section
        className="bg-surface border border-border rounded-2xl p-5"
        style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}
      >
        <Label accent>Итог от ИИ-тренера</Label>
        <p className="font-display font-medium text-base @xl:text-lg text-ink leading-snug">{report.summary}</p>
      </section>

      {lists.length > 0 && (
        <div className={`grid gap-4 items-start ${lists.length >= 2 ? "@2xl:grid-cols-2" : ""} ${lists.length >= 3 ? "@5xl:grid-cols-3" : ""}`}>
          {lists.map((l) => (
            <FindingList key={l.title} title={l.title} findings={l.findings} accent={l.accent} boxed />
          ))}
        </div>
      )}

      {phases.length > 0 && (
        <ol className={`grid gap-4 ${phases.length >= 3 ? "@4xl:grid-cols-3" : phases.length === 2 ? "@2xl:grid-cols-2" : ""}`}>
          {phases.map((p) => (
            <PhaseCard key={p.id} phase={p} />
          ))}
        </ol>
      )}

      <KeyMomentsTimeline report={report} />

      {report.deathVision && report.deathVision.length > 0 && <DeathVisionMap moments={report.deathVision} />}

      {report.comparison && <ComparisonTable comparison={report.comparison} />}
    </div>
  );
}
