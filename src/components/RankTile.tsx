import type { RankInfo } from "@/lib/constants";

export function RankTile({ rank }: { rank: RankInfo | null }) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3.5 overflow-hidden relative">
      {rank && <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: rank.color }} />}
      <div className="text-[11px] text-ink-muted uppercase tracking-wide font-medium">Ранг</div>
      <div className="text-2xl font-semibold text-ink mt-1.5 leading-none">
        {rank ? rank.label : "Без ранга"}
      </div>
      {rank && rank.star !== null && (
        <div className="flex gap-1 mt-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: i < rank.star! ? rank.color : "var(--color-baseline)",
              }}
            />
          ))}
        </div>
      )}
      {rank && rank.star === null && (
        <div className="text-xs text-ink-muted mt-1.5">Высший ранг</div>
      )}
    </div>
  );
}
