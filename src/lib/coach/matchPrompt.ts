import { getAllItems } from "../constants";
import { extractNumbers, formatGold, formatMatchTime } from "../format";
import { getHeroAbilityKit } from "../heroAbilities";
import type {
  CoachFinding,
  CoachPhaseReport,
  CoachReport,
  MatchAnalysis,
  PhaseAnalysis,
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

ЯЗЫК: пиши весь отчёт только на русском языке. Названия НЕ переводи и не транслитерируй: имена героев, способностей, предметов и юнитов пиши латиницей ровно так, как они даны в фактах (Anti-Mage, Black King Bar, Arcane Orb, Roshan, Observer Ward, Sentry Ward, Smoke of Deceit, TP Scroll), а не «Антимаг», «БКБ», «Рошан», «обсервер». Не придумывай названий, которых нет в фактах.

Правила:
- Используй только данные тебе факты. Числа и время копируй из них точно. Никогда не придумывай события, время, бай-беки, киллы, способности, предметы или места на карте.
- Соперник игрока - вражеский игрок на ТОЙ ЖЕ позиции (указан ниже). Сравнивай игрока только с ним - никогда не с противниками по линии и не с игроками на других позициях.
- Оценивай игрока по задачам его роли, а не по показателям, за которые его роль не отвечает. Никогда не давай советов про: ${role.neverAdviseOn.join("; ")}.
- Обращайся к игроку на «ты». Говори, что произошло, какое решение или привычка это вызвали и что делать вместо этого. Говори уверенно: без «возможно», «может быть», «вероятно».
- У каждой фазы уже есть вердикт (выиграна / наравне / проиграна), посчитанный по нетворсу против соперника. Не противоречь ему. Если фаза выиграна - скажи, что сработало и что продолжать делать, не выдумывай проблем.
- Поле "decision" строй из проверенных причин этой фазы (№1 - самая серьёзная): назови решение или привычку, стоящую за ними, и обязательно привяжи вывод к конкретному времени или числу из фактов этой фазы (например: «Смерти в 12:06 и 12:46 вне тимфайтов показывают, что ты ходил по карте один без обзора»). Не утверждай конкретных действий, которых нет в фактах (хайграунд, Roshan, Smoke of Deceit, TP Scroll и т.п.).
- В полях "whatWentWrong" и "decision" описывай только то, что подтверждают факты этой фазы. Советы - только в "doInstead".
- Поле "doInstead" строй из тренерских принципов, приведённых для этой фазы, и делай его конкретным с помощью чисел и времени из фактов.
- Называй предмет только если он есть в фактах. Не советуй купить то, чего тебе не показали.
- Совет должен быть конкретным и выполнимым в следующей игре: где стоять, что делать с волной, когда драться или отступать, что фармить. Не «играй лучше».

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

  const parts: string[] = [
    `Матч ${analysis.matchId}: ${analysis.heroName}, роль - ${analysis.positionLabel} (${POSITION_SOURCE_NOTE[analysis.positionSource]}). Матч ${analysis.win ? "ВЫИГРАН" : "ПРОИГРАН"}, длительность ${formatMatchTime(analysis.durationSeconds)}.`,
    analysis.counterpart
      ? `Соперник на той же позиции: ${analysis.counterpart.heroName}.`
      : "Соперника на той же позиции определить не удалось.",
    analysis.laneSummary,
  ];

  if (analysis.netWorth.length > 0) {
    parts.push(
      `Нетворс против соперника по минутам: ${analysis.netWorth
        .map((c) => `${c.minute}:00 ты ${formatGold(c.you)} против ${formatGold(c.counterpart)}`)
        .join(" | ")}`
    );
  }

  if (analysis.phases.length > 0) {
    parts.push(analysis.phases.map(formatPhase).join("\n\n"));
  } else {
    parts.push(
      "У этого матча нет разобранного реплея, поэтому данных по фазам нет. Строй отчёт только на итоговом сравнении и скажи об этом в итоге; не придумывай события."
    );
  }

  if (analysis.endStateVsCounterpart.length > 0) {
    parts.push(`Итог матча против соперника:\n${analysis.endStateVsCounterpart.map((l) => `- ${l}`).join("\n")}`);
  }

  if (analysis.stats.length > 0) {
    parts.push(
      `Итоговые показатели, важные для роли (перцентиль - среди всех игроков на этом герое):\n${analysis.stats
        .map((s) => `- ${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ""}${s.percentile !== undefined ? ` (${s.percentile}-й перцентиль)` : ""}`)
        .join("\n")}`
    );
  }

  parts.push(`Способности героя ${analysis.heroName}: ${kit.join(", ")}. Упоминай только способности из этого списка.`);
  if (killerLines.length > 0) {
    parts.push(`Герои, которые убивали тебя несколько раз, и их способности:\n${killerLines.join("\n")}`);
  }

  parts.push(
    analysis.phases.length > 0
      ? `Напиши по одной записи на каждую фазу в порядке выше (${analysis.phases.map((p) => `${p.id} = ${p.label}`).join(", ")}) и итог из 2-3 предложений, обращённый прямо к игроку на «ты» (никогда «игрок» или имя героя в третьем лице). Всё - на русском языке. Отправь отчёт инструментом submit_match_coaching_report.`
      : "Напиши короткий итог, до 3 сильных сторон для этой роли и 2-4 приоритета на следующую игру - всё на русском языке. Отправь отчёт инструментом submit_match_coaching_report."
  );
  return parts.join("\n\n");
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

const VERDICT_WORD: Record<PhaseVerdict, string> = {
  won: "выиграна",
  even: "наравне",
  lost: "проиграна",
};

// Built from the verified analysis alone - used when the model's summary is
// rejected, or isn't written to the player ("ты").
function fallbackSummary(analysis: MatchAnalysis): string {
  const result = `Ты ${analysis.win ? "выиграл" : "проиграл"} эту игру на ${analysis.heroName} (${analysis.positionLabel}).`;
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
