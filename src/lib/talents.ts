import { abilities } from "dotaconstants";
import ru from "@/data/dota-ru.json";

const abilitiesByName = abilities as unknown as Record<string, { dname?: string }>;
const ruTalents = ru.talents as Record<string, string>;
// Each talent's numbers from Valve's ability files, by placeholder name
// (scripts/build-dota-ru.mjs).
const talentValues = (ru as { talentValues?: Record<string, Record<string, string>> }).talentValues ?? {};

const PLACEHOLDERS = /\{s:([a-z0-9_]+)\}/gi;
const HAS_PLACEHOLDER = /\{s:[a-z0-9_]+\}/i;

// "+200" -> "200" (the template already carries the sign), "=40" -> "40"
// (Valve's "set to"), "0.8" -> "0,8", "2.0" -> "2", "10 20 30" -> "10/20/30".
function formatValue(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((v) =>
      v
        .replace(/^[+\-–=]+/, "")
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, "")
        .replace(".", ",")
    )
    .join("/");
}

/**
 * Talent text as the Russian game client shows it ("+350 к здоровью").
 * Valve's text is a template ("+{s:value} к здоровью"), filled with the
 * talent's real numbers from Valve's ability files; failing that, with the
 * numbers of dotaconstants' English text when it's already filled in, in the
 * same order. A value found in neither shows "?" rather than a raw template
 * or an invented number.
 */
export function getTalentLabel(name: string): string {
  const en = abilitiesByName[name]?.dname ?? name;
  const template = ruTalents[name];
  const values = talentValues[name] ?? {};
  if (!template) return en.replace(PLACEHOLDERS, (_, key: string) => (values[key] ? formatValue(values[key]) : "?"));

  const slots = template.match(PLACEHOLDERS) ?? [];
  if (slots.length === 0) return template.replace(/%{2,}/g, "%");

  const enNumbers = HAS_PLACEHOLDER.test(en) ? [] : (en.match(/\d+(?:\.\d+)?/g) ?? []);
  let i = 0;
  return template
    .replace(PLACEHOLDERS, (_, key: string) => {
      const fromEnglish = enNumbers.length === slots.length ? enNumbers[i++] : undefined;
      if (values[key]) return formatValue(values[key]);
      return fromEnglish ? fromEnglish.replace(".", ",") : "?";
    })
    // "%%" is Valve's escaped percent sign.
    .replace(/%{2,}/g, "%");
}

/** Whether an ability key ("special_bonus_...") is a talent rather than an ability. */
export function isTalentKey(name: string | null | undefined): boolean {
  return name?.startsWith("special_bonus_") ?? false;
}
