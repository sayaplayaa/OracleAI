import { HeroIcon } from "./HeroIcon";
import { Sparkline } from "./Sparkline";
import type { FullMatchPlayer } from "@/lib/types";

const RADIANT_GREEN = "#008300";
const DIRE_RED = "#e34948";

function Card({ player }: { player: FullMatchPlayer }) {
  const color = player.isRadiant ? RADIANT_GREEN : DIRE_RED;
  const lastHits = player.farmTrend.map((f) => f.lastHits);
  const finalLastHits = lastHits[lastHits.length - 1] ?? player.lastHits;

  return (
    <div
      className="bg-surface-raised rounded-lg p-3 border-l-2"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-2 mb-2">
        <HeroIcon heroId={player.heroId} size={24} />
        <span className="text-xs text-ink truncate flex-1">{player.heroName}</span>
        <span className="text-xs font-mono text-ink-muted">{finalLastHits} LH</span>
      </div>
      {lastHits.length >= 2 ? (
        <Sparkline data={lastHits} color={color} width={160} height={32} />
      ) : (
        <p className="text-xs text-ink-muted">No timeline data.</p>
      )}
    </div>
  );
}

export function FarmSmallMultiples({
  radiantPlayers,
  direPlayers,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-ink-secondary mb-3">
        Farm pace (last hits over time)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...radiantPlayers, ...direPlayers].map((p) => (
          <Card key={`${p.heroId}-${p.accountId ?? "anon"}`} player={p} />
        ))}
      </div>
    </div>
  );
}
