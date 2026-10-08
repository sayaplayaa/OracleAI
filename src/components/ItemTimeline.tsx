import { ItemIcon } from "./ItemIcon";
import type { ItemProgressionPoint } from "@/lib/types";

function formatTime(seconds: number): string {
  return `${Math.round(seconds / 60)}′`;
}

function pct(share: number | undefined): string | null {
  return share === undefined ? null : `${Math.round(share * 100)}%`;
}

/** Core items in their usual order: icon, usual minute, how often they're built, and what they're built from. */
export function ItemTimeline({ items }: { items: ItemProgressionPoint[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">Для этой роли пока мало данных.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-none pb-1">
      <ol className="flex items-start gap-1 min-w-max relative pt-1">
        <span className="absolute top-[25px] left-8 right-8 h-px bg-gradient-to-r from-accent/60 via-accent/30 to-transparent" aria-hidden />
        {items.map((item, i) => (
          <li key={item.itemKey} className="relative flex flex-col items-center w-[92px] shrink-0">
            <span className="relative rounded-md ring-2 ring-page">
              <ItemIcon itemKey={item.itemKey} size={48} />
              <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-accent text-page text-[9px] font-bold font-mono flex items-center justify-center">
                {i + 1}
              </span>
            </span>
            <span className="text-[11px] text-accent font-mono mt-1.5 tabular-nums">~{formatTime(item.avgTimeSeconds)}</span>
            <span className="text-[11px] text-ink text-center leading-tight mt-0.5 line-clamp-2 px-0.5">{item.itemName}</span>
            {pct(item.pickRate) && (
              <span className="text-[10px] font-mono text-ink-muted tabular-nums mt-0.5" title="В какой доле игр его собирают">
                {pct(item.pickRate)} игр
              </span>
            )}
            {item.builtFrom && item.builtFrom.length > 0 && (
              <span className="text-[10px] text-ink-muted text-center leading-tight mt-1 px-0.5">
                через {item.builtFrom.map((b) => b.itemName).join(", ")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
