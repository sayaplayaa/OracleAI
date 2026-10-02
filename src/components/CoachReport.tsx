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
}: {
  title: string;
  findings: CoachFinding[];
  accent: string;
}) {
  if (findings.length === 0) return null;
  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: accent }}
      >
        {title}
      </h3>
      <ul className="space-y-2">
        {findings.map((f, i) => (
          <li
            key={i}
            className="bg-surface-raised border-l-2 rounded-r-md px-3 py-2"
            style={{ borderColor: accent }}
          >
            <p className="text-sm text-ink leading-snug">{f.point}</p>
            <p className="text-xs text-ink-muted mt-1 font-mono">{f.metric}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyMomentsTimeline({ report }: { report: CoachReportType }) {
  if (!report.keyMoments || report.keyMoments.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-accent">
        Ход матча
      </h3>
      <ol className="space-y-3">
        {report.keyMoments.map((m, i) => (
          <li key={i} className="border border-border rounded-lg p-3 bg-surface-raised">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-accent text-page text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-xs font-mono text-ink-muted bg-page px-1.5 py-0.5 rounded">
                {m.time}
              </span>
            </div>
            <div className="pl-7 space-y-1">
              <p className="text-sm text-ink leading-snug">{m.whatHappened}</p>
              <p className="text-sm text-accent leading-snug">→ {m.whatToDoDifferently}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const PHASE_TITLES: Record<PhaseId, string> = {
  laning: "Линия",
  midGame: "Мидгейм",
  lateGame: "Лейтгейм",
};

const VERDICT_STYLE: Record<PhaseVerdict, { label: string; color: string }> = {
  won: { label: "Выиграл у оппонента", color: "var(--color-status-good)" },
  even: { label: "Наравне с оппонентом", color: "var(--color-highlight-text)" },
  lost: { label: "Проиграл оппоненту", color: "var(--color-status-critical)" },
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
    <li className="border border-border rounded-lg p-4 bg-surface-raised space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-ink">{PHASE_TITLES[phase.id] ?? phase.label}</h4>
        <span className="text-xs font-mono text-ink-muted bg-page px-1.5 py-0.5 rounded">
          {phase.window}
        </span>
        {verdict && (
          <span
            className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
            style={{ color: verdict.color, borderColor: verdict.color }}
          >
            {verdict.label}
          </span>
        )}
      </div>

      <p className="text-sm text-ink leading-relaxed">{phase.whatWentWrong}</p>

      {phase.decision && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-0.5">
            Почему так вышло
          </p>
          <p className="text-sm text-ink-secondary leading-relaxed">{phase.decision}</p>
        </div>
      )}

      {phase.doInstead && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-0.5">
            Что делать иначе
          </p>
          <p className="text-sm text-accent leading-relaxed">{phase.doInstead}</p>
        </div>
      )}

      {evidenceCount > 0 && (
        <details>
          <summary className="text-xs text-ink-muted cursor-pointer select-none hover:text-ink-secondary">
            Цифры из реплея ({evidenceCount})
          </summary>
          <div className="mt-2 space-y-2">
            {phase.catalysts.length > 0 && (
              <ul className="space-y-1">
                {phase.catalysts.map((c, i) => (
                  <li key={i} className="text-xs text-highlight-text leading-snug">
                    {i + 1}. {c}
                  </li>
                ))}
              </ul>
            )}
            <ul className="space-y-1">
              {phase.evidence.map((e, i) => (
                <li key={i} className="text-xs text-ink-muted font-mono leading-snug">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </li>
  );
}

function PhasesSection({ phases }: { phases: CoachPhaseReport[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-accent">
        Фазы игры
      </h3>
      <ol className="space-y-3">
        {phases.map((p) => (
          <PhaseCard key={p.id} phase={p} />
        ))}
      </ol>
    </div>
  );
}

function ComparisonTable({ comparison }: { comparison: CoachComparison }) {
  if (comparison.netWorth.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-accent">
        Нетворс: ты и {comparison.counterpartHero}
      </h3>
      <p className="text-xs text-ink-muted mb-2">
        Вражеский игрок на твоей позиции ({comparison.positionLabel}) - сравнение только с ним (
        {POSITION_SOURCE_LABEL[comparison.positionSource]}).
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs font-mono w-full min-w-max">
          <thead>
            <tr className="text-ink-muted">
              <th className="text-left font-normal pr-3 py-1"></th>
              {comparison.netWorth.map((c) => (
                <th key={c.minute} className="text-right font-normal px-2 py-1">
                  {c.minute}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="text-ink">
              <td className="pr-3 py-1 text-ink-secondary">Ты</td>
              {comparison.netWorth.map((c) => (
                <td key={c.minute} className="text-right px-2 py-1">
                  {c.you.toLocaleString("ru-RU")}
                </td>
              ))}
            </tr>
            <tr className="text-ink">
              <td className="pr-3 py-1 text-ink-secondary">Он</td>
              {comparison.netWorth.map((c) => (
                <td key={c.minute} className="text-right px-2 py-1">
                  {c.counterpart.toLocaleString("ru-RU")}
                </td>
              ))}
            </tr>
            <tr>
              <td className="pr-3 py-1 text-ink-secondary">Разница</td>
              {comparison.netWorth.map((c) => (
                <td
                  key={c.minute}
                  className="text-right px-2 py-1"
                  style={{
                    color: c.diff >= 0 ? "var(--color-status-good)" : "var(--color-status-critical)",
                  }}
                >
                  {formatSigned(c.diff)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const GRID_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

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

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-2">
          Итог от AI-коуча
        </h2>
        <p className="text-ink leading-relaxed">{report.summary}</p>
      </div>

      {report.comparison && <ComparisonTable comparison={report.comparison} />}

      {report.phases && report.phases.length > 0 && <PhasesSection phases={report.phases} />}

      <KeyMomentsTimeline report={report} />

      {report.deathVision && report.deathVision.length > 0 && (
        <DeathVisionMap moments={report.deathVision} />
      )}

      {lists.length > 0 && (
        <div className={`grid gap-5 ${GRID_COLUMNS[lists.length] ?? "sm:grid-cols-3"}`}>
          {lists.map((l) => (
            <FindingList key={l.title} title={l.title} findings={l.findings} accent={l.accent} />
          ))}
        </div>
      )}
    </div>
  );
}
