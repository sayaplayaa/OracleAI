import { NextRequest, NextResponse } from "next/server";
import { getMatch, getBenchmarks } from "@/lib/opendota";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { coachMatch } from "@/lib/coach/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const matchId = Number(body?.matchId);
  const accountId = Number(body?.accountId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  }

  try {
    const match = await getMatch(matchId);
    const player = match.players.find((p) => p.account_id === accountId);
    if (!player) {
      return NextResponse.json(
        { error: "Player did not play in this match" },
        { status: 404 }
      );
    }
    const benchmarks = await getBenchmarks(player.hero_id).catch(() => null);
    const metrics = computeMatchMetrics(match, accountId, benchmarks);

    const report = await coachMatch(metrics);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI coach failed" },
      { status: 502 }
    );
  }
}
