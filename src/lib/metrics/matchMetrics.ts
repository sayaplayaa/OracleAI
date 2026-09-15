import { getHeroName, getItemNameByKey } from "../constants";
import type {
  MatchMetrics,
  MetricPoint,
  OpenDotaBenchmarks,
  OpenDotaMatch,
} from "../types";
import { estimatePercentile, getMedianValue } from "./benchmarks";

const LANE_ROLE_NAMES: Record<number, string> = {
  1: "Safe Lane",
  2: "Mid Lane",
  3: "Off Lane",
  4: "Jungle",
};

// Cheap/basic items that would clutter a "key purchases" timeline without
// adding coaching signal; recipes are filtered separately by prefix.
const NOISY_ITEMS = new Set([
  "tpscroll",
  "tango",
  "tango_single",
  "clarity",
  "flask",
  "enchanted_mango",
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "smoke_of_deceit",
  "dust",
  "infused_raindrop",
  "faerie_fire",
  "magic_stick",
  "circlet",
  "branches",
  "gauntlets",
  "slippers",
  "mantle",
  "belt_of_strength",
  "quarterstaff",
  "ring_of_protection",
]);

export function computeMatchMetrics(
  match: OpenDotaMatch,
  accountId: number,
  benchmarks: OpenDotaBenchmarks | null
): MatchMetrics {
  const player = match.players.find((p) => p.account_id === accountId);
  if (!player) {
    throw new Error(`Player ${accountId} not found in match ${match.match_id}`);
  }

  const win = player.isRadiant === match.radiant_win;
  const kda =
    player.deaths === 0
      ? player.kills + player.assists
      : (player.kills + player.assists) / player.deaths;

  const durationMinutes = match.duration / 60;
  const stats: MetricPoint[] = [];

  const addStat = (
    label: string,
    key: string | null,
    rawValue: number,
    unit?: string
  ) => {
    const buckets = key ? benchmarks?.result?.[key] : undefined;
    const percentile = estimatePercentile(buckets, rawValue);
    const median = getMedianValue(buckets);
    stats.push({
      label,
      value: Math.round(rawValue * 100) / 100,
      unit,
      percentile,
      benchmarkMedian:
        median !== undefined ? Math.round(median * 100) / 100 : undefined,
    });
  };

  addStat("Gold per Min", "gold_per_min", player.gold_per_min, "gpm");
  addStat("XP per Min", "xp_per_min", player.xp_per_min, "xpm");
  addStat(
    "Last Hits / Min",
    "last_hits_per_min",
    player.last_hits / durationMinutes,
    "lh/min"
  );
  addStat(
    "Hero Damage / Min",
    "hero_damage_per_min",
    player.hero_damage / durationMinutes,
    "dmg/min"
  );
  addStat(
    "Hero Healing / Min",
    "hero_healing_per_min",
    player.hero_healing / durationMinutes,
    "heal/min"
  );
  addStat("Tower Damage", "tower_damage", player.tower_damage);

  stats.push({ label: "Kills", value: player.kills });
  stats.push({ label: "Deaths", value: player.deaths });
  stats.push({ label: "Assists", value: player.assists });
  stats.push({ label: "Denies", value: player.denies });
  stats.push({
    label: "Net Worth",
    value: player.net_worth ?? player.gold_spent + player.gold,
  });
  stats.push({
    label: "Stuns (s)",
    value: Math.round((player.stuns ?? 0) * 10) / 10,
  });

  const itemTimeline = (player.purchase_log ?? [])
    .filter((p) => !p.key.startsWith("recipe_") && !NOISY_ITEMS.has(p.key))
    .map((p) => ({
      time: p.time,
      itemName: getItemNameByKey(p.key),
      itemKey: p.key,
    }))
    .sort((a, b) => a.time - b.time);

  const role =
    (player.lane_role ? LANE_ROLE_NAMES[player.lane_role] ?? "Unknown" : "Unknown") +
    (player.is_roaming ? " (Roaming)" : "");

  return {
    matchId: match.match_id,
    accountId,
    heroId: player.hero_id,
    heroName: getHeroName(player.hero_id),
    win,
    duration: match.duration,
    role,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    kda: Math.round(kda * 100) / 100,
    lastHitsAt10: player.lh_t?.[10] ?? null,
    goldAt10: player.gold_t?.[10] ?? null,
    xpAt10: player.xp_t?.[10] ?? null,
    stats,
    itemTimeline,
    wardsPlaced: (player.obs_placed ?? 0) + (player.sen_placed ?? 0),
    buybacks: player.buyback_count ?? 0,
  };
}
