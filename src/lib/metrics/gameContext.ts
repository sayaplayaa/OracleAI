import { getHeroName } from "../constants";
import { formatMatchTime } from "../format";
import type {
  GameContext,
  MatchLeaver,
  OpenDotaMatch,
  OpenDotaMatchPlayer,
  OpenDotaRecentMatch,
  TrendMatchSummary,
} from "../types";

export const TURBO_GAME_MODE = 23;

// 1v1 mid, event and other non-5v5 modes: positions, phases and counterparts
// don't mean anything there, so the coach doesn't analyse them.
const UNANALYSABLE_MODES = new Set([7, 9, 10, 11, 15, 19, 20, 21]);

// Game modes whose numbers can be averaged with each other. Turbo is its own
// family (its economy roughly doubles income), everything else here is a
// normal 5v5 game.
const STANDARD_MODES = new Set([0, 1, 2, 3, 4, 5, 8, 12, 13, 16, 17, 18, 22]);

export function isTurbo(gameMode: number): boolean {
  return gameMode === TURBO_GAME_MODE;
}

export function isAnalysableMode(gameMode: number): boolean {
  return !UNANALYSABLE_MODES.has(gameMode);
}

/** A short label for game lists when the mode changes how a game reads. */
export function modeTag(gameMode: number): string | null {
  if (isTurbo(gameMode)) return "Turbo";
  if (!isAnalysableMode(gameMode)) return "Особый режим";
  return null;
}

// leaver_status: 0 stayed, 1 disconnected but came back, 2+ left for good
// (disconnected too long, abandoned, AFK, never connected).
export function leftTheGame(leaverStatus: number | null | undefined): boolean {
  return typeof leaverStatus === "number" && leaverStatus >= 2;
}

// The last disconnect that wasn't followed by a reconnect.
function leaveTime(player: OpenDotaMatchPlayer): number | null {
  const log = [...(player.connection_log ?? [])].sort((a, b) => a.time - b.time);
  let lastDisconnect: number | null = null;
  for (const entry of log) {
    if (entry.event === "disconnect") lastDisconnect = entry.time;
    else if (entry.event === "reconnect") lastDisconnect = null;
  }
  return lastDisconnect !== null ? Math.max(0, lastDisconnect) : null;
}

function at(time: number | null): string {
  return time !== null ? ` в ${formatMatchTime(time)}` : "";
}

/**
 * Turbo and players who left - both change what the numbers mean, so the
 * analysis adapts to them and the player is told up front. A teammate who
 * left explains a loss far better than any personal stat could; a counterpart
 * who left makes every later comparison with them meaningless.
 */
export function buildGameContext(
  match: OpenDotaMatch,
  you: OpenDotaMatchPlayer,
  counterpart: OpenDotaMatchPlayer | null,
  phaseBounds: { laneEnd: number; midEnd: number }
): GameContext {
  const turbo = isTurbo(match.game_mode);
  const leavers: MatchLeaver[] = match.players
    .filter((p) => leftTheGame(p.leaver_status))
    .map((p) => ({
      heroId: p.hero_id,
      heroName: getHeroName(p.hero_id),
      yourTeam: p.isRadiant === you.isRadiant,
      isYou: p === you,
      isCounterpart: p === counterpart,
      time: leaveTime(p),
    }))
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));

  const notes: string[] = [];
  if (turbo) {
    notes.push(
      `Это Turbo: золото и опыт приходят быстрее, а игра короче, поэтому фазы сдвинуты (линия - до ${formatMatchTime(phaseBounds.laneEnd)}, мидгейм - до ${formatMatchTime(phaseBounds.midEnd)}), а сравнения с перцентилями и метовыми таймингами обычных игр не показываются - только с соперником в этой же игре.`
    );
  }
  for (const l of leavers) {
    if (l.isYou) {
      notes.push(`Ты покинул игру${at(l.time)} - разбор охватывает только время до этого момента.`);
    } else if (l.yourTeam) {
      notes.push(
        `${l.heroName} из твоей команды покинул игру${at(l.time)} - дальше вы играли вчетвером. Итог матча и отставание команды после этого момента - не повод винить себя; смотри на свои решения.`
      );
    } else if (l.isCounterpart) {
      notes.push(
        `${l.heroName}, соперник на твоей позиции, покинул игру${at(l.time)} - поэтому сравнения с ним после этого момента нет.`
      );
    } else {
      notes.push(`${l.heroName} из вражеской команды покинул игру${at(l.time)} - дальше враг играл вчетвером.`);
    }
  }
  return { turbo, leavers, notes };
}

export interface ComparableGames<T> {
  games: T[];
  turbo: boolean;
  // Games left out of the averages, and why.
  excludedOtherMode: number;
  excludedLeft: number;
}

interface GameKind {
  gameMode: number;
  left: boolean;
}

export const kindOfMatch = (m: OpenDotaRecentMatch): GameKind => ({
  gameMode: m.game_mode,
  left: leftTheGame(m.leaver_status),
});

export const kindOfSummary = (m: TrendMatchSummary): GameKind => ({ gameMode: m.gameMode, left: m.leftGame });

/** Whether a game belongs to the Turbo or the normal-game family. */
export function inFamily(gameMode: number, turbo: boolean): boolean {
  return turbo ? isTurbo(gameMode) : STANDARD_MODES.has(gameMode);
}

/**
 * The games whose numbers can honestly be averaged together: the player's
 * main kind of game (Turbo or normal, whichever they played more of), minus
 * games they left. Mixing Turbo's doubled income into normal-game averages
 * makes every stat and every challenge target wrong.
 */
export function comparableGames<T>(matches: T[], kind: (m: T) => GameKind): ComparableGames<T> {
  const kinds = matches.map(kind);
  const turboCount = kinds.filter((k) => isTurbo(k.gameMode)).length;
  const standardCount = kinds.filter((k) => STANDARD_MODES.has(k.gameMode)).length;
  const turbo = turboCount > standardCount;
  const sameFamily = matches.filter((_, i) => inFamily(kinds[i].gameMode, turbo));
  const games = sameFamily.filter((m) => !kind(m).left);
  return {
    games,
    turbo,
    excludedOtherMode: matches.length - sameFamily.length,
    excludedLeft: sameFamily.length - games.length,
  };
}
