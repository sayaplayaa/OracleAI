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
import { getHeroAbilityKit } from "../heroAbilities";
import { getTalentLabel } from "../talents";
import type {
  StratzAbilityMaxLevel,
  StratzBootStat,
  StratzGameMinuteStat,
  StratzHeroBuild,
  StratzHeroPositionStat,
  StratzItemStat,
  StratzNeutralItemStat,
  StratzTalentStat,
} from "../stratz";
import type {
  GameLengthStat,
  HeroBuildOverview,
  HeroRoleOverview,
  ItemProgressionPoint,
  ItemStat,
  ItemTiming,
  MetaTierEntry,
  NeutralItemTier,
  OpenDotaItemPopularity,
  ProItemStat,
  RolePickStat,
  SkillOrderStep,
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

// "Position" is STRATZ's own per-match classifier inferred from farm
// priority, not the drafted role - a hero who out-farms a bad teammate gets
// labeled into a role it was never picked for, and mostly in games it was
// already winning. Those labels add up to small samples with inflated win
// rates (7.41f, Legend+: Leshrac "carry" at 60.7% on 0.15% of carry games,
// Meepo carry at 56% on 0.11%), while deliberate picks sit well above 0.2%
// of the role's games. A share rather than a fixed count keeps the floor
// meaningful whether the patch has one week of games or ten.
export const MIN_META_PICK_SHARE = 0.002;
// A hero is ranked only on its own positions: the one it's played on most
// this patch, plus any other it's played on nearly as often (a real flex
// pick - Earthshaker 3/4/2, supports moving between 4 and 5). A popular
// hero's rare off-role games clear the floor above on their own: Necrophos
// "carry" is 0.8% of carry games but 12% of Necrophos games, against 47% mid.
export const MIN_SHARE_OF_MAIN_POSITION = 0.75;
// Games at the position's average win rate mixed into every hero's record:
// the fewer real games, the harder its edge is pulled toward the average.
const WIN_RATE_PRIOR_GAMES = 2000;
// A win rate this far above (below) the position's average maxes out (zeroes) the win-rate part.
const WIN_RATE_SPAN = 0.05;
// The rest of the index is how much the hero is played on the role.
export const META_INDEX_WIN_RATE_WEIGHT = 0.6;
const META_POSITIONS = ["POSITION_1", "POSITION_2", "POSITION_3", "POSITION_4", "POSITION_5"];

/**
 * Every hero on its own positions for the current patch (Legend+), best
 * first, by the meta index: 0-100, blending the win rate on that exact role
 * with how many games the hero gets on it. Win rate alone crowns
 * misclassified off-role samples; games alone crowns comfort picks that lose.
 */
export function computeMetaTierList(
  allStats: StratzHeroPositionStat[]
): Record<string, MetaTierEntry[]> {
  // Games on the hero's most played position.
  const mainPositionGames = new Map<number, number>();
  for (const s of allStats) {
    if (!META_POSITIONS.includes(s.position)) continue;
    mainPositionGames.set(s.heroId, Math.max(mainPositionGames.get(s.heroId) ?? 0, s.matchCount));
  }

  const result: Record<string, MetaTierEntry[]> = {};
  for (const position of META_POSITIONS) {
    const rows = allStats.filter((s) => s.position === position && s.matchCount > 0);
    const totalGames = rows.reduce((sum, s) => sum + s.matchCount, 0);
    const eligible = rows.filter(
      (s) =>
        s.matchCount >= totalGames * MIN_META_PICK_SHARE &&
        s.matchCount >= (mainPositionGames.get(s.heroId) ?? 0) * MIN_SHARE_OF_MAIN_POSITION
    );
    if (eligible.length === 0) {
      result[position] = [];
      continue;
    }
    const averageWinRate = rows.reduce((sum, s) => sum + s.winCount, 0) / totalGames;
    // Log scale: doubling the games is the same step at 0.5 -> 1% of the
    // role as at 4 -> 8%. 0 at the floor, 1 for the role's most played hero.
    const popularitySpan = Math.log(Math.max(...eligible.map((s) => s.matchCount)) / totalGames / MIN_META_PICK_SHARE);

    result[position] = eligible
      .map((s) => {
        const pickShare = s.matchCount / totalGames;
        const adjustedWinRate =
          (s.winCount + WIN_RATE_PRIOR_GAMES * averageWinRate) / (s.matchCount + WIN_RATE_PRIOR_GAMES);
        const winRateScore = clamp01(0.5 + (adjustedWinRate - averageWinRate) / (2 * WIN_RATE_SPAN));
        const popularityScore = popularitySpan > 0 ? clamp01(Math.log(pickShare / MIN_META_PICK_SHARE) / popularitySpan) : 1;
        return {
          heroId: s.heroId,
          heroName: getHeroName(s.heroId),
          position: s.position,
          roleLabel: roleLabelForPosition(s.position),
          games: s.matchCount,
          winRate: s.winCount / s.matchCount,
          pickShare,
          index: 100 * (META_INDEX_WIN_RATE_WEIGHT * winRateScore + (1 - META_INDEX_WIN_RATE_WEIGHT) * popularityScore),
        };
      })
      .sort((a, b) => b.index - a.index)
      .map((entry) => ({ ...entry, index: Math.round(entry.index) }));
  }
  return result;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
export const CONSUMABLES = new Set([
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
// Within those, the build's spine: built in at least half the games that
// lasted until its usual minute (Anti-Mage's Abyssal Blade: 44% of all games,
// 62% of the games still going at minute 36). The rest are late options.
const CORE_IF_REACHED = 0.5;
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
  // First purchases by minute, earliest first.
  byMinute: MinuteRow[];
}

interface MinuteRow {
  minute: number;
  count: number;
  wins: number;
}

// What the item's timing and core status are judged against.
interface BuildContext {
  totalGames: number;
  // The hero's win rate on this role; null without data.
  roleWinRate: number | null;
  // Games that lasted at least this many minutes.
  gamesReaching: (minute: number) => number | null;
}

/**
 * STRATZ answers with one row per item, per purchase (instance 0 = the first
 * copy) and per game minute. An item's pick count is the sum of its first-
 * purchase rows over all minutes - keeping only the biggest minute (as this
 * used to) counted a Battle Fury bought anywhere from 9 to 22 minutes as a
 * third of its real number, and dropped real core items below the cutoff.
 */
function firstPurchases(rows: StratzItemStat[]): Purchase[] {
  const byItem = new Map<number, { count: number; wins: number; byMinute: MinuteRow[] }>();
  for (const row of rows) {
    if ((row.instance ?? 0) !== 0) continue;
    const entry = byItem.get(row.itemId) ?? { count: 0, wins: 0, byMinute: [] };
    entry.count += row.matchCount;
    entry.wins += row.winCount;
    entry.byMinute.push({ minute: row.time ?? 0, count: row.matchCount, wins: row.winCount });
    byItem.set(row.itemId, entry);
  }
  return [...byItem.entries()].flatMap(([itemId, e]) => {
    const itemKey = getItemKeyById(itemId);
    if (!itemKey || e.count === 0) return [];
    const byMinute = e.byMinute.sort((a, b) => a.minute - b.minute);
    return [{ itemKey, count: e.count, wins: e.wins, minute: minuteAtShare(byMinute, e.count, 0.5), byMinute }];
  });
}

// The minute by which this share of the purchases is done.
function minuteAtShare(byMinute: MinuteRow[], total: number, target: number): number {
  let seen = 0;
  for (const row of byMinute) {
    seen += row.count;
    if (seen >= total * target) return row.minute;
  }
  return byMinute.at(-1)?.minute ?? 0;
}

function winRateOf(rows: MinuteRow[]): number {
  const count = rows.reduce((sum, r) => sum + r.count, 0);
  return count > 0 ? rows.reduce((sum, r) => sum + r.wins, 0) / count : 0;
}

// Fewer purchases than this in one minute say nothing about that minute.
const MIN_TIMING_SAMPLE = 100;

/**
 * How the win rate moves with the minute the item is finished: the fastest
 * and slowest quarters of purchases, and the last minute it still wins as
 * often as the hero does on the role (Battle Fury on Anti-Mage: 65% at 12,
 * 47% at 15, 28% at 18 minutes).
 */
function itemTiming(p: Purchase, roleWinRate: number | null): ItemTiming | undefined {
  if (p.count < MIN_TIMING_SAMPLE * 4 || p.byMinute.length < 3) return undefined;
  const fastMinute = minuteAtShare(p.byMinute, p.count, 0.25);
  const slowMinute = minuteAtShare(p.byMinute, p.count, 0.75);
  if (fastMinute >= slowMinute) return undefined;

  // Only a run from the earliest minutes counts: a late minute that happens
  // to win more after the item was already behind isn't "on time".
  let onTimeMinute: number | null = null;
  if (roleWinRate !== null) {
    for (const row of p.byMinute.filter((r) => r.count >= MIN_TIMING_SAMPLE)) {
      if (row.wins / row.count < roleWinRate) break;
      onTimeMinute = row.minute;
    }
  }
  return {
    fastMinute,
    fastWinRate: winRateOf(p.byMinute.filter((r) => r.minute <= fastMinute)),
    slowMinute,
    slowWinRate: winRateOf(p.byMinute.filter((r) => r.minute >= slowMinute)),
    onTimeMinute,
  };
}

// STRATZ's counts can run a little over its own game count (Invoker's Boots
// of Travel: 183 432 purchases in 172 506 games) - a share is never above 100%.
function share(count: number, total: number): number {
  return total > 0 ? Math.min(1, count / total) : 0;
}

function toPoint(p: Purchase, ctx: BuildContext): ItemProgressionPoint {
  const reached = ctx.gamesReaching(p.minute);
  const timing = itemTiming(p, ctx.roleWinRate);
  return {
    itemKey: p.itemKey,
    itemName: getItemNameByKey(p.itemKey),
    matchCount: p.count,
    winRate: p.count > 0 ? p.wins / p.count : 0,
    pickRate: share(p.count, ctx.totalGames),
    avgTimeSeconds: p.minute * 60,
    ...(timing ? { timing } : {}),
    ...(reached ? { pickRateIfReached: share(p.count, reached) } : {}),
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
  ctx: BuildContext
): Pick<HeroBuildOverview, "earlyItems" | "coreProgression" | "situationalItems"> {
  const { totalGames } = ctx;
  const purchases = firstPurchases(rows).filter(
    (p) => !CONSUMABLES.has(p.itemKey) && totalGames > 0 && p.count / totalGames >= MIN_PICK_RATE
  );
  const points = new Map(purchases.map((p) => [p.itemKey, toPoint(p, ctx)]));
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
      core.push({ ...point, isCore: (point.pickRateIfReached ?? pick) >= CORE_IF_REACHED });
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

// Short, medium and long games. STRATZ counts games by the minutes they
// reached only up to 35, so the last bucket is "longer than 35".
const GAME_LENGTH_BOUNDS = [0, 30, 35];
const MIN_GAME_LENGTH_SAMPLE = 200;

function computeGameLength(rows: StratzGameMinuteStat[]): GameLengthStat[] {
  const byMinute = new Map(rows.map((r) => [r.time, r]));
  return GAME_LENGTH_BOUNDS.flatMap((from, i) => {
    const to = GAME_LENGTH_BOUNDS[i + 1] ?? null;
    const start = byMinute.get(from);
    const end = to === null ? undefined : byMinute.get(to);
    if (!start || (to !== null && !end)) return [];
    const games = start.matchCount - (end?.matchCount ?? 0);
    const wins = start.winCount - (end?.winCount ?? 0);
    return games >= MIN_GAME_LENGTH_SAMPLE ? [{ fromMinute: from, toMinute: to, games, winRate: wins / games }] : [];
  });
}

// "Games that lasted at least N minutes", from the per-minute counts; past
// the last counted minute, the last count (an overestimate, so a late item's
// share of the games that reached it errs low).
function gamesReachingFrom(rows: StratzGameMinuteStat[]): (minute: number) => number | null {
  if (rows.length === 0) return () => null;
  const sorted = [...rows].sort((a, b) => a.time - b.time);
  return (minute) => {
    let count: number | null = null;
    for (const r of sorted) {
      if (r.time > minute) break;
      count = r.matchCount;
    }
    return count && count > 0 ? count : null;
  };
}

// An ability maxed in fewer games than this isn't part of the usual order.
const MIN_SKILL_MAX_SHARE = 0.2;

/** The hero's abilities in the order they're usually maxed, by median hero level. */
function computeSkillOrder(heroId: number, rows: StratzAbilityMaxLevel[], totalGames: number): SkillOrderStep[] {
  const kit = new Map(getHeroAbilityKit(heroId).filter((a) => !a.isInnate).map((a) => [a.key, a]));
  const byAbility = new Map<string, { level: number; count: number }[]>();
  for (const row of rows) {
    const key = getAbilityNameById(row.abilityId);
    if (!key || !kit.has(key)) continue;
    byAbility.set(key, [...(byAbility.get(key) ?? []), { level: row.level, count: row.matchCount }]);
  }
  return [...byAbility.entries()]
    .flatMap(([key, levels]) => {
      const count = levels.reduce((sum, l) => sum + l.count, 0);
      if (totalGames === 0 || count / totalGames < MIN_SKILL_MAX_SHARE) return [];
      let seen = 0;
      let median = 0;
      for (const l of levels.sort((a, b) => a.level - b.level)) {
        seen += l.count;
        if (seen >= count / 2) {
          median = l.level;
          break;
        }
      }
      const ability = kit.get(key)!;
      return [{ abilityKey: key, abilityName: ability.name, iconUrl: ability.iconUrl, maxedAtLevel: median, share: share(count, totalGames) }];
    })
    .sort((a, b) => a.maxedAtLevel - b.maxedAtLevel);
}

// Full items that aren't built from anything (Blink Dagger, Aghanim's Shard)
// but are a choice of their own, unlike Ultimate Orb or Demon Edge.
const STANDALONE_ITEMS = new Set(["blink", "aghanims_shard"]);
const PRO_ITEM_MIN_COST = 1000;
const PRO_ITEMS = 10;
const PRO_PARENT_SHARE = 0.2;

/** Full items recent professional games buy on the hero - not components, consumables or cheap starters. */
export function computeProItems(popularity: OpenDotaItemPopularity | null): ProItemStat[] {
  if (!popularity) return [];
  const counts = new Map<string, number>();
  for (const phase of [popularity.early_game_items, popularity.mid_game_items, popularity.late_game_items]) {
    for (const [itemId, count] of Object.entries(phase ?? {})) {
      const itemKey = getItemKeyById(Number(itemId));
      if (!itemKey || CONSUMABLES.has(itemKey) || getItemCostByKey(itemKey) < PRO_ITEM_MIN_COST) continue;
      if (getItemComponents(itemKey).length === 0 && !STANDALONE_ITEMS.has(itemKey)) continue;
      counts.set(itemKey, (counts.get(itemKey) ?? 0) + count);
    }
  }
  // A component mostly bought on the way to a bigger item the pros also buy
  // (Perseverance into Battle Fury, Kaya into Meteor Hammer) isn't a choice.
  const parts = new Map([...counts.keys()].map((key) => [key, allComponents(key)]));
  const onTheWay = (key: string, count: number) =>
    [...counts.entries()].some(([other, otherCount]) => other !== key && parts.get(other)!.has(key) && otherCount >= count * PRO_PARENT_SHARE);
  return [...counts.entries()]
    .filter(([itemKey, games]) => !onTheWay(itemKey, games))
    .sort((a, b) => b[1] - a[1])
    .slice(0, PRO_ITEMS)
    .map(([itemKey, games]) => ({ itemKey, itemName: getItemNameByKey(itemKey), games }));
}

export function computeHeroBuildOverview(
  heroId: number,
  position: string,
  totalGamesForPosition: number,
  build: StratzHeroBuild,
  proPopularity: OpenDotaItemPopularity | null = null
): HeroBuildOverview {
  const allGames = build.gameMinutes.find((r) => r.time === 0);
  const ctx: BuildContext = {
    totalGames: totalGamesForPosition,
    roleWinRate: allGames && allGames.matchCount > 0 ? allGames.winCount / allGames.matchCount : null,
    gamesReaching: gamesReachingFrom(build.gameMinutes),
  };
  return {
    heroId,
    position,
    roleLabel: roleLabelForPosition(position),
    games: totalGamesForPosition,
    startingItems: computeStartingItems(build.startingItems, totalGamesForPosition),
    boots: computeBoots(build.boots, totalGamesForPosition),
    ...computeItemProgression(build.fullPurchases, ctx),
    neutralTiers: computeNeutralTiers(build.neutralItems),
    talents: computeTalents(heroId, build.talents),
    winRate: ctx.roleWinRate,
    gameLength: computeGameLength(build.gameMinutes),
    skillOrder: computeSkillOrder(heroId, build.abilityMaxLevels, totalGamesForPosition),
    proItems: computeProItems(proPopularity),
    // Filled from parsed games by withReplays (metrics/replayBuild.ts).
    replays: null,
  };
}
