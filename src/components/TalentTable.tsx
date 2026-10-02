import { pluralRu } from "@/lib/format";
import type { TalentLevel, TalentOption } from "@/lib/types";

function TalentCell({ option, align }: { option: TalentOption | undefined; align: "left" | "right" }) {
  if (!option) return <div />;

  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${align === "left" ? "text-right" : "text-left"} ${
        option.isTopChoice ? "border-accent/50 bg-accent/8" : "border-border bg-page/50"
      }`}
    >
      <div className={`text-sm leading-snug ${option.isTopChoice ? "text-ink font-semibold" : "text-ink-secondary"}`}>
        {option.label}
      </div>
      <div className="text-[11px] text-ink-muted mt-1 font-mono tabular-nums">
        {option.matchCount > 0 ? (
          <>
            {option.matchCount.toLocaleString("ru-RU")} {pluralRu(option.matchCount, ["игра", "игры", "игр"])} ·{" "}
            <span className={option.isHighestWin ? "text-status-good" : undefined}>{(option.winRate * 100).toFixed(1)}%</span>
          </>
        ) : (
          "Нет данных"
        )}
      </div>
      {(option.isTopChoice || option.isHighestWin) && (
        <div className={`flex gap-1.5 mt-1.5 flex-wrap ${align === "left" ? "justify-end" : ""}`}>
          {option.isTopChoice && (
            <span className="text-[10px] uppercase tracking-wide text-accent">Чаще берут</span>
          )}
          {option.isHighestWin && (
            <span className="text-[10px] uppercase tracking-wide text-status-good">Выше винрейт</span>
          )}
        </div>
      )}
    </div>
  );
}

/** The talent tree as in game: level in the middle, left and right choice on each side. */
export function TalentTable({ levels }: { levels: TalentLevel[] }) {
  const hasAnyData = levels.some((l) => l.options.length > 0);
  if (!hasAnyData) {
    return <p className="text-sm text-ink-muted">Для этой роли пока мало данных.</p>;
  }

  return (
    <div className="space-y-2">
      {[...levels].sort((a, b) => b.level - a.level).map((lvl) => (
        <div key={lvl.level} className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
          <TalentCell option={lvl.options[0]} align="left" />
          <div className="flex items-center justify-center w-11 rounded-xl bg-accent/12 text-accent text-sm font-mono font-bold">
            {lvl.level}
          </div>
          <TalentCell option={lvl.options[1]} align="right" />
        </div>
      ))}
    </div>
  );
}
