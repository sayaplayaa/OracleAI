export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="group relative bg-surface border border-border rounded-lg px-4 py-3.5 overflow-hidden transition-colors hover:border-ink-muted/40">
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: accent }}
        />
      )}
      <div className="text-[11px] text-ink-muted uppercase tracking-wide font-medium">
        {label}
      </div>
      <div className="text-2xl font-semibold text-ink font-mono tabular-nums mt-1.5 leading-none">
        {value}
      </div>
      {sub && <div className="text-xs text-ink-muted mt-1.5">{sub}</div>}
    </div>
  );
}
