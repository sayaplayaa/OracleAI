import { hero_abilities as heroAbilities, abilities } from "dotaconstants";
import { getHeroInternalName } from "./constants";
import ru from "@/data/dota-ru.json";
import type { HeroAbility } from "./types";

const CDN_BASE = "https://cdn.cloudflare.steamstatic.com";

type AbilityAttrib = { key?: string; header?: string; value: string | string[] };
type AbilityConst = {
  dname?: string;
  desc?: string;
  is_innate?: boolean;
  attrib?: AbilityAttrib[];
  img?: string;
};

// Official Russian Dota client text (scripts/build-dota-ru.mjs).
const ruAbilities = ru.abilities as Record<string, { desc?: string; headers?: Record<string, string> }>;

const heroAbilitiesByName = heroAbilities as unknown as Record<
  string,
  { abilities: string[] }
>;
const abilitiesByKey = abilities as unknown as Record<string, AbilityConst>;

function attribValue(a: AbilityAttrib): string {
  return Array.isArray(a.value) ? a.value.join(" / ") : a.value;
}

// The localization text uses %key% for an ability value and %% for a literal
// percent sign. Returns null when a placeholder has no value to fill in, so
// the caller shows the English original instead of a half-filled template.
function fillDescription(template: string, attrib: AbilityAttrib[]): string | null {
  const values = new Map(attrib.filter((a) => a.key).map((a) => [a.key!.toLowerCase(), attribValue(a)]));
  let missing = false;
  const filled = template.replace(/%([a-z0-9_]+)%/gi, (_, key: string) => {
    const value = values.get(key.toLowerCase());
    if (value === undefined) {
      missing = true;
      return "";
    }
    return value;
  });
  if (missing) return null;
  return filled
    // "%%" is Valve's escaped percent sign; a value that already carries its
    // own "%" before it made "100%%".
    .replace(/%{2,}/g, "%")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "%ЗАМЕДЛЕНИЕ ПЕРЕДВИЖЕНИЯ:" -> "ЗАМЕДЛЕНИЕ ПЕРЕДВИЖЕНИЯ" (a leading % only
// tells the game client to format the value as a percentage).
function cleanHeader(header: string): string {
  return header.replace(/^%/, "").replace(/:$/, "").trim();
}

// Standard Russian terms for the generic labels dotaconstants generates for
// values that have no localized label of their own (the most common ones
// cover most occurrences; the long tail stays English and isn't displayed).
const GENERIC_HEADERS_RU: Record<string, string> = {
  "CAST TIME": "ВРЕМЯ ПРИМЕНЕНИЯ",
  "CAST RANGE": "ДАЛЬНОСТЬ ПРИМЕНЕНИЯ",
  DURATION: "ДЛИТЕЛЬНОСТЬ",
  RADIUS: "РАДИУС",
  SPEED: "СКОРОСТЬ",
  "PROJECTILE SPEED": "СКОРОСТЬ СНАРЯДА",
  "MAX CHARGES": "МАКС. ЗАРЯДОВ",
  "CHARGE RESTORE TIME": "ВОССТАНОВЛЕНИЕ ЗАРЯДА",
  "TICK INTERVAL": "ИНТЕРВАЛ СРАБАТЫВАНИЯ",
  "TICK RATE": "ИНТЕРВАЛ СРАБАТЫВАНИЯ",
  "CHANNEL TIME": "ВРЕМЯ ПОДДЕРЖАНИЯ",
  "SLOW DURATION": "ДЛИТЕЛЬНОСТЬ ЗАМЕДЛЕНИЯ",
  "SLOW RADIUS": "РАДИУС ЗАМЕДЛЕНИЯ",
  "VISION RADIUS": "РАДИУС ОБЗОРА",
  "VISION DURATION": "ДЛИТЕЛЬНОСТЬ ОБЗОРА",
  "KNOCKBACK DURATION": "ДЛИТЕЛЬНОСТЬ ОТБРАСЫВАНИЯ",
  "KNOCKBACK DISTANCE": "ДАЛЬНОСТЬ ОТБРАСЫВАНИЯ",
  "KNOCKBACK HEIGHT": "ВЫСОТА ОТБРАСЫВАНИЯ",
  "STUN DURATION": "ДЛИТЕЛЬНОСТЬ ОГЛУШЕНИЯ",
  "BONUS DAMAGE": "ДОП. УРОН",
  DAMAGE: "УРОН",
  "DAMAGE INTERVAL": "ИНТЕРВАЛ УРОНА",
  "DAMAGE TICK RATE": "ИНТЕРВАЛ УРОНА",
  "BURN INTERVAL": "ИНТЕРВАЛ ГОРЕНИЯ",
  "LINGER DURATION": "ДЛИТЕЛЬНОСТЬ ЭФФЕКТА",
  "END RADIUS": "КОНЕЧНЫЙ РАДИУС",
  "START RADIUS": "НАЧАЛЬНЫЙ РАДИУС",
  "MAX DISTANCE": "МАКС. ДАЛЬНОСТЬ",
  DISTANCE: "ДАЛЬНОСТЬ",
  RANGE: "ДАЛЬНОСТЬ",
  WIDTH: "ШИРИНА",
  "BLAST SPEED": "СКОРОСТЬ ВЗРЫВА",
  COOLDOWN: "ПЕРЕЗАРЯДКА",
  "MANA COST": "ЗАТРАТЫ МАНЫ",
  UNDISPELLABLE: "НЕ РАЗВЕИВАЕТСЯ",
};

const CYRILLIC = /\p{Script=Cyrillic}/u;

/**
 * A hero's real ability kit, straight from Dota's own client data (same
 * source dotaconstants already provides for hero/item names elsewhere in
 * this app) - names, official descriptions, and numeric attributes, no
 * invented content. Descriptions and attribute labels are the official
 * Russian client text where it exists; ability names stay English, as they
 * do in the Russian client. Spacer/hidden entries (e.g. "generic_hidden",
 * which has no display name) are dropped.
 */
export function getHeroAbilityKit(heroId: number): HeroAbility[] {
  const internalName = getHeroInternalName(heroId);
  if (!internalName) return [];
  const keys = heroAbilitiesByName[internalName]?.abilities ?? [];

  return keys
    .map((key): HeroAbility | null => {
      const ability = abilitiesByKey[key];
      if (!ability?.dname) return null;
      const attrib = ability.attrib ?? [];
      const localized = ruAbilities[key];
      const descriptionEn = ability.desc ?? "";
      const descriptionRu = localized?.desc ? fillDescription(localized.desc, attrib) : null;
      return {
        key,
        name: ability.dname,
        description: descriptionRu || descriptionEn,
        descriptionEn,
        isInnate: !!ability.is_innate,
        attributes: attrib
          .filter((a) => a.header)
          .map((a) => {
            const official = a.key ? localized?.headers?.[a.key] : undefined;
            const english = cleanHeader(a.header!);
            const header = official ? cleanHeader(official) : (GENERIC_HEADERS_RU[english] ?? english);
            return { header, value: attribValue(a), localized: CYRILLIC.test(header) };
          }),
        iconUrl: ability.img ? `${CDN_BASE}${ability.img}` : "",
      };
    })
    .filter((a): a is HeroAbility => a !== null);
}
