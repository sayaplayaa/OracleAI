import Anthropic from "@anthropic-ai/sdk";
import type {
  CoachReport,
  MatchMetrics,
  MatchStory,
  ProHeroSpotlight,
  RoleComparisonEntry,
  TrendMetrics,
} from "../types";
import type { HeroPerformanceSummary } from "../metrics/signatureHero";
import { coachReportTool } from "./schema";
import {
  SYSTEM_PROMPT,
  buildHeroCoachPrompt,
  buildMatchCoachPrompt,
  buildMatchStoryCoachPrompt,
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

async function runCoach(userPrompt: string): Promise<CoachReport> {
  const anthropic = getClient();
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [coachReportTool],
    tool_choice: { type: "tool", name: coachReportTool.name },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI coach did not return a structured report.");
  }

  return toolUse.input as CoachReport;
}

export function coachMatch(metrics: MatchMetrics): Promise<CoachReport> {
  return runCoach(buildMatchCoachPrompt(metrics));
}

export function coachTrends(metrics: TrendMetrics): Promise<CoachReport> {
  return runCoach(buildTrendCoachPrompt(metrics));
}

export function coachMatchStory(
  roleComparisons: RoleComparisonEntry[],
  matchStory: MatchStory
): Promise<CoachReport> {
  return runCoach(buildMatchStoryCoachPrompt(roleComparisons, matchStory));
}

export function coachHero(performance: HeroPerformanceSummary): Promise<CoachReport> {
  return runCoach(buildHeroCoachPrompt(performance));
}

export function coachProComparison(
  userPerformance: HeroPerformanceSummary,
  proSpotlight: ProHeroSpotlight
): Promise<CoachReport> {
  return runCoach(buildProComparisonPrompt(userPerformance, proSpotlight));
}
