import { getHeroName } from "../constants";
import { isWin } from "./trendMetrics";
import type {
  OpenDotaHeroLeagueMatch,
  OpenDotaHeroStat,
  OpenDotaProPlayer,
  OpenDotaRecentMatch,
  ProHeroLeagueGame,
  ProHeroSpotlight,
} from "../types";

export interface ProIdentity {
  accountId: number;
  name: string;
  teamName: string | null;
}

// A player counts as "currently active" (playing in tournaments right now)
// when their Fantasy Dota roster is locked for an ongoing period, they're on
// a real team, and they've actually played recently - not just tagged pro
// at some point in OpenDota's history.
const ACTIVE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

function isActivePro(p: OpenDotaProPlayer): boolean {
  if (!p.is_locked) return false;
  if (!p.team_id) return false;
  if (!p.last_match_time) return false;
  return Date.now() - new Date(p.last_match_time).getTime() <= ACTIVE_WINDOW_MS;
}

/**
 * Picks a real player from the hero's recent league/tournament games
 * (never OpenDota's public-ladder /rankings, which mixes in grinders who
 * aren't actual pros) - prefers a currently-active competitive player, and
 * falls back to any OpenDota-tagged pro who's shown up in a recent league
 * game with this hero. Returns every league game found for that player on
 * this hero as the "showcase" sample - real tournament games, not pubs.
 */
export function findProForHero(
  leagueMatches: OpenDotaHeroLeagueMatch[],
  proPlayers: OpenDotaProPlayer[]
): { pro: ProIdentity; leagueGames: ProHeroLeagueGame[] } | null {
  const proById = new Map(proPlayers.map((p) => [p.account_id, p]));

  const withKnownPro = [...leagueMatches]
    .filter((m) => proById.has(m.account_id))
    .sort((a, b) => b.start_time - a.start_time);

  const activeFirst = withKnownPro.find((m) => isActivePro(proById.get(m.account_id)!));
  const chosen = activeFirst ?? withKnownPro[0];
  if (!chosen) return null;

  const proInfo = proById.get(chosen.account_id)!;
  const leagueGames: ProHeroLeagueGame[] = withKnownPro
    .filter((m) => m.account_id === chosen.account_id)
    .map((m) => ({
      matchId: m.match_id,
      win: m.radiant === m.radiant_win,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      duration: m.duration,
      startTime: m.start_time,
      leagueName: m.league_name,
    }));

  return {
    pro: {
      accountId: chosen.account_id,
      name: proInfo.name || "Unknown pro",
      teamName: proInfo.team_name || null,
    },
    leagueGames,
  };
}

export function computeProHeroSpotlight(
  heroId: number,
  pro: ProIdentity,
  heroStat: OpenDotaHeroStat | undefined,
  matches: OpenDotaRecentMatch[],
  leagueGames: ProHeroLeagueGame[]
): ProHeroSpotlight {
  const games = heroStat?.games ?? matches.length;
  const winsFromStat = heroStat?.win;
  const winRate =
    winsFromStat !== undefined && games > 0
      ? winsFromStat / games
      : matches.length > 0
        ? matches.filter(isWin).length / matches.length
        : 0;

  const totalKills = matches.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = matches.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = matches.reduce((s, m) => s + m.assists, 0);
  const avgKda =
    totalDeaths === 0
      ? totalKills + totalAssists
      : (totalKills + totalAssists) / totalDeaths;

  return {
    heroId,
    heroName: getHeroName(heroId),
    pro,
    games,
    winRate,
    avgKda: Math.round(avgKda * 100) / 100,
    avgGpm: averageDefined(matches.map((m) => m.gold_per_min)),
    avgXpm: averageDefined(matches.map((m) => m.xp_per_min)),
    leagueGames: [...leagueGames].sort((a, b) => b.startTime - a.startTime).slice(0, 5),
  };
}

function averageDefined(values: (number | undefined)[]): number | null {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length > 0
    ? Math.round(defined.reduce((s, v) => s + v, 0) / defined.length)
    : null;
}
