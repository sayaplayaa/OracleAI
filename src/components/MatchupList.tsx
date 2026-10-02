import Link from "next/link";
import { HeroIcon } from "./HeroIcon";
import { pluralRu } from "@/lib/format";
import type { HeroMatchup } from "@/lib/types";

export function MatchupList({
  title,
  note,
  matchups,
  emptyMessage,
  accent = "var(--color-accent)",
}: {
  title: string;
  note?: string;
  matchups: HeroMatchup[];
  emptyMessage: string;
  accent?: string;
}) {
  return (
    <section
      className="bg-surface border border-border rounded-2xl p-5"
      style={{ boxShadow: `inset 0 3px 0 0 ${accent}` }}
    >
      <div className="mb-4">
        <h3 className="font-display font-bold text-base text-ink">{title}</h3>
        {note && <p className="text-xs text-ink-muted mt-1 leading-relaxed">{note}</p>}
      </div>
      {matchups.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <ul className="space-y-0.5">
          {matchups.map((m) => {
            const color = m.winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)";
            return (
              <li key={m.heroId}>
                <Link
                  href={`/heroes/${m.heroId}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-raised transition"
                >
                  <HeroIcon heroId={m.heroId} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink truncate group-hover:text-accent transition">{m.heroName}</span>
                    <span className="block text-[11px] text-ink-muted font-mono tabular-nums">
                      {m.gamesPlayed.toLocaleString("ru-RU")} {pluralRu(m.gamesPlayed, ["игра", "игры", "игр"])}
                    </span>
                  </span>
                  <span className="w-16 h-1 rounded-full bg-page overflow-hidden hidden sm:block" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${Math.round(m.winRate * 100)}%`, background: color }} />
                  </span>
                  <span className="text-xs font-mono font-semibold w-10 text-right tabular-nums" style={{ color }}>
                    {Math.round(m.winRate * 100)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
