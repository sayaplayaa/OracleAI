import { getAbilityDisplayNameById, getHeroInternalName, getHeroName, getItemNameById } from "../constants";
import { formatMatchTime } from "../format";
import { cellsToMapPercent, toMapPercent } from "../mapCoords";
import type { StratzDeathEvent, StratzPlayerDeaths } from "../stratz";
import type {
  DeathKillerKind,
  DeathTag,
  DeathVisionMoment,
  MatchDeathEvent,
  OpenDotaMatch,
  OpenDotaMatchPlayer,
  WardLogEntry,
  WardPoint,
} from "../types";
import { classifyZone, laneOfCell, positionCells, type MapZone } from "./mapZones";

// Ward lifetimes, used only when a placement has no matching removal entry in
// the replay (the removal log normally records expiry or destruction exactly).
const OBSERVER_LIFETIME = 360;
const SENTRY_LIFETIME = 420;
// Observer Ward vision: 1600 world units = 12.5 cells of the 128-unit grid.
// Trees and high ground still block it, so "covers" means "in its radius".
const OBSERVER_VISION_CELLS = 12.5;
// Last hits within this window before a death mean the player was farming.
const FARMING_MIN_LAST_HITS = 3;
const UNKNOWN_KILLER = "неизвестно";

interface PlacedWard {
  x: number;
  y: number;
  placedAt: number;
  removedAt: number;
  team: "radiant" | "dire";
  kind: "observer" | "sentry";
  placedBy: string;
}

function removalTime(ward: WardLogEntry, left: WardLogEntry[] | undefined, lifetime: number): number {
  const matches = (left ?? []).filter(
    (l) =>
      l.time >= ward.time &&
      (ward.ehandle !== undefined && l.ehandle !== undefined ? l.ehandle === ward.ehandle : l.x === ward.x && l.y === ward.y)
  );
  if (matches.length === 0) return ward.time + lifetime;
  return Math.min(...matches.map((l) => l.time));
}

function collectPlacedWards(match: OpenDotaMatch): PlacedWard[] {
  const wards: PlacedWard[] = [];
  for (const p of match.players) {
    const team = p.isRadiant ? "radiant" : "dire";
    const placedBy = getHeroName(p.hero_id);
    const logs = [
      ["observer", p.obs_log, p.obs_left_log, OBSERVER_LIFETIME],
      ["sentry", p.sen_log, p.sen_left_log, SENTRY_LIFETIME],
    ] as const;
    for (const [kind, log, left, lifetime] of logs) {
      for (const w of log ?? []) {
        wards.push({
          x: w.x,
          y: w.y,
          placedAt: w.time,
          removedAt: removalTime(w, left, lifetime),
          team,
          kind,
          placedBy,
        });
      }
    }
  }
  return wards;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toWardPoint(w: PlacedWard, deathCell: { x: number; y: number } | null, yourTeam: PlacedWard["team"]): WardPoint {
  const { x, y } = toMapPercent(w.x, w.y);
  const isObserver = w.kind === "observer";
  return {
    x,
    y,
    time: w.placedAt,
    team: w.team,
    kind: w.kind,
    placedBy: w.placedBy,
    radius: isObserver ? cellsToMapPercent(OBSERVER_VISION_CELLS) : undefined,
    coversDeath: isObserver && deathCell !== null && distance(w, deathCell) <= OBSERVER_VISION_CELLS,
    own: w.team === yourTeam,
  };
}

interface Killer {
  kind: DeathKillerKind;
  heroId: number | null;
  name: string;
}

function prettifyUnitKey(key: string): string {
  return key
    .replace(/^npc_dota_/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// OpenDota's deaths_log key names the killing unit: a hero, a creep, a tower,
// a neutral, Roshan, or a summon ("npc_dota_venomancer_plague_ward_2").
function killerFromKey(match: OpenDotaMatch, key: string): Killer {
  const hero = match.players.find((p) => getHeroInternalName(p.hero_id) === key);
  if (hero) return { kind: "hero", heroId: hero.hero_id, name: getHeroName(hero.hero_id) };
  if (key.includes("roshan")) return { kind: "roshan", heroId: null, name: "Roshan" };
  if (key.includes("tower")) return { kind: "tower", heroId: null, name: "вражеская башня" };
  if (key.includes("neutral")) return { kind: "neutrals", heroId: null, name: "нейтральные крипы" };
  if (key.includes("creep") || key.includes("siege")) return { kind: "creeps", heroId: null, name: "крипы вражеской волны" };
  // A summon: credit the hero whose name is in the unit key.
  const owner = match.players.find((p) => {
    const short = getHeroInternalName(p.hero_id)?.replace("npc_dota_hero_", "");
    return short ? key.includes(short) : false;
  });
  if (owner) {
    return { kind: "hero", heroId: owner.hero_id, name: getHeroName(owner.hero_id) };
  }
  return { kind: "other", heroId: null, name: prettifyUnitKey(key) };
}

interface BaseDeath {
  time: number;
  key: string | null;
  attackerHeroId: number | null;
  stratz: StratzDeathEvent | null;
  timeDead: number | null;
  goldLost: number | null;
}

function baseDeaths(
  you: OpenDotaMatchPlayer,
  fallback: MatchDeathEvent[],
  stratz: StratzDeathEvent[] | null
): BaseDeath[] {
  const odLog = you.deaths_log ?? [];
  const nearest = (time: number) => odLog.find((d) => Math.abs(d.time - time) <= 3) ?? null;

  if (stratz && stratz.length > 0) {
    return [...stratz]
      .sort((a, b) => a.time - b.time)
      .map((e) => {
        const od = nearest(e.time);
        return {
          // STRATZ and OpenDota can disagree by a second; the coach's text
          // quotes OpenDota's time, so the map must show the same one.
          time: od?.time ?? e.time,
          key: od?.key ?? null,
          attackerHeroId: e.attacker ?? null,
          stratz: e,
          timeDead: e.timeDead ?? null,
          goldLost: e.goldLost ?? null,
        };
      });
  }
  if (odLog.length > 0) {
    return [...odLog]
      .sort((a, b) => a.time - b.time)
      .map((d) => ({
        time: d.time,
        key: d.key,
        attackerHeroId: null,
        stratz: null,
        timeDead: d.time_dead ?? null,
        goldLost: d.gold_lost ?? null,
      }));
  }
  return fallback.map((d) => ({
    time: d.time,
    key: null,
    attackerHeroId: d.killerHeroId,
    stratz: null,
    timeDead: null,
    goldLost: null,
  }));
}

function lastHitsBefore(you: OpenDotaMatchPlayer, time: number): number | null {
  const lh = you.lh_t;
  if (!lh || lh.length < 2) return null;
  const from = Math.max(0, Math.floor((time - 60) / 60));
  const to = Math.min(lh.length - 1, Math.ceil(time / 60));
  if (to <= from) return null;
  return lh[to] - lh[from];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} и ${names.at(-1)}`;
}

function buildReason(args: {
  killer: Killer;
  killingBlow: string | null;
  helpers: string[];
  inTeamfight: boolean;
  enemyWard: WardPoint | null;
  wardWalk: boolean;
  farming: { lastHits: number; onLane: boolean } | null;
  // Death spot and both teams' ward logs are known, so "no enemy ward" is a fact.
  visionKnown: boolean;
}): string {
  const { killer, killingBlow, helpers, inTeamfight, enemyWard, wardWalk, farming } = args;
  switch (killer.kind) {
    case "tower":
      return "Тебя добила вражеская башня: ты остался в зоне её атаки.";
    case "creeps":
      return farming
        ? "Тебя добили крипы вражеской волны, пока ты фармил её с низким здоровьем."
        : "Тебя добили крипы вражеской волны: ты остался в волне с низким здоровьем.";
    case "neutrals":
      return "Тебя убили нейтральные крипы.";
    case "roshan":
      return "Тебя убил Roshan.";
    case "other":
      return killer.name === UNKNOWN_KILLER ? "Кто нанёс последний удар, в данных матча нет." : `Тебя добил юнит ${killer.name}.`;
  }

  const who = `${killer.name}${killingBlow ? ` (${killingBlow})` : ""}`;
  const withHelpers = helpers.length > 0 ? ` вместе с ${joinNames(helpers)}` : "";
  const wardNote = enemyWard
    ? ` Ты стоял в радиусе вражеского Observer Ward (поставил ${enemyWard.placedBy ?? "враг"} в ${formatMatchTime(enemyWard.time)}) - враги тебя видели.`
    : "";

  if (inTeamfight) return `Погиб в тимфайте: добил ${who}${withHelpers}.${wardNote}`;
  if (enemyWard) {
    return `Ты стоял в радиусе вражеского Observer Ward (поставил ${enemyWard.placedBy ?? "враг"} в ${formatMatchTime(enemyWard.time)}) - по этому обзору тебя и нашли: убил ${who}${withHelpers}.`;
  }
  const noVision =
    args.visionKnown
      ? " Вражеских Observer Ward рядом не было - тебя нашли без вардов, из тумана войны."
      : "";
  if (farming) {
    return `Пока ты фармил ${farming.onLane ? "волну крипов на линии" : "лагерь в лесу"} (+${farming.lastHits} добиваний перед смертью), тебя поймал ${who}${withHelpers}.${wardWalk ? " По пути ты прошёл через вражеский обзор." : noVision}`;
  }
  if (wardWalk) return `По пути ты прошёл через вражеский обзор, и тебя поймал ${who}${withHelpers}.`;
  return `Тебя поймал ${who}${withHelpers}.${noVision}`;
}

function buildTags(args: {
  killer: Killer;
  zone: MapZone | null;
  inTeamfight: boolean;
  enemyWard: WardPoint | null;
  ownVision: boolean | null;
  wardWalk: boolean;
  farmingLastHits: number | null;
  enemiesCount: number;
  stratz: StratzDeathEvent | null;
}): DeathTag[] {
  const { killer, zone, inTeamfight, enemyWard, ownVision, wardWalk, farmingLastHits, enemiesCount, stratz } = args;
  const tags: DeathTag[] = [];
  if (killer.kind === "creeps") tags.push({ text: "Добили крипы", tone: "bad" });
  if (killer.kind === "tower") tags.push({ text: "Убит башней", tone: "bad" });
  if (killer.kind === "neutrals") tags.push({ text: "Убит нейтралами", tone: "warn" });
  if (killer.kind === "roshan") tags.push({ text: "Убит Roshan", tone: "warn" });
  if (enemyWard) tags.push({ text: "Под вражеским Observer Ward", tone: "bad" });
  else if (wardWalk) tags.push({ text: "Прошёл через вражеский обзор", tone: "warn" });
  if (zone?.deepInEnemyTerritory) tags.push({ text: "Глубоко на стороне врага", tone: "bad" });
  if (stratz?.isTracked) tags.push({ text: "Был под Track", tone: "bad" });
  if (killer.kind === "hero") {
    if (inTeamfight) tags.push({ text: "Тимфайт", tone: "info" });
    else tags.push({ text: "Вне тимфайта", tone: "warn" });
    if (!inTeamfight && enemiesCount >= 3) tags.push({ text: `Один против ${enemiesCount}`, tone: "warn" });
  }
  if (farmingLastHits !== null) tags.push({ text: `Фармил: +${farmingLastHits} добиваний`, tone: "info" });
  if (ownVision === false) tags.push({ text: "Без своего обзора", tone: "warn" });
  if (ownVision === true) tags.push({ text: "Под обзором твоей команды", tone: "info" });
  if (stratz?.isAttemptTpOut) tags.push({ text: "Пытался уйти через TP Scroll", tone: "warn" });
  if (stratz?.hasHealAvailable) tags.push({ text: "Не использовал лечение", tone: "warn" });
  if (stratz?.isBurst) tags.push({ text: "Убит бурстом", tone: "info" });
  return tags;
}

/**
 * Where, why and under whose ward each of this player's deaths happened -
 * all from real replay data, never from the AI model: the exact death spot
 * and the killing ability/item come from STRATZ's death events (with
 * OpenDota's teamfight death positions as a fallback), the killing unit from
 * OpenDota's deaths_log (which also names creeps, towers and neutrals), and
 * the wards from both teams' placement and removal logs - so the map shows
 * the wards that were really standing at that second, not just recent ones.
 */
export function computeDeathVision(
  match: OpenDotaMatch,
  accountId: number,
  fallbackDeaths: MatchDeathEvent[],
  stratzDeaths: StratzPlayerDeaths[] | null
): DeathVisionMoment[] {
  const you = match.players.find((p) => p.account_id === accountId);
  if (!you) return [];
  const youIndex = match.players.indexOf(you);
  const yourTeam = you.isRadiant ? "radiant" : "dire";
  const stratz =
    stratzDeaths?.find((p) => p.heroId === you.hero_id && p.isRadiant === you.isRadiant)?.deathEvents ?? null;
  const enemyHeroIds = new Set(match.players.filter((p) => p.isRadiant !== you.isRadiant).map((p) => p.hero_id));
  const placedWards = collectPlacedWards(match);
  const wardDataAvailable = match.players.some((p) => Array.isArray(p.obs_log));

  return baseDeaths(you, fallbackDeaths, stratz).map((death): DeathVisionMoment => {
    const fight = (match.teamfights ?? []).find(
      (f) => death.time >= f.start - 15 && death.time <= f.end + 15 && (f.players[youIndex]?.deaths ?? 0) > 0
    );

    let cell: { x: number; y: number } | null = null;
    if (death.stratz?.positionX != null && death.stratz?.positionY != null) {
      cell = { x: death.stratz.positionX, y: death.stratz.positionY };
    } else if (fight) {
      const cells = positionCells(fight.players[youIndex]?.deaths_pos);
      if (cells.length === 1) cell = { x: cells[0].x, y: cells[0].y };
    }
    const zone = cell ? classifyZone(cell.x, cell.y, you.isRadiant) : null;

    const killer: Killer = death.key
      ? killerFromKey(match, death.key)
      : death.attackerHeroId !== null
        ? { kind: "hero", heroId: death.attackerHeroId, name: getHeroName(death.attackerHeroId) }
        : { kind: "other", heroId: null, name: UNKNOWN_KILLER };

    const enemyIds = [
      ...new Set(
        [killer.heroId, death.stratz?.attacker ?? null, ...(death.stratz?.assist ?? [])].filter(
          (id): id is number => id !== null && enemyHeroIds.has(id)
        )
      ),
    ];
    const enemiesInvolved = enemyIds.map((heroId) => ({ heroId, name: getHeroName(heroId) }));
    const helpers = enemiesInvolved.filter((e) => e.heroId !== killer.heroId).map((e) => e.name);

    const killingBlow =
      death.stratz?.byAbility != null
        ? getAbilityDisplayNameById(death.stratz.byAbility)
        : death.stratz?.byItem != null
          ? getItemNameById(death.stratz.byItem)
          : null;

    const standing = placedWards.filter((w) => w.placedAt <= death.time && death.time < w.removedAt);
    const wards = standing.map((w) => toWardPoint(w, cell, yourTeam));
    const enemyWard =
      cell === null
        ? null
        : (standing
            .filter((w) => w.kind === "observer" && w.team !== yourTeam && distance(w, cell!) <= OBSERVER_VISION_CELLS)
            .sort((a, b) => distance(a, cell!) - distance(b, cell!))
            .map((w) => toWardPoint(w, cell, yourTeam))[0] ?? null);
    const ownVision = cell === null || !wardDataAvailable ? null : wards.some((w) => w.coversDeath && w.team === yourTeam);

    const lastHits = lastHitsBefore(you, death.time);
    const farmingLastHits = lastHits !== null && lastHits >= FARMING_MIN_LAST_HITS ? lastHits : null;
    const farming =
      farmingLastHits !== null && !fight ? { lastHits: farmingLastHits, onLane: cell ? laneOfCell(cell.x, cell.y) !== null : true } : null;
    const wardWalk = Boolean(death.stratz?.isWardWalkThrough);

    return {
      time: death.time,
      timeLabel: formatMatchTime(death.time),
      position: cell ? toMapPercent(cell.x, cell.y) : null,
      place: zone?.label ?? null,
      side: zone?.side ?? null,
      deepInEnemyTerritory: zone?.deepInEnemyTerritory ?? false,
      killer,
      killingBlow,
      enemiesInvolved,
      inTeamfight: Boolean(fight),
      farmingLastHits: farming ? farmingLastHits : null,
      enemyWard,
      ownVision,
      tags: buildTags({
        killer,
        zone,
        inTeamfight: Boolean(fight),
        enemyWard,
        ownVision,
        wardWalk,
        farmingLastHits: farming ? farmingLastHits : null,
        enemiesCount: enemiesInvolved.length,
        stratz: death.stratz,
      }),
      reason: buildReason({
        killer,
        killingBlow,
        helpers,
        inTeamfight: Boolean(fight),
        enemyWard,
        wardWalk,
        farming,
        visionKnown: cell !== null && wardDataAvailable,
      }),
      timeDead: death.timeDead,
      goldLost: death.goldLost,
      wards,
    };
  });
}
