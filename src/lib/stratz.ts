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

// One row per item, per purchase (instance 0 = the first copy bought, 1 = the
// second...) and, for full purchases, per game minute it was bought in - an
// item's real pick count is the sum of its instance-0 rows over every minute.
export interface StratzItemStat {
  itemId: number;
  instance?: number | null;
  // Game minute of the purchase (full purchases only).
  time?: number;
  matchCount: number;
  winCount: number;
  // Starting items only: handed over by a teammate rather than bought.
  wasGiven?: boolean | null;
}

// Boots come from their own STRATZ query: the full-purchase list never
// includes them (Power Treads on Anti-Mage simply wasn't there).
export interface StratzBootStat {
  itemId: number;
  instance?: number | null;
  // Seconds.
  timeAverage: number;
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

// STRATZ's `stats` without a time filter answers with its last game-minute
// bucket - games that reached minute 35 - not every game (Anti-Mage carry:
// 91 300 against 126 723 games in total). maxTime: 0 is the bucket that
// holds every game, which item pick rates and win rates need.
/** Real pick/win rate per position (1-5), for the hero's role tabs. */
export function getHeroPositionStats(heroId: number) {
  return cached(`stratz:hero-positions:${heroId}:v3`, 6 * HOUR, async () => {
    const data = await graphql<{
      heroStats: { stats: StratzHeroPositionStat[] };
    }>(
      `query HeroPositionStats($heroId: Short!, $brackets: [RankBracketBasicEnum]) {
        heroStats {
          stats(heroIds: [$heroId], groupByPosition: true, bracketBasicIds: $brackets, maxTime: 0) {
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

export interface StratzGameVersion {
  id: number;
  name: string;
  // Unix seconds the patch went live.
  releasedAt: number;
}

/** The patch that's live right now: the newest STRATZ game version already released. */
export function getCurrentGameVersion() {
  return cached(`stratz:current-game-version`, HOUR, async () => {
    const data = await graphql<{
      constants: { gameVersions: { id: number; name: string; asOfDateTime: number }[] | null };
    }>(`query GameVersions { constants { gameVersions { id name asOfDateTime } } }`);
    const nowSeconds = Date.now() / 1000;
    const live = (data.constants.gameVersions ?? [])
      .filter((v) => v.asOfDateTime <= nowSeconds)
      .sort((a, b) => b.asOfDateTime - a.asOfDateTime)[0];
    if (!live) {
      throw new StratzError("STRATZ не вернул список патчей");
    }
    return { id: live.id, name: live.name, releasedAt: live.asOfDateTime } satisfies StratzGameVersion;
  });
}

export interface PatchHeroStats {
  patch: StratzGameVersion;
  // Unix seconds the counted games start from (a STRATZ week boundary).
  since: number;
  // The patch is younger than its release week: the only bucket holding its
  // games also holds the last days of the previous patch.
  includesPreviousPatch: boolean;
  // Summed over every counted week, one row per hero and position.
  stats: StratzHeroPositionStat[];
}

// STRATZ buckets `stats` by week: weeks start Thursday 00:00 UTC (unix epoch
// aligned), the `week` argument is that start in unix seconds.
const WEEK_SECONDS = 7 * 24 * 60 * 60;
// Passing all ~127 hero IDs in a single `stats` call makes STRATZ's resolver
// fail outright ("Error trying to resolve field 'stats'").
const HERO_STATS_BATCH_SIZE = 20;
// Weeks fetched as aliased `stats` fields of one query (16 answered in <1 s).
const WEEKS_PER_REQUEST = 8;

/**
 * Per-position pick/win totals for every hero on the patch that's live now -
 * powers the Meta page. STRATZ's own per-patch aggregate (`winGameVersion`)
 * stopped updating at 7.40, so this sums the weekly `stats` buckets instead:
 * every week that started after the release. The release week is mixed with
 * the previous patch and only used while there is no other.
 */
export async function getPatchHeroStats(heroIds: number[]): Promise<PatchHeroStats> {
  const patch = await getCurrentGameVersion();
  const currentWeek = Math.floor(Date.now() / 1000 / WEEK_SECONDS);
  const firstCleanWeek = Math.ceil(patch.releasedAt / WEEK_SECONDS);
  const includesPreviousPatch = firstCleanWeek > currentWeek;
  const firstWeek = includesPreviousPatch ? currentWeek : firstCleanWeek;

  const stats = await cached(
    `stratz:patch-hero-positions:${patch.id}:${firstWeek}-${currentWeek}`,
    6 * HOUR,
    async () => {
      const weekStarts: number[] = [];
      for (let week = firstWeek; week <= currentWeek; week++) weekStarts.push(week * WEEK_SECONDS);

      const totals = new Map<string, StratzHeroPositionStat>();
      for (let i = 0; i < heroIds.length; i += HERO_STATS_BATCH_SIZE) {
        const batch = heroIds.slice(i, i + HERO_STATS_BATCH_SIZE);
        for (let j = 0; j < weekStarts.length; j += WEEKS_PER_REQUEST) {
          const fields = weekStarts
            .slice(j, j + WEEKS_PER_REQUEST)
            .map(
              (start) =>
                `w${start}: stats(heroIds: $heroIds, groupByPosition: true, bracketBasicIds: $brackets, maxTime: 0, week: ${start}) {
                  heroId
                  position
                  matchCount
                  winCount
                }`
            )
            .join("\n");
          const data = await graphql<{ heroStats: Record<string, StratzHeroPositionStat[] | null> }>(
            `query PatchHeroPositionStats($heroIds: [Short], $brackets: [RankBracketBasicEnum]) {
              heroStats { ${fields} }
            }`,
            { heroIds: batch, brackets: META_BRACKETS }
          );
          for (const rows of Object.values(data.heroStats)) {
            for (const row of rows ?? []) {
              if (!row.position) continue;
              const key = `${row.heroId}:${row.position}`;
              const total = totals.get(key);
              if (total) {
                total.matchCount += row.matchCount;
                total.winCount += row.winCount;
              } else {
                totals.set(key, { ...row });
              }
            }
          }
        }
      }
      return [...totals.values()];
    }
  );

  return { patch, since: firstWeek * WEEK_SECONDS, includesPreviousPatch, stats };
}

// One high-MMR game on the hero, as STRATZ parsed it from the replay.
export interface StratzReplayGame {
  matchId: number;
  gameVersionId: number;
  won: boolean;
  durationSeconds: number;
  position: string | null;
  // Abilities and talents, in the order they were learned.
  abilityIds: number[];
  // Every finished item bought, with the second it was bought at.
  purchases: { time: number; itemId: number }[];
  enemyHeroIds: number[];
}

interface StratzReplayPlayer {
  heroId: number;
  isRadiant: boolean;
  isVictory: boolean;
  position: string | null;
  steamAccountId: number | null;
  abilities: { abilityId: number }[] | null;
  stats: { itemPurchases: { time: number; itemId: number }[] | null } | null;
}

// STRATZ answers `match` with whole replays; more at once trips its query
// complexity limit.
const REPLAYS_PER_REQUEST = 10;

/**
 * The newest high-MMR (Divine/Immortal) games on this hero in this position
 * that STRATZ parsed - the games its own "guides" are built from. STRATZ
 * only hands out the latest 10; the caller keeps the ones it has seen.
 * Item purchases come from the player's stats (finished items with their
 * second), which unlike playback data don't need a replay rebuild.
 */
export function getHeroHighMmrReplays(heroId: number, position: string) {
  return cached(`stratz:hero-replays:${heroId}:${position}`, 3 * HOUR, async () => {
    const list = await graphql<{
      heroStats: { guide: { guides: { matchId: number; steamAccountId: number }[] | null }[] | null };
    }>(
      `query HeroGuideGames($heroId: Short!, $position: MatchPlayerPositionType) {
        heroStats { guide(heroId: $heroId, positionId: $position, take: 10) { guides { matchId steamAccountId } } }
      }`,
      { heroId, position }
    );
    const guides = (list.heroStats.guide ?? []).flatMap((g) => g.guides ?? []);
    const games: StratzReplayGame[] = [];
    for (let i = 0; i < guides.length; i += REPLAYS_PER_REQUEST) {
      const batch = guides.slice(i, i + REPLAYS_PER_REQUEST);
      const fields = batch
        .map(
          (g, n) => `m${n}: match(id: ${Math.trunc(g.matchId)}) {
            id gameVersionId durationSeconds
            players { heroId isRadiant isVictory position steamAccountId abilities { abilityId } stats { itemPurchases { time itemId } } }
          }`
        )
        .join("\n");
      const data = await graphql<Record<string, { id: number; gameVersionId: number; durationSeconds: number; players: StratzReplayPlayer[] } | null>>(
        `{ ${fields} }`
      );
      batch.forEach((g, n) => {
        const match = data[`m${n}`];
        const me = match?.players.find((p) => p.steamAccountId === g.steamAccountId) ?? match?.players.find((p) => p.heroId === heroId);
        const purchases = me?.stats?.itemPurchases ?? [];
        if (!match || !me || me.heroId !== heroId || purchases.length === 0) return;
        games.push({
          matchId: match.id,
          gameVersionId: match.gameVersionId,
          won: me.isVictory,
          durationSeconds: match.durationSeconds,
          position: me.position,
          abilityIds: (me.abilities ?? []).map((a) => a.abilityId),
          purchases: [...purchases].sort((a, b) => a.time - b.time),
          enemyHeroIds: match.players.filter((p) => p.isRadiant !== me.isRadiant).map((p) => p.heroId),
        });
      });
    }
    return games;
  });
}

// The hero level an ability reached its last level at, one row per ability and level.
export interface StratzAbilityMaxLevel {
  abilityId: number;
  level: number;
  matchCount: number;
  winCount: number;
}

// Games that lasted at least `time` minutes and the wins among them, one row
// per minute up to 35 (time 0 is every game).
export interface StratzGameMinuteStat {
  time: number;
  matchCount: number;
  winCount: number;
}

export interface StratzHeroBuild {
  startingItems: StratzItemStat[];
  fullPurchases: StratzItemStat[];
  boots: StratzBootStat[];
  neutralItems: StratzNeutralItemStat[];
  talents: StratzTalentStat[];
  abilityMaxLevels: StratzAbilityMaxLevel[];
  gameMinutes: StratzGameMinuteStat[];
}

/**
 * Current-week item/talent build data for a hero at one position - the same
 * "last 7-8 days" window D2PT itself uses - plus when each ability gets maxed
 * and how the role's win rate moves with game length. Same Legend+ brackets
 * as the role stats, so item counts and game counts describe the same games.
 */
export function getHeroBuild(heroId: number, position: string) {
  return cached(`stratz:hero-build:${heroId}:${position}:v3`, 6 * HOUR, async () => {
    const data = await graphql<{ heroStats: StratzHeroBuild }>(
      `query HeroBuild($heroId: Short!, $positions: [MatchPlayerPositionType], $brackets: [RankBracketBasicEnum]) {
        heroStats {
          startingItems: itemStartingPurchase(heroId: $heroId, positionIds: $positions, bracketBasicIds: $brackets) {
            itemId
            instance
            wasGiven
            matchCount
            winCount
          }
          fullPurchases: itemFullPurchase(heroId: $heroId, positionIds: $positions, bracketBasicIds: $brackets) {
            itemId
            instance
            time
            matchCount
            winCount
          }
          boots: itemBootPurchase(heroId: $heroId, positionIds: $positions, bracketBasicIds: $brackets) {
            itemId
            instance
            timeAverage
            matchCount
            winCount
          }
          neutralItems: itemNeutral(heroId: $heroId, positionIds: $positions, bracketBasicIds: $brackets) {
            itemId
            matchCount
            winCount
            equippedMatchCount
            equippedMatchWinCount
          }
          talents: talent(heroId: $heroId, positionIds: $positions, bracketBasicIds: $brackets) {
            abilityId
            matchCount
            winCount
          }
          abilityMaxLevels: abilityMaxLevel(heroId: $heroId, positionIds: $positions, bracketBasicIds: $brackets) {
            abilityId
            level
            matchCount
            winCount
          }
          gameMinutes: stats(heroIds: [$heroId], positionIds: $positions, bracketBasicIds: $brackets, groupByTime: true) {
            time
            matchCount
            winCount
          }
        }
      }`,
      { heroId, positions: [position], brackets: META_BRACKETS }
    );
    // STRATZ returns null (not []) for a field when a hero+position combo
    // has no real data at all (e.g. an off-meta position for that hero) -
    // normalize here, at the boundary, so every caller can trust these are
    // real arrays instead of each needing its own null guard.
    return {
      startingItems: data.heroStats.startingItems ?? [],
      fullPurchases: data.heroStats.fullPurchases ?? [],
      boots: data.heroStats.boots ?? [],
      neutralItems: data.heroStats.neutralItems ?? [],
      talents: data.heroStats.talents ?? [],
      abilityMaxLevels: data.heroStats.abilityMaxLevels ?? [],
      gameMinutes: data.heroStats.gameMinutes ?? [],
    };
  });
}
