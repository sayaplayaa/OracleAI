import { cached } from "./cache";
import type {
  OpenDotaProfile,
  OpenDotaWinLoss,
  OpenDotaRecentMatch,
  OpenDotaHeroStat,
  OpenDotaMatch,
  OpenDotaBenchmarks,
  OpenDotaSearchResult,
  OpenDotaMatchupEntry,
  OpenDotaProPlayer,
  OpenDotaHeroLeagueMatch,
  ParseJobResponse,
} from "./types";

const BASE_URL = "https://api.opendota.com/api";

export class OpenDotaError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "OpenDotaError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  attempt = 1
): Promise<T> {
  const key = process.env.OPENDOTA_API_KEY;
  const url = new URL(BASE_URL + path);
  if (key) url.searchParams.set("api_key", key);

  const res = await fetch(url.toString(), {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * attempt));
    return request<T>(path, init, attempt + 1);
  }

  if (!res.ok) {
    throw new OpenDotaError(
      `OpenDota request failed: ${path} (${res.status})`,
      res.status
    );
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const MINUTE = 60_000;

export function getProfile(accountId: number) {
  return cached(`profile:${accountId}`, MINUTE, () =>
    request<OpenDotaProfile>(`/players/${accountId}`)
  );
}

export function getWinLoss(accountId: number) {
  return cached(`wl:${accountId}`, MINUTE, () =>
    request<OpenDotaWinLoss>(`/players/${accountId}/wl`)
  );
}

export function getRecentMatches(accountId: number, limit = 20, offset = 0) {
  return cached(`matches:${accountId}:${limit}:${offset}`, MINUTE, () =>
    request<OpenDotaRecentMatch[]>(
      `/players/${accountId}/matches?limit=${limit}&offset=${offset}`
    )
  );
}

export function getMatchesForHero(accountId: number, heroId: number, limit = 20) {
  return cached(`matches:${accountId}:hero:${heroId}:${limit}`, MINUTE, () =>
    request<OpenDotaRecentMatch[]>(
      `/players/${accountId}/matches?hero_id=${heroId}&limit=${limit}`
    )
  );
}

export function getHeroStats(accountId: number) {
  return cached(`heroes:${accountId}`, MINUTE, () =>
    request<OpenDotaHeroStat[]>(`/players/${accountId}/heroes`)
  );
}

export function getMatch(matchId: number) {
  // Finished match data never changes; cache generously.
  return cached(`match:${matchId}`, 60 * MINUTE, () =>
    request<OpenDotaMatch>(`/matches/${matchId}`)
  );
}

export function getBenchmarks(heroId: number) {
  return cached(`benchmarks:${heroId}`, 60 * MINUTE, () =>
    request<OpenDotaBenchmarks>(`/benchmarks?hero_id=${heroId}`)
  );
}

export function searchPlayers(query: string) {
  return cached(`search:${query.toLowerCase()}`, MINUTE, () =>
    request<OpenDotaSearchResult[]>(
      `/search?q=${encodeURIComponent(query)}`
    )
  );
}

export function getHeroMatchups(heroId: number) {
  return cached(`matchups:${heroId}`, 60 * MINUTE, () =>
    request<OpenDotaMatchupEntry[]>(`/heroes/${heroId}/matchups`)
  );
}

// Roster of accounts OpenDota tags as pro/notable competitive players. A
// large, slow-changing list - cache generously.
export function getProPlayers() {
  return cached("proPlayers", 6 * 60 * MINUTE, () =>
    request<OpenDotaProPlayer[]>("/proPlayers")
  );
}

// Recent matches for a hero, but only league/tournament games (every row
// has a leagueid) - the real "who's currently playing this hero in
// competition" feed, as opposed to /rankings' top public-match performers.
export function getHeroLeagueMatches(heroId: number) {
  return cached(`heroLeagueMatches:${heroId}`, 30 * MINUTE, () =>
    request<OpenDotaHeroLeagueMatch[]>(`/heroes/${heroId}/matches`)
  );
}

/** Triggers OpenDota to (re-)parse a match's replay. Not cached - each call queues a real job. */
export function requestMatchParse(matchId: number) {
  return request<ParseJobResponse>(`/request/${matchId}`, { method: "POST" });
}

/** Polls a parse job. OpenDota returns the job while it's queued/running and an empty body once done. */
export function getParseJobStatus(jobId: number) {
  return request<unknown>(`/request/${jobId}`);
}
