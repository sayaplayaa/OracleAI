"use client";

import { useState } from "react";
import type { HeroGuideReport } from "@/lib/types";
import { FindingList } from "./CoachReport";

function HeroGuideReportView({ report }: { report: HeroGuideReport }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-2">
          AI Hero Guide
        </h2>
        <p className="text-ink leading-relaxed">{report.identity}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FindingList
          title="Laning"
          findings={report.laningTips}
          accent="var(--color-accent)"
        />
        <FindingList
          title="Power spikes"
          findings={report.powerSpikeTips}
          accent="var(--color-status-good)"
        />
        <FindingList
          title="Teamfighting"
          findings={report.teamfightTips}
          accent="var(--color-series-blue)"
        />
        <FindingList
          title="Matchups"
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
      if (!res.ok) throw new Error(data.error ?? "AI hero guide failed");
      setReport(data as HeroGuideReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI hero guide failed");
    } finally {
      setLoading(false);
    }
  }

  if (report) return <HeroGuideReportView report={report} />;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col items-start gap-3">
      <p className="text-sm text-ink-secondary max-w-prose">
        Generate a written guide grounded in this hero&apos;s real ability
        kit and the role/matchup stats above - every tip cites a real
        ability effect or number.
      </p>
      <button
        onClick={run}
        disabled={loading}
        className="bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {loading ? "Writing guide..." : "Generate AI hero guide"}
      </button>
      {error && <p className="text-sm text-status-critical">{error}</p>}
    </div>
  );
}
