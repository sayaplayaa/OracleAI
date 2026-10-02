import { HeroIcon } from "./HeroIcon";
import type { FullMatchPlayer } from "@/lib/types";

const GRID_SIZE = 14;
// On the dark page more time reads as brighter: one accent hue, stepped opacity.
const HEAT_STEPS = [0.18, 0.32, 0.48, 0.64, 0.8, 1];

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
    <svg viewBox="0 0 100 100" className="w-full aspect-square rounded-lg bg-page border border-border">
      {grid.map((row, y) =>
        row.map((count, x) => {
          if (count === 0) return null;
          const intensity = Math.min(1, count / maxCount);
          const stepIndex = Math.min(HEAT_STEPS.length - 1, Math.floor(intensity * HEAT_STEPS.length));
          return (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={100 - (y + 1) * cellSize}
              width={cellSize}
              height={cellSize}
              fill="var(--color-accent)"
              fillOpacity={HEAT_STEPS[stepIndex]}
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
    <section className="bg-surface border border-border rounded-2xl p-5">
      <h3 className="font-display font-bold text-base text-ink">Где каждый игрок проводил время</h3>
      <p className="text-xs text-ink-muted mt-1 mb-4">
        Плотность позиций из разобранного реплея: чем ярче клетка, тем больше времени игрок провёл в этой
        точке. Шкала общая для всех 10 игроков.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {withHeatmap.map((p, i) => (
          <div key={`${p.heroId}-${p.accountId ?? "anon"}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="w-1 h-4 rounded-full shrink-0"
                style={{ background: p.isRadiant ? "#3fa34d" : "#e34948" }}
                aria-label={p.isRadiant ? "Radiant" : "Dire"}
              />
              <HeroIcon heroId={p.heroId} size={20} />
              <span className="text-xs text-ink truncate">{p.heroName}</span>
            </div>
            <MiniHeatmap grid={grids[i]} maxCount={maxCount} />
          </div>
        ))}
      </div>
    </section>
  );
}
