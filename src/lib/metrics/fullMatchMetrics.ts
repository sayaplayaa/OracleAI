import {
  getHeroName,
  getItemKeyById,
  getGameModeName,
  getLobbyTypeName,
  getPatchName,
} from "../constants";
import type {
  FarmPoint,
  FullMatchOverview,
  FullMatchPlayer,
  HeatmapCell,
  OpenDotaMatch,
  OpenDotaMatchPlayer,
  WardPlacement,
} from "../types";

// Russian display names by dotaconstants id; anything missing falls back to
// the (English) dotaconstants name.
const GAME_MODE_NAMES_RU: Record<number, string> = {
  0: "Неизвестный режим",
  1: "All Pick",
  2: "Captains Mode",
  3: "Random Draft",
  4: "Single Draft",
  5: "All Random",
  6: "Вступление",
  7: "Diretide",
  8: "Reverse Captains Mode",
  9: "Greeviling",
  10: "Обучение",
  11: "Только мид",
  12: "Least Played",
  13: "Limited Heroes",
  14: "Компендиум",
  15: "Пользовательская игра",
  16: "Captains Draft",
  17: "Balanced Draft",
  18: "Ability Draft",
  19: "Событие",
  20: "All Random Deathmatch",
  21: "1 на 1 на миде",
  22: "All Pick",
  23: "Турбо",
  24: "Мутация",
  25: "Coaches Challenge",
};

/** The lobby type the match page treats as "nothing worth mentioning". */
export const NORMAL_LOBBY_NAME = "Обычная";

const LOBBY_TYPE_NAMES_RU: Record<number, string> = {
  0: NORMAL_LOBBY_NAME,
  1: "Лобби",
  2: "Турнир",
  3: "Обучение",
  4: "Против ботов",
  5: "Рейтинговая (команда)",
  6: "Рейтинговая (соло)",
  7: "Рейтинговая",
  8: "1 на 1 на миде",
  9: "Battle Cup",
  10: "Против ботов",
  11: "Зрители",
  12: "Событие",
  13: "Gauntlet",
  14: "Для новичков",
  15: "Особый режим",
};

function buildItemKeys(player: OpenDotaMatchPlayer): string[] {
  const ids = [
    player.item_0,
    player.item_1,
    player.item_2,
    player.item_3,
    player.item_4,
    player.item_5,
    player.item_neutral,
  ];
  return ids
    .filter((id): id is number => typeof id === "number" && id > 0)
    .map((id) => getItemKeyById(id))
    .filter((key): key is string => key !== null);
}

function buildFarmTrend(player: OpenDotaMatchPlayer): FarmPoint[] {
  if (!player.gold_t || !player.lh_t) return [];
  const length = Math.min(player.gold_t.length, player.lh_t.length);
  const points: FarmPoint[] = [];
  for (let minute = 0; minute < length; minute++) {
    points.push({
      minute,
      gold: player.gold_t[minute],
      lastHits: player.lh_t[minute],
    });
  }
  return points;
}

function toWardPlacements(
  log: { time: number; x: number; y: number }[] | undefined
): WardPlacement[] {
  return (log ?? []).map((w) => ({ time: w.time, x: w.x, y: w.y }));
}

function buildPositionHeatmap(
  lanePos: Record<string, Record<string, number>> | undefined
): HeatmapCell[] | null {
  if (!lanePos) return null;
  const cells: HeatmapCell[] = [];
  // OpenDota keys this as lane_pos[x][y].
  for (const [x, column] of Object.entries(lanePos)) {
    for (const [y, count] of Object.entries(column)) {
      cells.push({ x: Number(x), y: Number(y), count });
    }
  }
  return cells;
}

function buildPlayer(player: OpenDotaMatchPlayer): FullMatchPlayer {
  const kda =
    player.deaths === 0
      ? player.kills + player.assists
      : (player.kills + player.assists) / player.deaths;

  return {
    accountId: player.account_id ?? null,
    personaname: player.personaname ?? null,
    heroId: player.hero_id,
    heroName: getHeroName(player.hero_id),
    isRadiant: player.isRadiant,
    level: player.level,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    kda: Math.round(kda * 100) / 100,
    netWorth: player.net_worth ?? player.gold_spent + player.gold,
    gpm: player.gold_per_min,
    xpm: player.xp_per_min,
    heroDamage: player.hero_damage,
    heroHealing: player.hero_healing,
    towerDamage: player.tower_damage,
    lastHits: player.last_hits,
    denies: player.denies,
    obsPlaced: player.obs_placed ?? 0,
    senPlaced: player.sen_placed ?? 0,
    itemKeys: buildItemKeys(player),
    farmTrend: buildFarmTrend(player),
    series: {
      netWorth: player.networth_t ?? [],
      xp: player.xp_t ?? [],
      lastHits: player.lh_t ?? [],
      denies: player.dn_t ?? [],
    },
    observerWards: toWardPlacements(player.obs_log),
    sentryWards: toWardPlacements(player.sen_log),
    positionHeatmap: buildPositionHeatmap(player.lane_pos),
  };
}

export function computeFullMatchOverview(match: OpenDotaMatch): FullMatchOverview {
  const players = match.players.map(buildPlayer);
  const isParsed = Array.isArray(match.radiant_gold_adv);

  return {
    matchId: match.match_id,
    radiantWin: match.radiant_win,
    duration: match.duration,
    radiantScore: match.radiant_score ?? null,
    direScore: match.dire_score ?? null,
    gameMode: GAME_MODE_NAMES_RU[match.game_mode] ?? getGameModeName(match.game_mode),
    lobbyType: LOBBY_TYPE_NAMES_RU[match.lobby_type] ?? getLobbyTypeName(match.lobby_type),
    patch: getPatchName(match.patch),
    isParsed,
    goldAdvTrend: (match.radiant_gold_adv ?? []).map((value, minute) => ({
      minute,
      value,
    })),
    xpAdvTrend: (match.radiant_xp_adv ?? []).map((value, minute) => ({
      minute,
      value,
    })),
    radiantPlayers: players.filter((p) => p.isRadiant),
    direPlayers: players.filter((p) => !p.isRadiant),
  };
}
