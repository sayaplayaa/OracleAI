// OpenDota's obs_log/sen_log x/y are on Dota's real ~128-cell position grid
// (the same one lane_pos buckets into) - not raw world units, but a real,
// fixed, match-independent coordinate system. These bounds place real ward
// positions on the actual minimap image (public/minimap.png) instead of a
// per-match relative/synthetic grid. Bounds verified empirically against real
// match ward logs - observed x/y values cluster within [64, 198], and the
// resulting placements land in plausible tactical spots (river, jungle
// entrances, Roshan pit) on the real image.
const MAP_MIN = 64;
const MAP_MAX = 198;
const MAP_SPAN = MAP_MAX - MAP_MIN;

function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** A distance in grid cells (128 world units each) as a percent of the minimap width. */
export function cellsToMapPercent(cells: number): number {
  return (cells / MAP_SPAN) * 100;
}

// Dota's world Y increases northward; the minimap image's Y increases
// downward with Dire's base at the top - so Y is flipped, X is not.
export function toMapPercent(x: number, y: number): { x: number; y: number } {
  return {
    x: clampPercent(((x - MAP_MIN) / MAP_SPAN) * 100),
    y: clampPercent(100 - ((y - MAP_MIN) / MAP_SPAN) * 100),
  };
}
