"use client";

import { useEffect, useState } from "react";
import { RIDDLES, type Riddle } from "@/lib/riddles";

function randomRiddle(excludeId?: string): Riddle {
  const pool = RIDDLES.filter((r) => r.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function RiddleQuiz() {
  // Start deterministic (same on server and client) - Math.random() can't
  // run during the initial render without a hydration mismatch, so the
  // actual random pick happens client-only, after mount.
  const [riddle, setRiddle] = useState<Riddle | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    setRiddle(randomRiddle());
  }, []);

  if (!riddle) {
    return <div className="h-64 bg-surface border border-border rounded-lg animate-pulse" />;
  }
  const currentRiddle = riddle;

  function choose(index: number) {
    if (selected !== null) return;
    setSelected(index);
    setScore((s) => ({
      correct: s.correct + (index === currentRiddle.correctIndex ? 1 : 0),
      total: s.total + 1,
    }));
  }

  function next() {
    setRiddle(randomRiddle(currentRiddle.id));
    setSelected(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          {riddle.category}
        </span>
        {score.total > 0 && (
          <span className="text-xs font-mono text-ink-muted">
            {score.correct}/{score.total} correct
          </span>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-base text-ink mb-5">{riddle.scenario}</p>

        <div className="space-y-2">
          {riddle.options.map((option, i) => {
            const isCorrect = i === riddle.correctIndex;
            const isSelected = i === selected;
            const revealed = selected !== null;

            let borderColor = "var(--color-border)";
            if (revealed && isCorrect) borderColor = "var(--color-status-good)";
            else if (revealed && isSelected && !isCorrect) borderColor = "var(--color-status-critical)";

            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={revealed}
                className="w-full text-left px-4 py-2.5 rounded-md border text-sm transition disabled:cursor-default"
                style={{
                  borderColor,
                  background:
                    revealed && isCorrect
                      ? "color-mix(in srgb, var(--color-status-good) 10%, transparent)"
                      : revealed && isSelected
                        ? "color-mix(in srgb, var(--color-status-critical) 10%, transparent)"
                        : undefined,
                  color: "var(--color-ink)",
                }}
              >
                {option}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-5 pt-4 border-t border-border">
            <p
              className="text-sm font-semibold mb-1.5"
              style={{
                color:
                  selected === riddle.correctIndex
                    ? "var(--color-status-good)"
                    : "var(--color-status-critical)",
              }}
            >
              {selected === riddle.correctIndex ? "Correct" : "Not quite"}
            </p>
            <p className="text-sm text-ink-secondary">{riddle.explanation}</p>
            <button
              onClick={next}
              className="mt-4 bg-accent hover:brightness-110 text-page text-sm font-medium px-4 py-2 rounded-md transition"
            >
              Next riddle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
