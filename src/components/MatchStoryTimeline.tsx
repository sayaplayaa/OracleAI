import type { MatchStory, MatchStoryEventType } from "@/lib/types";
import { formatMatchTime } from "@/lib/format";

const RADIANT_GREEN = "var(--color-status-good)";
const DIRE_RED = "var(--color-status-critical)";

const TYPE_LABELS: Record<MatchStoryEventType, string> = {
  first_blood: "Первая кровь",
  tower: "Башня",
  barracks: "Бараки",
  roshan: "Roshan",
  teamfight: "Тимфайт",
  swing: "Перелом",
  multi_kill: "Мульти-килл",
};

// Bigger dots for the moments that usually decide games.
const MAJOR: MatchStoryEventType[] = ["roshan", "barracks", "swing"];

export function MatchStoryTimeline({ story }: { story: MatchStory }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-bold text-base text-ink">Ключевые моменты</h3>
        <span className="flex items-center gap-3 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: RADIANT_GREEN }} />
            Radiant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: DIRE_RED }} />
            Dire
          </span>
        </span>
      </div>

      {story.events.length === 0 ? (
        <p className="text-sm text-ink-muted">По этой игре нет данных о зданиях, Roshan и тимфайтах.</p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:left-[63px] before:top-2 before:bottom-2 before:w-px before:bg-border">
          {story.events.map((event, i) => {
            const color = event.team === "radiant" ? RADIANT_GREEN : event.team === "dire" ? DIRE_RED : "var(--color-ink-muted)";
            const major = MAJOR.includes(event.type);
            return (
              <li key={i} className="relative flex gap-3 items-start">
                <span className="text-xs font-mono text-ink-muted w-10 shrink-0 pt-0.5 text-right tabular-nums">
                  {formatMatchTime(event.time)}
                </span>
                <span className="w-[22px] shrink-0 flex justify-center pt-1">
                  <span
                    className={`relative z-10 rounded-full ring-4 ring-surface ${major ? "w-3 h-3" : "w-2 h-2 mt-0.5"}`}
                    style={{ background: color }}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wide font-semibold mr-2" style={{ color }}>
                    {TYPE_LABELS[event.type]}
                  </span>
                  <span className={`text-sm ${major ? "text-ink font-medium" : "text-ink-secondary"}`}>{event.description}</span>
                  {event.detail && <p className="text-xs text-ink-muted mt-0.5">{event.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {story.highlights.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">Яркие моменты</h4>
          <ul className="space-y-1.5">
            {story.highlights.map((h, i) => (
              <li key={i} className="text-sm text-ink-secondary flex gap-2">
                <span className="text-accent" aria-hidden>
                  ★
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
