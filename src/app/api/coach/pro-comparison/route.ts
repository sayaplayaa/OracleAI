import { NextRequest, NextResponse } from "next/server";
import {
  getHeroStats,
  getHeroLeagueMatches,
  getMatchesForHero,
  getProPlayers,
} from "@/lib/opendota";
import { computeHeroPerformance } from "@/lib/metrics/signatureHero";
import { computeProHeroSpotlight, findProForHero } from "@/lib/metrics/proComparison";
import { coachProComparison } from "@/lib/coach/client";

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
    const [heroStats, matchesOnHero, proPlayers, leagueMatches] = await Promise.all([
      getHeroStats(accountId),
      getMatchesForHero(accountId, heroId, 20),
      getProPlayers(),
      getHeroLeagueMatches(heroId),
    ]);
    const heroStat = heroStats.find((h) => h.hero_id === heroId);
    const userPerformance = computeHeroPerformance(heroId, heroStat, matchesOnHero);

    const found = findProForHero(leagueMatches, proPlayers);
    if (!found) {
      return NextResponse.json(
        { error: "Пока не найдено недавних турнирных игр на этом герое." },
        { status: 404 }
      );
    }

    const [proHeroStats, proMatches] = await Promise.all([
      getHeroStats(found.pro.accountId),
      getMatchesForHero(found.pro.accountId, heroId, 20),
    ]);
    const proHeroStat = proHeroStats.find((h) => h.hero_id === heroId);
    const proSpotlight = computeProHeroSpotlight(
      heroId,
      found.pro,
      proHeroStat,
      proMatches,
      found.leagueGames
    );

    const report = await coachProComparison(userPerformance, proSpotlight);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ИИ-тренер не смог составить отчёт" },
      { status: 502 }
    );
  }
}
