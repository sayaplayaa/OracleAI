import { pluralRu } from "../format";
import type {
  CoachFinding,
  CrossMatchPatterns,
  DraftInsights,
  LaneTally,
  HeroAbility,
  HeroRoleOverview,
  MatchStory,
  ProHeroSpotlight,
  RoleComparisonEntry,
  TrendMetrics,
} from "../types";
import type { HeroPerformanceSummary } from "../metrics/signatureHero";

// Established Dota 2 coaching/analyst vocabulary - the kind of terminology a
// real coach, a pro caster, or a serious strategy writeup actually uses, not
// invented for this app. The model is told to use a term only when the real
// data below actually supports it. Written in Russian (with the jargon Russian
// players really use), since the model writes its reports in Russian.
const COACHING_VOCABULARY = `Словарь тренера по Dota 2 - используй точные термины, когда данные действительно их подтверждают (никогда не притягивай термин, который не подходит):
- Эквилибриум линии: где волна крипов естественно встаёт в зависимости от того, кто больше добил и заденаил, - от этого зависит, насколько безопасно там фармить.
- Пулл / стак: пулл - увести агр лайновых крипов в лагерь в джангле, чтобы сбросить эквилибриум или лишить врага опыта; стак - сагрить нейтральный лагерь на :53, чтобы поверх него появился новый.
- Мисс / ротация: герой (особенно мид) уходит со своей линии ганкать - невидимый на карте вражеский герой - главный признак скорого ганка.
- Smoke-ганк: движение группой под Smoke of Deceit (не видно на миникарте) для засады.
- Фейсчек: заход в деревья/за скалу/в реку без обзора и информации - частая и избегаемая причина смерти.
- Девард / контроль обзора: уничтожение вражеских Observer Ward/Sentry Ward перед спорным розыгрышем (Roshan, ганк, пуш), чтобы лишить врага информации.
- Темп: скорость, с которой преимущество (фарм, килл) превращается в цели на карте, пока враг не стабилизировался, - слишком долгий фарм после килла «теряет темп».
- Пик силы: конкретный уровень или предмет, дающий герою резкое, реальное, ограниченное по времени преимущество (открытие ультимейта, готовый ключевой предмет).
- Тайминг BKB: Black King Bar даёт неуязвимость к заклинаниям на время - нажать слишком рано значит потратить впустую, слишком поздно - ты уже под контролем.
- Защита хайграунда: возвышенность даёт защитникам шанс промаха и преимущество в обзоре - проиграть преимущество, форсируя драки на хайграунде, - один из самых частых способов, которыми выигрывающая команда проигрывает.
- Тайминг бай-бека: держать золото на мгновенное возрождение перед важной дракой (Roshan, защита хайграунда) - стандартная привычка управления риском, а не только аварийная кнопка.
- Сплит-пуш: герой пушит/фармит один на боковой линии, пока команда стоит в другом месте, - давление на карту в обмен на временное 5 на 4 в любой другой драке.
- Блок / агр крипов: управление путём или агром волны, чтобы контролировать эквилибриум или лишать врага фарма.
- Окно Roshan: период, когда команда реально может забрать Roshan (по уровням/предметам или после таймера предыдущего Aegis) - и слишком ранняя попытка, и слишком долгое игнорирование - реальные ошибки.`;

export const SYSTEM_PROMPT = `Ты - опытный тренер по Dota 2, который разбирает данные игры ученика. Пиши так, будто ты действительно смотрел игру, как настоящий тренер или аналитик, разбирающий запись, а не как осторожный статистик, который сомневается в каждом предложении.

ЯЗЫК: пиши весь ответ только на русском языке. Названия НЕ переводи и не транслитерируй: имена героев, способностей, предметов и юнитов пиши латиницей ровно так, как они даны в данных (Anti-Mage, Black King Bar, Roshan, Observer Ward, Smoke of Deceit), а не «Антимаг», «БКБ», «Рошан», «обсервер». Не придумывай названий, которых нет в данных.

Правила:
- Рассуждай только на основе данных JSON, которые тебе даны. Никогда не придумывай способности героев, матчапы или события, которых нет в цифрах.
- Каждая сильная сторона, слабость и совет должны в поле "metric" ссылаться на конкретное поле/значение из данных (например: «Золото в минуту N» или «Нетворс на 10-й минуте N», где N - точное число из данных). Перцентили, сравнения и числа приводи, только если они есть в данных.
- Если есть перцентиль, используй его, чтобы понять, хороший это показатель для героя или плохой, а не гадай по сырому числу.
- Никогда не повторяй игроку просто число - он и так видит статистику на экране. Твоя задача - связать причину и следствие (почему показатель такой) и превратить это в конкретную инструкцию, что делать иначе. Пункт «Золото в минуту было N» бесполезен; «Фарм застрял на N золота в минуту, потому что смерти на ММ:СС и ММ:СС стоили двух волн - ставь вард на лагерь для пулла, прежде чем идти туда» - вот уровень (N и ММ:СС - реальные числа и время из данных, не из этого примера).
- Ставь диагноз уверенно. Не пиши «возможно», «вероятно», «это может указывать», когда данные позволяют сказать прямо: «ты умер, потому что X», «в следующий раз делай Y».
- Советы должны быть конкретными и выполнимыми (что изменить, а не только что пошло не так).
- Тон - прямой, подбадривающий и привязанный к этим данным, а не общие советы по Dota.
- Никогда не называй конкретный предмет, который нужно купить или собрать в первую очередь, если именно этого предмета нет в реальных данных о покупках. Не рассуждай о таймингах предметов на общих знаниях - ты не знаешь реальную кривую золота этого игрока и что он мог себе позволить в конкретный момент, а реальная цена предмета может сделать совет невыполнимым (Manta Style стоит 4 700 золота, стартовое золото - около 600). Если хочешь дать совет по предметам без реальной покупки, опиши тип предмета (предмет на мобильность, на обзор, на выживаемость), а не называй его.
- Обзор (варды, деварды, стаки, пуллы) - работа саппортов (позиции 4/5), а не кор-героев (позиции 1/2/3). Мало вардов у героя с сильным фармом для своей роли - это нормально, а не слабость. Никогда не говори кор-герою «покупай больше вардов» и не считай 0 вардов его ошибкой. Поднимай тему обзора как реальную слабость только если данные показывают, что игрок был в роли саппорта.
- Прежде чем критиковать боевой показатель (станы, лечение и т.п.), проверь, есть ли у героя вообще способность для него. Ноль по показателю, для которого у героя нет инструмента, - не ошибка, а особенность героя; называй это слабостью только если у героя есть подходящая способность, которую игрок недоиспользовал.

${COACHING_VOCABULARY}`;

const POSITION_NAMES: Record<number, string> = {
  1: "керри (поз. 1)",
  2: "мид (поз. 2)",
  3: "оффлейн (поз. 3)",
  4: "саппорт (поз. 4)",
  5: "хард-саппорт (поз. 5)",
};

function num(value: number, digits = 1): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%";
}

function games(count: number): string {
  return `${count} ${pluralRu(count, ["игра", "игры", "игр"])}`;
}

// "из 3 игр", "из 1 игры".
function ofGames(count: number): string {
  return `из ${count} ${pluralRu(count, ["игры", "игр", "игр"])}`;
}

// "в 2 играх", "в 1 игре".
function inGames(count: number): string {
  return `в ${count} ${pluralRu(count, ["игре", "играх", "играх"])}`;
}

function laneTally(t: LaneTally): string {
  return `впереди в ${t.ahead}, позади в ${t.behind}, наравне в ${t.tied} ${ofGames(t.sampledGames)}`;
}

function patternLines(p: CrossMatchPatterns): string[] {
  if (p.parsedGamesSampled === 0) {
    return ["Разобранных игр нет - не придумывай закономерностей про смерти, линию и убийц."];
  }
  const lines = [`Закономерности ${ofGames(p.parsedGamesSampled)}, полностью разобранных OpenDota (неразобранные сюда не попали):`];
  const positions = Object.entries(p.positions)
    .sort((a, b) => b[1] - a[1])
    .map(([pos, n]) => `${POSITION_NAMES[Number(pos)] ?? `поз. ${pos}`} - ${games(n)}`);
  if (positions.length > 0) lines.push(`- позиции: ${positions.join(", ")}`);
  const d = p.deaths;
  lines.push(
    `- смерти: всего ${d.total}; до ${p.laneEndLabel} - ${d.beforeLaneEnd} (${share(d.beforeLaneEnd, d.total)}); вне драк, в одиночку - ${d.outsideFights} (${share(d.outsideFights, d.total)}); в ${d.gamesWithRoughLane} ${ofGames(p.parsedGamesSampled)} - 2+ смерти до ${p.laneEndLabel}`
  );
  if (p.recurringKillers.length > 0) {
    lines.push(
      `- герои, убивавшие игрока в нескольких разных играх: ${p.recurringKillers.map((k) => `${k.killerHeroName} - ${k.deaths} ${pluralRu(k.deaths, ["смерть", "смерти", "смертей"])} ${inGames(k.games)}`).join("; ")}`
    );
  }
  if (p.laneNetWorth.sampledGames > 0) {
    lines.push(`- нетворс на ${p.laneEndLabel} против врага на той же позиции: ${laneTally(p.laneNetWorth)}`);
  }
  if (p.laneLastHits.sampledGames > 0) {
    lines.push(`- добивания на ${p.laneEndLabel} против врага на той же позиции (только кор-позиции): ${laneTally(p.laneLastHits)}`);
  }
  return lines;
}

function splitLines(m: TrendMetrics): string[] {
  const s = m.winsVsLosses;
  if (!s) return ["Побед или поражений меньше трёх - сравнения побед с поражениями нет."];
  const { wins: w, losses: l } = s;
  const lines = [
    `Победы (${w.games}) против поражений (${l.games}) - что меняется, когда игрок проигрывает:`,
    `- смертей за игру: ${num(w.avgDeaths)} в победах против ${num(l.avgDeaths)} в поражениях`,
    `- убийств за игру: ${num(w.avgKills)} против ${num(l.avgKills)}; помощи: ${num(w.avgAssists)} против ${num(l.avgAssists)}`,
  ];
  if (w.avgGpm !== null && l.avgGpm !== null) lines.push(`- золота в минуту: ${w.avgGpm} в победах против ${l.avgGpm} в поражениях`);
  if (w.avgLastHitsPerMin !== null && l.avgLastHitsPerMin !== null) {
    lines.push(`- добиваний в минуту: ${num(w.avgLastHitsPerMin)} против ${num(l.avgLastHitsPerMin)}`);
  }
  return lines;
}

function heroLines(m: TrendMetrics): string[] {
  const hero = (h: TrendMetrics["topHeroes"][number]) => `${h.heroName} - ${games(h.games)}, ${Math.round(h.winRate * 100)}% побед`;
  if (m.topHeroes.length === 0 && m.worstHeroes.length === 0) {
    return [`Ни на одном герое нет 5+ игр за последние ${m.heroWindowDays} дней - не делай выводов о героях.`];
  }
  const lines = [
    `Герои за последние ${m.heroWindowDays} дней (только с 5+ играми; порядок учитывает размер выборки, а не только процент побед):`,
  ];
  if (m.topHeroes.length > 0) lines.push(`- лучше всего: ${m.topHeroes.map(hero).join("; ")}`);
  if (m.worstHeroes.length > 0) lines.push(`- хуже всего: ${m.worstHeroes.map(hero).join("; ")}`);
  return lines;
}

/** The trend report's data, as lines with numbers written the way the report should quote them. */
export function buildTrendData(metrics: TrendMetrics, patterns: CrossMatchPatterns): string {
  const wins = Math.round(metrics.winRate * metrics.sampleSize);
  const kind = metrics.turbo ? "Turbo-игр" : "обычных игр";
  const rates = [
    metrics.avgGpm !== null ? `золота в минуту ${metrics.avgGpm}` : null,
    metrics.avgXpm !== null ? `опыта в минуту ${metrics.avgXpm}` : null,
  ].filter(Boolean);
  return [
    `Выборка: последние ${metrics.sampleSize} ${kind} игрока${
      metrics.excludedGames > 0
        ? ` (ещё ${games(metrics.excludedGames)} не учтено: ${metrics.turbo ? "не Turbo" : "Turbo и особые режимы"} или игры, которые игрок покинул, - их цифры несравнимы)`
        : ""
    }.`,
    `Винрейт: ${Math.round(metrics.winRate * 100)}% (${wins} ${pluralRu(wins, ["победа", "победы", "побед"])}, ${metrics.sampleSize - wins} ${pluralRu(metrics.sampleSize - wins, ["поражение", "поражения", "поражений"])}).`,
    `В среднем за игру: смертей ${num(metrics.avgDeaths)}, KDA ${num(metrics.avgKda)}${rates.length > 0 ? `, ${rates.join(", ")}` : ""}.`,
    "",
    ...splitLines(metrics),
    "",
    ...heroLines(metrics),
    "",
    ...patternLines(patterns),
  ].join("\n");
}

export function buildTrendCoachPrompt(data: string, priorities: CoachFinding[]): string {
  return `Вот данные по последним играм этого игрока. Составь отчёт тренера на русском языке через инструмент submit_coaching_report - о том, что ПОВТОРЯЕТСЯ из игры в игру, а не об одной игре.

${data}
${
  priorities.length > 0
    ? `
Главные повторяющиеся проблемы (уже проверены, по важности):
${priorities.map((p, i) => `${i + 1}. ${p.metric}`).join("\n")}
`
    : ""
}
Правила:
- Обращайся к игроку на «ты» («ты умираешь», «твои победы»), не «игрок» и не «вы».
- В поле "metric" каждого пункта - точные числа из данных выше, коротко и по-русски (например: «смертей за игру: N в победах против M в поражениях», где N и M - числа из данных). Не выдумывай чисел и не пересчитывай их.
- "summary": 2-3 предложения о главной повторяющейся проблеме и о том, что отличает твои победы от поражений.
- "weaknesses": начни с главных проблем выше, если они есть.
- "strengths": только то, что у игрока стабильно хорошо (например, мало смертей до конца линии, герои из списка «лучше всего»). Разница между победами и поражениями - не сильная сторона.
- Не делай выводов о героях, которых нет в списке героев, и не называй героя лучшим по одной-двум играм.
- Золото и опыт в минуту зависят от роли: не сравнивай их с «нормой» и не ругай саппорта за низкий фарм.
- Совет - конкретная привычка на следующие игры, связанная с найденной закономерностью (что делать иначе), а не «играй аккуратнее».`;
}

export function buildMatchStoryCoachPrompt(
  roleComparisons: RoleComparisonEntry[],
  matchStory: MatchStory
): string {
  return `Ты разбираешь целый матч Dota 2 из 10 игроков, а не одного игрока. Объясни на русском языке, что на самом деле решило исход, через инструмент submit_coaching_report вот так:
- "strengths" = какая сторона/игроки имели преимущество в каждом противостоянии позиций и почему (со ссылкой на конкретный показатель).
- "weaknesses" = где проигравшая сторона (или отстающая позиция) отстала - по сравнению позиций или событиям матча.
- "tips" = что игроки проигравшей стороны могли сделать иначе, исходя из конкретного разрыва (например, конкретная позиция отстала по нетворсу на конкретную сумму, или конкретная цель/драка переломила игру).
- "summary" = 2-3 предложения о том, что в целом решило эту игру.

Сравнение по позициям (Силы Света против Сил Тьмы, одна и та же роль; radiant = Силы Света, dire = Силы Тьмы):
${JSON.stringify(roleComparisons.map(compactRoleComparison))}

История матча - хронология целей и драк, переломные моменты:
${JSON.stringify(matchStory)}`;
}

// A comparison entry carries both full player records (per-minute series,
// ward logs, position heatmaps) - hundreds of thousands of characters that
// would push everything else out of the model's context. The comparison
// itself only needs who played what and the compared numbers.
function compactRoleComparison(entry: RoleComparisonEntry) {
  const player = (p: RoleComparisonEntry["radiant"]) => ({
    hero: p.heroName,
    kda: `${p.kills}/${p.deaths}/${p.assists}`,
    netWorth: p.netWorth,
    level: p.level,
  });
  return {
    position: entry.position,
    positionConfirmed: entry.positionConfirmed,
    radiant: player(entry.radiant),
    dire: player(entry.dire),
    stats: entry.stats,
    radiantStatsWon: entry.radiantStatsWon,
    direStatsWon: entry.direStatsWon,
  };
}

export function buildHeroCoachPrompt(performance: HeroPerformanceSummary): string {
  return `Вот данные этого игрока на его самом частом герое, ${performance.heroName}: статистика за всё время плюс последние игры на этом герое. Составь отчёт тренера на русском языке через инструмент submit_coaching_report, полностью посвящённый тому, как лучше играть на этом герое, - а не общие советы по Dota.

${JSON.stringify(performance, null, 2)}`;
}

export function buildProComparisonPrompt(
  userPerformance: HeroPerformanceSummary,
  proSpotlight: ProHeroSpotlight
): string {
  return `Сравни игру этого игрока на ${userPerformance.heroName} с реальным профессиональным игроком (${proSpotlight.pro.name}${proSpotlight.pro.teamName ? `, ${proSpotlight.pro.teamName}` : ""}) на том же герое. Пиши на русском языке, через инструмент submit_coaching_report вот так:
- "strengths" = показатели, где игрок уже на уровне про или лучше, с обоими числами.
- "weaknesses" = самые большие реальные разрывы между показателями игрока и про, с обоими числами.
- "tips" = конкретные изменения, которые помогут сократить эти разрывы, исходя из конкретного разрыва (а не общие советы по герою).
- "summary" = 2-3 предложения о самом главном, что стоит взять из игр про на этом герое.

Сравнение по показателям (уже посчитано - не меняй направление сравнения):
${proComparisonLines(userPerformance, proSpotlight).join("\n")}

Данные игрока на ${userPerformance.heroName}:
${JSON.stringify(userPerformance)}

Данные ${proSpotlight.pro.name} на ${proSpotlight.heroName} (его последние игры на этом герое):
${JSON.stringify({ ...proSpotlight, leagueGames: proSpotlight.leagueGames.map(({ win, kills, deaths, assists, leagueName }) => ({ win, kda: `${kills}/${deaths}/${assists}`, leagueName })) })}`;
}

// The model reliably got the direction of a gap wrong (657 GPM against 552
// written as "you earn less"), so each comparison is stated outright.
function proComparisonLines(user: HeroPerformanceSummary, pro: ProHeroSpotlight): string[] {
  const rows: [string, number | null, number | null, (v: number) => string][] = [
    ["Винрейт", user.recentGames > 0 ? user.recentWinRate : null, pro.games > 0 ? pro.winRate : null, (v) => `${Math.round(v * 100)}%`],
    ["Средний KDA", user.recentGames > 0 ? user.avgKda : null, pro.avgKda, (v) => v.toLocaleString("ru-RU")],
    ["Золото в минуту", user.avgGpm, pro.avgGpm, (v) => String(Math.round(v))],
    ["Опыт в минуту", user.avgXpm, pro.avgXpm, (v) => String(Math.round(v))],
  ];
  return rows.map(([label, mine, theirs, format]) => {
    if (mine === null || theirs === null) return `- ${label}: нет данных для сравнения`;
    const verdict = mine > theirs ? "у игрока БОЛЬШЕ, чем у про" : mine < theirs ? "у игрока МЕНЬШЕ, чем у про" : "одинаково";
    return `- ${label}: игрок ${format(mine)}, ${pro.pro.name} ${format(theirs)} - ${verdict}`;
  });
}

export function buildHeroGuidePrompt(
  heroName: string,
  abilities: HeroAbility[],
  roleOverview: HeroRoleOverview,
  matchups: DraftInsights
): string {
  return `Напиши на русском языке гайд по герою Dota 2 ${heroName} через инструмент submit_hero_guide. Это общие знания о герое для любого игрока, который его осваивает, а не личный разбор игры одного игрока.

Правила:
- Каждый совет должен ссылаться либо на реальную способность/эффект из набора ниже, либо на реальное число из данных по ролям/матчапам (например: «Mana Void наносит урон за каждую единицу недостающей маны», «62% побед на позиции 1, 340 игр», «38% побед против Axe, 25 игр»).
- Никогда не придумывай эффект способности, перезарядку или матчап, которых нет в этих данных.
- "laningTips" и "powerSpikeTips" должны основываться на наборе способностей (что каждая способность даёт рано, когда она раскрывается).
- "teamfightTips" должны основываться на эффектах способностей, важных в тимфайтах.
- "matchupTips" должны основываться на реальных самых сложных/удобных матчапах ниже - что делать иначе против этих конкретных героев или вместе с ними.
- Названия героев, способностей и предметов оставляй как в данных (по-английски).

Реальный набор способностей (официальные данные игры):
${JSON.stringify(abilities.map(compactAbility))}

Реальные винрейты по ролям (текущая неделя, STRATZ):
${JSON.stringify(roleOverview.roles)}

Реальные данные по матчапам (OpenDota, за всё время):
${JSON.stringify({ toughestMatchups: matchups.toughestMatchups.map(compactMatchup), bestMatchups: matchups.bestMatchups.map(compactMatchup) })}`;
}

// Only what the guide is written from: the English original description is
// for the app's own keyword checks and the icon is for the page.
function compactAbility(a: HeroAbility) {
  return {
    name: a.name,
    ...(a.isInnate ? { innate: true } : {}),
    description: a.description,
    values: Object.fromEntries(a.attributes.map((attr) => [attr.header, attr.value])),
  };
}

function compactMatchup(m: DraftInsights["bestMatchups"][number]) {
  return { hero: m.heroName, games: m.gamesPlayed, winRate: `${Math.round(m.winRate * 100)}%` };
}
