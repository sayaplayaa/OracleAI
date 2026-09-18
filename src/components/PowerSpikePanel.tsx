"use client";

import { useState } from "react";
import type { PowerSpikeReport } from "@/lib/types";

function PowerSpikeReportView({ report }: { report: PowerSpikeReport }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary mb-2">
          Power Spikes
        </h2>
        <p className="text-ink leading-relaxed">{report.summary}</p>
      </div>

      <ol className="space-y-4">
        {report.moments.map((m, i) => (
          <li key={i} className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="w-5 h-5 rounded-full bg-accent text-page text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-ink">{m.trigger}</span>
              <span className="text-xs font-mono text-ink-muted bg-surface-raised px-1.5 py-0.5 rounded">
                {m.timing}
              </span>
            </div>
            <div className="space-y-1.5 pl-7">
              <p className="text-sm text-ink">{m.why.point}</p>
              <p className="text-xs text-ink-muted font-mono">{m.why.metric}</p>
              <p className="text-sm text-accent">{m.whatToDo.point}</p>
              <p className="text-xs text-ink-muted font-mono">{m.whatToDo.metric}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PowerSpikePanel({ matchId, accountId }: { matchId: number; accountId: number }) {
  const [report, setReport] = useState<PowerSpikeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/power-spike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Power Spike analysis failed");
      setReport(data as PowerSpikeReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Power Spike analysis failed");
    } finally {
      setLoading(false);
    }
  }

  if (report) return <PowerSpikeReportView report={report} />;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col items-start gap-3">
      <p className="text-sm text-ink-secondary max-w-prose">
        Find this player&apos;s real power-spike moments in this match -
        which item/level gave them an edge, why, and what to do with it.
      </p>
      <button
        onClick={run}
        disabled={loading}
        className="bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {loading ? "Analyzing..." : "Find power spikes"}
      </button>
      {error && <p className="text-sm text-status-critical">{error}</p>}
    </div>
  );
}
