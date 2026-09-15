import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches, getHeroStats } from "@/lib/opendota";
import { computeTrendMetrics } from "@/lib/metrics/trendMetrics";
import { coachTrends } from "@/lib/coach/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accountId = Number(body?.accountId);
  const limit = Number.isInteger(Number(body?.limit)) ? Number(body?.limit) : 20;

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  }

  try {
    const [matches, heroStats] = await Promise.all([
      getRecentMatches(accountId, limit),
      getHeroStats(accountId),
    ]);
    const metrics = computeTrendMetrics(accountId, matches, heroStats);

    const report = await coachTrends(metrics);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI coach failed" },
      { status: 502 }
    );
  }
}
