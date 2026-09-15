import { getHeroName } from "../constants";
import type { DraftInsights, HeroMatchup, OpenDotaMatchupEntry } from "../types";
import { formatStratzPosition, type StratzLaneOutcome } from "../stratz";
import { wilsonScoreLowerBound, wilsonScoreUpperBound } from "./statistics";

// Below this sample size a matchup's win rate is too noisy to act on.
const MIN_GAMES_PLAYED = 20;
const MIN_LANE_GAMES = 30;
const LIST_SIZE = 10;

function computeLaneSynergy(laneSynergy: StratzLaneOutcome[]): {
  bestLanePartners: HeroMatchup[];
  lanePosition: string | null;
} {
  if (laneSynergy.length === 0) {
    return { bestLanePartners: [], lanePosition: null };
  }

  // A hero's data can span multiple positions; keep only the one STRATZ has
  // the most games for, so we don't mix a carry's stats with an off-role.
  const gamesByPosition = new Map<string, number>();
  for (const entry of laneSynergy) {
    gamesByPosition.set(
      entry.position,
      (gamesByPosition.get(entry.position) ?? 0) + entry.matchCount
    );
  }
  const dominantPosition = [...gamesByPosition.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  const bestLanePartners = laneSynergy
    .filter(
      (e) => e.position === dominantPosition && e.matchCount >= MIN_LANE_GAMES
    )
    .map((e) => ({
      heroId: e.heroId2,
      heroName: getHeroName(e.heroId2),
      gamesPlayed: e.matchCount,
      wins: e.matchWinCount,
      winRate: e.matchWinCount / e.matchCount,
      _rankScore: wilsonScoreLowerBound(e.matchWinCount, e.matchCount),
    }))
    .sort((a, b) => b._rankScore - a._rankScore)
    .slice(0, LIST_SIZE)
    .map(({ _rankScore, ...entry }) => entry);

  return { bestLanePartners, lanePosition: formatStratzPosition(dominantPosition) };
}

export function computeDraftInsights(
  heroId: number,
  matchups: OpenDotaMatchupEntry[],
  laneSynergy: StratzLaneOutcome[] = []
): DraftInsights {
  const withWinRate = matchups
    .filter((m) => m.games_played >= MIN_GAMES_PLAYED)
    .map((m) => ({
      heroId: m.hero_id,
      heroName: getHeroName(m.hero_id),
      gamesPlayed: m.games_played,
      wins: m.wins,
      winRate: m.wins / m.games_played,
      // Sort keys only, not returned - a matchup with few games shouldn't
      // outrank one backed by thousands just because it got lucky/unlucky.
      _lowScore: wilsonScoreLowerBound(m.wins, m.games_played),
      _highScore: wilsonScoreUpperBound(m.wins, m.games_played),
    }));

  const toughestMatchups: HeroMatchup[] = [...withWinRate]
    .sort((a, b) => a._highScore - b._highScore)
    .slice(0, LIST_SIZE)
    .map(({ _lowScore, _highScore, ...entry }) => entry);
  const bestMatchups: HeroMatchup[] = [...withWinRate]
    .sort((a, b) => b._lowScore - a._lowScore)
    .slice(0, LIST_SIZE)
    .map(({ _lowScore, _highScore, ...entry }) => entry);

  const { bestLanePartners, lanePosition } = computeLaneSynergy(laneSynergy);

  return {
    heroId,
    heroName: getHeroName(heroId),
    toughestMatchups,
    bestMatchups,
    bestLanePartners,
    lanePosition,
  };
}
