import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches, getRecentHeroStats } from "@/lib/opendota";
import { computeTrendMetrics, HERO_WINDOW_DAYS } from "@/lib/metrics/trendMetrics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId: accountIdParam } = await params;
  const accountId = Number(accountIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Некорректный id аккаунта" }, { status: 400 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 20;

  try {
    const matches = await getRecentMatches(accountId, limit);
    const { turbo } = computeTrendMetrics(accountId, matches);
    const heroStats = await getRecentHeroStats(accountId, HERO_WINDOW_DAYS, turbo).catch(() => []);
    const trends = computeTrendMetrics(accountId, matches, heroStats);
    return NextResponse.json(trends);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить тренды" },
      { status: 502 }
    );
  }
}
