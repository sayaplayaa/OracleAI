"use client";

import type { PowerSpikeReport } from "@/lib/types";
import { AiActionCard, useCoachRequest } from "./AiActionCard";

function PowerSpikeReportView({ report }: { report: PowerSpikeReport }) {
  return (
    <div
      className="bg-surface border border-border rounded-2xl p-5 space-y-4 rise-in"
      style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-1.5">Пики силы</p>
        <p className="text-ink leading-relaxed">{report.summary}</p>
      </div>

      <ol className="space-y-3">
        {report.moments.map((m, i) => (
          <li key={i} className="rounded-xl bg-page/50 border border-border p-3.5">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="w-5 h-5 rounded-full bg-accent text-page text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-ink">{m.trigger}</span>
              <span className="text-xs font-mono text-ink-muted bg-page px-1.5 py-0.5 rounded">{m.timing}</span>
            </div>
            <div className="space-y-2 pl-7">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-0.5">Почему</p>
                <p className="text-sm text-ink leading-relaxed">{m.why.point}</p>
                <p className="text-xs text-ink-muted font-mono mt-0.5">{m.why.metric}</p>
              </div>
              <div className="rounded-lg bg-accent/8 border border-accent/20 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-0.5">Как использовать</p>
                <p className="text-sm text-ink leading-relaxed">{m.whatToDo.point}</p>
                <p className="text-xs text-ink-muted font-mono mt-0.5">{m.whatToDo.metric}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PowerSpikePanel({ matchId, accountId }: { matchId: number; accountId: number }) {
  const request = useCoachRequest<PowerSpikeReport>("/api/coach/power-spike", "Не удалось найти пики силы");

  if (request.data) return <PowerSpikeReportView report={request.data} />;

  return (
    <AiActionCard
      title="Пики силы в этом матче"
      description="Какой предмет или уровень дал игроку преимущество, почему и как этим пользоваться."
      actionLabel="Найти пики силы"
      startedAt={request.startedAt}
      error={request.error}
      onRun={() => request.run({ matchId, accountId })}
    />
  );
}
