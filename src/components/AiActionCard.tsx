"use client";

import { useState } from "react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { primaryButton } from "./buttonStyles";

/**
 * One POST to a coach endpoint with honest loading/error state. The model runs
 * locally and gives no progress signal, so only elapsed time is shown.
 */
export function useCoachRequest<T>(endpoint: string, fallbackError: string) {
  const [data, setData] = useState<T | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(body: unknown) {
    setStartedAt(Date.now());
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? fallbackError);
      setData(json as T);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setStartedAt(null);
    }
  }

  return { data, startedAt, loading: startedAt !== null, error, run };
}

function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** The "ask the AI coach" card: what it will do, one button, then elapsed time while it works. */
export function AiActionCard({
  title,
  description,
  actionLabel,
  loadingLabel = "Анализирую…",
  startedAt,
  error,
  onRun,
}: {
  title: string;
  description: string;
  actionLabel: string;
  loadingLabel?: string;
  startedAt: number | null;
  error: string | null;
  onRun: () => void;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  const loading = startedAt !== null;

  return (
    <div
      className="bg-surface border border-border rounded-2xl p-5"
      style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-accent/12 text-accent flex items-center justify-center shrink-0">
          <SparkIcon />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">ИИ-тренер</p>
          <h3 className="font-display font-bold text-ink mt-0.5 leading-snug">{title}</h3>
          <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 flex-wrap" aria-live="polite">
        <button type="button" onClick={onRun} disabled={loading} className={primaryButton}>
          {loading && <span className="w-4 h-4 rounded-full border-2 border-page border-t-transparent animate-spin" aria-hidden />}
          {loading ? loadingLabel : error ? "Попробовать ещё раз" : actionLabel}
        </button>
        {loading && (
          <span className="text-xs text-ink-muted">
            <span className="font-mono tabular-nums">{elapsed} с</span> ·{" "}
            {elapsed < 60
              ? "модель работает на твоём компьютере"
              : "на слабой видеокарте это занимает 3-5 минут - страницу можно не закрывать"}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-status-critical leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
