import type {
  DraftInsights,
  HeroAbility,
  HeroRoleOverview,
  MatchMetrics,
  MatchStory,
  ProHeroSpotlight,
  RoleComparisonEntry,
  TrendMetrics,
} from "../types";
import type { HeroPerformanceSummary } from "../metrics/signatureHero";

export const SYSTEM_PROMPT = `You are an expert Dota 2 coach reviewing a student's performance data.

Rules:
- Only reason from the JSON data you are given. Never invent hero abilities, matchups, or events that are not represented in the numbers.
- Every strength, weakness, and tip must cite a specific field/value from the data in its "metric" field (e.g. "GPM 412, 35th percentile" or "3 deaths before 10 minutes were not observed in this data, but net worth at 10 min was 2100").
- If a percentile is present, use it to judge whether a stat is actually good or bad for that hero, rather than guessing from the raw number alone.
- Be concrete and actionable in tips (what to change, not just what went wrong).
- Keep tone direct, encouraging, and specific to this data - not generic Dota advice.`;

export function buildMatchCoachPrompt(metrics: MatchMetrics): string {
  return `Here is the data for one Dota 2 match. Produce a coaching report via the submit_coaching_report tool.

${JSON.stringify(metrics, null, 2)}`;
}

export function buildTrendCoachPrompt(metrics: TrendMetrics): string {
  return `Here is aggregated performance data across this player's last ${metrics.sampleSize} matches. Produce a coaching report via the submit_coaching_report tool, focused on recurring patterns rather than any single game.

${JSON.stringify(metrics, null, 2)}`;
}

export function buildMatchStoryCoachPrompt(
  roleComparisons: RoleComparisonEntry[],
  matchStory: MatchStory
): string {
  return `You are analyzing a full 10-player Dota 2 match, not a single player. Explain what actually decided the outcome, using the submit_coaching_report tool with this framing:
- "strengths" = which side/players had the advantage in each position matchup and why (cite the specific stat).
- "weaknesses" = where the losing side (or an underperforming position) fell behind, cited from the position comparisons or match events.
- "tips" = what the losing side's players could have done differently, grounded in the specific gap shown (e.g. a specific position lost net worth by a specific amount, or a specific objective/teamfight swung the game).
- "summary" = 2-3 sentences on what decided this game overall.

Position-by-position comparisons (radiant vs dire, same role):
${JSON.stringify(roleComparisons, null, 2)}

Match story - objective/teamfight timeline and momentum swings:
${JSON.stringify(matchStory, null, 2)}`;
}

export function buildHeroCoachPrompt(performance: HeroPerformanceSummary): string {
  return `Here is this player's performance data on their most-played hero, ${performance.heroName}: lifetime stats plus their most recent games on this specific hero. Produce a coaching report via the submit_coaching_report tool focused entirely on how to play this hero better - not general Dota advice.

${JSON.stringify(performance, null, 2)}`;
}

export function buildProComparisonPrompt(
  userPerformance: HeroPerformanceSummary,
  proSpotlight: ProHeroSpotlight
): string {
  return `Compare this player's performance on ${userPerformance.heroName} against a real professional/competitive player (${proSpotlight.pro.name}${proSpotlight.pro.teamName ? `, ${proSpotlight.pro.teamName}` : ""}) on the same hero, using the submit_coaching_report tool with this framing:
- "strengths" = stats where this player already matches or beats the pro's numbers, each citing both numbers.
- "weaknesses" = the biggest real gaps between this player's numbers and the pro's, each citing both numbers.
- "tips" = concrete adjustments this player should make to close those gaps, grounded in the specific stat gap (not generic hero advice).
- "summary" = 2-3 sentences on the single biggest thing to take from the pro's games on this hero.

This player's data on ${userPerformance.heroName}:
${JSON.stringify(userPerformance, null, 2)}

${proSpotlight.pro.name}'s data on ${proSpotlight.heroName} (their own recent games on this hero):
${JSON.stringify(proSpotlight, null, 2)}`;
}

export function buildHeroGuidePrompt(
  heroName: string,
  abilities: HeroAbility[],
  roleOverview: HeroRoleOverview,
  matchups: DraftInsights
): string {
  return `Write a Dota 2 hero guide for ${heroName} using the submit_hero_guide tool. This is general hero knowledge for any player learning the hero, not personal coaching for one player's performance.

Rules:
- Every tip must cite either a real ability name/effect from the kit below, or a real number from the role/matchup data below (e.g. "Mana Void deals damage per point of missing mana" or "62% win rate as Position 1, 340 games" or "38% win rate vs Axe, 25 games").
- Never invent an ability effect, cooldown, or matchup that isn't represented in this data.
- "laningTips" and "powerSpikeTips" should be grounded in the ability kit (what each ability does early, when it comes online).
- "teamfightTips" should be grounded in the ability kit's teamfight-relevant effects.
- "matchupTips" should be grounded in the real toughest/best matchups listed below - what to do differently against/with those specific heroes.

Real ability kit (official game data):
${JSON.stringify(abilities, null, 2)}

Real role win rates (current week, STRATZ):
${JSON.stringify(roleOverview, null, 2)}

Real matchup data (OpenDota, all-time):
${JSON.stringify({ toughestMatchups: matchups.toughestMatchups, bestMatchups: matchups.bestMatchups }, null, 2)}`;
}
