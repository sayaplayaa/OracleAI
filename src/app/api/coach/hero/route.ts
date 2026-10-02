import { NextRequest, NextResponse } from "next/server";
import { getHeroStats, getMatchesForHero } from "@/lib/opendota";
import { computeHeroPerformance } from "@/lib/metrics/signatureHero";
import { coachHero } from "@/lib/coach/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accountId = Number(body?.accountId);
  const heroId = Number(body?.heroId);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Некорректный accountId" }, { status: 400 });
  }
  if (!Number.isInteger(heroId) || heroId <= 0) {
    return NextResponse.json({ error: "Некорректный heroId" }, { status: 400 });
  }

  try {
    const [heroStats, matchesOnHero] = await Promise.all([
      getHeroStats(accountId),
      getMatchesForHero(accountId, heroId, 20),
    ]);
    const heroStat = heroStats.find((h) => h.hero_id === heroId);
    const performance = computeHeroPerformance(heroId, heroStat, matchesOnHero);

    const report = await coachHero(performance);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ИИ-тренер не смог составить отчёт" },
      { status: 502 }
    );
  }
}
