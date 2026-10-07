// Every aspect of the game as its own section: a table of the player against
// the enemy on the same position and the median player on this hero, what
// went well, and every mistake found there - each with the coach's full
// explanation (why it cost something, the right move, a next-game example).

import {
  getAbilityDisplayNameByKey,
  getHeroName,
  getItemCostByKey,
  getItemNameById,
  getItemNameByKey,
  isAssembledItem,
} from "../../constants";
import { formatGold, formatMatchTime, formatSigned, pluralRu } from "../../format";
import { listRu, timesRu } from "../../coach/advice";
import { principleFor, type CauseCode } from "../../coach/principles";
import { ultimateKey } from "../../coach/threats";
import type {
  BreakdownAspect,
  BreakdownAspectId,
  BreakdownMistake,
  BreakdownStat,
  DeathReview,
  FightReview,
  MistakeSeverity,
  OpenDotaMatchPlayer,
  PhaseAnalysis,
  PhaseId,
} from "../../types";
import type { Cause } from "../cause";
import { deathTimesOf } from "../gameFlow";
import { classifyZone } from "../mapZones";
import { at, heroIdFromKey, lanePresenceFact, observerFates, type Ctx } from "../matchAnalysis";
import { positionAt, units } from "../positioning";
import { computeSkillBuild, interpolateTime, levelForXp, xpForLevel } from "../skillBuild";
import { deathSummary } from "./deaths";

const ASPECT_OF: Record<CauseCode, BreakdownAspectId> = {
  EARLY_DEATHS: "laning",
  REPEAT_KILLER: "laning",
  ROTATION_KILL: "laning",
  CS_DEFICIT: "laning",
  XP_DEFICIT: "laning",
  NO_SUSTAIN: "laning",
  GAP_OPENED: "laning",
  SLOW_FARM: "farm",
  LOST_NET_WORTH: "farm",
  IDLE_FARM: "farm",
  PICKED_OFF: "deaths",
  DEEP_ENEMY_DEATH: "deaths",
  HIGH_GROUND_DEATH: "deaths",
  DEAD_TIME: "deaths",
  SEEN_BY_WARD: "deaths",
  CREEP_TOWER_DEATH: "deaths",
  DIED_BEFORE_FIGHT: "deaths",
  ABSENT_FROM_FIGHTS: "fights",
  FIGHT_DAMAGE_GAP: "fights",
  DYING_IN_FIGHTS: "fights",
  NO_LATE_KILLS: "fights",
  DIED_FIRST: "fights",
  FRONT_POSITIONING: "fights",
  LATE_CORE_ITEM: "items",
  NO_BKB: "items",
  NO_BUYBACK: "items",
  ULT_LATE: "items",
  FEW_TP: "items",
  NO_VISION: "vision",
  WARDS_DEWARDED: "vision",
  RUNE_CONTROL: "vision",
  LOW_BUILDING_PRESSURE: "objectives",
  LEAD_NOT_CONVERTED: "objectives",
  LOST_FIGHT_ENEMY_SIDE: "objectives",
  AEGIS_WASTED: "objectives",
};

const TITLE_OF: Record<CauseCode, string> = {
  EARLY_DEATHS: "Смерти на линии",
  REPEAT_KILLER: "Один и тот же враг убивал тебя снова",
  ROTATION_KILL: "Смерть от ротации врага",
  CS_DEFICIT: "Отставание по добиваниям на линии",
  XP_DEFICIT: "Отставание по опыту и уровню",
  NO_SUSTAIN: "Нет регена на линии",
  GAP_OPENED: "Резкий провал по нетворсу на линии",
  SLOW_FARM: "Медленный фарм",
  LOST_NET_WORTH: "Отставание по нетворсу за фазу",
  IDLE_FARM: "Минуты без фарма",
  PICKED_OFF: "Смерти вне драк",
  DEEP_ENEMY_DEATH: "Смерти глубоко на вражеской половине",
  HIGH_GROUND_DEATH: "Смерти на вражеском хайграунде",
  DEAD_TIME: "Много времени мёртвым",
  SEEN_BY_WARD: "Смерти под вражеским Observer Ward",
  CREEP_TOWER_DEATH: "Смерти от крипов или башни",
  DIED_BEFORE_FIGHT: "Смерть прямо перед дракой",
  ABSENT_FROM_FIGHTS: "Пропущенные драки",
  FIGHT_DAMAGE_GAP: "Мало урона в драках",
  DYING_IN_FIGHTS: "Смерть в большинстве драк",
  NO_LATE_KILLS: "Ни одного убийства в лейтгейме",
  DIED_FIRST: "Первая смерть команды в драке",
  FRONT_POSITIONING: "Стоял впереди в начале драк",
  LATE_CORE_ITEM: "Поздний ключевой предмет",
  NO_BKB: "Не куплен Black King Bar",
  NO_BUYBACK: "Не было выкупа, когда решалась база",
  ULT_LATE: "Ультимейт взят поздно",
  FEW_TP: "Мало телепортов",
  NO_VISION: "Мало вардов",
  WARDS_DEWARDED: "Враг снимал твои варды",
  RUNE_CONTROL: "Руны силы достались врагу",
  LOW_BUILDING_PRESSURE: "Мало давления на постройки",
  LEAD_NOT_CONVERTED: "Перевес не превратился в постройки",
  LOST_FIGHT_ENEMY_SIDE: "Проигранные драки на чужой половине с перевесом",
  AEGIS_WASTED: "Aegis потрачен впустую",
};

const ASPECT_TITLES: Record<BreakdownAspectId, string> = {
  laning: "Линия",
  farm: "Фарм и экономика",
  deaths: "Смерти",
  fights: "Драки",
  items: "Предметы, способности и выкуп",
  vision: "Обзор, руны и карта",
  objectives: "Постройки и Roshan",
};

const POSITION_OF = { carry: 1, mid: 2, offlane: 3, support: 5 } as const;

// The biggest single-phase problems (2+ lane deaths, 20+ last hits behind, a
// thrown lead) reach 55-60; a one-level XP gap tops out at 50.
function severityOf(n: number): MistakeSeverity {
  return n >= 55 ? "high" : n >= 30 ? "medium" : "low";
}

function firstTime(text: string): string | null {
  return text.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? null;
}

function toMistake(ctx: Ctx, cause: Cause, phase: PhaseId): BreakdownMistake {
  const position = POSITION_OF[ctx.group];
  const rule = principleFor(cause.code, position) ?? "";
  return {
    code: cause.code,
    severity: severityOf(cause.severity),
    phase,
    time: cause.at !== undefined ? formatMatchTime(cause.at) : firstTime(cause.text),
    title: TITLE_OF[cause.code] ?? cause.code,
    whatHappened: cause.text,
    why: cause.why ?? cause.text,
    correct: cause.correct ?? rule,
    example: cause.example ?? cause.target ?? "",
    ...(cause.target ? { target: cause.target } : {}),
  };
}

function grade(mistakes: BreakdownMistake[], good: string[]): BreakdownAspect["grade"] {
  const score = mistakes.reduce((s, m) => s + (m.severity === "high" ? 3 : m.severity === "medium" ? 2 : 1), 0);
  if (mistakes.some((m) => m.severity === "high") || score >= 5) return "bad";
  if (score <= 1 && good.length > 0) return "good";
  return "ok";
}

type Tone = BreakdownStat["tone"];

// Higher is better unless `lower`; a gap smaller than `margin` is even.
function compare(you: number, them: number | null | undefined, margin: number, lower = false): Tone {
  if (them === null || them === undefined) return "neutral";
  const d = lower ? them - you : you - them;
  return d >= margin ? "good" : d <= -margin ? "bad" : "neutral";
}

function n(v: number): string {
  return formatGold(v);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function sixTime(p: OpenDotaMatchPlayer): number | null {
  const xp = xpForLevel(6);
  return xp !== null && p.xp_t ? interpolateTime(p.xp_t, xp) : null;
}

function deadSeconds(p: OpenDotaMatchPlayer, until: number): number {
  return (p.deaths_log ?? []).filter((d) => d.time < until).reduce((s, d) => s + (d.time_dead ?? 0), 0);
}

// Valve's gold reason codes: where the income came from.
const INCOME: { codes: string[]; label: string }[] = [
  { codes: ["13"], label: "крипы на линиях" },
  { codes: ["14"], label: "лес (нейтралы)" },
  { codes: ["12"], label: "убийства героев" },
  { codes: ["11"], label: "постройки" },
  { codes: ["17"], label: "руны" },
  { codes: ["15", "16"], label: "Roshan и курьеры" },
];

function income(p: OpenDotaMatchPlayer): { label: string; gold: number }[] {
  const reasons = p.gold_reasons ?? {};
  return INCOME.map((s) => ({ label: s.label, gold: s.codes.reduce((sum, c) => sum + Math.max(0, reasons[c] ?? 0), 0) }));
}

function teamKills(ctx: Ctx, radiant: boolean): number {
  return ctx.match.players.filter((p) => p.isRadiant === radiant).reduce((s, p) => s + p.kills, 0);
}

function kp(ctx: Ctx, p: OpenDotaMatchPlayer): number | null {
  const team = teamKills(ctx, p.isRadiant);
  return team > 0 ? pct(p.kills + p.assists, team) : null;
}

export function buildAspects(args: {
  ctx: Ctx;
  phases: PhaseAnalysis[];
  causes: { cause: Cause; phase: PhaseId }[];
  deaths: DeathReview[];
  fights: FightReview[];
  youLeft: boolean;
}): BreakdownAspect[] {
  const { ctx, phases, deaths, fights } = args;
  const { match, you, counterpart: cp } = ctx;
  const cpName = cp ? getHeroName(cp.hero_id) : null;
  const end = ctx.end;
  const statsByLabel = new Map(ctx.metrics.stats.map((s) => [s.label, s]));
  // The median player on this hero (OpenDota benchmarks; none for Turbo).
  const reference = (label: string, unit = "") => {
    const s = statsByLabel.get(label);
    if (!s || s.benchmarkMedian === undefined) return undefined;
    return `медиана на ${getHeroName(you.hero_id)}: ${n(s.benchmarkMedian)}${unit}${s.percentile !== undefined ? ` · ты лучше ${s.percentile}% игроков` : ""}`;
  };

  const mistakesBy = new Map<BreakdownAspectId, BreakdownMistake[]>();
  for (const { cause, phase } of args.causes) {
    const id = ASPECT_OF[cause.code] ?? "fights";
    const list = mistakesBy.get(id) ?? [];
    list.push(toMistake(ctx, cause, phase));
    mistakesBy.set(id, list);
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  for (const list of mistakesBy.values()) list.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const mistakes = (id: BreakdownAspectId) => mistakesBy.get(id) ?? [];

  const aspect = (id: BreakdownAspectId, summary: string, stats: BreakdownStat[], good: string[], notes: string[]): BreakdownAspect => ({
    id,
    title: ASPECT_TITLES[id],
    grade: grade(mistakes(id), good),
    summary,
    stats,
    good,
    notes,
    mistakes: mistakes(id),
  });

  // ---------------- Laning ----------------
  const laning = phases.find((p) => p.id === "laning");
  const laneEnd = Math.min(ctx.bounds.laneEnd, end);
  const laneEndMin = Math.floor(laneEnd / 60);
  const laneStats: BreakdownStat[] = [];
  const laneGood: string[] = [];
  const laneNotes: string[] = [];
  const marks = [...new Set([...ctx.bounds.laneCheckpoints, laneEndMin])].filter((m) => m <= laneEndMin).sort((a, b) => a - b);
  for (const m of marks) {
    const lh = at(you.lh_t, m);
    const dn = at(you.dn_t, m);
    if (lh === null) continue;
    const cLh = cp ? at(cp.lh_t, m) : null;
    const cDn = cp ? at(cp.dn_t, m) : null;
    laneStats.push({
      label: `Добивания / денаи на ${m}:00`,
      you: `${lh} / ${dn ?? 0}`,
      counterpart: cLh !== null ? `${cLh} / ${cDn ?? 0}` : undefined,
      tone: ctx.isCore ? compare(lh, cLh, Math.max(4, m)) : "neutral",
    });
  }
  const xpEnd = at(you.xp_t, laneEndMin);
  const cpXpEnd = cp ? at(cp.xp_t, laneEndMin) : null;
  if (xpEnd !== null) {
    laneStats.push({
      label: `Уровень на ${laneEndMin}:00`,
      you: String(levelForXp(xpEnd)),
      counterpart: cpXpEnd !== null ? String(levelForXp(cpXpEnd)) : undefined,
      tone: compare(levelForXp(xpEnd), cpXpEnd !== null ? levelForXp(cpXpEnd) : null, 1),
    });
  }
  const six = sixTime(you);
  const cpSix = cp ? sixTime(cp) : null;
  if (six !== null) {
    laneStats.push({
      label: "6 уровень (ультимейт)",
      you: `~${ctx.time(six)}`,
      counterpart: cpSix !== null ? `~${formatMatchTime(cpSix)}` : undefined,
      tone: compare(six, cpSix, 30, true),
    });
    if (cpSix !== null && cpSix - six >= 30) laneGood.push(`6 уровень на ${Math.round(cpSix - six)} сек раньше, чем у ${cpName}.`);
  }
  const nwEnd = at(you.networth_t, laneEndMin);
  const cpNwEnd = cp ? at(cp.networth_t, laneEndMin) : null;
  if (nwEnd !== null) {
    laneStats.push({
      label: `Нетворс на ${laneEndMin}:00`,
      you: n(nwEnd),
      counterpart: cpNwEnd !== null ? n(cpNwEnd) : undefined,
      tone: compare(nwEnd, cpNwEnd, ctx.isCore ? 300 : 250),
    });
  }
  const laneDeaths = ctx.deaths.filter((d) => d.time < laneEnd).length;
  const laneKills = ctx.heroKills.filter((k) => k.time < laneEnd).length;
  const cpLaneDeaths = cp ? deathTimesOf(match, cp).filter((t) => t < laneEnd).length : null;
  const cpLaneKills = cp ? (cp.kills_log ?? []).filter((k) => k.time < laneEnd && heroIdFromKey(match, k.key) !== null).length : null;
  laneStats.push({
    label: "Убийства / смерти на линии",
    you: `${laneKills} / ${laneDeaths}`,
    counterpart: cpLaneDeaths !== null ? `${cpLaneKills} / ${cpLaneDeaths}` : undefined,
    tone: compare(laneDeaths, cpLaneDeaths, 2, true),
  });
  if (ctx.metrics.laneEfficiency !== null && !ctx.turbo) {
    laneStats.push({
      label: "Эффективность линии (OpenDota)",
      you: `${ctx.metrics.laneEfficiency}%`,
      counterpart: cp?.lane_efficiency !== undefined ? `${Math.round(cp.lane_efficiency * 100)}%` : undefined,
      tone: cp?.lane_efficiency !== undefined ? compare(ctx.metrics.laneEfficiency, Math.round(cp.lane_efficiency * 100), 10) : "neutral",
    });
  }
  if (ctx.isCore && cp) {
    const lh = at(you.lh_t, laneEndMin);
    const cLh = at(cp.lh_t, laneEndMin);
    if (lh !== null && cLh !== null && lh - cLh >= 5) laneGood.push(`К ${laneEndMin}:00 у тебя ${lh} добиваний против ${cLh} у ${cpName}.`);
  }
  if (laneDeaths === 0 && ctx.deathDataComplete) laneGood.push("Ни одной смерти на линии.");
  if (laneKills >= 2) laneGood.push(`${laneKills} ${pluralRu(laneKills, ["убийство", "убийства", "убийств"])} на линии.`);
  if (laning?.verdict === "won") laneGood.push(`Линия выиграна: ${laning.verdictBasis}.`);
  const mates = match.players.filter((p) => p !== you && p.lane === you.lane && p.isRadiant === you.isRadiant).map((p) => getHeroName(p.hero_id));
  const laneName = you.lane === 1 ? "боте" : you.lane === 2 ? "миде" : you.lane === 3 ? "топе" : null;
  if (laneName) {
    laneNotes.push(
      `Ты стоял на ${laneName}${mates.length > 0 ? ` вместе с ${listRu(mates)}` : " один"} против ${ctx.laneEnemies.length > 0 ? listRu(ctx.laneEnemies.map((p) => getHeroName(p.hero_id))) : "никого"}.`
    );
  }
  const presence = lanePresenceFact(ctx);
  if (presence) laneNotes.push(presence);
  if (ctx.metrics.startingItems.length > 0) {
    const counts = new Map<string, number>();
    for (const i of ctx.metrics.startingItems) counts.set(i.itemName, (counts.get(i.itemName) ?? 0) + 1);
    laneNotes.push(`Стартовые покупки: ${[...counts.entries()].map(([name, c]) => (c > 1 ? `${name} ×${c}` : name)).join(", ")}.`);
  }
  const laneSummary = laning
    ? laning.verdict === "won"
      ? `Линия выиграна у ${cpName ?? "соперника"} (${laning.verdictBasis}).`
      : laning.verdict === "lost"
        ? `Линия проиграна ${cpName ?? "сопернику"} (${laning.verdictBasis}).`
        : laning.verdict === "even"
          ? `Линия сыграна наравне с ${cpName ?? "соперником"} (${laning.verdictBasis}).`
          : `Линия: ${laning.verdictBasis}.`
    : "Линия не разобрана.";

  // ---------------- Farm ----------------
  const farmStats: BreakdownStat[] = [];
  const farmGood: string[] = [];
  const farmNotes: string[] = [];
  const minutes = end / 60;
  const gpmCompare = (label: string, yours: number, theirs: number | undefined, margin: number, unit: string) =>
    farmStats.push({
      label,
      you: n(yours),
      counterpart: theirs !== undefined ? n(theirs) : undefined,
      reference: reference(label, unit),
      tone: ctx.isCore ? compare(yours, theirs, margin) : "neutral",
    });
  if (!args.youLeft) {
    gpmCompare("Золото в минуту", you.gold_per_min, cp?.gold_per_min, 40, "");
    gpmCompare("Опыт в минуту", you.xp_per_min, cp?.xp_per_min, 40, "");
    const lhpm = statsByLabel.get("Добивания в минуту");
    farmStats.push({
      label: "Добивания / денаи за игру",
      you: `${you.last_hits} / ${you.denies}`,
      counterpart: cp ? `${cp.last_hits} / ${cp.denies}` : undefined,
      reference: lhpm?.benchmarkMedian !== undefined ? `медиана: ${lhpm.benchmarkMedian.toLocaleString("ru-RU")} добиваний в минуту, у тебя ${(you.last_hits / minutes).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}` : undefined,
      tone: ctx.isCore && cp ? compare(you.last_hits, cp.last_hits, 30) : "neutral",
    });
    const nw = (p: OpenDotaMatchPlayer) => p.net_worth ?? p.gold_spent + p.gold;
    farmStats.push({
      label: "Нетворс в конце",
      you: n(nw(you)),
      counterpart: cp ? n(nw(cp)) : undefined,
      tone: cp ? compare(nw(you), nw(cp), 1000) : "neutral",
    });
  }
  // Income per phase, from the cumulative gold curve.
  for (const ph of phases) {
    const [fromLabel, toLabel] = ph.window.split("-");
    const from = Number(fromLabel.split(":")[0]);
    const to = Math.min(Number(toLabel.split(":")[0]), ctx.lastMinute);
    const a = (p: OpenDotaMatchPlayer) => {
      const g0 = at(p.gold_t, from);
      const g1 = at(p.gold_t, to);
      return g0 !== null && g1 !== null && to > from ? Math.round((g1 - g0) / (to - from)) : null;
    };
    const mine = a(you);
    if (mine === null) continue;
    const theirs = cp ? a(cp) : null;
    farmStats.push({
      label: `Золото в минуту: ${ph.label.toLowerCase()}`,
      you: n(mine),
      counterpart: theirs !== null ? n(theirs) : undefined,
      tone: ctx.isCore ? compare(mine, theirs, Math.max(40, (theirs ?? 0) * 0.1)) : "neutral",
    });
    if (ctx.isCore && theirs !== null && mine >= theirs * 1.15 && mine - theirs >= 60) {
      farmGood.push(`В фазе «${ph.label}» ты фармил быстрее ${cpName}: ${n(mine)} золота в минуту против ${n(theirs)}.`);
    }
  }
  const myIncome = income(you);
  const myTotal = myIncome.reduce((s, x) => s + x.gold, 0);
  if (myTotal > 0) {
    const theirIncome = cp ? income(cp) : null;
    const theirTotal = theirIncome?.reduce((s, x) => s + x.gold, 0) ?? 0;
    for (const [i, src] of myIncome.entries()) {
      if (src.gold === 0 && (!theirIncome || theirIncome[i].gold === 0)) continue;
      farmStats.push({
        label: `Доход: ${src.label}`,
        you: `${n(src.gold)} (${pct(src.gold, myTotal)}%)`,
        counterpart: theirIncome && theirTotal > 0 ? `${n(theirIncome[i].gold)} (${pct(theirIncome[i].gold, theirTotal)}%)` : undefined,
        tone: "neutral",
      });
    }
    if (ctx.group === "carry" && theirIncome && theirTotal > 0) {
      const myJungle = pct(myIncome[1].gold, myTotal);
      const theirJungle = pct(theirIncome[1].gold, theirTotal);
      if (theirJungle - myJungle >= 15) {
        farmNotes.push(
          `${cpName} получил из леса ${theirJungle}% дохода, ты - ${myJungle}%. Лес между волнами - главный источник золота керри после линии: ${cpName} фармил больше лагерей.`
        );
      }
    }
  }
  if (you.neutral_kills !== undefined || you.lane_kills !== undefined) {
    farmStats.push({
      label: "Крипов убито: на линиях / в лесу",
      you: `${you.lane_kills ?? 0} / ${you.neutral_kills ?? 0}`,
      counterpart: cp && (cp.lane_kills !== undefined || cp.neutral_kills !== undefined) ? `${cp.lane_kills ?? 0} / ${cp.neutral_kills ?? 0}` : undefined,
      tone: "neutral",
    });
  }
  for (const s of ctx.metrics.stats) {
    if (!["Золото в минуту", "Опыт в минуту", "Добивания в минуту"].includes(s.label)) continue;
    if (ctx.isCore && s.percentile !== undefined && s.percentile >= 75 && !args.youLeft) {
      farmGood.push(`${s.label}: ${n(Number(s.value))} - лучше, чем у ${s.percentile}% игроков на ${getHeroName(you.hero_id)}.`);
    }
  }
  const nwSeries = [10, 20, 30, 40, 50]
    .filter((m) => m <= ctx.lastMinute)
    .map((m) => {
      const a = at(you.networth_t, m);
      const b = cp ? at(cp.networth_t, m) : null;
      return a !== null ? `${m}:00 - ${n(a)}${b !== null ? ` (${formatSigned(a - b)})` : ""}` : null;
    })
    .filter(Boolean);
  if (nwSeries.length > 0) farmNotes.push(`Нетворс по ходу игры${cpName ? ` (в скобках - разница с ${cpName})` : ""}: ${nwSeries.join("; ")}.`);
  const farmSummary =
    cp && !args.youLeft
      ? `Золото в минуту: ты ${n(you.gold_per_min)}, ${cpName} - ${n(cp.gold_per_min)}; добивания ${you.last_hits} против ${cp.last_hits}.`
      : `Золото в минуту: ${n(you.gold_per_min)}, добивания: ${you.last_hits}.`;

  // ---------------- Deaths ----------------
  const deathStats: BreakdownStat[] = [];
  const deathGood: string[] = [];
  const deathNotes: string[] = [];
  const myDead = ctx.deaths.reduce((s, d) => s + d.timeDead, 0) || deadSeconds(you, end);
  const cpDead = cp ? deadSeconds(cp, end) : null;
  deathStats.push({
    label: "Смерти",
    you: String(ctx.realDeathTotal),
    counterpart: cp ? String(cp.deaths) : undefined,
    tone: compare(ctx.realDeathTotal, cp?.deaths, 2, true),
  });
  deathStats.push({
    label: "Время мёртвым",
    you: `${myDead} сек (${pct(myDead, end)}% игры)`,
    counterpart: cpDead !== null ? `${cpDead} сек (${pct(cpDead, end)}%)` : undefined,
    tone: compare(myDead, cpDead, 60, true),
  });
  const goldLost = ctx.deaths.reduce((s, d) => s + d.goldLost, 0) || Math.abs(Math.min(0, you.gold_reasons?.["1"] ?? 0));
  if (goldLost > 0) {
    const cpLost = cp ? Math.abs(Math.min(0, cp.gold_reasons?.["1"] ?? 0)) : 0;
    deathStats.push({
      label: "Золота потеряно при смертях",
      you: n(goldLost),
      counterpart: cp && cpLost > 0 ? n(cpLost) : undefined,
      tone: "neutral",
    });
  }
  const outside = deaths.filter((d) => d.verdict === "mistake").length;
  deathStats.push({ label: "Смертей, которых можно было избежать", you: String(outside), tone: outside === 0 ? "good" : outside >= 3 ? "bad" : "neutral" });
  const underWard = ctx.deaths.filter((d) => d.moment?.enemyWard).length;
  if (ctx.deaths.some((d) => d.moment)) deathStats.push({ label: "Под вражеским Observer Ward", you: String(underWard), tone: underWard >= 2 ? "bad" : "neutral" });
  const byKiller = new Map<string, number>();
  for (const d of ctx.deaths) if (d.killerHeroId !== null) byKiller.set(d.killer, (byKiller.get(d.killer) ?? 0) + 1);
  if (byKiller.size > 0) {
    deathNotes.push(
      `Кто убивал тебя: ${[...byKiller.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, c]) => `${name} - ${timesRu(c)}`)
        .join(", ")}.`
    );
  }
  const received = Object.entries(you.damage_inflictor_received ?? {})
    .map(([key, dmg]) => ({ name: key === "null" ? "обычные атаки" : (getAbilityDisplayNameByKey(key) ?? (getItemNameByKey(key) !== key ? getItemNameByKey(key) : null)), dmg }))
    .filter((x): x is { name: string; dmg: number } => x.name !== null && x.dmg > 0)
    .sort((a, b) => b.dmg - a.dmg);
  const receivedTotal = received.reduce((s, x) => s + x.dmg, 0);
  if (received.length > 0 && receivedTotal > 0) {
    deathNotes.push(
      `Больше всего урона по тебе за игру: ${received
        .slice(0, 5)
        .map((x) => `${x.name} - ${n(x.dmg)} (${pct(x.dmg, receivedTotal)}%)`)
        .join(", ")}.`
    );
  }
  if (outside === 0 && deaths.length > 0) deathGood.push("Ни одной смерти, которой можно было легко избежать: ты погибал только в драках.");
  if (cp && cp.deaths - ctx.realDeathTotal >= 3) deathGood.push(`Ты умирал заметно реже, чем ${cpName}: ${ctx.realDeathTotal} против ${cp.deaths}.`);
  if (ctx.realDeathTotal === 0 && ctx.deathDataComplete) deathGood.push("Ни одной смерти за игру.");
  const trades = deaths.filter((d) => d.verdict === "trade").length;
  if (trades > 0) deathNotes.push(`Смертей-разменов, выгодных команде: ${trades}.`);
  if (!ctx.deathDataComplete) {
    deathNotes.push(`По времени удалось восстановить ${ctx.deaths.length} из ${ctx.realDeathTotal} смертей - остальные в разборе не описаны.`);
  }

  // ---------------- Fights ----------------
  const fightStats: BreakdownStat[] = [];
  const fightGood: string[] = [];
  const fightNotes: string[] = [];
  const took = fights.filter((f) => !f.you.startsWith("не участвовал") && !f.you.startsWith("был мёртв") && !f.you.startsWith("погиб за"));
  const won = fights.filter((f) => f.result === "won").length;
  const lost = fights.filter((f) => f.result === "lost").length;
  fightStats.push({
    label: "Тимфайты: участвовал",
    you: `${took.length} из ${fights.length}`,
    tone: fights.length >= 3 ? (took.length / fights.length >= 0.75 ? "good" : took.length / fights.length < 0.5 ? "bad" : "neutral") : "neutral",
  });
  fightStats.push({ label: "Тимфайты команды: выиграно / проиграно", you: `${won} / ${lost}`, tone: "neutral" });
  const myKp = kp(ctx, you);
  const cpKp = cp ? kp(ctx, cp) : null;
  if (myKp !== null && !args.youLeft) {
    fightStats.push({
      label: "Участие в убийствах команды",
      you: `${myKp}% (${you.kills} + ${you.assists})`,
      counterpart: cpKp !== null && cp ? `${cpKp}% (${cp.kills} + ${cp.assists})` : undefined,
      tone: compare(myKp, cpKp, 15),
    });
  }
  if (!args.youLeft) {
    fightStats.push({
      label: "Урон по героям",
      you: n(you.hero_damage),
      counterpart: cp ? n(cp.hero_damage) : undefined,
      reference: reference("Урон по героям в минуту", " в минуту"),
      tone: ctx.group === "support" || ctx.group === "offlane" ? "neutral" : compare(you.hero_damage, cp?.hero_damage, Math.max(3000, (cp?.hero_damage ?? 0) * 0.25)),
    });
    fightStats.push({
      label: "Убийства / смерти / помощи",
      you: `${you.kills} / ${you.deaths} / ${you.assists}`,
      counterpart: cp ? `${cp.kills} / ${cp.deaths} / ${cp.assists}` : undefined,
      tone: "neutral",
    });
    if (you.hero_healing > 0) {
      fightStats.push({ label: "Лечение союзников", you: n(you.hero_healing), counterpart: cp ? n(cp.hero_healing) : undefined, tone: "neutral" });
    }
    if ((you.stuns ?? 0) > 0) {
      fightStats.push({
        label: "Контроль (сек)",
        you: (Math.round((you.stuns ?? 0) * 10) / 10).toLocaleString("ru-RU"),
        counterpart: cp && (cp.stuns ?? 0) > 0 ? (Math.round((cp.stuns ?? 0) * 10) / 10).toLocaleString("ru-RU") : undefined,
        tone: "neutral",
      });
    }
  }
  const diedIn = fights.filter((f) => f.you.startsWith("погиб") && !f.you.startsWith("погиб за")).length;
  const first = fights.filter((f) => f.you === "погиб первым из команды").length;
  fightStats.push({ label: "Погиб в драках / первым из команды", you: `${diedIn} / ${first}`, tone: first >= 2 ? "bad" : "neutral" });
  const survived = took.filter((f) => !f.you.startsWith("погиб")).length;
  if (fights.length >= 4 && took.length / fights.length >= 0.75) fightGood.push(`Ты был в ${took.length} из ${fights.length} драк команды.`);
  if (took.length >= 3 && survived / took.length >= 0.6) fightGood.push(`Ты выжил в ${survived} из ${took.length} драк, в которых участвовал.`);
  if (myKp !== null && cpKp !== null && myKp - cpKp >= 15) fightGood.push(`Участие в убийствах ${myKp}% против ${cpKp}% у ${cpName}.`);
  const goodFights = fights.filter((f) => f.tone === "good").length;
  const badFights = fights.filter((f) => f.tone === "bad").length;
  if (fights.length > 0) fightNotes.push(`Драк, где ты сыграл хорошо: ${goodFights}; где твоё участие было ошибкой: ${badFights}. Каждая драка разобрана ниже.`);
  const fightSummary =
    fights.length > 0
      ? `Ты участвовал в ${took.length} из ${fights.length} драк; команда выиграла ${won}, проиграла ${lost}.`
      : "Тимфайтов в этой игре реплей не зафиксировал.";

  // ---------------- Items, skills, buyback ----------------
  const itemStats: BreakdownStat[] = [];
  const itemGood: string[] = [];
  const itemNotes: string[] = [];
  const meta = new Map(ctx.metaItemTiming.map((m) => [m.itemKey, m.avgTimeSeconds]));
  const seenItems = new Set<string>();
  for (const p of you.purchase_log ?? []) {
    if (p.time < 0 || p.time > end || seenItems.has(p.key) || !isAssembledItem(p.key) || getItemCostByKey(p.key) < 1000) continue;
    seenItems.add(p.key);
    const typical = meta.get(p.key);
    const delta = typical !== undefined ? (p.time - typical) / 60 : null;
    itemStats.push({
      label: getItemNameByKey(p.key),
      you: formatMatchTime(p.time),
      reference: typical !== undefined ? `обычно ~${formatMatchTime(typical)}` : undefined,
      tone: delta === null ? "neutral" : delta >= 2.5 ? "bad" : delta <= -1 ? "good" : "neutral",
    });
    if (delta !== null && delta <= -1) itemGood.push(`${getItemNameByKey(p.key)} собран в ${formatMatchTime(p.time)} - на ${Math.abs(delta).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} мин раньше обычного.`);
  }
  const bought = new Set((you.purchase_log ?? []).map((p) => p.key));
  const missingMeta = ctx.metaItemTiming.filter(
    (m) => !bought.has(m.itemKey) && m.avgTimeSeconds + 300 < end && getItemCostByKey(m.itemKey) >= 1000
  );
  if (missingMeta.length > 0 && !ctx.turbo) {
    itemNotes.push(`Основные предметы ${getHeroName(you.hero_id)} на этой позиции, которых у тебя не было: ${missingMeta.map((m) => `${m.itemName} (обычно ~${formatMatchTime(m.avgTimeSeconds)})`).join(", ")}.`);
  }
  const tp = you.item_uses?.tpscroll ?? 0;
  itemStats.push({
    label: "TP Scroll использован",
    you: timesRu(tp),
    counterpart: cp ? timesRu(cp.item_uses?.tpscroll ?? 0) : undefined,
    tone: cp ? compare(tp, cp.item_uses?.tpscroll ?? 0, 4) : "neutral",
  });
  const buybacks = (you.buyback_log ?? []).length;
  itemStats.push({
    label: "Выкупы",
    you: buybacks > 0 ? `${buybacks} (${(you.buyback_log ?? []).map((b) => formatMatchTime(b.time)).join(", ")})` : "0",
    counterpart: cp ? String((cp.buyback_log ?? []).length) : undefined,
    tone: "neutral",
  });
  const finalItems = [you.item_0, you.item_1, you.item_2, you.item_3, you.item_4, you.item_5]
    .map((id) => (typeof id === "number" && id > 0 ? id : null))
    .filter((id): id is number => id !== null);
  if (finalItems.length > 0 && !args.youLeft) {
    const names = (you.purchase_log ?? []).length > 0 ? finalItemNames(finalItems) : [];
    if (names.length > 0) itemNotes.push(`Инвентарь в конце игры: ${names.join(", ")}.`);
  }
  const build = computeSkillBuild(you, you.hero_id);
  const ultKey = ultimateKey(you.hero_id);
  if (build.length > 0) {
    const ult = ultKey ? build.find((e) => e.abilityKey === ultKey) : undefined;
    if (ult) {
      itemStats.push({ label: `Ультимейт (${ult.abilityName})`, you: `${ult.level} уровень`, reference: "правильно: 6 уровень", tone: ult.level <= 6 ? "good" : "bad" });
    }
    itemNotes.push(
      `Прокачка по уровням: ${build
        .slice(0, 12)
        .map((e) => `${e.level} - ${e.abilityName}`)
        .join("; ")}${build.length > 12 ? "; …" : ""}.`
    );
  }
  const itemSummary =
    itemStats.filter((s) => s.tone === "bad").length > 0
      ? "Есть предметы или способности, взятые позже, чем нужно, - разбор ниже."
      : "Предметы и способности - без серьёзных опозданий.";

  // ---------------- Vision, runes, map ----------------
  const visionStats: BreakdownStat[] = [];
  const visionGood: string[] = [];
  const visionNotes: string[] = [];
  const support = ctx.group === "support";
  visionStats.push({
    label: "Observer / Sentry Ward поставлено",
    you: `${you.obs_placed ?? 0} / ${you.sen_placed ?? 0}`,
    counterpart: cp ? `${cp.obs_placed ?? 0} / ${cp.sen_placed ?? 0}` : undefined,
    tone: support && cp ? compare((you.obs_placed ?? 0) + (you.sen_placed ?? 0), (cp.obs_placed ?? 0) + (cp.sen_placed ?? 0), 4) : "neutral",
  });
  visionStats.push({
    label: "Снято вражеских вардов",
    you: String((you.observer_kills ?? 0) + (you.sentry_kills ?? 0)),
    counterpart: cp ? String((cp.observer_kills ?? 0) + (cp.sentry_kills ?? 0)) : undefined,
    tone: support && cp ? compare((you.observer_kills ?? 0) + (you.sentry_kills ?? 0), (cp.observer_kills ?? 0) + (cp.sentry_kills ?? 0), 3) : "neutral",
  });
  const fates = observerFates(match, you).filter((w) => w.time < end);
  if (fates.length > 0) {
    const dewarded = fates.filter((w) => w.dewardedBy !== null).length;
    visionStats.push({
      label: "Твои Observer Ward, снятые врагом",
      you: `${dewarded} из ${fates.length}`,
      tone: fates.length >= 3 ? (dewarded / fates.length <= 0.25 ? "good" : dewarded / fates.length >= 0.5 ? "bad" : "neutral") : "neutral",
    });
    if (fates.length >= 4 && dewarded / fates.length <= 0.25) visionGood.push(`Враг снял только ${dewarded} из ${fates.length} твоих Observer Ward - ты ставишь их туда, где их не ищут.`);
  }
  if (support || (you.camps_stacked ?? 0) > 0) {
    visionStats.push({
      label: "Застакано лагерей",
      you: String(you.camps_stacked ?? 0),
      counterpart: cp ? String(cp.camps_stacked ?? 0) : undefined,
      tone: support && cp ? compare(you.camps_stacked ?? 0, cp.camps_stacked ?? 0, 3) : "neutral",
    });
  }
  const runeCount = (p: OpenDotaMatchPlayer, keys: string[]) => (p.runes_log ?? []).filter((r) => r.time < end && keys.includes(String(r.key))).length;
  const POWER = ["0", "1", "2", "3", "4", "6", "9"];
  visionStats.push({
    label: "Руны: силы / bounty / мудрости",
    you: `${runeCount(you, POWER)} / ${runeCount(you, ["5"])} / ${runeCount(you, ["8"])}`,
    counterpart: cp ? `${runeCount(cp, POWER)} / ${runeCount(cp, ["5"])} / ${runeCount(cp, ["8"])}` : undefined,
    tone: ctx.role.position === 2 && cp ? compare(runeCount(you, POWER), runeCount(cp, POWER), 3) : "neutral",
  });
  const smoke = you.item_uses?.smoke_of_deceit ?? 0;
  const dust = you.item_uses?.dust ?? 0;
  if (smoke > 0 || dust > 0 || support) {
    visionStats.push({
      label: "Smoke of Deceit / Dust of Appearance",
      you: `${smoke} / ${dust}`,
      counterpart: cp ? `${cp.item_uses?.smoke_of_deceit ?? 0} / ${cp.item_uses?.dust ?? 0}` : undefined,
      tone: "neutral",
    });
  }
  if (ctx.tracks) {
    const track = ctx.tracks.find((t) => t.heroId === you.hero_id && t.isRadiant === you.isRadiant);
    if (track && track.points.length > 0) {
      // Share of time (sampled every 10 s, alive) on each part of the map after the lane.
      let own = 0;
      let enemy = 0;
      let river = 0;
      for (let t = ctx.bounds.laneEnd; t < end; t += 10) {
        if (ctx.deaths.some((d) => t >= d.time && t < d.time + d.timeDead)) continue;
        const p = positionAt(track, t);
        if (!p) continue;
        const side = classifyZone(p.x, p.y, you.isRadiant).side;
        if (side === "own") own++;
        else if (side === "enemy") enemy++;
        else river++;
      }
      const total = own + enemy + river;
      if (total > 0) {
        visionNotes.push(
          `После линии ты провёл ${pct(own, total)}% времени на своей половине карты, ${pct(river, total)}% - у реки, ${pct(enemy, total)}% - на вражеской.`
        );
      }
    }
  }
  if (!support && underWard > 0) visionNotes.push(`Смертей под вражескими Observer Ward: ${underWard} - см. раздел «Смерти».`);
  const visionSummary = support
    ? `Ты поставил ${you.obs_placed ?? 0} Observer и ${you.sen_placed ?? 0} Sentry Ward${cp ? `; ${cpName} - ${cp.obs_placed ?? 0} и ${cp.sen_placed ?? 0}` : ""}.`
    : `Руны силы: ${runeCount(you, POWER)}${cp ? ` (у ${cpName} - ${runeCount(cp, POWER)})` : ""}; вардов поставлено: ${(you.obs_placed ?? 0) + (you.sen_placed ?? 0)}.`;

  // ---------------- Buildings and Roshan ----------------
  const objStats: BreakdownStat[] = [];
  const objGood: string[] = [];
  const objNotes: string[] = [];
  const buildings = (match.objectives ?? []).filter((o) => o.type === "building_kill" && o.key && o.time <= end);
  const theirTowers = buildings.filter((o) => o.key!.includes("tower") && o.key!.includes("goodguys") !== you.isRadiant);
  const ourTowers = buildings.filter((o) => o.key!.includes("tower") && o.key!.includes("goodguys") === you.isRadiant);
  const theirRax = buildings.filter((o) => o.key!.includes("rax") && o.key!.includes("goodguys") !== you.isRadiant);
  const ourRax = buildings.filter((o) => o.key!.includes("rax") && o.key!.includes("goodguys") === you.isRadiant);
  objStats.push({ label: "Башни: снесено / потеряно", you: `${theirTowers.length} / ${ourTowers.length}`, tone: compare(theirTowers.length, ourTowers.length, 2) });
  if (theirRax.length + ourRax.length > 0) objStats.push({ label: "Казармы: снесено / потеряно", you: `${theirRax.length} / ${ourRax.length}`, tone: compare(theirRax.length, ourRax.length, 1) });
  if (!args.youLeft) {
    objStats.push({
      label: "Твой урон по постройкам",
      you: n(you.tower_damage),
      counterpart: cp ? n(cp.tower_damage) : undefined,
      reference: reference("Урон по башням"),
      tone: ctx.isCore && cp ? compare(you.tower_damage, cp.tower_damage, Math.max(1500, cp.tower_damage * 0.3)) : "neutral",
    });
  }
  const yourTeam = you.isRadiant ? 2 : 3;
  const roshans = (match.objectives ?? []).filter((o) => o.type === "CHAT_MESSAGE_ROSHAN_KILL" && o.time <= end);
  if (roshans.length > 0) {
    const ours = roshans.filter((o) => o.team === yourTeam);
    objStats.push({
      label: "Roshan: твоя команда / враг",
      you: `${ours.length} / ${roshans.length - ours.length}`,
      tone: compare(ours.length, roshans.length - ours.length, 1),
    });
    objNotes.push(`Roshan: ${roshans.map((o) => `${formatMatchTime(o.time)} - ${o.team === yourTeam ? "твоя команда" : "враг"}`).join(", ")}.`);
  }
  if (ctx.tracks && theirTowers.length > 0) {
    const track = ctx.tracks.find((t) => t.heroId === you.hero_id && t.isRadiant === you.isRadiant);
    // Where the tower stood: wherever the heroes who hit it were - the nearest enemy-tower kill site is unknown, so use the team.
    const near = theirTowers.filter((o) => {
      const me = positionAt(track, o.time);
      if (!me) return false;
      const team = ctx.match.players.filter((p) => p.isRadiant === you.isRadiant && p !== you);
      const mates = team
        .map((p) => positionAt(ctx.tracks!.find((t) => t.heroId === p.hero_id && t.isRadiant === p.isRadiant), o.time))
        .filter((x): x is { x: number; y: number } => x !== null);
      // The tower falls where the pushing allies are; being among them counts.
      return mates.some((m) => units(me, m) <= 1500);
    }).length;
    objStats.push({
      label: "Был с командой, когда она сносила башни",
      you: `${near} из ${theirTowers.length}`,
      tone: theirTowers.length >= 3 ? (near / theirTowers.length >= 0.6 ? "good" : near / theirTowers.length < 0.3 ? "bad" : "neutral") : "neutral",
    });
  }
  if (ctx.isCore && cp && you.tower_damage - cp.tower_damage >= 1500 && !args.youLeft) {
    objGood.push(`Ты нанёс постройкам ${n(you.tower_damage)} урона, ${cpName} - ${n(cp.tower_damage)}.`);
  }
  if (you.towers_killed && you.towers_killed > 0) objNotes.push(`Башен, которые добил ты сам: ${you.towers_killed}.`);
  const objSummary = `Башни: твоя команда снесла ${theirTowers.length}, потеряла ${ourTowers.length}${roshans.length > 0 ? `; Roshan: ${roshans.filter((o) => o.team === yourTeam).length} из ${roshans.length}` : ""}.`;

  if (args.youLeft) {
    const note = "Ты покинул игру - итоговые цифры за игру к тебе не относятся и в разбор не входят.";
    farmNotes.unshift(note);
    fightNotes.unshift(note);
  }

  return [
    aspect("laning", laneSummary, laneStats, laneGood, laneNotes),
    aspect("farm", farmSummary, farmStats, farmGood, farmNotes),
    aspect("deaths", deathSummary(deaths), deathStats, deathGood, deathNotes),
    aspect("fights", fightSummary, fightStats, fightGood, fightNotes),
    aspect("items", itemSummary, itemStats, itemGood, itemNotes),
    aspect("vision", visionSummary, visionStats, visionGood, visionNotes),
    aspect("objectives", objSummary, objStats, objGood, objNotes),
  ];
}

function finalItemNames(ids: number[]): string[] {
  return ids.map((id) => getItemNameById(id)).filter((x): x is string => x !== null);
}
