"use client";

import Link from "next/link";
import { describeChallenge } from "@/lib/challenges";
import type { ChallengeCandidate, ChallengeType, StoredChallenge } from "@/lib/challenges";
import { pluralRu } from "@/lib/format";
import { primaryButton } from "./buttonStyles";

const TYPE_META: Record<ChallengeType, { title: string; color: string; icon: React.ReactNode }> = {
  death_control: {
    title: "Меньше смертей",
    color: "var(--color-status-critical)",
    icon: <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" />,
  },
  kda_breakout: {
    title: "Прорыв по KDA",
    color: "var(--color-series-blue)",
    icon: <path d="M3 17l5-5 4 4 8-9M14 7h6v6" />,
  },
  signature_hero_farm: {
    title: "Фарм на основном герое",
    color: "var(--color-accent)",
    icon: (
      <>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>
    ),
  },
};

function fmt(value: number, digits: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** "Now ~6,8 → goal < 5" in the challenge's own units. */
function TargetLine({ challenge }: { challenge: ChallengeCandidate }) {
  const baseline = typeof challenge.baseline === "number" && Number.isFinite(challenge.baseline) ? challenge.baseline : null;
  const [now, goal, unit] =
    challenge.type === "death_control"
      ? [baseline !== null ? fmt(baseline, 1) : null, `< ${challenge.target}`, pluralRu(challenge.target, ["смерти", "смертей", "смертей"])]
      : challenge.type === "kda_breakout"
        ? [baseline !== null ? fmt(baseline, 2) : null, `> ${fmt(challenge.target, 1)}`, "KDA"]
        : [baseline !== null ? Math.round(baseline).toLocaleString("ru-RU") : null, `${challenge.target.toLocaleString("ru-RU")}+`, "GPM"];

  return (
    <div className="flex items-end gap-3">
      {now !== null && (
        <>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-ink-muted">Сейчас</p>
            <p className="font-mono text-lg text-ink-secondary tabular-nums leading-tight">{now}</p>
          </div>
          <span className="text-ink-muted pb-1" aria-hidden>
            →
          </span>
        </>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-accent">Цель</p>
        <p className="font-mono text-2xl text-ink tabular-nums leading-tight">
          {goal} <span className="text-sm text-ink-muted font-sans">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: ChallengeType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
      aria-hidden
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {meta.icon}
      </svg>
    </span>
  );
}

function cardTitle(c: ChallengeCandidate): string {
  return c.type === "signature_hero_farm" && c.heroName ? `Фарм на ${c.heroName}` : TYPE_META[c.type]?.title ?? "Испытание";
}

export function ChallengeCandidateCard({
  candidate,
  onStart,
}: {
  candidate: ChallengeCandidate;
  onStart: () => void;
}) {
  return (
    <article className="bg-surface border border-border hover:border-accent/40 rounded-2xl p-5 flex flex-col gap-4 transition">
      <div className="flex items-start gap-3">
        <TypeIcon type={candidate.type} />
        <div className="min-w-0">
          <h3 className="font-display font-bold text-ink">{cardTitle(candidate)}</h3>
          <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{describeChallenge(candidate)}</p>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 flex-wrap">
        <TargetLine challenge={candidate} />
        <button type="button" onClick={onStart} className={primaryButton}>
          Принять вызов
        </button>
      </div>
    </article>
  );
}

export function StoredChallengeCard({
  challenge,
  accountId,
  qualifyingGamesSoFar,
  onDismiss,
}: {
  challenge: StoredChallenge;
  accountId: number;
  qualifyingGamesSoFar: number;
  onDismiss: () => void;
}) {
  const isCompleted = challenge.status === "completed";
  const color = isCompleted ? "var(--color-status-good)" : "var(--color-accent)";

  return (
    <article
      className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4"
      style={{ boxShadow: `inset 0 3px 0 0 ${color}` }}
    >
      <div className="flex items-start gap-3">
        <TypeIcon type={challenge.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-ink">{cardTitle(challenge)}</h3>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: color }}
            >
              {isCompleted ? "✓ Выполнено" : "В процессе"}
            </span>
          </div>
          <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{describeChallenge(challenge)}</p>
        </div>
      </div>

      <div className="mt-auto rounded-xl bg-page/50 border border-border px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
        {isCompleted ? (
          <p className="text-sm text-status-good">
            Засчитано реальной игрой
            {challenge.completedMatchId && (
              <>
                {" · "}
                <Link
                  href={`/player/${accountId}/match/${challenge.completedMatchId}`}
                  className="underline underline-offset-4 hover:text-ink transition"
                >
                  открыть матч
                </Link>
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-ink-secondary">
            {qualifyingGamesSoFar === 0
              ? "Новых игр с начала испытания пока нет - сыграй матч."
              : `С начала: ${qualifyingGamesSoFar} ${pluralRu(qualifyingGamesSoFar, ["игра", "игры", "игр"])}, цель пока не взята.`}
          </p>
        )}
        <button type="button" onClick={onDismiss} className="text-xs text-ink-muted hover:text-ink transition">
          {isCompleted ? "Убрать" : "Отказаться"}
        </button>
      </div>
    </article>
  );
}
