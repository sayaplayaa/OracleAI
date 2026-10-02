import { abilities } from "dotaconstants";
import ru from "@/data/dota-ru.json";

const abilitiesByName = abilities as unknown as Record<string, { dname?: string }>;
const ruTalents = ru.talents as Record<string, string>;

const PLACEHOLDERS = /\{s:[a-z0-9_]+\}/gi;
const HAS_PLACEHOLDER = /\{s:[a-z0-9_]+\}/i;

/**
 * Talent text as the Russian game client shows it ("+350 к здоровью").
 * Valve's text is a template ("+{s:value} к здоровью"); its numbers are taken
 * from dotaconstants' English text when that one is already filled in, in the
 * same order. Hero-specific talents whose value isn't in either source show
 * "?" in place of the number rather than a raw template or an invented value.
 */
export function getTalentLabel(name: string): string {
  const en = abilitiesByName[name]?.dname ?? name;
  const template = ruTalents[name];
  if (!template) return en.replace(PLACEHOLDERS, "?");

  const slots = template.match(PLACEHOLDERS) ?? [];
  if (slots.length === 0) return template;

  const enNumbers = HAS_PLACEHOLDER.test(en) ? [] : (en.match(/\d+(?:\.\d+)?/g) ?? []);
  if (enNumbers.length === slots.length) {
    let i = 0;
    return template.replace(PLACEHOLDERS, () => enNumbers[i++].replace(".", ","));
  }
  return template.replace(PLACEHOLDERS, "?");
}

/** Whether an ability key ("special_bonus_...") is a talent rather than an ability. */
export function isTalentKey(name: string | null | undefined): boolean {
  return name?.startsWith("special_bonus_") ?? false;
}
