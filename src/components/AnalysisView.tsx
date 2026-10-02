"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getAnalysisSnapshot,
  getServerAnalysisSnapshot,
  startAnalysis,
  subscribeAnalysis,
} from "@/lib/analysisStore";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { SimpleReport } from "./SimpleReport";

// The server request is one slow call with no real progress signal, so these
// steps follow the elapsed time as an honest guess at what it's doing.
const STEPS = [
  { from: 0, text: "Загружаю данные матча" },
  { from: 6, text: "Проверяю, разобран ли реплей (до минуты)" },
  { from: 25, text: "Сравниваю с врагом на твоей позиции и ищу места смертей" },
  { from: 45, text: "ИИ-тренер пишет разбор (работает на твоём компьютере)" },
];

function LoadingCard({ startedAt }: { startedAt: number | null }) {
  const elapsed = useElapsedSeconds(startedAt);
  const current = STEPS.reduce((acc, step, i) => (elapsed >= step.from ? i : acc), 0);
  // An honest-looking bar: it follows the step guesses and never claims to be done.
  const progress = Math.min(95, Math.round((elapsed / 180) * 100));

  return (
    <div className="space-y-6" aria-live="polite">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-lg text-ink">Разбираю твою игру…</h2>
            <p className="text-sm text-ink-muted mt-1">
              Обычно это 1-3 минуты, на слабой видеокарте - до 5. Страницу можно не закрывать.
            </p>
          </div>
          <p className="text-xs text-ink-muted font-mono tabular-nums">Прошло {elapsed} с</p>
        </div>

        <div className="mt-5 h-1.5 rounded-full bg-page overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        <ol className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li
                key={step.text}
                className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
                  active ? "border-accent/60 bg-surface-raised" : "border-border bg-page/40"
                }`}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center mt-0.5">
                  {done ? (
                    <span className="text-accent font-bold">✓</span>
                  ) : active ? (
                    <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-border" />
                  )}
                </span>
                <span className={active ? "text-ink" : done ? "text-ink-secondary" : "text-ink-muted"}>{step.text}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid lg:grid-cols-2 gap-4" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-6 space-y-3 animate-pulse">
            <div className="h-5 w-48 rounded bg-surface-raised" />
            <div className="h-16 rounded-xl bg-page/60" />
            <div className="h-16 rounded-xl bg-page/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisView({ accountId, matchId }: { accountId: number; matchId: number }) {
  const state = useSyncExternalStore(
    subscribeAnalysis,
    () => getAnalysisSnapshot(accountId, matchId),
    getServerAnalysisSnapshot
  );

  useEffect(() => {
    startAnalysis(accountId, matchId);
  }, [accountId, matchId]);

  if (state.status === "done") {
    return (
      <div className="space-y-4">
        <SimpleReport report={state.report} accountId={accountId} matchId={matchId} />
        <div className="text-center">
          <button
            onClick={() => startAnalysis(accountId, matchId, { force: true })}
            className="text-xs text-ink-muted hover:text-ink underline-offset-4 hover:underline transition"
          >
            Составить разбор заново
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4" role="alert">
        <div>
          <h2 className="font-display font-bold text-lg text-status-critical">{state.title}</h2>
          <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{state.hint}</p>
        </div>
        <button
          onClick={() => startAnalysis(accountId, matchId, { force: true })}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-page hover:brightness-110 transition"
        >
          Повторить
        </button>
        <details>
          <summary className="text-xs text-ink-muted cursor-pointer select-none">
            Технические подробности
          </summary>
          <p className="text-xs text-ink-muted font-mono mt-2 break-words">{state.details}</p>
        </details>
      </div>
    );
  }

  return <LoadingCard startedAt={state.status === "loading" ? state.startedAt : null} />;
}
