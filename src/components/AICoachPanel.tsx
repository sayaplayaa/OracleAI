"use client";

import { useState } from "react";
import type { CoachReport as CoachReportType } from "@/lib/types";
import { CoachReport } from "./CoachReport";

export function AICoachPanel({
  endpoint,
  body,
  label = "Получить разбор от AI-коуча",
}: {
  endpoint: string;
  body: Record<string, unknown>;
  label?: string;
}) {
  const [report, setReport] = useState<CoachReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI-коуч не смог сделать разбор");
      setReport(data as CoachReportType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI-коуч не смог сделать разбор");
    } finally {
      setLoading(false);
    }
  }

  if (report) return <CoachReport report={report} />;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col items-start gap-3">
      <p className="text-sm text-ink-secondary max-w-prose">
        Разбор от AI-коуча по точным цифрам выше: сильные и слабые стороны и
        конкретные советы, у каждого - цифра, на которой он основан.
      </p>
      <button
        onClick={run}
        disabled={loading}
        className="bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {loading ? "Анализирую..." : label}
      </button>
      {error && <p className="text-sm text-status-critical">{error}</p>}
    </div>
  );
}
