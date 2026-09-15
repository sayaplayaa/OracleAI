import {
  heroes as heroesById,
  items,
  item_ids as itemIds,
  game_mode as gameModes,
  lobby_type as lobbyTypes,
  patch as patches,
  ability_ids as abilityIds,
  hero_abilities as heroAbilities,
  abilities,
} from "dotaconstants";
import type { HeroSummary } from "./types";

const CDN_BASE = "https://cdn.cloudflare.steamstatic.com";

type HeroConst = {
  id: number;
  name: string;
  localized_name?: string;
  primary_attr: string;
  attack_type: string;
  roles: string[];
  img: string;
  icon: string;
};

type ItemConst = {
  id: number;
  dname?: string;
  img: string;
  cost?: number;
  tier?: number;
};

const heroes = heroesById as unknown as Record<string, HeroConst>;
const itemsByKey = items as unknown as Record<string, ItemConst>;
const itemKeyById = itemIds as unknown as Record<string, string>;
const abilityNameById = abilityIds as unknown as Record<string, string>;
const heroAbilitiesByName = heroAbilities as unknown as Record<
  string,
  { talents: { name: string; level: number }[] }
>;
const abilitiesByName = abilities as unknown as Record<string, { dname?: string }>;

export function getHeroName(heroId: number): string {
  const hero = heroes[String(heroId)];
  return hero?.localized_name ?? hero?.name?.replace("npc_dota_hero_", "") ?? `Hero ${heroId}`;
}

export function getHeroIcon(heroId: number): string {
  const hero = heroes[String(heroId)];
  return hero ? `${CDN_BASE}${hero.icon}` : "";
}

export function getHeroImage(heroId: number): string {
  const hero = heroes[String(heroId)];
  return hero ? `${CDN_BASE}${hero.img}` : "";
}

export function getHeroPrimaryAttr(heroId: number): string {
  return heroes[String(heroId)]?.primary_attr ?? "";
}

export function getItemNameByKey(key: string): string {
  return itemsByKey[key]?.dname ?? key;
}

export function getItemIconByKey(key: string): string {
  const item = itemsByKey[key];
  return item ? `${CDN_BASE}${item.img}` : "";
}

export function getItemKeyById(itemId: number): string | null {
  return itemKeyById[String(itemId)] ?? null;
}

export function getItemTier(itemKey: string): number | null {
  return itemsByKey[itemKey]?.tier ?? null;
}

export function getAbilityNameById(abilityId: number): string | null {
  return abilityNameById[String(abilityId)] ?? null;
}

/** Human-readable talent text, e.g. "+10 Strength" - straight from Dota's own ability data. */
export function getAbilityDisplayName(internalName: string): string {
  return abilitiesByName[internalName]?.dname ?? internalName;
}

/** Ordered talent list for a hero: 8 entries, two per level (10/15/20/25). */
export function getHeroTalents(heroId: number): { name: string; level: number }[] {
  const hero = heroes[String(heroId)];
  if (!hero) return [];
  return heroAbilitiesByName[hero.name]?.talents ?? [];
}

function prettifyConstName(name: string, stripPrefix: string): string {
  return name
    .replace(stripPrefix, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const gameModesById = gameModes as unknown as Record<string, { name: string }>;
const lobbyTypesById = lobbyTypes as unknown as Record<string, { name: string }>;
const patchesById = patches as unknown as { name: string; id: number }[];

export function getGameModeName(gameModeId: number): string {
  const mode = gameModesById[String(gameModeId)];
  return mode ? prettifyConstName(mode.name, "game_mode_") : "Unknown mode";
}

export function getLobbyTypeName(lobbyTypeId: number): string {
  const lobby = lobbyTypesById[String(lobbyTypeId)];
  return lobby ? prettifyConstName(lobby.name, "lobby_type_") : "Unknown lobby";
}

export function getPatchName(patchId: number | undefined): string | null {
  if (patchId === undefined) return null;
  return patchesById[patchId]?.name ?? null;
}

// Valve doesn't expose exact numeric MMR through any public API. OpenDota
// does compute and publish its own estimate per player (`computed_mmr`,
// from recorded match history) - that's real fetched data, so we use it as
// the source of truth and derive the rank medal/star and "MMR to next rank"
// from it, rather than from the coarser (and sometimes stale) `rank_tier`
// medal field. The medal-to-MMR ladder itself (~154 MMR/star through
// Ancient, ~200/star in Divine) is widely-cited 2026 community rank-
// distribution data - not officially published by Valve either, but the
// best available mapping, and it's only used to place a real number on the
// ladder, not to invent the number itself.
const RANK_MEDALS = [
  "",
  "Herald",
  "Guardian",
  "Crusader",
  "Archon",
  "Legend",
  "Ancient",
  "Divine",
  "Immortal",
];

const RANK_COLORS: Record<number, string> = {
  1: "#a1887f",
  2: "#8bc34a",
  3: "#4fc3f7",
  4: "#7e57c2",
  5: "#3f51b5",
  6: "#26a69a",
  7: "#42a5f5",
  8: "#e0b04a",
};

const MMR_PER_STAR_STANDARD = 154; // Herald through Ancient
const MMR_PER_STAR_DIVINE = 200;
const ANCIENT_CEILING_MMR = 30 * MMR_PER_STAR_STANDARD; // 6 medals x 5 stars
const IMMORTAL_FLOOR_MMR = ANCIENT_CEILING_MMR + 5 * MMR_PER_STAR_DIVINE;

interface LadderRung {
  mmr: number;
  medalIndex: number;
  star: number; // 0 for Immortal (no stars)
}

function buildRankLadder(): LadderRung[] {
  const ladder: LadderRung[] = [];
  for (let medalIndex = 1; medalIndex <= 6; medalIndex++) {
    for (let star = 1; star <= 5; star++) {
      const starsCompleted = (medalIndex - 1) * 5 + star;
      ladder.push({ mmr: starsCompleted * MMR_PER_STAR_STANDARD, medalIndex, star });
    }
  }
  for (let star = 1; star <= 5; star++) {
    ladder.push({ mmr: ANCIENT_CEILING_MMR + star * MMR_PER_STAR_DIVINE, medalIndex: 7, star });
  }
  ladder.push({ mmr: IMMORTAL_FLOOR_MMR, medalIndex: 8, star: 0 });
  return ladder;
}

const RANK_LADDER = buildRankLadder();

function rungLabel(rung: LadderRung): string {
  const medal = RANK_MEDALS[rung.medalIndex];
  return rung.star > 0 ? `${medal} ${rung.star}` : medal;
}

export interface RankInfo {
  mmr: number;
  medal: string;
  star: number | null;
  label: string; // e.g. "Divine 3" or "Immortal"
  color: string;
  mmrToNextRank: number | null; // null only at the very top of the ladder
  nextRankLabel: string | null;
  leaderboardRank: number | null;
}

/** Derives rank medal/star and "MMR to next rank" directly from a real MMR number (OpenDota's computed_mmr), not from the separate rank_tier field. */
export function getRankInfo(
  mmr: number | null | undefined,
  leaderboardRank: number | null | undefined
): RankInfo | null {
  if (mmr === null || mmr === undefined) return null;

  let current = RANK_LADDER[0];
  let nextIndex = -1;
  for (let i = 0; i < RANK_LADDER.length; i++) {
    if (RANK_LADDER[i].mmr <= mmr) {
      current = RANK_LADDER[i];
      nextIndex = i + 1;
    } else {
      break;
    }
  }
  const next = nextIndex >= 0 && nextIndex < RANK_LADDER.length ? RANK_LADDER[nextIndex] : null;

  return {
    mmr: Math.round(mmr),
    medal: RANK_MEDALS[current.medalIndex],
    star: current.star || null,
    label: rungLabel(current),
    color: RANK_COLORS[current.medalIndex] ?? "#898781",
    mmrToNextRank: next ? Math.max(0, Math.round(next.mmr - mmr)) : null,
    nextRankLabel: next ? rungLabel(next) : null,
    leaderboardRank: leaderboardRank ?? null,
  };
}

export function getAllHeroes(): HeroSummary[] {
  return Object.values(heroes)
    .map((h) => ({
      id: h.id,
      name: h.localized_name ?? h.name.replace("npc_dota_hero_", ""),
      primaryAttr: h.primary_attr,
      roles: h.roles ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
