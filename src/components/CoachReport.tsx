import type { CoachFinding, CoachReport as CoachReportType } from "@/lib/types";

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
      <ul className="space-y-3">
        {findings.map((f, i) => (
          <li key={i} className="border-l-2 pl-3" style={{ borderColor: accent }}>
            <p className="text-sm text-ink">{f.point}</p>
            <p className="text-xs text-ink-muted mt-0.5 font-mono">{f.metric}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoachReport({ report }: { report: CoachReportType }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-2">
          AI Coach Summary
        </h2>
        <p className="text-ink leading-relaxed">{report.summary}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <FindingList
          title="Strengths"
          findings={report.strengths}
          accent="var(--color-status-good)"
        />
        <FindingList
          title="Weaknesses"
          findings={report.weaknesses}
          accent="var(--color-status-critical)"
        />
        <FindingList
          title="Tips"
          findings={report.tips}
          accent="var(--color-accent)"
        />
      </div>
    </div>
  );
}
