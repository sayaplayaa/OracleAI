import {
  heroes as heroesById,
  items,
  item_ids as itemIds,
  game_mode as gameModes,
  lobby_type as lobbyTypes,
  patch as patches,
  ability_ids as abilityIds,
  abilities,
  hero_abilities as heroAbilities,
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
  desc?: string;
  notes?: string;
  attrib?: { display?: string; value?: string | string[] }[];
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

export function getHeroName(heroId: number): string {
  const hero = heroes[String(heroId)];
  return hero?.localized_name ?? hero?.name?.replace("npc_dota_hero_", "") ?? `Герой ${heroId}`;
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

// Every real (non-recipe) item's display name and gold cost - used to catch a
// model naming an item this match's data never mentions.
export function getAllItems(): { name: string; cost: number }[] {
  return Object.entries(itemsByKey)
    .filter(([key, item]) => !key.startsWith("recipe_") && item.dname)
    .map(([, item]) => ({ name: item.dname as string, cost: item.cost ?? 0 }));
}

export function getItemNameByKey(key: string): string {
  return itemsByKey[key]?.dname ?? key;
}

export function getItemCostByKey(key: string): number {
  return itemsByKey[key]?.cost ?? 0;
}

/** An item built from components (Manta Style, Power Treads) rather than a component itself. */
export function isAssembledItem(key: string): boolean {
  const components = (itemsByKey[key] as { components?: string[] | null } | undefined)?.components;
  return Array.isArray(components) && components.length > 0;
}

/** An ability's in-game (English) name by its internal key, e.g. "lina_laguna_blade" -> "Laguna Blade". */
export function getAbilityDisplayNameByKey(key: string): string | null {
  return (abilities as unknown as Record<string, { dname?: string }>)[key]?.dname ?? null;
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

/** Official item effect text, straight from Dota's own client data. */
export function getItemDescription(itemKey: string): string {
  return itemsByKey[itemKey]?.desc ?? "";
}

/**
 * Real item effect text for the coach prompts. dotaconstants leaves `desc`
 * empty for almost every item in the current data set (verified: phase_boots,
 * blades_of_attack, wraith_band, power_treads, magic_wand, yasha and manta
 * all have an empty desc) - handing the model that blank string was an open
 * invitation to invent an effect from its own (unreliable) memory. `attrib`
 * (the real numeric bonuses, e.g. "+50 Movement Speed") is populated for
 * almost every item, so it's used to build a real description when `desc`
 * and `notes` are both empty. Returns "" only when no real text exists at
 * all - callers must treat that as "no official effect available", not omit
 * the check.
 */
export function getItemEffectText(itemKey: string): string {
  const item = itemsByKey[itemKey];
  if (!item) return "";
  if (item.desc) return item.desc;

  const fromAttrib = (item.attrib ?? [])
    .filter((a) => a.display)
    .map((a) => {
      const value = Array.isArray(a.value) ? a.value.join("/") : a.value ?? "";
      return a.display!.replace("{value}", value);
    })
    .filter((line) => line.trim().length > 0)
    .join(", ");
  if (fromAttrib) return fromAttrib;

  return item.notes ?? "";
}

export function getAbilityNameById(abilityId: number): string | null {
  return abilityNameById[String(abilityId)] ?? null;
}

/** An ability's in-game (English) name by its numeric id, e.g. 5391 -> "Arcane Orb". */
export function getAbilityDisplayNameById(abilityId: number): string | null {
  const key = abilityNameById[String(abilityId)];
  if (!key) return null;
  return (abilities as unknown as Record<string, { dname?: string }>)[key]?.dname ?? null;
}

/** An item's in-game (English) name by its numeric id, e.g. 534 -> "Witch Blade". */
export function getItemNameById(itemId: number): string | null {
  const key = itemKeyById[String(itemId)];
  return key ? (itemsByKey[key]?.dname ?? null) : null;
}


// dotaconstants numbers talent tiers 1-4; the game unlocks them at hero levels 10/15/20/25.
const TALENT_TIER_LEVELS = [10, 15, 20, 25];

/** Ordered talent list for a hero: 8 entries, two per level (10/15/20/25). */
export function getHeroTalents(heroId: number): { name: string; level: number }[] {
  const hero = heroes[String(heroId)];
  if (!hero) return [];
  return (heroAbilitiesByName[hero.name]?.talents ?? []).map((t) => ({
    name: t.name,
    level: t.level >= 1 && t.level <= 4 ? TALENT_TIER_LEVELS[t.level - 1] : t.level,
  }));
}

/** dotaconstants' internal hero key (e.g. "npc_dota_hero_antimage"), used to look up its ability kit. */
export function getHeroInternalName(heroId: number): string | null {
  return heroes[String(heroId)]?.name ?? null;
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
  return mode ? prettifyConstName(mode.name, "game_mode_") : "Неизвестный режим";
}

export function getLobbyTypeName(lobbyTypeId: number): string {
  const lobby = lobbyTypesById[String(lobbyTypeId)];
  return lobby ? prettifyConstName(lobby.name, "lobby_type_") : "Неизвестное лобби";
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
// Official Russian Dota client medal names (Herald, Guardian, Crusader,
// Archon, Legend, Ancient, Divine, Immortal).
const RANK_MEDALS = [
  "",
  "Рекрут",
  "Страж",
  "Рыцарь",
  "Герой",
  "Легенда",
  "Властелин",
  "Божество",
  "Титан",
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
  label: string; // e.g. "Божество 3" or "Титан"
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
