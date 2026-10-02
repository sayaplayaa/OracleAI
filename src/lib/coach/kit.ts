import { getHeroAbilityKit } from "../heroAbilities";

// Whether a hero's real kit even has a tool for a stat is a cross-reference
// the model doesn't apply reliably, so it's checked here in code.
// Keyword lists are deliberately conservative (a missed keyword just drops a
// stat from the report, a false positive would let a meaningless one back in):
// generic "disable" is excluded because ability text also uses it for an
// ability turning *itself* off, and `heal(?!th)` avoids matching "health".
const DISABLE_KEYWORDS = /\b(?:stun|hex|root|fear|taunt|sleep|trap)\w*\b/i;
const HEALING_KEYWORDS = /\bheal(?!th)\w*\b/i;

function kitMatches(heroId: number, pattern: RegExp): boolean {
  return getHeroAbilityKit(heroId).some((a) => pattern.test(a.name) || pattern.test(a.descriptionEn));
}

export function heroKitHasDisable(heroId: number): boolean {
  return kitMatches(heroId, DISABLE_KEYWORDS);
}

export function heroKitHasHealing(heroId: number): boolean {
  return kitMatches(heroId, HEALING_KEYWORDS);
}
