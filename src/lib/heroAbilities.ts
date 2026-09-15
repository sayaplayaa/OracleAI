import { hero_abilities as heroAbilities, abilities } from "dotaconstants";
import { getHeroInternalName } from "./constants";
import type { HeroAbility } from "./types";

const CDN_BASE = "https://cdn.cloudflare.steamstatic.com";

type AbilityAttrib = { header?: string; value: string | string[] };
type AbilityConst = {
  dname?: string;
  desc?: string;
  is_innate?: boolean;
  attrib?: AbilityAttrib[];
  img?: string;
};

const heroAbilitiesByName = heroAbilities as unknown as Record<
  string,
  { abilities: string[] }
>;
const abilitiesByKey = abilities as unknown as Record<string, AbilityConst>;

/**
 * A hero's real ability kit, straight from Dota's own client data (same
 * source dotaconstants already provides for hero/item names elsewhere in
 * this app) - names, official descriptions, and numeric attributes, no
 * invented content. Spacer/hidden entries (e.g. "generic_hidden", which has
 * no display name) are dropped.
 */
export function getHeroAbilityKit(heroId: number): HeroAbility[] {
  const internalName = getHeroInternalName(heroId);
  if (!internalName) return [];
  const keys = heroAbilitiesByName[internalName]?.abilities ?? [];

  return keys
    .map((key): HeroAbility | null => {
      const ability = abilitiesByKey[key];
      if (!ability?.dname) return null;
      return {
        key,
        name: ability.dname,
        description: ability.desc ?? "",
        isInnate: !!ability.is_innate,
        attributes: (ability.attrib ?? [])
          .filter((a) => a.header)
          .map((a) => ({
            header: a.header!.replace(/:$/, ""),
            value: Array.isArray(a.value) ? a.value.join(" / ") : a.value,
          })),
        iconUrl: ability.img ? `${CDN_BASE}${ability.img}` : "",
      };
    })
    .filter((a): a is HeroAbility => a !== null);
}
