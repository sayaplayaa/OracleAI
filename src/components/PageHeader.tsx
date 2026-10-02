import Link from "next/link";
import type { ReactNode } from "react";

/** Small mono label above a heading, as on the home page sections. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] tracking-[0.2em] text-accent uppercase ${className}`}>{children}</p>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-ink-muted flex-wrap" aria-label="Навигация">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2 min-w-0">
          {i > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-accent transition truncate">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-secondary truncate" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Title block at the top of a section page: eyebrow, display title, lead text and an optional aside. */
export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
      <div className="max-w-3xl min-w-0">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink leading-[1.1]">{title}</h1>
        {description && <p className="mt-3 text-base text-ink-secondary leading-relaxed">{description}</p>}
        {children}
      </div>
      {aside && <div className="shrink-0 min-w-0">{aside}</div>}
    </header>
  );
}

/** Heading of a block inside a page. */
export function SectionHeading({
  eyebrow,
  title,
  note,
  right,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  note?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="font-display font-bold text-xl text-ink">{title}</h2>
        {note && <p className="text-sm text-ink-muted mt-1 max-w-3xl leading-relaxed">{note}</p>}
      </div>
      {right}
    </div>
  );
}

/** Heading inside a card. */
export function PanelHeader({
  title,
  note,
  right,
  icon,
}: {
  title: ReactNode;
  note?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <h3 className="font-display font-bold text-base text-ink">{title}</h3>
          {note && <p className="text-xs text-ink-muted mt-1 leading-relaxed">{note}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Rounded icon square in the accent color (same as the home page feature grid). */
export function IconBadge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{
        background: `color-mix(in srgb, ${color ?? "var(--color-accent)"} 14%, transparent)`,
        color: color ?? "var(--color-accent)",
      }}
      aria-hidden
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

/** A small value tile for banners: label on top, mono number below. */
export function BannerStat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl bg-page/50 border border-border px-3.5 py-2.5 min-w-[96px]">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="font-mono text-base text-ink tabular-nums mt-0.5" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

/** Centered message card for empty and failed states. */
export function Notice({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-8 text-center max-w-2xl mx-auto">
      <h2 className="font-display font-bold text-ink mb-2">{title}</h2>
      {children && <div className="text-sm text-ink-secondary leading-relaxed">{children}</div>}
      {action && <div className="mt-5 flex justify-center gap-3 flex-wrap">{action}</div>}
    </div>
  );
}
