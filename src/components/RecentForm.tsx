import Link from "next/link";
import { HeroIcon } from "./HeroIcon";
import type { TrendMatchSummary } from "@/lib/types";

/** Last games as a strip of hero icons, oldest on the left like a form guide. */
export function RecentForm({
  accountId,
  matches,
}: {
  accountId: number;
  matches: TrendMatchSummary[];
}) {
  const wins = matches.filter((m) => m.win).length;
  const losses = matches.length - wins;
  const ordered = [...matches].reverse();

  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-base text-ink">Форма</h3>
        <span className="text-xs font-mono tabular-nums">
          <span className="text-status-good">{wins}</span>
          <span className="text-ink-muted"> - </span>
          <span className="text-status-critical">{losses}</span>
          <span className="text-ink-muted"> за {matches.length}</span>
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {ordered.map((m) => (
          <Link
            key={m.matchId}
            href={`/player/${accountId}/match/${m.matchId}`}
            title={`${m.heroName} - ${m.win ? "Победа" : "Поражение"} (${m.kills}/${m.deaths}/${m.assists})`}
            className="group flex flex-col items-center gap-1"
          >
            <span className="rounded-md overflow-hidden ring-1 ring-border group-hover:ring-accent transition">
              <HeroIcon heroId={m.heroId} size={28} />
            </span>
            <span
              className="w-full h-1 rounded-full"
              style={{ background: m.win ? "var(--color-status-good)" : "var(--color-status-critical)" }}
              aria-hidden
            />
          </Link>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted mt-3">Слева - старые, справа - самая свежая игра.</p>
    </section>
  );
}
