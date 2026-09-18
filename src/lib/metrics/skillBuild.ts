import { xp_level as xpLevel } from "dotaconstants";
import { getAbilityNameById } from "../constants";
import { getHeroAbilityKit } from "../heroAbilities";
import type { OpenDotaMatchPlayer, SkillBuildEntry } from "../types";

const TALENT_LEVELS = new Set([10, 15, 20, 25]);
const XP_THRESHOLDS = xpLevel as number[]; // XP_THRESHOLDS[i] = cumulative XP to reach level i+1
const BUCKET_SECONDS = 60; // OpenDota's gold_t/xp_t/lh_t are always 60s apart, starting at 0

/** The real hero level a given (0-based) non-talent skill-point index landed on. */
function levelForSkillIndex(index: number): number {
  let level = 0;
  let consumed = -1;
  while (consumed < index) {
    level++;
    if (!TALENT_LEVELS.has(level)) consumed++;
  }
  return level;
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
 * A real per-match skill build: the hero's own ability_upgrades_arr (talent
 * levels excluded, so index-to-level needs the same skip pattern) mapped to
 * real ability names/icons, with an interpolated - not logged - timestamp
 * from the player's real xp_t series against dotaconstants' official
 * xp_level thresholds.
 */
export function computeSkillBuild(
  player: OpenDotaMatchPlayer,
  heroId: number
): SkillBuildEntry[] {
  const upgrades = player.ability_upgrades_arr ?? [];
  if (upgrades.length === 0) return [];

  const abilityKit = new Map(getHeroAbilityKit(heroId).map((a) => [a.key, a]));
  const xpSeries = player.xp_t ?? [];

  return upgrades.map((abilityId, index) => {
    const level = levelForSkillIndex(index);
    const internalName = getAbilityNameById(abilityId);
    const kitEntry = internalName ? abilityKit.get(internalName) : undefined;

    const targetXp = XP_THRESHOLDS[level - 1] ?? null;
    const approxTimeSeconds = targetXp !== null ? interpolateTime(xpSeries, targetXp) : null;

    return {
      level,
      abilityKey: internalName ?? `ability_${abilityId}`,
      abilityName: kitEntry?.name ?? internalName ?? `Ability ${abilityId}`,
      iconUrl: kitEntry?.iconUrl ?? "",
      approxTimeSeconds,
    };
  });
}
