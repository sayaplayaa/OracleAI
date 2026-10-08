import {
  getAbilityNameById,
  getHeroName,
  getHeroTalents,
  getItemComponents,
  getItemCostByKey,
  getItemKeyById,
  getItemNameByKey,
  getItemTier,
} from "../constants";
import { getTalentLabel } from "../talents";
import { wilsonScoreLowerBound } from "./statistics";
import type {
  StratzBootStat,
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

function toItemStat(row: StratzNeutralItemStat): ItemStat | null {
  const itemKey = getItemKeyById(row.itemId);
  if (!itemKey) return null;
  const denominator = row.equippedMatchCount;
  return {
    itemKey,
    itemName: getItemNameByKey(itemKey),
    matchCount: row.matchCount,
    winRate: denominator > 0 ? row.equippedMatchWinCount / denominator : 0,
  };
}

// Bought for the moment, not part of a build.
const CONSUMABLES = new Set([
  "tango",
  "tango_single",
  "flask",
  "clarity",
  "enchanted_mango",
  "faerie_fire",
  "smoke_of_deceit",
  "dust",
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "tpscroll",
  "tome_of_knowledge",
  "blood_grenade",
  "famango",
  "great_famango",
  "greater_famango",
  "cheese",
  "aegis",
  "refresher_shard",
  "royal_jelly",
]);

// An item bought in at least this share of games is core; below it, situational.
const CORE_PICK_RATE = 0.2;
const MIN_PICK_RATE = 0.03;
// Cheap items bought in the first minutes form the early build, not the core.
const EARLY_ITEM_MAX_COST = 1000;
const EARLY_ITEM_MAX_MINUTE = 15;
const EARLY_ITEM_PICK_RATE = 0.15;
// A component only folds into an item that's popular enough to be its destination.
const PARENT_PICK_RATE = 0.1;

interface Purchase {
  itemKey: string;
  count: number;
  wins: number;
  // Median purchase minute.
  minute: number;
}

/**
 * STRATZ answers with one row per item, per purchase (instance 0 = the first
 * copy) and per game minute. An item's pick count is the sum of its first-
 * purchase rows over all minutes - keeping only the biggest minute (as this
 * used to) counted a Battle Fury bought anywhere from 9 to 22 minutes as a
 * third of its real number, and dropped real core items below the cutoff.
 */
function firstPurchases(rows: StratzItemStat[]): Purchase[] {
  const byItem = new Map<number, { count: number; wins: number; minutes: [number, number][] }>();
  for (const row of rows) {
    if ((row.instance ?? 0) !== 0) continue;
    const entry = byItem.get(row.itemId) ?? { count: 0, wins: 0, minutes: [] };
    entry.count += row.matchCount;
    entry.wins += row.winCount;
    entry.minutes.push([row.time ?? 0, row.matchCount]);
    byItem.set(row.itemId, entry);
  }
  return [...byItem.entries()].flatMap(([itemId, e]) => {
    const itemKey = getItemKeyById(itemId);
    if (!itemKey || e.count === 0) return [];
    let seen = 0;
    let minute = 0;
    for (const [m, c] of e.minutes.sort((a, b) => a[0] - b[0])) {
      seen += c;
      if (seen >= e.count / 2) {
        minute = m;
        break;
      }
    }
    return [{ itemKey, count: e.count, wins: e.wins, minute }];
  });
}

// STRATZ's counts can run a little over its own game count (Invoker's Boots
// of Travel: 183 432 purchases in 172 506 games) - a share is never above 100%.
function share(count: number, total: number): number {
  return total > 0 ? Math.min(1, count / total) : 0;
}

function toPoint(p: Purchase, totalGames: number): ItemProgressionPoint {
  return {
    itemKey: p.itemKey,
    itemName: getItemNameByKey(p.itemKey),
    matchCount: p.count,
    winRate: p.count > 0 ? p.wins / p.count : 0,
    pickRate: share(p.count, totalGames),
    avgTimeSeconds: p.minute * 60,
  };
}

// Every component an item is built from, all the way down.
function allComponents(key: string, seen = new Set<string>()): Set<string> {
  for (const c of getItemComponents(key)) {
    if (seen.has(c)) continue;
    seen.add(c);
    allComponents(c, seen);
  }
  return seen;
}

function computeStartingItems(rows: StratzItemStat[], totalGames: number): HeroBuildOverview["startingItems"] {
  // STRATZ's wasGiven flag doesn't mean what it says (84% of Anti-Mage's
  // second Iron Branch "given"), so every row counts.
  const byItem = new Map<number, number[]>();
  for (const row of rows) {
    const counts = byItem.get(row.itemId) ?? [];
    counts[row.instance ?? 0] = (counts[row.instance ?? 0] ?? 0) + row.matchCount;
    byItem.set(row.itemId, counts);
  }
  const wins = new Map<number, number>();
  for (const row of rows) if ((row.instance ?? 0) === 0) wins.set(row.itemId, (wins.get(row.itemId) ?? 0) + row.winCount);
  return [...byItem.entries()]
    .flatMap(([itemId, counts]) => {
      const itemKey = getItemKeyById(itemId);
      const first = counts[0] ?? 0;
      if (!itemKey || totalGames === 0 || first / totalGames < MIN_ITEM_PICK_RATE) return [];
      // Copies most starts have: the next instance still bought in half the games.
      let copies = 1;
      while ((counts[copies] ?? 0) >= first * 0.5) copies++;
      return [
        {
          itemKey,
          itemName: getItemNameByKey(itemKey),
          matchCount: first,
          winRate: first > 0 ? (wins.get(itemId) ?? 0) / first : 0,
          pickRate: share(first, totalGames),
          copies,
        },
      ];
    })
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 8);
}

function computeBoots(rows: StratzBootStat[], totalGames: number): ItemProgressionPoint[] {
  const byItem = new Map<number, { count: number; wins: number; time: number }>();
  for (const row of rows) {
    if ((row.instance ?? 0) !== 0) continue;
    const e = byItem.get(row.itemId) ?? { count: 0, wins: 0, time: 0 };
    e.time = (e.time * e.count + row.timeAverage * row.matchCount) / Math.max(1, e.count + row.matchCount);
    e.count += row.matchCount;
    e.wins += row.winCount;
    byItem.set(row.itemId, e);
  }
  return [...byItem.entries()]
    .flatMap(([itemId, e]) => {
      const itemKey = getItemKeyById(itemId);
      // Plain Boots of Speed are the component, not a choice of boots.
      if (!itemKey || itemKey === "boots" || totalGames === 0 || e.count / totalGames < MIN_PICK_RATE) return [];
      return [
        {
          itemKey,
          itemName: getItemNameByKey(itemKey),
          matchCount: e.count,
          winRate: e.count > 0 ? e.wins / e.count : 0,
          pickRate: share(e.count, totalGames),
          avgTimeSeconds: Math.round(e.time),
        },
      ];
    })
    .sort((a, b) => b.matchCount - a.matchCount);
}

/**
 * The items of a build, the way players read one: cheap early items, then
 * core items in their usual order (bought in 20%+ of games), then the rest.
 * A component that's mostly bought on the way to a popular item (Perseverance
 * to Battle Fury, Skull Basher to Abyssal Blade) is shown inside that item
 * instead of as a core item of its own.
 */
function computeItemProgression(
  rows: StratzItemStat[],
  totalGames: number
): Pick<HeroBuildOverview, "earlyItems" | "coreProgression" | "situationalItems"> {
  const purchases = firstPurchases(rows).filter(
    (p) => !CONSUMABLES.has(p.itemKey) && totalGames > 0 && p.count / totalGames >= MIN_PICK_RATE
  );
  const points = new Map(purchases.map((p) => [p.itemKey, toPoint(p, totalGames)]));
  const parts = new Map(purchases.map((p) => [p.itemKey, allComponents(p.itemKey)]));

  // A component can fold into an item that itself folds into a bigger one
  // (Kaya into Meteor Hammer): follow the chain to the item still shown.
  const foldedInto = new Map<string, string>();
  const shownItem = (key: string) => {
    while (foldedInto.has(key)) key = foldedInto.get(key)!;
    return key;
  };
  for (const p of [...purchases].sort((a, b) => a.minute - b.minute)) {
    const parents = purchases.filter(
      (q) =>
        q.itemKey !== p.itemKey &&
        parts.get(q.itemKey)!.has(p.itemKey) &&
        q.count / totalGames >= PARENT_PICK_RATE &&
        q.minute >= p.minute
    );
    if (parents.length === 0) continue;
    const parent = shownItem(parents.sort((a, b) => b.count - a.count)[0].itemKey);
    if (parent === p.itemKey) continue;
    const target = points.get(parent)!;
    // Only components worth a mention on their own (Skull Basher, not Wind Lace).
    if (p.count / totalGames >= PARENT_PICK_RATE) target.builtFrom = [...(target.builtFrom ?? []), points.get(p.itemKey)!];
    points.delete(p.itemKey);
    foldedInto.set(p.itemKey, parent);
  }

  const early: ItemProgressionPoint[] = [];
  const core: ItemProgressionPoint[] = [];
  const situational: ItemProgressionPoint[] = [];
  for (const point of points.values()) {
    const pick = point.pickRate ?? 0;
    if (getItemCostByKey(point.itemKey) < EARLY_ITEM_MAX_COST && point.avgTimeSeconds <= EARLY_ITEM_MAX_MINUTE * 60) {
      if (pick >= EARLY_ITEM_PICK_RATE) early.push(point);
      else situational.push(point);
    } else if (pick >= CORE_PICK_RATE) {
      core.push(point);
    } else {
      situational.push(point);
    }
  }
  return {
    earlyItems: early.sort((a, b) => a.avgTimeSeconds - b.avgTimeSeconds),
    coreProgression: core.sort((a, b) => a.avgTimeSeconds - b.avgTimeSeconds).slice(0, 10),
    situationalItems: situational.sort((a, b) => b.matchCount - a.matchCount).slice(0, 12),
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
  return {
    heroId,
    position,
    roleLabel: roleLabelForPosition(position),
    games: totalGamesForPosition,
    startingItems: computeStartingItems(build.startingItems, totalGamesForPosition),
    boots: computeBoots(build.boots, totalGamesForPosition),
    ...computeItemProgression(build.fullPurchases, totalGamesForPosition),
    neutralTiers: computeNeutralTiers(build.neutralItems),
    talents: computeTalents(heroId, build.talents),
  };
}
