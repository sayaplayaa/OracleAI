"use client";

import { useState } from "react";
import type { HeroGuideReport } from "@/lib/types";
import { FindingList } from "./CoachReport";

function HeroGuideReportView({ report }: { report: HeroGuideReport }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-2">
          ИИ-гайд по герою
        </h2>
        <p className="text-ink leading-relaxed">{report.identity}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FindingList
          title="Линия"
          findings={report.laningTips}
          accent="var(--color-accent)"
        />
        <FindingList
          title="Пики силы"
          findings={report.powerSpikeTips}
          accent="var(--color-status-good)"
        />
        <FindingList
          title="Командные драки"
          findings={report.teamfightTips}
          accent="var(--color-series-blue)"
        />
        <FindingList
          title="Матчапы"
          findings={report.matchupTips}
          accent="var(--color-status-critical)"
        />
      </div>
    </div>
  );
}

export function HeroGuidePanel({ heroId }: { heroId: number }) {
  const [report, setReport] = useState<HeroGuideReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/hero-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось создать ИИ-гайд");
      setReport(data as HeroGuideReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать ИИ-гайд");
    } finally {
      setLoading(false);
    }
  }

  if (report) return <HeroGuideReportView report={report} />;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col items-start gap-3">
      <p className="text-sm text-ink-secondary max-w-prose">
        ИИ напишет гайд на основе реальных способностей героя и статистики
        по ролям и матчапам выше - каждый совет опирается на настоящий
        эффект способности или цифру.
      </p>
      <button
        onClick={run}
        disabled={loading}
        className="bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {loading ? "Пишу гайд..." : "Создать ИИ-гайд по герою"}
      </button>
      {error && <p className="text-sm text-status-critical">{error}</p>}
    </div>
  );
}
