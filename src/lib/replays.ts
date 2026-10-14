// Real games on a hero, parsed from their replays, for build analysis: what
// was bought and when, the order abilities were learned in, and who the
// enemies were. Two sources, both from the current patch only:
//   - professional games (OpenDota's parsed league matches), every position,
//     the position worked out from lanes and farm;
//   - the newest Divine/Immortal games in the exact position (STRATZ). STRATZ
//     only hands out the latest 10, so the ones already seen are kept on disk
//     and the sample grows every time the page refreshes its data.

import { promises as fs } from "node:fs";
import path from "node:path";
import { getAbilityNameById, getItemKeyById } from "./constants";
import { getHeroProReplays } from "./opendota";
import { getCurrentGameVersion, getHeroHighMmrReplays, type StratzReplayGame } from "./stratz";
import type { OpenDotaProReplayRow } from "./types";

export interface ReplayGame {
  source: "pro" | "highMmr";
  matchId: number;
  won: boolean;
  durationSeconds: number;
  // Item key and the second it was bought at, in order. Components and
  // finished items alike (finished ones are what the analysis reads).
  purchases: { itemKey: string; time: number }[];
  // Ability and talent keys in the order they were learned (index = level - 1).
  skills: string[];
  enemies: number[];
}

// OpenDota's lane_role: 1 safe lane, 2 mid, 3 off lane.
const CORE_POSITION_BY_LANE: Record<number, string> = { 1: "POSITION_1", 2: "POSITION_2", 3: "POSITION_3" };

/**
 * Which position a pro player had: the three richest of the team are the
 * cores - safe lane 1, mid 2, off lane 3 - the two poorest the supports, the
 * one in the safe lane 5 and the off lane one 4. Ties fall back to farm.
 */
export function inferProPosition(row: OpenDotaProReplayRow): string | null {
  const radiant = row.player_slot < 128;
  const team = (row.players ?? []).filter((p) => p.slot < 128 === radiant);
  if (team.length !== 5 || team.some((p) => p.gpm === null)) return null;
  const byFarm = [...team].sort((a, b) => (b.gpm ?? 0) - (a.gpm ?? 0));
  const cores = byFarm.slice(0, 3);
  const supports = byFarm.slice(3);
  const me = team.find((p) => p.slot === row.player_slot);
  if (!me) return null;

  if (cores.includes(me)) {
    const assigned = new Map<number, string>();
    const free = ["POSITION_1", "POSITION_2", "POSITION_3"];
    for (const core of cores) {
      const position = core.lane !== null ? CORE_POSITION_BY_LANE[core.lane] : undefined;
      if (position && free.includes(position) && cores.filter((c) => c.lane === core.lane).length === 1) {
        assigned.set(core.slot, position);
        free.splice(free.indexOf(position), 1);
      }
    }
    for (const core of cores) if (!assigned.has(core.slot)) assigned.set(core.slot, free.shift()!);
    return assigned.get(me.slot) ?? null;
  }
  const [richer, poorer] = supports;
  if (richer.lane !== poorer.lane && (me.lane === 1 || me.lane === 3)) return me.lane === 1 ? "POSITION_5" : "POSITION_4";
  return me === richer ? "POSITION_4" : "POSITION_5";
}

function fromPro(row: OpenDotaProReplayRow): ReplayGame | null {
  const radiant = row.player_slot < 128;
  const purchases = (row.purchase_log ?? []).filter((p) => p.key).map((p) => ({ itemKey: p.key, time: p.time }));
  if (purchases.length === 0) return null;
  return {
    source: "pro",
    matchId: row.match_id,
    won: row.radiant_win === radiant,
    durationSeconds: row.duration,
    purchases: purchases.sort((a, b) => a.time - b.time),
    skills: (row.ability_upgrades_arr ?? []).flatMap((id) => getAbilityNameById(id) ?? []),
    enemies: (row.players ?? []).filter((p) => p.slot < 128 !== radiant).map((p) => p.hero),
  };
}

function fromStratz(game: StratzReplayGame): ReplayGame {
  return {
    source: "highMmr",
    matchId: game.matchId,
    won: game.won,
    durationSeconds: game.durationSeconds,
    purchases: game.purchases.flatMap((p) => {
      const itemKey = getItemKeyById(p.itemId);
      return itemKey ? [{ itemKey, time: p.time }] : [];
    }),
    skills: game.abilityIds.flatMap((id) => getAbilityNameById(id) ?? []),
    enemies: game.enemyHeroIds,
  };
}

// ---- High-MMR games kept on disk ----

const STORE_DIR = path.join(process.cwd(), ".data", "replays");
// Enough for stable shares; the newest win.
const MAX_STORED_GAMES = 200;

interface StoredGames {
  gameVersionId: number;
  games: StratzReplayGame[];
}

// One write at a time per file, across the route bundles of one process.
const writes = ((globalThis as { __replayWrites?: Map<string, Promise<void>> }).__replayWrites ??= new Map());

async function readStored(file: string): Promise<StoredGames | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as StoredGames;
  } catch {
    return null;
  }
}

/** The latest high-MMR games merged into the ones seen before, same patch only. */
async function rememberHighMmrGames(heroId: number, position: string, gameVersionId: number, fresh: StratzReplayGame[]) {
  const file = path.join(STORE_DIR, `${heroId}-${position}.json`);
  const run = async () => {
    const stored = await readStored(file);
    const known = stored?.gameVersionId === gameVersionId ? stored.games : [];
    const byId = new Map(known.map((g) => [g.matchId, g]));
    for (const g of fresh) if (g.gameVersionId === gameVersionId) byId.set(g.matchId, g);
    const games = [...byId.values()].sort((a, b) => b.matchId - a.matchId).slice(0, MAX_STORED_GAMES);
    await fs.mkdir(STORE_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ gameVersionId, games } satisfies StoredGames));
    await fs.rename(tmp, file);
    return games;
  };
  const previous = writes.get(file) ?? Promise.resolve();
  let result: StratzReplayGame[] = [];
  const next = previous.then(async () => {
    result = await run();
  });
  writes.set(file, next.catch(() => undefined));
  await next;
  return result;
}

/**
 * Parsed games on the hero in this position from the current patch: pro
 * games whose position matches and the high-MMR games collected so far.
 * Either source failing just leaves it out.
 */
export async function getHeroReplays(heroId: number, position: string): Promise<ReplayGame[]> {
  const patch = await getCurrentGameVersion();
  const [proRows, highMmr] = await Promise.all([
    getHeroProReplays(heroId, patch.releasedAt).catch(() => [] as OpenDotaProReplayRow[]),
    getHeroHighMmrReplays(heroId, position)
      // A disk that can't be written to still leaves the latest games.
      .then((fresh) => rememberHighMmrGames(heroId, position, patch.id, fresh).catch(() => fresh))
      .catch(() => [] as StratzReplayGame[]),
  ]);
  const pro = proRows.filter((row) => inferProPosition(row) === position).flatMap((row) => fromPro(row) ?? []);
  const seen = new Set(pro.map((g) => g.matchId));
  return [...pro, ...highMmr.filter((g) => !seen.has(g.matchId)).map(fromStratz)];
}
