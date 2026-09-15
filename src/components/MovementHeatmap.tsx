import { HeroIcon } from "./HeroIcon";
import type { FullMatchPlayer } from "@/lib/types";

const GRID_SIZE = 14;
// Sequential blue ramp, light -> dark (palette.md steps 100..700).
const BLUE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab", "#0d366b"];

function bucketIndex(value: number, min: number, span: number): number {
  const t = span === 0 ? 0 : (value - min) / span;
  return Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(t * GRID_SIZE)));
}

function buildGrid(
  cells: { x: number; y: number; count: number }[],
  bounds: { minX: number; spanX: number; minY: number; spanY: number }
): number[][] {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  for (const c of cells) {
    const bx = bucketIndex(c.x, bounds.minX, bounds.spanX);
    const by = bucketIndex(c.y, bounds.minY, bounds.spanY);
    grid[by][bx] += c.count;
  }
  return grid;
}

function MiniHeatmap({
  grid,
  maxCount,
}: {
  grid: number[][];
  maxCount: number;
}) {
  const cellSize = 100 / GRID_SIZE;
  return (
    <svg viewBox="0 0 100 100" className="w-full aspect-square rounded bg-page">
      {grid.map((row, y) =>
        row.map((count, x) => {
          if (count === 0) return null;
          const intensity = Math.min(1, count / maxCount);
          const stepIndex = Math.min(
            BLUE_RAMP.length - 1,
            Math.floor(intensity * BLUE_RAMP.length)
          );
          return (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={100 - (y + 1) * cellSize}
              width={cellSize}
              height={cellSize}
              fill={BLUE_RAMP[stepIndex]}
            />
          );
        })
      )}
    </svg>
  );
}

export function MovementHeatmap({
  radiantPlayers,
  direPlayers,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
}) {
  const allPlayers = [...radiantPlayers, ...direPlayers];
  const withHeatmap = allPlayers.filter((p) => p.positionHeatmap && p.positionHeatmap.length > 0);

  if (withHeatmap.length === 0) {
    return null;
  }

  const allCells = withHeatmap.flatMap((p) => p.positionHeatmap!);
  const xs = allCells.map((c) => c.x);
  const ys = allCells.map((c) => c.y);
  const bounds = {
    minX: Math.min(...xs),
    spanX: Math.max(...xs) - Math.min(...xs) || 1,
    minY: Math.min(...ys),
    spanY: Math.max(...ys) - Math.min(...ys) || 1,
  };

  const grids = withHeatmap.map((p) => buildGrid(p.positionHeatmap!, bounds));
  const maxCount = Math.max(...grids.flatMap((g) => g.flat()), 1);

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-ink-secondary mb-1">
        Where each player spent their time
      </h3>
      <p className="text-xs text-ink-muted mb-3">
        Position sample density from OpenDota&apos;s parsed replay - darker
        means more time spent there, on a shared scale across all 10
        players.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {withHeatmap.map((p, i) => (
          <div key={`${p.heroId}-${p.accountId ?? "anon"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <HeroIcon heroId={p.heroId} size={20} />
              <span className="text-xs text-ink truncate">{p.heroName}</span>
            </div>
            <MiniHeatmap grid={grids[i]} maxCount={maxCount} />
          </div>
        ))}
      </div>
    </div>
  );
}
