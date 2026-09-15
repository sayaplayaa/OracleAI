export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3">
      <div className="text-xs text-ink-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-semibold text-ink font-mono tabular-nums mt-1">
        {value}
      </div>
      {sub && <div className="text-xs text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}
