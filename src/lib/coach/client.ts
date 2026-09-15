import Anthropic from "@anthropic-ai/sdk";
import type { CoachReport, MatchMetrics, TrendMetrics } from "../types";
import { coachReportTool } from "./schema";
import { SYSTEM_PROMPT, buildMatchCoachPrompt, buildTrendCoachPrompt } from "./prompt";

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
