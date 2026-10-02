"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { primaryButton } from "./buttonStyles";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 20;

type State = "idle" | "requesting" | "waiting" | "timeout" | "error";

// Outside the component: stamping the start time only ever happens on click.
function now(): number {
  return Date.now();
}

export function ParseMatchButton({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const elapsed = useElapsedSeconds(startedAt);
  const busy = state === "requesting" || state === "waiting";

  async function start() {
    setState("requesting");
    setStartedAt(now());
    try {
      const res = await fetch(`/api/match/${matchId}/parse`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось запросить разбор");
      setState("waiting");
      poll(data.jobId, 0);
    } catch {
      setState("error");
      setStartedAt(null);
    }
  }

  function poll(jobId: number, attempt: number) {
    if (attempt >= MAX_ATTEMPTS) {
      setState("timeout");
      setStartedAt(null);
      return;
    }
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/parse-status/${jobId}`);
        const data = await res.json();
        if (data.done) {
          router.refresh();
          setState("idle");
          setStartedAt(null);
        } else {
          poll(jobId, attempt + 1);
        }
      } catch {
        setState("error");
        setStartedAt(null);
      }
    }, POLL_INTERVAL_MS);
  }

  // OpenDota usually needs 30-90 s; the bar follows that guess and never claims to be done.
  const progress = Math.min(95, Math.round((elapsed / 90) * 100));

  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6"
      style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}
      aria-live="polite"
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h3 className="font-display font-bold text-ink">Реплей ещё не разобран</h3>
          <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed max-w-2xl">
            Без разбора нет графиков по минутам, вардов, перемещений и темпа фарма - только итоговая таблица.
            Запроси разбор у OpenDota: обычно это 30-90 секунд, страница обновится сама.
          </p>
        </div>
        <button type="button" onClick={start} disabled={busy} className={primaryButton}>
          {busy && <span className="w-4 h-4 rounded-full border-2 border-page border-t-transparent animate-spin" aria-hidden />}
          {state === "waiting" ? "Разбираем реплей…" : state === "requesting" ? "Отправляем запрос…" : "Запросить полный разбор"}
        </button>
      </div>
      {busy && (
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-page overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-ink-muted mt-1.5 font-mono tabular-nums">Прошло {elapsed} с</p>
        </div>
      )}
      {state === "timeout" && (
        <p className="mt-3 text-sm text-highlight-text">OpenDota всё ещё обрабатывает реплей - обнови страницу через минуту.</p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-status-critical">
          Сейчас не получилось запросить разбор. Попробуй чуть позже.
        </p>
      )}
    </section>
  );
}
