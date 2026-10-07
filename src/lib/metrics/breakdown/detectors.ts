// Problems the phase checks don't cover: the skill build, rune control, minutes
// spent without farming, TP Scroll use and a missing Black King Bar. Each is
// anchored to a moment (`at`) so it lands in the phase where it happened.

import { getHeroName, getItemNameByKey } from "../../constants";
import { formatMatchTime, pluralRu } from "../../format";
import { fewTpAdvice, idleFarmAdvice, noBkbAdvice, runeAdvice, timesRu, ultLateAdvice } from "../../coach/advice";
import { heroKitHasDisable } from "../../coach/kit";
import { ultimateKey } from "../../coach/threats";
import type { Cause } from "../cause";
import type { Ctx } from "../matchAnalysis";
import { classifyZone } from "../mapZones";
import { positionAt } from "../positioning";
import { computeSkillBuild, interpolateTime, xpForLevel } from "../skillBuild";

// Power runes by OpenDota's runes_log key; 5 bounty, 7 water and 8 wisdom aren't.
const POWER_RUNES = new Set(["0", "1", "2", "3", "4", "6", "9"]);
// Minute with fewer last hits than this, alive and out of fights, is idle.
const IDLE_LAST_HITS = 3;
const IDLE_HERO_DAMAGE = 200;

function at(arr: number[] | undefined, minute: number): number | null {
  return arr && minute >= 0 && minute < arr.length ? arr[minute] : null;
}

function deadDuring(ctx: Ctx, from: number, to: number): boolean {
  return ctx.deaths.some((d) => d.time < to && d.time + Math.max(d.timeDead, 1) > from);
}

function ultLate(ctx: Ctx): Cause | null {
  const key = ultimateKey(ctx.you.hero_id);
  if (!key || ctx.you.level < 7) return null;
  const build = computeSkillBuild(ctx.you, ctx.you.hero_id);
  // A missing entry is more likely a gap in the data than a hero played
  // without an ultimate, so only a late one counts.
  const first = build.find((e) => e.abilityKey === key);
  if (!first || first.level <= 6) return null;
  const level = first.level;
  const ultName = first.abilityName;
  const sixAt = ctx.you.xp_t ? interpolateTime(ctx.you.xp_t, xpForLevel(6) ?? 0) : null;
  const time = first.approxTimeSeconds;
  return {
    code: "ULT_LATE",
    severity: Math.min(50, 25 + (level - 6) * 8),
    text: `Ультимейт ${ultName} взят на ${level} уровне${time !== null ? ` (~${ctx.time(time)})` : ""}, а не на 6-м.`,
    target: `${ultName} на 6 уровне`,
    at: sixAt ?? time ?? ctx.bounds.laneEnd,
    ...ultLateAdvice({ ult: ultName, level, time: time !== null ? ctx.time(time) : null }),
  };
}

function runeControl(ctx: Ctx): Cause | null {
  if (ctx.role.position !== 2 || !ctx.counterpart) return null;
  const until = ctx.bounds.laneEnd + 300;
  const count = (log: { time: number; key: string }[] | undefined) =>
    (log ?? []).filter((r) => r.time < Math.min(until, ctx.end) && POWER_RUNES.has(String(r.key))).length;
  const mine = count(ctx.you.runes_log);
  const theirs = count(ctx.counterpart.runes_log);
  if (theirs - mine < 3) return null;
  const name = getHeroName(ctx.counterpart.hero_id);
  return {
    code: "RUNE_CONTROL",
    severity: Math.min(40, 25 + (theirs - mine - 3) * 5),
    text: `Руны силы до ${ctx.time(until)}: ты взял ${mine}, ${name} - ${theirs}.`,
    target: `хотя бы половина рун силы до ${formatMatchTime(until)} (в этой игре - ${mine} из ${mine + theirs})`,
    at: 360,
    ...runeAdvice({ you: mine, them: theirs, counterpart: name, until: ctx.time(until) }),
  };
}

function idleFarm(ctx: Ctx): Cause | null {
  if (ctx.role.position > 2) return null;
  const { you } = ctx;
  if (!you.lh_t) return null;
  const startMin = Math.ceil(ctx.bounds.laneEnd / 60);
  const lastMin = Math.min(ctx.lastMinute, you.lh_t.length - 1);
  const idle: number[] = [];
  const busy: number[] = [];
  for (let m = startMin; m < lastMin; m++) {
    const from = m * 60;
    const to = from + 60;
    const lh = (at(you.lh_t, m + 1) ?? 0) - (at(you.lh_t, m) ?? 0);
    const dmgA = at(you.hero_damage_t, m);
    const dmgB = at(you.hero_damage_t, m + 1);
    const fought =
      ctx.fights.some((f) => f.start < to + 15 && f.end > from - 15) ||
      ctx.heroKills.some((k) => k.time >= from && k.time < to) ||
      (dmgA !== null && dmgB !== null && dmgB - dmgA >= IDLE_HERO_DAMAGE);
    if (deadDuring(ctx, from - 10, to) || fought) continue;
    (lh < IDLE_LAST_HITS ? idle : busy).push(m);
  }
  // Only stretches of 2+ minutes: one quiet minute is walking to the next camp.
  const runs: number[][] = [];
  for (const m of idle) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === m - 1) last.push(m);
    else runs.push([m]);
  }
  const long = runs.filter((r) => r.length >= 2);
  const minutes = long.reduce((s, r) => s + r.length, 0);
  if (minutes < 4) return null;

  const gpm =
    busy.length > 0
      ? Math.round(busy.reduce((s, m) => s + ((at(you.gold_t, m + 1) ?? 0) - (at(you.gold_t, m) ?? 0)), 0) / busy.length)
      : null;
  const track = ctx.tracks?.find((t) => t.heroId === you.hero_id && t.isRadiant === you.isRadiant);
  const ranges = long.map((r) => {
    const label = `${ctx.time(r[0] * 60)}-${ctx.time((r[r.length - 1] + 1) * 60)}`;
    const p = positionAt(track, (r[0] + r.length / 2) * 60);
    return p ? `${label} (ты был: ${classifyZone(p.x, p.y, you.isRadiant).label})` : label;
  });
  return {
    code: "IDLE_FARM",
    severity: Math.min(45, 15 + minutes * 4),
    text: `${minutes} мин. после линии ты был жив, не дрался и почти не добивал: ${ranges.join("; ")}.`,
    target: "0 минут подряд без добиваний между драками",
    at: long[0][0] * 60,
    ...idleFarmAdvice({ group: ctx.group, ranges, minutes, gpm }),
  };
}

function fewTp(ctx: Ctx): Cause | null {
  if (!ctx.isCore || !ctx.counterpart) return null;
  if (ctx.end < (ctx.turbo ? 900 : 1500)) return null;
  const mine = ctx.you.item_uses?.tpscroll ?? 0;
  const theirs = ctx.counterpart.item_uses?.tpscroll ?? 0;
  if (theirs < mine * 2 + 3) return null;
  const missed = ctx.fights.filter(
    (f) => f.start >= ctx.bounds.laneEnd && f.start < ctx.end && !f.you.participated && !deadDuring(ctx, f.start - 5, f.start + 5)
  );
  if (missed.length < 2) return null;
  const name = getHeroName(ctx.counterpart.hero_id);
  return {
    code: "FEW_TP",
    severity: 25 + Math.min(15, missed.length * 3),
    text: `TP Scroll за игру: ты ${mine}, ${name} - ${theirs}; при этом ты пропустил ${missed.length} ${pluralRu(missed.length, ["драку", "драки", "драк"])}, будучи живым.`,
    target: `TP Scroll - не меньше ${theirs} за игру, как у ${name}`,
    at: missed[0].start,
    ...fewTpAdvice({ you: mine, them: theirs, counterpart: name, missed: missed.length }),
  };
}

function noBkb(ctx: Ctx): Cause | null {
  if (!ctx.isCore || ctx.turbo) return null;
  const meta = ctx.metaItemTiming.find((m) => m.itemKey === "black_king_bar");
  if (!meta) return null;
  if ((ctx.you.purchase_log ?? []).some((p) => p.key === "black_king_bar")) return null;
  // Only once the game went long enough past the usual timing to have it.
  if (ctx.end < meta.avgTimeSeconds + 600) return null;
  const fightDeaths = ctx.deaths.filter((d) => d.inFight && d.time >= meta.avgTimeSeconds);
  if (fightDeaths.length < 2) return null;
  const disablers = ctx.match.players
    .filter((p) => p.isRadiant !== ctx.you.isRadiant && heroKitHasDisable(p.hero_id))
    .map((p) => getHeroName(p.hero_id));
  const hero = getHeroName(ctx.you.hero_id);
  return {
    code: "NO_BKB",
    severity: 35 + Math.min(15, fightDeaths.length * 4),
    text: `${getItemNameByKey("black_king_bar")} так и не куплен (обычно у ${hero} на этой позиции - к ${formatMatchTime(meta.avgTimeSeconds)}), а после этого времени ты погиб в драках ${timesRu(fightDeaths.length)}.`,
    target: `${getItemNameByKey("black_king_bar")} к ~${formatMatchTime(meta.avgTimeSeconds)}`,
    at: meta.avgTimeSeconds,
    ...noBkbAdvice({
      hero,
      metaTime: formatMatchTime(meta.avgTimeSeconds),
      deaths: fightDeaths.map((d) => ctx.time(d.time)),
      disablers,
    }),
  };
}

/** Every extra problem found in this game. */
export function extraCauses(ctx: Ctx): Cause[] {
  return [ultLate(ctx), runeControl(ctx), idleFarm(ctx), fewTp(ctx), noBkb(ctx)].filter((c): c is Cause => c !== null);
}
