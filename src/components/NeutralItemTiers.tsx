import { ItemIcon } from "./ItemIcon";
import type { NeutralItemTier } from "@/lib/types";

export function NeutralItemTiers({ tiers }: { tiers: NeutralItemTier[] }) {
  if (tiers.length === 0) {
    return <p className="text-sm text-ink-muted">Not enough data for this role yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiers.map((tier) => (
        <div key={tier.tier} className="bg-surface-raised border border-border rounded-lg p-3">
          <h4 className="text-xs font-semibold text-ink-secondary mb-2">Tier {tier.tier}</h4>
          <ul className="space-y-1.5">
            {tier.items.map((item, i) => (
              <li
                key={item.itemKey}
                className="flex items-center gap-2 rounded px-1.5 py-1"
                style={
                  i === 0
                    ? {
                        border: "1px solid var(--color-status-good)",
                        background: "color-mix(in srgb, var(--color-status-good) 10%, transparent)",
                      }
                    : undefined
                }
              >
                <ItemIcon itemKey={item.itemKey} size={24} />
                <span className="text-[11px] font-mono text-ink-muted flex-1 truncate">
                  {item.itemName}
                </span>
                <span
                  className="text-[11px] font-mono font-semibold"
                  style={{
                    color:
                      item.winRate >= 0.5
                        ? "var(--color-status-good)"
                        : "var(--color-status-critical)",
                  }}
                >
                  {(item.winRate * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
