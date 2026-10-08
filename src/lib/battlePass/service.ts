// The battle pass as the API serves it: issue this week's challenges, credit
// the games played since, award points once per completed challenge, and
// handle buying the pass and claiming rewards. Server-only.

import { getRecentMatches } from "../opendota";
import { comparableGames } from "../metrics/gameContext";
import { challengeTitle, countable, creditedMatches, describeChallenge, generateWeek, toPassMatch, type PassMatch } from "./challenges";
import { MAX_LEVEL, POINTS_PER_LEVEL, REWARDS, SEASON, SEASON_ENDS_AT, levelOf, weekEnd, weekOf } from "./season";
import { updatePlayer, type ChallengeRecord, type PlayerSeason } from "./store";
import type { BattlePassView, PassChallengeView, RewardView } from "./types";

// A week can hold many games; 50 covers even a heavy one.
const MATCHES_CHECKED = 50;
const HISTORY_SHOWN = 12;

export class PassError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function seasonRunning(now: number): boolean {
  const week = weekOf(now);
  return week >= 0 && week < SEASON.weeks;
}

function devUnlock(): boolean {
  return process.env.BATTLE_PASS_DEV_UNLOCK === "1";
}

function challengeView(c: ChallengeRecord, now: number): PassChallengeView {
  const ends = weekEnd(c.week);
  return {
    id: c.id,
    type: c.type,
    title: challengeTitle(c),
    description: describeChallenge(c),
    difficulty: c.difficulty,
    points: c.points,
    progress: Math.min(c.required, c.matchIds.length),
    required: c.required,
    status: c.completedAt ? "completed" : now >= ends ? "expired" : "active",
    endsAt: ends,
    matchIds: c.matchIds,
    turbo: c.turbo,
  };
}

function form(matches: PassMatch[] | null): BattlePassView["form"] {
  if (!matches) return null;
  const sample = comparableGames(
    matches.filter((m) => countable(m, false) || countable(m, true)),
    (m) => ({ gameMode: m.gameMode, left: m.left })
  );
  const games = sample.games.slice(0, 20);
  if (games.length === 0) return null;
  const n = games.length;
  return {
    games: n,
    turbo: sample.turbo,
    winRate: Math.round((games.filter((m) => m.win).length / n) * 100),
    deaths: games.reduce((s, m) => s + m.deaths, 0) / n,
    kda: games.reduce((s, m) => s + (m.kills + m.assists) / Math.max(1, m.deaths), 0) / n,
  };
}

function toView(p: PlayerSeason, matches: PassMatch[] | null, now: number, notice: string | null): BattlePassView {
  const level = levelOf(p.points);
  const week = weekOf(now);
  const rewards: RewardView[] = REWARDS.map((r) => {
    const claim = p.claims.find((c) => c.level === r.level);
    return {
      ...r,
      state: claim ? claim.status : level < r.level ? "locked" : p.passOwned ? "available" : "need_pass",
      ...(claim ? { claimedAt: claim.requestedAt, ...(claim.choice ? { choice: claim.choice } : {}) } : {}),
    };
  });
  const views = p.challenges.map((c) => challengeView(c, now));
  return {
    season: {
      id: SEASON.id,
      name: SEASON.name,
      startsAt: SEASON.startsAt,
      endsAt: SEASON_ENDS_AT,
      week,
      weeks: SEASON.weeks,
      weekEndsAt: seasonRunning(now) ? weekEnd(week) : null,
    },
    level,
    maxLevel: MAX_LEVEL,
    points: p.points,
    pointsPerLevel: POINTS_PER_LEVEL,
    pointsInLevel: level >= MAX_LEVEL ? POINTS_PER_LEVEL : p.points % POINTS_PER_LEVEL,
    pass: {
      owned: p.passOwned,
      since: p.passSince ?? null,
      purchase: { available: devUnlock() || SEASON.price !== null, devUnlock: devUnlock(), price: SEASON.price },
    },
    rewards,
    challenges: {
      current: views.filter((c) => p.challenges.find((x) => x.id === c.id)!.week === week),
      past: views.filter((c) => p.challenges.find((x) => x.id === c.id)!.week !== week).reverse(),
    },
    history: [...p.history].reverse().slice(0, HISTORY_SHOWN),
    form: form(matches),
    notice,
  };
}

/** The player's pass, with this week's challenges issued and new games credited. */
export async function battlePassFor(accountId: number): Promise<BattlePassView> {
  const now = Date.now();
  let matches: PassMatch[] | null = null;
  let notice: string | null = null;
  try {
    matches = (await getRecentMatches(accountId, MATCHES_CHECKED)).map(toPassMatch);
  } catch {
    notice = "Не удалось загрузить твои матчи из OpenDota - новые игры засчитаем, когда она снова ответит.";
  }

  const { player } = await updatePlayer(accountId, SEASON.id, (p) => {
    const week = weekOf(now);
    if (matches && seasonRunning(now) && !p.challenges.some((c) => c.week === week)) {
      p.challenges.push(...generateWeek(matches, week, now));
    }
    for (const c of p.challenges) {
      if (c.completedAt) continue;
      c.matchIds = creditedMatches(c, matches, p.reviews);
      if (c.matchIds.length >= c.required) {
        c.completedAt = now;
        p.points += c.points;
        p.history.push({ at: now, points: c.points, title: challengeTitle(c) });
      }
    }
  });
  if (!notice && matches && matches.length === 0) {
    notice = "Не видно ни одной недавней игры. Включи в Dota 2 опцию «Expose Public Match Data» - без неё игры не засчитываются.";
  }
  return toView(player, matches, now, notice);
}

/**
 * Activates the pass. Payment isn't connected yet (one-time pass or
 * subscription is still to be decided), so for now only a test setup with
 * BATTLE_PASS_DEV_UNLOCK=1 can do it.
 */
export async function purchasePass(accountId: number): Promise<BattlePassView> {
  if (!devUnlock()) {
    throw new PassError("Покупка боевого пропуска ещё не подключена.", 501);
  }
  await updatePlayer(accountId, SEASON.id, (p) => {
    if (!p.passOwned) {
      p.passOwned = true;
      p.passSince = Date.now();
    }
  });
  return battlePassFor(accountId);
}

// A Steam trade link carries the 32-bit account id as `partner`: it must be
// the signed-in player's own, or an item could be claimed for someone else.
const TRADE_URL = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=(\d+)&token=([A-Za-z0-9_-]{6,})$/;

export async function claimReward(
  accountId: number,
  input: { level: number; tradeUrl?: string; choice?: string }
): Promise<BattlePassView> {
  const reward = REWARDS.find((r) => r.level === input.level);
  if (!reward) throw new PassError("Такой награды нет.", 400);
  const tradeUrl = input.tradeUrl?.trim();
  const choice = input.choice?.trim();
  if (reward.needsTradeUrl) {
    const m = tradeUrl ? TRADE_URL.exec(tradeUrl) : null;
    if (!m) throw new PassError("Нужна ссылка на обмен Steam вида https://steamcommunity.com/tradeoffer/new/?partner=…&token=…", 400);
    if (Number(m[1]) !== accountId) throw new PassError("Ссылка на обмен должна быть от твоего аккаунта Steam.", 400);
  }
  if (reward.needsChoice && (!choice || choice.length > 120)) {
    throw new PassError("Напиши, какой предмет или на какого героя ты хочешь получить награду.", 400);
  }

  await updatePlayer(accountId, SEASON.id, (p) => {
    if (!p.passOwned) throw new PassError("Награды забираются с активным боевым пропуском.", 403);
    if (levelOf(p.points) < reward.level) throw new PassError(`Эта награда открывается на ${reward.level} уровне.`, 403);
    if (p.claims.some((c) => c.level === reward.level)) throw new PassError("Эта награда уже получена.", 409);
    p.claims.push({
      level: reward.level,
      requestedAt: Date.now(),
      status: "pending",
      ...(reward.needsTradeUrl ? { tradeUrl } : {}),
      ...(reward.needsChoice ? { choice } : {}),
    });
  });
  return battlePassFor(accountId);
}

/** The player opened an AI review of one of their own games - counts for review challenges. */
export async function recordReview(accountId: number, matchId: number): Promise<void> {
  const now = Date.now();
  if (!seasonRunning(now)) return;
  await updatePlayer(accountId, SEASON.id, (p) => {
    if (!p.reviews.some((r) => r.matchId === matchId)) p.reviews.push({ matchId, at: now });
  });
}
