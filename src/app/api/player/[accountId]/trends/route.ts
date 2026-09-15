import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches, getHeroStats } from "@/lib/opendota";
import { computeTrendMetrics } from "@/lib/metrics/trendMetrics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId: accountIdParam } = await params;
  const accountId = Number(accountIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 20;

  try {
    const [matches, heroStats] = await Promise.all([
      getRecentMatches(accountId, limit),
      getHeroStats(accountId),
    ]);
    const trends = computeTrendMetrics(accountId, matches, heroStats);
    return NextResponse.json(trends);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load trends" },
      { status: 502 }
    );
  }
}
