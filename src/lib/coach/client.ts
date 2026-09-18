import Anthropic from "@anthropic-ai/sdk";
import type {
  CoachReport,
  DraftInsights,
  HeroAbility,
  HeroGuideReport,
  HeroRoleOverview,
  MatchMetrics,
  MatchStory,
  PowerSpikeReport,
  ProHeroSpotlight,
  RoleComparisonEntry,
  SkillBuildEntry,
  TrendMetrics,
} from "../types";
import type { HeroPerformanceSummary } from "../metrics/signatureHero";
import { coachReportTool, heroGuideTool, powerSpikeTool } from "./schema";
import {
  SYSTEM_PROMPT,
  buildHeroCoachPrompt,
  buildHeroGuidePrompt,
  buildMatchCoachPrompt,
  buildMatchStoryCoachPrompt,
  buildPowerSpikePrompt,
  buildProComparisonPrompt,
  buildTrendCoachPrompt,
} from "./prompt";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable the AI coach."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

async function runCoach<T>(userPrompt: string, tool: Anthropic.Tool): Promise<T> {
  const anthropic = getClient();
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI coach did not return a structured report.");
  }

  return toolUse.input as T;
}

export function coachMatch(metrics: MatchMetrics): Promise<CoachReport> {
  return runCoach<CoachReport>(buildMatchCoachPrompt(metrics), coachReportTool);
}

export function coachTrends(metrics: TrendMetrics): Promise<CoachReport> {
  return runCoach<CoachReport>(buildTrendCoachPrompt(metrics), coachReportTool);
}

export function coachMatchStory(
  roleComparisons: RoleComparisonEntry[],
  matchStory: MatchStory
): Promise<CoachReport> {
  return runCoach<CoachReport>(
    buildMatchStoryCoachPrompt(roleComparisons, matchStory),
    coachReportTool
  );
}

export function coachHero(performance: HeroPerformanceSummary): Promise<CoachReport> {
  return runCoach<CoachReport>(buildHeroCoachPrompt(performance), coachReportTool);
}

export function coachProComparison(
  userPerformance: HeroPerformanceSummary,
  proSpotlight: ProHeroSpotlight
): Promise<CoachReport> {
  return runCoach<CoachReport>(
    buildProComparisonPrompt(userPerformance, proSpotlight),
    coachReportTool
  );
}

export function coachHeroGuide(
  heroName: string,
  abilities: HeroAbility[],
  roleOverview: HeroRoleOverview,
  matchups: DraftInsights
): Promise<HeroGuideReport> {
  return runCoach<HeroGuideReport>(
    buildHeroGuidePrompt(heroName, abilities, roleOverview, matchups),
    heroGuideTool
  );
}

export function coachPowerSpike(
  heroName: string,
  abilities: HeroAbility[],
  itemTimeline: { time: number; itemName: string; itemKey: string }[],
  skillBuild: SkillBuildEntry[]
): Promise<PowerSpikeReport> {
  return runCoach<PowerSpikeReport>(
    buildPowerSpikePrompt(heroName, abilities, itemTimeline, skillBuild),
    powerSpikeTool
  );
}
