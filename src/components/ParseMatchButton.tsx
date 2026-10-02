"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 20;

type State = "idle" | "requesting" | "waiting" | "timeout" | "error";

export function ParseMatchButton({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function start() {
    setState("requesting");
    try {
      const res = await fetch(`/api/match/${matchId}/parse`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось запросить разбор");

      setState("waiting");
      poll(data.jobId, 0);
    } catch {
      setState("error");
    }
  }

  function poll(jobId: number, attempt: number) {
    if (attempt >= MAX_ATTEMPTS) {
      setState("timeout");
      return;
    }
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/parse-status/${jobId}`);
        const data = await res.json();
        if (data.done) {
          router.refresh();
          setState("idle");
        } else {
          poll(jobId, attempt + 1);
        }
      } catch {
        setState("error");
      }
    }, POLL_INTERVAL_MS);
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col items-start gap-3">
      <p className="text-sm text-ink-secondary max-w-prose">
        OpenDota ещё не разобрал реплей этой игры, поэтому графики нетворса,
        варды, перемещения и темп фарма недоступны - есть только базовая
        таблица. Запроси полный разбор, чтобы их открыть (обычно занимает
        30-90 секунд).
      </p>
      <button
        onClick={start}
        disabled={state === "requesting" || state === "waiting"}
        className="bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {state === "waiting"
          ? "Разбираем реплей..."
          : state === "requesting"
            ? "Отправляем запрос..."
            : "Запросить полный разбор"}
      </button>
      {state === "timeout" && (
        <p className="text-sm text-status-critical">
          OpenDota всё ещё обрабатывает реплей - обнови страницу через
          минуту.
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-status-critical">
          Сейчас не получилось запросить разбор. Попробуй чуть позже.
        </p>
      )}
    </div>
  );
}
