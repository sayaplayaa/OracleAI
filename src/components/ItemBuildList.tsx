import { ItemIcon } from "./ItemIcon";
import type { ItemStat } from "@/lib/types";

export function ItemBuildList({
  title,
  description,
  items,
  emptyMessage = "Not enough data for this role yet.",
}: {
  title: string;
  description?: string;
  items: ItemStat[];
  emptyMessage?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        {title}
      </h3>
      {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted mt-3">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-border mt-2">
          {items.map((item) => (
            <li key={item.itemKey} className="flex items-center gap-3 py-2">
              <ItemIcon itemKey={item.itemKey} size={32} />
              <span className="text-sm text-ink flex-1 truncate">{item.itemName}</span>
              <span className="text-xs font-mono text-ink-muted">
                {item.matchCount.toLocaleString()}
              </span>
              <span
                className="text-xs font-mono font-semibold w-14 text-right"
                style={{
                  color:
                    item.winRate >= 0.5
                      ? "var(--color-status-good)"
                      : "var(--color-status-critical)",
                }}
              >
                {(item.winRate * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
