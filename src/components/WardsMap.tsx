import Image from "next/image";
import { toMapPercent } from "@/lib/mapCoords";
import type { FullMatchPlayer } from "@/lib/types";

const RADIANT_GREEN = "#0ca30c";
const DIRE_RED = "#e66767";

type Point = { x: number; y: number; team: "radiant" | "dire"; time: number };

function collectPoints(players: FullMatchPlayer[], kind: "observer" | "sentry"): Point[] {
  const points: Point[] = [];
  for (const p of players) {
    const wards = kind === "observer" ? p.observerWards : p.sentryWards;
    for (const w of wards) {
      const { x, y } = toMapPercent(w.x, w.y);
      points.push({ x, y, time: w.time, team: p.isRadiant ? "radiant" : "dire" });
    }
  }
  return points;
}

function WardLayer({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">В этой игре варды не записаны.</p>;
  }

  return (
    <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-border">
      <Image src="/minimap.png" alt="Миникарта Dota 2" fill className="object-cover" unoptimized />
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: 10,
            height: 10,
            background: p.team === "radiant" ? RADIANT_GREEN : DIRE_RED,
            border: "1.5px solid rgba(10,11,13,0.8)",
            boxShadow: "0 0 0 1px rgba(10,11,13,0.4)",
          }}
          title={`Вард ${p.team === "radiant" ? "Сил Света" : "Сил Тьмы"}`}
        />
      ))}
    </div>
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
      <h3 className="text-sm font-semibold text-ink-secondary mb-1">Расстановка вардов</h3>
      <p className="text-xs text-ink-muted mb-3">
        Реальные точки из лога вардов этой игры на миникарте Dota 2: зелёные -
        Radiant, красные - Dire.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs text-ink-muted uppercase tracking-wide mb-2">
            Observer Ward ({observerPoints.length})
          </h4>
          <WardLayer points={observerPoints} />
        </div>
        <div>
          <h4 className="text-xs text-ink-muted uppercase tracking-wide mb-2">
            Sentry Ward ({sentryPoints.length})
          </h4>
          <WardLayer points={sentryPoints} />
        </div>
      </div>
    </div>
  );
}
