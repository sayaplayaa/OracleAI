import { HeroIcon } from "./HeroIcon";
import { ItemIcon } from "./ItemIcon";
import type { FullMatchPlayer } from "@/lib/types";

function TeamTable({
  players,
  team,
  focusedAccountId,
}: {
  players: FullMatchPlayer[];
  team: "radiant" | "dire";
  focusedAccountId: number | null;
}) {
  const accent =
    team === "radiant" ? "var(--color-status-good)" : "var(--color-status-critical)";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[720px]">
        <thead>
          <tr className="text-xs text-ink-muted uppercase tracking-wide text-left">
            <th className="py-2 pr-3 font-medium" style={{ color: accent }}>
              {team === "radiant" ? "Radiant" : "Dire"}
            </th>
            <th className="py-2 px-2 font-medium">Lvl</th>
            <th className="py-2 px-2 font-medium">K / D / A</th>
            <th className="py-2 px-2 font-medium">LH / DN</th>
            <th className="py-2 px-2 font-medium">GPM</th>
            <th className="py-2 px-2 font-medium">XPM</th>
            <th className="py-2 px-2 font-medium">Net Worth</th>
            <th className="py-2 px-2 font-medium">Hero Dmg</th>
            <th className="py-2 px-2 font-medium">Tower Dmg</th>
            <th className="py-2 px-2 font-medium">Wards</th>
            <th className="py-2 px-2 font-medium">Items</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {players.map((p) => {
            const isFocused =
              focusedAccountId !== null && p.accountId === focusedAccountId;
            return (
              <tr
                key={`${p.heroId}-${p.accountId ?? "anon"}`}
                className={isFocused ? "bg-surface-raised" : undefined}
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <HeroIcon heroId={p.heroId} size={32} />
                    <div className="min-w-0">
                      <div className="text-ink font-medium truncate">
                        {p.heroName}
                      </div>
                      <div className="text-xs text-ink-muted truncate">
                        {p.personaname ?? "Anonymous"}
                        {isFocused && (
                          <span className="text-series-blue"> · you</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.level}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink">
                  {p.kills}/{p.deaths}/{p.assists}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.lastHits}/{p.denies}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.gpm}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.xpm}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink">
                  {p.netWorth.toLocaleString()}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.heroDamage.toLocaleString()}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.towerDamage.toLocaleString()}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-ink-secondary">
                  {p.obsPlaced}/{p.senPlaced}
                </td>
                <td className="py-2 px-2">
                  <div className="flex gap-1">
                    {p.itemKeys.length === 0 ? (
                      <span className="text-ink-muted">-</span>
                    ) : (
                      p.itemKeys.map((key, i) => (
                        <ItemIcon key={i} itemKey={key} size={24} />
                      ))
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FullMatchScoreboard({
  radiantPlayers,
  direPlayers,
  focusedAccountId,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  focusedAccountId: number | null;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-6">
      <TeamTable
        players={radiantPlayers}
        team="radiant"
        focusedAccountId={focusedAccountId}
      />
      <TeamTable
        players={direPlayers}
        team="dire"
        focusedAccountId={focusedAccountId}
      />
    </div>
  );
}
