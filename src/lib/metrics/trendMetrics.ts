import { getHeroName } from "../constants";
import { comparableGames, isAnalysableMode, kindOfMatch, leftTheGame } from "./gameContext";
import { wilsonScoreLowerBound, wilsonScoreUpperBound } from "./statistics";
import type {
  OpenDotaHeroStat,
  OpenDotaRecentMatch,
  TrendHero,
  TrendMatchSummary,
  TrendMetrics,
  TrendSplit,
} from "../types";

// Below this a hero's win rate is mostly luck - 3-0 says nothing.
const MIN_GAMES_FOR_HERO_RANKING = 5;
const HERO_LIST_SIZE = 3;
// A wins/losses comparison needs a few of each to show a habit, not one game.
const MIN_GAMES_PER_SPLIT = 3;
export const HERO_WINDOW_DAYS = 90;

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
    gameMode: m.game_mode,
    leftGame: leftTheGame(m.leaver_status),
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
  // A game the player left, or a 1v1/event game, has nothing to review.
  const scored = matches.filter((m) => !m.leftGame && isAnalysableMode(m.gameMode)).map((m) => {
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

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function split(games: OpenDotaRecentMatch[]): TrendSplit {
  const gpm = average(games.map((m) => m.gold_per_min).filter((v): v is number => v !== undefined));
  const lhPerMin = average(
    games.filter((m) => typeof m.last_hits === "number" && m.duration > 0).map((m) => m.last_hits / (m.duration / 60))
  );
  return {
    games: games.length,
    avgKills: round1(average(games.map((m) => m.kills)) ?? 0),
    avgDeaths: round1(average(games.map((m) => m.deaths)) ?? 0),
    avgAssists: round1(average(games.map((m) => m.assists)) ?? 0),
    avgGpm: gpm !== null ? Math.round(gpm) : null,
    avgLastHitsPerMin: lhPerMin !== null ? round1(lhPerMin) : null,
  };
}

function rankHeroes(heroStats: OpenDotaHeroStat[]): { top: TrendHero[]; worst: TrendHero[] } {
  const heroes = heroStats
    .filter((h) => h.games >= MIN_GAMES_FOR_HERO_RANKING)
    .map((h) => ({
      hero: { heroId: h.hero_id, heroName: getHeroName(h.hero_id), games: h.games, winRate: h.win / h.games },
      lower: wilsonScoreLowerBound(h.win, h.games),
      upper: wilsonScoreUpperBound(h.win, h.games),
    }));
  // "Best" must win more than it loses and "worst" lose more than it wins:
  // otherwise a 50% hero lands on both lists just for being the only one.
  const top = heroes
    .filter((h) => h.hero.winRate > 0.5)
    .sort((a, b) => b.lower - a.lower)
    .slice(0, HERO_LIST_SIZE)
    .map((h) => h.hero);
  const worst = heroes
    .filter((h) => h.hero.winRate < 0.5)
    .sort((a, b) => a.upper - b.upper)
    .slice(0, HERO_LIST_SIZE)
    .map((h) => h.hero);
  return { top, worst };
}

/**
 * Averages over comparable recent games only (one kind of game, none the
 * player left), the wins-vs-losses split, and hero results ranked with their
 * sample size in mind. `heroStats` should be recent (see getRecentHeroStats);
 * pass none when the hero lists aren't needed.
 */
export function computeTrendMetrics(
  accountId: number,
  matches: OpenDotaRecentMatch[],
  heroStats: OpenDotaHeroStat[] = []
): TrendMetrics {
  const sample = comparableGames(matches, kindOfMatch);
  const games = sample.games;
  const sampleSize = games.length;
  const wins = games.filter(isWin);
  const losses = games.filter((m) => !isWin(m));
  const totalKills = games.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = games.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = games.reduce((s, m) => s + m.assists, 0);

  // OpenDota's match-list endpoint doesn't always include gold_per_min/
  // xp_per_min - average only over matches that actually have it, and
  // report null (never a fabricated 0) when none do.
  const avgGpm = average(games.map((m) => m.gold_per_min).filter((v): v is number => v !== undefined));
  const avgXpm = average(games.map((m) => m.xp_per_min).filter((v): v is number => v !== undefined));
  const avgKda = totalDeaths === 0 ? totalKills + totalAssists : (totalKills + totalAssists) / totalDeaths;
  const { top, worst } = rankHeroes(heroStats);

  return {
    accountId,
    sampleSize,
    turbo: sample.turbo,
    excludedGames: sample.excludedOtherMode + sample.excludedLeft,
    winRate: sampleSize > 0 ? wins.length / sampleSize : 0,
    avgKda: Math.round(avgKda * 100) / 100,
    avgGpm: avgGpm !== null ? Math.round(avgGpm) : null,
    avgXpm: avgXpm !== null ? Math.round(avgXpm) : null,
    avgDeaths: sampleSize > 0 ? Math.round((totalDeaths / sampleSize) * 100) / 100 : 0,
    winsVsLosses:
      wins.length >= MIN_GAMES_PER_SPLIT && losses.length >= MIN_GAMES_PER_SPLIT
        ? { wins: split(wins), losses: split(losses) }
        : null,
    heroWindowDays: HERO_WINDOW_DAYS,
    topHeroes: top,
    worstHeroes: worst,
    recentMatches: matches.map(toMatchSummary), // newest-first, every game, for the match lists
  };
}
