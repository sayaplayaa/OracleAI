import Image from "next/image";
import type { HeroAbility } from "@/lib/types";

export function HeroAbilityList({ abilities }: { abilities: HeroAbility[] }) {
  if (abilities.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-sm text-ink-muted">No ability data available for this hero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {abilities.map((ability) => (
        <div
          key={ability.key}
          className="bg-surface border border-border rounded-lg p-4 flex gap-4"
        >
          {ability.iconUrl ? (
            <Image
              src={ability.iconUrl}
              alt={ability.name}
              width={48}
              height={48}
              className="rounded shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 rounded bg-surface-raised shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-ink">{ability.name}</h3>
              {ability.isInnate && (
                <span className="text-[10px] uppercase tracking-wide text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  Innate
                </span>
              )}
            </div>
            {ability.description && (
              <p className="text-sm text-ink-secondary mt-1">{ability.description}</p>
            )}
            {ability.attributes.length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {ability.attributes.map((attr) => (
                  <div key={attr.header} className="flex items-baseline gap-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-ink-muted">
                      {attr.header}
                    </dt>
                    <dd className="text-xs font-mono text-ink-secondary">{attr.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
