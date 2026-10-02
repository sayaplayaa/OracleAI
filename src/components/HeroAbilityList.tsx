import Image from "next/image";
import type { HeroAbility } from "@/lib/types";

export function HeroAbilityList({ abilities }: { abilities: HeroAbility[] }) {
  if (abilities.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6">
        <p className="text-sm text-ink-muted">Для этого героя нет данных о способностях.</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      {abilities.map((ability) => (
        <article
          key={ability.key}
          className="bg-surface border border-border hover:border-accent/40 rounded-2xl p-5 flex gap-4 transition"
          style={ability.isInnate ? { boxShadow: "inset 0 3px 0 0 var(--color-accent)" } : undefined}
        >
          {ability.iconUrl ? (
            <Image
              src={ability.iconUrl}
              alt={ability.name}
              width={56}
              height={56}
              className="rounded-xl border border-border shrink-0 w-14 h-14"
              unoptimized
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-surface-raised shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-ink">{ability.name}</h3>
              {ability.isInnate && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent/12 px-2 py-0.5 rounded-full">
                  Врождённая
                </span>
              )}
            </div>
            {ability.description && (
              <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">{ability.description}</p>
            )}
            {ability.attributes.some((a) => a.localized) && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-page/50 border border-border px-3 py-2">
                {ability.attributes
                  .filter((a) => a.localized)
                  .map((attr) => (
                    <div key={attr.header} className="contents">
                      <dt className="text-[11px] text-ink-muted">{attr.header}</dt>
                      <dd className="text-xs font-mono text-ink tabular-nums">{attr.value}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
