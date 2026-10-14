// Builds read from parsed replays instead of guessed: the skill build level by
// level, the order the first big items are finished in, and - for items only
// some games buy - what was different about the enemy team in those games.
// Everything here is counted from real games; nothing is suggested that the
// games don't show.

import { getAbilityDisplayNameByKey, getHeroName, getItemComponents, getItemCostByKey, getItemNameByKey } from "../constants";
import { COUNTER_ITEM_TRAITS, TRAIT_LABELS, heroTraits, type TraitKey } from "../heroTraits";
import { getHeroReplays, type ReplayGame } from "../replays";
import { getTalentLabel } from "../talents";
import type { HeroBuildOverview, ReplayBuild, ReplayItemPath, ReplaySituationalItem, ReplaySkillStep } from "../types";
import { CONSUMABLES } from "./heroBuild";

// Below this, a skill build or an item order is a couple of players' habit.
const MIN_GAMES = 5;
const SKILL_LEVELS = 18;
// A level only counts when at least this many games got there.
const MIN_GAMES_AT_LEVEL = 4;

// Boots are their own choice, made early; the item paths are about the rest.
const BOOTS = new Set(["boots", "power_treads", "phase_boots", "arcane_boots", "tranquil_boots", "travel_boots", "travel_boots_2"]);
// A big item: finished from components (or a standalone one like Blink
// Dagger), worth at least this much.
const MAJOR_ITEM_MIN_COST = 1800;
const STANDALONE_ITEMS = new Set(["blink"]);
const PATH_LENGTH = 3;
const MAX_PATHS = 3;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function skillName(key: string): string {
  return key.startsWith("special_bonus") ? getTalentLabel(key) : (getAbilityDisplayNameByKey(key) ?? key);
}

/**
 * The usual skill build: at each level, the most common pick among the games
 * that made the same picks before it (so the result is a build someone really
 * played, not a mix of two); when too few games share the path, the most
 * common pick at that level overall.
 */
function computeSkillBuild(games: ReplayGame[]): ReplaySkillStep[] {
  const steps: ReplaySkillStep[] = [];
  const prefix: string[] = [];
  for (let level = 1; level <= SKILL_LEVELS; level++) {
    const reached = games.filter((g) => g.skills.length >= level);
    if (reached.length < MIN_GAMES_AT_LEVEL) break;
    let pool = reached.filter((g) => prefix.every((key, i) => g.skills[i] === key));
    if (pool.length < MIN_GAMES_AT_LEVEL) pool = reached;
    const counts = new Map<string, number>();
    for (const g of pool) counts.set(g.skills[level - 1], (counts.get(g.skills[level - 1]) ?? 0) + 1);
    const [key, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    steps.push({ level, abilityKey: key, abilityName: skillName(key), isTalent: key.startsWith("special_bonus"), share: count / pool.length });
    prefix.push(key);
  }
  return steps;
}

function isMajorItem(itemKey: string): boolean {
  if (CONSUMABLES.has(itemKey) || BOOTS.has(itemKey) || itemKey === "ultimate_scepter_2") return false;
  if (getItemCostByKey(itemKey) < MAJOR_ITEM_MIN_COST) return false;
  return getItemComponents(itemKey).length > 0 || STANDALONE_ITEMS.has(itemKey);
}

function allComponents(key: string, seen = new Set<string>()): Set<string> {
  for (const c of getItemComponents(key)) {
    if (seen.has(c)) continue;
    seen.add(c);
    allComponents(c, seen);
  }
  return seen;
}

/** The big items a game finished, in order - without the ones that went into a later one (Yasha into Manta). */
function majorItems(game: ReplayGame): { itemKey: string; time: number }[] {
  const first = new Map<string, number>();
  for (const p of game.purchases) if (isMajorItem(p.itemKey) && !first.has(p.itemKey)) first.set(p.itemKey, p.time);
  const ordered = [...first.entries()].map(([itemKey, time]) => ({ itemKey, time })).sort((a, b) => a.time - b.time);
  return ordered.filter((item, i) => !ordered.slice(i + 1).some((later) => allComponents(later.itemKey).has(item.itemKey)));
}

function computePaths(games: ReplayGame[]): ReplayItemPath[] {
  const byPath = new Map<string, { items: { itemKey: string; time: number }[][]; wins: number }>();
  for (const g of games) {
    const items = majorItems(g).slice(0, PATH_LENGTH);
    if (items.length < PATH_LENGTH) continue;
    const key = items.map((i) => i.itemKey).join(">");
    const entry = byPath.get(key) ?? { items: [], wins: 0 };
    entry.items.push(items);
    if (g.won) entry.wins++;
    byPath.set(key, entry);
  }
  return [...byPath.values()]
    .filter((p) => p.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, MAX_PATHS)
    .map((p) => ({
      items: p.items[0].map((item, n) => ({
        itemKey: item.itemKey,
        itemName: getItemNameByKey(item.itemKey),
        minute: Math.round(median(p.items.map((path) => path[n].time)) / 60),
      })),
      games: p.items.length,
      wins: p.wins,
    }));
}

// What counts as "more often": with the item vs without it - and never on a
// couple of games.
const TRAIT_MIN_GAMES = 4;
const TRAIT_MIN_DIFFERENCE = 0.3;
const TRAIT_MIN_RATIO = 1.2;
const ENEMY_MIN_GAMES = 3;
const ENEMY_MIN_LIFT = 1.8;
// Bought in more of the games than this, it's part of the build, not a reaction.
const SITUATIONAL_MAX_SHARE = 0.6;
const SITUATIONAL_MIN_SHARE = 0.15;
const MAX_SITUATIONAL = 8;

function traitCount(enemies: number[], trait: TraitKey): number {
  return enemies.filter((id) => heroTraits(id).has(trait)).length;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

/**
 * Items some games buy and others don't, with what those games faced: the
 * enemy trait the item answers (when the item has one) and the enemy heroes
 * met far more often. Only differences the games actually show are kept.
 */
function computeSituational(games: ReplayGame[], spine: Set<string>): ReplaySituationalItem[] {
  const boughtIn = new Map<string, { game: ReplayGame; time: number }[]>();
  for (const g of games) {
    // Big items as finished (Yasha inside Manta), plus cheap counter items (Gem).
    const counters = g.purchases.filter((p) => COUNTER_ITEM_TRAITS[p.itemKey] && !isMajorItem(p.itemKey));
    const seen = new Set<string>();
    for (const p of [...majorItems(g), ...counters]) {
      if (seen.has(p.itemKey) || spine.has(p.itemKey)) continue;
      seen.add(p.itemKey);
      boughtIn.set(p.itemKey, [...(boughtIn.get(p.itemKey) ?? []), { game: g, time: p.time }]);
    }
  }
  // A step on the way to a bigger item someone finished (Skull Basher to
  // Abyssal Blade, Sange to Sange and Yasha) left unfinished when the game
  // ended - not a choice of its own.
  const finished = new Set([...spine, ...boughtIn.keys()]);
  for (const itemKey of [...boughtIn.keys()]) {
    if ([...finished].some((other) => other !== itemKey && allComponents(other).has(itemKey))) boughtIn.delete(itemKey);
  }
  const enemyGames = new Map<number, number>();
  for (const g of games) for (const id of new Set(g.enemies)) enemyGames.set(id, (enemyGames.get(id) ?? 0) + 1);

  const result: ReplaySituationalItem[] = [];
  for (const [itemKey, buys] of boughtIn) {
    const share = buys.length / games.length;
    if (buys.length < 2 || share > SITUATIONAL_MAX_SHARE) continue;
    const withItem = new Set(buys.map((b) => b.game));
    const without = games.filter((g) => !withItem.has(g));

    const traits = (COUNTER_ITEM_TRAITS[itemKey] ?? []).flatMap((trait) => {
      if (withItem.size < TRAIT_MIN_GAMES || without.length < TRAIT_MIN_GAMES) return [];
      const withAvg = average([...withItem].map((g) => traitCount(g.enemies, trait)));
      const withoutAvg = average(without.map((g) => traitCount(g.enemies, trait)));
      return withAvg >= withoutAvg + TRAIT_MIN_DIFFERENCE && withAvg >= withoutAvg * TRAIT_MIN_RATIO
        ? [{ key: trait, label: TRAIT_LABELS[trait], withItem: Math.round(withAvg * 10) / 10, withoutItem: Math.round(withoutAvg * 10) / 10 }]
        : [];
    });

    const enemyCounts = new Map<number, number>();
    for (const g of withItem) for (const id of new Set(g.enemies)) enemyCounts.set(id, (enemyCounts.get(id) ?? 0) + 1);
    const enemies = [...enemyCounts.entries()]
      .filter(([id, count]) => count >= ENEMY_MIN_GAMES && count / withItem.size / ((enemyGames.get(id) ?? 1) / games.length) >= ENEMY_MIN_LIFT)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([heroId, count]) => ({ heroId, heroName: getHeroName(heroId), games: count }));

    if (traits.length === 0 && enemies.length === 0 && share < SITUATIONAL_MIN_SHARE) continue;
    result.push({
      itemKey,
      itemName: getItemNameByKey(itemKey),
      games: buys.length,
      wins: [...withItem].filter((g) => g.won).length,
      minute: Math.round(median(buys.map((b) => b.time)) / 60),
      traits,
      enemies,
    });
  }
  return result
    .sort((a, b) => Number(b.traits.length > 0) - Number(a.traits.length > 0) || b.games - a.games)
    .slice(0, MAX_SITUATIONAL);
}

/** The role's build with what its parsed games of this patch say; unchanged when they can't be read. */
export async function withReplays(build: HeroBuildOverview): Promise<HeroBuildOverview> {
  const games = await getHeroReplays(build.heroId, build.position).catch(() => []);
  return { ...build, replays: computeReplayBuild(games, build) };
}

/** What the parsed games of this patch say about the role's build; null when there are too few. */
export function computeReplayBuild(games: ReplayGame[], build: HeroBuildOverview | null): ReplayBuild | null {
  if (games.length < MIN_GAMES) return null;
  // The build's spine (and boots) aren't situational, however the games split.
  const spine = new Set([
    ...(build?.coreProgression.filter((i) => i.isCore !== false).map((i) => i.itemKey) ?? []),
    ...BOOTS,
  ]);
  return {
    games: games.length,
    proGames: games.filter((g) => g.source === "pro").length,
    highMmrGames: games.filter((g) => g.source === "highMmr").length,
    wins: games.filter((g) => g.won).length,
    skillBuild: computeSkillBuild(games),
    paths: computePaths(games),
    situational: computeSituational(games, spine),
  };
}
