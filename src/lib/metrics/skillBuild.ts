import { xp_level as xpLevel } from "dotaconstants";
import { getAbilityNameById } from "../constants";
import { getHeroAbilityKit } from "../heroAbilities";
import { getTalentLabel, isTalentKey } from "../talents";
import type { OpenDotaMatchPlayer, SkillBuildEntry } from "../types";

// Talent picks (the special_bonus_* choices at levels 10/15/20/25) DO appear
// as their own entries in a real ability_upgrades_arr - verified against a
// real parsed match, where treating them as absent (as an earlier version of
// this function did) inflated the level count past the player's real final
// level. Detected by name, not by position, since position alone can't tell
// a talent entry apart from a regular one.
const TALENT_LEVELS = [10, 15, 20, 25];
const XP_THRESHOLDS = xpLevel as number[]; // XP_THRESHOLDS[i] = cumulative XP to reach level i+1
const BUCKET_SECONDS = 60; // OpenDota's gold_t/xp_t/lh_t are always 60s apart, starting at 0

/**
 * The real hero levels for a player's ability_upgrades_arr, in order. A
 * talent entry always lands on the next unclaimed talent level (10/15/20/25 -
 * that slot can only ever be a talent choice); a regular entry takes the next
 * level that isn't reserved for one. Points aren't always spent the instant
 * they're earned, so this is still an approximation when a point was banked -
 * clamped to the player's real final level so it can never assert one they
 * never reached.
 */
function levelsForSkillIndices(names: (string | null)[], maxLevel: number): number[] {
  const levels: number[] = [];
  let level = 0;
  let talentPtr = 0;
  for (const name of names) {
    level++;
    if (isTalentKey(name)) {
      while (talentPtr < TALENT_LEVELS.length && TALENT_LEVELS[talentPtr] < level) talentPtr++;
      level = TALENT_LEVELS[talentPtr] ?? level;
      talentPtr++;
    } else {
      while (TALENT_LEVELS.includes(level)) level++;
    }
    levels.push(Math.min(level, maxLevel));
  }
  return levels;
}

/** Interpolates when a real xp_t series first reaches a target cumulative XP. */
function interpolateTime(xpSeries: number[], targetXp: number): number | null {
  if (xpSeries.length === 0) return null;
  if (xpSeries[0] >= targetXp) return 0;

  for (let i = 1; i < xpSeries.length; i++) {
    if (xpSeries[i] >= targetXp) {
      const prevXp = xpSeries[i - 1];
      const span = xpSeries[i] - prevXp;
      const fraction = span > 0 ? (targetXp - prevXp) / span : 0;
      return Math.round(((i - 1) + fraction) * BUCKET_SECONDS);
    }
  }
  return null; // never reached this level in the recorded series
}

/**
 * A real per-match skill build: the hero's own ability_upgrades_arr mapped to
 * real ability names/icons/ranks, with an interpolated - not logged -
 * timestamp from the player's real xp_t series against dotaconstants'
 * official xp_level thresholds.
 */
export function computeSkillBuild(
  player: OpenDotaMatchPlayer,
  heroId: number
): SkillBuildEntry[] {
  const upgrades = player.ability_upgrades_arr ?? [];
  if (upgrades.length === 0) return [];

  const abilityKit = new Map(getHeroAbilityKit(heroId).map((a) => [a.key, a]));
  const xpSeries = player.xp_t ?? [];

  const internalNames = upgrades.map((id) => getAbilityNameById(id));
  const levels = levelsForSkillIndices(internalNames, player.level);
  const rankSoFar = new Map<string, number>();

  return upgrades.map((abilityId, index) => {
    const level = levels[index];
    const internalName = internalNames[index];
    const kitEntry = internalName ? abilityKit.get(internalName) : undefined;
    const rank = internalName ? (rankSoFar.get(internalName) ?? 0) + 1 : 1;
    if (internalName) rankSoFar.set(internalName, rank);

    const targetXp = XP_THRESHOLDS[level - 1] ?? null;
    const approxTimeSeconds = targetXp !== null ? interpolateTime(xpSeries, targetXp) : null;

    return {
      level,
      abilityKey: internalName ?? `ability_${abilityId}`,
      abilityName: isTalentKey(internalName)
        ? `Талант: ${getTalentLabel(internalName!)}`
        : kitEntry?.name ?? internalName ?? `Способность ${abilityId}`,
      iconUrl: kitEntry?.iconUrl ?? "",
      rank,
      approxTimeSeconds,
    };
  });
}
