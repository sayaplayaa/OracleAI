import { abilities, hero_abilities as heroAbilities, heroes } from "dotaconstants";
import { getHeroInternalName } from "../constants";

type AbilityAttrib = { header?: string; value: string | string[] };
type AbilityConst = { dname?: string; desc?: string; attrib?: AbilityAttrib[]; cd?: string | string[]; is_innate?: boolean };

const abilitiesByKey = abilities as unknown as Record<string, AbilityConst>;
const heroAbilitiesByName = heroAbilities as unknown as Record<string, { abilities: string[] }>;

// What an enemy ability does to the player, in the words a coach would use.
const CONTROL: [RegExp, string][] = [
  [/\bhex/i, "превращение"],
  [/\bstun/i, "оглушение"],
  [/\broot|\bensnare|\bentangle/i, "обездвиживание"],
  [/\bsilence/i, "немоту"],
  [/\bsleep/i, "усыпление"],
  [/\bfear|\bterrif/i, "страх"],
  [/\btaunt|\bberserker/i, "провокацию"],
  [/\bpull|\bhook|\bdrag/i, "притягивание"],
  [/\bdisarm/i, "обезоруживание"],
  [/\bcyclone|\binvulnerab/i, "контроль"],
];

export interface Threat {
  // In-game (English) ability name.
  name: string;
  // Game units; null when the data has none (a passive, a self-cast).
  range: number | null;
  // "оглушение" etc.; null for pure damage.
  control: string | null;
  // Seconds at max level; null when unknown.
  cooldown: number | null;
}

function numbers(value: string | string[] | undefined): number[] {
  const list = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return list.flatMap((v) => String(v).split(/[\s,/]+/)).map(Number).filter((n) => Number.isFinite(n) && n > 0);
}

function attribute(ability: AbilityConst, header: RegExp): number[] {
  const a = (ability.attrib ?? []).find((x) => x.header && header.test(x.header));
  return a ? numbers(a.value) : [];
}

function toThreat(ability: AbilityConst): Threat {
  const range = Math.max(0, ...attribute(ability, /^CAST RANGE:?$/i), ...attribute(ability, /^RANGE:?$/i));
  const control = CONTROL.find(([rx]) => rx.test(ability.desc ?? ""))?.[1] ?? null;
  const cd = numbers(ability.cd);
  return {
    name: ability.dname!,
    // Melee-range and self-centred numbers aren't a distance to keep.
    range: range >= 250 ? range : null,
    control,
    cooldown: cd.length > 0 ? cd[cd.length - 1] : null,
  };
}

function kit(heroId: number): AbilityConst[] {
  const internal = getHeroInternalName(heroId);
  if (!internal) return [];
  return (heroAbilitiesByName[internal]?.abilities ?? [])
    .map((k) => abilitiesByKey[k])
    .filter((a): a is AbilityConst => Boolean(a?.dname) && !a.is_innate);
}

/** One ability of a hero by its in-game name (as STRATZ's killing blow names it). */
export function threatByName(heroId: number | null, name: string | null): Threat | null {
  if (heroId === null || !name) return null;
  const ability = kit(heroId).find((a) => a.dname === name);
  return ability ? toThreat(ability) : null;
}

/** A hero's disabling abilities that reach from a distance, longest reach first. */
export function heroThreats(heroId: number): Threat[] {
  return kit(heroId)
    .map(toThreat)
    .filter((t) => t.control !== null && t.range !== null)
    .sort((a, b) => (b.range ?? 0) - (a.range ?? 0));
}

/** "Meat Hook (притягивание, 1 300 ед.)". */
export function describeThreat(t: Threat): string {
  const bits = [t.control, t.range !== null ? `${t.range.toLocaleString("ru-RU")} ед.` : null].filter(Boolean);
  return bits.length > 0 ? `${t.name} (${bits.join(", ")})` : t.name;
}

/** The hero's ultimate: the sixth ability of a standard six-slot kit; null for Invoker and the like. */
export function ultimateKey(heroId: number): string | null {
  const internal = getHeroInternalName(heroId);
  const keys = internal ? (heroAbilitiesByName[internal]?.abilities ?? []) : [];
  if (keys.length !== 6) return null;
  const ult = abilitiesByKey[keys[5]];
  return ult?.dname && !ult.is_innate ? keys[5] : null;
}

let owners: Map<string, Set<number>> | null = null;

/**
 * Which heroes have an ability by this in-game name ("Earth Spike" -> Lion),
 * for checking that a guide doesn't hand one hero's ability to another.
 */
export function abilityOwners(): Map<string, Set<number>> {
  if (owners) return owners;
  owners = new Map();
  for (const [id, hero] of Object.entries(heroes as unknown as Record<string, { name: string }>)) {
    for (const key of heroAbilitiesByName[hero.name]?.abilities ?? []) {
      const name = abilitiesByKey[key]?.dname;
      if (!name || name.length < 4) continue;
      const set = owners.get(name) ?? new Set<number>();
      set.add(Number(id));
      owners.set(name, set);
    }
  }
  return owners;
}
