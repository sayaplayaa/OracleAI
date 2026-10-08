// The current season: dates, levels and the reward track. Everything a
// season is made of lives here, so the next one is a change to this file.

import type { RewardKind } from "./types";

export const SEASON = {
  id: "s1",
  name: "Сезон 1",
  // Mondays, 00:00 UTC (03:00 Moscow): new weekly challenges arrive then.
  startsAt: Date.UTC(2026, 9, 5),
  weeks: 12,
  // TBD: one-time pass or subscription, and its price. Null = not on sale yet.
  price: null as string | null,
};

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const SEASON_ENDS_AT = SEASON.startsAt + SEASON.weeks * WEEK_MS;

export const POINTS_PER_LEVEL = 1000;
export const MAX_LEVEL = 30;

export interface Reward {
  level: number;
  kind: RewardKind;
  title: string;
  description: string;
  needsChoice: boolean;
  needsTradeUrl: boolean;
}

// PLACEHOLDER rewards: set the real ones (and check what each costs against
// the pass price) before the season goes on sale. Items are sent by hand as
// a Steam trade offer; Dota Plus as a Steam gift.
export const REWARDS: Reward[] = [
  { level: 3, kind: "wards", title: "Скин на варды", description: "Набор Observer и Sentry Ward на выбор.", needsChoice: true, needsTradeUrl: true },
  { level: 6, kind: "hero_set", title: "Сет на героя", description: "Обычный (Common/Uncommon) сет на любого героя.", needsChoice: true, needsTradeUrl: true },
  { level: 9, kind: "taunt", title: "Насмешка", description: "Taunt на героя на выбор.", needsChoice: true, needsTradeUrl: true },
  { level: 12, kind: "dota_plus", title: "Dota Plus на месяц", description: "Подписка Dota Plus на 1 месяц - придёт подарком в Steam.", needsChoice: false, needsTradeUrl: false },
  { level: 15, kind: "rare_set", title: "Редкий сет", description: "Rare или Mythical сет на героя на выбор.", needsChoice: true, needsTradeUrl: true },
  { level: 20, kind: "courier", title: "Курьер", description: "Курьер на выбор.", needsChoice: true, needsTradeUrl: true },
  { level: 25, kind: "immortal", title: "Immortal-предмет", description: "Immortal-предмет на героя на выбор.", needsChoice: true, needsTradeUrl: true },
  { level: 30, kind: "arcana", title: "Arcana", description: "Arcana на героя на выбор - главная награда сезона.", needsChoice: true, needsTradeUrl: true },
];

/** Level 1 at 0 points, +1 every POINTS_PER_LEVEL, up to MAX_LEVEL. */
export function levelOf(points: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, points) / POINTS_PER_LEVEL));
}

/** 0-based week of the season at `now`; -1 before it, SEASON.weeks after it. */
export function weekOf(now: number): number {
  if (now < SEASON.startsAt) return -1;
  return Math.min(SEASON.weeks, Math.floor((now - SEASON.startsAt) / WEEK_MS));
}

export function weekEnd(week: number): number {
  return SEASON.startsAt + (week + 1) * WEEK_MS;
}
