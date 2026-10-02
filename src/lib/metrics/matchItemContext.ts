import { getHeroBuild, getHeroPositionStats } from "../stratz";
import { computeHeroBuildOverview } from "./heroBuild";
import type { ItemProgressionPoint, OpenDotaMatch, StratzMatchPlayerPosition } from "../types";

const POSITION_ENUMS = ["POSITION_1", "POSITION_2", "POSITION_3", "POSITION_4", "POSITION_5"];

/**
 * Real position per player (STRATZ's per-match classifier when fully
 * available for every player, else the same GPM-rank heuristic role
 * comparisons already use elsewhere), keyed by account id - anonymous
 * players are skipped since there's nothing to attach a result to.
 */
export function resolvePositions(
  match: OpenDotaMatch,
  stratzPositions: StratzMatchPlayerPosition[] | null
): Map<number, string> {
  const byAccount = new Map<number, string>();
  const players = match.players.filter((p) => p.account_id);

  if (stratzPositions) {
    let allConfirmed = true;
    for (const p of players) {
      const found = stratzPositions.find(
        (sp) => sp.heroId === p.hero_id && sp.isRadiant === p.isRadiant
      );
      if (!found?.position) {
        allConfirmed = false;
        break;
      }
      byAccount.set(p.account_id!, found.position);
    }
    if (allConfirmed) return byAccount;
    byAccount.clear();
  }

  for (const isRadiant of [true, false]) {
    const sorted = players
      .filter((p) => p.isRadiant === isRadiant)
      .sort((a, b) => b.gold_per_min - a.gold_per_min);
    sorted.forEach((p, i) => byAccount.set(p.account_id!, POSITION_ENUMS[i] ?? "POSITION_5"));
  }
  return byAccount;
}

/**
 * Real "core item" keys per player in this match - STRATZ's ≥25%-pick-rate
 * build items for their real hero+position (the same source the Build
 * Inspector uses), not this app's own judgment of what's "core." Best-effort
 * per hero+position pair: a STRATZ failure for one pair (missing key, rate
 * limit) yields an empty set for those players rather than failing the page.
 */
export async function computeMatchCoreItems(
  match: OpenDotaMatch,
  stratzPositions: StratzMatchPlayerPosition[] | null
): Promise<Map<number, Set<string>>> {
  const positionByAccount = resolvePositions(match, stratzPositions);

  const pairs = new Map<string, { heroId: number; position: string }>();
  for (const p of match.players) {
    if (!p.account_id) continue;
    const position = positionByAccount.get(p.account_id);
    if (!position) continue;
    pairs.set(`${p.hero_id}:${position}`, { heroId: p.hero_id, position });
  }

  const coreByPair = new Map<string, Set<string>>();
  await Promise.all(
    [...pairs.entries()].map(async ([key, { heroId, position }]) => {
      try {
        const [positionStats, build] = await Promise.all([
          getHeroPositionStats(heroId),
          getHeroBuild(heroId, position),
        ]);
        const totalGames = positionStats.find((s) => s.position === position)?.matchCount ?? 0;
        const overview = computeHeroBuildOverview(heroId, position, totalGames, build);
        coreByPair.set(key, new Set(overview.coreProgression.map((c) => c.itemKey)));
      } catch {
        coreByPair.set(key, new Set());
      }
    })
  );

  const result = new Map<number, Set<string>>();
  for (const p of match.players) {
    if (!p.account_id) continue;
    const position = positionByAccount.get(p.account_id);
    if (!position) continue;
    result.set(p.account_id, coreByPair.get(`${p.hero_id}:${position}`) ?? new Set());
  }
  return result;
}

/**
 * Real core-item build timing for one hero+position, straight from STRATZ's
 * aggregate of the current broader playerbase (the same source the Build
 * Inspector and match-page core-item highlighting already use) - lets the
 * personal coach compare this one player's real purchase timing against real
 * data from many other players on the same hero+position, not just this
 * player's own history. Best-effort: returns an empty list on any STRATZ
 * failure rather than failing the coach report.
 */
export async function fetchMetaItemTiming(
  heroId: number,
  position: string
): Promise<ItemProgressionPoint[]> {
  try {
    const [positionStats, build] = await Promise.all([
      getHeroPositionStats(heroId),
      getHeroBuild(heroId, position),
    ]);
    const totalGames = positionStats.find((s) => s.position === position)?.matchCount ?? 0;
    return computeHeroBuildOverview(heroId, position, totalGames, build).coreProgression;
  } catch {
    return [];
  }
}
