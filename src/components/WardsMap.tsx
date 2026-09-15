import type { FullMatchPlayer } from "@/lib/types";

const RADIANT_GREEN = "#008300";
const DIRE_RED = "#e34948";

type Point = { x: number; y: number; team: "radiant" | "dire"; time: number };
type Kind = "observer" | "sentry";

function collectPoints(players: FullMatchPlayer[], kind: Kind): Point[] {
  const points: Point[] = [];
  for (const p of players) {
    const wards = kind === "observer" ? p.observerWards : p.sentryWards;
    for (const w of wards) {
      points.push({ x: w.x, y: w.y, time: w.time, team: p.isRadiant ? "radiant" : "dire" });
    }
  }
  return points;
}

function WardLayer({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No wards recorded for this match.</p>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  return (
    <svg viewBox="0 0 100 100" className="w-full aspect-square rounded-md bg-page">
      <line x1="0" y1="100" x2="100" y2="0" stroke="var(--color-grid)" strokeWidth="0.5" />
      <text x="3" y="96" fontSize="4" fill="var(--color-status-good)">
        Radiant
      </text>
      <text x="80" y="6" fontSize="4" fill="var(--color-status-critical)" textAnchor="end">
        Dire
      </text>
      {points.map((p, i) => {
        const cx = ((p.x - minX) / spanX) * 100;
        const cy = 100 - ((p.y - minY) / spanY) * 100;
        const color = p.team === "radiant" ? RADIANT_GREEN : DIRE_RED;
        return <circle key={i} cx={cx} cy={cy} r={1.6} fill={color} fillOpacity={0.8} />;
      })}
    </svg>
  );
}

export function WardsMap({
  radiantPlayers,
  direPlayers,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
}) {
  const allPlayers = [...radiantPlayers, ...direPlayers];
  const observerPoints = collectPoints(allPlayers, "observer");
  const sentryPoints = collectPoints(allPlayers, "sentry");

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-ink-secondary mb-1">
        Ward placements
      </h3>
      <p className="text-xs text-ink-muted mb-3">
        Relative positions from this match&apos;s ward log - not a true
        minimap image.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs text-ink-muted uppercase tracking-wide mb-2">
            Observer wards ({observerPoints.length})
          </h4>
          <WardLayer points={observerPoints} />
        </div>
        <div>
          <h4 className="text-xs text-ink-muted uppercase tracking-wide mb-2">
            Sentry wards ({sentryPoints.length})
          </h4>
          <WardLayer points={sentryPoints} />
        </div>
      </div>
    </div>
  );
}
