import { cached } from "./cache";
import type { StratzMatchPlayerPosition } from "./types";

const STRATZ_URL = "https://api.stratz.com/graphql";
const HOUR = 60 * 60 * 1000;

export interface StratzLaneOutcome {
  heroId1: number;
  heroId2: number;
  matchCount: number;
  // matchWinCount = actually won the game; winCount is STRATZ's own
  // lane-phase-only outcome formula, which is a different (noisier, ~1/3
  // win/draw/loss) metric we don't want for a "win rate" the user reads as
  // "did the team win the match".
  matchWinCount: number;
  position: string;
}

export function formatStratzPosition(position: string | null | undefined): string {
  if (!position) return "Unknown";
  const match = position.match(/POSITION_(\d)/);
  return match ? `Position ${match[1]}` : position;
}

export class StratzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StratzError";
  }
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const key = process.env.STRATZ_API_KEY;
  if (!key) {
    throw new StratzError("STRATZ_API_KEY is not set.");
  }

  const res = await fetch(STRATZ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      // STRATZ blocks requests without an identifying User-Agent behind its
      // Cloudflare bot challenge, even with a valid token.
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new StratzError(`STRATZ request failed (${res.status})`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new StratzError(json.errors[0]?.message ?? "STRATZ GraphQL error");
  }
  return json.data as T;
}

/** Real teammate lane-pairing outcomes for a hero (isWith: true = same-team lane partner). */
export function getLaneSynergy(heroId: number) {
  return cached(`stratz:lane-with:${heroId}`, 6 * HOUR, async () => {
    const data = await graphql<{
      heroStats: { laneOutcome: StratzLaneOutcome[] };
    }>(
      `query LaneSynergy($heroId: Short!) {
        heroStats {
          laneOutcome(heroId: $heroId, isWith: true) {
            heroId1
            heroId2
            matchCount
            matchWinCount
            position
          }
        }
      }`,
      { heroId }
    );
    return data.heroStats.laneOutcome;
  });
}

/**
 * Real per-match position (POSITION_1..5) for every player, from STRATZ's
 * own role classifier. Best-effort - callers must fall back to a heuristic
 * when this throws (STRATZ has shown intermittent IP-lock failures) or
 * when a match is too old/obscure for STRATZ to have analyzed.
 */
export function getMatchPlayerPositions(matchId: number) {
  return cached(`stratz:match-positions:${matchId}`, 24 * HOUR, async () => {
    const data = await graphql<{
      match: { players: StratzMatchPlayerPosition[] } | null;
    }>(
      `query MatchPositions($id: Long!) {
        match(id: $id) {
          players {
            heroId
            isRadiant
            position
          }
        }
      }`,
      { id: matchId }
    );
    if (!data.match) {
      throw new StratzError(`STRATZ has no data for match ${matchId}`);
    }
    return data.match.players;
  });
}

export interface StratzHeroPositionStat {
  heroId: number;
  position: string;
  matchCount: number;
  winCount: number;
}

export interface StratzItemStat {
  itemId: number;
  time?: number;
  matchCount: number;
  winCount: number;
}

export interface StratzNeutralItemStat {
  itemId: number;
  matchCount: number;
  winCount: number;
  equippedMatchCount: number;
  equippedMatchWinCount: number;
}

export interface StratzTalentStat {
  abilityId: number;
  matchCount: number;
  winCount: number;
}

/** Real pick/win rate per position (1-5), for the hero's role tabs. */
export function getHeroPositionStats(heroId: number) {
  return cached(`stratz:hero-positions:${heroId}`, 6 * HOUR, async () => {
    const data = await graphql<{
      heroStats: { stats: StratzHeroPositionStat[] };
    }>(
      `query HeroPositionStats($heroId: Short!) {
        heroStats {
          stats(heroIds: [$heroId], groupByPosition: true) {
            heroId
            position
            matchCount
            winCount
          }
        }
      }`,
      { heroId }
    );
    return data.heroStats.stats;
  });
}

const ALL_HERO_STATS_QUERY = `query AllHeroPositionStats($heroIds: [Short]) {
  heroStats {
    stats(heroIds: $heroIds, groupByPosition: true) {
      heroId
      position
      matchCount
      winCount
    }
  }
}`;

const HERO_STATS_BATCH_SIZE = 20;

/**
 * Same per-position pick/win data as getHeroPositionStats, for every hero at
 * once - powers the Meta tier list. Batched: passing all ~127 hero IDs in a
 * single `stats` call makes STRATZ's resolver fail outright ("Error trying
 * to resolve field 'stats'"), so this chunks the request and merges results.
 */
export function getAllHeroStats(heroIds: number[]) {
  return cached(`stratz:all-hero-positions`, 6 * HOUR, async () => {
    const batches: number[][] = [];
    for (let i = 0; i < heroIds.length; i += HERO_STATS_BATCH_SIZE) {
      batches.push(heroIds.slice(i, i + HERO_STATS_BATCH_SIZE));
    }

    const results: StratzHeroPositionStat[] = [];
    for (const batch of batches) {
      const data = await graphql<{
        heroStats: { stats: StratzHeroPositionStat[] };
      }>(ALL_HERO_STATS_QUERY, { heroIds: batch });
      results.push(...data.heroStats.stats);
    }
    return results;
  });
}

export interface StratzHeroBuild {
  startingItems: StratzItemStat[];
  fullPurchases: StratzItemStat[];
  neutralItems: StratzNeutralItemStat[];
  talents: StratzTalentStat[];
}

/** Current-week item/talent build data for a hero at one position - the same "last 7-8 days" window D2PT itself uses. */
export function getHeroBuild(heroId: number, position: string) {
  return cached(`stratz:hero-build:${heroId}:${position}`, 6 * HOUR, async () => {
    const data = await graphql<{ heroStats: StratzHeroBuild }>(
      `query HeroBuild($heroId: Short!, $positions: [MatchPlayerPositionType]) {
        heroStats {
          startingItems: itemStartingPurchase(heroId: $heroId, positionIds: $positions) {
            itemId
            matchCount
            winCount
          }
          fullPurchases: itemFullPurchase(heroId: $heroId, positionIds: $positions) {
            itemId
            time
            matchCount
            winCount
          }
          neutralItems: itemNeutral(heroId: $heroId, positionIds: $positions) {
            itemId
            matchCount
            winCount
            equippedMatchCount
            equippedMatchWinCount
          }
          talents: talent(heroId: $heroId, positionIds: $positions) {
            abilityId
            matchCount
            winCount
          }
        }
      }`,
      { heroId, positions: [position] }
    );
    return data.heroStats;
  });
}
