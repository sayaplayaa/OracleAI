import { formatStratzPosition } from "../stratz";
import type {
  FullMatchPlayer,
  RoleComparisonEntry,
  RoleComparisonStat,
  StratzMatchPlayerPosition,
} from "../types";

const POSITION_LABELS = ["Position 1", "Position 2", "Position 3", "Position 4", "Position 5"];

/** No external data needed: highest GPM on a team is conventionally the
 * carry (Position 1), lowest is the hard support (Position 5). Imprecise
 * but always available, and labeled "estimated" in the UI. */
function assignPositionsByGpm(players: FullMatchPlayer[]): Map<FullMatchPlayer, string> {
  const sorted = [...players].sort((a, b) => b.gpm - a.gpm);
  const map = new Map<FullMatchPlayer, string>();
  sorted.forEach((p, i) => map.set(p, POSITION_LABELS[i] ?? `Position ${i + 1}`));
  return map;
}

/** Returns null (never a partial map) if any player is missing from STRATZ's
 * data, so callers fall back to the heuristic for every player rather than
 * mixing confirmed and guessed positions. */
function assignPositionsFromStratz(
  players: FullMatchPlayer[],
  stratzPositions: StratzMatchPlayerPosition[]
): Map<FullMatchPlayer, string> | null {
  const map = new Map<FullMatchPlayer, string>();
  for (const player of players) {
    const match = stratzPositions.find(
      (sp) => sp.heroId === player.heroId && sp.isRadiant === player.isRadiant
    );
    if (!match || !match.position) return null;
    map.set(player, formatStratzPosition(match.position));
  }
  return map;
}

function buildStat(
  label: string,
  radiantValue: number,
  direValue: number,
  unit?: string,
  lowerIsBetter = false
): RoleComparisonStat {
  const radiantWins = lowerIsBetter ? radiantValue < direValue : radiantValue > direValue;
  return { label, unit, radiantValue, direValue, radiantWins };
}

export function computeRoleComparisons(
  radiantPlayers: FullMatchPlayer[],
  direPlayers: FullMatchPlayer[],
  stratzPositions: StratzMatchPlayerPosition[] | null
): RoleComparisonEntry[] {
  const allPlayers = [...radiantPlayers, ...direPlayers];
  const stratzMap = stratzPositions
    ? assignPositionsFromStratz(allPlayers, stratzPositions)
    : null;
  const positionConfirmed = stratzMap !== null;

  const positionOf =
    stratzMap ??
    new Map<FullMatchPlayer, string>([
      ...assignPositionsByGpm(radiantPlayers),
      ...assignPositionsByGpm(direPlayers),
    ]);

  const byPosition = new Map<
    string,
    { radiant?: FullMatchPlayer; dire?: FullMatchPlayer }
  >();
  for (const p of radiantPlayers) {
    const pos = positionOf.get(p);
    if (pos) byPosition.set(pos, { ...byPosition.get(pos), radiant: p });
  }
  for (const p of direPlayers) {
    const pos = positionOf.get(p);
    if (pos) byPosition.set(pos, { ...byPosition.get(pos), dire: p });
  }

  const entries: RoleComparisonEntry[] = [];
  for (const label of POSITION_LABELS) {
    const pair = byPosition.get(label);
    if (!pair?.radiant || !pair?.dire) continue;
    const { radiant, dire } = pair;

    const stats: RoleComparisonStat[] = [
      buildStat("Золото в минуту", radiant.gpm, dire.gpm, "зол/мин"),
      buildStat("Опыт в минуту", radiant.xpm, dire.xpm, "оп/мин"),
      buildStat("Нетворс", radiant.netWorth, dire.netWorth),
      buildStat("Убийства", radiant.kills, dire.kills),
      buildStat("Смерти", radiant.deaths, dire.deaths, undefined, true),
      buildStat("Помощи", radiant.assists, dire.assists),
      buildStat("Урон по героям", radiant.heroDamage, dire.heroDamage),
      buildStat("Лечение", radiant.heroHealing, dire.heroHealing),
      buildStat("Добивания", radiant.lastHits, dire.lastHits),
      buildStat("Денаи", radiant.denies, dire.denies),
      buildStat(
        "Поставлено вардов",
        radiant.obsPlaced + radiant.senPlaced,
        dire.obsPlaced + dire.senPlaced
      ),
    ];

    const radiantStatsWon = stats.filter((s) => s.radiantWins).length;

    entries.push({
      position: label,
      positionConfirmed,
      radiant,
      dire,
      stats,
      radiantStatsWon,
      direStatsWon: stats.length - radiantStatsWon,
    });
  }

  return entries;
}
