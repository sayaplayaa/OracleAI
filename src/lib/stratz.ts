import { cached } from "./cache";
import type { StratzMatchPlayerPosition } from "./types";

const STRATZ_URL = "https://api.stratz.com/graphql";
const HOUR = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

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
    throw new StratzError("Не задан STRATZ_API_KEY.");
  }

  let json;
  try {
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
      // A stalled connection never errors on its own - without a deadline fetch hangs for minutes.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new StratzError(`Не удался запрос к STRATZ (${res.status})`);
    }

    json = await res.json();
  } catch (err) {
    if (err instanceof StratzError) throw err;
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new StratzError(
      timedOut
        ? `STRATZ не отвечает дольше ${REQUEST_TIMEOUT_MS / 1000} с (соединение зависло)`
        : `Не удался запрос к STRATZ: ${err instanceof Error ? err.message : "ошибка сети"}`
    );
  }
  if (json.errors) {
    throw new StratzError(json.errors[0]?.message ?? "Ошибка GraphQL STRATZ");
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
      throw new StratzError(`У STRATZ нет данных по матчу ${matchId}`);
    }
    return data.match.players;
  });
}

// One death as STRATZ's replay parser records it. Positions are on the same
// ~64-192 grid as OpenDota's ward logs; the flags are STRATZ's own analysis
// of the moment (walked through an enemy ward's vision, tried to TP out...).
export interface StratzDeathEvent {
  time: number;
  attacker: number | null;
  byAbility: number | null;
  byItem: number | null;
  timeDead: number | null;
  goldLost: number | null;
  positionX: number | null;
  positionY: number | null;
  assist: number[] | null;
  isWardWalkThrough: boolean | null;
  isAttemptTpOut: boolean | null;
  isBurst: boolean | null;
  isEngagedOnDeath: boolean | null;
  hasHealAvailable: boolean | null;
  isTracked: boolean | null;
}

export interface StratzPlayerDeaths {
  heroId: number;
  isRadiant: boolean;
  deathEvents: StratzDeathEvent[];
}

/**
 * Every player's real death events (exact map position, killing ability or
 * item, assisting heroes) for one match. Best-effort like the positions
 * query: throws when STRATZ hasn't parsed the replay yet, so an empty result
 * is never cached for a match it will have data for later.
 */
export function getMatchDeathEvents(matchId: number) {
  return cached(`stratz:match-deaths:${matchId}`, 24 * HOUR, async () => {
    const data = await graphql<{
      match: {
        players: { heroId: number; isRadiant: boolean; stats: { deathEvents: StratzDeathEvent[] | null } | null }[];
      } | null;
    }>(
      `query MatchDeaths($id: Long!) {
        match(id: $id) {
          players {
            heroId
            isRadiant
            stats {
              deathEvents {
                time attacker byAbility byItem timeDead goldLost positionX positionY assist
                isWardWalkThrough isAttemptTpOut isBurst isEngagedOnDeath hasHealAvailable isTracked
              }
            }
          }
        }
      }`,
      { id: matchId }
    );
    const players = data.match?.players ?? [];
    if (!players.some((p) => (p.stats?.deathEvents?.length ?? 0) > 0)) {
      throw new StratzError(`У STRATZ ещё нет разобранных смертей матча ${matchId}`);
    }
    return players.map(
      (p): StratzPlayerDeaths => ({ heroId: p.heroId, isRadiant: p.isRadiant, deathEvents: p.stats?.deathEvents ?? [] })
    );
  });
}

// Where a hero was over the game: STRATZ records a point each time the hero
// moves to a new grid cell (same ~64-192 grid as the ward logs, 1 cell = 128
// game units), so the position at any second is the last point before it.
export interface StratzPositionTrack {
  heroId: number;
  isRadiant: boolean;
  points: { time: number; x: number; y: number }[];
}

/**
 * Every hero's movement over the match - the only source of where players
 * stood in fights and who was near them when they died. Best-effort: throws
 * when STRATZ hasn't parsed the replay, so callers fall back to death
 * positions alone.
 */
export function getMatchPositionTracks(matchId: number) {
  return cached(`stratz:match-tracks:${matchId}`, 24 * HOUR, async () => {
    const data = await graphql<{
      match: {
        players: {
          heroId: number;
          isRadiant: boolean;
          playbackData: { playerUpdatePositionEvents: { time: number; x: number; y: number }[] | null } | null;
        }[];
      } | null;
    }>(
      `query MatchTracks($id: Long!) {
        match(id: $id) {
          players {
            heroId
            isRadiant
            playbackData { playerUpdatePositionEvents { time x y } }
          }
        }
      }`,
      { id: matchId }
    );
    const players = data.match?.players ?? [];
    if (!players.some((p) => (p.playbackData?.playerUpdatePositionEvents?.length ?? 0) > 0)) {
      throw new StratzError(`У STRATZ нет позиций героев в матче ${matchId}`);
    }
    return players.map(
      (p): StratzPositionTrack => ({
        heroId: p.heroId,
        isRadiant: p.isRadiant,
        points: [...(p.playbackData?.playerUpdatePositionEvents ?? [])].sort((a, b) => a.time - b.time),
      })
    );
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

// STRATZ's position stats pool every public bracket by default, including
// Herald/Guardian, where off-meta/troll picks (e.g. a support hero bought
// as a "carry") are common enough to show up as real-looking sample sizes -
// restricting to Legend+ is what separates real emerging-meta picks from
// pub noise. Verified directly against STRATZ: Crystal Maiden's "Position 1"
// sample drops from 433 games (all brackets) to 98 (Legend+) and its win
// rate drops to a clearly-not-viable 34%, confirming the bracket - not the
// game count - was letting the noise through.
const META_BRACKETS = ["LEGEND_ANCIENT", "DIVINE_IMMORTAL"];

/** Real pick/win rate per position (1-5), for the hero's role tabs. */
export function getHeroPositionStats(heroId: number) {
  return cached(`stratz:hero-positions:${heroId}:v2`, 6 * HOUR, async () => {
    const data = await graphql<{
      heroStats: { stats: StratzHeroPositionStat[] };
    }>(
      `query HeroPositionStats($heroId: Short!, $brackets: [RankBracketBasicEnum]) {
        heroStats {
          stats(heroIds: [$heroId], groupByPosition: true, bracketBasicIds: $brackets) {
            heroId
            position
            matchCount
            winCount
          }
        }
      }`,
      { heroId, brackets: META_BRACKETS }
    );
    return data.heroStats.stats;
  });
}

const ALL_HERO_STATS_QUERY = `query AllHeroPositionStats($heroIds: [Short], $brackets: [RankBracketBasicEnum]) {
  heroStats {
    stats(heroIds: $heroIds, groupByPosition: true, bracketBasicIds: $brackets) {
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
  return cached(`stratz:all-hero-positions:v2`, 6 * HOUR, async () => {
    const batches: number[][] = [];
    for (let i = 0; i < heroIds.length; i += HERO_STATS_BATCH_SIZE) {
      batches.push(heroIds.slice(i, i + HERO_STATS_BATCH_SIZE));
    }

    const results: StratzHeroPositionStat[] = [];
    for (const batch of batches) {
      const data = await graphql<{
        heroStats: { stats: StratzHeroPositionStat[] };
      }>(ALL_HERO_STATS_QUERY, { heroIds: batch, brackets: META_BRACKETS });
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
    // STRATZ returns null (not []) for a field when a hero+position combo
    // has no real data at all (e.g. an off-meta position for that hero) -
    // normalize here, at the boundary, so every caller can trust these are
    // real arrays instead of each needing its own null guard.
    return {
      startingItems: data.heroStats.startingItems ?? [],
      fullPurchases: data.heroStats.fullPurchases ?? [],
      neutralItems: data.heroStats.neutralItems ?? [],
      talents: data.heroStats.talents ?? [],
    };
  });
}
