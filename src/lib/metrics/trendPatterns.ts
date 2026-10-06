import { getHeroInternalName, getHeroName } from "../constants";
import { formatMatchTime } from "../format";
import { inFamily, leftTheGame } from "./gameContext";
import { resolveAllPositions } from "./matchPositions";
import type { CrossMatchPatterns, LaneTally, OpenDotaMatch, OpenDotaMatchPlayer } from "../types";

// Bounded independent of whatever "last N matches" list the caller is
// showing - fetching full match detail (and, for lane comparisons, real
// gold_t/xp_t/lane data) for every recent match would be slow, so the deep
// cross-match analysis always looks at at most this many, newest first.
const MAX_DEEP_SAMPLE = 10;
// The same hero killing you across two different games is a pattern; eight
// times in one game is that one game.
const MIN_RECURRING_KILLER_GAMES = 2;

function emptyTally(): LaneTally {
  return { ahead: 0, behind: 0, tied: 0, sampledGames: 0 };
}

// Ahead/behind with the same 7% band the single-match phase verdicts use, so
// "even" means the same thing in both reports.
function tally(t: LaneTally, yours: number | undefined, theirs: number | undefined, minGap: number) {
  if (yours === undefined || theirs === undefined) return;
  t.sampledGames++;
  const band = Math.max(minGap, 0.07 * theirs);
  if (yours - theirs > band) t.ahead++;
  else if (theirs - yours > band) t.behind++;
  else t.tied++;
}

interface DeathAt {
  time: number;
  killerHeroId: number | null;
}

// deaths_log names the killing unit; older parses lack it, and then every
// enemy's kills_log entry naming this hero is a death too.
function deathsOf(match: OpenDotaMatch, you: OpenDotaMatchPlayer): DeathAt[] {
  const heroOfKey = (key: string) => match.players.find((p) => getHeroInternalName(p.hero_id) === key)?.hero_id ?? null;
  if (you.deaths_log && you.deaths_log.length > 0) {
    return you.deaths_log.map((d) => ({ time: d.time, killerHeroId: heroOfKey(d.key) }));
  }
  const key = getHeroInternalName(you.hero_id);
  return match.players.flatMap((p) =>
    (p.kills_log ?? []).filter((k) => k.key === key).map((k) => ({ time: k.time, killerHeroId: p.hero_id }))
  );
}

function inAFight(match: OpenDotaMatch, youIndex: number, time: number): boolean {
  return (match.teamfights ?? []).some(
    (f) => time >= f.start - 15 && time <= f.end + 15 && (f.players[youIndex]?.deaths ?? 0) > 0
  );
}

/**
 * Real recurring patterns across this player's own recent matches - not one
 * game's story, but what keeps happening: dying early, dying alone, the same
 * hero catching them game after game, falling behind the enemy on the same
 * position in lane. Only fully parsed games of the comparable kind (all
 * Turbo or all normal, none the player left) count; unparsed ones simply
 * contribute nothing rather than being guessed at or auto-parsed (parsing 10
 * replays serially would be far too slow for a report the player is
 * actively waiting on).
 */
export function computeCrossMatchPatterns(
  accountId: number,
  matches: OpenDotaMatch[],
  turbo: boolean
): CrossMatchPatterns {
  const laneEnd = turbo ? 420 : 600;
  const laneMinute = laneEnd / 60;
  const positions: Record<number, number> = {};
  const deaths = { total: 0, beforeLaneEnd: 0, outsideFights: 0, gamesWithRoughLane: 0 };
  const killers = new Map<number, { deaths: number; games: Set<number> }>();
  const laneNetWorth = emptyTally();
  const laneLastHits = emptyTally();
  let parsedGamesSampled = 0;

  for (const match of matches.slice(0, MAX_DEEP_SAMPLE)) {
    const you = match.players.find((p) => p.account_id === accountId);
    if (!you || !Array.isArray(match.radiant_gold_adv) || !you.networth_t?.length) continue;
    if (!inFamily(match.game_mode, turbo) || leftTheGame(you.leaver_status)) continue;
    parsedGamesSampled++;

    const resolved = resolveAllPositions(match, null);
    const position = resolved.bySlot.get(you.player_slot);
    if (position) positions[position] = (positions[position] ?? 0) + 1;

    const youIndex = match.players.indexOf(you);
    const own = deathsOf(match, you);
    const early = own.filter((d) => d.time < laneEnd).length;
    deaths.total += own.length;
    deaths.beforeLaneEnd += early;
    deaths.outsideFights += own.filter((d) => !inAFight(match, youIndex, d.time)).length;
    if (early >= 2) deaths.gamesWithRoughLane++;
    for (const d of own) {
      if (d.killerHeroId === null) continue;
      const entry = killers.get(d.killerHeroId) ?? { deaths: 0, games: new Set<number>() };
      entry.deaths++;
      entry.games.add(match.match_id);
      killers.set(d.killerHeroId, entry);
    }

    // The enemy on the same position - never just whoever shared the lane
    // (for a carry that's usually the enemy offlaner or a support).
    const counterpart = match.players.find(
      (p) => p.isRadiant !== you.isRadiant && position !== undefined && resolved.bySlot.get(p.player_slot) === position
    );
    if (counterpart && position !== undefined) {
      tally(laneNetWorth, you.networth_t?.[laneMinute], counterpart.networth_t?.[laneMinute], position <= 3 ? 300 : 250);
      if (position <= 3) tally(laneLastHits, you.lh_t?.[laneMinute], counterpart.lh_t?.[laneMinute], 4);
    }
  }

  const recurringKillers = [...killers.entries()]
    .filter(([, v]) => v.games.size >= MIN_RECURRING_KILLER_GAMES)
    .sort((a, b) => b[1].games.size - a[1].games.size || b[1].deaths - a[1].deaths)
    .slice(0, 5)
    .map(([heroId, v]) => ({ killerHeroName: getHeroName(heroId), deaths: v.deaths, games: v.games.size }));

  return {
    parsedGamesSampled,
    positions,
    laneEndLabel: formatMatchTime(laneEnd),
    deaths,
    recurringKillers,
    laneNetWorth,
    laneLastHits,
  };
}
