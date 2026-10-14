// What a hero brings that the enemy builds items against - read from its real
// ability data (dotaconstants), not from memory - and which items answer
// which of those things. The item side is the common counter-itemization
// list from community guides (see docs/coach-knowledge.md); whether a pick
// really follows it is checked against replays (metrics/replayBuild.ts).

import { abilities, hero_abilities as heroAbilities, heroes } from "dotaconstants";
import { getHeroInternalName } from "./constants";

export type TraitKey = "disables" | "magic" | "evasion" | "invisibility" | "illusions" | "healing" | "summons" | "escape" | "physical";

export const TRAIT_LABELS: Record<TraitKey, string> = {
  disables: "контроль",
  magic: "магический урон",
  evasion: "уклонение",
  invisibility: "невидимость",
  illusions: "иллюзии",
  healing: "лечение и реген",
  summons: "призванные существа",
  escape: "прыжки и блинки",
  physical: "физический урон керри",
};

/** Item -> what in the enemy team it answers. */
export const COUNTER_ITEM_TRAITS: Record<string, TraitKey[]> = {
  black_king_bar: ["disables", "magic"],
  pipe: ["magic"],
  glimmer_cape: ["magic"],
  blade_mail: ["magic", "physical"],
  sphere: ["disables"],
  lotus_orb: ["disables"],
  monkey_king_bar: ["evasion"],
  spirit_vessel: ["healing"],
  skadi: ["healing"],
  shivas_guard: ["healing", "physical"],
  gem: ["invisibility"],
  maelstrom: ["illusions", "summons"],
  mjollnir: ["illusions", "summons"],
  radiance: ["illusions", "summons"],
  bfury: ["illusions", "summons"],
  crimson_guard: ["physical", "illusions"],
  assault: ["physical"],
  heavens_halberd: ["physical"],
  ghost: ["physical"],
  solar_crest: ["physical"],
  sheepstick: ["escape"],
  orchid: ["escape"],
  bloodthorn: ["escape"],
  abyssal_blade: ["escape"],
  nullifier: ["escape"],
};

type AbilityConst = {
  dname?: string;
  desc?: string;
  dmg_type?: string;
  attrib?: { header?: string }[];
};
const abilitiesByKey = abilities as unknown as Record<string, AbilityConst>;
const heroAbilitiesByName = heroAbilities as unknown as Record<string, { abilities: string[] }>;
const heroesById = heroes as unknown as Record<string, { roles?: string[]; primary_attr?: string }>;

// An ability that takes control of the target - read from its description,
// since many (Lion's Earth Spike) have no cast range in the data.
const DISABLE =
  /\bstun|\bhex|\broots?\b|\bsilence|\bsleep|\bfear|\btaunt|\bcyclone|\bensnare|\bentangle|\bdisarm|\bshackl|\btransforms? (?:an?|the) (?:enemy|target)|\bimmobili[sz]|\bunable to (?:move|attack|cast)/i;
// Moves the hero across the map in an instant - what Hex, Orchid and Nullifier are bought to stop.
const ESCAPE_NAMES =
  /\bBlink\b|\bLeap\b|Phantom Strike|Ball Lightning|Time Walk|Waveform|Shukuchi|Fire Remnant|Astral Step|Phase Shift|Illusory Orb|Ethereal Jaunt|Dissimilate|Sleight of Fist|Pounce|Rolling Thunder|Swashbuckle|Shield Crash|Skewer|Icarus Dive/;

const TEXT_TRAITS: [TraitKey, RegExp][] = [
  ["evasion", /\bevasion\b|chance to miss/i],
  ["invisibility", /\b(?:becomes?|turns?|goes) invisible|\binvisibility\b|fades? into (?:the )?shadows/i],
  ["illusions", /\b(?:creates?|summons?|conjures?|spawns?)\b[^.]{0,40}\b(?:illusions?|images?|copies)\b|\billusions? of (?:himself|herself|itself)/i],
  ["healing", /\bheals? (?:allies|allied|himself|herself|itself|the target|a target|friendly)|\bhealth regen|\blifesteal|\brestores?\b[^.]{0,30}\bhealth/i],
  ["summons", /\bsummons?\b(?![^.]{0,40}\b(?:illusions?|images?|copies)\b)/i],
];
// Abilities about the counter, not the trait ("reveals invisible units").
const NOT_THE_TRAIT = /\breveals?\b|\bagainst illusions\b|\bdestroys? illusions\b/i;

let cache: Map<number, Set<TraitKey>> | null = null;

/** What the hero's kit brings that items are built against. */
export function heroTraits(heroId: number): Set<TraitKey> {
  cache ??= new Map();
  const hit = cache.get(heroId);
  if (hit) return hit;
  const traits = new Set<TraitKey>();
  const internal = getHeroInternalName(heroId);
  const kit = (internal ? (heroAbilitiesByName[internal]?.abilities ?? []) : [])
    .map((key) => abilitiesByKey[key])
    .filter((a): a is AbilityConst => Boolean(a?.dname));
  for (const ability of kit) {
    const text = ability.desc ?? "";
    if (!NOT_THE_TRAIT.test(text)) for (const [trait, rx] of TEXT_TRAITS) if (rx.test(text)) traits.add(trait);
    if ((ability.attrib ?? []).some((a) => a.header && /EVASION/i.test(a.header))) traits.add("evasion");
    if (ESCAPE_NAMES.test(ability.dname ?? "")) traits.add("escape");
  }
  if (kit.filter((a) => a.dmg_type === "Magical").length >= 3) traits.add("magic");
  if (kit.filter((a) => DISABLE.test(a.desc ?? "")).length >= 2) traits.add("disables");
  // Carry as the hero's first role (Lina and Zeus list it further down), and
  // not an intelligence hero: Storm Spirit or Leshrac carry with spells.
  const hero = heroesById[String(heroId)];
  if (hero?.roles?.[0] === "Carry" && hero.primary_attr !== "int") traits.add("physical");
  cache.set(heroId, traits);
  return traits;
}
