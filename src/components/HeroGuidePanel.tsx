"use client";

import type { HeroGuideReport } from "@/lib/types";
import { AiActionCard, useCoachRequest } from "./AiActionCard";
import { FindingList } from "./CoachReport";

function HeroGuideReportView({ report }: { report: HeroGuideReport }) {
  return (
    <div className="space-y-4 rise-in">
      <section
        className="bg-surface border border-border rounded-2xl p-6"
        style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-1.5">ИИ-гайд по герою</p>
        <p className="font-display font-medium text-lg text-ink leading-snug">{report.identity}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <FindingList title="Линия" findings={report.laningTips} accent="var(--color-accent)" boxed />
        <FindingList title="Пики силы" findings={report.powerSpikeTips} accent="var(--color-status-good)" boxed />
        <FindingList title="Командные драки" findings={report.teamfightTips} accent="var(--color-series-blue)" boxed />
        <FindingList title="Матчапы" findings={report.matchupTips} accent="var(--color-status-critical)" boxed />
      </div>
    </div>
  );
}

export function HeroGuidePanel({ heroId, heroName }: { heroId: number; heroName: string }) {
  const request = useCoachRequest<HeroGuideReport>("/api/coach/hero-guide", "Не удалось создать ИИ-гайд");

  if (request.data) return <HeroGuideReportView report={request.data} />;

  return (
    <AiActionCard
      title={`Гайд по ${heroName}`}
      description="ИИ напишет гайд на основе реальных способностей героя и статистики по ролям и матчапам: линия, пики силы, драки и сложные противники. Каждый совет опирается на настоящий эффект способности или цифру."
      actionLabel="Создать ИИ-гайд"
      loadingLabel="Пишу гайд…"
      startedAt={request.startedAt}
      error={request.error}
      onRun={() => request.run({ heroId })}
    />
  );
}
