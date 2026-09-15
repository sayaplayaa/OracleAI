import { NextRequest, NextResponse } from "next/server";
import { getMatch } from "@/lib/opendota";
import { getMatchPlayerPositions } from "@/lib/stratz";
import { computeFullMatchOverview } from "@/lib/metrics/fullMatchMetrics";
import { computeRoleComparisons } from "@/lib/metrics/roleComparison";
import { computeMatchStory } from "@/lib/metrics/matchStory";
import { coachMatchStory } from "@/lib/coach/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const matchId = Number(body?.matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
  }

  try {
    const match = await getMatch(matchId);
    const fullMatch = computeFullMatchOverview(match);
    const stratzPositions = await getMatchPlayerPositions(matchId).catch(() => null);
    const roleComparisons = computeRoleComparisons(
      fullMatch.radiantPlayers,
      fullMatch.direPlayers,
      stratzPositions
    );
    const matchStory = computeMatchStory(match);

    const report = await coachMatchStory(roleComparisons, matchStory);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI coach failed" },
      { status: 502 }
    );
  }
}
