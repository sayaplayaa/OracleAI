// OpenDota's position grid: x/y both run ~64-190, Radiant's fountain is in the
// bottom-left (~76,76) and Dire's in the top-right (~180,177); the mid lane is
// the x=y diagonal and the river the x+y=const anti-diagonal through ~(127,127).
// Lane bottom = along the bottom and right edges, top = left and top edges.
// Radiant's safe lane is the bottom one, Dire's is the top one.

const CENTER = 127;
const RIVER_HALF_WIDTH = 12;
const MID_LANE_HALF_WIDTH = 14;
const LANE_EDGE_OFFSET = 38;
const BASE_DEPTH = 80;
// Distance past the river into a team's half beyond which it counts as deep
// in their territory (roughly their first tower line and back).
const DEEP_TERRITORY_DEPTH = 45;

export interface MapZone {
  label: string;
  // "own" / "enemy" is relative to the player asking.
  side: "own" | "enemy" | "river";
  deepInEnemyTerritory: boolean;
}

export function classifyZone(x: number, y: number, isRadiant: boolean): MapZone {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const along = dx + dy; // negative = Radiant half
  const across = dx - dy; // positive = bottom-right side, negative = top-left side
  const ownDepth = isRadiant ? -along : along; // positive = own half

  const bottomSide = across > 0;

  if (Math.abs(along) <= RIVER_HALF_WIDTH) {
    const part = Math.abs(across) <= MID_LANE_HALF_WIDTH ? "у мида" : bottomSide ? "низ карты" : "верх карты";
    return { label: `река (${part})`, side: "river", deepInEnemyTerritory: false };
  }

  const side: MapZone["side"] = ownDepth > 0 ? "own" : "enemy";
  // Russian adjectives agree in gender: "своя база", but "свой лес".
  const ownerFem = side === "own" ? "своя" : "вражеская";
  const ownerMasc = side === "own" ? "свой" : "вражеский";
  const deep = side === "enemy" && Math.abs(along) > DEEP_TERRITORY_DEPTH;

  if (Math.abs(along) > BASE_DEPTH) {
    return {
      label: `${ownerFem} база (хайграунд)`,
      side,
      deepInEnemyTerritory: side === "enemy",
    };
  }

  if (Math.abs(across) <= MID_LANE_HALF_WIDTH) {
    return { label: `мид, ${ownerFem} сторона`, side, deepInEnemyTerritory: deep };
  }

  // Which team's half the point lies in decides whose safe/off lane it is.
  const inRadiantHalf = along < 0;
  const onLaneEdge = dy < -LANE_EDGE_OFFSET || dx > LANE_EDGE_OFFSET || dx < -LANE_EDGE_OFFSET || dy > LANE_EDGE_OFFSET;
  const isSafeSide = inRadiantHalf ? bottomSide : !bottomSide;
  const kind = isSafeSide ? "сейфлейн" : "оффлейн";

  if (onLaneEdge) {
    return { label: `${ownerMasc} ${kind} (${bottomSide ? "бот" : "топ"})`, side, deepInEnemyTerritory: deep };
  }
  return {
    label: `${ownerMasc} лес у ${isSafeSide ? "сейфлейна" : "оффлейна"} (${bottomSide ? "низ" : "верх"} карты)`,
    side,
    deepInEnemyTerritory: deep,
  };
}

export function isBaseCell(x: number, y: number): boolean {
  return Math.abs(x + y - 2 * CENTER) > BASE_DEPTH;
}

// Which of the three physical lanes a grid cell sits in (null: base, river or jungle).
export function laneOfCell(x: number, y: number): "bottom" | "mid" | "top" | null {
  if (isBaseCell(x, y)) return null;
  const dx = x - CENTER;
  const dy = y - CENTER;
  if (Math.abs(dx - dy) <= MID_LANE_HALF_WIDTH) return Math.abs(dx + dy) <= RIVER_HALF_WIDTH ? null : "mid";
  const onEdge =
    dy < -LANE_EDGE_OFFSET || dx > LANE_EDGE_OFFSET || dx < -LANE_EDGE_OFFSET || dy > LANE_EDGE_OFFSET;
  if (!onEdge) return null;
  return dx - dy > 0 ? "bottom" : "top";
}

// Flattens a {x: {y: count}} position map into individual grid cells.
export function positionCells(
  positions: Record<string, Record<string, number>> | undefined
): { x: number; y: number; count: number }[] {
  const cells: { x: number; y: number; count: number }[] = [];
  for (const [x, column] of Object.entries(positions ?? {})) {
    for (const [y, count] of Object.entries(column)) {
      cells.push({ x: Number(x), y: Number(y), count });
    }
  }
  return cells;
}
