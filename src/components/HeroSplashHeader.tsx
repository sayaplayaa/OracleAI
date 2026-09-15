import { getHeroImage } from "@/lib/constants";
import type { ReactNode } from "react";

export function HeroSplashHeader({
  heroId,
  eyebrow,
  title,
  subtitle,
  accent,
  children,
}: {
  heroId: number;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: string;
  children?: ReactNode;
}) {
  const image = getHeroImage(heroId);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: image ? `url(${image})` : undefined }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--color-page) 15%, rgba(13,13,13,0.75) 55%, rgba(13,13,13,0.25) 100%)",
        }}
      />
      <div className="relative px-5 py-6 sm:px-8 sm:py-8 flex items-center justify-between gap-4 min-h-[132px]">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: accent ?? "var(--color-ink-muted)" }}
            >
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-ink-secondary mt-1">{subtitle}</p>}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}
