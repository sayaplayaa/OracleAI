import { ItemIcon } from "./ItemIcon";

function formatMatchTime(seconds: number): string {
  if (seconds < 0) return "до старта";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ItemSlot({
  item,
  isCore,
}: {
  item: { time: number; itemName: string; itemKey: string };
  isCore: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className="relative">
        <ItemIcon itemKey={item.itemKey} size={32} />
        {isCore && (
          <span
            className="absolute inset-0 rounded pointer-events-none"
            style={{ boxShadow: "0 0 0 2px var(--color-accent)" }}
          />
        )}
      </div>
      <span className="text-[11px] text-ink-muted font-mono">{formatMatchTime(item.time)}</span>
      <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-2">
        {item.itemName}
      </span>
      {isCore && (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-accent">
          Кор
        </span>
      )}
    </div>
  );
}

export function MatchItemTimeline({
  items,
  startingItems,
  coreItemKeys,
}: {
  items: { time: number; itemName: string; itemKey: string }[];
  startingItems?: { time: number; itemName: string; itemKey: string }[];
  // Real STRATZ current-meta core-item keys for this player's hero+position
  // in this match - undefined/empty just means none highlighted, not an error.
  coreItemKeys?: string[];
}) {
  const coreSet = new Set(coreItemKeys ?? []);

  if (items.length === 0 && (!startingItems || startingItems.length === 0)) {
    return <p className="text-sm text-ink-muted">Нет разобранных покупок для этого игрока.</p>;
  }

  return (
    <div className="space-y-3">
      {startingItems && startingItems.length > 0 && (
        <div>
          <h4 className="text-[11px] text-ink-muted uppercase tracking-wide mb-1.5">
            Стартовые предметы
          </h4>
          <div className="flex flex-wrap gap-3">
            {startingItems.map((item, i) => (
              <ItemSlot key={i} item={item} isCore={false} />
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div>
          {startingItems && startingItems.length > 0 && (
            <h4 className="text-[11px] text-ink-muted uppercase tracking-wide mb-1.5">
              Покупки
            </h4>
          )}
          <div className="flex flex-wrap gap-3">
            {items.map((item, i) => (
              <ItemSlot key={i} item={item} isCore={coreSet.has(item.itemKey)} />
            ))}
          </div>
          {coreSet.size > 0 && (
            <p className="text-[11px] text-ink-muted mt-2">
              <span className="text-accent font-semibold">Кор</span> - предмет, который на этой
              неделе собирают в ≥25% игр на этом герое и позиции (данные STRATZ), а не наша оценка.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
