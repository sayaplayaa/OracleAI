import { ItemIcon } from "./ItemIcon";
import { PanelHeader } from "./PageHeader";
import type { ItemStat } from "@/lib/types";

export function ItemBuildList({
  title,
  description,
  items,
  emptyMessage = "Для этой роли пока мало данных.",
  columns = 1,
}: {
  title: string;
  description?: string;
  items: ItemStat[];
  emptyMessage?: string;
  columns?: 1 | 2;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <PanelHeader title={title} note={description} />
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <ul className={`grid gap-x-6 gap-y-1 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
          {items.map((item) => (
            <li key={item.itemKey} className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-raised transition">
              <ItemIcon itemKey={item.itemKey} size={32} />
              <span className="text-sm text-ink flex-1 truncate">{item.itemName}</span>
              <span className="text-xs font-mono text-ink-muted tabular-nums" title="Сколько раз покупали">
                {item.matchCount.toLocaleString("ru-RU")}
              </span>
              <span
                className="text-xs font-mono font-semibold w-14 text-right tabular-nums"
                style={{
                  color: item.winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)",
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
