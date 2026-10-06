import { getHeroInternalName, getHeroName } from "../constants";
import { formatGold, formatSigned, pluralRu } from "../format";
import type { CauseCode } from "../coach/principles";
import { classifyZone, positionCells } from "./mapZones";
import type { CoachFinding, FlowFight, GameFlow, GameFlowKind, OpenDotaMatch, OpenDotaMatchPlayer } from "../types";

export interface FlowCause {
  code: CauseCode;
  severity: number;
  text: string;
  target?: string;
}

type Teamfight = NonNullable<OpenDotaMatch["teamfights"]>[number];

interface FightView {
  fight: Teamfight;
  start: number;
  end: number;
  yourTeamDeaths: number;
  enemyDeaths: number;
  place: string | null;
  side: "own" | "enemy" | "river" | null;
  participated: boolean;
  youDied: boolean;
  // Your death was the team's first in this fight.
  diedFirst: boolean;
  // You died alone shortly before it started: the team fought a player down.
  diedJustBefore: number | null;
  aegis: boolean;
  leadBefore: number | null;
  leadAfter: number | null;
}

// A gold lead this big is a won game if nothing goes wrong (Turbo's income is
// roughly double).
const BIG_LEAD = { normal: 5000, turbo: 9000 };
// From here on, deaths decide buildings and the game - buyback matters.
const LATE_GAME = { normal: 1800, turbo: 1080 };
// Death this soon before a fight starts means the team began it a player down.
const JUST_BEFORE_SECONDS = 45;

function at(arr: number[] | undefined, minute: number): number | null {
  return arr && minute >= 0 && minute < arr.length ? arr[minute] : null;
}

/** Every death of a player (seconds): deaths_log, or the kill logs of the enemies when it's missing. */
export function deathTimesOf(match: OpenDotaMatch, p: OpenDotaMatchPlayer): number[] {
  if (p.deaths_log && p.deaths_log.length > 0) return p.deaths_log.map((d) => d.time).sort((a, b) => a - b);
  const key = getHeroInternalName(p.hero_id);
  return match.players
    .flatMap((k) => (k.kills_log ?? []).filter((e) => e.key === key).map((e) => e.time))
    .sort((a, b) => a - b);
}

function participated(fp: Teamfight["players"][number] | undefined): boolean {
  if (!fp) return false;
  const kills = Object.values(fp.killed ?? {}).reduce((a, b) => a + b, 0);
  return fp.damage > 0 || fp.deaths > 0 || kills > 0 || fp.healing > 0;
}

// Where a fight happened: the average of every death position in it.
function fightPlace(fight: Teamfight, yourIsRadiant: boolean) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const fp of fight.players) {
    for (const c of positionCells(fp.deaths_pos)) {
      sx += c.x * c.count;
      sy += c.y * c.count;
      n += c.count;
    }
  }
  if (n === 0) return { place: null, side: null };
  const zone = classifyZone(sx / n, sy / n, yourIsRadiant);
  return { place: zone.label, side: zone.side };
}

function seconds(n: number): string {
  return `${n} ${pluralRu(n, ["секунду", "секунды", "секунд"])}`;
}

// "потеряли 1 героя / 3 героя / 5 героев".
function heroesRu(n: number): string {
  return `${n} ${pluralRu(n, ["героя", "героя", "героев"])}`;
}

function times(n: number): string {
  return `${n} ${pluralRu(n, ["раз", "раза", "раз"])}`;
}

/**
 * The whole game as the player's team lived it: was a won game thrown, a lost
 * one turned around, or was it one-sided from the start - and which fights
 * decided it, with what this player did in each. A report that only compares
 * the player with one opponent phase by phase called a 15k lead thrown in
 * three late fights "a lost late game" and gave laning advice.
 */
export function buildGameFlow(args: {
  match: OpenDotaMatch;
  you: OpenDotaMatchPlayer;
  turbo: boolean;
  isCore: boolean;
  // Where the analysis stops (the player left) - nothing after is theirs.
  end: number;
  laneEnd: number;
  // Registers a time label for the narrative checker and returns it.
  time: (seconds: number) => string;
  teammateLeftAt: number | null;
}): { flow: GameFlow; causes: FlowCause[]; strengths: CoachFinding[] } | null {
  const { match, you, turbo, isCore, time } = args;
  if (!Array.isArray(match.radiant_gold_adv) || match.radiant_gold_adv.length < 3) return null;

  const lead = match.radiant_gold_adv.map((v) => (you.isRadiant ? v : -v));
  const win = you.isRadiant === match.radiant_win;
  const big = turbo ? BIG_LEAD.turbo : BIG_LEAD.normal;
  const peakGold = Math.max(...lead);
  const troughGold = Math.min(...lead);
  const peak = peakGold > 0 ? { minute: lead.indexOf(peakGold), gold: peakGold } : null;
  const trough = troughGold < 0 ? { minute: lead.indexOf(troughGold), gold: troughGold } : null;
  const final = lead[lead.length - 1];

  let kind: GameFlowKind;
  if (!win && peak && peak.gold >= big) kind = "throw";
  else if (win && trough && -trough.gold >= big) kind = "comeback";
  else if (win && final >= big) kind = "stomp-win";
  else if (!win && -final >= big) kind = "stomp-loss";
  else kind = win ? "close-win" : "close-loss";

  // ---- Every teamfight, from this player's team's side ----
  const team = match.players.filter((p) => p.isRadiant === you.isRadiant);
  const teamDeaths = team.map((p) => ({ p, times: deathTimesOf(match, p) }));
  const yourDeaths = deathTimesOf(match, you);
  const youIndex = match.players.indexOf(you);
  // Aegis: from the pickup until its holder dies (that death is the
  // reincarnation) or it expires after 5 minutes.
  const aegisWindows = (match.objectives ?? [])
    .filter((o) => o.type === "CHAT_MESSAGE_AEGIS")
    .map((o) => ({ at: o.time, holder: match.players.find((p) => p.player_slot === o.player_slot) }))
    .filter((a) => a.holder?.isRadiant === you.isRadiant)
    .map((a) => {
      const used = deathTimesOf(match, a.holder!).find((t) => t > a.at && t - a.at <= 300);
      return { from: a.at, to: used ?? a.at + 300 };
    });
  // When this player was dead (respawn time from the replay, 30 s if missing).
  const deadUntil = (you.deaths_log ?? []).map((d) => ({ from: d.time, to: d.time + (d.time_dead ?? 30) }));
  const leadAt = (seconds: number) => at(lead, Math.max(0, Math.floor(seconds / 60)));

  const fights: FightView[] = (match.teamfights ?? [])
    .filter((f) => f.start < args.end)
    .map((fight) => {
      let yourTeamDeaths = 0;
      let enemyDeaths = 0;
      match.players.forEach((p, i) => {
        const d = fight.players[i]?.deaths ?? 0;
        if (p.isRadiant === you.isRadiant) yourTeamDeaths += d;
        else enemyDeaths += d;
      });
      const inWindow = (t: number) => t >= fight.start - 3 && t <= fight.end + 3;
      const yourDeathInFight = yourDeaths.find(inWindow);
      const firstTeamDeath = Math.min(...teamDeaths.flatMap((d) => d.times.filter(inWindow)));
      const where = fightPlace(fight, you.isRadiant);
      return {
        fight,
        start: fight.start,
        end: fight.end,
        yourTeamDeaths,
        enemyDeaths,
        place: where.place,
        side: where.side,
        participated: participated(fight.players[youIndex]),
        youDied: yourDeathInFight !== undefined,
        diedFirst: yourDeathInFight !== undefined && yourDeathInFight <= firstTeamDeath && yourTeamDeaths >= 2,
        diedJustBefore: null,
        aegis: aegisWindows.some((w) => w.from <= fight.start && fight.start < w.to),
        leadBefore: leadAt(fight.start - 60),
        leadAfter: leadAt(fight.end + 60),
      };
    });

  // A death outside every fight shortly before one starts. "Outside" is what
  // the replay counted: a death 10 s before a fight can fall inside its time
  // window without being one of its deaths.
  const deathsInFight = (f: FightView) => f.fight.players[youIndex]?.deaths ?? 0;
  for (const t of yourDeaths) {
    if (t >= args.end || fights.some((f) => t >= f.start - 15 && t <= f.end + 15 && deathsInFight(f) > 0)) continue;
    const next = fights.find((f) => f.start > t && f.start - t <= JUST_BEFORE_SECONDS);
    if (next && next.diedJustBefore === null) next.diedJustBefore = t;
  }

  const lost = (f: FightView) => f.yourTeamDeaths >= 2 && f.yourTeamDeaths > f.enemyDeaths;
  const wonFight = (f: FightView) => f.enemyDeaths >= 2 && f.enemyDeaths > f.yourTeamDeaths;
  const swing = (f: FightView) => (f.leadAfter ?? 0) - (f.leadBefore ?? 0);

  // ---- The fights that decided it ----
  // A throw is every fight lost after the peak - all of them, so a lost Aegis
  // fight is never left out for having a smaller swing.
  const lostAfterPeak = kind === "throw" && peak ? fights.filter((f) => f.start >= peak.minute * 60 - 60 && lost(f)) : [];
  let key: FightView[];
  if (kind === "throw") {
    key = lostAfterPeak;
  } else if (kind === "comeback" && trough) {
    key = fights.filter((f) => f.start >= trough.minute * 60 - 60 && wonFight(f));
  } else if (win) {
    key = fights.filter(wonFight);
  } else {
    key = fights.filter(lost);
  }
  key = [...key]
    .sort((a, b) => Math.abs(swing(b)) - Math.abs(swing(a)) || b.yourTeamDeaths + b.enemyDeaths - (a.yourTeamDeaths + a.enemyDeaths))
    .slice(0, kind === "throw" ? 6 : 4)
    .sort((a, b) => a.start - b.start);

  const part = (f: FightView): string => {
    if (f.diedJustBefore !== null) return `погиб за ${seconds(f.start - f.diedJustBefore)} до драки, команда начала её без тебя`;
    if (f.diedFirst) return "погиб первым из команды";
    if (f.youDied) return "погиб в драке";
    if (f.participated) return "участвовал и выжил";
    const dead = deadUntil.find((d) => f.start >= d.from && f.start < d.to);
    if (dead) return `был мёртв (погиб в ${time(dead.from)})`;
    return "в драке не участвовал";
  };
  const keyFights: FlowFight[] = key.map((f) => ({
    time: f.start,
    timeLabel: time(f.start),
    place: f.place,
    yourTeamDeaths: f.yourTeamDeaths,
    enemyDeaths: f.enemyDeaths,
    leadBefore: f.leadBefore,
    leadAfter: f.leadAfter,
    aegis: f.aegis,
    yourPart: part(f),
  }));

  // ---- Headline and facts ----
  const maxAbs = Math.max(Math.abs(peakGold), Math.abs(troughGold));
  const minute = (m: number) => time(m * 60);
  const headline: Record<GameFlowKind, string> = {
    throw: `Выигранная игра упущена: на ${peak ? minute(peak.minute) : ""} твоя команда вела на ${formatGold(peakGold)} золота, но проиграла.`,
    comeback: `Камбэк: на ${trough ? minute(trough.minute) : ""} твоя команда отставала на ${formatGold(-troughGold)} золота, но победила.`,
    "stomp-win": `Уверенная победа: к концу игры твоя команда вела на ${formatGold(final)} золота.`,
    "stomp-loss": `Тяжёлое поражение: к концу игры твоя команда отставала на ${formatGold(-final)} золота.`,
    "close-win": `Равная игра, которую твоя команда дожала: разница в золоте не превышала ${formatGold(maxAbs)}.`,
    "close-loss": `Равная игра, проигранная в концовке: разница в золоте не превышала ${formatGold(maxAbs)}.`,
  };
  const facts: string[] = [headline[kind]];

  const buildings = (from: number, to: number) => {
    let taken = 0;
    let lostCount = 0;
    let lastTaken: number | null = null;
    for (const o of match.objectives ?? []) {
      if (o.type !== "building_kill" || !o.key || o.time < from || o.time > to) continue;
      const theirs = o.key.includes("goodguys") !== you.isRadiant;
      if (theirs) {
        taken++;
        lastTaken = o.time;
      } else lostCount++;
    }
    return { taken, lost: lostCount, lastTaken };
  };

  const causes: FlowCause[] = [];
  const strengths: CoachFinding[] = [];
  const teammateGoneEarly = args.teammateLeftAt !== null && peak !== null && args.teammateLeftAt <= peak.minute * 60 + 120;

  if (kind === "throw" && peak) {
    const from = peak.minute * 60;
    const b = buildings(from, match.duration);
    facts.push(
      `После пика на ${minute(peak.minute)} твоя команда за ${Math.round((match.duration - from) / 60)} мин. взяла ${b.taken} ${pluralRu(b.taken, ["вражескую постройку", "вражеские постройки", "вражеских построек"])} и потеряла ${b.lost} своих.`
    );
    const window = turbo ? 300 : 480;
    const early = buildings(from, from + window);
    // Team-level throw causes are only fair while the team was five.
    if (!teammateGoneEarly && early.taken <= 1 && match.duration - from > window) {
      causes.push({
        code: "LEAD_NOT_CONVERTED",
        severity: 55,
        text: `С перевесом ${formatSigned(peakGold)} на ${minute(peak.minute)} твоя команда за следующие ${Math.round(window / 60)} мин. снесла ${early.taken} ${pluralRu(early.taken, ["постройку", "постройки", "построек"])} - преимущество не превратилось в базу врага, и он успел собрать предметы для обороны.`,
        target: `с перевесом ${formatGold(big)}+ - хотя бы 2 постройки за ${Math.round(window / 60)} мин. (в этой игре - ${early.taken})`,
      });
    }
    const badFights = lostAfterPeak.filter((f) => f.side === "enemy" && (f.leadBefore ?? 0) >= big / 2);
    if (!teammateGoneEarly && badFights.length > 0) {
      causes.push({
        code: "LOST_FIGHT_ENEMY_SIDE",
        severity: 60 + badFights.length * 5,
        text: `Имея перевес, твоя команда проиграла ${badFights.length === 1 ? "драку" : `${badFights.length} драки`} на чужой половине: ${badFights
          .map((f) => `${time(f.start)} - ${f.place ?? "вражеская половина"}, вы потеряли ${heroesRu(f.yourTeamDeaths)}, враг - ${f.enemyDeaths} (ты ${part(f)})`)
          .join("; ")}.`,
        target: `0 проигранных драк на вражеской половине, пока команда впереди (в этой игре - ${badFights.length})`,
      });
    }
    const aegisFights = lostAfterPeak.filter((f) => f.aegis);
    if (aegisFights.length > 0) {
      causes.push({
        code: "AEGIS_WASTED",
        severity: 50,
        text: `Взяв Aegis, твоя команда проиграла драку в ${aegisFights.map((f) => time(f.start)).join(", ")} (вы потеряли ${heroesRu(aegisFights[0].yourTeamDeaths)}, враг - ${aegisFights[0].enemyDeaths}) - Aegis ушёл на погоню, а не на постройки.`,
        target: "после Roshan - сразу к вражеской башне или на хайграунд с волной крипов, без погони в туман",
      });
    }
  }

  if (kind === "comeback") {
    for (const f of key.filter((x) => x.participated && !x.youDied).slice(0, 2)) {
      strengths.push({
        point: `Ты был в драке, которая развернула игру, и выжил в ней.`,
        metric: `${time(f.start)}: враг потерял ${heroesRu(f.enemyDeaths)}, твоя команда - ${f.yourTeamDeaths}; перевес ${formatSigned(f.leadBefore ?? 0)} -> ${formatSigned(f.leadAfter ?? 0)}`,
      });
    }
  }

  // ---- What this player did around the fights, any kind of game ----
  const lateFights = fights.filter((f) => f.start >= args.laneEnd);
  const before = lateFights.filter((f) => f.diedJustBefore !== null && lost(f));
  if (before.length > 0) {
    causes.push({
      code: "DIED_BEFORE_FIGHT",
      severity: 40 + before.length * 15 + (kind === "throw" ? 15 : 0),
      text: `Ты погибал прямо перед драками, и команда начинала их без тебя: ${before
        .map((f) => `смерть в ${time(f.diedJustBefore!)}, через ${seconds(f.start - f.diedJustBefore!)} - драка, в которой вы потеряли ${heroesRu(f.yourTeamDeaths)}, враг - ${f.enemyDeaths}`)
        .join("; ")}.`,
      target: `0 смертей в одиночку за минуту до драки (в этой игре - ${before.length})`,
    });
  }
  const first = lateFights.filter((f) => f.diedFirst && lost(f));
  const firstMatters = first.length >= 2 || (kind === "throw" && first.length >= 1);
  if (firstMatters) {
    causes.push({
      code: "DIED_FIRST",
      severity: (isCore ? 40 : 28) + first.length * 10 + (kind === "throw" ? 10 : 0),
      text: `В проигранных драках ${first.map((f) => time(f.start)).join(", ")} первым из команды погибал ты - команда дралась без тебя с первых секунд.`,
      target: `не быть первой смертью команды в драке (в этой игре - ${times(first.length)})`,
    });
  }

  // Buyback: a core who died as the base fell and never came back.
  if (isCore) {
    const late = turbo ? LATE_GAME.turbo : LATE_GAME.normal;
    const buybacks = (you.buyback_log ?? []).map((b) => b.time);
    const ownBaseFalls = (match.objectives ?? []).filter(
      (o) => o.type === "building_kill" && o.key && o.key.includes("goodguys") === you.isRadiant && /rax|fort/.test(o.key)
    );
    const missed = yourDeaths.filter(
      (t) =>
        t >= late &&
        t < args.end &&
        !buybacks.some((b) => b >= t && b - t <= 30) &&
        ownBaseFalls.some((o) => o.time > t && o.time - t <= 120)
    );
    if (missed.length > 0) {
      const t = missed[missed.length - 1];
      const nw = at(you.networth_t, Math.floor(t / 60));
      const cost = nw !== null ? 200 + Math.floor(nw / 13) : null;
      const fallen = ownBaseFalls.filter((o) => o.time > t && o.time - t <= 120);
      const rax = fallen.filter((o) => o.key!.includes("rax")).length;
      const throne = fallen.some((o) => o.key!.includes("fort"));
      const what = [rax > 0 ? `${rax} ${pluralRu(rax, ["казарма", "казармы", "казарм"])}` : null, throne ? "трон" : null]
        .filter(Boolean)
        .join(" и ");
      causes.push({
        code: "NO_BUYBACK",
        severity: 45 + (kind === "throw" ? 10 : 0),
        text: `В ${time(t)} ты погиб, и в следующие 2 минуты пали ${what} (${fallen.map((o) => time(o.time)).join(", ")}), а выкупа не было${cost !== null ? ` - он стоил ~${formatGold(cost)} золота при нетворсе ${formatGold(nw!)}` : ""}.`,
        target: cost !== null ? `в поздней игре держать ${formatGold(cost)}+ золота на выкуп, когда решается база` : "в поздней игре держать золото на выкуп, когда решается база",
      });
    }
  }

  for (const f of keyFights) {
    facts.push(
      `${f.timeLabel}: драка${f.place ? ` (${f.place})` : ""} - твоя команда потеряла ${heroesRu(f.yourTeamDeaths)}, враг - ${f.enemyDeaths}${f.aegis ? "; у твоей команды был Aegis" : ""}${f.leadBefore !== null && f.leadAfter !== null ? `; перевес ${formatSigned(f.leadBefore)} -> ${formatSigned(f.leadAfter)}` : ""}; ты: ${f.yourPart}.`
    );
  }
  const teamBuybacks = team.flatMap((p) => (p.buyback_log ?? []).map((b) => ({ t: b.time, hero: getHeroName(p.hero_id) })));
  if ((kind === "throw" || kind === "stomp-loss" || kind === "close-loss") && match.duration >= (turbo ? LATE_GAME.turbo : LATE_GAME.normal)) {
    facts.push(
      teamBuybacks.length === 0
        ? "За всю игру никто в твоей команде не выкупился."
        : `Выкупы твоей команды: ${teamBuybacks.map((b) => `${b.hero} в ${time(b.t)}`).join(", ")}.`
    );
  }

  return {
    flow: {
      kind,
      headline: headline[kind],
      peakLead: peak,
      peakDeficit: trough ? { minute: trough.minute, gold: -trough.gold } : null,
      lead,
      keyFights,
      facts,
    },
    causes,
    strengths,
  };
}
