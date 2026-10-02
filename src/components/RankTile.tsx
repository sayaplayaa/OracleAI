import type { RankInfo } from "@/lib/constants";
import { StatTile } from "./StatTile";

export function RankTile({ rank }: { rank: RankInfo | null }) {
  return (
    <StatTile
      label="Ранг"
      value={rank ? rank.label : "Без ранга"}
      mono={false}
      accent={rank?.color}
      sub={
        rank && rank.star !== null ? (
          <span className="flex gap-1 mt-1" aria-label={`${rank.star} из 5 звёзд`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: i < rank.star! ? rank.color : "var(--color-baseline)" }}
              />
            ))}
          </span>
        ) : rank ? (
          rank.leaderboardRank ? `Место в рейтинге: ${rank.leaderboardRank}` : "Высший ранг"
        ) : (
          "Нет калибровки"
        )
      }
    />
  );
}
