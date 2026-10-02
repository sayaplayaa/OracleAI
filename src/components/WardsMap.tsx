import { toMapPercent } from "@/lib/mapCoords";
import type { FullMatchPlayer } from "@/lib/types";
import { WardsMapView, type WardDot } from "./WardsMapView";

/** Flattens every player's ward log into minimap points for the interactive map. */
export function WardsMap({
  radiantPlayers,
  direPlayers,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
}) {
  const wards: WardDot[] = [];
  for (const p of [...radiantPlayers, ...direPlayers]) {
    for (const [kind, list] of [
      ["observer", p.observerWards],
      ["sentry", p.sentryWards],
    ] as const) {
      for (const w of list) {
        const { x, y } = toMapPercent(w.x, w.y);
        wards.push({ x, y, time: w.time, kind, team: p.isRadiant ? "radiant" : "dire", heroName: p.heroName });
      }
    }
  }
  return <WardsMapView wards={wards} />;
}
