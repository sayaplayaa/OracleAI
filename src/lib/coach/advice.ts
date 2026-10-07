// The coach's explanation of each verified problem, written in code from the
// replay's own facts: why it cost the game something (in gold, time, waves,
// fights), what the right move was in that exact spot, and how it looks in
// the next game - with this game's heroes, times and numbers, not a generic
// rule. The rule itself (principles.ts) stays the base of "correct"; this
// adds the situation to it.

import { formatGold, pluralRu } from "../format";
import { principleFor, type CauseCode, type RoleGroup } from "./principles";
import type { Threat } from "./threats";

export interface Advice {
  // Why it's a mistake: the mechanism and what it cost in this game.
  why: string;
  // The right decision or move in that situation.
  correct: string;
  // A concrete scenario for the next game.
  example: string;
}

const POSITION_OF: Record<RoleGroup, number> = { carry: 1, mid: 2, offlane: 3, support: 5 };

function rule(code: CauseCode, group: RoleGroup): string {
  return principleFor(code, POSITION_OF[group]) ?? "";
}

export function timesRu(n: number): string {
  return `${n} ${pluralRu(n, ["раз", "раза", "раз"])}`;
}

export function secondsRu(n: number): string {
  return `${n} ${pluralRu(n, ["секунду", "секунды", "секунд"])}`;
}

function wavesRu(seconds: number): string {
  const n = Math.max(1, Math.round(seconds / 30));
  return `${n} ${pluralRu(n, ["волна", "волны", "волн"])} крипов`;
}

function fightsRu(n: number): string {
  return `${n} ${pluralRu(n, ["драка", "драки", "драк"])}`;
}

export function listRu(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
}

// Distances measured on the map are rounded; a spell's range is exact.
function units(n: number, exact = false): string {
  return `${formatGold(exact ? n : Math.round(n / 50) * 50)} ед.`;
}

// "где сейчас Lion?" / "где сейчас Lion и Pudge?" and what follows it.
function whereAre(names: string[]): { ask: string; unseen: string; until: string } {
  if (names.length === 1) {
    return { ask: `где сейчас ${names[0]}?`, unseen: `Если ${names[0]} не видно на миникарте`, until: `пока ${names[0]} не покажется на другой линии` };
  }
  return { ask: `где сейчас ${listRu(names)}?`, unseen: "Если их не видно на миникарте", until: "пока они не покажутся на другой линии" };
}

function join(...parts: (string | null | false | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" ");
}

// "держись дальше 1 300 ед. от Pudge (дальность Meat Hook) ...".
function keepDistance(hero: string, t: Threat | null): string | null {
  if (!t?.range) return null;
  return `Держись дальше ${units(t.range, true)} от ${hero} - это дальность ${t.name}${t.control ? ` (${t.control})` : ""} - и подходи ближе только после того, как эта способность потрачена${t.cooldown ? `: даже на максимальном уровне у неё перезарядка ${t.cooldown} сек` : ""}.`;
}

// ---- Laning ----

export interface KillerInfo {
  name: string;
  count: number;
  threat: Threat | null;
}

export function laneDeathsAdvice(a: {
  group: RoleGroup;
  count: number;
  deadSeconds: number;
  goldLost: number;
  laneEnd: string;
  killers: KillerInfo[];
  laneEnemies: string[];
}): Advice {
  const cost = [
    a.goldLost > 0 ? `${formatGold(a.goldLost)} золота` : null,
    a.deadSeconds > 0
      ? `${secondsRu(a.deadSeconds)} в таверне - это ≈${wavesRu(a.deadSeconds)}, с которых ты не получил ни золота, ни опыта`
      : null,
  ].filter(Boolean);
  const roleCost: Record<RoleGroup, string> = {
    carry: "Для керри это сдвигает первый ключевой предмет, а за ним - все драки середины игры.",
    mid: "Для мида это ещё и отданные руны и отставание по уровню в дуэли один на один.",
    offlane: "Для оффлейнера это отставание по уровню, а именно уровень решает, сможешь ли ты драться к 10-й минуте.",
    support: "Пока саппорт мёртв, его керри стоит на линии один против двоих - часто это вторая смерть подряд.",
  };
  const enemies = a.laneEnemies.length > 0 ? listRu(a.laneEnemies) : "враги";
  const main = [...a.killers].sort((x, y) => y.count - x.count)[0];
  const distance = main ? keepDistance(main.name, main.threat) : null;
  const laneRule: Record<RoleGroup, string> = {
    carry:
      "Стой за своими крипами, ближе к своей башне, и подходи к волне только для добивания. Разменивайся ударами, только когда рядом твой саппорт и у тебя больше HP. Если у тебя мало здоровья, а у врагов готов контроль, - отойди и бери опыт с расстояния: потерянный крип стоит дешевле смерти.",
    mid: "Держись на своей стороне реки, следи за маной вражеского мида и отходи к башне, как только с соседней линии пропадает герой: ганки на мид чаще всего приходят к 5-7 минуте.",
    offlane:
      "На оффлейне задача - выжить и получить уровни: стой на краю радиуса опыта, переагривай волну к своей башне, пулль крипов в большой лагерь и не иди в размен, если твой саппорт ушёл с линии.",
    support:
      "Не стой впереди своего керри ради харасса: стой сбоку от волны, вне дальности вражеского контроля, и выходи вперёд только вместе с керри, когда у вас обоих готовы заклинания.",
  };
  return {
    why: join(
      `Смерти на линии стоили тебе ${listRu(cost as string[]) || "времени и опыта"}.`,
      `Пока тебя не было, ${enemies} спокойно добивали крипов и давили на твою башню.`,
      roleCost[a.group]
    ),
    correct: join(
      main && main.count >= 2 ? `${main.name} убил тебя на линии ${timesRu(main.count)}.` : null,
      distance,
      laneRule[a.group]
    ),
    example: join(
      `В следующей игре: на линии против ${enemies} каждые несколько секунд смотри на своё HP и на то, где они стоят.`,
      main?.threat
        ? `Как только здоровья меньше половины, а ${main.name} рядом и ${main.threat.name} не на перезарядке, - отходи к башне и пропусти волну.`
        : "Как только здоровья меньше половины, а враги рядом, - отходи к башне и пропусти волну.",
      `Цель - дожить до ${a.laneEnd} ${a.count >= 2 ? "максимум с одной смертью" : "без смертей"}.`
    ),
  };
}

export function repeatKillerAdvice(a: { group: RoleGroup; hero: string; count: number; where: string; threat: Threat | null }): Advice {
  return {
    why: join(
      `${a.hero} убил тебя ${timesRu(a.count)} ${a.where}. Одна смерть - случайность, повторяющаяся - это одна и та же ситуация:`,
      a.threat
        ? `ты снова и снова оказывался в зоне досягаемости ${a.threat.name} без пути отхода.`
        : `ты снова и снова оказывался в зоне досягаемости ${a.hero} без пути отхода.`,
      "Враг это видит и продолжает ходить именно к тебе."
    ),
    correct: join(
      keepDistance(a.hero, a.threat) ?? `Против ${a.hero} считай дистанцию: пока ${a.hero} на виду, стой дальше, чем достают его способности.`,
      `Когда ${a.hero} пропадает с миникарты - отходи к союзнику или башне заранее, а свой побег или контроль держи на момент, когда ${a.hero} применит способность, а не трать раньше.`
    ),
    example: join(
      `Пример: ${a.hero} пропал с карты на 10+ секунд, а ты один у волны - отойди к башне и жди, пока ${a.hero} не покажется на другой линии.`,
      a.threat ? `Если ${a.hero} вышел к тебе - сначала дай потратить ${a.threat.name}, и только потом отвечай.` : null
    ),
  };
}

export function csDeficitAdvice(a: {
  group: RoleGroup;
  you: number;
  them: number;
  at: string;
  counterpart: string;
  earned: [number, number] | null;
  ideal: number | null;
  worst: { from: string; to: string; you: number; them: number; died: boolean } | null;
  firstCheckpoint: { at: string; them: number } | null;
}): Advice {
  const share = a.ideal ? Math.round((a.you / a.ideal) * 100) : null;
  const how: Record<RoleGroup, string> = {
    carry:
      "Держи волну у своей башни переагром (ударь вражеского героя и отойди - вражеские крипы пойдут за тобой), чтобы враги не могли подойти к тебе без риска. Добивай каждого крипа, а не только удобных; если тебя зонируют, бери крипов, которые сами доходят до башни, а с 5-6 уровня забирай ближний лагерь между волнами.",
    mid: `Стой на своей стороне реки, добивай каждого крипа и под давлением отходи к башне - там добивать безопаснее. Сравнивай свой счёт с ${a.counterpart} каждую минуту: если отстаёшь, не иди ганкать, пока не выровнял фарм.`,
    offlane:
      "На оффлейне волна должна стоять у твоей башни: пулль крипов в большой лагерь, когда волна уходит к вражеской вышке, и добивай под своей башней, где тебя не достают.",
    support: "Добивания - работа кор-героев; саппорту важнее, чтобы их было много у керри.",
  };
  return {
    why: join(
      `${a.you} добиваний против ${a.them} у ${a.counterpart} на ${a.at}.`,
      a.earned ? `К этому моменту ${a.counterpart} заработал ${formatGold(a.earned[1])} золота, ты - ${formatGold(a.earned[0])}.` : null,
      a.ideal && share !== null
        ? `За это время на линию пришло около ${a.ideal} вражеских крипов (по 4 каждые 30 секунд) - ты добил ${share}% из них.`
        : null,
      a.worst
        ? `Больше всего ты упустил между ${a.worst.from} и ${a.worst.to}: +${a.worst.you} добиваний у тебя против +${a.worst.them} у ${a.counterpart}${a.worst.died ? " - в это окно ты погиб" : ""}.`
        : null,
      a.group === "carry"
        ? "Каждый недобитый крип отодвигает первый предмет, а от него зависит, когда ты сможешь фармить лес и драться."
        : "Каждый недобитый крип отодвигает предметы, на которых строится твоя игра."
    ),
    correct: how[a.group],
    example: join(
      "В следующей игре смотри на счётчик добиваний каждую минуту.",
      a.firstCheckpoint ? `Цель - ${a.firstCheckpoint.them}+ к ${a.firstCheckpoint.at} и ${a.them}+ к ${a.at}, как у ${a.counterpart}.` : `Цель - ${a.them}+ к ${a.at}, как у ${a.counterpart}.`,
      "Если к 5:00 отстаёшь больше чем на 5 добиваний - перестань разменивать удары и думай только о добиваниях."
    ),
  };
}

export function xpDeficitAdvice(a: {
  group: RoleGroup;
  at: string;
  levels: [number, number];
  counterpart: string;
  six: [string | null, string | null];
  deaths: number;
}): Advice {
  const [mine, theirs] = a.levels;
  return {
    why: join(
      mine < theirs ? `На ${a.at} у тебя ${mine} уровень, у ${a.counterpart} - ${theirs}.` : `На ${a.at} у ${a.counterpart} заметно больше опыта.`,
      a.six[0] || a.six[1]
        ? `6 уровень (ультимейт): ты - ${a.six[0] ?? "не дошёл до него на линии"}, ${a.counterpart} - ${a.six[1] ?? "не дошёл на линии"}.`
        : null,
      `Уровень - это способности: в каждой стычке после этого ${a.counterpart} сильнее тебя.`,
      a.deaths > 0 ? `Твои смерти на линии (${a.deaths}) ещё и отдали врагу опыт за убийство.` : null,
      "Опыт даёт каждый вражеский крип, умерший рядом с тобой, - даже если его добил не ты. Отставание по опыту значит, что ты не стоял у волны: был мёртв, ушёл с линии или стоял слишком далеко."
    ),
    correct:
      "До 6 уровня не уходи с линии без чёткой цели (руна, верный ганк). Если тебя зажали и добивать не получается - стой позади своих крипов в радиусе получения опыта, но вне дальности вражеских заклинаний. Смерть на линии отдаёт врагу опыт и забирает его у тебя - это самое дорогое, что можно потерять в первые 10 минут.",
    example: join(
      `Пример: ${a.counterpart} давит, добивать не получается - всё равно стой у волны и получай опыт, а при первой возможности отведи волну к своей башне.`,
      a.six[1] ? `Цель - 6 уровень не позже ${a.six[1]}, как у ${a.counterpart}.` : null
    ),
  };
}

export function gapOpenedAdvice(a: {
  from: string;
  to: string;
  before: string;
  after: string;
  counterpart: string;
  deaths: string[];
  lastHits: [number, number] | null;
}): Advice {
  return {
    why: join(
      `Между ${a.from} и ${a.to} разрыв с ${a.counterpart} изменился с ${a.before} до ${a.after}.`,
      a.lastHits ? `Добивания за эти 2 минуты: ты +${a.lastHits[0]}, ${a.counterpart} +${a.lastHits[1]}.` : null,
      a.deaths.length > 0
        ? `В это же окно ты погиб (${listRu(a.deaths)}) - смерть и время в таверне и стали этим разрывом.`
        : `Смертей в это окно не было - значит, ты не фармил, пока ${a.counterpart} фармил: ушёл с линии, стоял без добиваний или волна стояла у вражеской башни.`,
      "Это не постепенное отставание, а один эпизод - а значит, его можно было не допустить."
    ),
    correct:
      "После неудачного эпизода не пытайся сразу «отыграться»: вернись на линию, отведи волну к своей башне и добивай безопасно. Догоняют не дракой один на один, а следующими тремя волнами без потерь.",
    example: `Пример: снова оказавшись позади на линии, не иди за волной к вражеской башне - дождись, пока она придёт к твоей, и добей её там.`,
  };
}

// ---- Deaths ----

export function seenByWardAdvice(a: { group: RoleGroup; deaths: { time: string; by: string; placedAt: string; age: number }[] }): Advice {
  const oldest = [...a.deaths].sort((x, y) => y.age - x.age)[0];
  return {
    why: join(
      `Observer Ward видит на 1 600 единиц вокруг. ${a.deaths.map((d) => `В ${d.time} ты погиб в радиусе варда, который поставил ${d.by} в ${d.placedAt}`).join("; ")}.`,
      "Враги видели, куда ты идёшь, и пришли заранее - это не случайная встреча, а ганк по обзору.",
      oldest && oldest.age >= 60 ? `Вард, под которым ты погиб в ${oldest.time}, стоял уже ${secondsRu(oldest.age)} - времени его заметить было достаточно.` : null
    ),
    correct:
      a.group === "support"
        ? "Носи Sentry Ward и Dust of Appearance и снимай вражеские варды на точках, где ходишь сам. Свои варды ставь, когда врагов рядом нет, и не возвращайся туда, где тебя уже видели."
        : "Если тебя нашли в каком-то месте, там почти наверняка вражеский вард: не фарми там, пока саппорт не поставит Sentry Ward, или поставь его сам. Фарми там, где стоят ваши варды, а к линиям ходи через свою половину.",
    example: `Пример: ${a.deaths[0].by} поставил вард в ${a.deaths[0].placedAt}. В следующей игре, если враги приходят к тебе подозрительно быстро, - поставь Sentry Ward у своей точки фарма, прежде чем возвращаться туда.`,
  };
}

export function creepTowerDeathAdvice(a: { deaths: string[] }): Advice {
  return {
    why: `${listRu(a.deaths)} - ни один вражеский герой ничего не сделал, а ты потерял золото и время в таверне. Так бывает, когда во время добивания не смотришь на своё здоровье.`,
    correct:
      "Следи за HP при каждом добивании: при трети здоровья отходи за свою волну и используй реген заранее. Под вражескую башню заходи, только пока она бьёт твоих крипов, и выходи до того, как они умрут.",
    example:
      "Пример: HP меньше 30%, рядом вражеская волна или башня - не добивай последнего крипа, отойди. Крип стоит около 40 золота, смерть - сотни золота и полминуты без фарма.",
  };
}

export interface PickoffInfo {
  time: string;
  place: string | null;
  allyUnits: number | null;
  enemies: string[];
  farming: boolean;
  deep: boolean;
}

export function pickedOffAdvice(a: { group: RoleGroup; deaths: PickoffInfo[]; deadSeconds: number; phase: string }): Advice {
  const isolated = a.deaths.filter((d) => d.allyUnits !== null && d.allyUnits >= 2000);
  const farming = a.deaths.filter((d) => d.farming).length;
  const detail = a.deaths
    .map(
      (d) =>
        `${d.time}${d.place ? ` - ${d.place}` : ""}${d.enemies.length > 1 ? `, против ${d.enemies.length} врагов (${listRu(d.enemies)})` : d.enemies.length === 1 ? `, убийца - ${d.enemies[0]}` : ""}${d.allyUnits !== null ? `, ближайший союзник в ${units(d.allyUnits)} от тебя` : ""}${d.farming ? ", во время фарма" : ""}`
    )
    .join("; ");
  const where: Record<RoleGroup, string> = {
    carry:
      "Фарми ту часть карты, где стоят ваши варды и куда успеет команда: свой лес, свою сторону линии. Перед тем как зайти в лагерь или на дальнюю линию, посмотри на миникарту: если не видно трёх и больше вражеских героев, они, скорее всего, идут к тебе - иди к союзникам или к башне. Держи TP Scroll, чтобы уйти до того, как тебя поймают.",
    mid: "Между ганками держись ближе к команде и не ходи через реку один без обзора. Перед руной или лагерем на чужой стороне проверь, кого из врагов не видно, и иди туда, только если знаешь, где они.",
    offlane:
      "Оффлейнер погибает в одиночку, когда фармит пустую линию далеко от команды. Держись на шаг позади своей команды, фарми там, откуда успеешь вернуться, и уходи, как только пропадают враги.",
    support:
      "Саппорт, пойманный один, теряет вард, заряды спасения и драку. Ходи с кор-героем или с обзором, ставь глубокие варды только вместе с союзником или когда знаешь, где враги.",
  };
  return {
    why: join(
      `Тебя поймали ${timesRu(a.deaths.length)} вне драк в ${a.phase}: ${detail}.`,
      a.deadSeconds > 0 ? `Всего ${secondsRu(a.deadSeconds)} в таверне.` : null,
      "Такая смерть ничего не даёт команде: ты не обменялся ни на кого, а враг получает время на башню, Roshan или твой лес.",
      isolated.length === 0
        ? null
        : isolated.length === a.deaths.length
          ? `${a.deaths.length > 1 ? "Каждый раз рядом" : "Рядом"} не было ни одного союзника - помочь тебе было некому.`
          : `${isolated.length} из ${a.deaths.length} раз рядом не было ни одного союзника - помочь тебе было некому.`
    ),
    correct: join(
      where[a.group],
      farming > 0 ? `${farming === a.deaths.length ? "Каждый раз" : `${timesRu(farming)} из ${a.deaths.length}`} тебя поймали во время фарма - значит, ты фармил место, которое враг видел или мог быстро достать.` : null
    ),
    example: join(
      `Пример: в ${a.deaths[0].time} ты погиб${a.deaths[0].place ? ` (${a.deaths[0].place})` : ""}.`,
      a.deaths[0].enemies.length > 0
        ? (() => {
            const w = whereAre(a.deaths[0].enemies);
            return `В похожий момент следующей игры спроси себя: ${w.ask} ${w.unseen} - фарми ближе к своей башне или рядом с союзником, ${w.until}.`;
          })()
        : "В похожий момент следующей игры сначала посчитай врагов на миникарте и только потом иди фармить."
    ),
  };
}

export function deepDeathAdvice(a: { deaths: { time: string; place: string }[] }): Advice {
  return {
    why: `Ты погиб глубоко на вражеской половине: ${a.deaths.map((d) => `${d.time} - ${d.place}`).join("; ")}. Там у врага обзор, башни рядом и короткий путь для всей команды, а у тебя - длинный путь отхода и никакой помощи.`,
    correct:
      "На вражескую половину заходи только всей командой: после выигранной драки, когда знаешь, где все пятеро врагов, или под своим обзором. Нужно фармить - фарми свою половину карты, а вражеский лес бери только когда враги показались на другой стороне.",
    example: "Пример: прежде чем идти во вражеский лес, посчитай врагов на миникарте. Видно меньше трёх - не заходи.",
  };
}

export function deadTimeAdvice(a: { seconds: number; share: number; phase: string; picked: number }): Advice {
  return {
    why: `В ${a.phase} ты провёл мёртвым ${secondsRu(a.seconds)} - ${a.share}% фазы. Всё это время команда играла вчетвером, а ты не фармил и не получал опыт. Время возрождения растёт с уровнем, поэтому чем дальше игра, тем дороже каждая смерть.`,
    correct: join(
      a.picked > 0 ? `Начни со смертей вне драк (${a.picked} в этой фазе): их проще всего убрать - они не зависят от того, как играет команда.` : null,
      "В драке выходи из боя, когда HP меньше трети, а не пытайся добить врага ценой своей жизни."
    ),
    example: `Цель на следующую игру - меньше 10% ${a.phase === "мидгейме" ? "мидгейма" : "лейтгейма"} мёртвым (в этой игре - ${a.share}%).`,
  };
}

// ---- Fights ----

export function absentAdvice(a: {
  group: RoleGroup;
  took: number;
  total: number;
  missed: { time: string; where: string | null }[];
  tp: [number, number] | null;
  counterpart: string;
}): Advice {
  const first = a.missed[0];
  const go: Record<RoleGroup, string> = {
    carry: "сразу телепортироваться к ближайшей к драке башне, а не доделывать лагерь",
    mid: "идти к команде заранее, как только она собирается, и не уходить в дальний лес",
    offlane: "быть рядом с командой до начала драки - инициатор, которого нет, не начнёт драку",
    support: "идти к команде заранее, а не ставить варды в другом конце карты",
  };
  return {
    why: join(
      `Ты участвовал в ${a.took} из ${a.total} драк этой фазы.`,
      `Пропущенные: ${a.missed.map((m) => `${m.time}${m.where ? ` (ты был: ${m.where})` : ""}`).join("; ")}.`,
      "Драка без тебя - это четверо против пятерых: команда теряет героев и башни, и твоё золото этого уже не вернёт."
    ),
    correct: join(
      "Всегда держи TP Scroll и телепортируйся к драке, как только видишь её начало на миникарте.",
      a.tp ? `За игру ты использовал TP Scroll ${timesRu(a.tp[0])}, ${a.counterpart} - ${timesRu(a.tp[1])}.` : null,
      "Фарми ту сторону карты, откуда успеешь дойти до команды за 10-15 секунд, а перед дальним лагерем проверь, не собирается ли команда драться."
    ),
    example: first
      ? `Пример: в ${first.time} началась драка${first.where ? `, а ты был ${first.where}` : ""}. Правильный ход - ${go[a.group]}.`
      : `Пример: увидел драку на миникарте - ${go[a.group]}.`,
  };
}

export function fightDamageAdvice(a: { group: RoleGroup; you: string; them: string; counterpart: string; fights: number }): Advice {
  return {
    why: `В поздних драках ты наносил в среднем ${a.you} урона по героям за бой, ${a.counterpart} - ${a.them} (за ${fightsRu(a.fights)}). Кор-герой без урона в драке - это пятеро против четырёх. Обычно причина одна из трёх: ты погибал в начале драки, приходил, когда она уже решилась, или бил цель, которую нельзя убить.`,
    correct: rule("FIGHT_DAMAGE_GAP", a.group),
    example:
      "Пример: в следующей драке не входи первым - подожди 1-2 секунды, пока враг потратит контроль на инициатора, затем бей ближайшую цель, которую можешь убить, и не прекращай атаковать, пока жив.",
  };
}

export function dyingInFightsAdvice(a: { group: RoleGroup; died: number; took: number; times: string[] }): Advice {
  return {
    why: `Ты погиб в ${a.died} из ${a.took} поздних драк, в которых участвовал (${listRu(a.times)}). В поздней игре возрождение - это минута и больше: драку после твоей смерти команда доигрывает без тебя, а враг успевает забрать постройку.`,
    correct: rule("DYING_IN_FIGHTS", a.group),
    example:
      "Пример: в следующей драке, как только HP падает ниже трети, - выходи из боя к своим, даже если враг почти мёртв. Живой ты нанесёшь больше урона во второй половине драки.",
  };
}

export function noLateKillsAdvice(a: { group: RoleGroup; deaths: number; lastKill: string | null }): Advice {
  return {
    why: `За весь лейтгейм у тебя нет ни одного убийства${a.lastKill ? ` (последнее - в ${a.lastKill})` : ""}, зато ${timesRu(a.deaths)} погиб ты. Значит, ты либо приходил в драку, когда она уже решилась, либо погибал раньше, чем успевал нанести урон.`,
    correct: rule("NO_LATE_KILLS", a.group),
    example: "Пример: собирайся с командой к таймингу цели (Roshan, пуш) за 20-30 секунд до драки, а не приходи после её начала.",
  };
}

export function diedBeforeFightAdvice(a: { group: RoleGroup; cases: { death: string; gap: number; lost: number; killed: number }[] }): Advice {
  return {
    why: join(
      a.cases
        .map((c) => `Ты погиб в ${c.death}, и через ${secondsRu(c.gap)} команда начала драку без тебя - вы потеряли ${c.lost}, враг - ${c.killed}.`)
        .join(" "),
      "Пять против четырёх - почти всегда проигранная драка, а ты в ней уже ничего не мог сделать."
    ),
    correct: rule("DIED_BEFORE_FIGHT", a.group),
    example:
      "Пример: команда стоит у Roshan, пушит или ждёт врагов - не иди фармить в другую сторону карты один. Подходи к команде через свою половину и держи TP Scroll.",
  };
}

export function diedFirstAdvice(a: { group: RoleGroup; times: string[] }): Advice {
  const what: Record<RoleGroup, string> = {
    carry: "твой урон так и не попал в бой",
    mid: "твой бёрст так и не попал в бой",
    offlane: "твоя инициация так и не случилась",
    support: "твои контроль и спасение так и не попали в бой",
  };
  return {
    why: `В драках ${listRu(a.times)} первым из команды погибал ты. Первая смерть в драке - это пять против четырёх с первых секунд: ${what[a.group]}.`,
    correct: rule("DIED_FIRST", a.group),
    example:
      a.group === "offlane"
        ? "Пример: прыгай, только когда видишь союзников рядом и у них готовы заклинания - если команда в 1500+ единиц позади, жди."
        : "Пример: в начале следующей драки найди своего инициатора и стой позади него - пусть враг потратит контроль на него, потом входи сам.",
  };
}

export function frontPositioningAdvice(a: { group: RoleGroup; times: string[] }): Advice {
  return {
    why: `В начале драк ${listRu(a.times)} ты стоял ближе всех из команды к врагу - и погибал в них. Враг бьёт того, до кого может дотянуться первым: стоять впереди - значит самому выбрать себя целью.`,
    correct: rule("FRONT_POSITIONING", a.group),
    example: "Пример: перед следующей дракой посмотри, кто из команды стоит ближе к врагу. Если это ты (и ты не инициатор) - отойди за союзников и войди после первого контроля.",
  };
}

// ---- Farm and economy ----

export function lostNetWorthAdvice(a: {
  group: RoleGroup;
  change: number;
  before: string;
  after: string;
  counterpart: string;
  phase: string;
  deaths: number;
  income: [number, number] | null;
}): Advice {
  return {
    why: join(
      `За ${a.phase.replace(/е$/, "")} ты отстал от ${a.counterpart} ещё на ${formatGold(a.change)} нетворса (${a.before} -> ${a.after}).`,
      a.income ? `${a.counterpart} зарабатывал ${formatGold(a.income[1])} золота в минуту, ты - ${formatGold(a.income[0])}.` : null,
      a.deaths > 0
        ? `Твои смерти в этой фазе (${a.deaths}) - большая часть разрыва: каждая стоит золота и времени без фарма, а врагу даёт золото за убийство.`
        : "Смертей почти не было - значит, разрыв в скорости фарма: волны, которые ты пропустил, и лагеря, которые не взял."
    ),
    correct: rule("SLOW_FARM", a.group),
    example: "Пример: после каждой драки сразу смотри на миникарту - какая линия без присмотра и какой лагерь ближе всего. Иди туда, а не стой на месте.",
  };
}

export function slowFarmAdvice(a: { group: RoleGroup; you: number; them: number; counterpart: string; window: string; goal: number }): Advice {
  return {
    why: `С ${a.window} ты зарабатывал ${formatGold(a.you)} золота в минуту, ${a.counterpart} - ${formatGold(a.them)}. Разница в ${formatGold(a.them - a.you)} в минуту за 10 минут - это целый ключевой предмет, который будет у ${a.counterpart}, а у тебя нет.`,
    correct: rule("SLOW_FARM", a.group),
    example: `Цель: ${formatGold(a.goal)}+ золота в минуту в этой фазе - половина пути до ${a.counterpart}. Для этого между драками никогда не стой: волна, лагерь, следующая волна.`,
  };
}

export function idleFarmAdvice(a: { group: RoleGroup; ranges: string[]; minutes: number; gpm: number | null }): Advice {
  return {
    why: join(
      `Минуты, когда ты был жив, не дрался и почти не добивал (меньше 3 добиваний за минуту): ${listRu(a.ranges)} - всего ${a.minutes} мин.`,
      a.gpm ? `При твоём темпе в остальное время (${formatGold(a.gpm)} золота в минуту) это ≈${formatGold(a.gpm * a.minutes)} золота, которых тебе не хватило.` : null
    ),
    correct: rule("IDLE_FARM", a.group),
    example: "Пример: закончил волну - сразу решай, что дальше: ближайший лагерь в своём лесу или волна на соседней линии. Если идёшь к команде - фарми по пути.",
  };
}

// ---- Items and skills ----

export function lateItemAdvice(a: { item: string; time: string; metaTime: string; delta: string; fights: number; deaths: number }): Advice {
  return {
    why: join(
      `${a.item} собран в ${a.time}, а обычно его собирают к ${a.metaTime} - на ${a.delta} мин позже.`,
      a.fights > 0 ? `За это время прошло ${fightsRu(a.fights)} - ты дрался в них без предмета, на который рассчитан герой.` : null,
      a.deaths > 0 ? `Смерти до покупки (${a.deaths}) отодвинули его сильнее всего.` : null,
      "Вместе с ним сдвигается и каждый следующий предмет."
    ),
    correct:
      "Копи на ключевой предмет без лишних покупок по дороге, фарми без перерывов и не умирай, пока он не куплен: смерть - это и потерянное золото, и время без фарма. Если драка начинается за 1-2 минуты до предмета - дофарми его рядом с командой, а не лезь в бой без него.",
    example: `Цель: ${a.item} к ~${a.metaTime}.`,
  };
}

export function noBkbAdvice(a: { hero: string; metaTime: string | null; deaths: string[]; disablers: string[] }): Advice {
  return {
    why: join(
      `Black King Bar - один из основных предметов ${a.hero} на этой позиции${a.metaTime ? ` (обычно к ${a.metaTime})` : ""}, а у тебя его не было до конца игры.`,
      a.disablers.length > 0 ? `У врага был контроль (${listRu(a.disablers)}), и без неуязвимости к заклинаниям ты погибал в драках: ${listRu(a.deaths)}.` : `Без него ты погибал в драках: ${listRu(a.deaths)}.`
    ),
    correct: rule("NO_BKB", "carry"),
    example: "Пример: если в драках тебя дважды убили под контролем - следующий предмет BKB, даже если он не самый «сильный» по урону.",
  };
}

export function ultLateAdvice(a: { ult: string; level: number; time: string | null }): Advice {
  const lost = a.level - 6;
  return {
    why: `${a.ult} - ультимейт твоего героя - взят на ${a.level} уровне${a.time ? ` (~${a.time})` : ""}, а был доступен на 6-м. ${lost} ${pluralRu(lost, ["уровень", "уровня", "уровней"])} ты играл без самой сильной своей способности.`,
    correct: rule("ULT_LATE", "carry"),
    example: `Цель: ${a.ult} на 6 уровне, второй уровень - на 12, третий - на 18.`,
  };
}

export function fewTpAdvice(a: { you: number; them: number; counterpart: string; missed: number }): Advice {
  return {
    why: join(
      `За игру ты использовал TP Scroll ${timesRu(a.you)}, ${a.counterpart} - ${timesRu(a.them)}.`,
      a.missed > 0 ? `При этом ты пропустил ${fightsRu(a.missed)}.` : null,
      "Без TP ты приходишь к драке пешком - к её концу - и не можешь спасти башню на другой стороне карты."
    ),
    correct: rule("FEW_TP", "carry"),
    example: "Пример: TP всегда в слоте, докупай сразу после использования. Увидел драку или атаку на башню - TP к ближайшей башне сразу, а не после лагеря.",
  };
}

export function runeAdvice(a: { you: number; them: number; counterpart: string; until: string }): Advice {
  return {
    why: `Руны силы до ${a.until}: ты взял ${a.you}, ${a.counterpart} - ${a.them}. Каждая руна ${a.counterpart} - это ганк на соседней линии или выигранный размен с тобой, а для тебя - упущенная возможность сделать то же самое.`,
    correct: rule("RUNE_CONTROL", "mid"),
    example:
      "Пример: за 15 секунд до чётной минуты (5:45, 7:45, 9:45) запушь волну и встань у точки руны. Если вражеский мид уже там и у тебя меньше HP - не дерись, а иди ко второй точке или к своей волне.",
  };
}

// ---- Vision ----

export function wardsDewardedAdvice(a: { dewarded: number; total: number; by: string[] }): Advice {
  return {
    why: `Враг снял ${a.dewarded} из ${a.total} твоих Observer Ward (снимали ${listRu(a.by)}). Снятый вард - это ноль обзора и подсказка врагу, где ты ходишь; часто тот, кто снимает вард, заодно ловит рядом саппорта.`,
    correct: rule("WARDS_DEWARDED", "support"),
    example: "Пример: если вард на одной и той же точке сняли дважды, в следующий раз поставь его в 300-400 единиц в стороне - он видит почти то же самое, но не там, где его ищут.",
  };
}

export function noVisionAdvice(a: { placed: number; window: string; expected: number }): Advice {
  return {
    why: `Ты поставил ${a.placed} ${pluralRu(a.placed, ["вард", "варда", "вардов"])} за ${a.window}, хотя за это время их можно было поставить минимум ${a.expected}. Без обзора команда не видит, куда идут враги, и драки начинаются на их условиях.`,
    correct: rule("NO_VISION", "support"),
    example: "Пример: перед тем как команда пойдёт на Roshan или башню, поставь Observer Ward у этой цели заранее, а не в момент драки.",
  };
}

// ---- The whole game ----

export function leadNotConvertedAdvice(a: { lead: string; at: string; taken: number; minutes: number }): Advice {
  return {
    why: `С перевесом ${a.lead} на ${a.at} твоя команда за следующие ${a.minutes} мин. снесла ${a.taken} ${pluralRu(a.taken, ["постройку", "постройки", "построек"])}. Золото само не ломает трон: каждая минута фарма вместо давления дала врагу время собрать предметы для обороны.`,
    correct: rule("LEAD_NOT_CONVERTED", "carry"),
    example: "Пример: команда выиграла драку и ведёт - сразу иди с ней на ближайшую башню, а не в лес. Две-три постройки после каждой выигранной драки - и перевес превращается в победу.",
  };
}

export function lostFightEnemySideAdvice(a: { fights: string[] }): Advice {
  return {
    why: `Имея перевес, твоя команда проиграла драки на чужой половине: ${a.fights.join("; ")}. Там у врага обзор и башни, а каждая смерть героя ведущей команды даёт отстающей бонусное золото - тем больше, чем богаче погибший.`,
    correct: rule("LOST_FIGHT_ENEMY_SIDE", "carry"),
    example: "Пример: вы впереди - ставьте варды у своей цели (Roshan, башня под вашей волной) и ждите, пока враг придёт к вам, а не ищите драку в его лесу.",
  };
}

export function aegisWastedAdvice(a: { fights: string[] }): Advice {
  return {
    why: `С Aegis твоя команда проиграла драку в ${listRu(a.fights)}. Aegis даёт 5 минут на постройки; потратив его в погоне, команда остаётся и без него, и без построек.`,
    correct: rule("AEGIS_WASTED", "carry"),
    example: "Пример: взяли Roshan - сразу всей командой к ближайшей вражеской башне вместе с волной крипов, без погони за героями в туман.",
  };
}

export function noBuybackAdvice(a: { time: string; fallen: string; cost: number | null }): Advice {
  return {
    why: join(
      `В ${a.time} ты погиб, и в следующие 2 минуты ${a.fallen}, а выкупа не было.`,
      a.cost !== null ? `Выкуп стоил ~${formatGold(a.cost)} золота.` : null,
      "Когда решается база, выкуп - единственный способ вернуться в драку вовремя."
    ),
    correct: rule("NO_BUYBACK", "carry"),
    example: a.cost !== null ? `Цель: после 30-й минуты всегда держи ${formatGold(a.cost)}+ золота на выкуп.` : "Цель: после 30-й минуты всегда держи золото на выкуп.",
  };
}

export function buildingPressureAdvice(a: { you: string; them: string; counterpart: string }): Advice {
  return {
    why: `Урон по башням за игру: ты ${a.you}, ${a.counterpart} - ${a.them}. Игру выигрывает тот, кто ломает базу; когда кор-герой не бьёт постройки, враг получает время собраться и отбиться.`,
    correct: rule("LOW_BUILDING_PRESSURE", "carry"),
    example: "Пример: команда убила двоих врагов - не возвращайся в лес, а иди к ближайшей вражеской башне: 30-40 секунд без двух врагов достаточно, чтобы её сломать.",
  };
}
