import { getHeroInternalName, getHeroName, getItemKeyById, getItemNameByKey } from "../constants";
import { formatGold, formatMatchTime, formatSigned, pluralRu } from "../format";
import { heroKitHasDisable, heroKitHasHealing } from "../coach/kit";
import { principleFor, type CauseCode } from "../coach/principles";
import { roleProfileFor, type RoleProfile } from "../coach/roles";
import { classifyZone, isBaseCell, laneOfCell, positionCells, type MapZone } from "./mapZones";
import type { ResolvedPositions } from "./matchPositions";
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
// Phase 2 ends and phase 3 starts here regardless of how long the game runs.
const PHASE_DEFS: { id: PhaseId; label: string; from: number; to: number }[] = [
  { id: "laning", label: "Линия", from: 0, to: 600 },
  { id: "midGame", label: "Мидгейм", from: 600, to: 1500 },
  { id: "lateGame", label: "Лейтгейм", from: 1500, to: Number.POSITIVE_INFINITY },
];

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
}

interface Ctx {
  match: OpenDotaMatch;
  you: OpenDotaMatchPlayer;
  counterpart: OpenDotaMatchPlayer | null;
  role: RoleProfile;
  isCore: boolean;
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
      if (d.boughtBack) parts.push("бай-бек");
      return `${ctx.time(d.time)} ${d.killer}${parts.length > 0 ? ` (${parts.join("; ")})` : ""}`;
    })
    .join(" | ");
}

// " 3 раза" for repeated events, nothing for a single one.
function timesRu(count: number): string {
  return count > 1 ? ` ${count} ${pluralRu(count, ["раз", "раза", "раз"])}` : "";
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

function itemTimingFacts(ctx: Ctx, from: number, to: number): { facts: string[]; lateCauses: string[] } {
  const metaByKey = new Map(ctx.metaItemTiming.map((m) => [m.itemKey, m]));
  const rows = ctx.metrics.itemTimeline
    .filter((p) => p.time >= from && p.time < to && metaByKey.has(p.itemKey))
    .map((p) => {
      const meta = metaByKey.get(p.itemKey)!;
      return { name: p.itemName, time: p.time, deltaMin: (p.time - meta.avgTimeSeconds) / 60 };
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
    lateCauses: rows.filter((r) => r.deltaMin >= 2.5).map((r) => `${label(r)} - ключевой предмет собран с опозданием.`),
  };
}

function wardCause(ctx: Ctx, from: number, to: number): Cause | null {
  if (ctx.isCore) return null;
  const placed = [...(ctx.you.obs_log ?? []), ...(ctx.you.sen_log ?? [])].filter((w) => w.time >= from && w.time < to).length;
  const window = Math.min(to, ctx.match.duration) - from;
  const expected = Math.floor(window / 300); // roughly one ward every five minutes as a floor
  if (expected < 1 || placed >= Math.min(expected, 2)) return null;
  return {
    code: "NO_VISION",
    severity: ctx.role.position === 5 ? 40 : 25,
    text: `Поставил всего ${placed} ${placed === 1 ? "вард" : "варда"} между ${ctx.time(from)} и ${ctx.time(Math.min(to, ctx.match.duration))} - обзор - это работа саппорта.`,
  };
}

function wardFacts(ctx: Ctx, from: number, to: number): string[] {
  const inWindow = (log: { time: number }[] | undefined) => (log ?? []).filter((w) => w.time >= from && w.time < to);
  const obs = inWindow(ctx.you.obs_log);
  const sen = inWindow(ctx.you.sen_log);
  const line = `Варды, поставленные тобой в этой фазе: Observer Ward - ${obs.length}${obs.length > 0 ? ` (${obs.map((w) => ctx.time(w.time)).join(", ")})` : ""}, Sentry Ward - ${sen.length}.`;
  return [line];
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

function buildLaning(ctx: Ctx, from: number, to: number): { facts: string[]; causes: Cause[]; participated: boolean } {
  const { you, counterpart, isCore } = ctx;
  const facts: string[] = [];
  const causes: Cause[] = [];
  const name = counterpart ? getHeroName(counterpart.hero_id) : "соперник";

  if (isCore && counterpart) {
    for (const m of [5, 10]) {
      const lh = [at(you.lh_t, m), at(counterpart.lh_t, m)] as const;
      const xp = [at(you.xp_t, m), at(counterpart.xp_t, m)] as const;
      const dn = [at(you.dn_t, m), at(counterpart.dn_t, m)] as const;
      if (lh[0] !== null && lh[1] !== null) {
        facts.push(
          `На ${ctx.time(m * 60)}: добивания ${vs(lh[0], lh[1])}${dn[0] !== null && dn[1] !== null ? `, денаи ${vs(dn[0], dn[1])}` : ""}${xp[0] !== null && xp[1] !== null ? `, опыт ${vs(xp[0], xp[1])}` : ""}.`
        );
      }
    }
    const lh10 = [at(you.lh_t, 10), at(counterpart.lh_t, 10)] as const;
    if (lh10[0] !== null && lh10[1] !== null && lh10[0] - lh10[1] <= -8) {
      causes.push({ code: "CS_DEFICIT",
        severity: Math.min(60, (lh10[1] - lh10[0]) * 3),
        text: `Отставание по фарму на линии: ${lh10[0]} добиваний на ${ctx.time(600)} против ${lh10[1]} у ${name}, вражеского ${ctx.role.label.split(" (")[0]}.`,
      });
    }
    const xp10 = [at(you.xp_t, 10), at(counterpart.xp_t, 10)] as const;
    if (xp10[0] !== null && xp10[1] !== null && xp10[0] - xp10[1] <= -250) {
      causes.push({ code: "XP_DEFICIT",
        severity: Math.min(50, (xp10[1] - xp10[0]) / 8),
        text: `Отставание по уровню/опыту на ${ctx.time(600)}: ${formatGold(xp10[0])} против ${formatGold(xp10[1])} опыта - отставание по уровням и открытию способностей.`,
      });
    }
    if (ctx.metrics.laneEfficiency !== null) {
      facts.push(`Эффективность линии (OpenDota, относительно идеального фарма): ${ctx.metrics.laneEfficiency}%.`);
    }
    const presence = lanePresenceFact(ctx);
    if (presence) facts.push(presence);
  }

  // The minute-pair where the gap to the counterpart opened the most.
  let worst: { from: number; to: number; before: number; after: number } | null = null;
  for (let m = 2; m <= 10; m++) {
    const a = checkpointAt(ctx, m - 2);
    const b = checkpointAt(ctx, m);
    if (a && b && (!worst || b.diff - a.diff < worst.after - worst.before)) {
      worst = { from: m - 2, to: m, before: a.diff, after: b.diff };
    }
  }
  if (worst && worst.after - worst.before <= -150) {
    const around = ctx.deaths.filter((d) => d.time >= worst!.from * 60 - 15 && d.time <= worst!.to * 60 + 15);
    causes.push({ code: "GAP_OPENED",
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
    const early = laneDeaths.filter((d) => d.time < 300).length;
    causes.push({ code: "EARLY_DEATHS",
      severity: laneDeaths.length * 30 + early * 15,
      text: `Умер ${laneDeaths.length} раз${laneDeaths.length > 1 ? "а" : ""} на линии${
        early > 0 ? ` (${early} до ${ctx.time(300)})` : ""
      }${dead > 0 ? `, ${dead} сек в мёртвом состоянии` : ""}${lost > 0 ? ` и потерял ${formatGold(lost)} золота` : ""} - каждая смерть также отдаёт врагу волну и опыт.`,
    });
  }
  const killerCounts = new Map<string, number>();
  for (const d of laneDeaths) {
    if (d.killerHeroId !== null) killerCounts.set(d.killer, (killerCounts.get(d.killer) ?? 0) + 1);
  }
  for (const [killer, count] of killerCounts) {
    if (count >= 2) {
      causes.push({ code: "REPEAT_KILLER",
        severity: 25 + count * 5,
        text: `${killer} убил тебя ${count} раз(а) на линии - один и тот же килл повторился вместо того, чтобы подстроить дистанцию под его способности.`,
      });
    }
  }
  causes.push(...deathContextCauses(ctx, laneDeaths));

  return { facts, causes, participated: true };
}

function buildMidLate(
  ctx: Ctx,
  id: "midGame" | "lateGame",
  from: number,
  to: number,
  startCp: NetWorthCheckpoint | null,
  endCp: NetWorthCheckpoint | null
): { facts: string[]; causes: Cause[]; participated: boolean } {
  const { you, counterpart, isCore, match } = ctx;
  const facts: string[] = [];
  const causes: Cause[] = [];
  const name = counterpart ? getHeroName(counterpart.hero_id) : "соперник";

  if (startCp && endCp) {
    const change = endCp.diff - startCp.diff;
    facts.push(
      `Разрыв в нетворсе с ${name} изменился с ${formatSigned(startCp.diff)} на ${ctx.time(startCp.minute * 60)} до ${formatSigned(endCp.diff)} на ${ctx.time(endCp.minute * 60)} (${change < 0 ? "увеличился" : "сократился"} на ${formatGold(Math.abs(change))}).`
    );
    if (change <= -400) {
      causes.push({ code: "LOST_NET_WORTH",
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
      causes.push({ code: "SLOW_FARM",
        severity: Math.min(45, ((b - a) / b) * 100),
        text: `Скорость фарма ${formatGold(a)} золота/мин против ${formatGold(b)} у ${name} за ${ctx.time(startMin * 60)}-${ctx.time(endMin * 60)} - медленнее на ${Math.round((1 - a / b) * 100)}%.`,
      });
    }
  }

  const deaths = ctx.deaths.filter((d) => d.time >= from && d.time < to);
  if (deaths.length > 0) {
    facts.push(`Смерти (${deaths.length}): ${deathList(ctx, deaths)}.`);
    const alone = deaths.filter((d) => !d.inFight);
    if (alone.length > 0) {
      causes.push({ code: "PICKED_OFF",
        severity: alone.length * 30,
        text: `Умер ${alone.length} раз${alone.length > 1 ? "а" : ""} вне замеченных тимфайтов (${alone.map((d) => ctx.time(d.time)).join(", ")}) - тебя поймали одного, а не разменяли в бою с командой.`,
      });
    }
    const deep = deaths.filter((d) => d.zone?.deepInEnemyTerritory);
    if (deep.length > 0) {
      causes.push({ code: "DEEP_ENEMY_DEATH",
        severity: deep.length * 30,
        text: `Погиб глубоко на вражеской территории ${deep.length} раз${deep.length > 1 ? "а" : ""} (${deep.map((d) => `${ctx.time(d.time)} - ${d.zone!.label}`).join("; ")}).`,
      });
    }
    const dead = deaths.reduce((s, d) => s + d.timeDead, 0);
    if (dead > 0) {
      facts.push(`Время в мёртвом состоянии за эту фазу: ${dead} сек (${Math.round((dead / (to - from)) * 100)}% фазы).`);
      if (dead / (to - from) >= 0.15) {
        causes.push({ code: "DEAD_TIME", severity: 20 + dead / 10, text: `${Math.round((dead / (to - from)) * 100)}% этой фазы ты провёл мёртвым (${dead} сек) - это упущенный фарм, опыт и присутствие на карте.` });
      }
    }
    causes.push(...deathContextCauses(ctx, deaths));
    const noBuyback = deaths.filter((d) => !d.boughtBack);
    if (id === "lateGame" && isCore && noBuyback.length === deaths.length && deaths.length >= 2) {
      facts.push(`Ни разу не использовал бай-бек на эти ${deaths.length} смертей.`);
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
  if (id === "lateGame" && isCore && kills.length === 0 && deaths.length > 0) {
    const last = ctx.heroKills.filter((k) => k.time < from).at(-1);
    causes.push({ code: "NO_LATE_KILLS",
      severity: 35,
      text: `Ни одного килла героя за весь лейтгейм${last ? ` (последний килл был в ${ctx.time(last.time)})` : ""}, при этом ты умер ${deaths.length} раз${deaths.length > 1 ? "а" : ""}.`,
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
      `Тимфайты: ${fights.length}; ты участвовал в ${took.length}${missed.length > 0 ? ` (отсутствовал в ${missed.map((f) => ctx.time(f.start)).join(", ")})` : ""}. В них твоя команда потеряла ${fights.reduce((s, f) => s + f.yourTeamDeaths, 0)} героев, а враг - ${fights.reduce((s, f) => s + f.enemyDeaths, 0)}.`
    );
    if (fights.length >= 3 && took.length / fights.length < 0.5) {
      causes.push({ code: "ABSENT_FROM_FIGHTS",
        severity: 30,
        text: `Участвовал только в ${took.length} из ${fights.length} тимфайтов этой фазы (пропустил ${missed.map((f) => ctx.time(f.start)).join(", ")}).`,
      });
    }

    if (isCore && counterpart) {
      const compared = fights.filter((f) => f.counterpart && (f.you.participated || f.counterpart.participated));
      if (compared.length > 0) {
        const yours = compared.reduce((s, f) => s + f.you.damage, 0) / compared.length;
        const theirs = compared.reduce((s, f) => s + (f.counterpart?.damage ?? 0), 0) / compared.length;
        facts.push(
          `Средний урон по героям за тимфайт: ты ${formatGold(yours)} против ${formatGold(theirs)} у ${name} (${compared.length} боёв).`
        );
        if (id === "lateGame" && theirs > 0 && yours < theirs * 0.65) {
          causes.push({ code: "FIGHT_DAMAGE_GAP",
            severity: 45,
            text: `Ты наносил намного меньше урона в поздних тимфайтах, чем ${name}, вражеский ${ctx.role.label.split(" (")[0]}: ${formatGold(yours)} против ${formatGold(theirs)} среднего урона за бой за ${compared.length} боёв.`,
          });
        }
      }
      const diedIn = took.filter((f) => f.you.deaths > 0);
      if (id === "lateGame" && took.length >= 2 && diedIn.length / took.length >= 0.5) {
        causes.push({ code: "DYING_IN_FIGHTS",
          severity: 40,
          text: `Умирал в ${diedIn.length} из ${took.length} поздних боёв, в которых участвовал (${diedIn.map((f) => ctx.time(f.start)).join(", ")}) - мёртвый керри никого не убьёт.`,
        });
      }
    }
  }

  const towers = towersIn(match, from, to, you.isRadiant);
  const bits: string[] = [];
  if (towers.lost.length > 0) bits.push(`твоя команда потеряла ${towers.lost.length} башн${towers.lost.length > 1 ? "и" : "ю"} (${towers.lost.map((t) => ctx.time(t)).join(", ")})`);
  if (towers.taken.length > 0) bits.push(`твоя команда забрала ${towers.taken.length} вражеск${towers.taken.length > 1 ? "ие" : "ую"} башн${towers.taken.length > 1 ? "и" : "ю"}`);
  if (towers.barracksLost.length > 0) bits.push(`твои казармы/трон пали в ${towers.barracksLost.map((t) => ctx.time(t)).join(", ")}`);
  for (const r of roshanIn(match, from, to, you.isRadiant)) {
    bits.push(`${r.yours ? "твоя" : "вражеская"} команда убила Roshan в ${ctx.time(r.time)}`);
  }
  if (bits.length > 0) facts.push(`Цели: ${bits.join("; ")}.`);

  if (id === "lateGame" && isCore && counterpart) {
    facts.push(
      `Урон по башням за всю игру: ты ${formatGold(you.tower_damage)} против ${formatGold(counterpart.tower_damage)} у ${name}.`
    );
    if (counterpart.tower_damage > 0 && you.tower_damage < counterpart.tower_damage * 0.5 && match.duration > 1500) {
      causes.push({ code: "LOW_BUILDING_PRESSURE",
        severity: 25,
        text: `Слабое давление на постройки: ${formatGold(you.tower_damage)} урона по башням против ${formatGold(counterpart.tower_damage)} у ${name} - в долгой игре задача кор-героя - забирать постройки и трон.`,
      });
    }
  }

  if (!isCore) {
    facts.push(...wardFacts(ctx, from, to));
    const w = wardCause(ctx, from, to);
    if (w) causes.push(w);
  }

  const items = itemTimingFacts(ctx, from, to);
  facts.push(...items.facts);
  for (const c of items.lateCauses) causes.push({ code: "LATE_CORE_ITEM", severity: 30, text: c });

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

function endStateLines(ctx: Ctx, position: number): string[] {
  const { you, counterpart } = ctx;
  if (!counterpart) return [];
  const rows: [string, number, number, boolean?][] = [];
  const nw = (p: OpenDotaMatchPlayer) => p.net_worth ?? p.gold_spent + p.gold;
  if (position <= 3) {
    rows.push(["Нетворс", nw(you), nw(counterpart)]);
    rows.push(["Золото в минуту", you.gold_per_min, counterpart.gold_per_min]);
    rows.push(["Добивания", you.last_hits, counterpart.last_hits]);
    rows.push(["Урон по башням", you.tower_damage, counterpart.tower_damage]);
    if (position >= 2) rows.push(["Урон по героям", you.hero_damage, counterpart.hero_damage]);
  } else {
    rows.push(["Нетворс", nw(you), nw(counterpart)]);
    rows.push([
      "Поставлено вардов",
      (you.obs_placed ?? 0) + (you.sen_placed ?? 0),
      (counterpart.obs_placed ?? 0) + (counterpart.sen_placed ?? 0),
    ]);
  }
  rows.push(["Киллы", you.kills, counterpart.kills]);
  rows.push(["Смерти", you.deaths, counterpart.deaths, true]);
  rows.push(["Помощи", you.assists, counterpart.assists]);
  return rows.map(([label, a, b, lowerBetter]) => {
    const better = lowerBetter ? a < b : a > b;
    const verdict = a === b ? "ничья" : better ? "лучше" : "хуже";
    return `${label}: ${vs(a, b)} - ${verdict}`;
  });
}

export function buildMatchAnalysis(args: {
  match: OpenDotaMatch;
  accountId: number;
  positions: ResolvedPositions;
  metrics: MatchMetrics;
  metaItemTiming: ItemProgressionPoint[];
  deathVision?: DeathVisionMoment[];
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

  const known = new Set<string>(["0:00"]);
  const time = (seconds: number) => {
    const label = formatMatchTime(seconds);
    known.add(label);
    return label;
  };

  const youIndex = match.players.indexOf(you);
  const counterpartIndex = counterpart ? match.players.indexOf(counterpart) : -1;
  const lastMinute = Math.floor(match.duration / 60);
  const deathData = collectDeaths(match, you, youIndex, metrics.deathLog, args.deathVision ?? []);

  const ctx: Ctx = {
    match,
    you,
    counterpart,
    role,
    isCore: role.isCore,
    deaths: deathData.events,
    deathDataComplete: deathData.complete,
    realDeathTotal: deathData.realTotal,
    heroKills: (you.kills_log ?? []).map((k) => ({ time: k.time, victim: heroNameFromKey(match, k.key) })),
    fights: collectFights(match, youIndex, counterpartIndex),
    lastMinute,
    metaItemTiming,
    metrics,
    time,
  };

  const netWorth = CHECKPOINT_MINUTES.filter((m) => m <= lastMinute)
    .map((m) => checkpointAt(ctx, m))
    .filter((c): c is NetWorthCheckpoint => c !== null);
  for (const c of netWorth) time(c.minute * 60);

  const teamAdvantage = (minute: number): string | null => {
    const adv = at(match.radiant_gold_adv, minute);
    if (adv === null) return null;
    const yours = you.isRadiant ? adv : -adv;
    return `Общее золотое преимущество твоей команды на ${time(minute * 60)}: ${formatSigned(yours)}${yours < 0 ? " (отстаёт)" : " (впереди)"}.`;
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
  for (const def of hasTimelineData ? PHASE_DEFS : []) {
    if (match.duration < def.from + MIN_PHASE_SECONDS) continue;
    const to = Math.min(def.to, match.duration);
    const endMin = Math.min(Math.floor(to / 60), lastMinute);
    const startMin = Math.floor(def.from / 60);
    const endCp = checkpointAt(ctx, endMin);
    const startCp = def.from > 0 ? checkpointAt(ctx, startMin) : null;

    const built =
      def.id === "laning"
        ? buildLaning(ctx, def.from, to)
        : buildMidLate(ctx, def.id, def.from, to, startCp, endCp);

    const facts: string[] = [];
    if (endCp) facts.push(`Нетворс на ${time(endMin * 60)} против ${counterpart ? getHeroName(counterpart.hero_id) : "соперника"}: ${vs(endCp.you, endCp.counterpart)}.`);
    const team = teamAdvantage(endMin);
    if (team) facts.push(team);
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
      facts.push(...built.facts, ...(ctx.isCore ? [] : wardFacts(ctx, def.from, to)), ...items.facts);
      const w = wardCause(ctx, def.from, to);
      if (w) built.causes.push(w);
      for (const c of items.lateCauses) built.causes.push({ code: "LATE_CORE_ITEM", severity: 25, text: c });
    } else {
      facts.push(...built.facts);
    }
    participationByPhase.set(def.id, built.participated);

    phases.push({
      id: def.id,
      label: def.label,
      window: `${time(def.from)}-${time(to)}`,
      verdict: decideVerdict(endCp, ctx.isCore),
      verdictBasis: endCp
        ? `нетворс на ${time(endMin * 60)}: ${vs(endCp.you, endCp.counterpart)}`
        : "нет данных по нетворсу за эту фазу",
      facts,
      ...(() => {
        const top = built.causes.sort((a, b) => b.severity - a.severity).slice(0, 4);
        allCauses.push(...top);
        const principles = [
          ...new Set(top.map((c) => principleFor(c.code, position)).filter((x): x is string => x !== null)),
        ].slice(0, 2);
        return { causes: top.map((c) => c.text), principles };
      })(),
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
    priorities.push({ point: advice, metric: cause.text });
    if (priorities.length === 3) break;
  }

  const strengths: CoachFinding[] = [];
  for (const phase of phases) {
    if (phase.verdict === "won") {
      strengths.push({ point: `Ты выиграл фазу «${phase.label}» у соперника на твоей позиции.`, metric: phase.verdictBasis });
      continue;
    }
    // ctx.deathDataComplete gates this for real: an incomplete death log can
    // never support "0 deaths" as a claim, regardless of what any phase's
    // facts happen to say - a missing death could be in any phase.
    const hadNoDeaths = ctx.deathDataComplete && phase.facts.some((f) => f === "Смертей в этой фазе не было." || f === "Смертей на линии не было.");
    if (!hadNoDeaths) continue;
    // A phase with 0 deaths is only worth praising when the verdict wasn't a
    // loss, or - for mid/late - when there's real evidence this player was
    // actually in the fights: 0 deaths from sitting out isn't survival, it's
    // the same passivity problem the causes above already call out, and
    // showing it as a strength would flatly contradict that same analysis.
    const participated = participationByPhase.get(phase.id) ?? true;
    const meaningful = phase.verdict !== "lost" || (phase.id !== "laning" && participated);
    if (meaningful) {
      strengths.push({ point: `Ты ни разу не умер в фазе «${phase.label}».`, metric: `${phase.label} ${phase.window}: 0 смертей` });
    }
  }
  for (const line of endStateLines(ctx, position)) {
    if (!line.endsWith("- лучше")) continue;
    const label = line.split(":")[0].toLowerCase();
    strengths.push({ point: `Ты обошёл соперника по показателю «${label}».`, metric: line });
  }
  // Holding the lane even is a real result - laning against the same-position
  // enemy without falling behind is what the rest of the game is built on.
  const laning = phases.find((p) => p.id === "laning");
  if (laning?.verdict === "even") {
    strengths.push({ point: "Ты отстоял линию наравне с соперником на твоей позиции.", metric: laning.verdictBasis });
  }
  // A stat in the top quarter of everyone who plays this hero is a strength
  // on its own, whatever the counterpart did.
  for (const s of relevantStats(metrics, role, you.hero_id, you)) {
    if (s.percentile === undefined || s.percentile < 75) continue;
    strengths.push({
      point: `Показатель «${s.label.toLowerCase()}» - на уровне лучших ${Math.max(1, 100 - s.percentile)}% игроков на ${getHeroName(you.hero_id)}.`,
      metric: `${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ""} (${s.percentile}-й перцентиль)`,
    });
  }

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
    endStateVsCounterpart: endStateLines(ctx, position),
    stats: relevantStats(metrics, role, you.hero_id, you),
    knownTimes: [...known],
    repeatKillers,
    knownItems: [...knownItems],
    strengths: strengths.slice(0, 4),
    priorities,
    buybacksUsed: (you.buyback_log ?? []).length || metrics.buybacks,
  };
}
