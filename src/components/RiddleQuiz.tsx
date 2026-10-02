"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RIDDLES, type Riddle } from "@/lib/riddles";
import { primaryButton, secondaryButton } from "./buttonStyles";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const subscribeNothing = () => () => {};

function shuffledRiddles(): Riddle[] {
  const list = [...RIDDLES];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The first order is random, so it only exists on the client: the server
// renders the skeleton and hydration picks this up without a mismatch.
let firstOrder: Riddle[] | null = null;
function getFirstOrder(): Riddle[] {
  firstOrder ??= shuffledRiddles();
  return firstOrder;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-page/50 border border-border px-3 py-2 min-w-[76px]">
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="font-mono text-sm text-ink tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function optionStyle(revealed: boolean, isCorrect: boolean, isSelected: boolean): string {
  if (!revealed) return "border-border bg-page/40 hover:border-accent/60 hover:bg-surface-raised cursor-pointer";
  if (isCorrect) return "border-status-good bg-status-good/10";
  if (isSelected) return "border-status-critical bg-status-critical/10";
  return "border-border bg-page/30 opacity-60";
}

/**
 * Game-sense quiz: every riddle once per round in random order, answer with a
 * click or keys 1-4 / A-D, Enter for the next one, and a detailed explanation
 * after each answer.
 */
export function RiddleQuiz() {
  const initialOrder = useSyncExternalStore(subscribeNothing, getFirstOrder, () => null);
  const [replayOrder, setReplayOrder] = useState<Riddle[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0, best: 0 });

  const order = replayOrder ?? initialOrder;
  const riddle = order && index < order.length ? order[index] : null;
  const finished = order !== null && index >= order.length;

  function choose(i: number) {
    if (!riddle || selected !== null || i >= riddle.options.length) return;
    const right = i === riddle.correctIndex;
    setSelected(i);
    setScore((s) => {
      const streak = right ? s.streak + 1 : 0;
      return { correct: s.correct + (right ? 1 : 0), total: s.total + 1, streak, best: Math.max(s.best, streak) };
    });
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  function restart() {
    setReplayOrder(shuffledRiddles());
    setIndex(0);
    setSelected(null);
    setScore({ correct: 0, total: 0, streak: 0, best: 0 });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (selected === null) {
        const digit = Number(e.key);
        const letter = LETTERS.indexOf(e.key.toUpperCase());
        if (digit >= 1 && digit <= 6) choose(digit - 1);
        else if (letter >= 0) choose(letter);
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!order) {
    return <div className="h-[460px] bg-surface border border-border rounded-2xl animate-pulse" aria-hidden />;
  }

  const accuracy = score.total > 0 ? `${Math.round((score.correct / score.total) * 100)}%` : "-";

  if (finished) {
    return (
      <section
        className="bg-surface border border-border rounded-2xl p-8 text-center rise-in"
        style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}
      >
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mb-3">Раунд пройден</p>
        <p className="font-display font-extrabold text-5xl text-ink tabular-nums">
          {score.correct}
          <span className="text-ink-muted text-3xl"> / {score.total}</span>
        </p>
        <p className="text-ink-secondary mt-3">
          Точность {accuracy} · лучшая серия {score.best}.{" "}
          {score.correct === score.total ? "Безупречно - ты читаешь игру как профи." : "Разборы ошибок выше - лучший способ закрепить."}
        </p>
        <button type="button" onClick={restart} className={`${primaryButton} mt-6`}>
          Пройти ещё раз в новом порядке
        </button>
      </section>
    );
  }

  if (!riddle) return null;
  const revealed = selected !== null;
  const right = selected === riddle.correctIndex;

  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5 sm:p-6"
      style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-accent bg-accent/12 px-2.5 py-1 rounded-full">
            {riddle.category}
          </span>
          <p className="text-xs text-ink-muted mt-2 font-mono tabular-nums">
            Загадка {index + 1} из {order.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Stat label="Верно" value={`${score.correct}/${score.total}`} />
          <Stat label="Серия" value={String(score.streak)} />
          <Stat label="Точность" value={accuracy} />
        </div>
      </div>

      <div className="h-1 rounded-full bg-page overflow-hidden mb-6" aria-hidden>
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${((index + (revealed ? 1 : 0)) / order.length) * 100}%` }}
        />
      </div>

      <p key={riddle.id} className="text-lg text-ink leading-relaxed mb-6 rise-in">
        {riddle.scenario}
      </p>

      <ol className="space-y-2.5">
        {riddle.options.map((option, i) => {
          const isCorrect = i === riddle.correctIndex;
          const isSelected = i === selected;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={revealed}
                className={`w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-ink transition disabled:cursor-default ${optionStyle(
                  revealed,
                  isCorrect,
                  isSelected
                )}`}
              >
                <span
                  className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-xs font-mono font-bold ${
                    revealed && isCorrect
                      ? "bg-status-good text-page"
                      : revealed && isSelected
                        ? "bg-status-critical text-page"
                        : "bg-surface-raised text-ink-secondary"
                  }`}
                >
                  {revealed && isCorrect ? "✓" : revealed && isSelected ? "✕" : LETTERS[i]}
                </span>
                <span className="leading-relaxed pt-0.5 flex-1">{option}</span>
                {revealed && isSelected && (
                  <span className="text-[10px] uppercase tracking-wide text-ink-muted pt-1 shrink-0">твой ответ</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {revealed ? (
        <div
          className="mt-6 rounded-xl border p-4 rise-in"
          style={{
            borderColor: `color-mix(in srgb, ${right ? "var(--color-status-good)" : "var(--color-status-critical)"} 40%, transparent)`,
            background: `color-mix(in srgb, ${right ? "var(--color-status-good)" : "var(--color-status-critical)"} 7%, transparent)`,
          }}
        >
          <p className={`font-display font-bold mb-1.5 ${right ? "text-status-good" : "text-status-critical"}`}>
            {right ? "Верно!" : "Не совсем"}
          </p>
          <p className="text-sm text-ink-secondary leading-relaxed">{riddle.explanation}</p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button type="button" onClick={next} className={primaryButton}>
              {index + 1 < order.length ? "Следующая загадка →" : "Посмотреть итог"}
            </button>
            <span className="text-xs text-ink-muted hidden sm:inline">или Enter</span>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-ink-muted hidden sm:block">Ответ можно выбрать клавишами 1-{riddle.options.length} или A-{LETTERS[riddle.options.length - 1]}.</p>
          <button type="button" onClick={next} className={`${secondaryButton} py-1.5 text-xs`}>
            Пропустить
          </button>
        </div>
      )}
    </section>
  );
}
