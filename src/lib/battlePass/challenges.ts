// Weekly battle pass challenges: generated from the player's own recent games
// (a bit above their current average) and checked only against real games
// played after they were issued. Rule-based on purpose - these are exact
// numeric bars that unlock real rewards.

import { getHeroName } from "../constants";
import { pluralRu } from "../format";
import { comparableGames, inFamily, leftTheGame } from "../metrics/gameContext";
import type { OpenDotaRecentMatch } from "../types";
import { weekEnd } from "./season";
import type { ChallengeRecord } from "./store";
import type { PassChallengeType } from "./types";

export interface PassMatch {
  matchId: number;
  heroId: number;
  heroName: string;
  win: boolean;
  // Unix seconds.
  startTime: number;
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number | null;
  lastHits: number;
  gameMode: number;
  lobbyType: number;
  left: boolean;
}

export function toPassMatch(m: OpenDotaRecentMatch): PassMatch {
  return {
    matchId: m.match_id,
    heroId: m.hero_id,
    heroName: getHeroName(m.hero_id),
    win: (m.player_slot < 128) === m.radiant_win,
    startTime: m.start_time,
    duration: m.duration,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    gpm: m.gold_per_min ?? null,
    lastHits: m.last_hits ?? 0,
    gameMode: m.game_mode,
    lobbyType: m.lobby_type,
    left: leftTheGame(m.leaver_status),
  };
}

// Public matchmaking and ranked only: lobby and bot games are too easy to
// stage, and the rewards are real.
const COUNTED_LOBBIES = new Set([0, 7]);
const MIN_SAMPLE = 5;
const SAMPLE = 20;

const POINTS = { easy: 250, wins: 400, medium: 500, hard: 800 } as const;

/** A game that may count toward a challenge at all. */
export function countable(m: PassMatch, turbo: boolean): boolean {
  return (
    COUNTED_LOBBIES.has(m.lobbyType) &&
    !m.left &&
    inFamily(m.gameMode, turbo) &&
    m.duration >= (turbo ? 600 : 900)
  );
}

function kda(m: PassMatch): number {
  return (m.kills + m.assists) / Math.max(1, m.deaths);
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The challenges issued for one week. */
export function generateWeek(matches: PassMatch[], week: number, now: number): ChallengeRecord[] {
  const counted = matches.filter((m) => COUNTED_LOBBIES.has(m.lobbyType));
  const sample = comparableGames(counted, (m) => ({ gameMode: m.gameMode, left: m.left }));
  const games = sample.games.slice(0, SAMPLE);
  const turbo = sample.turbo;
  const make = (c: Omit<ChallengeRecord, "id" | "week" | "issuedAt" | "matchIds" | "turbo">): ChallengeRecord => ({
    ...c,
    id: `w${week}-${c.type}`,
    week,
    issuedAt: now,
    matchIds: [],
    turbo,
  });

  const list: ChallengeRecord[] = [];
  if (games.length >= MIN_SAMPLE) {
    const deaths = avg(games.map((m) => m.deaths));
    list.push(
      make({
        type: "fewer_deaths",
        difficulty: "medium",
        points: POINTS.medium,
        // Clamped: a target set from games fed on purpose stays a real goal.
        target: clamp(Math.round(deaths) - (deaths > 4 ? 2 : 1), 2, 7),
        required: 1,
        baseline: deaths,
      })
    );
    const kdas = avg(games.map(kda));
    list.push(
      make({
        type: "kda",
        difficulty: "medium",
        points: POINTS.medium,
        target: clamp(Math.round(kdas * 1.3 * 10) / 10, 2, 10),
        required: 1,
        baseline: kdas,
      })
    );
    const byHero = new Map<number, PassMatch[]>();
    for (const m of games) byHero.set(m.heroId, [...(byHero.get(m.heroId) ?? []), m]);
    const [heroId, heroGames] = [...byHero.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const gpms = heroGames.map((m) => m.gpm).filter((v): v is number => v !== null);
    if (heroGames.length >= 2 && gpms.length > 0) {
      const gpm = avg(gpms);
      list.push(
        make({
          type: "hero_gpm",
          difficulty: "medium",
          points: POINTS.medium,
          target: Math.max(turbo ? 600 : 350, Math.round((gpm * 1.1) / 10) * 10),
          required: 1,
          baseline: gpm,
          heroId,
          heroName: heroGames[0].heroName,
        })
      );
    }
    const lhPerMin = avg(games.map((m) => m.lastHits / Math.max(1, m.duration / 60)));
    // Cores farm; for everyone else three clean games is the harder goal.
    list.push(
      lhPerMin >= 4
        ? make({
            type: "last_hits",
            difficulty: "hard",
            points: POINTS.hard,
            target: Math.max(4, Math.round(lhPerMin * 1.1 * 2) / 2),
            required: 1,
            baseline: lhPerMin,
          })
        : make({
            type: "clean_streak",
            difficulty: "hard",
            points: POINTS.hard,
            target: clamp(Math.round(deaths), 3, 8),
            required: 3,
            baseline: deaths,
          })
    );
  } else {
    list.push(make({ type: "clean_streak", difficulty: "hard", points: POINTS.hard, target: 6, required: 3 }));
  }
  list.push(make({ type: "wins", difficulty: "easy", points: POINTS.wins, target: 0, required: 2 }));
  list.push(make({ type: "review", difficulty: "easy", points: POINTS.easy, target: 0, required: 1 }));
  return list;
}

function meets(c: ChallengeRecord, m: PassMatch): boolean {
  switch (c.type) {
    case "fewer_deaths":
      return m.deaths < c.target;
    case "clean_streak":
      return m.deaths <= c.target;
    case "kda":
      return kda(m) > c.target;
    case "hero_gpm":
      return m.heroId === c.heroId && m.gpm !== null && m.gpm >= c.target;
    case "last_hits":
      return m.lastHits / Math.max(1, m.duration / 60) >= c.target;
    case "wins":
      return m.win;
    default:
      return false;
  }
}

/**
 * Games (or reviewed games) that count toward a challenge so far: played
 * after it was issued and before its week ended. Games credited earlier are
 * kept even when they drop out of the fetched list.
 */
export function creditedMatches(
  c: ChallengeRecord,
  matches: PassMatch[] | null,
  reviews: { matchId: number; at: number }[]
): number[] {
  const until = weekEnd(c.week);
  const ids = new Set(c.matchIds);
  if (c.type === "review") {
    for (const r of reviews) if (r.at >= c.issuedAt && r.at < until) ids.add(r.matchId);
  } else {
    for (const m of matches ?? []) {
      const at = m.startTime * 1000;
      if (at > c.issuedAt && at < until && countable(m, c.turbo) && meets(c, m)) ids.add(m.matchId);
    }
  }
  return [...ids];
}

// ---- What the player reads ----

function num(v: number, digits = 1): string {
  return v.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

const TITLES: Record<PassChallengeType, string> = {
  fewer_deaths: "Меньше смертей",
  clean_streak: "Три чистые игры",
  kda: "Прорыв по KDA",
  hero_gpm: "Фарм на основном герое",
  last_hits: "Добивания",
  wins: "Победы",
  review: "Разбор с ИИ-тренером",
};

export function challengeTitle(c: ChallengeRecord): string {
  return c.type === "hero_gpm" && c.heroName ? `Фарм на ${c.heroName}` : TITLES[c.type];
}

export function describeChallenge(c: ChallengeRecord): string {
  const mean = c.baseline !== undefined ? c.baseline : null;
  const mode = c.turbo && c.type !== "review" ? " Засчитываются только игры в Turbo." : "";
  switch (c.type) {
    case "fewer_deaths":
      return `Закончи игру, умерев меньше ${c.target} ${pluralRu(c.target, ["раза", "раз", "раз"])}.${mean !== null ? ` Твоё среднее сейчас - ${num(mean)}.` : ""}${mode}`;
    case "clean_streak":
      return `Сыграй ${c.required} игры, в каждой умирая не больше ${c.target} ${pluralRu(c.target, ["раза", "раз", "раз"])}.${mean !== null ? ` Твоё среднее сейчас - ${num(mean)}.` : ""}${mode}`;
    case "kda":
      return `Сыграй игру с KDA выше ${num(c.target)}.${mean !== null ? ` Твоё среднее сейчас - ${num(mean, 2)}.` : ""}${mode}`;
    case "hero_gpm":
      return `Набери ${c.target.toLocaleString("ru-RU")}+ золота в минуту в игре на ${c.heroName}.${mean !== null ? ` Твоё среднее на нём - ${Math.round(mean).toLocaleString("ru-RU")}.` : ""}${mode}`;
    case "last_hits":
      // "4,5 крипа", "4 крипа", "11 крипов".
      return `Добивай в среднем ${num(c.target)} ${Number.isInteger(c.target) ? pluralRu(c.target, ["крипа", "крипа", "крипов"]) : "крипа"} в минуту за всю игру - например, ${Math.round(c.target * 30)} добиваний к 30:00.${mean !== null ? ` Твоё среднее сейчас - ${num(mean)}.` : ""}${mode}`;
    case "wins":
      return `Выиграй ${c.required} ${pluralRu(c.required, ["игру", "игры", "игр"])}.${mode}`;
    case "review":
      return "Открой разбор с ИИ-тренером для своей игры, которую ещё не разбирал.";
  }
}
