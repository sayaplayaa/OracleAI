import { ItemIcon } from "./ItemIcon";
import { formatMatchTime } from "@/lib/format";

type Purchase = { time: number; itemName: string; itemKey: string };

function ItemSlot({ item, isCore }: { item: Purchase; isCore: boolean }) {
  return (
    <li className="flex flex-col items-center gap-1 w-[60px]" title={item.itemName}>
      <span className="relative rounded-md" style={isCore ? { boxShadow: "0 0 0 2px var(--color-accent)" } : undefined}>
        <ItemIcon itemKey={item.itemKey} size={36} />
        {isCore && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wide bg-accent text-page px-1 rounded">
            Кор
          </span>
        )}
      </span>
      <span className="text-[11px] text-ink-muted font-mono tabular-nums">{formatMatchTime(item.time)}</span>
      <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-2 w-full [overflow-wrap:anywhere]">{item.itemName}</span>
    </li>
  );
}

export function MatchItemTimeline({
  items,
  startingItems,
  coreItemKeys,
}: {
  items: Purchase[];
  startingItems?: Purchase[];
  // Real STRATZ current-meta core-item keys for this player's hero+position
  // in this match - undefined/empty just means none highlighted, not an error.
  coreItemKeys?: string[];
}) {
  const coreSet = new Set(coreItemKeys ?? []);

  if (items.length === 0 && (!startingItems || startingItems.length === 0)) {
    return <p className="text-sm text-ink-muted">Нет разобранных покупок для этого игрока.</p>;
  }

  return (
    <div className="space-y-4">
      {startingItems && startingItems.length > 0 && (
        <div>
          <h4 className="text-[11px] text-ink-muted uppercase tracking-wide mb-2">Стартовые предметы</h4>
          <ul className="flex flex-wrap gap-2.5">
            {startingItems.map((item, i) => (
              <ItemSlot key={i} item={item} isCore={false} />
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div>
          {startingItems && startingItems.length > 0 && (
            <h4 className="text-[11px] text-ink-muted uppercase tracking-wide mb-2">Покупки по ходу игры</h4>
          )}
          <ul className="flex flex-wrap gap-2.5 pt-1">
            {items.map((item, i) => (
              <ItemSlot key={i} item={item} isCore={coreSet.has(item.itemKey)} />
            ))}
          </ul>
          {coreSet.size > 0 && (
            <p className="text-[11px] text-ink-muted mt-3">
              <span className="text-accent font-semibold">Кор</span> - предмет, который на этой неделе собирают в ≥25%
              игр на этом герое и позиции (данные STRATZ), а не наша оценка.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
