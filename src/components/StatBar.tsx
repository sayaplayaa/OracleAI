import type { MetricPoint } from "@/lib/types";

function percentileColor(pct: number): string {
  if (pct >= 75) return "var(--color-status-good)";
  if (pct <= 25) return "var(--color-status-critical)";
  return "var(--color-accent)";
}

export function StatBar({ stat }: { stat: MetricPoint }) {
  const percentile = stat.percentile;

  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-sm text-ink-secondary">{stat.label}</span>
        <span className="text-sm font-mono text-ink tabular-nums">
          {typeof stat.value === "number" ? stat.value.toLocaleString("ru-RU") : stat.value}
          {stat.unit ? <span className="text-ink-muted ml-1">{stat.unit}</span> : null}
        </span>
      </div>
      {typeof percentile === "number" && (
        <>
          <div className="relative h-2 rounded-full bg-page overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.max(4, percentile)}%`, background: percentileColor(percentile) }}
            />
            <div className="absolute inset-y-0 left-1/2 w-px bg-ink-muted/50" title="Медиана" />
          </div>
          <div className="flex justify-between mt-1 text-[11px] text-ink-muted">
            <span>
              <span className="font-mono" style={{ color: percentileColor(percentile) }}>
                {percentile}
              </span>
              -й перцентиль
            </span>
            {stat.benchmarkMedian !== undefined && (
              <span>
                медиана <span className="font-mono">{stat.benchmarkMedian.toLocaleString("ru-RU")}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
