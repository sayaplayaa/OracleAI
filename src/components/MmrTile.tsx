import type { RankInfo } from "@/lib/constants";

export function MmrTile({ rank }: { rank: RankInfo | null }) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3.5">
      <div className="text-[11px] text-ink-muted uppercase tracking-wide font-medium">MMR</div>
      <div className="text-2xl font-semibold text-ink mt-1.5 leading-none font-mono tabular-nums">
        {rank ? rank.mmr.toLocaleString("ru-RU") : "—"}
      </div>
      <div className="text-xs text-ink-muted mt-1.5">
        {rank
          ? rank.mmrToNextRank !== null
            ? `${rank.mmrToNextRank.toLocaleString("ru-RU")} до ранга ${rank.nextRankLabel}`
            : "Вершина рейтинга"
          : "Без ранга"}
      </div>
    </div>
  );
}
