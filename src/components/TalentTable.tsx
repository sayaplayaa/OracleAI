import type { TalentLevel, TalentOption } from "@/lib/types";

function TalentCell({ option }: { option: TalentOption | undefined }) {
  if (!option) return <div className="bg-surface" />;
  const highlighted = option.isTopChoice || option.isHighestWin;

  return (
    <div
      className="p-3 text-center"
      style={highlighted ? { background: "var(--color-highlight-bg)" } : undefined}
    >
      <div
        className="text-sm font-semibold"
        style={{ color: highlighted ? "var(--color-highlight-text)" : "var(--color-ink)" }}
      >
        {option.label}
      </div>
      <div className="text-xs text-ink-muted mt-1 font-mono">
        {option.matchCount > 0
          ? `${option.matchCount.toLocaleString()} · ${(option.winRate * 100).toFixed(1)}% WR`
          : "No data"}
      </div>
      {(option.isTopChoice || option.isHighestWin) && (
        <div className="text-[10px] uppercase tracking-wide text-ink-muted mt-1">
          {option.isTopChoice && option.isHighestWin
            ? "Most picked · Highest win"
            : option.isTopChoice
              ? "Most picked"
              : "Highest win"}
        </div>
      )}
    </div>
  );
}

export function TalentTable({ levels }: { levels: TalentLevel[] }) {
  const hasAnyData = levels.some((l) => l.options.length > 0);
  if (!hasAnyData) {
    return <p className="text-sm text-ink-muted">Not enough data for this role yet.</p>;
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden divide-y divide-border">
      {levels.map((lvl) => (
        <div key={lvl.level} className="grid grid-cols-[1fr_auto_1fr] items-stretch">
          <TalentCell option={lvl.options[0]} />
          <div className="flex items-center justify-center w-10 text-xs font-mono text-ink-muted bg-surface-raised">
            {lvl.level}
          </div>
          <TalentCell option={lvl.options[1]} />
        </div>
      ))}
    </div>
  );
}
