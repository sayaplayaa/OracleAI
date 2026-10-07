import { getAllItems } from "../constants";
import { extractNumbers, formatGold, formatMatchTime } from "../format";
import { getHeroAbilityKit } from "../heroAbilities";
import type {
  CoachFinding,
  CoachPhaseReport,
  CoachReport,
  MatchAnalysis,
  PhaseAnalysis,
  PhaseId,
  PhaseVerdict,
} from "../types";
import { GAME_PRINCIPLES, roleProfileFor } from "./roles";

const POSITION_SOURCE_NOTE: Record<MatchAnalysis["positionSource"], string> = {
  stratz: "позиция подтверждена классификатором STRATZ для этого матча",
  opendota: "позиция по оценке OpenDota",
  "lane-estimate": "позиция оценена по линии и фарму, поэтому она приблизительная",
};

const VERDICT_RU: Record<PhaseVerdict, string> = {
  won: "ВЫИГРАНА",
  even: "НАРАВНЕ",
  lost: "ПРОИГРАНА",
};

export function buildMatchSystemPrompt(analysis: MatchAnalysis): string {
  const role = roleProfileFor(analysis.position);
  return `Ты - тренер по Dota 2, который разбирает один матч одного игрока так, как топовый тренер разбирает запись игры: находишь решения, из-за которых была проиграна каждая фаза, и говоришь, что делать иначе.

ЯЗЫК: пиши весь отчёт только на русском языке. Названия НЕ переводи и не транслитерируй: имена героев, способностей, предметов и юнитов пиши латиницей ровно так, как они даны в фактах (Anti-Mage, Black King Bar, Arcane Orb, Roshan, Observer Ward, Sentry Ward, Smoke of Deceit, TP Scroll), а не «Антимаг», «БКБ», «Рошан», «обсервер». Английские названия не склоняй и не добавляй к ним русских окончаний: «убил Huskar», «против Lion», а не «Huskarу», «Lionа». Золото и нетворс измеряй в золоте, а не в «очках». Не придумывай названий, которых нет в фактах.

Правила:
- Используй только данные тебе факты. Числа и время копируй из них точно. Никогда не придумывай события, время, бай-беки, киллы, способности, предметы или места на карте.
- Соперник игрока - вражеский игрок на ТОЙ ЖЕ позиции (указан ниже). Сравнивай игрока только с ним - никогда не с противниками по линии и не с игроками на других позициях.
- Оценивай игрока по задачам его роли, а не по показателям, за которые его роль не отвечает. Никогда не давай советов про: ${role.neverAdviseOn.join("; ")}.
- Обращайся к игроку на «ты». Говори, что произошло, какое решение или привычка это вызвали и что делать вместо этого. Говори уверенно: без «возможно», «может быть», «вероятно».
- У каждой фазы уже есть вердикт (выиграна / наравне / проиграна), посчитанный по нетворсу против соперника. Не противоречь ему. Если фаза выиграна - скажи, что сработало и что продолжать делать, не выдумывай проблем.
- Поле "decision" строй из проверенных причин этой фазы (№1 - самая серьёзная): назови решение или привычку, стоящую за причиной №1, своими словами и привяжи вывод к её времени или числу. Если причина говорит «в тимфайте» - смерть была в драке, а не в одиночку; не меняй этого. Не утверждай конкретных действий, которых нет в фактах (хайграунд, Roshan, Smoke of Deceit, TP Scroll и т.п.).
- В полях "whatWentWrong" и "decision" описывай только то, что подтверждают факты этой фазы. Советы - только в "doInstead".
- Поле "doInstead" строй из тренерских принципов, приведённых для этой фазы, и делай его конкретным с помощью чисел и времени из фактов.
- Называй предмет только если он есть в фактах. Не советуй купить то, чего тебе не показали.
- Совет должен быть конкретным и выполнимым в следующей игре: где стоять, что делать с волной, когда драться или отступать, что фармить. Не «играй лучше».
- Если в фактах фазы сказано, что твоя команда сильно отставала, защищала базу или играла вчетвером, советуй, как обороняться и выживать (где безопасно фармить, как ловить врагов на своей половине, когда отдать башню), а не атаковать хайграунд или пушить.
- Если в начале данных есть «Контекст игры» (Turbo, игрок покинул игру), учитывай его: если союзник покинул игру, скажи об этом в итоге - это объясняет исход лучше любой личной ошибки; если игрок сам покинул игру, разбирай только время до этого.
- Смотри на игру целиком: блок «Ход игры» говорит, как менялся перевес команды и какие драки его решили. Если там сказано, что выигранная игра упущена, итог обязан объяснить, где и как был потерян перевес (переломные драки, постройки, Aegis, выкуп) и что в этом сделал игрок, а не начинаться с линии. Если был камбэк - назови драку, которая его сделала.
- Оценивай поведение, а не только цифры: где игрок умирал, кто был рядом, был ли он первым, кого достал враг, погиб ли он перед дракой. Эти факты важнее разницы в нетворсе.

${GAME_PRINCIPLES}

РОЛЬ: ${role.label}
- Линия: ${role.job.laning}
- Мидгейм: ${role.job.midGame}
- Лейтгейм: ${role.job.lateGame}
- Зоны карты: ${role.mapRules}`;
}

function formatPhase(phase: PhaseAnalysis, index: number): string {
  const verdict = phase.verdict ? VERDICT_RU[phase.verdict] : "НЕИЗВЕСТНО (нет данных по нетворсу)";
  const lines = [
    `### Фаза ${index + 1} (id: ${phase.id}): ${phase.label} (${phase.window}) - вердикт: ${verdict}${phase.verdict ? ` (${phase.verdictBasis})` : ""}`,
    "Факты:",
    ...phase.facts.map((f) => `- ${f}`),
  ];
  if (phase.causes.length > 0) {
    lines.push("Проверенные причины, начиная с самой серьёзной:");
    phase.causes.forEach((c, i) => lines.push(`${i + 1}. ${c}`));
    if (phase.principles.length > 0) {
      lines.push("Тренерские принципы для этих причин (используй их для поля «что делать иначе»):");
      phase.principles.forEach((p) => lines.push(`- ${p}`));
    }
  } else {
    lines.push("Проверенные причины: в данных этой фазы не найдено.");
  }
  return lines.join("\n");
}

export function buildMatchCoachPrompt(analysis: MatchAnalysis): string {
  const kit = getHeroAbilityKit(analysis.heroId).map((a) => a.name);
  const killerLines = analysis.repeatKillers.map((k) => {
    const abilities = getHeroAbilityKit(k.heroId).map((a) => a.name);
    return `- ${k.heroName} (убил тебя ${k.count} раз): ${abilities.join(", ")}`;
  });

  // Each section with how much the report loses without it (0 = never
  // dropped). Sections are dropped from the least important up until the
  // prompt fits the model's window - see fitToWindow.
  const sections: { text: string; drop: number }[] = [];
  const add = (text: string, drop = 0) => sections.push({ text, drop });

  if (analysis.context.notes.length > 0) add(`Контекст игры:\n${analysis.context.notes.map((n) => `- ${n}`).join("\n")}`);
  add(
    `Матч ${analysis.matchId}: ${analysis.heroName}, роль - ${analysis.positionLabel} (${POSITION_SOURCE_NOTE[analysis.positionSource]}). Матч ${analysis.win ? "ВЫИГРАН" : "ПРОИГРАН"}, длительность ${formatMatchTime(analysis.durationSeconds)}.`
  );
  add(
    analysis.counterpart
      ? `Соперник на той же позиции: ${analysis.counterpart.heroName}.`
      : "Соперника на той же позиции определить не удалось."
  );
  add(analysis.laneSummary, 3);

  if (analysis.gameFlow) {
    add(`Ход игры (вся игра, а не одна фаза):\n${analysis.gameFlow.facts.map((f) => `- ${f}`).join("\n")}`);
  }

  // The phases already give net worth at their ends; the full series is extra.
  if (analysis.netWorth.length > 0) {
    add(
      `Нетворс против соперника по минутам: ${analysis.netWorth
        .map((c) => `${c.minute}:00 ты ${formatGold(c.you)} против ${formatGold(c.counterpart)}`)
        .join(" | ")}`,
      6
    );
  }

  if (analysis.phases.length > 0) {
    add(analysis.phases.map(formatPhase).join("\n\n"));
  } else {
    add(
      "У этого матча нет разобранного реплея, поэтому данных по фазам нет. Строй отчёт только на итоговом сравнении и скажи об этом в итоге; не придумывай события."
    );
  }

  if (analysis.endStateVsCounterpart.length > 0) {
    // Without phases this is all there is to go on.
    add(`Итог матча против соперника:\n${analysis.endStateVsCounterpart.map((l) => `- ${l}`).join("\n")}`, analysis.phases.length > 0 ? 2 : 0);
  }

  if (analysis.stats.length > 0) {
    add(
      `Итоговые показатели, важные для роли (перцентиль - среди всех игроков на этом герое):\n${analysis.stats
        .map((s) => `- ${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ""}${s.percentile !== undefined ? ` (${s.percentile}-й перцентиль)` : ""}`)
        .join("\n")}`,
      analysis.phases.length > 0 ? 5 : 0
    );
  }

  if (analysis.priorities.length > 0) {
    add(`Главная проблема по данным (уже проверена): ${analysis.priorities[0].metric}`);
  }

  add(`Способности героя ${analysis.heroName}: ${kit.join(", ")}. Упоминай только способности из этого списка.`, 1);
  if (killerLines.length > 0) {
    add(`Герои, которые убивали тебя несколько раз, и их способности:\n${killerLines.join("\n")}`, 4);
  }

  add(
    analysis.phases.length > 0
      ? `Напиши по одной записи на каждую фазу в порядке выше (${analysis.phases.map((p) => `${p.id} = ${p.label}`).join(", ")}) и итог из 2-3 предложений, обращённый прямо к игроку на «ты» (никогда «игрок» или имя героя в третьем лице). Всё - на русском языке. Отправь отчёт инструментом submit_match_coaching_report.`
      : "Напиши короткий итог, до 3 сильных сторон для этой роли и 2-4 приоритета на следующую игру - всё на русском языке. Отправь отчёт инструментом submit_match_coaching_report."
  );
  return fitToWindow(sections, buildMatchSystemPrompt(analysis).length);
}

// The prompt has to fit Ollama's default 8192-token window together with the
// answer, or Ollama silently drops its start - the system rules. Long games
// (many fights, deaths and a game-flow block) went a few hundred tokens over.
const WINDOW_TOKENS = 8192;
const ANSWER_TOKENS = 1536;
// Same rate as the client's context sizing (qwen3, Russian text with numbers).
const CHARS_PER_TOKEN = 2.6;
// The response-format guide appended by the client.
const FORMAT_GUIDE_CHARS = 1600;

function fitToWindow(sections: { text: string; drop: number }[], systemChars: number): string {
  const budget = (WINDOW_TOKENS - ANSWER_TOKENS) * CHARS_PER_TOKEN - systemChars - FORMAT_GUIDE_CHARS;
  const kept = [...sections];
  const size = () => kept.reduce((s, x) => s + x.text.length + 2, 0);
  const droppable = [...sections].filter((s) => s.drop > 0).sort((a, b) => b.drop - a.drop);
  for (const section of droppable) {
    if (size() <= budget) break;
    kept.splice(kept.indexOf(section), 1);
  }
  return kept.map((s) => s.text).join("\n\n");
}

// ---- Validation of the model's output against the real analysis ----

interface RawPhase {
  phase?: string;
  whatWentWrong?: string;
  decision?: string;
  doInstead?: string;
}

export interface RawMatchReport {
  summary?: string;
  phases?: RawPhase[];
  strengths?: CoachFinding[];
  tips?: CoachFinding[];
}

const TIME_PATTERN = /\b\d{1,2}:\d{2}\b/g;
// Small counts ("3 deaths", "2 fights") are too easy to state legitimately to police.
const MIN_CHECKED_NUMBER = 100;
const NUMBER_TOLERANCE = 0.02;
// Cheap consumables and wards are routine support/carry advice and always affordable.
const MAX_EXEMPT_ITEM_COST = 300;
const CYRILLIC = /\p{Script=Cyrillic}/u;
// "ты", "тебя", "твой"... - the summary must speak to the player directly.
const SECOND_PERSON = /(?<!\p{L})(?:ты|тебя|тебе|тобой|тво[йяеиёю]\p{L}*)(?!\p{L})/iu;
const BUYBACK = /бай-?бек|байбэк|выкуп|buy-?back/i;

// Things the model likes to claim happened even when the data says nothing
// about them (verified: it wrote "you went up the high ground without a
// pick-off" for a phase with no death anywhere near the enemy base). A
// sentence describing what happened may only mention one of these when that
// phase's own facts do too. `requires: null` means the data never covers it.
const CLAIM_TERMS: { claim: RegExp; requires: RegExp | null }[] = [
  { claim: /хай-?граунд|вражеск\p{L}*\s+баз/iu, requires: /хайграунд|баз/iu },
  { claim: /roshan|рошан|aegis|аегис/iu, requires: /roshan|рошан/iu },
  { claim: /джангл|лес[уае]?(?!\p{L})/iu, requires: /джангл|(?<!\p{L})лес/iu },
  { claim: /(?<!\p{L})вард|обсервер|сентри|observer|sentry/iu, requires: /вард|обсервер|сентри|observer|sentry/iu },
  { claim: /(?<!\p{L})смок|smoke|(?<!\p{L})дым/iu, requires: null },
  { claim: /телепорт|(?<!\p{L})тп(?!\p{L})|\btp\b/iu, requires: null },
];

// The model sometimes translates or transliterates game names despite the
// prompt; the player wants them exactly as the game shows them.
const ORIGINAL_NAMES: [RegExp, string][] = [
  [/(?<!\p{L})рошан\p{L}*/giu, "Roshan"],
  [/(?<!\p{L})а[еэ]гис\p{L}*/giu, "Aegis"],
  [/(?<!\p{L})обсервер\p{L}*(?:[\s-]+вард\p{L}*)?/giu, "Observer Ward"],
  [/(?<!\p{L})сентри(?:[\s-]+вард\p{L}*)?(?!\p{L})/giu, "Sentry Ward"],
  [/(?<!\p{L})смок(?:ом|а|е|у)?(?!\p{L})/giu, "Smoke of Deceit"],
  [/(?<!\p{L})бкб(?!\p{L})/giu, "BKB"],
];

export function keepOriginalNames(text: string): string {
  return ORIGINAL_NAMES.reduce((acc, [rx, name]) => acc.replace(rx, name), text);
}

// Verdicts are decided in code; the model reliably restated them wrong
// ("ты проиграл лейтгейм" for a late game won by 1 152 net worth, or about a
// late game folded into the mid game and never judged on its own).
const PHASE_WORDS: Record<PhaseId, RegExp> = {
  laning: /(?<!\p{L})(?:лини(?:я|и|ю|ей)|лайнинг\p{L}*)(?!\p{L})/iu,
  midGame: /мидгейм|середин\p{L}*\s+игры/iu,
  lateGame: /лейтгейм|поздн\p{L}*\s+(?:игр|стади|фаз)/iu,
};
const WON_CLAIM = /выигр|обыгр|переигр/iu;
const LOST_CLAIM = /проигр|уступил/iu;

// A claim is a win/lose verb with a phase as its object: within four words
// after it ("выиграл линию и мидгейм") or two before ("мидгейм проигран") -
// not any phase word in the sentence ("проиграл игру из-за смертей на линии").
// "Ты проиграл из-за..." about a game that was won. Only a claim about the
// game itself counts: the verb with "игру/матч", or with nothing after it.
const GAME_RESULT = /(?<!\p{L})(вы|про)игр\p{L}*(?=\s+(?:эту\s+|этот\s+)?(?:игру|матч)|\s+(?:из-за|потому|благодаря)|\s*[,.!]|\s*$)/iu;

function contradictsResult(sentence: string, win: boolean): boolean {
  const m = sentence.match(GAME_RESULT);
  if (!m || m.index === undefined) return false;
  // "Линия проиграна." is about a phase - contradictsVerdicts' job.
  const before = sentence.slice(0, m.index).trim().split(/\s+/).slice(-3).join(" ");
  if (Object.values(PHASE_WORDS).some((rx) => rx.test(before))) return false;
  return (m[1].toLowerCase() === "вы") !== win;
}

function contradictsVerdicts(sentence: string, phases: PhaseAnalysis[]): boolean {
  for (const clause of sentence.split(/[,;]|\s(?:но|а|однако|зато)\s/iu)) {
    const words = clause.trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const won = WON_CLAIM.test(words[i]);
      if (won === LOST_CLAIM.test(words[i])) continue;
      const object = [...words.slice(Math.max(0, i - 2), i), ...words.slice(i + 1, i + 5)].join(" ");
      for (const id of Object.keys(PHASE_WORDS) as PhaseId[]) {
        if (!PHASE_WORDS[id].test(object)) continue;
        const phase = phases.find((p) => p.id === id);
        // A phase that was never judged on its own (a short late game is
        // folded into the mid game) can't have been won or lost either.
        if (!phase) return true;
        if (won ? phase.verdict === "lost" : phase.verdict === "won") return true;
      }
    }
  }
  return false;
}

// "умер 2 раза до 5:00" when one of the two came after it - the model merges
// "2 deaths in lane" and "1 before 5:00" into one wrong claim.
const DEATHS_BEFORE = /(\d+)\s+(?:раз\p{L}*|смерт\p{L}*)[^.;()]{0,30}?\sдо\s+(\d{1,2}):(\d{2})/iu;

function deathCountOk(sentence: string, deathTimes: number[]): boolean {
  const m = sentence.match(DEATHS_BEFORE);
  if (!m || !/умер|смерт|погиб/iu.test(sentence)) return true;
  const before = Number(m[2]) * 60 + Number(m[3]);
  return deathTimes.filter((t) => t < before).length === Number(m[1]);
}

function claimsOk(sentence: string, phaseSource: string): boolean {
  // A time is real only for the phase it happened in - a mid-game death
  // quoted in the laning entry is a real time misattributed.
  for (const t of sentence.match(TIME_PATTERN) ?? []) {
    if (!phaseSource.includes(t)) return false;
  }
  return CLAIM_TERMS.every(({ claim, requires }) => {
    if (!claim.test(sentence)) return true;
    return requires !== null && requires.test(phaseSource);
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeChecker(analysis: MatchAnalysis) {
  const knownTimes = new Set(analysis.knownTimes);
  const sourceText = [
    ...(analysis.gameFlow?.facts ?? []),
    analysis.laneSummary,
    ...analysis.endStateVsCounterpart,
    ...analysis.phases.flatMap((p) => [p.verdictBasis, ...p.facts, ...p.causes]),
    ...analysis.netWorth.map((c) => `${c.you} ${c.counterpart} ${c.diff}`),
    ...analysis.stats.map((s) => String(s.value)),
  ].join(" ");
  const knownNumbers = extractNumbers(sourceText).map(Math.abs);
  const knownNumberSet = new Set(knownNumbers);
  const factsMentionBuyback = BUYBACK.test(sourceText);
  const knownItemsLower = new Set(analysis.knownItems.map((i) => i.toLowerCase()));
  const bigItems = getAllItems()
    .filter((i) => i.cost > MAX_EXEMPT_ITEM_COST && i.name.length >= 5)
    .filter((i) => !knownItemsLower.has(i.name.toLowerCase()))
    .map((i) => new RegExp(`\\b${escapeRegExp(i.name)}\\b`, "i"));

  const sentenceOk = (sentence: string): boolean => {
    // The report is Russian-only: a sentence the model wrote in English is dropped.
    if (!CYRILLIC.test(sentence)) return false;
    for (const t of sentence.match(TIME_PATTERN) ?? []) {
      if (!knownTimes.has(t)) return false;
    }
    for (const n of extractNumbers(sentence)) {
      if (n < MIN_CHECKED_NUMBER) continue;
      const value = Math.abs(n);
      if (!knownNumbers.some((k) => Math.abs(k - value) <= Math.max(1, k * NUMBER_TOLERANCE))) return false;
    }
    if (BUYBACK.test(sentence) && !factsMentionBuyback && analysis.buybacksUsed === 0) return false;
    if (contradictsVerdicts(sentence, analysis.phases)) return false;
    if (contradictsResult(sentence, analysis.win)) return false;
    if (!deathCountOk(sentence, analysis.deathTimes)) return false;
    if (bigItems.some((rx) => rx.test(sentence))) return false;
    return true;
  };

  // Keeps only the sentences of a passage that survive every check. With
  // `phaseSource`, the passage describes what happened in that phase, so its
  // event claims must also be backed by that phase's own facts.
  const clean = (text: string | undefined, phaseSource?: string): string => {
    if (!text) return "";
    return keepOriginalNames(text)
      .split(/(?<=[.!?])\s+/)
      .filter(
        (s) =>
          s.trim().length > 0 &&
          sentenceOk(s) &&
          (phaseSource === undefined || claimsOk(s, phaseSource))
      )
      .join(" ")
      .trim();
  };

  // A finding's "metric" must quote at least one real number or time from the analysis.
  const grounded = (metric: string): boolean => {
    if ((metric.match(TIME_PATTERN) ?? []).some((t) => knownTimes.has(t))) return true;
    return extractNumbers(metric).some((n) => knownNumberSet.has(Math.abs(n)));
  };

  return { sentenceOk, clean, grounded };
}

function cleanFindings(
  findings: CoachFinding[] | undefined,
  analysis: MatchAnalysis,
  check: ReturnType<typeof makeChecker>
): CoachFinding[] {
  const role = roleProfileFor(analysis.position);
  return (findings ?? [])
    .filter((f) => f?.point && f?.metric)
    .map((f) => ({ point: keepOriginalNames(f.point), metric: keepOriginalNames(f.metric) }))
    .filter((f) => {
      if (role.irrelevantAdvice.some((rx) => rx.test(f.point) || rx.test(f.metric))) return false;
      return check.grounded(f.metric) && check.sentenceOk(f.point) && check.sentenceOk(f.metric);
    });
}

// "Why it happened" is an inference, so it has to point at the real time or
// number it's inferred from - an unanchored habit ("you didn't re-aggro") is
// a guess dressed up as a diagnosis.
function grounded(text: string, check: ReturnType<typeof makeChecker>): string {
  return text && check.grounded(text) ? text : "";
}

// The summary must address the player; a third-person recap ("Игрок проиграл...") is dropped.
function writtenToPlayer(text: string): string {
  return SECOND_PERSON.test(text) ? text : "";
}

function firstSentences(text: string, count: number): string {
  return text.split(/(?<=[.!?])\s+/).slice(0, count).join(" ");
}

function leaverNote(l: MatchAnalysis["context"]["leavers"][number]): string {
  const when = l.time !== null ? ` в ${formatMatchTime(l.time)}` : "";
  return l.isYou
    ? ` Ты покинул игру${when}, поэтому разбор - только до этого момента.`
    : ` ${l.heroName} из твоей команды покинул игру${when}, и дальше вы играли вчетвером.`;
}

const VERDICT_WORD: Record<PhaseVerdict, string> = {
  won: "выиграна",
  even: "наравне",
  lost: "проиграна",
};

// Built from the verified analysis alone - used when the model's summary is
// rejected, or isn't written to the player ("ты").
function fallbackSummary(analysis: MatchAnalysis): string {
  const left = analysis.context.leavers.find((l) => l.isYou || l.yourTeam);
  const result = `Ты ${analysis.win ? "выиграл" : "проиграл"} эту игру на ${analysis.heroName} (${analysis.positionLabel}).${left ? leaverNote(left) : ""}`;
  if (analysis.phases.length === 0) {
    const versus = analysis.counterpart
      ? ` У матча нет поминутных данных (реплей не был полностью разобран), поэтому разбор построен только на итоговых цифрах против ${analysis.counterpart.heroName} - врага на твоей позиции.`
      : " У матча нет поминутных данных (реплей не был полностью разобран), поэтому разбор построен только на итоговых цифрах.";
    return `${result}${versus}`;
  }
  const verdicts = analysis.phases
    .map((p) => `${p.label.toLowerCase()} - ${p.verdict ? VERDICT_WORD[p.verdict] : "нет данных"}`)
    .join(", ");
  const firstProblem = analysis.phases.find((p) => p.verdict === "lost")?.causes[0];
  const versus = analysis.counterpart ? ` Против ${analysis.counterpart.heroName}, врага на твоей позиции: ${verdicts}.` : "";
  return `${result}${versus}${firstProblem ? ` Главная проблема: ${firstProblem}` : ""}`;
}

/**
 * Merges the model's narrative with the facts computed in code, dropping any
 * sentence that cites a time, number, buyback or item the data doesn't
 * contain (or that isn't in Russian), so an invented detail never reaches the
 * player. Where the model's text for a phase is entirely rejected, the top
 * verified catalyst stands in.
 */
export function assembleMatchReport(raw: RawMatchReport, analysis: MatchAnalysis): CoachReport {
  const check = makeChecker(analysis);
  const allPhasesSource = [
    ...analysis.context.notes,
    ...(analysis.gameFlow?.facts ?? []),
    analysis.laneSummary,
    ...analysis.endStateVsCounterpart,
    ...analysis.phases.flatMap((p) => [p.verdictBasis, ...p.facts, ...p.causes]),
  ].join(" ");

  const phases: CoachPhaseReport[] = analysis.phases.map((phase) => {
    const written = raw.phases?.find((p) => p.phase === phase.id);
    const phaseSource = [phase.verdictBasis, ...phase.facts, ...phase.causes].join(" ");
    return {
      id: phase.id,
      label: phase.label,
      window: phase.window,
      verdict: phase.verdict,
      evidence: phase.facts,
      catalysts: phase.causes,
      // These two describe what happened, so their claims are checked against
      // the phase's facts; doInstead is advice and may suggest anything.
      whatWentWrong:
        check.clean(written?.whatWentWrong, phaseSource) || phase.causes[0] || phase.verdictBasis,
      decision: grounded(check.clean(written?.decision, phaseSource), check),
      doInstead: check.clean(written?.doInstead) || phase.principles[0] || "",
    };
  });

  return {
    summary:
      writtenToPlayer(firstSentences(check.clean(raw.summary, allPhasesSource), 3)) ||
      fallbackSummary(analysis),
    phases: phases.length > 0 ? phases : undefined,
    comparison: analysis.counterpart
      ? {
          counterpartHero: analysis.counterpart.heroName,
          positionLabel: analysis.positionLabel,
          positionSource: analysis.positionSource,
          netWorth: analysis.netWorth,
        }
      : undefined,
    // With a timeline, strengths and priorities come from the verified analysis;
    // the model only writes them when there is nothing else to base the report on.
    strengths: phases.length > 0 ? analysis.strengths : cleanFindings(raw.strengths, analysis, check),
    weaknesses: [],
    tips: phases.length > 0 ? analysis.priorities : cleanFindings(raw.tips, analysis, check),
  };
}
