import { getHeroInternalName, getHeroName, getItemKeyById, getItemNameByKey } from "../constants";
import { formatGold, formatMatchTime, formatSigned, pluralRu } from "../format";
import { heroKitHasDisable, heroKitHasHealing } from "../coach/kit";
import { principleFor, type CauseCode } from "../coach/principles";
import { roleProfileFor, type RoleProfile } from "../coach/roles";
import { buildGameContext, isTurbo } from "./gameContext";
import { buildGameFlow } from "./gameFlow";
import { analysePositioning } from "./positioning";
import { classifyZone, isBaseCell, laneOfCell, positionCells, type MapZone } from "./mapZones";
import type { ResolvedPositions } from "./matchPositions";
import type { StratzPositionTrack } from "../stratz";
import { interpolateTime, levelForXp, xpForLevel } from "./skillBuild";
import type {
  DeathVisionMoment,
  ItemProgressionPoint,
  MatchAnalysis,
  CoachFinding,
  MatchMetrics,
  MetricPoint,
  NetWorthCheckpoint,
  OpenDotaMatch,
  OpenDotaMatchPlayer,
  PhaseAnalysis,
  PhaseId,
  PhaseVerdict,
} from "../types";

const CHECKPOINT_MINUTES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const MIN_PHASE_SECONDS = 90;

interface PhaseBounds {
  laneEnd: number;
  midEnd: number;
  // A late game shorter than this is folded into the mid game: the two
  // minutes before the throne falls aren't a phase to judge on their own
  // (it produced "no kills all late game" for a 2:45 window).
  minLate: number;
  // Minutes at which lane last hits/XP are compared.
  laneCheckpoints: [number, number];
  earlyDeathCut: number;
  // Team gold deficit from which a phase counts as being stomped: pushing
  // buildings or hunting kills aren't fair asks then.
  farBehind: number;
}

const NORMAL_BOUNDS: PhaseBounds = {
  laneEnd: 600,
  midEnd: 1500,
  minLate: 300,
  laneCheckpoints: [5, 10],
  earlyDeathCut: 300,
  farBehind: 5000,
};
// Turbo roughly doubles income and its games run ~20 minutes, so everything
// happens earlier. Approximate - there's no official "Turbo laning" length.
const TURBO_BOUNDS: PhaseBounds = {
  laneEnd: 420,
  midEnd: 960,
  minLate: 180,
  laneCheckpoints: [3, 7],
  earlyDeathCut: 180,
  farBehind: 8000,
};

const LEVEL_SIX_XP = xpForLevel(6) ?? 1760;

interface DeathEvent {
  time: number;
  killer: string;
  killerHeroId: number | null;
  timeDead: number;
  goldLost: number;
  inFight: boolean;
  zone: MapZone | null;
  boughtBack: boolean;
  // Where/why context worked out from the replay (deathVision.ts), when available.
  moment: DeathVisionMoment | null;
}

interface FightLine {
  damage: number;
  deaths: number;
  kills: number;
  participated: boolean;
}

interface FightInfo {
  start: number;
  you: FightLine;
  counterpart: FightLine | null;
  yourTeamDeaths: number;
  enemyDeaths: number;
}

interface Cause {
  code: CauseCode;
  severity: number;
  text: string;
  // A measurable goal for the next game, from this game's real numbers.
  target?: string;
}

interface Ctx {
  match: OpenDotaMatch;
  you: OpenDotaMatchPlayer;
  counterpart: OpenDotaMatchPlayer | null;
  role: RoleProfile;
  isCore: boolean;
  bounds: PhaseBounds;
  // Where the analysis stops: the end of the game, or the moment this player
  // left it - nothing after that is theirs to be judged on.
  end: number;
  deaths: DeathEvent[];
  // False when the reconstructed `deaths` list is shorter than the real,
  // authoritative player.deaths count - callers must never claim "0 deaths"
  // anywhere in that case, since the missing ones could be in any phase.
  deathDataComplete: boolean;
  realDeathTotal: number;
  heroKills: { time: number; victim: string }[];
  fights: FightInfo[];
  lastMinute: number;
  metaItemTiming: ItemProgressionPoint[];
  metrics: MatchMetrics;
  time: (seconds: number) => string;
  // From every hero's movement (STRATZ), when available: death time ->
  // distance to the nearest living ally; missed fight -> where you were.
  nearestAllyAtDeath: Map<number, number>;
  whereDuringMissedFight: Map<number, string>;
}

function at(arr: number[] | undefined, minute: number): number | null {
  return arr && minute >= 0 && minute < arr.length ? arr[minute] : null;
}

function vs(you: number, them: number): string {
  return `ты ${formatGold(you)} против ${formatGold(them)} (${formatSigned(you - them)})`;
}

function heroNameFromKey(match: OpenDotaMatch, key: string): string {
  const p = match.players.find((x) => getHeroInternalName(x.hero_id) === key);
  if (p) return getHeroName(p.hero_id);
  if (key.includes("roshan")) return "Roshan";
  if (key.includes("tower") || key.includes("fort")) return "вражеская башня";
  if (key.includes("neutral")) return "нейтральные крипы";
  if (key.includes("creep")) return "лайновые крипы";
  return key.replace("npc_dota_hero_", "").replace(/_/g, " ");
}

function heroIdFromKey(match: OpenDotaMatch, key: string): number | null {
  return match.players.find((x) => getHeroInternalName(x.hero_id) === key)?.hero_id ?? null;
}

// player.deaths is OpenDota's own authoritative end-of-game death count,
// always present regardless of parse detail - the per-event reconstruction
// below (deaths_log, or a kills_log cross-reference as a fallback) can fall
// short of it: deaths_log is a newer field some cached parses don't have,
// and the kills_log fallback only sees deaths credited to another PLAYER's
// kill log, so a death to a tower, Roshan or a neutral creep never surfaces
// there. Comparing the reconstructed count against this real total is the
// only way to know the event list is trustworthy before claiming "0 deaths"
// anywhere - silently under-counting a player's real deaths is worse than
// showing fewer detailed events with an honest note.
interface DeathReconstruction {
  events: DeathEvent[];
  realTotal: number;
  complete: boolean;
}

function collectDeaths(
  match: OpenDotaMatch,
  you: OpenDotaMatchPlayer,
  youIndex: number,
  fallback: MatchMetrics["deathLog"],
  moments: DeathVisionMoment[]
): DeathReconstruction {
  const base =
    you.deaths_log && you.deaths_log.length > 0
      ? you.deaths_log.map((d) => ({
          time: d.time,
          killer: heroNameFromKey(match, d.key),
          killerHeroId: heroIdFromKey(match, d.key),
          timeDead: d.time_dead ?? 0,
          goldLost: d.gold_lost ?? 0,
        }))
      : moments.length > fallback.length
        ? // STRATZ's death events cover deaths to creeps/towers that the kills_log fallback can't see.
          moments.map((m) => ({
            time: m.time,
            killer: KILLER_LABEL[m.killer.kind] ?? m.killer.name,
            killerHeroId: m.killer.kind === "hero" ? m.killer.heroId : null,
            timeDead: m.timeDead ?? 0,
            goldLost: m.goldLost ?? 0,
          }))
        : fallback.map((d) => ({ time: d.time, killer: d.killerHeroName, killerHeroId: d.killerHeroId, timeDead: 0, goldLost: 0 }));

  const realTotal = you.deaths;
  const complete = base.length >= realTotal;

  const fights = match.teamfights ?? [];
  const buybacks = (you.buyback_log ?? []).map((b) => b.time);

  const events = base
    .sort((a, b) => a.time - b.time)
    .map((d) => {
      const fight = fights.find(
        (f) => d.time >= f.start - 15 && d.time <= f.end + 15 && (f.players[youIndex]?.deaths ?? 0) > 0
      );
      const moment = moments.find((m) => Math.abs(m.time - d.time) <= 3) ?? null;
      let zone: MapZone | null =
        moment?.place && moment.side
          ? { label: moment.place, side: moment.side, deepInEnemyTerritory: moment.deepInEnemyTerritory }
          : null;
      if (!zone && fight) {
        const zones = positionCells(fight.players[youIndex]?.deaths_pos).map((c) =>
          classifyZone(c.x, c.y, you.isRadiant)
        );
        if (zones.length > 0 && zones.every((z) => z.label === zones[0].label)) zone = zones[0];
      }
      return {
        ...d,
        inFight: Boolean(fight),
        zone,
        boughtBack: buybacks.some((b) => b >= d.time && b - d.time <= 25),
        moment,
      };
    });

  return { events, realTotal, complete };
}

function collectFights(
  match: OpenDotaMatch,
  youIndex: number,
  counterpartIndex: number
): FightInfo[] {
  const you = match.players[youIndex];
  const line = (index: number, fight: NonNullable<OpenDotaMatch["teamfights"]>[number]): FightLine | null => {
    const fp = fight.players[index];
    if (!fp) return null;
    const kills = Object.values(fp.killed ?? {}).reduce((a, b) => a + b, 0);
    return {
      damage: fp.damage,
      deaths: fp.deaths,
      kills,
      participated: fp.damage > 0 || fp.deaths > 0 || kills > 0 || fp.healing > 0,
    };
  };

  return (match.teamfights ?? []).flatMap((fight) => {
    const yours = line(youIndex, fight);
    if (!yours) return [];
    let yourTeamDeaths = 0;
    let enemyDeaths = 0;
    match.players.forEach((p, i) => {
      const deaths = fight.players[i]?.deaths ?? 0;
      if (p.isRadiant === you.isRadiant) yourTeamDeaths += deaths;
      else enemyDeaths += deaths;
    });
    return [
      {
        start: fight.start,
        you: yours,
        counterpart: counterpartIndex >= 0 ? line(counterpartIndex, fight) : null,
        yourTeamDeaths,
        enemyDeaths,
      },
    ];
  });
}

function checkpointAt(ctx: Ctx, minute: number): NetWorthCheckpoint | null {
  const you = at(ctx.you.networth_t, minute);
  const them = at(ctx.counterpart?.networth_t, minute);
  if (you === null || them === null) return null;
  return { minute, you, counterpart: them, diff: you - them };
}

function decideVerdict(cp: NetWorthCheckpoint | null, isCore: boolean): PhaseVerdict | null {
  if (!cp) return null;
  const threshold = Math.max(isCore ? 300 : 250, 0.07 * cp.counterpart);
  if (cp.diff > threshold) return "won";
  if (cp.diff < -threshold) return "lost";
  return "even";
}

function deathList(ctx: Ctx, deaths: DeathEvent[], withFightContext = true): string {
  return deaths
    .map((d) => {
      const parts: string[] = [];
      const m = d.moment;
      if (withFightContext) parts.push(d.inFight ? "в тимфайте" : "вне замеченных тимфайтов");
      if (d.zone) parts.push(`место: ${d.zone.label}${d.zone.deepInEnemyTerritory ? ", глубоко на вражеской территории" : ""}`);
      if (m?.killingBlow) parts.push(`добивание: ${m.killingBlow}`);
      if (m && m.enemiesInvolved.length > 1) parts.push(`участвовали: ${m.enemiesInvolved.map((e) => e.name).join(", ")}`);
      if (m?.enemyWard) {
        parts.push(`под вражеским Observer Ward (поставил ${m.enemyWard.placedBy ?? "враг"} в ${ctx.time(m.enemyWard.time)})`);
      } else if (m && m.ownVision !== null && m.killer.kind === "hero") {
        parts.push("вражеских Observer Ward рядом не было");
      }
      if (m?.farmingLastHits) parts.push(`фармил: +${m.farmingLastHits} добиваний перед смертью`);
      const ally = ctx.nearestAllyAtDeath.get(d.time);
      if (ally !== undefined && !d.inFight) parts.push(`ближайший союзник в ${formatGold(Math.round(ally / 100) * 100)} ед.`);
      if (d.boughtBack) parts.push("бай-бек");
      return `${ctx.time(d.time)} ${d.killer}${parts.length > 0 ? ` (${parts.join("; ")})` : ""}`;
    })
    .join(" | ");
}

// " 3 раза" for repeated events, nothing for a single one.
function timesRu(count: number): string {
  return count > 1 ? ` ${count} ${pluralRu(count, ["раз", "раза", "раз"])}` : "";
}

// "потеряла 1 героя / 3 героя / 5 героев".
function heroesRu(n: number): string {
  return `${n} ${pluralRu(n, ["героя", "героя", "героев"])}`;
}

// "1 бой / 3 боя / 5 боёв".
function fightsRu(n: number): string {
  return `${n} ${pluralRu(n, ["бой", "боя", "боёв"])}`;
}

// "1 раз", "2 раза", "5 раз".
function countRu(count: number): string {
  return `${count} ${pluralRu(count, ["раз", "раза", "раз"])}`;
}

const KILLER_LABEL: Partial<Record<DeathVisionMoment["killer"]["kind"], string>> = {
  creeps: "лайновые крипы",
  tower: "вражеская башня",
  neutrals: "нейтральные крипы",
  roshan: "Roshan",
};

// Deaths whose replay context points at one specific habit: walking into an
// enemy Observer Ward's vision outside a fight, or dying to creeps/a tower.
function deathContextCauses(ctx: Ctx, deaths: DeathEvent[]): Cause[] {
  const causes: Cause[] = [];
  const seen = deaths.filter((d) => !d.inFight && d.moment?.enemyWard);
  if (seen.length > 0) {
    causes.push({
      code: "SEEN_BY_WARD",
      severity: 20 + seen.length * 15,
      text: `Вне тимфайтов ты${timesRu(seen.length)} умер в радиусе вражеского Observer Ward: ${seen
        .map((d) => `${ctx.time(d.time)} (вард поставил ${d.moment!.enemyWard!.placedBy ?? "враг"} в ${ctx.time(d.moment!.enemyWard!.time)})`)
        .join(", ")} - враги видели, как ты подходишь.`,
      target: `0 смертей вне драк в радиусе вражеского Observer Ward (в этой игре - ${seen.length})`,
    });
  }
  const creeps = deaths.filter((d) => d.moment && (d.moment.killer.kind === "creeps" || d.moment.killer.kind === "tower"));
  if (creeps.length > 0) {
    causes.push({
      code: "CREEP_TOWER_DEATH",
      severity: 15 + creeps.length * 15,
      text: `Тебя${timesRu(creeps.length)} добили не герои, а ${creeps
        .map((d) => `${KILLER_LABEL[d.moment!.killer.kind]} в ${ctx.time(d.time)}`)
        .join(", ")} - ты остался в волне или под башней с низким здоровьем.`,
      target: `0 смертей от крипов и башен (в этой игре - ${creeps.length})`,
    });
  }
  return causes;
}

function towersIn(match: OpenDotaMatch, from: number, to: number, yourIsRadiant: boolean) {
  const lost: number[] = [];
  const taken: number[] = [];
  const barracksLost: number[] = [];
  for (const o of match.objectives ?? []) {
    if (o.type !== "building_kill" || o.time < from || o.time >= to || !o.key) continue;
    const radiantBuilding = o.key.includes("goodguys");
    const yours = radiantBuilding === yourIsRadiant;
    if (o.key.includes("tower")) (yours ? lost : taken).push(o.time);
    else if (yours && (o.key.includes("rax") || o.key.includes("fort"))) barracksLost.push(o.time);
  }
  return { lost, taken, barracksLost };
}

function roshanIn(match: OpenDotaMatch, from: number, to: number, yourIsRadiant: boolean) {
  const yourTeam = yourIsRadiant ? 2 : 3;
  return (match.objectives ?? [])
    .filter((o) => o.type === "CHAT_MESSAGE_ROSHAN_KILL" && o.time >= from && o.time < to)
    .map((o) => ({ time: o.time, yours: o.team === yourTeam }));
}

function itemTimingFacts(ctx: Ctx, from: number, to: number): { facts: string[]; lateCauses: Cause[] } {
  const metaByKey = new Map(ctx.metaItemTiming.map((m) => [m.itemKey, m]));
  const rows = ctx.metrics.itemTimeline
    .filter((p) => p.time >= from && p.time < to && metaByKey.has(p.itemKey))
    .map((p) => {
      const meta = metaByKey.get(p.itemKey)!;
      return { name: p.itemName, time: p.time, metaTime: meta.avgTimeSeconds, deltaMin: (p.time - meta.avgTimeSeconds) / 60 };
    });
  if (rows.length === 0) return { facts: [], lateCauses: [] };

  const shown = [...rows].sort((a, b) => Math.abs(b.deltaMin) - Math.abs(a.deltaMin)).slice(0, 3);
  const label = (r: (typeof rows)[number]) =>
    `${r.name} в ${ctx.time(r.time)} (${
      Math.abs(r.deltaMin) < 1
        ? "в типичный метовый тайминг"
        : `на ${Math.abs(r.deltaMin).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} мин ${r.deltaMin > 0 ? "позже" : "раньше"} типичного метового тайминга`
    })`;
  return {
    facts: [`Тайминги ключевых предметов относительно типичного (самого частого) метового тайминга для этого героя и позиции: ${shown.map(label).join("; ")}.`],
    lateCauses: rows
      .filter((r) => r.deltaMin >= 2.5)
      .map((r) => ({
        code: "LATE_CORE_ITEM" as const,
        severity: 30,
        text: `${label(r)} - ключевой предмет собран с опозданием.`,
        target: `${r.name} к ~${formatMatchTime(r.metaTime)} - типичный тайминг (в этой игре - ${formatMatchTime(r.time)})`,
      })),
  };
}

interface ObserverFate {
  time: number;
  // Enemy hero who destroyed it; null when it lasted until it expired.
  dewardedBy: string | null;
}

// What happened to each Observer Ward this player placed: the removal log's
// attackername is the placer's own hero when a ward simply expires, and the
// enemy hero who killed it otherwise.
function observerFates(match: OpenDotaMatch, player: OpenDotaMatchPlayer): ObserverFate[] {
  const enemies = new Map(
    match.players
      .filter((p) => p.isRadiant !== player.isRadiant)
      .map((p) => [getHeroInternalName(p.hero_id), getHeroName(p.hero_id)] as const)
  );
  return (player.obs_log ?? []).map((w) => {
    const removed = (player.obs_left_log ?? []).find(
      (l) =>
        l.time >= w.time &&
        (w.ehandle !== undefined && l.ehandle !== undefined ? l.ehandle === w.ehandle : l.x === w.x && l.y === w.y)
    );
    return { time: w.time, dewardedBy: removed?.attackername ? enemies.get(removed.attackername) ?? null : null };
  });
}

function wardCause(ctx: Ctx, from: number, to: number): Cause | null {
  if (ctx.isCore) return null;
  const placed = [...(ctx.you.obs_log ?? []), ...(ctx.you.sen_log ?? [])].filter((w) => w.time >= from && w.time < to).length;
  const window = Math.min(to, ctx.end) - from;
  const expected = Math.floor(window / 300); // roughly one ward every five minutes as a floor
  if (expected < 1 || placed >= Math.min(expected, 2)) return null;
  return {
    code: "NO_VISION",
    severity: ctx.role.position === 5 ? 40 : 25,
    text: `Поставил всего ${placed} ${pluralRu(placed, ["вард", "варда", "вардов"])} между ${ctx.time(from)} и ${ctx.time(Math.min(to, ctx.end))} - обзор - это работа саппорта.`,
    target: `хотя бы 1 вард каждые 5 минут - ${expected}+ за ${formatMatchTime(from)}-${formatMatchTime(Math.min(to, ctx.end))} (в этой игре - ${placed})`,
  };
}

function wardFacts(ctx: Ctx, from: number, to: number): { facts: string[]; causes: Cause[] } {
  const inWindow = <T extends { time: number }>(log: T[] | undefined) => (log ?? []).filter((w) => w.time >= from && w.time < to);
  const obs = inWindow(observerFates(ctx.match, ctx.you));
  const sen = inWindow(ctx.you.sen_log);
  const dewarded = obs.filter((w) => w.dewardedBy !== null);
  const fates =
    obs.length > 0
      ? ` (${obs.map((w) => ctx.time(w.time)).join(", ")}${dewarded.length > 0 ? `; враг снял ${dewarded.length} из ${obs.length}` : ""})`
      : "";
  const causes: Cause[] = [];
  if (obs.length >= 2 && dewarded.length >= 2 && dewarded.length / obs.length >= 0.5) {
    const by = [...new Set(dewarded.map((w) => w.dewardedBy))].join(", ");
    causes.push({
      code: "WARDS_DEWARDED",
      severity: 15 + dewarded.length * 10,
      text: `Враг снял ${dewarded.length} из ${obs.length} твоих Observer Ward в этой фазе (${dewarded.map((w) => ctx.time(w.time)).join(", ")}; снимали ${by}) - эти точки он проверяет.`,
      target: `большинство Observer Ward доживают до конца (в этой фазе враг снял ${dewarded.length} из ${obs.length})`,
    });
  }
  return {
    facts: [`Варды, поставленные тобой в этой фазе: Observer Ward - ${obs.length}${fates}, Sentry Ward - ${sen.length}.`],
    causes,
  };
}

function lanePresenceFact(ctx: Ctx): string | null {
  const lane = ctx.you.lane;
  const wanted = lane === 1 ? "bottom" : lane === 2 ? "mid" : lane === 3 ? "top" : null;
  if (!wanted || !ctx.you.lane_pos) return null;
  let inLane = 0;
  let elsewhere = 0;
  for (const c of positionCells(ctx.you.lane_pos)) {
    if (isBaseCell(c.x, c.y)) continue;
    if (laneOfCell(c.x, c.y) === wanted) inLane += c.count;
    else elsewhere += c.count;
  }
  const away = inLane + elsewhere;
  if (away === 0) return null;
  return `Присутствие на линии за первые ~11 минут (без учёта времени на базе): ${Math.round((inLane / away) * 100)}% на своей линии, ${Math.round((elsewhere / away) * 100)}% джангл/река/другие линии.`;
}

// When each player hit level 6 (the ultimate), interpolated from the real
// per-minute XP curve - the single most telling laning number for a core.
function levelSixFact(ctx: Ctx, name: string, laneEnd: number): string | null {
  const { you, counterpart } = ctx;
  if (!counterpart || !you.xp_t || !counterpart.xp_t) return null;
  const mine = interpolateTime(you.xp_t, LEVEL_SIX_XP);
  const theirs = interpolateTime(counterpart.xp_t, LEVEL_SIX_XP);
  const show = (t: number | null) => (t !== null && t <= laneEnd ? `~${ctx.time(t)}` : `не дошёл до 6 уровня к ${ctx.time(laneEnd)}`);
  if (mine === null && theirs === null) return null;
  return `6-й уровень (ультимейт): ты ${show(mine)}, ${name} ${show(theirs)}.`;
}

function buildLaning(ctx: Ctx, from: number, to: number): { facts: string[]; causes: Cause[]; participated: boolean } {
  const { you, counterpart, isCore } = ctx;
  const facts: string[] = [];
  const causes: Cause[] = [];
  const name = counterpart ? getHeroName(counterpart.hero_id) : "соперник";
  const roleName = ctx.role.label.split(" (")[0];
  const laneEndMin = Math.floor(to / 60);
  const laneEnd = ctx.time(laneEndMin * 60);

  if (isCore && counterpart) {
    for (const m of ctx.bounds.laneCheckpoints.filter((c) => c <= laneEndMin)) {
      const lh = [at(you.lh_t, m), at(counterpart.lh_t, m)] as const;
      const xp = [at(you.xp_t, m), at(counterpart.xp_t, m)] as const;
      const dn = [at(you.dn_t, m), at(counterpart.dn_t, m)] as const;
      if (lh[0] !== null && lh[1] !== null) {
        facts.push(
          `На ${ctx.time(m * 60)}: добивания ${vs(lh[0], lh[1])}${dn[0] !== null && dn[1] !== null ? `, денаи ${vs(dn[0], dn[1])}` : ""}${xp[0] !== null && xp[1] !== null ? `, опыт ${vs(xp[0], xp[1])}` : ""}.`
        );
      }
    }
    const six = levelSixFact(ctx, name, to);
    if (six) facts.push(six);

    const lhEnd = [at(you.lh_t, laneEndMin), at(counterpart.lh_t, laneEndMin)] as const;
    const csGap = Math.max(5, Math.round((8 * laneEndMin) / 10));
    if (lhEnd[0] !== null && lhEnd[1] !== null && lhEnd[0] - lhEnd[1] <= -csGap) {
      causes.push({
        code: "CS_DEFICIT",
        severity: Math.min(60, (lhEnd[1] - lhEnd[0]) * 3),
        text: `Отставание по фарму на линии: ${lhEnd[0]} добиваний на ${laneEnd} против ${lhEnd[1]} у ${name}, вражеского ${roleName}.`,
        target: `${lhEnd[1]}+ добиваний к ${laneEnd} - столько было у ${name} (у тебя ${lhEnd[0]})`,
      });
    }
    const xpEnd = [at(you.xp_t, laneEndMin), at(counterpart.xp_t, laneEndMin)] as const;
    if (xpEnd[0] !== null && xpEnd[1] !== null && xpEnd[1] - xpEnd[0] >= Math.max(250, 0.08 * xpEnd[1])) {
      const [mine, theirs] = [levelForXp(xpEnd[0]), levelForXp(xpEnd[1])];
      causes.push({
        code: "XP_DEFICIT",
        severity: Math.min(50, (xpEnd[1] - xpEnd[0]) / 8),
        text: `Отставание по уровню/опыту на ${laneEnd}: ${formatGold(xpEnd[0])} против ${formatGold(xpEnd[1])} опыта${theirs > mine ? ` (${mine} уровень против ${theirs})` : ""} - отставание по уровням и открытию способностей.`,
        target:
          theirs > mine
            ? `${theirs} уровень к ${laneEnd} - как у ${name} (у тебя был ${mine})`
            : `${formatGold(xpEnd[1])}+ опыта к ${laneEnd} - как у ${name} (у тебя ${formatGold(xpEnd[0])})`,
      });
    }
    if (ctx.metrics.laneEfficiency !== null && !isTurbo(ctx.match.game_mode)) {
      facts.push(`Эффективность линии (OpenDota, относительно идеального фарма): ${ctx.metrics.laneEfficiency}%.`);
    }
    const presence = lanePresenceFact(ctx);
    if (presence) facts.push(presence);
  }

  // The minute-pair where the gap to the counterpart opened the most.
  let worst: { from: number; to: number; before: number; after: number } | null = null;
  for (let m = 2; m <= laneEndMin; m++) {
    const a = checkpointAt(ctx, m - 2);
    const b = checkpointAt(ctx, m);
    if (a && b && (!worst || b.diff - a.diff < worst.after - worst.before)) {
      worst = { from: m - 2, to: m, before: a.diff, after: b.diff };
    }
  }
  if (worst && worst.after - worst.before <= -150) {
    const around = ctx.deaths.filter((d) => d.time >= worst!.from * 60 - 15 && d.time <= worst!.to * 60 + 15);
    causes.push({
      code: "GAP_OPENED",
      severity: Math.min(45, (worst.before - worst.after) / 8),
      text: `Разрыв в нетворсе с ${name} образовался между ${ctx.time(worst.from * 60)} и ${ctx.time(worst.to * 60)} (${formatSigned(worst.before)} -> ${formatSigned(worst.after)})${
        around.length > 0 ? `, в то же окно, что и ${around.length > 1 ? "твои смерти" : "твоя смерть"} в ${around.map((d) => ctx.time(d.time)).join(", ")}` : ""
      }.`,
    });
  }

  const laneDeaths = ctx.deaths.filter((d) => d.time >= from && d.time < to);
  if (laneDeaths.length > 0) {
    const dead = laneDeaths.reduce((s, d) => s + d.timeDead, 0);
    const lost = laneDeaths.reduce((s, d) => s + d.goldLost, 0);
    const early = laneDeaths.filter((d) => d.time < ctx.bounds.earlyDeathCut).length;
    causes.push({
      code: "EARLY_DEATHS",
      severity: laneDeaths.length * 30 + early * 15,
      text: `Умер ${countRu(laneDeaths.length)} на линии${
        early > 0 ? ` (${early} до ${ctx.time(ctx.bounds.earlyDeathCut)})` : ""
      }${dead > 0 ? `, ${dead} сек в мёртвом состоянии` : ""}${lost > 0 ? ` и потерял ${formatGold(lost)} золота` : ""} - каждая смерть также отдаёт врагу волну и опыт.`,
      target: `${laneDeaths.length >= 2 ? "не больше 1 смерти" : "ни одной смерти"} до ${laneEnd} (в этой игре - ${laneDeaths.length})`,
    });
  }
  const killerCounts = new Map<string, number>();
  for (const d of laneDeaths) {
    if (d.killerHeroId !== null) killerCounts.set(d.killer, (killerCounts.get(d.killer) ?? 0) + 1);
  }
  for (const [killer, count] of killerCounts) {
    if (count >= 2) {
      causes.push({
        code: "REPEAT_KILLER",
        severity: 25 + count * 5,
        text: `${killer} убил тебя ${countRu(count)} на линии - один и тот же килл повторился вместо того, чтобы подстроить дистанцию под его способности.`,
        target: `ни один враг не убивает тебя дважды за линию (в этой игре ${killer} - ${countRu(count)})`,
      });
    }
  }
  causes.push(...deathContextCauses(ctx, laneDeaths));

  return { facts, causes, participated: true };
}

interface PhaseSituation {
  // The team was being stomped (or played a player down): pushing and late
  // kills aren't fair asks, defending is the job.
  farBehind: boolean;
}

function buildMidLate(
  ctx: Ctx,
  id: "midGame" | "lateGame",
  from: number,
  to: number,
  startCp: NetWorthCheckpoint | null,
  endCp: NetWorthCheckpoint | null,
  situation: PhaseSituation
): { facts: string[]; causes: Cause[]; participated: boolean } {
  const { you, counterpart, isCore, match } = ctx;
  const facts: string[] = [];
  const causes: Cause[] = [];
  const name = counterpart ? getHeroName(counterpart.hero_id) : "соперник";
  const roleName = ctx.role.label.split(" (")[0];
  const phaseName = id === "midGame" ? "мидгейме" : "лейтгейме";

  if (startCp && endCp) {
    const change = endCp.diff - startCp.diff;
    facts.push(
      `Разрыв в нетворсе с ${name} изменился с ${formatSigned(startCp.diff)} на ${ctx.time(startCp.minute * 60)} до ${formatSigned(endCp.diff)} на ${ctx.time(endCp.minute * 60)} (${change < 0 ? "увеличился" : "сократился"} на ${formatGold(Math.abs(change))}).`
    );
    if (change <= -400) {
      causes.push({
        code: "LOST_NET_WORTH",
        severity: Math.min(50, -change / 60),
        text: `Ты отстал на ${formatGold(-change)} нетворса от ${name} за эту фазу (${formatSigned(startCp.diff)} -> ${formatSigned(endCp.diff)}).`,
      });
    }
  }

  const startMin = Math.floor(from / 60);
  const endMin = Math.min(Math.floor(to / 60), ctx.lastMinute);
  const incomeYou = at(you.gold_t, endMin) !== null && at(you.gold_t, startMin) !== null ? at(you.gold_t, endMin)! - at(you.gold_t, startMin)! : null;
  const incomeThem =
    counterpart && at(counterpart.gold_t, endMin) !== null && at(counterpart.gold_t, startMin) !== null
      ? at(counterpart.gold_t, endMin)! - at(counterpart.gold_t, startMin)!
      : null;
  if (isCore && incomeYou !== null && incomeThem !== null && endMin > startMin) {
    const span = endMin - startMin;
    const a = Math.round(incomeYou / span);
    const b = Math.round(incomeThem / span);
    facts.push(`Золото в минуту с ${ctx.time(startMin * 60)} до ${ctx.time(endMin * 60)}: ты ${formatGold(a)} против ${formatGold(b)} у ${name}.`);
    if (b > 0 && a < b * 0.8) {
      // Halfway to the counterpart: a jump that's actually reachable next game.
      const goal = Math.round((a + b) / 2 / 10) * 10;
      causes.push({
        code: "SLOW_FARM",
        severity: Math.min(45, ((b - a) / b) * 100),
        text: `Скорость фарма ${formatGold(a)} золота/мин против ${formatGold(b)} у ${name} за ${ctx.time(startMin * 60)}-${ctx.time(endMin * 60)} - медленнее на ${Math.round((1 - a / b) * 100)}%.`,
        target: `${formatGold(goal)}+ золота в минуту в ${phaseName} (в этой игре - ${formatGold(a)}, у ${name} - ${formatGold(b)})`,
      });
    }
  }

  const deaths = ctx.deaths.filter((d) => d.time >= from && d.time < to);
  if (deaths.length > 0) {
    facts.push(`Смерти (${deaths.length}): ${deathList(ctx, deaths)}.`);
    const alone = deaths.filter((d) => !d.inFight);
    if (alone.length > 0) {
      causes.push({
        code: "PICKED_OFF",
        severity: alone.length * 30,
        text: `Умер ${countRu(alone.length)} вне замеченных тимфайтов (${alone.map((d) => ctx.time(d.time)).join(", ")}) - тебя поймали одного, а не разменяли в бою с командой.`,
        target: `0 смертей вне драк в ${phaseName} (в этой игре - ${alone.length})`,
      });
    }
    const deep = deaths.filter((d) => d.zone?.deepInEnemyTerritory);
    if (deep.length > 0) {
      causes.push({
        code: "DEEP_ENEMY_DEATH",
        severity: deep.length * 30,
        text: `Погиб глубоко на вражеской территории ${countRu(deep.length)} (${deep.map((d) => `${ctx.time(d.time)} - ${d.zone!.label}`).join("; ")}).`,
        target: `0 смертей глубоко на вражеской половине без команды (в этой игре - ${deep.length})`,
      });
    }
    const dead = deaths.reduce((s, d) => s + d.timeDead, 0);
    if (dead > 0) {
      const share = Math.round((dead / (to - from)) * 100);
      facts.push(`Время в мёртвом состоянии за эту фазу: ${dead} сек (${share}% фазы).`);
      if (dead / (to - from) >= 0.15) {
        causes.push({
          code: "DEAD_TIME",
          severity: 20 + dead / 10,
          text: `${share}% этой фазы ты провёл мёртвым (${dead} сек) - это упущенный фарм, опыт и присутствие на карте.`,
          target: `меньше 10% ${phaseName === "мидгейме" ? "мидгейма" : "лейтгейма"} мёртвым (в этой игре - ${share}%)`,
        });
      }
    }
    causes.push(...deathContextCauses(ctx, deaths));
    const noBuyback = deaths.filter((d) => !d.boughtBack);
    if (id === "lateGame" && isCore && noBuyback.length === deaths.length && deaths.length >= 2) {
      facts.push(`Ни разу не использовал бай-бек на эти ${deaths.length} ${pluralRu(deaths.length, ["смерть", "смерти", "смертей"])}.`);
    }
  } else if (ctx.deathDataComplete) {
    facts.push("Смертей в этой фазе не было.");
  } else {
    facts.push(
      `В этой фазе не найдено смертей, но лог смертей этого матча неполный (только ${ctx.deaths.length} из твоих реальных ${ctx.realDeathTotal} смертей за игру удалось привязать ко времени) - не считай эту фазу фазой без смертей.`
    );
  }

  const kills = ctx.heroKills.filter((k) => k.time >= from && k.time < to);
  if (isCore || kills.length > 0) {
    facts.push(
      kills.length > 0
        ? `Твои килы героев: ${kills.length} (${kills.map((k) => `${ctx.time(k.time)} ${k.victim}`).join("; ")}).`
        : "Твои килы героев: 0."
    );
  }
  // Kills in a game the team is losing badly come from defending, not from
  // a carry choosing to farm elsewhere - not a fair thing to blame.
  if (id === "lateGame" && isCore && kills.length === 0 && deaths.length > 0 && !situation.farBehind) {
    const last = ctx.heroKills.filter((k) => k.time < from).at(-1);
    causes.push({
      code: "NO_LATE_KILLS",
      severity: 35,
      text: `Ни одного килла героя за весь лейтгейм${last ? ` (последний килл был в ${ctx.time(last.time)})` : ""}, при этом ты умер ${countRu(deaths.length)}.`,
    });
  }

  const fights = ctx.fights.filter((f) => f.start >= from && f.start < to);
  // Real evidence this player was actually in the game this phase, not just
  // alive - a phase where they joined none of the real fights and got no
  // kills isn't one to praise for "0 deaths": that's the same passivity a
  // low participation/damage cause already flags, not a separate strength.
  const participated = !(fights.length > 0 && fights.every((f) => !f.you.participated) && kills.length === 0);
  if (fights.length > 0) {
    const took = fights.filter((f) => f.you.participated);
    const missed = fights.filter((f) => !f.you.participated);
    facts.push(
      `Тимфайты: ${fights.length}; ты участвовал в ${took.length}${missed.length > 0 ? ` (отсутствовал в ${missed.map((f) => ctx.time(f.start)).join(", ")})` : ""}. В них твоя команда потеряла ${heroesRu(fights.reduce((s, f) => s + f.yourTeamDeaths, 0))}, а враг - ${fights.reduce((s, f) => s + f.enemyDeaths, 0)}.`
    );
    if (fights.length >= 3 && took.length / fights.length < 0.5) {
      causes.push({
        code: "ABSENT_FROM_FIGHTS",
        severity: 30,
        text: `Участвовал только в ${took.length} из ${fights.length} тимфайтов этой фазы (пропустил ${missed
          .map((f) => {
            const where = ctx.whereDuringMissedFight.get(f.start);
            return `${ctx.time(f.start)}${where ? ` - ты был: ${where}` : ""}`;
          })
          .join("; ")}).`,
        target: `быть хотя бы в 2 из 3 драк команды (в этой игре - ${took.length} из ${fights.length})`,
      });
    }

    if (isCore && counterpart) {
      const compared = fights.filter((f) => f.counterpart && (f.you.participated || f.counterpart.participated));
      if (compared.length > 0) {
        const yours = compared.reduce((s, f) => s + f.you.damage, 0) / compared.length;
        const theirs = compared.reduce((s, f) => s + (f.counterpart?.damage ?? 0), 0) / compared.length;
        facts.push(
          `Средний урон по героям за тимфайт: ты ${formatGold(yours)} против ${formatGold(theirs)} у ${name} (${fightsRu(compared.length)}).`
        );
        if (id === "lateGame" && theirs > 0 && yours < theirs * 0.65) {
          causes.push({
            code: "FIGHT_DAMAGE_GAP",
            severity: 45,
            text: `Ты наносил намного меньше урона в поздних тимфайтах, чем ${name}, вражеский ${roleName}: ${formatGold(yours)} против ${formatGold(theirs)} среднего урона за бой за ${fightsRu(compared.length)}.`,
            target: `${formatGold(theirs)}+ урона по героям за драку - как у ${name} (в этой игре - ${formatGold(yours)})`,
          });
        }
      }
      const diedIn = took.filter((f) => f.you.deaths > 0);
      if (id === "lateGame" && took.length >= 2 && diedIn.length / took.length >= 0.5) {
        causes.push({
          code: "DYING_IN_FIGHTS",
          severity: 40,
          text: `Умирал в ${diedIn.length} из ${took.length} поздних боёв, в которых участвовал (${diedIn.map((f) => ctx.time(f.start)).join(", ")}) - мёртвый кор-герой не наносит урона.`,
          target: `выживать хотя бы в половине драк (в этой игре умер в ${diedIn.length} из ${took.length})`,
        });
      }
    }
  }

  const towers = towersIn(match, from, to, you.isRadiant);
  const bits: string[] = [];
  if (towers.lost.length > 0) bits.push(`твоя команда потеряла ${towers.lost.length} ${pluralRu(towers.lost.length, ["башню", "башни", "башен"])} (${towers.lost.map((t) => ctx.time(t)).join(", ")})`);
  if (towers.taken.length > 0) bits.push(`твоя команда забрала ${towers.taken.length} ${pluralRu(towers.taken.length, ["вражескую башню", "вражеские башни", "вражеских башен"])}`);
  if (towers.barracksLost.length > 0) bits.push(`твои казармы/трон пали в ${towers.barracksLost.map((t) => ctx.time(t)).join(", ")}`);
  for (const r of roshanIn(match, from, to, you.isRadiant)) {
    bits.push(`${r.yours ? "твоя" : "вражеская"} команда убила Roshan в ${ctx.time(r.time)}`);
  }
  if (bits.length > 0) facts.push(`Цели: ${bits.join("; ")}.`);

  if (id === "lateGame" && isCore && counterpart) {
    facts.push(
      `Урон по башням за всю игру: ты ${formatGold(you.tower_damage)} против ${formatGold(counterpart.tower_damage)} у ${name}.`
    );
    // Pushing is a fair ask only when the team could push: not while the
    // enemy is sieging your base.
    // 145 against 358 is two creep waves' worth, not a habit.
    const gap = counterpart.tower_damage - you.tower_damage;
    if (gap >= 1500 && you.tower_damage < counterpart.tower_damage * 0.5 && !situation.farBehind) {
      causes.push({
        code: "LOW_BUILDING_PRESSURE",
        severity: 25,
        text: `Слабое давление на постройки: ${formatGold(you.tower_damage)} урона по башням против ${formatGold(counterpart.tower_damage)} у ${name} - в долгой игре задача кор-героя - забирать постройки и трон.`,
        target: `${formatGold(counterpart.tower_damage)}+ урона по башням за игру - как у ${name} (в этой игре - ${formatGold(you.tower_damage)})`,
      });
    }
  }

  if (!isCore) {
    const wards = wardFacts(ctx, from, to);
    facts.push(...wards.facts);
    causes.push(...wards.causes);
    const w = wardCause(ctx, from, to);
    if (w) causes.push(w);
  }

  const items = itemTimingFacts(ctx, from, to);
  facts.push(...items.facts);
  causes.push(...items.lateCauses);

  return { facts, causes, participated };
}

function relevantStats(
  metrics: MatchMetrics,
  role: RoleProfile,
  heroId: number,
  you: OpenDotaMatchPlayer
): MetricPoint[] {
  const hasDisable = heroKitHasDisable(heroId);
  const hasHealing = heroKitHasHealing(heroId);
  const stats = metrics.stats.filter((s) => {
    if (!role.relevantStats.includes(s.label)) return false;
    if (s.label === "Станы (сек)") return hasDisable;
    if (s.label === "Лечение в минуту") return hasHealing;
    return true;
  });
  if (!role.isCore) {
    stats.push({ label: "Поставлено вардов (Observer + Sentry)", value: (you.obs_placed ?? 0) + (you.sen_placed ?? 0) });
    stats.push({ label: "Уничтожено вражеских вардов", value: (you.observer_kills ?? 0) + (you.sentry_kills ?? 0) });
    stats.push({ label: "Застакано лагерей", value: you.camps_stacked ?? 0 });
  }
  return stats;
}

// ---- End-of-game comparison with the counterpart ----

interface ComparisonRow {
  key: string;
  // Rows that say the same thing (kills, assists, kill share) share a group,
  // so one "you fought a lot" doesn't fill every strength slot.
  group?: string;
  label: string;
  you: number;
  them: number;
  lowerBetter?: boolean;
  percent?: boolean;
  // How big a gap has to be before it counts as one: 4 deaths against 5 or
  // 436 GPM against 420 is noise, not a strength.
  minGap: number;
  minRatio: number;
  // How a clear edge reads as a strength.
  strength: (name: string) => string;
}

function teamKills(match: OpenDotaMatch, radiant: boolean): number {
  return match.players.filter((p) => p.isRadiant === radiant).reduce((s, p) => s + p.kills, 0);
}

function killParticipation(match: OpenDotaMatch, p: OpenDotaMatchPlayer): number | null {
  const team = teamKills(match, p.isRadiant);
  return team >= 5 ? Math.round(((p.kills + p.assists) / team) * 100) : null;
}

function comparisonRows(ctx: Ctx, position: number): ComparisonRow[] {
  const { you, counterpart, match } = ctx;
  if (!counterpart) return [];
  const nw = (p: OpenDotaMatchPlayer) => p.net_worth ?? p.gold_spent + p.gold;
  const rows: ComparisonRow[] = [
    // Same bar as the phase verdicts, so the two never disagree.
    { key: "net_worth", label: "Нетворс", you: nw(you), them: nw(counterpart), minGap: ctx.isCore ? 300 : 250, minRatio: 0.07, strength: (n) => `Ты закончил игру богаче, чем ${n}.` },
  ];
  if (position <= 3) {
    rows.push(
      { key: "gpm", label: "Золото в минуту", you: you.gold_per_min, them: counterpart.gold_per_min, minGap: 40, minRatio: 0.1, strength: (n) => `Ты фармил быстрее, чем ${n}.` },
      { key: "last_hits", label: "Добивания", you: you.last_hits, them: counterpart.last_hits, minGap: 20, minRatio: 0.15, strength: (n) => `У тебя заметно больше добиваний, чем у ${n}.` },
      { key: "tower_damage", label: "Урон по башням", you: you.tower_damage, them: counterpart.tower_damage, minGap: 1000, minRatio: 0.5, strength: (n) => `Ты давил на постройки сильнее, чем ${n}.` }
    );
    if (position >= 2) {
      rows.push({ key: "hero_damage", label: "Урон по героям", you: you.hero_damage, them: counterpart.hero_damage, minGap: 3000, minRatio: 0.25, strength: (n) => `Ты нанёс героям заметно больше урона, чем ${n}.` });
    }
  } else {
    rows.push(
      { key: "wards", label: "Поставлено вардов", you: (you.obs_placed ?? 0) + (you.sen_placed ?? 0), them: (counterpart.obs_placed ?? 0) + (counterpart.sen_placed ?? 0), minGap: 3, minRatio: 0.3, strength: (n) => `Ты дал команде больше обзора, чем ${n}.` },
      { key: "dewards", label: "Снято вражеских вардов", you: (you.observer_kills ?? 0) + (you.sentry_kills ?? 0), them: (counterpart.observer_kills ?? 0) + (counterpart.sentry_kills ?? 0), minGap: 2, minRatio: 0.5, strength: (n) => `Ты снял больше вражеских вардов, чем ${n}.` },
      { key: "stacks", label: "Застакано лагерей", you: you.camps_stacked ?? 0, them: counterpart.camps_stacked ?? 0, minGap: 2, minRatio: 0.5, strength: (n) => `Ты застакал больше лагерей, чем ${n}.` }
    );
  }
  rows.push(
    { key: "kills", group: "kills", label: "Киллы", you: you.kills, them: counterpart.kills, minGap: 3, minRatio: 0.5, strength: (n) => `Ты убивал чаще, чем ${n}.` },
    { key: "deaths", label: "Смерти", you: you.deaths, them: counterpart.deaths, lowerBetter: true, minGap: 3, minRatio: 0.4, strength: (n) => `Ты умирал заметно реже, чем ${n}.` },
    { key: "assists", group: "kills", label: "Помощи", you: you.assists, them: counterpart.assists, minGap: 4, minRatio: 0.3, strength: (n) => `Ты помог в заметно большем числе убийств, чем ${n}.` }
  );
  const kpYou = killParticipation(match, you);
  const kpThem = killParticipation(match, counterpart);
  if (kpYou !== null && kpThem !== null) {
    rows.push({ key: "kp", group: "kills", label: "Участие в убийствах команды", you: kpYou, them: kpThem, percent: true, minGap: 15, minRatio: 0, strength: (n) => `Ты участвовал в большей доле убийств своей команды, чем ${n}.` });
  }
  return rows;
}

function edge(row: ComparisonRow, forYou: boolean): boolean {
  const [a, b] = forYou ? [row.you, row.them] : [row.them, row.you];
  const gap = row.lowerBetter ? b - a : a - b;
  return gap >= row.minGap && gap / Math.max(Math.abs(b), 1) >= row.minRatio;
}

function rowLine(row: ComparisonRow): string {
  const verdict = edge(row, true) ? "лучше" : edge(row, false) ? "хуже" : "примерно наравне";
  const values = row.percent
    ? `ты ${row.you}% против ${row.them}% (${formatSigned(row.you - row.them)} п.п.)`
    : vs(row.you, row.them);
  return `${row.label}: ${values} - ${verdict}`;
}

// ---- Strengths ----

interface RankedFinding extends CoachFinding {
  weight: number;
  // Same underlying stat: only the strongest finding per key is kept.
  key: string;
}

const PERCENTILE_KEY: Record<string, string> = {
  "Золото в минуту": "gpm",
  "Опыт в минуту": "xpm",
  "Добивания в минуту": "last_hits",
  "Урон по героям в минуту": "hero_damage",
  "Урон по башням": "tower_damage",
  "Лечение в минуту": "healing",
};

function buildStrengths(args: {
  ctx: Ctx;
  phases: PhaseAnalysis[];
  participationByPhase: Map<PhaseId, boolean>;
  rows: ComparisonRow[];
  stats: MetricPoint[];
  youLeft: boolean;
  // Strengths worked out elsewhere (the game's flow, positioning).
  extra: RankedFinding[];
}): CoachFinding[] {
  const { ctx, phases, participationByPhase, rows, stats, youLeft } = args;
  const name = ctx.counterpart ? getHeroName(ctx.counterpart.hero_id) : "соперник";
  const found: RankedFinding[] = [...args.extra];

  // Every won phase in one line - three cards saying "you won a phase" crowd
  // out everything else the player did well.
  const won = phases.filter((p) => p.verdict === "won");
  if (won.length > 0) {
    found.push({
      key: "phases",
      weight: 50 + won.length * 10,
      point:
        won.length === 1
          ? `Ты выиграл фазу «${won[0].label}» у ${name} - врага на твоей позиции.`
          : `Ты обошёл ${name}, врага на твоей позиции, по нетворсу в фазах ${won.map((p) => `«${p.label}»`).join(", ")}.`,
      metric: won.map((p) => p.verdictBasis).join("; "),
    });
  }

  for (const phase of phases) {
    // ctx.deathDataComplete gates this for real: an incomplete death log can
    // never support "0 deaths" as a claim, regardless of what any phase's
    // facts happen to say - a missing death could be in any phase.
    const hadNoDeaths =
      ctx.deathDataComplete &&
      phase.facts.some((f) => f === "Смертей в этой фазе не было." || f === "Смертей на линии не было.");
    if (!hadNoDeaths) continue;
    // A phase with 0 deaths is only worth praising when the verdict wasn't a
    // loss, or - for mid/late - when there's real evidence this player was
    // actually in the fights: 0 deaths from sitting out isn't survival, it's
    // the same passivity problem the causes above already call out, and
    // showing it as a strength would flatly contradict that same analysis.
    const participated = participationByPhase.get(phase.id) ?? true;
    const meaningful = phase.verdict !== "lost" || (phase.id !== "laning" && participated);
    if (meaningful) {
      found.push({
        key: `alive:${phase.id}`,
        weight: phase.id === "laning" ? 45 : 35,
        point: `Ты ни разу не умер в фазе «${phase.label}».`,
        metric: `${phase.label} ${phase.window}: 0 смертей`,
      });
    }
  }

  // Holding the lane even is a real result - laning against the same-position
  // enemy without falling behind is what the rest of the game is built on.
  const laning = phases.find((p) => p.id === "laning");
  if (laning?.verdict === "even") {
    found.push({ key: "lane-even", weight: 25, point: `Ты отстоял линию наравне с ${name}.`, metric: laning.verdictBasis });
  }

  // Being there when the team fights is the habit most games turn on.
  const fights = ctx.fights.filter((f) => f.start < ctx.end);
  const took = fights.filter((f) => f.you.participated);
  if (fights.length >= 4 && took.length / fights.length >= 0.75) {
    const killed = took.reduce((s, f) => s + f.enemyDeaths, 0);
    const lost = took.reduce((s, f) => s + f.yourTeamDeaths, 0);
    found.push({
      key: "fights",
      weight: 40,
      point: `Ты был почти во всех драках команды - это то, что выигрывает игры.`,
      metric: `Тимфайты: участвовал в ${took.length} из ${fights.length}; в них враг потерял ${heroesRu(killed)}, твоя команда - ${lost}`,
    });
  }

  // Whole-game totals say nothing about a player who left partway.
  if (!youLeft) {
    for (const row of rows) {
      if (row.key === "net_worth" && phases.length > 0) continue; // the phase verdicts already say it
      if (!edge(row, true)) continue;
      const ratio = Math.abs(row.you - row.them) / Math.max(row.them, 1);
      found.push({ key: row.group ?? row.key, weight: 20 + Math.min(25, ratio * 40), point: row.strength(name), metric: rowLine(row) });
    }
    const kp = killParticipation(ctx.match, ctx.you);
    if (kp !== null && kp >= 65) {
      found.push({
        key: "kills",
        weight: 35,
        point: "Ты участвовал в большинстве убийств своей команды.",
        metric: `Участие в убийствах команды: (${ctx.you.kills} + ${ctx.you.assists}) из ${teamKills(ctx.match, ctx.you.isRadiant)} = ${kp}%`,
      });
    }
    // A stat in the top quarter of everyone who plays this hero is a strength
    // on its own, whatever the counterpart did.
    for (const s of stats) {
      if (s.percentile === undefined || s.percentile < 75) continue;
      found.push({
        key: PERCENTILE_KEY[s.label] ?? s.label,
        weight: 20 + (s.percentile - 75),
        point: `Показатель «${s.label.toLowerCase()}» - на уровне лучших ${Math.max(1, 100 - s.percentile)}% игроков на ${getHeroName(ctx.you.hero_id)}.`,
        metric: `${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ""} (${s.percentile}-й перцентиль)`,
      });
    }
  }

  // Support: wards the enemy never found are wards placed where it matters.
  if (!ctx.isCore) {
    const fates = observerFates(ctx.match, ctx.you).filter((w) => w.time < ctx.end);
    const dewarded = fates.filter((w) => w.dewardedBy !== null).length;
    if (fates.length >= 4 && dewarded / fates.length <= 0.25) {
      found.push({
        key: "ward-survival",
        weight: 35,
        point: "Враг почти не находил твои Observer Ward - ты ставишь их туда, где их не ищут.",
        metric: `Observer Ward: поставлено ${fates.length}, враг снял ${dewarded}`,
      });
    }
  }

  const best = new Map<string, RankedFinding>();
  for (const f of found) {
    const current = best.get(f.key);
    if (!current || f.weight > current.weight) best.set(f.key, f);
  }
  return [...best.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map(({ point, metric }) => ({ point, metric }));
}

export function buildMatchAnalysis(args: {
  match: OpenDotaMatch;
  accountId: number;
  positions: ResolvedPositions;
  metrics: MatchMetrics;
  metaItemTiming: ItemProgressionPoint[];
  deathVision?: DeathVisionMoment[];
  // Every hero's movement (STRATZ) - positioning in fights; null when missing.
  positionTracks?: StratzPositionTrack[] | null;
}): MatchAnalysis {
  const { match, accountId, positions, metrics, metaItemTiming } = args;
  const you = match.players.find((p) => p.account_id === accountId);
  if (!you) throw new Error(`Player ${accountId} not found in match ${match.match_id}`);

  const position = positions.bySlot.get(you.player_slot) ?? 3;
  const role = roleProfileFor(position);
  const counterpart =
    match.players.find(
      (p) => p.isRadiant !== you.isRadiant && positions.bySlot.get(p.player_slot) === position
    ) ?? null;

  const turbo = isTurbo(match.game_mode);
  const bounds = turbo ? TURBO_BOUNDS : NORMAL_BOUNDS;
  const context = buildGameContext(match, you, counterpart, bounds);
  const yourLeave = context.leavers.find((l) => l.isYou);
  const counterpartLeave = context.leavers.find((l) => l.isCounterpart && l.time !== null);
  const teammateLeave = context.leavers.find((l) => l.yourTeam && !l.isYou && l.time !== null);
  const enemyLeave = context.leavers.find((l) => !l.yourTeam && !l.isCounterpart && l.time !== null);
  const end = yourLeave?.time != null ? Math.min(match.duration, yourLeave.time) : match.duration;

  const known = new Set<string>(["0:00"]);
  const time = (seconds: number) => {
    const label = formatMatchTime(seconds);
    known.add(label);
    return label;
  };

  const youIndex = match.players.indexOf(you);
  const counterpartIndex = counterpart ? match.players.indexOf(counterpart) : -1;
  const lastMinute = Math.floor(end / 60);
  const deathData = collectDeaths(match, you, youIndex, metrics.deathLog, args.deathVision ?? []);

  // The whole game and how the player stood in it - fed into the phases
  // below and ranked against everything else.
  const flowResult = buildGameFlow({
    match,
    you,
    turbo,
    isCore: role.isCore,
    end,
    laneEnd: bounds.laneEnd,
    time,
    teammateLeftAt: teammateLeave?.time ?? null,
  });
  const positioning = args.positionTracks
    ? analysePositioning({ match, you, tracks: args.positionTracks, position, end, laneEnd: bounds.laneEnd, time })
    : null;
  const thrown = flowResult?.flow.kind === "throw";
  // Causes about the whole game go to the phase where they happened (the
  // first time they mention). In a thrown game they outrank everything: the
  // lane is not what lost a game won by 15 000.
  const gameCauses: Cause[] = [...(flowResult?.causes ?? []), ...(positioning?.causes ?? [])].map((c) => ({
    ...c,
    severity: c.severity + (thrown && flowResult!.causes.includes(c) ? 40 : 0),
  }));
  const anchorOf = (c: Cause): number => {
    const m = c.text.match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number.POSITIVE_INFINITY;
  };

  const ctx: Ctx = {
    match,
    you,
    counterpart,
    role,
    isCore: role.isCore,
    bounds,
    end,
    deaths: deathData.events.filter((d) => d.time < end),
    deathDataComplete: deathData.complete,
    realDeathTotal: deathData.realTotal,
    heroKills: (you.kills_log ?? []).map((k) => ({ time: k.time, victim: heroNameFromKey(match, k.key) })),
    fights: collectFights(match, youIndex, counterpartIndex),
    lastMinute,
    metaItemTiming,
    metrics,
    time,
    nearestAllyAtDeath: positioning?.nearestAllyAtDeath ?? new Map(),
    whereDuringMissedFight: positioning?.whereDuringMissedFight ?? new Map(),
  };

  // No comparison with a counterpart past the minute they left: their items
  // are sold and their net worth is meaningless from there.
  const comparableUntil = counterpartLeave?.time ?? Infinity;
  const netWorth = CHECKPOINT_MINUTES.filter((m) => m <= lastMinute && m * 60 <= comparableUntil)
    .map((m) => checkpointAt(ctx, m))
    .filter((c): c is NetWorthCheckpoint => c !== null);
  for (const c of netWorth) time(c.minute * 60);

  const teamAdvantageAt = (minute: number): number | null => {
    const adv = at(match.radiant_gold_adv, minute);
    if (adv === null) return null;
    return you.isRadiant ? adv : -adv;
  };

  const phases: PhaseAnalysis[] = [];
  const allCauses: Cause[] = [];
  const participationByPhase = new Map<PhaseId, boolean>();
  // Phase verdicts and net worth checkpoints both depend on this player's
  // real per-minute net worth series - without it every verdict would be
  // null and every phase would degrade to disclaimers, which is more
  // confusing than useful. Some matches never get this level of detail from
  // OpenDota (the replay expired before it could be parsed, even after a
  // fresh parse request) - in that case this analysis has no phases at all,
  // and the coach report falls back to end-of-game stats only, same as a
  // match with no parsed timeline always has.
  const hasTimelineData = (you.networth_t?.length ?? 0) > 0;
  const defs: { id: PhaseId; label: string; from: number; to: number }[] = [
    { id: "laning", label: "Линия", from: 0, to: bounds.laneEnd },
    { id: "midGame", label: "Мидгейм", from: bounds.laneEnd, to: bounds.midEnd },
    { id: "lateGame", label: "Лейтгейм", from: bounds.midEnd, to: Number.POSITIVE_INFINITY },
  ];
  if (end - bounds.midEnd < bounds.minLate) {
    defs[1].to = Number.POSITIVE_INFINITY;
    defs.pop();
  }

  for (const def of hasTimelineData ? defs : []) {
    if (end < def.from + MIN_PHASE_SECONDS) continue;
    const to = Math.min(def.to, end);
    const endMin = Math.min(Math.floor(to / 60), lastMinute);
    const startMin = Math.floor(def.from / 60);
    const counterpartGone = to > comparableUntil + 60;
    const phaseCtx: Ctx = counterpartGone ? { ...ctx, counterpart: null } : ctx;
    const endCp = checkpointAt(phaseCtx, endMin);
    const startCp = def.from > 0 ? checkpointAt(phaseCtx, startMin) : null;

    const teamAdv = teamAdvantageAt(endMin);
    const teammateGone = teammateLeave?.time != null && teammateLeave.time < to;
    const situation: PhaseSituation = {
      farBehind: (teamAdv !== null && teamAdv <= -bounds.farBehind) || teammateGone,
    };

    const built =
      def.id === "laning"
        ? buildLaning(phaseCtx, def.from, to)
        : buildMidLate(phaseCtx, def.id, def.from, to, startCp, endCp, situation);

    const facts: string[] = [];
    const counterpartName = counterpart ? getHeroName(counterpart.hero_id) : "соперника";
    if (endCp) facts.push(`Нетворс на ${time(endMin * 60)} против ${counterpartName}: ${vs(endCp.you, endCp.counterpart)}.`);
    if (teamAdv !== null) {
      facts.push(`Общее золотое преимущество твоей команды на ${time(endMin * 60)}: ${formatSigned(teamAdv)}${teamAdv < 0 ? " (отстаёт)" : " (впереди)"}.`);
      if (def.id !== "laning" && teamAdv <= -bounds.farBehind) {
        const baseUnderSiege = towersIn(match, def.from, to, you.isRadiant).barracksLost.length > 0;
        facts.push(
          `Ситуация фазы: твоя команда сильно отставала по золоту${baseUnderSiege ? " и защищала свою базу" : ""} - это была фаза обороны, а не атаки.`
        );
      } else if (def.id !== "laning" && teamAdv >= bounds.farBehind) {
        facts.push("Ситуация фазы: твоя команда уверенно вела по золоту.");
      }
    }
    if (teammateGone) {
      facts.push(`С ${time(teammateLeave!.time!)} твоя команда играла вчетвером: ${teammateLeave!.heroName} покинул игру.`);
    }
    if (enemyLeave?.time != null && enemyLeave.time < to) {
      facts.push(`С ${time(enemyLeave.time)} враг играл вчетвером: ${enemyLeave.heroName} покинул игру.`);
    }
    if (counterpartGone) {
      facts.push(`${counterpartName}, соперник на твоей позиции, покинул игру в ${time(comparableUntil)} - сравнения с ним в этой фазе нет.`);
    }
    if (def.id === "laning") {
      const laneDeaths = ctx.deaths.filter((d) => d.time < to);
      if (laneDeaths.length > 0) {
        facts.push(`Смерти (${laneDeaths.length}): ${deathList(ctx, laneDeaths, false)}.`);
      } else if (ctx.deathDataComplete) {
        facts.push("Смертей на линии не было.");
      } else {
        facts.push(
          `На линии не найдено смертей, но лог смертей этого матча неполный (только ${ctx.deaths.length} из твоих реальных ${ctx.realDeathTotal} смертей за игру удалось привязать ко времени) - не считай эту стадию стадией без смертей.`
        );
      }
      const laneKills = ctx.heroKills.filter((k) => k.time < to);
      if (laneKills.length > 0) facts.push(`Твои килы героев: ${laneKills.length} (${laneKills.map((k) => `${time(k.time)} ${k.victim}`).join("; ")}).`);
      const items = itemTimingFacts(ctx, def.from, to);
      facts.push(...built.facts, ...items.facts);
      built.causes.push(...items.lateCauses.map((c) => ({ ...c, severity: 25 })));
      if (!ctx.isCore) {
        const wards = wardFacts(ctx, def.from, to);
        facts.push(...wards.facts);
        built.causes.push(...wards.causes);
        const w = wardCause(ctx, def.from, to);
        if (w) built.causes.push(w);
      }
    } else {
      facts.push(...built.facts);
    }
    participationByPhase.set(def.id, built.participated);
    const lastPhase = def === defs[defs.length - 1] || to >= end;
    built.causes.push(
      ...gameCauses.filter((c) => {
        const t = anchorOf(c);
        return (t >= def.from && t < to) || (lastPhase && t >= to);
      })
    );

    const top = built.causes.sort((a, b) => b.severity - a.severity).slice(0, 4);
    allCauses.push(...top);
    const principles = [
      ...new Set(top.map((c) => principleFor(c.code, position)).filter((x): x is string => x !== null)),
    ].slice(0, 2);
    const verdict = counterpartGone ? null : decideVerdict(endCp, ctx.isCore);

    phases.push({
      id: def.id,
      label: def.label,
      window: `${time(def.from)}-${time(to)}`,
      verdict,
      verdictBasis: counterpartGone
        ? `${counterpartName} покинул игру в ${time(comparableUntil)} - сравнения нет`
        : endCp
          ? `нетворс на ${time(endMin * 60)}: ${vs(endCp.you, endCp.counterpart)}`
          : "нет данных по нетворсу за эту фазу",
      facts,
      causes: top.map((c) => c.text),
      principles,
    });
  }

  const laneName = you.lane === 1 ? "на боте" : you.lane === 2 ? "на миде" : you.lane === 3 ? "на топе" : null;
  const laneOpponents = match.players.filter((p) => p.lane === you.lane && p.isRadiant !== you.isRadiant);
  const laneMates = match.players.filter((p) => p !== you && p.lane === you.lane && p.isRadiant === you.isRadiant);
  const laneSummary = laneName
    ? `Ты играл ${laneName}${laneMates.length > 0 ? ` вместе с ${laneMates.map((p) => getHeroName(p.hero_id)).join(", ")}` : " один"} против ${laneOpponents.length > 0 ? laneOpponents.map((p) => getHeroName(p.hero_id)).join(", ") : "никого"} (это физические противники по линии - не обязательно соперник на твоей позиции).`
    : "Данные о линии недоступны.";

  const priorities: CoachFinding[] = [];
  const seenCodes = new Set<CauseCode>();
  for (const cause of [...allCauses].sort((a, b) => b.severity - a.severity)) {
    if (seenCodes.has(cause.code)) continue;
    const advice = principleFor(cause.code, position);
    if (!advice) continue;
    seenCodes.add(cause.code);
    priorities.push({ point: advice, metric: cause.text, ...(cause.target ? { target: cause.target } : {}) });
    if (priorities.length === 3) break;
  }

  // Whole-game comparisons stop meaning anything once either side left.
  const rows = yourLeave || context.leavers.some((l) => l.isCounterpart) ? [] : comparisonRows(ctx, position);
  const stats = relevantStats(metrics, role, you.hero_id, you);
  const strengths = buildStrengths({
    ctx,
    phases,
    participationByPhase,
    rows,
    stats,
    youLeft: Boolean(yourLeave),
    extra: [
      ...(flowResult?.strengths ?? []).map((f) => ({ ...f, key: "comeback", weight: 55 })),
      ...(positioning?.strengths ?? []).map((f) => ({ ...f, key: "positioning", weight: 38 })),
    ],
  });

  const killerCounts = new Map<string, { heroId: number; count: number }>();
  for (const d of ctx.deaths) {
    if (d.killerHeroId === null) continue;
    const entry = killerCounts.get(d.killer) ?? { heroId: d.killerHeroId, count: 0 };
    entry.count += 1;
    killerCounts.set(d.killer, entry);
  }
  const repeatKillers = [...killerCounts.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([heroName, v]) => ({ heroId: v.heroId, heroName, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const knownItems = new Set<string>();
  for (const p of you.purchase_log ?? []) knownItems.add(getItemNameByKey(p.key));
  for (const id of [you.item_0, you.item_1, you.item_2, you.item_3, you.item_4, you.item_5, you.item_neutral, you.backpack_0, you.backpack_1, you.backpack_2]) {
    const key = typeof id === "number" && id > 0 ? getItemKeyById(id) : null;
    if (key) knownItems.add(getItemNameByKey(key));
  }
  for (const m of metaItemTiming) knownItems.add(getItemNameByKey(m.itemKey));
  for (const l of context.leavers) if (l.time !== null) time(l.time);

  return {
    matchId: match.match_id,
    heroId: you.hero_id,
    heroName: getHeroName(you.hero_id),
    win: metrics.win,
    durationSeconds: match.duration,
    position,
    positionLabel: role.label,
    positionSource: positions.source,
    counterpart: counterpart ? { heroId: counterpart.hero_id, heroName: getHeroName(counterpart.hero_id) } : null,
    laneSummary,
    netWorth,
    phases,
    endStateVsCounterpart: rows.map(rowLine),
    // Whole-game totals of a player who left are mostly time spent gone.
    stats: yourLeave ? [] : stats,
    knownTimes: [...known],
    repeatKillers,
    knownItems: [...knownItems],
    strengths,
    priorities,
    buybacksUsed: (you.buyback_log ?? []).length || metrics.buybacks,
    context,
    deathTimes: ctx.deaths.map((d) => d.time),
    gameFlow: flowResult
      ? { ...flowResult.flow, facts: [...flowResult.flow.facts, ...(positioning?.facts ?? [])] }
      : null,
  };
}
