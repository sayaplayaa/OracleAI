"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveAccountId, resolveMatchId } from "@/lib/steamId";
import { CoachReport } from "./CoachReport";
import type { CoachReport as CoachReportType } from "@/lib/types";

interface Session {
  accountId: number;
  personaname: string | null;
}

const MATCH_PAGE_PATTERN = /^\/player\/(\d+)\/match\/(\d+)/;

export function FloatingCoachWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const [matchInput, setMatchInput] = useState("");
  const [steamIdInput, setSteamIdInput] = useState("");

  const [report, setReport] = useState<CoachReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const routeMatch = pathname.match(MATCH_PAGE_PATTERN);
  const detectedAccountId = routeMatch ? Number(routeMatch[1]) : null;
  const detectedMatchId = routeMatch ? Number(routeMatch[2]) : null;

  const effectiveAccountId = detectedAccountId ?? session?.accountId ?? resolveAccountId(steamIdInput);
  const effectiveMatchId = detectedMatchId ?? resolveMatchId(matchInput);
  const canAnalyze = Boolean(effectiveAccountId && effectiveMatchId);

  function reset() {
    setReport(null);
    setError(null);
    setMatchInput("");
  }

  function toggleOpen() {
    setOpen((o) => !o);
  }

  async function analyze() {
    if (!effectiveAccountId || !effectiveMatchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: effectiveMatchId, accountId: effectiveAccountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI coach failed");
      setReport(data as CoachReportType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI coach failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[380px] max-w-[calc(100vw-2.5rem)] max-h-[75vh] overflow-y-auto bg-surface border border-border rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">AI Coach</h3>
            <button
              onClick={() => {
                setOpen(false);
              }}
              className="text-ink-muted hover:text-ink text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {!report && (
            <div className="space-y-3">
              <p className="text-sm text-ink-secondary">
                Tell me which match you want broken down, and I&apos;ll point
                out what went wrong and how to fix it.
              </p>

              {detectedMatchId ? (
                <div className="text-xs bg-surface-raised border border-border rounded-md px-3 py-2 text-ink-secondary">
                  Using the match you&apos;re currently viewing (#{detectedMatchId}).
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Match ID or link
                  </label>
                  <input
                    value={matchInput}
                    onChange={(e) => setMatchInput(e.target.value)}
                    placeholder="e.g. 8993830855"
                    className="w-full bg-page border border-border rounded-md px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}

              {!detectedAccountId && session === null && (
                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Your Steam ID or profile link
                  </label>
                  <input
                    value={steamIdInput}
                    onChange={(e) => setSteamIdInput(e.target.value)}
                    placeholder="Steam64 ID or profile URL"
                    className="w-full bg-page border border-border rounded-md px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}

              <button
                onClick={analyze}
                disabled={!canAnalyze || loading}
                className="w-full bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-page text-sm font-medium px-4 py-2 rounded-md transition"
              >
                {loading ? "Analyzing..." : "Analyze this match"}
              </button>

              {error && <p className="text-sm text-status-critical">{error}</p>}
            </div>
          )}

          {report && (
            <div className="space-y-3">
              <CoachReport report={report} />
              <button
                onClick={reset}
                className="text-xs text-accent hover:underline"
              >
                Analyze another match
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={toggleOpen}
        className="w-14 h-14 rounded-full bg-accent hover:brightness-110 text-page shadow-lg flex items-center justify-center text-xl font-bold transition"
        aria-label="AI Coach"
      >
        {open ? "×" : "AI"}
      </button>
    </div>
  );
}
