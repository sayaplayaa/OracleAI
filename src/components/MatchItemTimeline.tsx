import { ItemIcon } from "./ItemIcon";

function formatMatchTime(seconds: number): string {
  if (seconds < 0) return "pre-game";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MatchItemTimeline({
  items,
}: {
  items: { time: number; itemName: string; itemKey: string }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">No parsed item purchases for this player.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1 w-16">
          <ItemIcon itemKey={item.itemKey} size={32} />
          <span className="text-[11px] text-ink-muted font-mono">
            {formatMatchTime(item.time)}
          </span>
          <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-2">
            {item.itemName}
          </span>
        </div>
      ))}
    </div>
  );
}
