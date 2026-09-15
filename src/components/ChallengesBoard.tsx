"use client";

import { useEffect, useState } from "react";
import { resolveAccountId } from "@/lib/steamId";
import { generateCandidates, evaluateChallenge } from "@/lib/challenges";
import type { ChallengeCandidate, StoredChallenge } from "@/lib/challenges";
import { loadChallenges, saveChallenges } from "@/lib/challengeStorage";
import { ChallengeCandidateCard, StoredChallengeCard } from "./ChallengeCard";
import type { TrendMatchSummary } from "@/lib/types";

interface Session {
  accountId: number;
  personaname: string | null;
}

const MATCH_LIMIT = 20;

export function ChallengesBoard() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [manualInput, setManualInput] = useState("");
  const [manualAccountId, setManualAccountId] = useState<number | null>(null);

  const [matches, setMatches] = useState<TrendMatchSummary[] | null>(null);
  const [challenges, setChallenges] = useState<StoredChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const accountId = session?.accountId ?? manualAccountId;

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/player/${accountId}/matches?limit=${MATCH_LIMIT}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const fetchedMatches = data.matches as TrendMatchSummary[];
        setMatches(fetchedMatches);

        const stored = loadChallenges(accountId);
        const reevaluated = stored.map((c) => {
          if (c.status === "completed") return c;
          const result = evaluateChallenge(c, fetchedMatches);
          return result.status === "completed"
            ? {
                ...c,
                status: "completed" as const,
                completedMatchId: result.completedMatchId,
                completedAt: result.completedAt,
              }
            : c;
        });
        setChallenges(reevaluated);
        saveChallenges(accountId, reevaluated);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load your matches")
      )
      .finally(() => setLoading(false));
  }, [accountId]);

  function startChallenge(candidate: ChallengeCandidate) {
    if (!accountId) return;
    const newChallenge: StoredChallenge = {
      ...candidate,
      id: `${candidate.type}-${candidate.heroId ?? "x"}-${Date.now()}`,
      createdAt: Date.now(),
      status: "active",
    };
    const updated = [...challenges, newChallenge];
    setChallenges(updated);
    saveChallenges(accountId, updated);
  }

  function dismissChallenge(id: string) {
    if (!accountId) return;
    const updated = challenges.filter((c) => c.id !== id);
    setChallenges(updated);
    saveChallenges(accountId, updated);
  }

  if (session === undefined) {
    return <p className="text-sm text-ink-muted">Loading...</p>;
  }

  if (!accountId) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5 max-w-md space-y-3">
        <p className="text-sm text-ink-secondary">
          Sign in through Steam, or enter your profile, to get training
          challenges grounded in your own recent games.
        </p>
        <div className="flex gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Steam64 ID or profile URL"
            className="flex-1 bg-page border border-border rounded-md px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={() => {
              const id = resolveAccountId(manualInput);
              if (id) {
                setError(null);
                setManualAccountId(id);
              } else {
                setError("Couldn't parse that Steam ID/URL.");
              }
            }}
            className="bg-accent hover:brightness-110 text-page text-sm font-medium px-4 py-2 rounded-md transition"
          >
            Go
          </button>
        </div>
        {error && <p className="text-sm text-status-critical">{error}</p>}
      </div>
    );
  }

  if (loading && !matches) {
    return <p className="text-sm text-ink-muted">Loading your recent games...</p>;
  }
  if (error) {
    return <p className="text-sm text-status-critical">{error}</p>;
  }
  if (!matches) return null;

  const activeTypes = new Set(
    challenges.filter((c) => c.status === "active").map((c) => c.type)
  );
  const candidates = generateCandidates(matches).filter((c) => !activeTypes.has(c.type));

  return (
    <div className="space-y-8">
      {challenges.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink mb-3">Your challenges</h2>
          <div className="space-y-3">
            {challenges.map((c) => {
              const result = c.status === "active" ? evaluateChallenge(c, matches) : null;
              return (
                <StoredChallengeCard
                  key={c.id}
                  challenge={c}
                  accountId={accountId}
                  qualifyingGamesSoFar={result?.qualifyingGamesSoFar ?? 0}
                  onDismiss={() => dismissChallenge(c.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">
          Suggested for you, from your last {matches.length} games
        </h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No new suggestions right now - your recent stats don&apos;t show
            an obvious gap, or you&apos;ve already started every suggestion.
          </p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <ChallengeCandidateCard
                key={c.type}
                candidate={c}
                onStart={() => startChallenge(c)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Progress is saved in this browser only - it won&apos;t follow you to
        another device.
      </p>
    </div>
  );
}
