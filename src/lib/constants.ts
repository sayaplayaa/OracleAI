import {
  heroes as heroesById,
  items,
  item_ids as itemIds,
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
};

const heroes = heroesById as unknown as Record<string, HeroConst>;
const itemsByKey = items as unknown as Record<string, ItemConst>;
const itemKeyById = itemIds as unknown as Record<string, string>;

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
