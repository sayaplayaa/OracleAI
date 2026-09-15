import type { MatchMetrics, TrendMetrics } from "../types";

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
