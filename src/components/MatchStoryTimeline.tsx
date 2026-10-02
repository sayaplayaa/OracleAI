import type { MatchStory, MatchStoryEventType } from "@/lib/types";

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

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MatchStoryTimeline({ story }: { story: MatchStory }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-ink-secondary mb-4">Ключевые моменты</h3>

      {story.events.length === 0 ? (
        <p className="text-sm text-ink-muted">
          По этой игре нет данных о зданиях, Roshan и тимфайтах.
        </p>
      ) : (
        <ol className="space-y-3">
          {story.events.map((event, i) => {
            const color =
              event.team === "radiant" ? RADIANT_GREEN : event.team === "dire" ? DIRE_RED : "var(--color-ink-muted)";
            return (
              <li key={i} className="flex gap-3 border-l-2 pl-3" style={{ borderColor: color }}>
                <span className="text-xs font-mono text-ink-muted w-10 shrink-0 pt-0.5">
                  {formatClock(event.time)}
                </span>
                <div className="min-w-0">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold mr-2"
                    style={{ color }}
                  >
                    {TYPE_LABELS[event.type]}
                  </span>
                  <span className="text-sm text-ink">{event.description}</span>
                  {event.detail && (
                    <p className="text-xs text-ink-muted">{event.detail}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {story.highlights.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">
            Яркие моменты
          </h4>
          <ul className="space-y-1">
            {story.highlights.map((h, i) => (
              <li key={i} className="text-sm text-ink-secondary">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
