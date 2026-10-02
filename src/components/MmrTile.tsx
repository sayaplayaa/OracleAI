import type { RankInfo } from "@/lib/constants";
import { StatTile } from "./StatTile";

export function MmrTile({ rank }: { rank: RankInfo | null }) {
  return (
    <StatTile
      label="MMR"
      value={rank ? rank.mmr.toLocaleString("ru-RU") : "-"}
      sub={
        rank
          ? rank.mmrToNextRank !== null
            ? `${rank.mmrToNextRank.toLocaleString("ru-RU")} до ранга ${rank.nextRankLabel}`
            : "Вершина рейтинга"
          : "Без ранга"
      }
    />
  );
}
