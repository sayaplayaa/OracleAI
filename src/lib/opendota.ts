import { cached, invalidate } from "./cache";
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
  OpenDotaProMatch,
  OpenDotaLiveMatch,
  OpenDotaLeague,
  ParseJobResponse,
} from "./types";

const BASE_URL = "https://api.opendota.com/api";

export class OpenDotaError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "OpenDotaError";
  }
}

// Cloudflare-fronted gateway/timeout codes - OpenDota's origin blipping, not
// a real client error, so retrying (unlike a 404/400) is worth it. Distinct
// from the 429 handling below since these aren't a rate limit.
const TRANSIENT_STATUS = new Set([502, 503, 504, 522, 524]);
const MAX_TRANSIENT_ATTEMPTS = 3;

// A stalled connection (e.g. an ISP cutting Cloudflare flows after ~25 KB) never
// errors on its own; without a deadline fetch hangs for Node's 5-minute default.
const REQUEST_TIMEOUT_MS = 15_000;

function stalledError(path: string, err: unknown): OpenDotaError {
  const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
  return new OpenDotaError(
    timedOut
      ? `OpenDota не отвечает дольше ${REQUEST_TIMEOUT_MS / 1000} с: ${path} (соединение зависло - возможно, провайдер режет сервисы за Cloudflare; помогает VPN)`
      : `Не удался запрос к OpenDota: ${path} (${err instanceof Error ? err.message : "ошибка сети"})`
  );
}

async function request<T>(
  path: string,
  init?: RequestInit,
  attempt = 1
): Promise<T> {
  const key = process.env.OPENDOTA_API_KEY;
  const url = new URL(BASE_URL + path);
  if (key) url.searchParams.set("api_key", key);

  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
      signal,
    });
  } catch (err) {
    throw stalledError(path, err);
  }

  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * attempt));
    return request<T>(path, init, attempt + 1);
  }

  if (TRANSIENT_STATUS.has(res.status) && attempt < MAX_TRANSIENT_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, 750 * attempt));
    return request<T>(path, init, attempt + 1);
  }

  if (!res.ok) {
    throw new OpenDotaError(
      `Не удался запрос к OpenDota: ${path} (${res.status})`,
      res.status
    );
  }

  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    throw stalledError(path, err);
  }
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

// The match list only returns a few columns unless the rest are asked for:
// without this, GPM/XPM, last hits and lane role were missing for every game,
// so the trends, hero and pro-comparison coaches all saw "no data" for them.
const MATCH_LIST_PROJECTION = [
  "match_id", "player_slot", "radiant_win", "duration", "game_mode", "lobby_type", "hero_id",
  "start_time", "kills", "deaths", "assists", "average_rank", "party_size", "gold_per_min",
  "xp_per_min", "last_hits", "hero_damage", "tower_damage", "hero_healing", "lane", "lane_role",
  "is_roaming", "leaver_status",
]
  .map((field) => `project=${field}`)
  .join("&");

// The player's real last games, Turbo included. OpenDota's default
// ("significant") filter silently drops Turbo, so a player who mostly plays
// Turbo saw weeks-old games under "your last games". Callers that average
// stats pick comparable games themselves (see comparableGames).
export function getRecentMatches(accountId: number, limit = 20, offset = 0) {
  return cached(`matches:v3:${accountId}:${limit}:${offset}`, MINUTE, () =>
    request<OpenDotaRecentMatch[]>(
      `/players/${accountId}/matches?limit=${limit}&offset=${offset}&significant=0&${MATCH_LIST_PROJECTION}`
    )
  );
}

// Standard games only (OpenDota's default filter): the hero and pro reports
// compare against normal-game numbers, which Turbo's economy would distort.
export function getMatchesForHero(accountId: number, heroId: number, limit = 20) {
  return cached(`matches:v2:${accountId}:hero:${heroId}:${limit}`, MINUTE, () =>
    request<OpenDotaRecentMatch[]>(
      `/players/${accountId}/matches?hero_id=${heroId}&limit=${limit}&${MATCH_LIST_PROJECTION}`
    )
  );
}

export function getHeroStats(accountId: number) {
  return cached(`heroes:${accountId}`, MINUTE, () =>
    request<OpenDotaHeroStat[]>(`/players/${accountId}/heroes`)
  );
}

// Per-hero results over the last `days` days: big enough samples to rank
// heroes, unlike the last 20 games, and current, unlike the lifetime totals
// (which rank a hero last played years ago at 3-0 first). Normal games by
// default; `turbo` asks for Turbo games only.
export function getRecentHeroStats(accountId: number, days = 90, turbo = false) {
  const mode = turbo ? "&game_mode=23&significant=0" : "";
  return cached(`heroes:${accountId}:${days}d${turbo ? ":turbo" : ""}`, 10 * MINUTE, () =>
    request<OpenDotaHeroStat[]>(`/players/${accountId}/heroes?date=${days}${mode}`)
  );
}

export function getMatch(matchId: number) {
  // Finished match data never changes; cache generously.
  return cached(`match:${matchId}`, 60 * MINUTE, () =>
    request<OpenDotaMatch>(`/matches/${matchId}`)
  );
}

// Same real field the Full Match tab already uses to decide whether to show
// the "Request full parse" button - present only once OpenDota has actually
// parsed the replay.
export function isMatchParsed(match: OpenDotaMatch): boolean {
  return Array.isArray(match.radiant_gold_adv);
}

/**
 * If a match hasn't been parsed yet, request a parse and poll until it
 * finishes (or we give up), then return a fresh (cache-bypassed) copy -
 * real death/teamfight/item data instead of the AI coach having nothing to
 * work with. Best-effort: on timeout or a parse failure, returns whatever we
 * have (still unparsed) rather than throwing, so the caller can fall back to
 * the honest "no timeline data" report instead of erroring out.
 */
export async function ensureMatchParsed(
  matchId: number,
  match: OpenDotaMatch
): Promise<OpenDotaMatch> {
  if (isMatchParsed(match)) return match;

  let jobId: number | undefined;
  try {
    const job = await requestMatchParse(matchId);
    jobId = job?.job?.jobId;
  } catch {
    return match;
  }
  if (!jobId) return match;

  const POLL_INTERVAL_MS = 4000;
  const MAX_ATTEMPTS = 20; // ~80s, matching the manual "Request full parse" button's budget
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let done: boolean;
    try {
      done = (await getParseJobStatus(jobId)) === null;
    } catch {
      return match;
    }
    if (done) {
      invalidate(`match:${matchId}`);
      try {
        return await getMatch(matchId);
      } catch {
        return match;
      }
    }
  }
  return match;
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

// Recent finished tournament/league matches - real results, not pubs.
export function getProMatches() {
  return cached("proMatches", 5 * MINUTE, () => request<OpenDotaProMatch[]>("/proMatches"));
}

// Currently-live spectatable games (mostly public; filter to league_id != 0
// for real tournament games, which OpenDota only tracks sparsely).
export function getLiveMatches() {
  return cached("liveMatches", MINUTE, () => request<OpenDotaLiveMatch[]>("/live"));
}

// League metadata (name, tier) - large and slow-changing, cache generously.
// Used to resolve /live's league_id to a real league name.
export function getLeagues() {
  return cached("leagues", 24 * 60 * MINUTE, () => request<OpenDotaLeague[]>("/leagues"));
}

/** Triggers OpenDota to (re-)parse a match's replay. Not cached - each call queues a real job. */
export function requestMatchParse(matchId: number) {
  return request<ParseJobResponse>(`/request/${matchId}`, { method: "POST" });
}

/** Polls a parse job. OpenDota returns the job while it's queued/running and an empty body once done. */
export function getParseJobStatus(jobId: number) {
  return request<unknown>(`/request/${jobId}`);
}
