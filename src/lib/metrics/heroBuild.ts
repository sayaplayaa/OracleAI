import {
  getAbilityNameById,
  getHeroName,
  getHeroTalents,
  getItemKeyById,
  getItemNameByKey,
  getItemTier,
} from "../constants";
import { getTalentLabel } from "../talents";
import { wilsonScoreLowerBound } from "./statistics";
import type {
  StratzHeroBuild,
  StratzHeroPositionStat,
  StratzItemStat,
  StratzNeutralItemStat,
  StratzTalentStat,
} from "../stratz";
import type {
  HeroBuildOverview,
  HeroRoleOverview,
  ItemProgressionPoint,
  ItemStat,
  MetaTierEntry,
  NeutralItemTier,
  RolePickStat,
  TalentLevel,
} from "../types";

const ROLE_LABELS: Record<string, string> = {
  POSITION_1: "Керри",
  POSITION_2: "Мид",
  POSITION_3: "Оффлейн",
  POSITION_4: "Поддержка",
  POSITION_5: "Хард-саппорт",
};

export function roleLabelForPosition(position: string): string {
  const label = ROLE_LABELS[position];
  if (label) return label;
  if (!position) return "Неизвестно";
  const match = position.match(/POSITION_(\d)/);
  return match ? `Позиция ${match[1]}` : position;
}

const MIN_GAMES_FOR_ROLE = 5;
const CORE_ITEM_PICK_RATE = 0.25;
const MIN_ITEM_PICK_RATE = 0.05;
const NEUTRAL_ITEMS_PER_TIER = 5;

export function computeHeroRoleOverview(
  heroId: number,
  stats: StratzHeroPositionStat[]
): HeroRoleOverview {
  const roles: RolePickStat[] = stats
    .filter((s) => s.position && s.matchCount >= MIN_GAMES_FOR_ROLE)
    .map((s) => ({
      position: s.position,
      roleLabel: roleLabelForPosition(s.position),
      games: s.matchCount,
      winRate: s.matchCount > 0 ? s.winCount / s.matchCount : 0,
    }))
    .sort((a, b) => a.position.localeCompare(b.position));

  return { heroId, heroName: getHeroName(heroId), roles };
}

// STRATZ's stats query is already restricted to Legend+ brackets (see
// META_BRACKETS in stratz.ts), but "position" itself is STRATZ's own
// per-match classifier inferred from farm priority, not a ground-truth
// drafted role - a hero who happens to out-farm a bad teammate can get
// mislabeled into a position they were never actually played for. Verified
// empirically: real, deliberately-played meta picks cluster at 16,000+ games
// a week even in this one bracket, while classifier noise (e.g. Leshrac
// showing up as "Position 1") tops out in the hundreds - a 1,000-game floor
// sits cleanly in that gap without cutting real smaller-but-legitimate picks.
const MIN_GAMES_FOR_META = 1000;
const HEROES_PER_POSITION = 8;
const META_POSITIONS = ["POSITION_1", "POSITION_2", "POSITION_3", "POSITION_4", "POSITION_5"];

/** Top real, current-meta heroes per position (Legend+ bracket, this week), for the Meta tier table. */
export function computeMetaTierList(
  allStats: StratzHeroPositionStat[]
): Record<string, MetaTierEntry[]> {
  const eligible = allStats.filter(
    (s) => s.position && s.matchCount >= MIN_GAMES_FOR_META
  );

  const result: Record<string, MetaTierEntry[]> = {};
  for (const position of META_POSITIONS) {
    result[position] = eligible
      .filter((s) => s.position === position)
      .map((s) => ({
        heroId: s.heroId,
        heroName: getHeroName(s.heroId),
        position: s.position,
        roleLabel: roleLabelForPosition(s.position),
        games: s.matchCount,
        winRate: s.matchCount > 0 ? s.winCount / s.matchCount : 0,
        // Sort key only, not returned - ranks by confidence-adjusted win rate
        // so a handful of lucky games can't outrank a large reliable sample.
        _rankScore: wilsonScoreLowerBound(s.winCount, s.matchCount),
      }))
      .sort((a, b) => b._rankScore - a._rankScore)
      .slice(0, HEROES_PER_POSITION)
      .map(({ _rankScore, ...entry }) => entry);
  }
  return result;
}

function toItemStat(row: StratzItemStat | StratzNeutralItemStat): ItemStat | null {
  const itemKey = getItemKeyById(row.itemId);
  if (!itemKey) return null;
  const matchCount = row.matchCount;
  const winCount =
    "equippedMatchWinCount" in row ? row.equippedMatchWinCount : row.winCount;
  const denominator =
    "equippedMatchCount" in row ? row.equippedMatchCount : row.matchCount;
  return {
    itemKey,
    itemName: getItemNameByKey(itemKey),
    matchCount,
    winRate: denominator > 0 ? winCount / denominator : 0,
  };
}

/** Collapse repeat-purchase rows (STRATZ tracks each rebuy instance) down to one entry per item. */
function collapseByItem<T extends { itemId: number; matchCount: number }>(rows: T[]): T[] {
  const byItem = new Map<number, T>();
  for (const row of rows) {
    const existing = byItem.get(row.itemId);
    if (!existing || row.matchCount > existing.matchCount) byItem.set(row.itemId, row);
  }
  return [...byItem.values()];
}

function computeStartingItems(rows: StratzItemStat[], totalGames: number): ItemStat[] {
  return collapseByItem(rows)
    .filter((r) => totalGames > 0 && r.matchCount / totalGames >= MIN_ITEM_PICK_RATE)
    .map(toItemStat)
    .filter((s): s is ItemStat => s !== null)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 8);
}

function computeItemProgression(
  rows: StratzItemStat[],
  totalGames: number
): { coreProgression: ItemProgressionPoint[]; situationalItems: ItemStat[] } {
  const collapsed = collapseByItem(rows).filter(
    (r) => totalGames > 0 && r.matchCount / totalGames >= MIN_ITEM_PICK_RATE
  );

  const core: ItemProgressionPoint[] = [];
  const situational: ItemStat[] = [];

  for (const row of collapsed) {
    const stat = toItemStat(row);
    if (!stat) continue;
    const pickRate = row.matchCount / totalGames;
    if (pickRate >= CORE_ITEM_PICK_RATE && row.time !== undefined) {
      // STRATZ reports the purchase time in whole minutes (the most common minute for this item).
      core.push({ ...stat, avgTimeSeconds: row.time * 60 });
    } else {
      situational.push(stat);
    }
  }

  return {
    coreProgression: core.sort((a, b) => a.avgTimeSeconds - b.avgTimeSeconds).slice(0, 14),
    situationalItems: situational.sort((a, b) => b.matchCount - a.matchCount).slice(0, 14),
  };
}

function computeNeutralTiers(rows: StratzNeutralItemStat[]): NeutralItemTier[] {
  const byTier = new Map<number, ItemStat[]>();
  for (const row of rows) {
    const itemKey = getItemKeyById(row.itemId);
    if (!itemKey) continue;
    const tier = getItemTier(itemKey);
    if (!tier) continue;
    const stat = toItemStat(row);
    if (!stat) continue;
    byTier.set(tier, [...(byTier.get(tier) ?? []), stat]);
  }

  return [...byTier.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tier, items]) => ({
      tier,
      items: items.sort((a, b) => b.winRate - a.winRate).slice(0, NEUTRAL_ITEMS_PER_TIER),
    }));
}

function computeTalents(heroId: number, talentStats: StratzTalentStat[]): TalentLevel[] {
  const heroTalents = getHeroTalents(heroId);
  const statsByName = new Map<string, StratzTalentStat>();
  for (const stat of talentStats) {
    const name = getAbilityNameById(stat.abilityId);
    if (name) statsByName.set(name, stat);
  }

  return [10, 15, 20, 25].map((level) => {
    const options = heroTalents
      .filter((t) => t.level === level)
      .map((t) => {
        const stat = statsByName.get(t.name);
        const matchCount = stat?.matchCount ?? 0;
        return {
          label: getTalentLabel(t.name),
          matchCount,
          winRate: stat && matchCount > 0 ? stat.winCount / matchCount : 0,
          isTopChoice: false,
          isHighestWin: false,
        };
      });

    if (options.length === 2) {
      const [a, b] = options;
      (a.matchCount >= b.matchCount ? a : b).isTopChoice = true;
      (a.winRate >= b.winRate ? a : b).isHighestWin = true;
    }

    return { level, options };
  });
}

export function computeHeroBuildOverview(
  heroId: number,
  position: string,
  totalGamesForPosition: number,
  build: StratzHeroBuild
): HeroBuildOverview {
  const { coreProgression, situationalItems } = computeItemProgression(
    build.fullPurchases,
    totalGamesForPosition
  );

  return {
    heroId,
    position,
    roleLabel: roleLabelForPosition(position),
    startingItems: computeStartingItems(build.startingItems, totalGamesForPosition),
    coreProgression,
    situationalItems,
    neutralTiers: computeNeutralTiers(build.neutralItems),
    talents: computeTalents(heroId, build.talents),
  };
}
