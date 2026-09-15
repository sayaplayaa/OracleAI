import { getHeroName } from "../constants";
import { isWin } from "./trendMetrics";
import type { OpenDotaHeroStat, OpenDotaRecentMatch } from "../types";

export interface HeroPerformanceSummary {
  heroId: number;
  heroName: string;
  lifetimeGames: number;
  lifetimeWinRate: number;
  recentGames: number;
  recentWinRate: number;
  avgKda: number;
  avgGpm: number | null;
  avgXpm: number | null;
}

export function findSignatureHero(
  heroStats: OpenDotaHeroStat[]
): OpenDotaHeroStat | null {
  if (heroStats.length === 0) return null;
  return [...heroStats].sort((a, b) => b.games - a.games)[0];
}

export function computeHeroPerformance(
  heroId: number,
  heroStat: OpenDotaHeroStat | undefined,
  matchesOnHero: OpenDotaRecentMatch[]
): HeroPerformanceSummary {
  const recentGames = matchesOnHero.length;
  const recentWins = matchesOnHero.filter(isWin).length;
  const totalKills = matchesOnHero.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = matchesOnHero.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = matchesOnHero.reduce((s, m) => s + m.assists, 0);
  const avgKda =
    totalDeaths === 0
      ? totalKills + totalAssists
      : (totalKills + totalAssists) / totalDeaths;

  return {
    heroId,
    heroName: getHeroName(heroId),
    lifetimeGames: heroStat?.games ?? 0,
    lifetimeWinRate: heroStat && heroStat.games > 0 ? heroStat.win / heroStat.games : 0,
    recentGames,
    recentWinRate: recentGames > 0 ? recentWins / recentGames : 0,
    avgKda: Math.round(avgKda * 100) / 100,
    avgGpm: averageDefined(matchesOnHero.map((m) => m.gold_per_min)),
    avgXpm: averageDefined(matchesOnHero.map((m) => m.xp_per_min)),
  };
}

function averageDefined(values: (number | undefined)[]): number | null {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length > 0
    ? Math.round(defined.reduce((s, v) => s + v, 0) / defined.length)
    : null;
}
