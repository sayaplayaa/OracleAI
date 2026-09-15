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
      if (!res.ok) throw new Error(data.error ?? "Failed to request parse");

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
        This match hasn&apos;t been fully analyzed by OpenDota yet, so net
        worth graphs, wards, movement, and farm timelines aren&apos;t
        available - only the basic scoreboard. Request a full parse to
        unlock them (usually takes 30-90 seconds).
      </p>
      <button
        onClick={start}
        disabled={state === "requesting" || state === "waiting"}
        className="bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {state === "waiting"
          ? "Parsing..."
          : state === "requesting"
            ? "Requesting..."
            : "Request full parse"}
      </button>
      {state === "timeout" && (
        <p className="text-sm text-status-critical">
          Still processing on OpenDota&apos;s end - reload this page in a
          minute.
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-status-critical">
          Couldn&apos;t request a parse right now. Try again shortly.
        </p>
      )}
    </div>
  );
}
