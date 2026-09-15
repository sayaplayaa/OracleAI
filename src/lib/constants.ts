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
