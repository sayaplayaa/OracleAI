import { formatGold, pluralRu } from "../format";
import { frontPositioningAdvice } from "../coach/advice";
import { roleGroupOf } from "../coach/principles";
import type { StratzPositionTrack } from "../stratz";
import type { CoachFinding, OpenDotaMatch, OpenDotaMatchPlayer } from "../types";
import type { Cause } from "./cause";
import { deathTimesOf } from "./gameFlow";
import { classifyZone, positionCells } from "./mapZones";

// The position grid is 128 game units per cell (an Observer Ward sees 1600
// units = 12.5 cells).
const UNITS_PER_CELL = 128;
// Nobody within this distance at a death outside a fight: no ally could help.
const ISOLATED_UNITS = 2000;
// Closest of the team to the enemy by this much at a fight's start: the
// first hero the enemy can reach.
const FRONT_MARGIN_UNITS = 150;

export type Point = { x: number; y: number };

/** Where a hero was at a moment: the last recorded point before it. */
export function positionAt(track: StratzPositionTrack | undefined, time: number): Point | null {
  const pts = track?.points;
  if (!pts || pts.length === 0 || pts[0].time > time) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].time <= time) lo = mid;
    else hi = mid - 1;
  }
  return pts[lo];
}

/** Distance in game units between two grid points. */
export function units(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y) * UNITS_PER_CELL;
}

function roundUnits(u: number): string {
  return formatGold(Math.round(u / 100) * 100);
}

type Teamfight = NonNullable<OpenDotaMatch["teamfights"]>[number];

function took(fp: Teamfight["players"][number] | undefined): boolean {
  if (!fp) return false;
  const kills = Object.values(fp.killed ?? {}).reduce((a, b) => a + b, 0);
  return fp.damage > 0 || fp.deaths > 0 || kills > 0 || fp.healing > 0;
}

export interface PositioningResult {
  facts: string[];
  causes: Cause[];
  strengths: CoachFinding[];
  // Death time -> distance (game units) to the nearest living ally.
  nearestAllyAtDeath: Map<number, number>;
  // Fight start -> where the player was instead.
  whereDuringMissedFight: Map<number, string>;
  // Starts of the fights in which the player was the team's closest hero to the enemy.
  frontAt: Set<number>;
}

/**
 * How the player stood, from every hero's real movement over the game:
 * whether they were the first hero the enemy could reach when fights began
 * (the job of an initiator, a mistake for a carry, mid or support), how far
 * the nearest ally was when they died outside a fight, and where they were
 * during the fights they missed.
 */
export function analysePositioning(args: {
  match: OpenDotaMatch;
  you: OpenDotaMatchPlayer;
  tracks: StratzPositionTrack[];
  position: number;
  end: number;
  laneEnd: number;
  time: (seconds: number) => string;
}): PositioningResult {
  const { match, you, tracks, position, time } = args;
  const trackOf = (p: OpenDotaMatchPlayer) => tracks.find((t) => t.heroId === p.hero_id && t.isRadiant === p.isRadiant);
  const result: PositioningResult = {
    facts: [],
    causes: [],
    strengths: [],
    nearestAllyAtDeath: new Map(),
    whereDuringMissedFight: new Map(),
    frontAt: new Set(),
  };
  const yourTrack = trackOf(you);
  if (!yourTrack) return result;

  const allies = match.players.filter((p) => p !== you && p.isRadiant === you.isRadiant);
  const deadAt = new Map(
    match.players.map((p) => [p, (p.deaths_log ?? []).map((d) => ({ from: d.time, to: d.time + (d.time_dead ?? 30) }))])
  );
  const alive = (p: OpenDotaMatchPlayer, t: number) => !(deadAt.get(p) ?? []).some((d) => t >= d.from && t < d.to);

  // ---- Fights: who stood in front when they began ----
  const fights = (match.teamfights ?? []).filter((f) => f.start >= args.laneEnd && f.start < args.end);
  let checked = 0;
  const frontAndDied: number[] = [];
  for (const f of fights) {
    const idx = (p: OpenDotaMatchPlayer) => match.players.indexOf(p);
    const t = f.start;
    if (!took(f.players[idx(you)])) {
      // Where you were instead.
      const at = positionAt(yourTrack, t);
      const cells = f.players.flatMap((fp) => positionCells(fp.deaths_pos));
      if (at && cells.length > 0) {
        const n = cells.reduce((s, c) => s + c.count, 0);
        const centre = { x: cells.reduce((s, c) => s + c.x * c.count, 0) / n, y: cells.reduce((s, c) => s + c.y * c.count, 0) / n };
        const zone = classifyZone(at.x, at.y, you.isRadiant);
        result.whereDuringMissedFight.set(t, `${zone.label}, в ${roundUnits(units(at, centre))} ед. от драки`);
      }
      continue;
    }
    const fighters = match.players.filter((p) => took(f.players[idx(p)]) && alive(p, t));
    const enemies = fighters.filter((p) => p.isRadiant !== you.isRadiant);
    const team = fighters.filter((p) => p.isRadiant === you.isRadiant);
    if (enemies.length === 0 || team.length < 3 || !team.includes(you)) continue;
    const reach = (p: OpenDotaMatchPlayer): number | null => {
      const me = positionAt(trackOf(p), t);
      if (!me) return null;
      const d = enemies.map((e) => positionAt(trackOf(e), t)).filter((x): x is Point => x !== null).map((e) => units(me, e));
      return d.length > 0 ? Math.min(...d) : null;
    };
    const mine = reach(you);
    const others = team.filter((p) => p !== you).map(reach).filter((d): d is number => d !== null);
    if (mine === null || others.length < 2) continue;
    checked++;
    const youDied = f.players[idx(you)]?.deaths > 0;
    const front = mine + FRONT_MARGIN_UNITS < Math.min(...others);
    if (front) result.frontAt.add(t);
    if (front && youDied) frontAndDied.push(t);
  }

  // An initiator (position 3) is meant to be the first hero the enemy meets.
  if (position !== 3 && checked >= 2) {
    if (frontAndDied.length >= 2) {
      result.causes.push({
        code: "FRONT_POSITIONING",
        severity: 35 + frontAndDied.length * 10,
        text: `В начале драк ${frontAndDied.map((t) => time(t)).join(", ")} ты стоял ближе всех из команды к врагу - и погибал в них: враг доставал тебя раньше, чем остальных.`,
        target: `ни разу не стоять ближе всех к врагу в начале драки (в этой игре - ${frontAndDied.length} ${pluralRu(frontAndDied.length, ["раз", "раза", "раз"])})`,
        ...frontPositioningAdvice({ group: roleGroupOf(position), times: frontAndDied.map((t) => time(t)) }),
      });
    } else if (frontAndDied.length === 0 && checked >= 3) {
      result.strengths.push({
        point: "В драках ты держал правильную дистанцию: ни разу не оказался первой целью врага.",
        metric: `Драк проверено по позициям героев: ${checked}; в начале каждой ближе тебя к врагу стоял кто-то из команды`,
      });
    }
  }

  // ---- Deaths outside fights: who could have helped ----
  const allFights = match.teamfights ?? [];
  for (const t of deathTimesOf(match, you)) {
    if (t >= args.end || allFights.some((f) => t >= f.start - 15 && t <= f.end + 15)) continue;
    const me = positionAt(yourTrack, t);
    if (!me) continue;
    const d = allies
      .filter((p) => alive(p, t))
      .map((p) => positionAt(trackOf(p), t))
      .filter((x): x is Point => x !== null)
      .map((p) => units(me, p));
    if (d.length > 0) result.nearestAllyAtDeath.set(t, Math.min(...d));
  }
  const isolated = [...result.nearestAllyAtDeath.entries()].filter(([, u]) => u >= ISOLATED_UNITS);
  if (isolated.length > 0) {
    result.facts.push(
      `Смерти вне драк, когда рядом не было союзников: ${isolated.map(([t, u]) => `${time(t)} - ближайший союзник в ${roundUnits(u)} единиц`).join("; ")}.`
    );
  }

  if (frontAndDied.length > 0) {
    result.facts.push(`Драки, в начале которых ты стоял ближе всех из команды к врагу и погиб: ${frontAndDied.map((t) => time(t)).join(", ")}.`);
  }
  for (const [t, where] of result.whereDuringMissedFight) {
    result.facts.push(`Во время драки в ${time(t)}, которую ты пропустил, ты был: ${where}.`);
  }
  return result;
}
