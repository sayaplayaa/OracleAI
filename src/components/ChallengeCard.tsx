"use client";

import Link from "next/link";
import type { ChallengeCandidate, StoredChallenge } from "@/lib/challenges";

export function ChallengeCandidateCard({
  candidate,
  onStart,
}: {
  candidate: ChallengeCandidate;
  onStart: () => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between gap-3">
      <p className="text-sm text-ink">{candidate.description}</p>
      <button
        onClick={onStart}
        className="shrink-0 text-xs font-medium bg-accent hover:brightness-110 text-page px-3 py-1.5 rounded-md transition"
      >
        Start challenge
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
        <p className="text-sm text-ink">{challenge.description}</p>
        <button
          onClick={onDismiss}
          className="text-ink-muted hover:text-ink text-xs shrink-0"
        >
          Dismiss
        </button>
      </div>
      {isCompleted ? (
        <p className="text-xs text-status-good mt-2">
          Completed
          {challenge.completedMatchId && (
            <>
              {" - "}
              <Link
                href={`/player/${accountId}/match/${challenge.completedMatchId}`}
                className="underline hover:text-ink"
              >
                view the match
              </Link>
            </>
          )}
        </p>
      ) : (
        <p className="text-xs text-ink-muted mt-2">
          {qualifyingGamesSoFar === 0
            ? "No new games yet since you started this."
            : `${qualifyingGamesSoFar} new game${qualifyingGamesSoFar === 1 ? "" : "s"} so far - keep going.`}
        </p>
      )}
    </div>
  );
}
