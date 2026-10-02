"use client";

import Link from "next/link";
import { describeChallenge } from "@/lib/challenges";
import type { ChallengeCandidate, StoredChallenge } from "@/lib/challenges";
import { pluralRu } from "@/lib/format";

export function ChallengeCandidateCard({
  candidate,
  onStart,
}: {
  candidate: ChallengeCandidate;
  onStart: () => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between gap-3">
      <p className="text-sm text-ink">{describeChallenge(candidate)}</p>
      <button
        onClick={onStart}
        className="shrink-0 text-xs font-medium bg-accent hover:brightness-110 text-page px-3 py-1.5 rounded-md transition"
      >
        Начать испытание
      </button>
    </div>
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
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">{describeChallenge(challenge)}</p>
        <button
          onClick={onDismiss}
          className="text-ink-muted hover:text-ink text-xs shrink-0"
        >
          Убрать
        </button>
      </div>
      {isCompleted ? (
        <p className="text-xs text-status-good mt-2">
          Выполнено
          {challenge.completedMatchId && (
            <>
              {" - "}
              <Link
                href={`/player/${accountId}/match/${challenge.completedMatchId}`}
                className="underline hover:text-ink"
              >
                открыть матч
              </Link>
            </>
          )}
        </p>
      ) : (
        <p className="text-xs text-ink-muted mt-2">
          {qualifyingGamesSoFar === 0
            ? "С начала испытания новых игр пока нет."
            : `С начала испытания: ${qualifyingGamesSoFar} ${pluralRu(qualifyingGamesSoFar, ["новая игра", "новые игры", "новых игр"])} - продолжай.`}
        </p>
      )}
    </div>
  );
}
