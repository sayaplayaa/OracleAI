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
    gpm: m.gold_per_min ?? null,
    xpm: m.xp_per_min ?? null,
  };
}

/**
 * Picks the matches most worth reviewing out of a pool, rather than just the
 * most recent N: losses are weighted highest (the most instructive to break
 * down), then games where KDA or deaths were notably worse than the
 * player's own average. Returned newest-first.
 */
export function selectNotableMatches(
  matches: TrendMatchSummary[],
  avgKda: number,
  count: number
): TrendMatchSummary[] {
  const scored = matches.map((m) => {
    const kda = m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths;
    const score =
      (m.win ? 0 : 3) + // losses are the most useful to analyze
      Math.max(0, avgKda - kda) + // underperformed your own average KDA
      (m.deaths >= 10 ? 2 : 0); // unusually death-heavy game
    return { match: m, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.match)
    .sort((a, b) => b.startTime - a.startTime);
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

  // OpenDota's match-list endpoint doesn't always include gold_per_min/
  // xp_per_min - average only over matches that actually have it, and
  // report null (never a fabricated 0) when none do.
  const gpmSamples = matches
    .map((m) => m.gold_per_min)
    .filter((v): v is number => v !== undefined);
  const xpmSamples = matches
    .map((m) => m.xp_per_min)
    .filter((v): v is number => v !== undefined);
  const avgGpm =
    gpmSamples.length > 0
      ? gpmSamples.reduce((s, v) => s + v, 0) / gpmSamples.length
      : null;
  const avgXpm =
    xpmSamples.length > 0
      ? xpmSamples.reduce((s, v) => s + v, 0) / xpmSamples.length
      : null;
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
    avgGpm: avgGpm !== null ? Math.round(avgGpm) : null,
    avgXpm: avgXpm !== null ? Math.round(avgXpm) : null,
    avgDeaths: Math.round(avgDeaths * 100) / 100,
    gpmTrend: chronological
      .map((m, i) => ({ match: i + 1, value: m.gold_per_min }))
      .filter((p): p is { match: number; value: number } => p.value !== undefined),
    xpmTrend: chronological
      .map((m, i) => ({ match: i + 1, value: m.xp_per_min }))
      .filter((p): p is { match: number; value: number } => p.value !== undefined),
    deathsTrend: chronological.map((m, i) => ({ match: i + 1, value: m.deaths })),
    roleDistribution,
    topHeroes,
    worstHeroes,
    recentMatches: chronological.map(toMatchSummary).reverse(), // newest-first for the match list display
  };
}
