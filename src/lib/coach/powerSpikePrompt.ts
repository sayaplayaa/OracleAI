import { getItemEffectText } from "../constants";
import { extractNumbers, formatMatchTime } from "../format";
import type { CoachFinding, HeroAbility, PowerSpikeReport, SkillBuildEntry } from "../types";

const UNKNOWN_TIME = "неизвестно";

interface EnrichedItem {
  item: string;
  time: string;
  // null = no real effect text exists anywhere in the game data - the model
  // must not describe what this item does, only that it was bought.
  effect: string | null;
}

interface EnrichedLevel {
  level: number;
  ability: string;
  rank: number;
  time: string;
  // This ability's real numeric attributes AT THE RANK reached here (not the
  // whole array) - null when the ability has no numeric attributes at all.
  currentRankValues: { header: string; value: string }[] | null;
}

export interface PowerSpikeData {
  heroName: string;
  items: EnrichedItem[];
  levels: EnrichedLevel[];
  knownTimes: Set<string>;
  knownNumbers: Set<number>;
}

function collectNumbers(text: string, into: Set<number>): void {
  for (const n of extractNumbers(text)) into.add(n);
}

// A multi-rank attribute is stored as its values joined "160% / 200% / 240% / 280%"
// by getHeroAbilityKit; this picks the one real value for the rank actually reached.
function attributesAtRank(
  ability: HeroAbility,
  rank: number
): { header: string; value: string }[] | null {
  if (ability.attributes.length === 0) return null;
  return ability.attributes.map((a) => {
    const parts = a.value.split(" / ");
    if (parts.length <= 1) return { header: a.header, value: a.value };
    return { header: a.header, value: parts[Math.min(rank - 1, parts.length - 1)] };
  });
}

export function buildPowerSpikeData(
  heroName: string,
  abilities: HeroAbility[],
  itemTimeline: { time: number; itemName: string; itemKey: string }[],
  skillBuild: SkillBuildEntry[]
): PowerSpikeData {
  const abilityByName = new Map(abilities.map((a) => [a.name, a]));
  const knownTimes = new Set<string>([UNKNOWN_TIME]);
  const knownNumbers = new Set<number>();

  const items: EnrichedItem[] = itemTimeline.map((item) => {
    const time = formatMatchTime(item.time);
    knownTimes.add(time);
    const effect = getItemEffectText(item.itemKey);
    if (effect) collectNumbers(effect, knownNumbers);
    return { item: item.itemName, time, effect: effect || null };
  });

  const levels: EnrichedLevel[] = skillBuild.map((entry) => {
    const time = entry.approxTimeSeconds !== null ? `~${formatMatchTime(entry.approxTimeSeconds)}` : UNKNOWN_TIME;
    if (entry.approxTimeSeconds !== null) knownTimes.add(formatMatchTime(entry.approxTimeSeconds));
    knownNumbers.add(entry.level);
    knownNumbers.add(entry.rank);
    const ability = abilityByName.get(entry.abilityName) ?? null;
    const currentRankValues = ability ? attributesAtRank(ability, entry.rank) : null;
    if (currentRankValues) for (const v of currentRankValues) collectNumbers(v.value, knownNumbers);
    return { level: entry.level, ability: entry.abilityName, rank: entry.rank, time, currentRankValues };
  });

  return { heroName, items, levels, knownTimes, knownNumbers };
}

export function buildPowerSpikePrompt(data: PowerSpikeData): string {
  return `Найди 3-5 реальных пиков силы героя ${data.heroName} в этом конкретном матче и отправь их инструментом submit_power_spike_report. Пиши всё на русском языке; названия предметов и способностей оставляй как в данных (по-английски).

Пик силы - это реальный конкретный момент из данных ниже (готовый предмет, новый ранг способности), который даёт герою ощутимое преимущество на ограниченное время. Пропускай дешёвые малозначимые компоненты, если есть что-то важнее.

Правила:
- Используй только триггеры ("trigger"/"timing"), которые буквально есть в данных ниже, - никогда не придумывай предмет, уровень или время.
- Для предмета: ссылайся на его текст "effect", если он есть, и приводи реальные числа из него. Если "effect" равен null, официального описания эффекта нет - называй предмет только как покупку/тайминг и не утверждай, что он делает.
- Для повышения способности: приводи только значения из "currentRankValues" - реальные числа этой способности НА ТОМ РАНГЕ, который был у игрока в этот момент (ранг 1 - первое очко в способности, а не максимальный ранг). Никогда не приводи число другого ранга и никогда - число, которого там нет. Если "currentRankValues" равен null, скажи только, что способность прокачана, без конкретных чисел.
- "whatToDo" - конкретный тактический совет на это окно (цель на карте, лагерь/руна, ротация, драка, которую стоит искать), явно связанный с этим триггером.
- Располагай моменты в хронологическом порядке.
- Если время неизвестно, пиши в "timing" слово «${UNKNOWN_TIME}».

Реальные покупки предметов в этом матче по порядку:
${JSON.stringify(data.items, null, 2)}

Реальная прокачка способностей в этом матче по порядку:
${JSON.stringify(data.levels, null, 2)}`;
}

// ---- Validation: strip any claim the model made that isn't grounded in the real data above ----

interface RawMoment {
  trigger?: string;
  timing?: string;
  why?: CoachFinding;
  whatToDo?: CoachFinding;
}

export interface RawPowerSpikeReport {
  summary?: string;
  moments?: RawMoment[];
}

const TIME_PATTERN = /\b~?\d{1,2}:\d{2}\b/g;
const CYRILLIC = /\p{Script=Cyrillic}/u;

function isUnknownTime(timing: string): boolean {
  return timing === UNKNOWN_TIME || timing === "unknown";
}

// Scoped to one moment's own real numbers/times, not the whole match's pooled
// data - a real number borrowed from a DIFFERENT item/ability (e.g. citing a
// max-charges value that's real for a different rank) is exactly the kind of
// mistake a match-wide pool would miss, since the number is real somewhere,
// just not here.
interface LocalGrounding {
  numbers: Set<number>;
  times: Set<string>;
}

function localGroundingFor(entry: EnrichedItem | EnrichedLevel): LocalGrounding {
  const numbers = new Set<number>();
  const times = new Set<string>([UNKNOWN_TIME]);
  const timeLabel = entry.time.replace(/^~/, "");
  if (timeLabel !== UNKNOWN_TIME) times.add(timeLabel);

  if ("effect" in entry) {
    if (entry.effect) collectNumbers(entry.effect, numbers);
  } else {
    numbers.add(entry.level);
    numbers.add(entry.rank);
    if (entry.currentRankValues) for (const v of entry.currentRankValues) collectNumbers(v.value, numbers);
  }
  return { numbers, times };
}

function sentenceOk(sentence: string, grounding: LocalGrounding): boolean {
  // Russian-only report: a sentence written in English is dropped.
  if (!CYRILLIC.test(sentence)) return false;
  for (const raw of sentence.match(TIME_PATTERN) ?? []) {
    if (!grounding.times.has(raw.replace(/^~/, ""))) return false;
  }
  for (const n of extractNumbers(sentence)) {
    if (!grounding.numbers.has(n)) return false;
  }
  return true;
}

function clean(text: string | undefined, grounding: LocalGrounding): string {
  if (!text) return "";
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0 && sentenceOk(s, grounding))
    .join(" ")
    .trim();
}

function cleanFinding(finding: CoachFinding | undefined, grounding: LocalGrounding): CoachFinding | null {
  if (!finding) return null;
  const point = clean(finding.point, grounding);
  const metric = clean(finding.metric, grounding);
  if (!point || !metric) return null;
  return { point, metric };
}

function findTriggerEntry(trigger: string, data: PowerSpikeData): EnrichedItem | EnrichedLevel | null {
  return (
    data.items.find((i) => trigger.includes(i.item)) ??
    data.levels.find((l) => trigger.includes(l.ability)) ??
    null
  );
}

/**
 * Drops any power-spike moment whose trigger/timing isn't real, and strips
 * any sentence in its explanation that cites a number or time not present in
 * THAT SPECIFIC trigger's own real data (or that isn't in Russian) - the
 * model's own numeric claims (a talent's exact bonus, an ability's rank value)
 * have been verified wrong often enough, including borrowing a real number
 * from a different item or rank, that they're re-checked here rather than trusted.
 */
export function assemblePowerSpikeReport(
  raw: RawPowerSpikeReport,
  data: PowerSpikeData
): PowerSpikeReport {
  const overall: LocalGrounding = { numbers: data.knownNumbers, times: data.knownTimes };
  const moments = (raw.moments ?? []).flatMap((m) => {
    if (!m.trigger || !m.timing) return [];
    const entry = findTriggerEntry(m.trigger, data);
    if (!entry) return [];
    const timing = isUnknownTime(m.timing) ? UNKNOWN_TIME : m.timing;
    if (timing !== UNKNOWN_TIME && !data.knownTimes.has(timing.replace(/^~/, ""))) return [];
    const grounding = localGroundingFor(entry);
    const why = cleanFinding(m.why, grounding);
    const whatToDo = cleanFinding(m.whatToDo, grounding);
    if (!why || !whatToDo) return [];
    return [{ trigger: m.trigger, timing, why, whatToDo }];
  });

  return {
    summary: clean(raw.summary, overall) || `Реальные пики силы героя ${data.heroName} в этом матче.`,
    moments,
  };
}
