import { ItemIcon } from "./ItemIcon";
import type { NeutralItemTier } from "@/lib/types";

export function NeutralItemTiers({ tiers }: { tiers: NeutralItemTier[] }) {
  if (tiers.length === 0) {
    return <p className="text-sm text-ink-muted">Для этой роли пока мало данных.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {tiers.map((tier) => (
        <div key={tier.tier} className="rounded-xl bg-page/50 border border-border p-3">
          <h4 className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-ink">Тир {tier.tier}</span>
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">винрейт</span>
          </h4>
          <ul className="space-y-1">
            {tier.items.map((item, i) => (
              <li
                key={item.itemKey}
                className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${i === 0 ? "bg-status-good/10 ring-1 ring-status-good/50" : ""}`}
                title={i === 0 ? "Самый высокий винрейт в этом тире" : undefined}
              >
                <ItemIcon itemKey={item.itemKey} size={24} />
                <span className="text-[11px] text-ink-secondary flex-1 truncate">{item.itemName}</span>
                <span
                  className="text-[11px] font-mono font-semibold tabular-nums"
                  style={{
                    color: item.winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)",
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
