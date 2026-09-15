import type { TrendMatchSummary } from "./types";

export type ChallengeType = "death_control" | "kda_breakout" | "signature_hero_farm";

export interface ChallengeCandidate {
  type: ChallengeType;
  description: string;
  target: number;
  heroId?: number;
  heroName?: string;
}

export interface StoredChallenge extends ChallengeCandidate {
  id: string;
  createdAt: number; // Date.now() (ms) at the moment the player started it
  status: "active" | "completed";
  completedMatchId?: number;
  completedAt?: number;
}

export interface EvaluationResult {
  status: "active" | "completed";
  completedMatchId?: number;
  completedAt?: number;
  qualifyingGamesSoFar: number;
}

const MIN_SAMPLE = 5;

function computeKda(m: TrendMatchSummary): number {
  return m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths;
}

/**
 * Deterministic, rule-based suggestions from the player's own real recent
 * matches - no AI involved, since these are precise numeric thresholds
 * where a model could plausibly invent a slightly-wrong number.
 */
export function generateCandidates(matches: TrendMatchSummary[]): ChallengeCandidate[] {
  if (matches.length < MIN_SAMPLE) return [];
  const candidates: ChallengeCandidate[] = [];

  const avgDeaths = matches.reduce((s, m) => s + m.deaths, 0) / matches.length;
  if (avgDeaths > 4) {
    const target = Math.max(2, Math.round(avgDeaths) - 2);
    candidates.push({
      type: "death_control",
      description: `Finish a game with fewer than ${target} deaths (your recent average is ${avgDeaths.toFixed(1)})`,
      target,
    });
  }

  const avgKda = matches.reduce((s, m) => s + computeKda(m), 0) / matches.length;
  const kdaTarget = Math.round(avgKda * 1.3 * 10) / 10;
  candidates.push({
    type: "kda_breakout",
    description: `Post a KDA above ${kdaTarget} in an upcoming game (your recent average is ${avgKda.toFixed(2)})`,
    target: kdaTarget,
  });

  const heroCounts = new Map<number, number>();
  for (const m of matches) heroCounts.set(m.heroId, (heroCounts.get(m.heroId) ?? 0) + 1);
  const topHeroId = [...heroCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topHeroId !== undefined) {
    const heroMatches = matches.filter((m) => m.heroId === topHeroId);
    const gpmSamples = heroMatches
      .map((m) => m.gpm)
      .filter((v): v is number => v !== null);
    if (gpmSamples.length > 0) {
      const avgGpm = gpmSamples.reduce((s, v) => s + v, 0) / gpmSamples.length;
      const gpmTarget = Math.round((avgGpm * 1.1) / 10) * 10;
      candidates.push({
        type: "signature_hero_farm",
        description: `Hit ${gpmTarget} GPM on ${heroMatches[0].heroName} in your next game on that hero (recent average is ${Math.round(avgGpm)})`,
        target: gpmTarget,
        heroId: topHeroId,
        heroName: heroMatches[0].heroName,
      });
    }
  }

  return candidates;
}

function meetsChallenge(challenge: StoredChallenge, m: TrendMatchSummary): boolean {
  switch (challenge.type) {
    case "death_control":
      return m.deaths < challenge.target;
    case "kda_breakout":
      return computeKda(m) > challenge.target;
    case "signature_hero_farm":
      return m.heroId === challenge.heroId && m.gpm !== null && m.gpm >= challenge.target;
    default:
      return false;
  }
}

/**
 * "Qualifying" = played after the challenge was started. Uniform across all
 * three types: has any real match since then cleared the bar, checked
 * against whatever's in the fetched sample.
 */
export function evaluateChallenge(
  challenge: StoredChallenge,
  matches: TrendMatchSummary[]
): EvaluationResult {
  const qualifying = matches
    .filter((m) => m.startTime * 1000 > challenge.createdAt)
    .sort((a, b) => a.startTime - b.startTime);

  const winner = qualifying.find((m) => meetsChallenge(challenge, m));
  if (winner) {
    return {
      status: "completed",
      completedMatchId: winner.matchId,
      completedAt: Date.now(),
      qualifyingGamesSoFar: qualifying.length,
    };
  }

  return { status: "active", qualifyingGamesSoFar: qualifying.length };
}
