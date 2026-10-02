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

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        fill="currentColor"
      />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="currentColor" />
    </svg>
  );
}

function CoachReportSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-2.5 w-28 bg-surface-raised rounded" />
        <div className="h-3 w-full bg-surface-raised rounded" />
        <div className="h-3 w-5/6 bg-surface-raised rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-32 bg-surface-raised rounded" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 bg-surface-raised rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-16 bg-surface-raised rounded" />
            <div className="h-10 bg-surface-raised rounded-lg" />
            <div className="h-10 bg-surface-raised rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FloatingCoachWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const [matchInput, setMatchInput] = useState("");
  const [steamIdInput, setSteamIdInput] = useState("");

  const [report, setReport] = useState<CoachReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("Проверяю данные реплея…");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  // The server request can quietly include a 4-80s replay-parse wait before
  // it even starts generating - these phases are a guess at elapsed time,
  // not a real progress signal, but they're honest about why this can take
  // a while instead of leaving a static "loading" label up the whole time.
  useEffect(() => {
    if (!loading) return;
    const timers = [
      setTimeout(
        () =>
          setLoadingLabel(
            "Реплей ещё не разобран - запрашиваю разбор у OpenDota (может занять до минуты)…"
          ),
        4000
      ),
      setTimeout(() => setLoadingLabel("Изучаю ход матча…"), 85000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [loading]);

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
    if (open) reset();
  }

  const expanded = loading || Boolean(report);

  async function analyze() {
    if (!effectiveAccountId || !effectiveMatchId) return;
    setLoading(true);
    setError(null);
    setLoadingLabel("Проверяю данные реплея…");
    try {
      const res = await fetch("/api/coach/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: effectiveMatchId, accountId: effectiveAccountId }),
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

  // The beginner flow analyzes the game on its own page, so the floating
  // button would only duplicate it there.
  if (pathname === "/" || pathname.startsWith("/analysis")) return null;

  return (
    <>
      {open && expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        />
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
        {open && (
          <div
            className={`relative flex flex-col overflow-hidden bg-surface border border-border rounded-2xl shadow-2xl transition-[width,height] duration-300 ease-out ${
              expanded
                ? "w-[min(94vw,720px)] h-[min(85vh,760px)]"
                : "w-[380px] max-w-[calc(100vw-2.5rem)] h-auto"
            }`}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                  <SparkleIcon />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink leading-none">AI-коуч</h3>
                  <p className="text-[11px] text-ink-muted mt-1">
                    {loading ? loadingLabel : report ? "Полный разбор" : "Работает локально через Ollama (qwen3:8b)"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-ink-muted hover:text-ink text-lg leading-none px-1"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 grow">
              {!expanded && (
                <div className="space-y-3">
                  <p className="text-sm text-ink-secondary">
                    Скажи, какую игру разобрать. Я пройду по реальному ходу
                    матча - смерти, тимфайты, тайминги предметов - и подскажу,
                    что делать иначе.
                  </p>

                  {detectedMatchId ? (
                    <div className="text-xs bg-surface-raised border border-border rounded-md px-3 py-2 text-ink-secondary">
                      Разбираю матч, который ты сейчас смотришь (#{detectedMatchId}).
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-ink-muted mb-1">
                        ID матча или ссылка
                      </label>
                      <input
                        value={matchInput}
                        onChange={(e) => setMatchInput(e.target.value)}
                        placeholder="например, 8993830855"
                        className="w-full bg-page border border-border rounded-md px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  )}

                  {!detectedAccountId && session === null && (
                    <div>
                      <label className="block text-xs text-ink-muted mb-1">
                        Твой Steam ID или ссылка на профиль
                      </label>
                      <input
                        value={steamIdInput}
                        onChange={(e) => setSteamIdInput(e.target.value)}
                        placeholder="Steam64 ID или ссылка на профиль"
                        className="w-full bg-page border border-border rounded-md px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  )}

                  <button
                    onClick={analyze}
                    disabled={!canAnalyze || loading}
                    className="w-full bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-page text-sm font-medium px-4 py-2 rounded-md transition"
                  >
                    Разобрать матч
                  </button>

                  {error && <p className="text-sm text-status-critical">{error}</p>}
                </div>
              )}

              {loading && <CoachReportSkeleton />}

              {report && !loading && (
                <div className="space-y-3">
                  <CoachReport report={report} />
                  <button onClick={reset} className="text-xs text-accent hover:underline">
                    Разобрать другой матч
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={toggleOpen}
          className="w-14 h-14 rounded-full bg-accent hover:brightness-110 text-page shadow-lg flex items-center justify-center transition shrink-0"
          aria-label="AI-коуч"
        >
          {open ? (
            <span className="text-xl font-bold leading-none">×</span>
          ) : (
            <SparkleIcon />
          )}
        </button>
      </div>
    </>
  );
}
