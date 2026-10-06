import type { TrendMatchSummary } from "./types";
import { pluralRu } from "./format";
import { inFamily } from "./metrics/gameContext";

export type ChallengeType = "death_control" | "kda_breakout" | "signature_hero_farm";

// Only numbers/ids are kept here (and in localStorage); the text shown to the
// player is built at render time by describeChallenge(). Challenges saved by
// older versions also carry an English `description` field - it is ignored.
export interface ChallengeCandidate {
  type: ChallengeType;
  target: number;
  /** The player's recent average for this stat when the challenge was
   * suggested. Missing on challenges saved by older versions. */
  baseline?: number;
  heroId?: number;
  heroName?: string;
  /** Set from Turbo games, and only Turbo games count toward it. Missing
   * (older challenges) = normal games. */
  turbo?: boolean;
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

/** Russian decimal formatting: 5.3 -> "5,3". */
function formatNumber(value: number, minDigits: number, maxDigits: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
}

/** The challenge text the player sees, in Russian. */
export function describeChallenge(c: ChallengeCandidate): string {
  const text = describeGoal(c);
  return c.turbo ? `${text} - в Turbo` : text;
}

function describeGoal(c: ChallengeCandidate): string {
  const baseline =
    typeof c.baseline === "number" && Number.isFinite(c.baseline) ? c.baseline : null;
  switch (c.type) {
    case "death_control": {
      const times = pluralRu(c.target, ["раза", "раз", "раз"]);
      const avg =
        baseline !== null
          ? ` (твоё среднее за последние игры: ${formatNumber(baseline, 1, 1)})`
          : "";
      return `Закончи игру, умерев меньше ${c.target} ${times}${avg}`;
    }
    case "kda_breakout": {
      const avg =
        baseline !== null
          ? ` (твоё среднее за последние игры: ${formatNumber(baseline, 2, 2)})`
          : "";
      return `Сыграй одну из ближайших игр с KDA выше ${formatNumber(c.target, 0, 1)}${avg}`;
    }
    case "signature_hero_farm": {
      const hero = c.heroName ?? "своём основном герое";
      const avg =
        baseline !== null
          ? ` (твоё среднее на нём: ${Math.round(baseline).toLocaleString("ru-RU")})`
          : "";
      return `Набери ${c.target.toLocaleString("ru-RU")} GPM на ${hero} в следующей игре на этом герое${avg}`;
    }
    default:
      return "Испытание";
  }
}

/**
 * Deterministic, rule-based suggestions from the player's own real recent
 * matches - no AI involved, since these are precise numeric thresholds
 * where a model could plausibly invent a slightly-wrong number. `matches`
 * must be comparable games (all Turbo or all normal - see comparableGames).
 */
export function generateCandidates(matches: TrendMatchSummary[], turbo: boolean): ChallengeCandidate[] {
  if (matches.length < MIN_SAMPLE) return [];
  const family = turbo ? { turbo: true } : {};
  const candidates: ChallengeCandidate[] = [];

  const avgDeaths = matches.reduce((s, m) => s + m.deaths, 0) / matches.length;
  if (avgDeaths > 4) {
    const target = Math.max(2, Math.round(avgDeaths) - 2);
    candidates.push({
      type: "death_control",
      target,
      baseline: avgDeaths,
      ...family,
    });
  }

  const avgKda = matches.reduce((s, m) => s + computeKda(m), 0) / matches.length;
  const kdaTarget = Math.round(avgKda * 1.3 * 10) / 10;
  candidates.push({
    type: "kda_breakout",
    target: kdaTarget,
    baseline: avgKda,
    ...family,
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
        target: gpmTarget,
        baseline: avgGpm,
        heroId: topHeroId,
        heroName: heroMatches[0].heroName,
        ...family,
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
  // Only the kind of game the target was set from: a Turbo game's doubled
  // GPM would "complete" a normal-game farm goal without any improvement.
  const qualifying = matches
    .filter((m) => m.startTime * 1000 > challenge.createdAt)
    .filter((m) => inFamily(m.gameMode, Boolean(challenge.turbo)) && !m.leftGame)
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
