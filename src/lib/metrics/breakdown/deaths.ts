// Every death of the player, reviewed one by one the way a coach goes through
// a replay: who killed you and with what, where, who saw you, where the
// killers came from, who could have helped, what the death cost - and then
// whether it was a mistake and what the right move was in that exact spot.

import { getHeroName } from "../../constants";
import { formatGold, formatSigned, pluralRu } from "../../format";
import { listRu, secondsRu } from "../../coach/advice";
import { principleFor } from "../../coach/principles";
import { heroThreats, threatByName, type Threat } from "../../coach/threats";
import type { DeathReview, OpenDotaMatchPlayer } from "../../types";
import type { Ctx, DeathEvent } from "../matchAnalysis";
import { deathTimesOf } from "../gameFlow";
import { classifyZone } from "../mapZones";
import { positionAt, units } from "../positioning";

// How far back to look for where the killers came from.
const APPROACH_SECONDS = 25;
// Farther than this 25 seconds earlier: they walked over on purpose.
const FAR_UNITS = 2500;
const ISOLATED_UNITS = 2000;
// An enemy dying this close in time (and place) makes it a trade.
const TRADE_SECONDS = 10;

const POSITION_OF = { carry: 1, mid: 2, offlane: 3, support: 5 } as const;

function unitsLabel(u: number): string {
  return `${formatGold(Math.round(u / 100) * 100)} ед.`;
}

// Zone labels are relative to the player ("свой лес"); about someone else
// they read as that hero's own side, so they're turned to "твой".
function yourZone(label: string): string {
  return label.replace(/(?<!\p{L})свой(?!\p{L})/gu, "твой").replace(/(?<!\p{L})своя(?!\p{L})/gu, "твоя");
}

// "потеряла 1 героя / 3 героя / 5 героев".
function heroesRu(n: number): string {
  return `${n} ${pluralRu(n, ["героя", "героя", "героев"])}`;
}

// "погиб 1 герой / погибли 3 героя".
function diedRu(n: number): string {
  return `${n % 10 === 1 && n % 100 !== 11 ? "погиб" : "погибли"} ${n} ${pluralRu(n, ["герой", "героя", "героев"])}`;
}

interface Approach {
  hero: string;
  from: string;
  distance: number;
}

function trackOf(ctx: Ctx, p: OpenDotaMatchPlayer) {
  return ctx.tracks?.find((t) => t.heroId === p.hero_id && t.isRadiant === p.isRadiant);
}

// Which of the killers walked in from far away in the last 25 seconds.
function approaches(ctx: Ctx, d: DeathEvent, enemyIds: number[]): Approach[] {
  if (!ctx.tracks) return [];
  const spot = positionAt(trackOf(ctx, ctx.you), d.time);
  if (!spot) return [];
  return enemyIds.flatMap((id) => {
    const enemy = ctx.match.players.find((p) => p.hero_id === id && p.isRadiant !== ctx.you.isRadiant);
    const before = enemy ? positionAt(trackOf(ctx, enemy), d.time - APPROACH_SECONDS) : null;
    if (!enemy || !before) return [];
    const distance = units(before, spot);
    if (distance < FAR_UNITS) return [];
    return [{ hero: getHeroName(enemy.hero_id), from: yourZone(classifyZone(before.x, before.y, ctx.you.isRadiant).label), distance }];
  });
}

// "Держись дальше 1 300 ед. от Pudge (дальность Meat Hook)".
function distanceRule(hero: string, t: Threat | null): string | null {
  if (!t?.range) return null;
  return `Держись дальше ${formatGold(t.range)} ед. от ${hero} - это дальность ${t.name}${t.control ? ` (${t.control})` : ""}; ближе подходи, только когда эта способность потрачена${t.cooldown ? ` (перезарядка - ${t.cooldown} сек даже на максимальном уровне)` : ""}.`;
}

interface Reason {
  why: string;
  correct: string;
  example: string;
}

/**
 * Enemy heroes who died within 10 seconds of a death outside a teamfight (and
 * nearby, when positions are known): then it was a trade, not a pick-off.
 */
export function tradedFor(ctx: Ctx, d: DeathEvent): number {
  if (d.inFight) return 0;
  const enemies = ctx.match.players.filter((p) => p.isRadiant !== ctx.you.isRadiant);
  const youSpot = ctx.tracks ? positionAt(trackOf(ctx, ctx.you), d.time) : null;
  return enemies.filter((p) =>
    deathTimesOf(ctx.match, p).some((t) => {
      if (Math.abs(t - d.time) > TRADE_SECONDS) return false;
      if (!youSpot) return true;
      const there = positionAt(trackOf(ctx, p), t);
      return !there || units(there, youSpot) <= ISOLATED_UNITS;
    })
  ).length;
}

export function reviewDeaths(ctx: Ctx): DeathReview[] {
  const { match, you } = ctx;
  const youIndex = match.players.indexOf(you);
  const team = match.players.filter((p) => p.isRadiant === you.isRadiant);
  const teamDeaths = team.filter((p) => p !== you).map((p) => ({ p, times: deathTimesOf(match, p) }));
  const position = POSITION_OF[ctx.group];
  const lead = (t: number) => {
    const adv = match.radiant_gold_adv?.[Math.floor(t / 60)];
    return adv === undefined ? null : you.isRadiant ? adv : -adv;
  };

  return ctx.deaths.map((d): DeathReview => {
    const m = d.moment;
    const kind = m?.killer.kind ?? (d.killerHeroId !== null ? "hero" : /башн/.test(d.killer) ? "tower" : /крип/.test(d.killer) ? "creeps" : "other");
    const involved = m?.enemiesInvolved ?? (d.killerHeroId !== null ? [{ heroId: d.killerHeroId, name: d.killer }] : []);
    const helpers = involved.filter((e) => e.heroId !== d.killerHeroId).map((e) => e.name);
    const blow = m?.killingBlow ?? null;
    const place = d.zone?.label ?? null;
    const laning = d.time < ctx.bounds.laneEnd;
    const fight = d.inFight
      ? (match.teamfights ?? []).find((f) => d.time >= f.start - 15 && d.time <= f.end + 15 && (f.players[youIndex]?.deaths ?? 0) > 0)
      : undefined;
    let ourLosses = 0;
    let theirLosses = 0;
    if (fight) {
      match.players.forEach((p, i) => {
        const n = fight.players[i]?.deaths ?? 0;
        if (p.isRadiant === you.isRadiant) ourLosses += n;
        else theirLosses += n;
      });
    }
    const inWindow = (t: number) => fight !== undefined && t >= fight.start - 3 && t <= fight.end + 3;
    const alliesBefore = teamDeaths.filter((x) => x.times.some((t) => inWindow(t) && t < d.time)).length;
    const diedFirst = fight !== undefined && ourLosses >= 2 && alliesBefore === 0;

    // An enemy hero died right around the same moment: a trade, not a pick-off.
    const traded = d.traded ? tradedFor(ctx, d) : 0;

    const ally = ctx.nearestAllyAtDeath.get(d.time) ?? null;
    const came = kind === "hero" ? approaches(ctx, d, involved.map((e) => e.heroId)) : [];
    const ward = m?.enemyWard ?? null;
    const farming = m?.farmingLastHits ?? null;
    const flags = (m?.tags ?? []).map((t) => t.text);
    const tpOut = flags.includes("Пытался уйти через TP Scroll");
    const healLeft = flags.includes("Не использовал лечение");
    const tracked = flags.includes("Был под Track");
    const burst = flags.includes("Убит бурстом");

    // What the team lost while the player was dead.
    const back = d.time + Math.max(d.timeDead, 0);
    const towersLost = (match.objectives ?? []).filter(
      (o) => o.type === "building_kill" && o.key && o.key.includes("goodguys") === you.isRadiant && o.time >= d.time && o.time <= back + 5
    );
    const alliesDied = teamDeaths.filter((x) => x.times.some((t) => t > d.time + 3 && t <= back)).length;

    // ---- Facts ----
    const facts: string[] = [];
    if (kind === "hero") {
      facts.push(
        `Убил: ${d.killer}${blow ? ` (${blow})` : ""}${helpers.length > 0 ? `, вместе с ${listRu(helpers)}` : ""}.`
      );
    } else {
      facts.push(`Добил${kind === "creeps" ? "и" : kind === "tower" ? "а" : ""}: ${d.killer}${blow ? ` (${blow})` : ""}.`);
    }
    if (place) facts.push(`Место: ${place}${d.zone?.deepInEnemyTerritory ? " - глубоко на вражеской половине" : ""}.`);
    if (fight) {
      facts.push(
        `В тимфайте: твоя команда потеряла ${heroesRu(ourLosses)}, враг - ${theirLosses}${diedFirst ? "; ты погиб первым из команды" : alliesBefore > 0 ? `; до тебя ${diedRu(alliesBefore)} из команды` : ""}.`
      );
    } else {
      facts.push("Вне тимфайтов.");
    }
    if (ward) facts.push(`Под вражеским Observer Ward: его поставил ${ward.placedBy ?? "враг"} в ${ctx.time(ward.time)} (за ${secondsRu(d.time - ward.time)} до смерти).`);
    else if (m?.ownVision === true) facts.push("Место было под обзором твоей команды.");
    else if (m?.ownVision === false && kind === "hero") facts.push("Своего обзора на этом месте не было.");
    if (farming) facts.push(`Фармил: +${farming} добиваний за минуту до смерти.`);
    if (ally !== null && !d.inFight) facts.push(`Ближайший живой союзник был в ${unitsLabel(ally)} от тебя.`);
    for (const a of came) facts.push(`${a.hero} за ${APPROACH_SECONDS} сек до смерти: ${a.from}, в ${unitsLabel(a.distance)} от места смерти - к тебе шли издалека.`);
    if (tpOut) facts.push("Ты пытался уйти через TP Scroll, но не успел.");
    if (healLeft) facts.push("У тебя оставалось неиспользованное лечение.");
    if (tracked) facts.push("На тебе был Track - враг видел тебя всё это время.");
    if (burst) facts.push("Тебя убили бурстом - за доли секунды.");
    const cost = [
      d.timeDead > 0 ? `${secondsRu(d.timeDead)} в таверне` : null,
      d.goldLost > 0 ? `${formatGold(d.goldLost)} золота` : null,
    ].filter(Boolean);
    if (cost.length > 0) facts.push(`Цена: ${cost.join(", ")}${d.boughtBack ? "; ты выкупился" : ""}.`);
    const whileDead = [
      towersLost.length > 0 ? `${towersLost.length} ${pluralRu(towersLost.length, ["башню", "башни", "башен"])} (${towersLost.map((o) => ctx.time(o.time)).join(", ")})` : null,
      alliesDied > 0 ? heroesRu(alliesDied) : null,
    ].filter(Boolean);
    if (whileDead.length > 0) facts.push(`Пока ты был мёртв, твоя команда потеряла ${whileDead.join(" и ")}.`);
    const teamLead = lead(d.time);
    if (teamLead !== null && !laning) facts.push(`Перевес твоей команды в этот момент: ${formatSigned(teamLead)}.`);
    if (traded > 0) facts.push(`В те же секунды рядом погиб${traded > 1 ? "ли" : ""} ${heroesRu(traded)} врага - это размен.`);

    // ---- Verdict ----
    const fightWon = fight !== undefined && theirLosses > ourLosses;
    const verdict: DeathReview["verdict"] =
      kind === "creeps" || kind === "tower" ? "mistake" : fight ? (fightWon ? "trade" : "fight") : traded > 0 ? "trade" : "mistake";

    const killerThreat =
      d.killerHeroId !== null ? (threatByName(d.killerHeroId, blow) ?? heroThreats(d.killerHeroId)[0] ?? null) : null;
    const title = `${kind === "hero" ? `${d.killer}${blow ? ` (${blow})` : ""}${helpers.length > 0 ? ` + ${helpers.join(", ")}` : ""}` : d.killer}${place ? ` · ${place}` : ""}`;

    let reason: Reason | null = null;
    if (verdict === "mistake") {
      reason = mistakeReason(ctx, {
        d,
        kind,
        laning,
        place,
        involved: involved.map((e) => e.name),
        killerThreat,
        ward: ward ? { by: ward.placedBy ?? "враг", at: ctx.time(ward.time) } : null,
        farming,
        ally,
        came,
        tpOut,
        healLeft,
        tracked,
        position,
      });
    } else if (verdict === "fight") {
      reason = fightReason({
        diedFirst,
        alliesBefore,
        ourLosses,
        theirLosses,
        position,
        killer: kind === "hero" ? d.killer : null,
        threat: killerThreat,
        noVision: m?.ownVision === false,
        deep: Boolean(d.zone?.deepInEnemyTerritory),
        place,
      });
    }
    const costLine =
      verdict !== "trade" && (cost.length > 0 || whileDead.length > 0)
        ? ` Цена: ${[...cost, ...(whileDead.length > 0 ? [`за это время команда потеряла ${whileDead.join(" и ")}`] : [])].join(", ")}.`
        : "";

    return {
      time: d.time,
      timeLabel: ctx.time(d.time),
      verdict,
      title,
      facts,
      why: reason ? `${reason.why}${costLine}` : null,
      correct: reason?.correct ?? null,
      example: reason?.example ?? null,
    };
  });
}

function fightReason(a: {
  diedFirst: boolean;
  alliesBefore: number;
  ourLosses: number;
  theirLosses: number;
  position: number;
  killer: string | null;
  threat: Threat | null;
  noVision: boolean;
  deep: boolean;
  place: string | null;
}): Reason {
  if (a.diedFirst) {
    return {
      why: `Ты погиб первым из команды в драке, которую вы проиграли (${a.ourLosses}:${a.theirLosses}): с первых секунд команда дралась вчетвером.`,
      correct: principleFor("DIED_FIRST", a.position) ?? principleFor("DYING_IN_FIGHTS", a.position) ?? "",
      example: "Пример: в начале следующей драки встань позади своего инициатора и войди после того, как враг потратит контроль.",
    };
  }
  if (a.alliesBefore >= 2) {
    return {
      why: `Когда ты погиб, драка уже была проиграна: до тебя погибли ${heroesRu(a.alliesBefore)} из команды. Твоя смерть ничего не меняла - она только добавила врагу золота и времени.`,
      correct:
        "Когда двое союзников уже мертвы, а враги живы, - отступай, а не заходи в драку: живой ты защитишь башню и сохранишь золото, а следующая драка будет на равных.",
      example: "Пример: видишь, что двое твоих погибли в начале драки, - отойди к башне или в лес и дождись, пока они возродятся.",
    };
  }
  // Died mid-fight in a fight that wasn't won: what reached you, and where it was fought.
  const where = [
    a.deep ? `глубоко на вражеской половине (${a.place})` : null,
    a.noVision ? "там, где у твоей команды не было обзора" : null,
  ].filter(Boolean);
  const rule = a.killer ? distanceRule(a.killer, a.threat) : null;
  return {
    why: `Драка не была выиграна (${a.ourLosses}:${a.theirLosses}), и ты погиб в ней${a.killer ? ` от ${a.killer}${a.threat ? ` (${a.threat.name})` : ""}` : ""}${where.length > 0 ? ` - ${where.join(", ")}` : ""}. Каждая твоя смерть в драке - это меньше урона команды и золото врагу.`,
    correct: [
      rule,
      a.noVision ? "Драки, в которых враг видит вас, а вы его - нет, начинаются на его условиях: перед дракой ставь или проси вард там, куда идёт команда." : null,
      principleFor("DYING_IN_FIGHTS", a.position),
    ]
      .filter(Boolean)
      .join(" "),
    example: a.killer
      ? `Пример: в начале следующей драки найди глазами ${a.killer} и держись так, чтобы ${a.threat?.range ? `между вами было больше ${formatGold(a.threat.range)} ед.` : "до тебя нельзя было дотянуться первым"}, пока ${a.threat ? a.threat.name : `ключевая способность ${a.killer}`} не потрачена.`
      : "Пример: в следующей драке, как только HP падает ниже трети, - выходи из боя к своим.",
  };
}

function mistakeReason(
  ctx: Ctx,
  a: {
    d: DeathEvent;
    kind: string;
    laning: boolean;
    place: string | null;
    involved: string[];
    killerThreat: Threat | null;
    ward: { by: string; at: string } | null;
    farming: number | null;
    ally: number | null;
    came: Approach[];
    tpOut: boolean;
    healLeft: boolean;
    tracked: boolean;
    position: number;
  }
): Reason {
  const { d } = a;
  if (a.kind === "creeps" || a.kind === "tower") {
    return {
      why: `Тебя добил${a.kind === "tower" ? "а вражеская башня" : "и крипы вражеской волны"} - враг для этого ничего не сделал. Ты остался ${a.kind === "tower" ? "в зоне атаки башни" : "в волне"} с низким здоровьем.`,
      correct:
        "Следи за HP при каждом добивании: при трети здоровья отходи за свою волну и используй реген заранее. Под вражескую башню заходи, только пока она бьёт твоих крипов.",
      example: "Пример: HP меньше 30%, рядом вражеская волна или башня - не добивай последнего крипа, отойди.",
    };
  }

  const why: string[] = [];
  const correct: string[] = [];
  let example = "";
  const killer = d.killer;
  const many = a.involved.length >= 3;

  if (a.came.length > 0) {
    why.push(
      `Это был ганк: за ${APPROACH_SECONDS} секунд до смерти ${a.came.map((c) => `${c.hero} - ${c.from}`).join(", ")}, далеко от тебя, - к тебе шли специально.`
    );
    correct.push(
      "Когда вражеские герои уходят со своих линий или пропадают с миникарты, считай, что они идут к тебе: отходи к башне или к союзникам до того, как они появятся."
    );
  }
  if (a.ward) {
    why.push(`Ты стоял в радиусе вражеского Observer Ward (поставил ${a.ward.by} в ${a.ward.at}) - враги видели тебя и пришли заранее.`);
    correct.push(
      ctx.group === "support"
        ? "Сними этот вард Sentry Ward или обходи его: если тебя поймали в одной точке, там стоит обзор врага."
        : "Если тебя нашли в какой-то точке, там почти наверняка вражеский вард: попроси саппорта поставить туда Sentry Ward или фарми другое место."
    );
  }
  if (d.zone?.deepInEnemyTerritory) {
    why.push(`Это глубоко на вражеской половине (${a.place}): у врага там обзор и короткий путь, у тебя - длинный путь отхода.`);
    correct.push("На вражескую половину заходи только с командой или когда знаешь, где все пятеро врагов.");
  }
  if (many) {
    why.push(`На тебя пришли ${heroesRu(a.involved.length)} (${listRu(a.involved)}) - против такого в одиночку не выжить, ошибка случилась раньше: ты был один там, куда они могли прийти.`);
  }
  if (a.farming && a.ally !== null && a.ally >= ISOLATED_UNITS) {
    why.push(`Ты фармил (+${a.farming} добиваний за минуту до смерти), а ближайший союзник был в ${unitsLabel(a.ally)} - помочь было некому.`);
    correct.push("Фарми ближе к команде или под своими вардами, а дальние лагеря и линии бери, только когда враги показались на другой стороне карты.");
  } else if (a.ally !== null && a.ally >= ISOLATED_UNITS) {
    why.push(`Ближайший союзник был в ${unitsLabel(a.ally)} - помочь было некому.`);
    correct.push("Двигайся по карте рядом с союзниками или там, где стоят ваши варды.");
  } else if (a.farming) {
    why.push(`Тебя поймали во время фарма (+${a.farming} добиваний за минуту до смерти).`);
  }

  if (a.laning) {
    const rule = distanceRule(killer, a.killerThreat);
    if (!many && a.came.length === 0) {
      why.unshift(`На линии ${killer}${d.moment?.killingBlow ? ` добил тебя с помощью ${d.moment.killingBlow}` : " поймал тебя"}${a.involved.length > 1 ? ` вместе с ${listRu(a.involved.filter((n) => n !== killer))}` : ""}.`);
    }
    if (rule) correct.unshift(rule);
    correct.push(principleFor("EARLY_DEATHS", a.position) ?? "");
    example = a.killerThreat
      ? `Пример: на линии против ${killer}, когда ${a.killerThreat.name} не на перезарядке, а у тебя меньше половины HP, - стой за своими крипами${a.killerThreat.range ? ` дальше ${formatGold(a.killerThreat.range)} ед. от ${killer}` : ""} и добивай только безопасных крипов.`
      : `Пример: на линии против ${killer} при половине HP отходи к башне и пропускай опасных крипов.`;
  } else {
    if (correct.length === 0) correct.push(principleFor("PICKED_OFF", a.position) ?? "");
    example =
      a.involved.length > 0
        ? `Пример: в похожий момент следующей игры сначала посмотри на миникарту - где ${listRu(a.involved)}? ${a.involved.length === 1 ? `Если ${a.involved[0]} не видно` : "Если их не видно"} на линиях, не стой${a.place ? ` там, где ты погиб (${a.place})` : " один"}, а отойди к команде или своей башне.`
        : "Пример: в похожий момент следующей игры сначала посчитай врагов на миникарте и только потом иди дальше.";
  }

  if (a.tpOut) {
    why.push("Ты пытался уйти через TP Scroll, но телепорт прерывается любым контролем.");
    correct.push("TP Scroll спасает, только если ты нажал его до того, как враг подошёл; под ударами уходи ногами, за деревья или к союзнику.");
  }
  if (a.healLeft) {
    why.push("У тебя оставалось лечение, которое ты не использовал.");
    correct.push("Жми реген и Magic Wand, пока HP ещё есть, - не в последний момент.");
  }
  if (a.tracked) {
    why.push("На тебе был Track - враг видел каждый твой шаг.");
    correct.push("С Track на себе стой рядом с союзниками или у башни, пока он не спадёт.");
  }
  if (why.length === 0) {
    why.push(`Тебя поймали вне драки${a.place ? ` (${a.place})` : ""}: ты не обменялся ни на кого, а команда осталась вчетвером.`);
  }

  return {
    why: why.join(" "),
    correct: [...new Set(correct.filter(Boolean))].join(" "),
    example,
  };
}

/** One line for the aspect summary: how many deaths were avoidable. */
export function deathSummary(reviews: DeathReview[]): string {
  const mistakes = reviews.filter((r) => r.verdict === "mistake").length;
  const trades = reviews.filter((r) => r.verdict === "trade").length;
  if (reviews.length === 0) return "Ни одной смерти за игру.";
  return `${reviews.length} ${pluralRu(reviews.length, ["смерть", "смерти", "смертей"])}: ${mistakes} - ошибки, которых можно было избежать, ${reviews.length - mistakes - trades} - в проигранных или равных драках, ${trades} - размен в пользу команды.`;
}
