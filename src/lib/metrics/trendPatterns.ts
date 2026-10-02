import { computeMatchMetrics } from "./matchMetrics";
import type { CrossMatchPatterns, OpenDotaMatch } from "../types";

// Bounded independent of whatever "last N matches" list the caller is
// showing - fetching full match detail (and, for lane comparisons, real
// gold_t/xp_t/lane data) for every recent match would be slow, so the deep
// cross-match analysis always looks at at most this many, newest first.
const MAX_DEEP_SAMPLE = 10;
const MIN_RECURRING_KILLER_COUNT = 2;

function tallyLaneStat(
  tally: { ahead: number; behind: number; tied: number; sampledGames: number },
  yours: number | null,
  theirs: number | null
) {
  if (yours === null || theirs === null) return;
  tally.sampledGames++;
  if (yours > theirs) tally.ahead++;
  else if (yours < theirs) tally.behind++;
  else tally.tied++;
}

/**
 * Real recurring patterns across this player's own recent matches - not one
 * game's story, but what keeps happening: the same killer hero coming up
 * again and again, or a lane matchup they're consistently behind in. Deaths
 * and lane comparisons are only ever real data pulled from OpenDota's parsed
 * replay for each match (same source as the single-match coach); matches
 * OpenDota hasn't parsed simply contribute nothing here rather than being
 * guessed at or auto-parsed (parsing 10 replays serially would be far too
 * slow for a report the player is actively waiting on).
 */
export function computeCrossMatchPatterns(
  accountId: number,
  matches: OpenDotaMatch[]
): CrossMatchPatterns {
  const sample = matches.slice(0, MAX_DEEP_SAMPLE);
  let parsedGamesSampled = 0;
  const killerCounts = new Map<string, number>();
  const laneLastHits = { ahead: 0, behind: 0, tied: 0, sampledGames: 0 };
  const laneGold = { ahead: 0, behind: 0, tied: 0, sampledGames: 0 };

  for (const match of sample) {
    const player = match.players.find((p) => p.account_id === accountId);
    if (!player) continue;
    const metrics = computeMatchMetrics(match, accountId, null);
    if (
      metrics.deathLog.length === 0 &&
      metrics.laneOpponents.length === 0 &&
      metrics.itemTimeline.length === 0
    ) {
      continue; // unparsed - no real signal to add for this match
    }
    parsedGamesSampled++;

    for (const death of metrics.deathLog) {
      killerCounts.set(
        death.killerHeroName,
        (killerCounts.get(death.killerHeroName) ?? 0) + 1
      );
    }

    // Only the first real lane opponent counts toward the tally, so a duo
    // lane with two opponents doesn't double-weight one game's result.
    const primaryOpponent = metrics.laneOpponents[0];
    if (primaryOpponent) {
      tallyLaneStat(laneLastHits, metrics.lastHitsAt10, primaryOpponent.lastHitsAt10);
      tallyLaneStat(laneGold, metrics.goldAt10, primaryOpponent.goldAt10);
    }
  }

  const recurringKillers = [...killerCounts.entries()]
    .filter(([, count]) => count >= MIN_RECURRING_KILLER_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([killerHeroName, count]) => ({ killerHeroName, count }));

  return { parsedGamesSampled, recurringKillers, laneLastHits, laneGold };
}
