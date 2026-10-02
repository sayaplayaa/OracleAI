import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  accent,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div
      className="bg-surface border border-border rounded-2xl px-4 py-3.5 transition-colors hover:border-accent/40"
      style={accent ? { boxShadow: `inset 0 3px 0 0 ${accent}` } : undefined}
    >
      <p className="text-[11px] text-ink-muted uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-semibold text-ink mt-1.5 leading-none ${mono ? "font-mono tabular-nums" : "font-display"}`}>
        {value}
      </p>
      {sub && <div className="text-xs text-ink-muted mt-1.5">{sub}</div>}
    </div>
  );
}
