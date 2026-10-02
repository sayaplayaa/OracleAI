import { getHeroInternalName, getHeroName, getItemNameByKey } from "../constants";
import type {
  MatchDeathEvent,
  MatchMetrics,
  MatchTeamfightMoment,
  MetricPoint,
  OpenDotaBenchmarks,
  OpenDotaMatch,
} from "../types";
import { estimatePercentile, getMedianValue } from "./benchmarks";

const LANE_ROLE_NAMES: Record<number, string> = {
  1: "Сейфлейн",
  2: "Мид",
  3: "Оффлейн",
  4: "Лес",
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

// Every other player's kills_log lists what they killed by internal name
// (e.g. "npc_dota_hero_pudge"), including hero kills - so an entry matching
// this player's own hero is a real, timestamped death, and the log's owner
// is the real killer (no position data exists in OpenDota's public API to
// say where it happened, only who and when).
function computeDeaths(match: OpenDotaMatch, heroNpcKey: string | null): MatchDeathEvent[] {
  if (!heroNpcKey) return [];
  const deaths: MatchDeathEvent[] = [];
  for (const p of match.players) {
    for (const k of p.kills_log ?? []) {
      if (k.key === heroNpcKey) {
        deaths.push({ time: k.time, killerHeroId: p.hero_id, killerHeroName: getHeroName(p.hero_id) });
      }
    }
  }
  return deaths.sort((a, b) => a.time - b.time);
}

// OpenDota's teamfights array has one aligned entry per player (by array
// index) for every detected fight - most are zero/no-op for a given player,
// so only fights this player actually did something in are kept.
function computeTeamfightParticipation(
  match: OpenDotaMatch,
  playerIndex: number
): MatchTeamfightMoment[] {
  const fights = match.teamfights ?? [];
  const moments: MatchTeamfightMoment[] = [];
  for (const fight of fights) {
    const fp = fight.players[playerIndex];
    if (!fp) continue;
    const kills = Object.values(fp.killed ?? {}).reduce((a, b) => a + b, 0);
    if (fp.deaths === 0 && kills === 0 && fp.damage === 0) continue;
    moments.push({
      time: fight.start,
      kills,
      deaths: fp.deaths,
      heroDamage: fp.damage,
      goldDelta: fp.gold_delta,
    });
  }
  return moments;
}

// OpenDota's `lane` field is the real physical lane (bottom/mid/top,
// consistent across both teams) - unlike `lane_role`, which is team-relative
// (each team's own "safe/mid/off" label). Matching on lane_role would pair a
// team's safe lane with the enemy's safe lane, which are on opposite sides
// of the map and never actually laned against each other; matching on the
// physical lane is what correctly finds who this player was really facing.
function computeLaneOpponents(
  match: OpenDotaMatch,
  player: OpenDotaMatch["players"][number]
): MatchMetrics["laneOpponents"] {
  if (player.lane === undefined) return [];
  return match.players
    .filter((p) => p.lane === player.lane && p.isRadiant !== player.isRadiant)
    .map((p) => ({
      heroName: getHeroName(p.hero_id),
      goldAt10: p.gold_t?.[10] ?? null,
      xpAt10: p.xp_t?.[10] ?? null,
      lastHitsAt10: p.lh_t?.[10] ?? null,
    }));
}

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

  addStat("Золото в минуту", "gold_per_min", player.gold_per_min, "зол/мин");
  addStat("Опыт в минуту", "xp_per_min", player.xp_per_min, "оп/мин");
  addStat(
    "Добивания в минуту",
    "last_hits_per_min",
    player.last_hits / durationMinutes,
    "доб/мин"
  );
  addStat(
    "Урон по героям в минуту",
    "hero_damage_per_min",
    player.hero_damage / durationMinutes,
    "урон/мин"
  );
  addStat(
    "Лечение в минуту",
    "hero_healing_per_min",
    player.hero_healing / durationMinutes,
    "леч/мин"
  );
  addStat("Урон по башням", "tower_damage", player.tower_damage);

  stats.push({ label: "Убийства", value: player.kills });
  stats.push({ label: "Смерти", value: player.deaths });
  stats.push({ label: "Помощи", value: player.assists });
  stats.push({ label: "Денаи", value: player.denies });
  stats.push({
    label: "Нетворс",
    value: player.net_worth ?? player.gold_spent + player.gold,
  });
  stats.push({
    label: "Станы (сек)",
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

  // Real starting-shop purchases: negative timestamps are the pre-horn
  // buy phase, and the window is extended a little past 0:00 since players
  // commonly finish shopping (tangoes, an extra ward) a few seconds after
  // the horn - unlike itemTimeline, this is deliberately NOT filtered
  // against NOISY_ITEMS, since consumables/wards/branches are exactly what
  // a starting build actually is.
  const startingItems = (player.purchase_log ?? [])
    .filter((p) => !p.key.startsWith("recipe_") && p.time < 60)
    .map((p) => ({
      time: p.time,
      itemName: getItemNameByKey(p.key),
      itemKey: p.key,
    }))
    .sort((a, b) => a.time - b.time);

  const role =
    (player.lane_role ? LANE_ROLE_NAMES[player.lane_role] ?? "Неизвестно" : "Неизвестно") +
    (player.is_roaming ? " (роумер)" : "");

  const playerIndex = match.players.indexOf(player);
  const heroNpcKey = getHeroInternalName(player.hero_id);

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
    laneEfficiency:
      player.lane_efficiency !== undefined
        ? Math.round(player.lane_efficiency * 100)
        : null,
    stats,
    itemTimeline,
    startingItems,
    deathLog: computeDeaths(match, heroNpcKey),
    teamfights: computeTeamfightParticipation(match, playerIndex),
    wardsPlaced: (player.obs_placed ?? 0) + (player.sen_placed ?? 0),
    buybacks: player.buyback_count ?? 0,
    laneOpponents: computeLaneOpponents(match, player),
  };
}
