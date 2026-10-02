import type {
  CrossMatchPatterns,
  DraftInsights,
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

function formatLaneTally(tally: { ahead: number; behind: number; tied: number; sampledGames: number }): string {
  if (tally.sampledGames === 0) return "в выбранных играх нет реальных данных о сопернике по линии";
  return `впереди в ${tally.ahead}, позади в ${tally.behind}, наравне в ${tally.tied} из ${tally.sampledGames} игр с реальными данными о сопернике по линии`;
}

export function buildTrendCoachPrompt(
  metrics: TrendMetrics,
  patterns: CrossMatchPatterns
): string {
  const hasPatternData = patterns.parsedGamesSampled > 0;

  return `Вот обобщённые данные по последним ${metrics.sampleSize} матчам этого игрока. Составь отчёт тренера на русском языке через инструмент submit_coaching_report, сосредоточившись на повторяющихся закономерностях, а не на одной игре - на том, что раз за разом происходит в его реальных матчах.

${
  hasPatternData
    ? `Реальные закономерности, найденные в последних ${patterns.parsedGamesSampled} полностью разобранных матчах этого игрока (ничего не угадано - неразобранные OpenDota матчи сюда просто не попадают):
- Повторяющиеся убийцы: герои, которые убивали этого игрока больше одного раза, начиная с самого частого: ${patterns.recurringKillers.length > 0 ? JSON.stringify(patterns.recurringKillers) : "повторов нет"}. Герой, встречающийся 3+ раза, - реальная закономерность, которую стоит назвать, а не совпадение.
- Добивания на 10-й минуте против реального соперника по линии: ${formatLaneTally(patterns.laneLastHits)}.
- Золото на 10-й минуте против реального соперника по линии: ${formatLaneTally(patterns.laneGold)}.

ОБЯЗАТЕЛЬНО: хотя бы одна сильная сторона или слабость и хотя бы один совет ДОЛЖНЫ быть построены на этих данных, с точными числами (например: «тебя 7 раз убил Snapfire в последних 3 разобранных матчах» или «ты был впереди по золоту на линии во всех 3 играх»). Пиши это в поле "metric" коротко и по-русски (например: «Snapfire 7 раз, Legion Commander 6 раз, Juggernaut 5 раз») - никогда не вставляй сырой JSON-массив. Это реальная личная повторяющаяся закономерность, и она важнее общей статистики ниже, которую можно использовать для остального отчёта, но она не должна вытеснять эти находки.

`
    : `Данных о закономерностях нет (ни один из последних матчей ещё не разобран OpenDota полностью) - строй отчёт только на общей статистике ниже и не придумывай повторяющихся закономерностей, которых нет в данных.

`
}Общая статистика по выборке (без списка отдельных матчей - этот отчёт о том, что повторяется, поэтому не выдавай киллы/смерти одной игры за закономерность, если это не подтверждено данными выше):
${JSON.stringify(
  {
    sampleSize: metrics.sampleSize,
    winRate: metrics.winRate,
    avgKda: metrics.avgKda,
    avgGpm: metrics.avgGpm,
    avgXpm: metrics.avgXpm,
    avgDeaths: metrics.avgDeaths,
    roleDistribution: metrics.roleDistribution,
    topHeroes: metrics.topHeroes,
    worstHeroes: metrics.worstHeroes,
  },
  null,
  2
)}`;
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
