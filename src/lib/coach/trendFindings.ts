import { pluralRu } from "../format";
import type { CoachFinding, CrossMatchPatterns, TrendMetrics } from "../types";
import { principleFor, principleForAnyRole, type CauseCode } from "./principles";

interface TrendCause {
  code: CauseCode;
  severity: number;
  metric: string;
  target?: string;
}

function num(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function ofGames(count: number): string {
  return `из ${count} ${pluralRu(count, ["игры", "игр", "игр"])}`;
}

// The position played most in the parsed games - decides which role's
// version of a coaching principle applies.
function mainPosition(p: CrossMatchPatterns): number | null {
  const top = Object.entries(p.positions).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] * 2 > p.parsedGamesSampled ? Number(top[0]) : null;
}

/**
 * What to work on across games, worked out in code - the same approach as the
 * single-match priorities: a verified recurring problem, what a strong coach
 * teaches for it (for the player's main role) and a goal taken from the
 * player's own better games. The local model wrote these as "улучшите
 * умение управлять ситуацией в боях"; a goal like "не больше 8 смертей за
 * игру - как в твоих победах" can actually be acted on and checked.
 */
export function trendPriorities(metrics: TrendMetrics, patterns: CrossMatchPatterns): CoachFinding[] {
  const causes: TrendCause[] = [];
  const position = mainPosition(patterns);
  const core = position === null || position <= 3;
  const split = metrics.winsVsLosses;

  if (split) {
    const { wins: w, losses: l } = split;
    const diff = l.avgDeaths - w.avgDeaths;
    if (diff >= 2) {
      causes.push({
        code: "DEAD_TIME",
        severity: 50 + diff * 10,
        metric: `Смертей за игру: ${num(w.avgDeaths)} в победах против ${num(l.avgDeaths)} в поражениях.`,
        target: `не больше ${Math.round(w.avgDeaths)} ${pluralRu(Math.round(w.avgDeaths), ["смерти", "смертей", "смертей"])} за игру - как в твоих победах (в поражениях - ${num(l.avgDeaths)})`,
      });
    }
    if (core && w.avgGpm !== null && l.avgGpm !== null && l.avgGpm < w.avgGpm * 0.85) {
      causes.push({
        code: "SLOW_FARM",
        severity: 30 + (1 - l.avgGpm / w.avgGpm) * 100,
        metric: `Золота в минуту: ${w.avgGpm} в победах против ${l.avgGpm} в поражениях.`,
        target: `${w.avgGpm}+ золота в минуту - как в твоих победах (в поражениях - ${l.avgGpm})`,
      });
    }
  }

  const games = patterns.parsedGamesSampled;
  const d = patterns.deaths;
  if (games >= 2 && d.total >= 8 && d.outsideFights / d.total >= 0.3) {
    const perGame = d.outsideFights / games;
    causes.push({
      code: "PICKED_OFF",
      severity: 30 + (d.outsideFights / d.total) * 60,
      metric: `Смертей вне драк, в одиночку: ${d.outsideFights} из ${d.total} в ${games} разобранных играх (${Math.round((d.outsideFights / d.total) * 100)}%).`,
      target: `не больше 1 смерти в одиночку за игру (сейчас - ${num(perGame)} за игру)`,
    });
  }
  if (games >= 2 && d.gamesWithRoughLane * 2 >= games) {
    causes.push({
      code: "EARLY_DEATHS",
      severity: 40 + d.gamesWithRoughLane * 10,
      metric: `2 и больше смертей до ${patterns.laneEndLabel} - в ${d.gamesWithRoughLane} ${ofGames(games)}.`,
      target: `не больше 1 смерти до ${patterns.laneEndLabel} (сейчас ${num(d.beforeLaneEnd / games)} за игру)`,
    });
  }
  const lh = patterns.laneLastHits;
  if (lh.sampledGames >= 2 && lh.behind * 2 > lh.sampledGames) {
    causes.push({
      code: "CS_DEFICIT",
      severity: 35 + lh.behind * 5,
      metric: `Добивания на ${patterns.laneEndLabel} против врага на той же позиции: позади в ${lh.behind} ${ofGames(lh.sampledGames)}.`,
      target: `к ${patterns.laneEndLabel} не меньше добиваний, чем у врага на твоей позиции`,
    });
  }
  const killer = patterns.recurringKillers[0];
  if (killer && killer.deaths >= 4) {
    causes.push({
      code: "REPEAT_KILLER",
      severity: 20 + killer.deaths * 3,
      metric: `${killer.killerHeroName} убивал тебя в ${killer.games} разных играх - ${killer.deaths} ${pluralRu(killer.deaths, ["смерть", "смерти", "смертей"])}.`,
    });
  }

  const seen = new Set<CauseCode>();
  const priorities: CoachFinding[] = [];
  for (const cause of causes.sort((a, b) => b.severity - a.severity)) {
    if (seen.has(cause.code)) continue;
    const point = position !== null ? principleFor(cause.code, position) : principleForAnyRole(cause.code);
    if (!point) continue;
    seen.add(cause.code);
    priorities.push({ point, metric: cause.metric, ...(cause.target ? { target: cause.target } : {}) });
    if (priorities.length === 3) break;
  }
  return priorities;
}

/**
 * What the player reliably does well, from the same verified data. The model
 * kept listing "fewer deaths in wins than in losses" as a strength - that's
 * the difference between good and bad games, not something done well.
 */
export function trendStrengths(metrics: TrendMetrics, patterns: CrossMatchPatterns): CoachFinding[] {
  const strengths: CoachFinding[] = [];
  const best = metrics.topHeroes[0];
  if (best && best.winRate >= 0.55) {
    strengths.push({
      point: `${best.heroName} - твой самый надёжный герой за последние ${metrics.heroWindowDays} дней: на нём стоит играть важные игры.`,
      metric: `${best.heroName}: ${best.games} ${pluralRu(best.games, ["игра", "игры", "игр"])}, ${Math.round(best.winRate * 100)}% побед`,
    });
  }
  const d = patterns.deaths;
  if (patterns.parsedGamesSampled >= 2 && d.total >= 6 && d.beforeLaneEnd / d.total <= 0.15) {
    strengths.push({
      point: `Линию ты проходишь без лишних смертей - проблемы начинаются позже.`,
      metric: `Смертей до ${patterns.laneEndLabel}: ${d.beforeLaneEnd} из ${d.total} (${Math.round((d.beforeLaneEnd / d.total) * 100)}%)`,
    });
  }
  const nw = patterns.laneNetWorth;
  if (nw.sampledGames >= 2 && (nw.ahead + nw.tied) * 3 >= nw.sampledGames * 2 && nw.ahead >= nw.behind) {
    strengths.push({
      point: "На линии ты обычно не уступаешь врагу на своей позиции.",
      metric: `Нетворс на ${patterns.laneEndLabel} против врага на той же позиции: впереди в ${nw.ahead}, наравне в ${nw.tied}, позади в ${nw.behind} ${ofGames(nw.sampledGames)}`,
    });
  }
  return strengths;
}
