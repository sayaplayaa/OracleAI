// Battle pass progress, kept on the server: points and rewards are worth real
// items, so they can't live in the player's browser where anyone could edit
// them. A JSON file is enough for one server; swap these two functions for a
// database when the app runs on more than one.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChallengeDifficulty, PassChallengeType, PointsEvent } from "./types";

export interface ChallengeRecord {
  id: string;
  type: PassChallengeType;
  week: number;
  // ms - only games that started after this count.
  issuedAt: number;
  difficulty: ChallengeDifficulty;
  points: number;
  // The bar a game has to clear (deaths below, KDA above, GPM at least...).
  target: number;
  // How many games (or reviews) have to clear it.
  required: number;
  // The player's own recent average the target was set from.
  baseline?: number;
  heroId?: number;
  heroName?: string;
  turbo: boolean;
  matchIds: number[];
  completedAt?: number;
}

export interface ClaimRecord {
  level: number;
  requestedAt: number;
  status: "pending" | "sent";
  tradeUrl?: string;
  choice?: string;
}

export interface PlayerSeason {
  accountId: number;
  seasonId: string;
  points: number;
  passOwned: boolean;
  passSince?: number;
  challenges: ChallengeRecord[];
  claims: ClaimRecord[];
  // The player's own games analysed by the AI coach (for review challenges).
  reviews: { matchId: number; at: number }[];
  history: PointsEvent[];
}

interface StoreFile {
  version: 1;
  players: Record<string, PlayerSeason>;
}

const FILE = process.env.BATTLE_PASS_STORE || path.join(process.cwd(), ".data", "battle-pass.json");

// Every route is bundled on its own, so the write queue lives on globalThis
// to be one queue per process: two requests never read-modify-write at once.
const shared = globalThis as unknown as { __battlePassQueue?: Promise<unknown> };

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = (shared.__battlePassQueue ?? Promise.resolve()).then(task, task);
  shared.__battlePassQueue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<StoreFile> {
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as StoreFile;
    return parsed?.version === 1 && parsed.players ? parsed : { version: 1, players: {} };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, players: {} };
    throw err;
  }
}

// Written to a temp file first and renamed: a crash mid-write never leaves a
// half-written store behind.
async function save(data: StoreFile): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, FILE);
}

function emptySeason(accountId: number, seasonId: string): PlayerSeason {
  return { accountId, seasonId, points: 0, passOwned: false, challenges: [], claims: [], reviews: [], history: [] };
}

/** Reads, changes and saves one player's season in one step. */
export function updatePlayer<T>(
  accountId: number,
  seasonId: string,
  change: (player: PlayerSeason) => T | Promise<T>
): Promise<{ player: PlayerSeason; result: T }> {
  return serialized(async () => {
    const data = await load();
    const key = `${seasonId}:${accountId}`;
    const player = data.players[key] ?? emptySeason(accountId, seasonId);
    const result = await change(player);
    data.players[key] = player;
    await save(data);
    return { player, result };
  });
}
