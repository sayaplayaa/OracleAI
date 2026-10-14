import type { DraftInsights } from "@/lib/types";
import { MatchupList } from "../MatchupList";

/** Who the hero beats and loses to (OpenDota, all time) and its best lane partners (STRATZ, this week). */
export function HeroMatchupsSection({ heroName, insights }: { heroName: string; insights: DraftInsights | null }) {
  if (!insights) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary">
        OpenDota сейчас не отдаёт матчапы этого героя. Попробуй обновить страницу через минуту.
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-3 gap-4 items-start">
      <MatchupList
        title={`Против кого ${heroName} слаб`}
        note="Самые неудобные противники за всё время (OpenDota)."
        matchups={insights.toughestMatchups}
        emptyMessage="Пока ни против одного героя не набралось достаточно игр."
        accent="var(--color-status-critical)"
      />
      <MatchupList
        title={`Против кого ${heroName} силён`}
        note="Противники, которых герой обыгрывает чаще всего."
        matchups={insights.bestMatchups}
        emptyMessage="Пока ни против одного героя не набралось достаточно игр."
        accent="var(--color-status-good)"
      />
      <MatchupList
        title="Лучшие напарники по линии"
        note={
          insights.lanePosition
            ? `STRATZ, ${insights.lanePosition}, только текущая неделя - живая мета.`
            : "Синергия на линии по данным STRATZ."
        }
        matchups={insights.bestLanePartners}
        emptyMessage={
          insights.lanePosition
            ? "На этой неделе ни с одним напарником не набралось достаточно игр."
            : "Нет данных о синергии на линии (нужен ключ STRATZ_API_KEY)."
        }
        accent="var(--color-series-blue)"
      />
    </div>
  );
}
