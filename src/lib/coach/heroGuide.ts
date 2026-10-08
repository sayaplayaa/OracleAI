// The AI hero guide for one role: written from the hero's real ability kit,
// matchups and the real current build for that role, then checked. Item
// tips pick their item from the build itself; any sentence that names an
// item outside the build (in English or transliterated), or hands an enemy
// an ability it doesn't have, is dropped - the 8B model otherwise fills a
// guide from its own outdated memory.

import { getAllItems, getItemMechanics } from "../constants";
import { groundedIn } from "./grounding";
import { keepOriginalNames } from "./matchPrompt";
import { abilityOwners, describeThreat, heroThreats } from "./threats";
import type {
  CoachFinding,
  DraftInsights,
  HeroAbility,
  HeroBuildOverview,
  HeroGuideItemTip,
  HeroGuideReport,
  HeroRoleOverview,
  ItemProgressionPoint,
} from "../types";

export function buildHeroGuideSystemPrompt(heroName: string, roleLabel: string): string {
  return `Ты - тренер по Dota 2, который пишет гайд по герою ${heroName} для роли «${roleLabel}» - так, как его объяснил бы сильный игрок новичку: что герой делает, какие предметы и почему, как стоять на линии, как играть драки и матчапы.

ЯЗЫК: весь гайд - на русском. Имена героев, способностей и предметов пиши латиницей ровно как в данных (Battle Fury, Mana Void, Black King Bar), без перевода, транслитерации и русских окончаний: «Blink Dagger», а не «блинк-даггер».

Правила:
- Пиши только из данных ниже: набор способностей (официальные данные игры), сборка этой роли (STRATZ, Легенда и выше, текущая неделя) и матчапы. Не придумывай эффектов, чисел и таймингов.
- Предметы: называй ТОЛЬКО предметы из сборки. Что даёт предмет - только по его описанию «Что даёт» в данных, ничего не добавляй от себя.
- Матчапы: yourWinRate - винрейт ТВОЕГО героя против этого противника; hardest - неудобные противники, easiest - удобные. Описывая противника, называй только его способности из поля dangerous - не приписывай ему способностей твоего героя или других героев.
- Каждый совет конкретен и выполним в игре; в поле "metric" - реальное значение из данных (винрейт и число игр для матчапа, значение способности).`;
}

function minutes(seconds: number): string {
  return `к ${Math.max(1, Math.round(seconds / 60))}-й минуте`;
}

function pct(share: number | undefined): string {
  return `${Math.round((share ?? 0) * 100)}%`;
}

function itemLine(i: ItemProgressionPoint, withEffect: boolean): string {
  const from = i.builtFrom && i.builtFrom.length > 0 ? `; через ${i.builtFrom.map((b) => b.itemName).join(", ")}` : "";
  const mechanics = withEffect ? getItemMechanics(i.itemKey) : "";
  return `${i.itemName} (${pct(i.pickRate)} игр, ${minutes(i.avgTimeSeconds)}${from})${mechanics ? `. Что даёт: ${mechanics}` : ""}`;
}

function buildBlock(build: HeroBuildOverview): string {
  const lines = [
    `Сборка роли «${build.roleLabel}» (${build.games.toLocaleString("ru-RU")} игр на Легенде и выше за эту неделю, STRATZ):`,
  ];
  if (build.startingItems.length > 0) {
    lines.push(`- Стартовый закуп: ${build.startingItems.map((i) => (i.copies > 1 ? `${i.itemName} ×${i.copies}` : i.itemName)).join(", ")}.`);
  }
  if (build.earlyItems.length > 0) lines.push(`- Ранние предметы: ${build.earlyItems.map((i) => itemLine(i, false)).join("; ")}.`);
  if (build.boots.length > 0) lines.push(`- Обувь: ${build.boots.slice(0, 2).map((i) => itemLine(i, true)).join("; ")}.`);
  if (build.coreProgression.length > 0) {
    lines.push("- Ключевые предметы по порядку (их собирают в 20% игр и больше):");
    build.coreProgression.forEach((i, n) => lines.push(`  ${n + 1}. ${itemLine(i, true)}`));
  }
  if (build.situationalItems.length > 0) {
    lines.push(`- Ситуативные (реже 20% игр, под матчап): ${build.situationalItems.slice(0, 8).map((i) => `${i.itemName} ${pct(i.pickRate)}`).join(", ")}.`);
  }
  return lines.join("\n");
}

// The items an item tip may be about: the main boots and the core items.
export function guideItems(build: HeroBuildOverview | null): ItemProgressionPoint[] {
  if (!build) return [];
  return [...build.boots.slice(0, 1), ...build.coreProgression];
}

function compactAbility(a: HeroAbility) {
  return {
    name: a.name,
    ...(a.isInnate ? { innate: true } : {}),
    description: a.description,
    values: Object.fromEntries(a.attributes.map((attr) => [attr.header, attr.value])),
  };
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
  return [
    `Напиши гайд по ${args.heroName} для роли «${args.roleLabel}» и отправь его инструментом submit_hero_guide.`,
    role ? `Роль на этой неделе: ${role.games.toLocaleString("ru-RU")} игр, винрейт ${Math.round(role.winRate * 100)}%.` : "",
    args.build
      ? buildBlock(args.build)
      : "Данных о сборке этой роли нет (STRATZ недоступен) - не называй никаких предметов, пиши только о способностях и матчапах.",
    `Набор способностей ${args.heroName} (официальные данные игры):\n${JSON.stringify(args.abilities.map(compactAbility))}`,
    matchups
      ? `Матчапы (OpenDota, за всё время; yourWinRate - винрейт ${args.heroName} против этого героя, dangerous - опасные способности ПРОТИВНИКА):\n${JSON.stringify({ hardest: matchups.hardest.map(compactMatchup), easiest: matchups.easiest.map(compactMatchup) })}`
      : "",
    args.build
      ? "itemTips - про обувь и ключевые предметы в их порядке: why - что предмет даёт этому герою, whatToDo - что делать, когда он куплен."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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
function abilityNamesIn(text: string): string[] {
  abilityRxCache ??= [...abilityOwners().keys()].sort((a, b) => b.length - a.length).map((name) => ({ name, rx: wordRx(name, "") }));
  return abilityRxCache.filter((a) => a.rx.test(text)).map((a) => a.name);
}

interface Checks {
  // Item names (lower case) the guide may name.
  allowedItems: Set<string>;
  heroId: number;
  // Matchup heroes by name -> id.
  matchupHeroes: Map<string, number>;
}

// A sentence survives when every item it names is in the build, it writes no
// item in Cyrillic, and every ability it names belongs to the guide's hero or
// to an opponent named in the same text.
function sentenceOk(sentence: string, text: string, c: Checks): boolean {
  if (TRANSLITERATED_ITEM.test(sentence)) return false;
  const { names, rest } = itemsNamed(sentence);
  if (names.some((n) => !c.allowedItems.has(n.toLowerCase()))) return false;
  const enemies = [...c.matchupHeroes.entries()].filter(([name]) => wordRx(name, "").test(text)).map(([, id]) => id);
  for (const ability of abilityNamesIn(rest)) {
    const heroes = abilityOwners().get(ability)!;
    if (!heroes.has(c.heroId) && !enemies.some((id) => heroes.has(id))) return false;
  }
  return true;
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
  itemTips?: { item?: string; why?: string; whatToDo?: string }[];
  laningTips?: CoachFinding[];
  teamfightTips?: CoachFinding[];
  matchupTips?: CoachFinding[];
}

/**
 * The guide as shown: item tips are tied to the real build items (pick rate
 * and timing come from the data), and every sentence is checked for items
 * outside the build, transliterated names and abilities given to the wrong
 * hero. The build itself comes from the data, not the model.
 */
// Words of a tip without names, to tell when two tips say the same thing.
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\p{Script=Cyrillic}{3,}/gu) ?? []);
}

function similar(a: Set<string>, b: Set<string>): boolean {
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size) >= 0.75;
}

// The 8B model happily repeats one sentence with different hero names.
function distinct(list: CoachFinding[]): CoachFinding[] {
  const kept: { f: CoachFinding; w: Set<string> }[] = [];
  for (const f of list) {
    const w = words(f.point);
    if (!kept.some((k) => similar(k.w, w))) kept.push({ f, w });
  }
  return kept.map((k) => k.f);
}

export function assembleHeroGuide(
  raw: RawHeroGuide,
  args: {
    heroId: number;
    position: string;
    roleLabel: string;
    build: HeroBuildOverview | null;
    matchups: DraftInsights | null;
    // The data the model was given: every number in a tip's metric must come from it.
    source: string;
  }
): HeroGuideReport {
  const grounded = groundedIn(args.source);
  const build = args.build;
  const allowedItems = new Set<string>();
  for (const i of build
    ? [...build.startingItems, ...build.earlyItems, ...build.boots, ...build.coreProgression, ...build.situationalItems]
    : []) {
    allowedItems.add(i.itemName.toLowerCase());
    for (const b of (i as ItemProgressionPoint).builtFrom ?? []) allowedItems.add(b.itemName.toLowerCase());
  }
  const matchupHeroes = new Map<string, number>();
  if (args.matchups) {
    const m = matchupsFor(args.matchups);
    for (const x of [...m.hardest, ...m.easiest]) matchupHeroes.set(x.heroName, x.heroId);
  }
  const checks: Checks = { allowedItems, heroId: args.heroId, matchupHeroes };

  const findings = (list: CoachFinding[] | undefined, extra?: (f: CoachFinding) => boolean): CoachFinding[] =>
    distinct(
      (list ?? [])
        .filter((f) => f?.point && f?.metric)
        .map((f) => ({ point: cleanText(f.point, checks), metric: fixWords(keepOriginalNames(f.metric)) }))
        .filter((f) => f.point.length > 0 && grounded(f) && (!extra || extra(f)))
    );

  const byName = new Map(guideItems(build).map((i) => [i.itemName, i]));
  const seen = new Set<string>();
  const itemTips: HeroGuideItemTip[] = [];
  for (const t of raw.itemTips ?? []) {
    const item = t?.item ? byName.get(t.item) : undefined;
    if (!item || seen.has(item.itemKey)) continue;
    const why = cleanText(t.why, checks);
    if (!why) continue;
    seen.add(item.itemKey);
    itemTips.push({
      itemKey: item.itemKey,
      itemName: item.itemName,
      pickRate: item.pickRate ?? 0,
      avgTimeSeconds: item.avgTimeSeconds,
      why,
      whatToDo: cleanText(t.whatToDo, checks),
    });
  }
  // The build's own order, not the order the model happened to write them in.
  itemTips.sort((a, b) => a.avgTimeSeconds - b.avgTimeSeconds);

  return {
    identity: cleanText(raw.identity, checks),
    position: args.position,
    roleLabel: args.roleLabel,
    build: build ? { games: build.games, earlyItems: build.earlyItems, boots: build.boots, coreProgression: build.coreProgression } : null,
    itemTips,
    laningTips: findings(raw.laningTips),
    teamfightTips: findings(raw.teamfightTips),
    matchupTips: findings(raw.matchupTips, (f) => matchupOk(f, checks)),
  };
}
