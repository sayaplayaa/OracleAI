import { ItemIcon } from "./ItemIcon";
import type { ItemProgressionPoint } from "@/lib/types";

function formatTime(seconds: number): string {
  return `${Math.round(seconds / 60)} мин`;
}

export function ItemTimeline({ items }: { items: ItemProgressionPoint[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">Для этой роли пока мало данных.</p>;
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-start gap-2 min-w-max relative pt-3">
        <div className="absolute top-[15px] left-2 right-2 h-px bg-border" />
        {items.map((item) => (
          <div key={item.itemKey} className="flex flex-col items-center w-16 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent mb-2 z-10" />
            <ItemIcon itemKey={item.itemKey} size={32} />
            <span className="text-[10px] text-ink-muted font-mono mt-1">
              {formatTime(item.avgTimeSeconds)}
            </span>
            <span className="text-[10px] text-ink-secondary text-center leading-tight mt-0.5 line-clamp-2">
              {item.itemName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
