// The AI hero guide for one role: written from the hero's real ability kit
// (with the game client's mechanics notes and Aghanim's upgrades), matchups,
// the role's real current build with each item's timing, and what pro games
// build - then checked. Items and abilities are picked from enums of the real
// build and kit; any sentence that names an item outside the data (in English
// or transliterated), or hands an enemy an ability it doesn't have, is dropped,
// and so is a tip that names none of the hero's abilities, items or opponents:
// advice that would fit any hero is exactly what the guide must not be. The
// 8B model otherwise fills a guide from its own outdated memory.

import { getAllHeroes, getAllItems, getItemMechanics } from "../constants";
import { extractNumbers } from "../format";
import { itemDeadline, laningItems, pubStatus, situationalChoices, spineItems } from "../buildItems";
import { groundedIn } from "./grounding";
import { keepOriginalNames } from "./matchPrompt";
import { abilityOwners, describeThreat, heroThreats } from "./threats";
import type {
  CoachFinding,
  DraftInsights,
  HeroAbility,
  HeroBuildOverview,
  HeroGuideEarlyItem,
  HeroGuideItemTip,
  HeroGuideLateItem,
  HeroGuideReport,
  HeroGuideTrick,
  HeroRoleOverview,
  ItemProgressionPoint,
  ReplaySituationalItem,
} from "../types";

export function buildHeroGuideSystemPrompt(heroName: string, roleLabel: string): string {
  return `Ты - тренер по Dota 2 уровня про-сцены. Пишешь гайд по ${heroName} для роли «${roleLabel}» для игрока, который уже знает основы: как фармить, ставить варды и носить TP Scroll, ему объяснять не нужно.

ЯЗЫК: весь гайд - на русском. Имена героев, способностей и предметов пиши латиницей ровно как в данных (Battle Fury, Mana Void, Black King Bar), без перевода, транслитерации и русских окончаний: «Blink Dagger», а не «блинк-даггер».

Полезный совет:
- Он только про ${heroName}: называет его способность (её эффект или число), предмет из его сборки или конкретного противника. Совет, который подошёл бы любому герою («фарми лес», «ставь варды», «следи за картой», «не умирай», «держись с командой»), не пиши.
- Лучшие фишки - из примечаний к способностям (notes) и улучшений Aghanim's: это официальные механики игры, которых новички не знают. Объясни, как применить их в игре.
- Предметы: какую способность героя предмет усиливает или какую слабость закрывает и что ты делаешь после покупки. Винрейт по минуте покупки показывает, к какой минуте предмет нужно успеть.
- Предметы и прокачку бери ТОЛЬКО из сборки и разбора реальных игр ниже. Не предлагай предмет, которого там нет, и не меняй порядок прокачки - объясняй, почему он такой. Ситуативный предмет советуй против того, что было у врагов в играх, где его брали («разбор игр» у предмета).
- Пиши только из данных ниже. Не придумывай эффектов, чисел и таймингов.
- Матчапы: yourWinRate - винрейт ТВОЕГО героя против этого противника; hardest - неудобные противники, easiest - удобные. Описывая противника, называй только его способности из поля dangerous.
- В поле "metric" - реальное значение из данных (винрейт и число игр для матчапа, значение способности, тайминг предмета).`;
}

function pct(share: number | undefined): string {
  return `${Math.round((share ?? 0) * 100)}%`;
}

function minuteOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

function timingText(i: ItemProgressionPoint): string {
  const t = i.timing;
  if (!t) return "";
  const deadline = itemDeadline(t);
  return ` Винрейт по минуте покупки: к ${t.fastMinute}-й мин - ${pct(t.fastWinRate)}, с ${t.slowMinute}-й - ${pct(t.slowWinRate)}${deadline ? `; успеть к ${deadline}-й мин` : ""}.`;
}

// Aghanim's Blessing gives the same upgrade; written once, next to the Scepter.
const UPGRADE_FIELD: Record<string, "scepter" | "shard"> = {
  ultimate_scepter: "scepter",
  aghanims_shard: "shard",
};

// Aghanim's items do something different on every hero: what they do on this one.
function heroUpgrade(itemKey: string, abilities: HeroAbility[], maxChars = Infinity): string {
  const field = UPGRADE_FIELD[itemKey];
  if (!field) return "";
  const upgrades = abilities.filter((a) => a[field]).map((a) => `${a.name} - ${a[field]}`);
  return upgrades.length > 0 ? ` Этому герою даёт: ${clip(upgrades.join(" "), maxChars)}` : "";
}

// How much of the data goes into the prompt. The local model's context
// (8192 tokens by default) holds the prompt and the answer together; a big
// kit (Invoker's ten spells, each with notes) gets the compact version.
interface Detail {
  // Longest item effect text; 0 leaves it out.
  itemMechanics: number;
  // Late and situational items get their effect text too.
  lateMechanics: boolean;
  valuesPerAbility: number;
  notesPerAbility: number;
  descriptionChars: number;
  situationalItems: number;
  // Longest "what Aghanim's gives this hero" text.
  upgradeChars: number;
}

const DETAIL_LEVELS: Detail[] = [
  { itemMechanics: 400, lateMechanics: true, valuesPerAbility: 8, notesPerAbility: 5, descriptionChars: 600, situationalItems: 8, upgradeChars: 600 },
  { itemMechanics: 220, lateMechanics: true, valuesPerAbility: 4, notesPerAbility: 3, descriptionChars: 400, situationalItems: 8, upgradeChars: 400 },
  { itemMechanics: 160, lateMechanics: false, valuesPerAbility: 3, notesPerAbility: 2, descriptionChars: 300, situationalItems: 6, upgradeChars: 300 },
  { itemMechanics: 120, lateMechanics: false, valuesPerAbility: 2, notesPerAbility: 1, descriptionChars: 180, situationalItems: 5, upgradeChars: 220 },
  { itemMechanics: 90, lateMechanics: false, valuesPerAbility: 0, notesPerAbility: 1, descriptionChars: 110, situationalItems: 4, upgradeChars: 160 },
];
// The task part of the prompt, so the system rules, the answer format and a
// ~3000-token answer still fit in 8192 tokens.
const PROMPT_BUDGET_CHARS = 7_300;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

// `withTiming`: the win rate by purchase minute - what the spine items are
// judged on; for a situational item what the enemy had matters, not the minute.
function itemLine(i: ItemProgressionPoint, abilities: HeroAbility[], mechanicsChars: number, withTiming = true, upgradeChars = Infinity): string {
  const from = i.builtFrom && i.builtFrom.length > 0 ? `; через ${i.builtFrom.map((b) => b.itemName).join(", ")}` : "";
  const mechanics = mechanicsChars > 0 ? clip(getItemMechanics(i.itemKey), mechanicsChars) : "";
  const share = i.isCore === false && i.pickRateIfReached !== undefined ? `${pct(i.pickRateIfReached)} игр, доживших до него` : `${pct(i.pickRate)} игр`;
  return `${i.itemName} (${share}, ~${minuteOf(i.avgTimeSeconds)} мин${from}).${mechanics ? ` Что даёт: ${mechanics}` : ""}${heroUpgrade(i.itemKey, abilities, upgradeChars)}${withTiming ? timingText(i) : ""}`;
}

function buildBlock(build: HeroBuildOverview, abilities: HeroAbility[], detail: Detail): string {
  const lines = [`Сборка роли «${build.roleLabel}» (${build.games.toLocaleString("ru-RU")} игр на Легенде и выше за эту неделю, STRATZ):`];
  if (build.startingItems.length > 0) {
    lines.push(`- Стартовый закуп: ${build.startingItems.map((i) => (i.copies > 1 ? `${i.itemName} ×${i.copies}` : i.itemName)).join(", ")}.`);
  }
  const laning = laningItems(build);
  if (laning.length > 0) {
    lines.push("- ЛИНИЯ (что покупают на линии, по порядку; «по ситуации» - не в каждой игре):");
    const mechanics = detail.lateMechanics ? Math.min(140, detail.itemMechanics) : 0;
    for (const e of laning) {
      const effect = mechanics > 0 ? clip(getItemMechanics(e.item.itemKey), mechanics) : "";
      const instead = e.alternatives.length > 0 ? `; вместо них: ${e.alternatives.map((a) => `${a.itemName} ${pct(a.pickRate)}`).join(", ")}` : "";
      lines.push(
        `  - ${e.item.itemName} (${pct(e.item.pickRate)} игр, ~${minuteOf(e.item.avgTimeSeconds)} мин${e.optional ? ", по ситуации" : ""}${e.towards ? `, на пути к ${e.towards}` : ""}${instead}).${effect ? ` Что даёт: ${effect}` : ""}`
      );
    }
  }
  const core = spineItems(build);
  if (core.length > 0) {
    lines.push("- ОСНОВА СБОРКИ (большие предметы, которые собирают почти всегда), по порядку:");
    core.forEach((i, n) => lines.push(`  ${n + 1}. ${itemLine(i, abilities, detail.itemMechanics, true, detail.upgradeChars)}`));
  }
  const situational = situationalChoices(build).slice(0, detail.situationalItems);
  if (situational.length > 0) {
    lines.push("- ПО СИТУАЦИИ (один-два за игру; «разбор игр» - что было у врагов в играх, где его брали):");
    for (const c of situational) {
      const stats = c.stats ? itemLine(c.stats, abilities, detail.lateMechanics ? detail.itemMechanics : 0, false, detail.upgradeChars) : `${c.itemName}.`;
      lines.push(`  - ${stats}${c.evidence && build.replays ? ` Разбор игр: ${evidenceText(c.evidence, build.replays.games)}.` : ""}`);
    }
  }
  // An upgrade the build never shows still belongs in the guide's tricks.
  const shown = new Set([...core.map((i) => i.itemKey), ...situational.map((c) => c.itemKey)]);
  for (const [itemKey, name] of [["ultimate_scepter", "Aghanim's Scepter"], ["aghanims_shard", "Aghanim's Shard"]] as const) {
    if (!shown.has(itemKey)) {
      const upgrade = heroUpgrade(itemKey, abilities, detail.upgradeChars);
      if (upgrade) lines.push(`- ${name} (редко):${upgrade}`);
    }
  }
  return lines.join("\n");
}

const MAX_SITUATIONAL = 8;

/** The lists the guide's answer picks from: the same items the prompt shows. */
export function guideToolArgs(build: HeroBuildOverview | null, abilities: HeroAbility[]) {
  return {
    earlyItems: [...new Set(laningItems(build).flatMap((e) => [e.item, ...e.alternatives]).map((i) => i.itemName))],
    coreItems: spineItems(build).map((i) => i.itemName),
    lateItems: situationalChoices(build).slice(0, MAX_SITUATIONAL).map((c) => c.itemName),
    abilities: distinctAbilities(abilities).map((a) => a.name),
    hasSkillBuild: (build?.replays?.skillBuild.length ?? 0) > 0,
  };
}

// "в 25 из 63 разобранных игр, ~33 мин; у врагов было больше «лечение и
// реген»: 1.1 героя против 0.6; чаще против Pangolier (5)".
function evidenceText(e: ReplaySituationalItem, total: number): string {
  const parts = [`в ${e.games} из ${total} разобранных игр, ~${e.minute} мин`];
  for (const t of e.traits) parts.push(`у врагов было больше «${t.label}»: ${t.withItem} героя против ${t.withoutItem} в играх без него`);
  if (e.enemies.length > 0) parts.push(`чаще против ${e.enemies.map((x) => `${x.heroName} (${x.games})`).join(", ")}`);
  return parts.join("; ");
}

/** What the parsed games say about the skill build and the order of big items. */
function replayBlock(build: HeroBuildOverview | null): string {
  const r = build?.replays;
  if (!r) return "Разобранных игр этого патча на этой роли пока мало: не придумывай порядок прокачки и предметов, бери только сборку выше.";
  const lines = [
    `Разбор реальных игр этого патча на этой роли: ${r.games} (турнирных ${r.proGames}, Divine/Immortal ${r.highMmrGames}), побед ${pct(r.wins / r.games)}.`,
  ];
  if (r.skillBuild.length > 0) {
    lines.push(
      `- Прокачка по уровням (в скобках - доля игр с таким выбором, если не почти все): ${r.skillBuild
        .map((s) => `${s.level} ${s.isTalent ? `талант «${s.abilityName}»` : s.abilityName}${s.share < 0.95 ? ` (${pct(s.share)})` : ""}`)
        .join(", ")}.`
    );
  }
  if (r.paths.length > 0) {
    lines.push(
      `- Порядок первых больших предметов: ${r.paths
        .map((p) => `${p.items.map((i) => `${i.itemName} (${i.minute} мин)`).join(" → ")} - ${p.games} из ${r.games} игр, побед ${p.wins}`)
        .join("; ")}.`
    );
  }
  return lines.join("\n");
}

function pubStatusText(build: HeroBuildOverview, itemKey: string): string {
  const status = pubStatus(build, itemKey);
  const share = status.share === null ? "" : pct(status.share);
  switch (status.kind) {
    case "core":
      return "в пабах основа";
    case "late":
      return `в пабах поздний вариант, ${share}`;
    case "boots":
      return `в пабах обувь, ${share}`;
    case "other":
      return `в пабах ${share}`;
    default:
      return "в пабах почти не берут";
  }
}

function proBlock(build: HeroBuildOverview, heroName: string): string {
  if (build.proItems.length === 0) return "";
  return `Про-сцена - предметы в последних турнирных играх на ${heroName} (OpenDota, все позиции; число игр, в скобках - как в пабах): ${build.proItems
    .map((i) => `${i.itemName} ${i.games} (${pubStatusText(build, i.itemKey)})`)
    .join(", ")}.`;
}

function planBlock(build: HeroBuildOverview | null, games: number | null, winRate: number | null): string {
  const lines: string[] = [];
  if (games !== null && winRate !== null) lines.push(`Роль на этой неделе: ${games.toLocaleString("ru-RU")} игр, винрейт ${pct(winRate)}.`);
  if (build && build.gameLength.length > 0) {
    const span = (g: HeroBuildOverview["gameLength"][number]) =>
      g.toMinute === null ? `дольше ${g.fromMinute} мин` : g.fromMinute === 0 ? `до ${g.toMinute} мин` : `${g.fromMinute}-${g.toMinute} мин`;
    lines.push(`Винрейт по длине игры: ${build.gameLength.map((g) => `${span(g)} - ${pct(g.winRate)}`).join(", ")}.`);
  }
  if (build && build.skillOrder.length > 0) {
    lines.push(`Порядок прокачки в максимум: ${build.skillOrder.map((s) => `${s.abilityName} (к ${s.maxedAtLevel}-му уровню)`).join(", затем ")}.`);
  }
  return lines.join("\n");
}

// What Aghanim's items change is written next to them in the build block
// (or as a line of its own), so the kit leaves it out.
function compactAbility(a: HeroAbility, detail: Detail) {
  const labeled = a.attributes.filter((x) => x.localized);
  // A value of 0 is an internal one ("bonus damage: 0" until a talent adds it).
  const values = (labeled.length > 0 ? labeled : a.attributes).filter((x) => !/^[0\s/.]*$/.test(x.value));
  return {
    name: a.name,
    ...(a.isInnate ? { innate: true } : {}),
    description: clip(a.description, detail.descriptionChars),
    values: Object.fromEntries(
      values.slice(0, detail.valuesPerAbility).map((attr) => [attr.header.replace(/<[^>]+>/g, ""), attr.value])
    ),
    ...(a.notes.length > 0 ? { notes: a.notes.slice(0, detail.notesPerAbility) } : {}),
  };
}

// Invoker's two "Invoked Spell" slots are the same empty placeholder.
function distinctAbilities(abilities: HeroAbility[]): HeroAbility[] {
  return abilities.filter((a, i) => abilities.findIndex((b) => b.name === a.name) === i);
}

// The opponent with the abilities that make it dangerous, so the model
// talks about what the enemy really has instead of inventing traits.
function compactMatchup(m: DraftInsights["bestMatchups"][number]) {
  const threats = heroThreats(m.heroId).slice(0, 2).map(describeThreat);
  return {
    hero: m.heroName,
    games: m.gamesPlayed,
    yourWinRate: `${Math.round(m.winRate * 100)}%`,
    ...(threats.length > 0 ? { dangerous: threats } : {}),
  };
}

// A "hard" matchup the hero wins, or an "easy" one it loses, only confuses the guide.
function matchupsFor(m: DraftInsights) {
  return {
    hardest: m.toughestMatchups.filter((x) => x.winRate < 0.5).slice(0, 4),
    easiest: m.bestMatchups.filter((x) => x.winRate > 0.5).slice(0, 3),
  };
}

export function buildHeroGuidePrompt(args: {
  heroName: string;
  roleLabel: string;
  abilities: HeroAbility[];
  roleOverview: HeroRoleOverview;
  matchups: DraftInsights | null;
  build: HeroBuildOverview | null;
}): string {
  const role = args.roleOverview.roles.find((r) => r.roleLabel === args.roleLabel);
  const matchups = args.matchups ? matchupsFor(args.matchups) : null;
  const write = (detail: Detail) =>
    [
      `Напиши гайд по ${args.heroName} для роли «${args.roleLabel}» и отправь его инструментом submit_hero_guide.`,
      planBlock(args.build, role?.games ?? null, role?.winRate ?? null),
      args.build
        ? buildBlock(args.build, args.abilities, detail)
        : "Данных о сборке этой роли нет (STRATZ недоступен) - не называй никаких предметов, пиши только о способностях и матчапах.",
      replayBlock(args.build),
      args.build ? proBlock(args.build, args.heroName) : "",
      `Способности ${args.heroName} (официальные данные игры; notes - примечания из клиента игры о том, как способность работает на самом деле):\n${JSON.stringify(distinctAbilities(args.abilities).map((a) => compactAbility(a, detail)))}`,
      matchups
        ? `Матчапы (OpenDota, за всё время; yourWinRate - винрейт ${args.heroName} против этого героя, dangerous - опасные способности ПРОТИВНИКА):\n${JSON.stringify({ hardest: matchups.hardest.map(compactMatchup), easiest: matchups.easiest.map(compactMatchup) })}`
        : "",
      args.build
        ? "earlyItems - предметы линии и обувь: зачем и когда альтернатива. itemTips - основа сборки по порядку: что предмет даёт именно этой способности героя и к какой минуте его успеть. lateItems - предметы по ситуации: против чего их брали в разобранных играх. skillTips - почему прокачка из разбора игр такая. tricks - фишки из примечаний к способностям и улучшений Aghanim's."
        : "tricks - фишки из примечаний к способностям и улучшений Aghanim's.",
    ]
      .filter(Boolean)
      .join("\n\n");
  // The most detailed version that fits; the most compact one otherwise.
  let prompt = "";
  for (const detail of DETAIL_LEVELS) {
    prompt = write(detail);
    if (prompt.length <= PROMPT_BUDGET_CHARS) break;
  }
  return prompt;
}

// ---- Checking the model's output ----

// Shorthands players write for items.
const ALIASES: [RegExp, string][] = [[/(?<![A-Za-z])BKB(?![A-Za-z])/, "Black King Bar"]];

// Item names the model writes in Cyrillic despite the rule ("блинк-даггер",
// "глиммер-кейп") - they slip past an English-name check, so a sentence
// with one is dropped.
const TRANSLITERATED_ITEM =
  /(?<!\p{L})(?:блинк|даггер|глиммер|кейп|аэтер|этер-?лен|линз|манта|баттерфля|скади|аганим|мидас|рапир|дагон|мьол|мьел|мелстром|мэлстром|десолят|дезолят|сатаник|абиссал|батл-?фьюр|фьюри|тредс|трэдс|фейз-?бутс|транквил|форс-?стаф|эул|линкен|лотус|шива|хекс|орчид|нуллифа|скипетр|шард|бкб|магическ\p{L}*\s+палоч|магическ\p{L}*\s+палец)/iu;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordRx(name: string, flags = "i"): RegExp {
  return new RegExp(`(?<![A-Za-z])${escapeRegExp(name)}(?![A-Za-z])`, flags);
}

// Every real item name, longest first so "Aghanim's Scepter" wins over shorter overlaps.
const ITEM_NAMES = getAllItems()
  .filter((i) => i.name.length >= 4)
  .map((i) => i.name)
  .sort((a, b) => b.length - a.length)
  .map((name) => ({ name, rx: wordRx(name) }));

function itemsNamed(text: string): { names: string[]; rest: string } {
  const found = new Set<string>();
  let rest = text;
  for (const [rx, name] of ALIASES) if (rx.test(rest)) found.add(name);
  for (const { name, rx } of ITEM_NAMES) {
    if (rx.test(rest)) {
      found.add(name);
      rest = rest.replace(new RegExp(rx.source, "gi"), " ");
    }
  }
  return { names: [...found], rest };
}

let abilityRxCache: { name: string; rx: RegExp }[] | null = null;
// Longest first, each match taken out of the text: "Mana Void" (Anti-Mage)
// must not also read as Night Stalker's "Void".
function abilityNamesIn(text: string): string[] {
  abilityRxCache ??= [...abilityOwners().keys()].sort((a, b) => b.length - a.length).map((name) => ({ name, rx: wordRx(name, "") }));
  const found: string[] = [];
  let rest = text;
  for (const { name, rx } of abilityRxCache) {
    if (!rx.test(rest)) continue;
    found.push(name);
    rest = rest.replace(new RegExp(rx.source, "g"), " ");
  }
  return found;
}

interface Checks {
  // Item names (lower case) the guide may name.
  allowedItems: Set<string>;
  heroId: number;
  // The hero's own ability names.
  heroAbilities: string[];
  // Matchup heroes by name -> id.
  matchupHeroes: Map<string, number>;
  // Every number in the data the model was given.
  knownNumbers: number[];
}

// A sentence survives when every item it names is in the data, it writes no
// item in Cyrillic, every ability it names belongs to the guide's hero or to
// an opponent named in the same text, and every big number in it (damage,
// range) is one from the data.
function sentenceOk(sentence: string, text: string, c: Checks): boolean {
  if (TRANSLITERATED_ITEM.test(sentence)) return false;
  const { names, rest } = itemsNamed(sentence);
  if (names.some((n) => !c.allowedItems.has(n.toLowerCase()))) return false;
  const enemies = [...c.matchupHeroes.entries()].filter(([name]) => wordRx(name, "").test(text)).map(([, id]) => id);
  for (const ability of abilityNamesIn(rest)) {
    const heroes = abilityOwners().get(ability)!;
    if (!heroes.has(c.heroId) && !enemies.some((id) => heroes.has(id))) return false;
  }
  return extractNumbers(sentence).every((n) => n < 100 || c.knownNumbers.some((k) => Math.abs(k - n) <= Math.abs(k) * 0.01));
}

// Names one of the hero's abilities, an item from its data or a matchup
// opponent - otherwise the tip would fit any hero ("следи за картой").
function isSpecific(text: string, c: Checks): boolean {
  if (itemsNamed(text).names.some((n) => c.allowedItems.has(n.toLowerCase()))) return true;
  if (c.heroAbilities.some((name) => wordRx(name, "").test(text))) return true;
  return [...c.matchupHeroes.keys()].some((name) => wordRx(name, "").test(text));
}

// Words for what an enemy team has (the trait labels the replays use).
const SITUATION_WORDS = /контрол|магическ|уклонен|невидим|иллюзи|лечени|реген|призван|прыж|блинк|физическ|оглуш|немот|хекс|сайленс/iu;

function hasSituation(text: string): boolean {
  if (SITUATION_WORDS.test(text) || abilityNamesIn(text).length > 0) return true;
  return getAllHeroes().some((h) => wordRx(h.name, "").test(text));
}

// The model writes "криптов" (crypts) for "крипов" (creeps).
function fixWords(text: string): string {
  return text.replace(/(?<!\p{L})крипт(ов|ы|а|ам|ами|ах|у)?(?!\p{L})/giu, (_, end: string | undefined) => `крип${end ?? ""}`);
}

function cleanText(text: string | undefined, c: Checks): string {
  if (!text) return "";
  const fixed = fixWords(keepOriginalNames(text));
  return fixed
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0 && sentenceOk(s, fixed, c))
    .join(" ")
    .trim();
}

// "Против Treant Protector, который имеет способность Earth Spike": an
// ability given to the opponent must really be the opponent's.
const GIVEN_TO_ENEMY = /(?:котор\p{L}+|у него|у неё|у нее)[^.]{0,40}?способност\p{L}*\s+([A-Z][A-Za-z' -]+[A-Za-z])/u;

function matchupOk(f: CoachFinding, c: Checks): boolean {
  const m = GIVEN_TO_ENEMY.exec(f.point);
  if (!m) return true;
  const ability = abilityNamesIn(m[1])[0];
  if (!ability) return true;
  const named = [...c.matchupHeroes.entries()].filter(([name]) => wordRx(name, "").test(f.point)).map(([, id]) => id);
  const heroes = abilityOwners().get(ability)!;
  return named.some((id) => heroes.has(id));
}

export interface RawHeroGuide {
  identity?: string;
  earlyItems?: { item?: string; why?: string }[];
  skillTips?: CoachFinding[];
  itemTips?: { item?: string; ability?: string; why?: string; whatToDo?: string }[];
  lateItems?: { item?: string; when?: string }[];
  tricks?: { ability?: string; trick?: string }[];
  laningTips?: CoachFinding[];
  teamfightTips?: CoachFinding[];
  matchupTips?: CoachFinding[];
}

// Words of a tip without names, to tell when two tips say the same thing.
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\p{Script=Cyrillic}{3,}/gu) ?? []);
}

function similar(a: Set<string>, b: Set<string>): boolean {
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size) >= 0.75;
}

// The 8B model happily repeats one sentence with different hero names.
function distinct<T>(list: T[], text: (item: T) => string): T[] {
  const kept: { item: T; w: Set<string> }[] = [];
  for (const item of list) {
    const w = words(text(item));
    if (!kept.some((k) => similar(k.w, w))) kept.push({ item, w });
  }
  return kept.map((k) => k.item);
}

/**
 * The guide as shown: item and late-item tips are tied to the real build
 * items, tricks to the hero's real abilities, and every sentence is checked
 * for items outside the data, transliterated names, abilities given to the
 * wrong hero and invented numbers. A tip that names nothing of this hero's is
 * dropped as generic.
 */
export function assembleHeroGuide(
  raw: RawHeroGuide,
  args: {
    heroId: number;
    position: string;
    roleLabel: string;
    abilities: HeroAbility[];
    build: HeroBuildOverview | null;
    matchups: DraftInsights | null;
    // The data the model was given: every number in a tip must come from it.
    source: string;
  }
): HeroGuideReport {
  const grounded = groundedIn(args.source);
  const build = args.build;
  const allowedItems = new Set<string>();
  for (const i of build
    ? [
        ...build.startingItems,
        ...build.earlyItems,
        ...build.boots,
        ...build.coreProgression,
        ...build.situationalItems,
        ...build.proItems,
        ...(build.replays?.situational ?? []),
        ...(build.replays?.paths.flatMap((p) => p.items) ?? []),
      ]
    : []) {
    allowedItems.add(i.itemName.toLowerCase());
    for (const b of (i as ItemProgressionPoint).builtFrom ?? []) allowedItems.add(b.itemName.toLowerCase());
  }
  // Opponents the guide may talk about: the matchups and the enemies the
  // replays bought situational items against.
  const matchupHeroes = new Map<string, number>();
  if (args.matchups) {
    const m = matchupsFor(args.matchups);
    for (const x of [...m.hardest, ...m.easiest]) matchupHeroes.set(x.heroName, x.heroId);
  }
  for (const s of build?.replays?.situational ?? []) for (const e of s.enemies) matchupHeroes.set(e.heroName, e.heroId);
  const heroAbilities = args.abilities.map((a) => a.name);
  const checks: Checks = {
    allowedItems,
    heroId: args.heroId,
    heroAbilities,
    matchupHeroes,
    knownNumbers: extractNumbers(args.source),
  };

  const findings = (list: CoachFinding[] | undefined, extra?: (f: CoachFinding) => boolean): CoachFinding[] =>
    distinct(
      (list ?? [])
        .filter((f) => f?.point && f?.metric)
        .map((f) => ({ point: cleanText(f.point, checks), metric: fixWords(keepOriginalNames(f.metric)) }))
        .filter((f) => f.point.length > 0 && isSpecific(f.point, checks) && grounded(f) && (!extra || extra(f))),
      (f) => f.point
    );

  const core = new Map(spineItems(build).map((i) => [i.itemName, i]));
  const seen = new Set<string>();
  const itemTips: HeroGuideItemTip[] = [];
  for (const t of raw.itemTips ?? []) {
    const item = t?.item ? core.get(t.item) : undefined;
    if (!item || seen.has(item.itemKey)) continue;
    const why = cleanText(t.why, checks);
    if (!why) continue;
    seen.add(item.itemKey);
    itemTips.push({
      itemKey: item.itemKey,
      itemName: item.itemName,
      abilityName: t.ability && heroAbilities.includes(t.ability) ? t.ability : null,
      why,
      whatToDo: cleanText(t.whatToDo, checks),
    });
  }
  // The build's own order, not the order the model happened to write them in.
  const order = [...core.values()].map((i) => i.itemKey);
  itemTips.sort((a, b) => order.indexOf(a.itemKey) - order.indexOf(b.itemKey));

  const laning = new Map(laningItems(build).flatMap((e) => [e.item, ...e.alternatives]).map((i) => [i.itemName, i]));
  const earlyItems: HeroGuideEarlyItem[] = [];
  for (const t of raw.earlyItems ?? []) {
    const item = t?.item ? laning.get(t.item) : undefined;
    if (!item || earlyItems.some((e) => e.itemKey === item.itemKey)) continue;
    const why = cleanText(t.why, checks);
    if (why) earlyItems.push({ itemKey: item.itemKey, itemName: item.itemName, why });
  }

  // A situational pick needs its situation: an opponent, an enemy ability or
  // what the enemy team has - not "когда нужно".
  const late = new Map(situationalChoices(build).slice(0, MAX_SITUATIONAL).map((c) => [c.itemName, c]));
  const lateItems: HeroGuideLateItem[] = [];
  for (const t of raw.lateItems ?? []) {
    const item = t?.item ? late.get(t.item) : undefined;
    if (!item || lateItems.some((l) => l.itemKey === item.itemKey)) continue;
    const when = cleanText(t.when, checks);
    if (when && hasSituation(when)) lateItems.push({ itemKey: item.itemKey, itemName: item.itemName, when });
  }

  const tricks: HeroGuideTrick[] = distinct(
    (raw.tricks ?? []).flatMap((t) => {
      if (!t?.ability || !heroAbilities.includes(t.ability)) return [];
      const text = cleanText(t.trick, checks);
      return text && isSpecific(text, checks) ? [{ abilityName: t.ability, text }] : [];
    }),
    (t) => t.text
  );

  return {
    identity: cleanText(raw.identity, checks),
    position: args.position,
    roleLabel: args.roleLabel,
    earlyItems,
    itemTips,
    lateItems,
    skillTips: findings(raw.skillTips),
    tricks,
    laningTips: findings(raw.laningTips),
    teamfightTips: findings(raw.teamfightTips),
    matchupTips: findings(raw.matchupTips, (f) => matchupOk(f, checks)),
  };
}
