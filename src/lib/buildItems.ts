// How a role's build splits up for the guide - the spine, the late options,
// item deadlines and how pubs compare with the pro scene. Shared by the AI
// guide's prompt (server) and the hero page (browser), so both talk about the
// same items; nothing here may import server-only data.

import type { HeroBuildOverview, ItemProgressionPoint, ItemTiming, ReplaySituationalItem } from "./types";

// The laning stage, by the minute an item is usually bought.
const LANING_MINUTE = 12;
// Boots bought later than this aren't a laning choice (Boots of Travel at 40′).
const LANING_BOOTS_MINUTE = 20;
// Bought in fewer games than this, a laning item is an option, not the rule...
const LANING_OPTIONAL_SHARE = 0.4;
// ...and in fewer than this, a habit of a few players (Wind Lace at 3%).
const LANING_MIN_SHARE = 0.08;

export interface LaningEntry {
  item: ItemProgressionPoint;
  // Other boots bought instead of these (Phase Boots for Power Treads).
  alternatives: ItemProgressionPoint[];
  optional: boolean;
  // A component of a core item, bought in the lane on the way to it
  // (Perseverance on the way to Battle Fury).
  towards?: string;
}

function minuteOf(item: ItemProgressionPoint): number {
  return item.avgTimeSeconds / 60;
}

/**
 * What's bought in the lane, in the usual order: cheap items (Magic Wand,
 * Wraith Band), the boots with the other boots players pick instead, and
 * early optional picks (Vanguard on Axe, Orb of Corrosion) - one list, the
 * way players think about the laning stage, not boots apart from items.
 */
export function laningItems(build: HeroBuildOverview | null): LaningEntry[] {
  if (!build) return [];
  const boots = build.boots.filter((b) => minuteOf(b) <= LANING_BOOTS_MINUTE);
  const items = [
    ...build.earlyItems,
    ...build.coreProgression.filter((i) => i.isCore === false && minuteOf(i) <= LANING_MINUTE),
    ...build.situationalItems.filter((i) => minuteOf(i) <= LANING_MINUTE && !build.earlyItems.some((e) => e.itemKey === i.itemKey)),
  ];
  const entries: LaningEntry[] = items
    .filter((item) => (item.pickRate ?? 0) >= LANING_MIN_SHARE)
    .map((item) => ({ item, alternatives: [], optional: (item.pickRate ?? 0) < LANING_OPTIONAL_SHARE }));
  if (boots.length > 0) entries.push({ item: boots[0], alternatives: boots.slice(1), optional: false });
  // What the lane really buys on the way to the first core items.
  for (const core of build.coreProgression.filter((i) => i.isCore !== false)) {
    for (const part of core.builtFrom ?? []) {
      if (part.avgTimeSeconds / 60 > LANING_MINUTE || entries.some((e) => e.item.itemKey === part.itemKey)) continue;
      entries.push({ item: part, alternatives: [], optional: (part.pickRate ?? 0) < LANING_OPTIONAL_SHARE, towards: core.itemName });
    }
  }
  return entries.sort((a, b) => a.item.avgTimeSeconds - b.item.avgTimeSeconds);
}

/**
 * The minute an item has to be finished by, when the data shows one: games
 * win as often as the hero does on the role while it comes by then, and less
 * after - inside the usual purchase window (Battle Fury on Anti-Mage: 14).
 * Late items keep "winning" however late they come, since only long games
 * buy them - no deadline there.
 */
export function itemDeadline(timing: ItemTiming | undefined): number | null {
  if (!timing || timing.onTimeMinute === null) return null;
  const { onTimeMinute, fastMinute, slowMinute } = timing;
  return onTimeMinute >= fastMinute && onTimeMinute <= slowMinute ? onTimeMinute : null;
}

/** The build's spine: the items built in most games long enough for them. Boots belong to the lane. */
export function spineItems(build: HeroBuildOverview | null): ItemProgressionPoint[] {
  if (!build) return [];
  return build.coreProgression.filter((i) => i.isCore !== false);
}

const LATE_OPTIONS = 6;
// Situational items bought this late are a late-game choice, not an early adjustment.
const LATE_OPTION_MINUTE = 15;

/** One-or-two-per-game picks: the late core options, then the most common later situational items. */
export function lateOptions(build: HeroBuildOverview | null): ItemProgressionPoint[] {
  if (!build) return [];
  // An optional pick of the laning stage (Vanguard at 8′) is in laningItems.
  const late = build.coreProgression.filter((i) => i.isCore === false && minuteOf(i) > LANING_MINUTE);
  const situational = build.situationalItems.filter((i) => i.avgTimeSeconds >= LATE_OPTION_MINUTE * 60);
  return [...late, ...situational].slice(0, LATE_OPTIONS);
}

export interface SituationalChoice {
  itemKey: string;
  itemName: string;
  // STRATZ's numbers for the role (pick rate, timing), when it's in them.
  stats: ItemProgressionPoint | null;
  // What the parsed games show about when it's bought, when they show it.
  evidence: ReplaySituationalItem | null;
}

/**
 * The items bought one or two per game, by situation: the late options and
 * later situational items of the role, joined with the replay evidence of
 * what the enemy team had when they were bought. Items with evidence first.
 */
export function situationalChoices(build: HeroBuildOverview | null): SituationalChoice[] {
  if (!build) return [];
  const evidence = new Map((build.replays?.situational ?? []).map((s) => [s.itemKey, s]));
  const choices: SituationalChoice[] = lateOptions(build).map((stats) => ({
    itemKey: stats.itemKey,
    itemName: stats.itemName,
    stats,
    evidence: evidence.get(stats.itemKey) ?? null,
  }));
  for (const s of build.replays?.situational ?? []) {
    if (!choices.some((c) => c.itemKey === s.itemKey)) choices.push({ itemKey: s.itemKey, itemName: s.itemName, stats: null, evidence: s });
  }
  const hasReason = (c: SituationalChoice) => (c.evidence ? c.evidence.traits.length + c.evidence.enemies.length : 0) > 0;
  return choices.sort((a, b) => Number(hasReason(b)) - Number(hasReason(a)));
}

export type PubStatus = { kind: "core" | "late" | "boots" | "other" | "none"; share: number | null };

/** What pub games on this role do with an item the pros buy. */
export function pubStatus(build: HeroBuildOverview, itemKey: string): PubStatus {
  const core = build.coreProgression.find((i) => i.itemKey === itemKey);
  if (core) {
    return core.isCore === false
      ? { kind: "late", share: core.pickRateIfReached ?? core.pickRate ?? null }
      : { kind: "core", share: core.pickRate ?? null };
  }
  const boots = build.boots.find((i) => i.itemKey === itemKey);
  if (boots) return { kind: "boots", share: boots.pickRate ?? null };
  const other = [...build.situationalItems, ...build.earlyItems].find((i) => i.itemKey === itemKey);
  if (other) return { kind: "other", share: other.pickRate ?? null };
  return { kind: "none", share: null };
}
