import { getHeroName } from "../constants";
import type {
  OpenDotaHeroStat,
  OpenDotaRecentMatch,
  TrendMatchSummary,
  TrendMetrics,
} from "../types";

const LANE_ROLE_NAMES: Record<number, string> = {
  1: "Safe Lane",
  2: "Mid Lane",
  3: "Off Lane",
  4: "Jungle",
};

const MIN_GAMES_FOR_HERO_RANKING = 3;
const HERO_LIST_SIZE = 5;

export function isWin(match: OpenDotaRecentMatch): boolean {
  const isRadiant = match.player_slot < 128;
  return isRadiant === match.radiant_win;
}

export function toMatchSummary(m: OpenDotaRecentMatch): TrendMatchSummary {
  return {
    matchId: m.match_id,
    heroId: m.hero_id,
    heroName: getHeroName(m.hero_id),
    win: isWin(m),
    startTime: m.start_time,
    duration: m.duration,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    gpm: m.gold_per_min,
    xpm: m.xp_per_min,
  };
}

export function computeTrendMetrics(
  accountId: number,
  matches: OpenDotaRecentMatch[],
  heroStats: OpenDotaHeroStat[]
): TrendMetrics {
  // OpenDota returns newest-first; reverse to chronological order for trend charts.
  const chronological = [...matches].reverse();

  const sampleSize = matches.length;
  const wins = matches.filter(isWin).length;
  const totalKills = matches.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = matches.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = matches.reduce((s, m) => s + m.assists, 0);

  const avgGpm =
    sampleSize > 0
      ? matches.reduce((s, m) => s + m.gold_per_min, 0) / sampleSize
      : 0;
  const avgXpm =
    sampleSize > 0
      ? matches.reduce((s, m) => s + m.xp_per_min, 0) / sampleSize
      : 0;
  const avgDeaths = sampleSize > 0 ? totalDeaths / sampleSize : 0;
  const avgKda =
    totalDeaths === 0 ? totalKills + totalAssists : (totalKills + totalAssists) / totalDeaths;

  const roleDistribution: Record<string, number> = {};
  for (const m of matches) {
    if (!m.lane_role) continue;
    const name = LANE_ROLE_NAMES[m.lane_role] ?? "Unknown";
    roleDistribution[name] = (roleDistribution[name] ?? 0) + 1;
  }

  const rankedHeroes = heroStats
    .filter((h) => h.games >= MIN_GAMES_FOR_HERO_RANKING)
    .map((h) => ({
      heroId: h.hero_id,
      heroName: getHeroName(h.hero_id),
      games: h.games,
      winRate: h.games > 0 ? h.win / h.games : 0,
    }));

  const topHeroes = [...rankedHeroes]
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, HERO_LIST_SIZE);
  const worstHeroes = [...rankedHeroes]
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, HERO_LIST_SIZE);

  return {
    accountId,
    sampleSize,
    winRate: sampleSize > 0 ? wins / sampleSize : 0,
    avgKda: Math.round(avgKda * 100) / 100,
    avgGpm: Math.round(avgGpm),
    avgXpm: Math.round(avgXpm),
    avgDeaths: Math.round(avgDeaths * 100) / 100,
    gpmTrend: chronological.map((m, i) => ({ match: i + 1, value: m.gold_per_min })),
    xpmTrend: chronological.map((m, i) => ({ match: i + 1, value: m.xp_per_min })),
    deathsTrend: chronological.map((m, i) => ({ match: i + 1, value: m.deaths })),
    roleDistribution,
    topHeroes,
    worstHeroes,
    recentMatches: chronological.map(toMatchSummary).reverse(), // newest-first for the match list display
  };
}
