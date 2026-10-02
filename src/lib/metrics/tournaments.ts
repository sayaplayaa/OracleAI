import type { OpenDotaLeague, OpenDotaLiveMatch } from "../types";

export interface LiveTournamentMatch {
  matchId: string;
  leagueName: string;
  radiantName: string;
  direName: string;
  radiantScore: number;
  direScore: number;
  gameTimeSeconds: number;
}

/** Real currently-live tournament games only (league_id 0 = plain public game). */
export function computeLiveTournamentMatches(
  liveMatches: OpenDotaLiveMatch[],
  leagues: OpenDotaLeague[]
): LiveTournamentMatch[] {
  const leagueNameById = new Map(leagues.map((l) => [l.leagueid, l.name]));
  return liveMatches
    .filter((m) => m.league_id && m.league_id !== 0)
    .map((m) => ({
      matchId: m.match_id,
      leagueName: leagueNameById.get(m.league_id) ?? `Лига ${m.league_id}`,
      radiantName: m.team_name_radiant || "Силы Света",
      direName: m.team_name_dire || "Силы Тьмы",
      radiantScore: m.radiant_score,
      direScore: m.dire_score,
      gameTimeSeconds: m.game_time,
    }));
}
